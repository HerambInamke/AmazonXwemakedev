# CLAUDE.md — Hybrid AI–NWP Multi-Model Forecast Blending System

> SIH 2026 · PS 26081 · Ministry of Earth Sciences (MoES) / NCMRWF · Theme: Disaster Management
> Integrated into the **SkyGuard AI** repo (PS 26073) — this module consumes SkyGuard's corrected sensor
> observations as one of its "ground truth" inputs for skill-scoring the blended forecast.

This file is the single source of truth for how this project is built. Read it fully before writing code.
Everything below assumes **dummy/synthetic data** for the demo build — no live NWP or satellite feeds are
wired up yet. Every data source is mocked but structured exactly like the real thing, so swapping in real
APIs later is a config change, not a rewrite.

---

## 1. What we're building (in one paragraph)

Different weather forecast sources — physical NWP models (GFS, ECMWF-style), ensemble spreads, and AI/ML
weather models (GraphCast-style) — are each better in different regions, seasons, lead times, and weather
regimes. This system takes multiple forecast sources for the same target (rainfall, temperature, wind,
extreme-weather indicators), scores each source's recent historical skill per region/lead-time/regime, and
computes **adaptive blend weights** to produce one optimized forecast. It exposes this as a dashboard
(blended maps + weight maps + skill charts) and as an API other systems (like SkyGuard AI) can call.

**Four things the judges need to see working:**
1. A **blended forecast** that is visibly different from any single input model.
2. A **model weight map** — which source is trusted more, by region/lead-time.
3. A **skill comparison** — blended forecast beats every individual model on a backtest.
4. An **extreme weather panel** — heavy rainfall / heatwave / high-wind flags with confidence.

---

## 2. Tech stack (per the assigned AWS service set)

Use **only** these services (the ones in the provided architecture sheet). Do not introduce services outside
this list without updating this file first.

| Layer | Service(s) | Role in this project |
|---|---|---|
| **ML / inference** | **SageMaker AI** | Hosts the blend-weight model (gradient-boosted regressor per region/lead-time/regime) as a SageMaker endpoint. Also runs the periodic retraining job (SageMaker Training Job / Processing Job). |
| **Compute (workers)** | **ECS + Fargate** | Runs the scheduled blending pipeline (fetch → normalize → score → blend → write) as containerized tasks. No EC2 servers to patch. |
| **Compute (glue/API)** | **Lambda, API Gateway, Step Functions** | Lambda = lightweight request/response functions (e.g., "get today's blended forecast for district X"). API Gateway = the public REST surface. Step Functions = orchestrates the multi-stage pipeline (ingest → clean → score → blend → persist → notify) with visual state tracking and retries. |
| **Compute (frontend hosting)** | **Amplify Hosting** | Hosts the static dashboard (React/Vite build). Chosen over EC2/Lightsail/App Runner because it's zero-ops for a static SPA and gives us CI on git push. |
| **Storage — object** | **S3** | Raw dummy NWP/AI model dumps (GRIB/NetCDF-style JSON stand-ins), generated PNG/GeoJSON map tiles, model artifacts. |
| **Storage — hot/fast** | **DynamoDB** | Latest blended forecast per region (single-digit-ms reads for the dashboard's "current forecast" widget), weight maps, session/user prefs. |
| **Storage — relational** | **RDS (Aurora, PostgreSQL-compatible)** | Historical forecasts, historical skill scores, backtest results — anything needing joins/aggregates ("show me skill trend for Pune district over last 30 days"). |
| **Auth** | **Cognito** | User pools for dashboard login (ops/forecaster role vs. public viewer role). |
| **Delivery / edge** | **CloudFront** | CDN in front of Amplify Hosting + S3 map tiles. |
| **DNS** | **Route 53** | Domain + subdomain routing (api.*, app.*). |
| **Event bus** | **EventBridge** | Scheduled trigger (e.g., every 6 hours, matching NWP cycle times 00/06/12/18Z) kicks off the Step Functions pipeline. Also routes "new extreme weather flag" events. |
| **Queues** | **SQS** | Decouples ingestion (many small per-model, per-region jobs) from the scoring stage; buffers bursts. |
| **Pub/Sub notifications** | **SNS** | Fans out extreme-weather alerts to subscribers (email/SMS stand-ins for the demo). |
| **Monitoring** | **CloudWatch** | Logs, pipeline-run dashboards, alarms if a model source goes stale/missing. |

**Why this shape:** it mirrors a real operational forecasting pipeline — batch/scheduled compute (ECS/Fargate
+ Step Functions) for the heavy blending work, Lambda only for thin API reads, SageMaker isolated as its own
inference layer so the weighting model can be retrained independently, and a fully serverless data/edge layer
so there's nothing to keep patched. It's also exactly the service list judges were told to expect, which
matters for a hackathon demo.

---

## 3. Repository placement

This lives **inside the SkyGuard AI monorepo**, as a sibling module:

```
skyguard-ai/
├── apps/
│   ├── skyguard/                    # existing PS 26073 app
│   └── forecast-blend/              # THIS PROJECT (PS 26081)
│       ├── dashboard/               # React SPA → Amplify Hosting
│       ├── pipeline/                # ECS/Fargate task containers
│       ├── functions/               # Lambda handlers
│       ├── stepfunctions/           # state machine definitions (ASL JSON)
│       ├── sagemaker/               # training + inference code for blend-weight model
│       ├── infra/                   # IaC (CDK, TypeScript)
│       ├── data/dummy/              # synthetic data generators + seed fixtures
│       └── CLAUDE.md                # ← this file
└── packages/
    └── shared-types/                # shared TS types, incl. corrected-observation schema from SkyGuard
```

**Integration point with SkyGuard:** SkyGuard AI's corrected ground-station observations (its anomaly-corrected
sensor readings) are read from `packages/shared-types` + a shared `observations` table/topic and used here as
the "truth" series that historical skill scores are computed against. In the dummy build, generate a
synthetic `corrected_observations` fixture that mimics SkyGuard's output shape — don't fake a cross-service
call yet.

---

## 4. Data model (dummy data, but real shape)

Generate synthetic data for **3 regions** (e.g., `PUN` Pune, `MUM` Mumbai, `NGP` Nagpur), **4 lead times**
(`+24h`, `+48h`, `+72h`, `+96h`), **4 variables** (`rainfall_mm`, `temp_c`, `wind_kmh`, `extreme_flag`), and
**3 model sources** (`NWP_GFS`, `NWP_ECMWF`, `AI_GRAPHCAST`), across a rolling **30-day** synthetic history so
skill scores have something to compute over.

### 4.1 Core tables (RDS/Aurora — Postgres)

```sql
-- Raw forecast issued by each source, for each cycle
CREATE TABLE forecast_raw (
  id            BIGSERIAL PRIMARY KEY,
  model_source  TEXT NOT NULL,          -- 'NWP_GFS' | 'NWP_ECMWF' | 'AI_GRAPHCAST'
  region_code   TEXT NOT NULL,          -- 'PUN' | 'MUM' | 'NGP'
  issued_at     TIMESTAMPTZ NOT NULL,   -- forecast cycle time (00/06/12/18Z)
  lead_hours    INT NOT NULL,           -- 24 | 48 | 72 | 96
  variable      TEXT NOT NULL,          -- 'rainfall_mm' | 'temp_c' | 'wind_kmh'
  value         NUMERIC NOT NULL,
  weather_regime TEXT                  -- 'convective' | 'monsoon_synoptic' | 'clear' | 'western_disturbance'
);

-- Ground truth (from SkyGuard's corrected observations, synthetic here)
CREATE TABLE observation_truth (
  id            BIGSERIAL PRIMARY KEY,
  region_code   TEXT NOT NULL,
  observed_at   TIMESTAMPTZ NOT NULL,
  variable      TEXT NOT NULL,
  value         NUMERIC NOT NULL
);

-- Computed per-source skill score, rolled up daily
CREATE TABLE skill_score (
  id            BIGSERIAL PRIMARY KEY,
  model_source  TEXT NOT NULL,
  region_code   TEXT NOT NULL,
  lead_hours    INT NOT NULL,
  variable      TEXT NOT NULL,
  weather_regime TEXT NOT NULL,
  score_date    DATE NOT NULL,
  mae           NUMERIC NOT NULL,       -- mean absolute error
  skill_weight  NUMERIC NOT NULL        -- normalized 0–1, sums to 1 across sources per (region, lead, var, regime)
);

-- Backtest results used for the "blended beats individual models" chart
CREATE TABLE backtest_result (
  id            BIGSERIAL PRIMARY KEY,
  region_code   TEXT NOT NULL,
  variable      TEXT NOT NULL,
  lead_hours    INT NOT NULL,
  source_label  TEXT NOT NULL,          -- 'NWP_GFS' | 'NWP_ECMWF' | 'AI_GRAPHCAST' | 'BLENDED'
  mae           NUMERIC NOT NULL,
  rmse          NUMERIC NOT NULL,
  eval_window   TEXT NOT NULL           -- e.g. '30d'
);
```

### 4.2 Hot-path tables (DynamoDB)

```
Table: LatestBlendedForecast
  PK: REGION#<region_code>
  SK: VAR#<variable>#LEAD#<lead_hours>
  Attributes: value, contributing_weights {NWP_GFS: 0.2, NWP_ECMWF: 0.3, AI_GRAPHCAST: 0.5},
              confidence, issued_at, extreme_flag (bool), extreme_type

Table: WeightMap
  PK: REGION#<region_code>
  SK: LEAD#<lead_hours>#REGIME#<regime>
  Attributes: weights {source: weight, ...}, updated_at

Table: ExtremeAlert
  PK: REGION#<region_code>
  SK: ALERT#<timestamp>
  Attributes: type ('heavy_rainfall'|'heatwave'|'high_wind'), severity, confidence, message
```

### 4.3 S3 layout

```
s3://forecast-blend-dummy/
  raw/{model_source}/{region_code}/{issued_at}.json     # synthetic per-cycle model dumps
  maps/blended/{region_code}/{issued_at}_{variable}.geojson
  maps/weights/{region_code}/{issued_at}.geojson
  sagemaker/training-data/{date}.csv
  sagemaker/model-artifacts/{version}/
```

### 4.4 Synthetic data generator rules (`data/dummy/generate.py` or `.ts`)

- Give each model source a **deliberate, consistent bias** so weighting has something real to learn:
  - `NWP_GFS`: slightly better at longer lead times (+72h/+96h), worse during convective regime.
  - `NWP_ECMWF`: best overall baseline, weaker during monsoon_synoptic in Mumbai specifically.
  - `AI_GRAPHCAST`: best at short lead times (+24h) and best during convective regime, weakest at +96h.
- Ground truth = a smooth seasonal/diurnal signal + noise; each model's forecast = truth + a source-specific
  bias function + regime-dependent noise. This makes the blend weights *mean something* instead of being
  random, which is what you'll point to when a judge asks "how do you know the weighting logic works?"
- Seed the generator (fixed random seed) so demo runs are reproducible.

---

## 5. Pipeline flow (Step Functions state machine)

Triggered by **EventBridge** on a schedule matching synthetic "forecast cycles" (every 6 hours in real life;
for the demo, expose a manual "Run Pipeline Now" button too).

```
EventBridge (rate/cron) ──▶ Step Functions: ForecastBlendPipeline
   │
   ├─ 1. IngestModelOutputs (parallel branch per model_source, run on ECS/Fargate)
   │      → reads/generates dummy raw forecasts → writes to S3 raw/ → enqueues SQS "ingested" messages
   │
   ├─ 2. NormalizeAndValidate (Lambda)
   │      → pulls from SQS, checks schema, flags missing/stale sources, writes forecast_raw rows (RDS)
   │      → on missing source: publish CloudWatch alarm + SNS notice ("NWP_ECMWF stale for PUN")
   │
   ├─ 3. ComputeSkillScores (ECS/Fargate task)
   │      → for each (region, lead, variable, regime): compare recent forecast_raw vs observation_truth
   │      → writes skill_score rows (RDS)
   │
   ├─ 4. InvokeBlendWeightModel (Lambda → SageMaker endpoint)
   │      → input: recent skill_score features → output: normalized weights per source
   │      → (dummy mode: SageMaker endpoint can be a simple inverse-MAE softmax, no real training needed
   │         to demo the architecture — see §7)
   │
   ├─ 5. ComputeBlendedForecast (ECS/Fargate task)
   │      → blended_value = Σ(weight_i × forecast_i) per (region, lead, variable)
   │      → writes LatestBlendedForecast + WeightMap to DynamoDB
   │      → writes maps/*.geojson to S3
   │
   ├─ 6. DetectExtremeConditions (Lambda)
   │      → threshold + trend rules on blended output (e.g., rainfall_mm > 115 in 24h = heavy rainfall flag)
   │      → writes ExtremeAlert to DynamoDB → publishes to SNS topic "extreme-weather-alerts"
   │
   └─ 7. RunBacktest (ECS/Fargate task, runs less frequently — daily)
          → recompute MAE/RMSE for each individual source AND the blended output over last 30d
          → writes backtest_result (RDS) → dashboard reads this for the "skill comparison" chart
```

All stage transitions, retries, and failures are visible in the Step Functions console — screenshot this for
the SIH presentation as your "operational workflow" deliverable.

---

## 6. API design (API Gateway → Lambda, reading from DynamoDB/RDS)

Base URL: `https://api.forecast-blend.<domain>/v1`
Auth: Cognito user pool JWT on all `/admin/*` routes; public read-only on `/public/*`.

| Method | Path | Purpose | Reads from |
|---|---|---|---|
| GET | `/public/forecast/{region}` | Latest blended forecast, all variables/lead times, for one region | DynamoDB `LatestBlendedForecast` |
| GET | `/public/forecast/{region}/{variable}` | Latest blended forecast for one variable, all lead times | DynamoDB |
| GET | `/public/weights/{region}` | Current weight map for a region (which model is trusted, by lead/regime) | DynamoDB `WeightMap` |
| GET | `/public/alerts` | Active extreme-weather alerts, all regions | DynamoDB `ExtremeAlert` |
| GET | `/public/alerts/{region}` | Active alerts for one region | DynamoDB |
| GET | `/admin/skill-history/{region}` | Historical skill scores over time (for trend chart) | RDS `skill_score` |
| GET | `/admin/backtest` | Blended-vs-individual-model MAE/RMSE comparison | RDS `backtest_result` |
| POST | `/admin/pipeline/run` | Manually trigger the Step Functions pipeline (demo button) | starts Step Functions execution |
| GET | `/admin/pipeline/status/{executionId}` | Poll pipeline run status | Step Functions `DescribeExecution` |
| GET | `/admin/models` | Metadata on the 3 model sources + last-ingested timestamps | RDS |

Response shape example (`GET /public/forecast/PUN`):

```json
{
  "region": "PUN",
  "issued_at": "2026-09-20T06:00:00Z",
  "forecast": {
    "rainfall_mm": {
      "24h": { "value": 12.4, "confidence": 0.81, "weights": { "NWP_GFS": 0.18, "NWP_ECMWF": 0.29, "AI_GRAPHCAST": 0.53 } },
      "48h": { "value": 8.1,  "confidence": 0.74, "weights": { "NWP_GFS": 0.24, "NWP_ECMWF": 0.33, "AI_GRAPHCAST": 0.43 } }
    },
    "temp_c": { "...": "..." },
    "wind_kmh": { "...": "..." }
  },
  "extreme_flag": false
}
```

---

## 7. Blending logic (the actual "intelligence")

Keep the model genuinely explainable — judges will ask "how does it decide the weights."

**Step A — per-source skill score** (done in `ComputeSkillScores`):
`MAE_source = mean(|forecast_source − observation_truth|)` over a trailing window (e.g., last 14 days),
computed separately for every `(region, lead_hours, variable, weather_regime)` combination.

**Step B — convert skill to weight** (done via SageMaker endpoint):
Use an inverse-error softmax so lower error → higher weight, and weights sum to 1:

```
raw_score_i = 1 / (MAE_i + ε)
weight_i    = raw_score_i / Σ(raw_score_j for all j)
```

This is intentionally simple and auditable for the dummy build. The **SageMaker piece** is real (an actual
deployed endpoint, actual model artifact), but the model itself can start as this closed-form calculation
wrapped in a `sagemaker-inference`-compatible container — that's a legitimate, defensible first version of
"the model," and it satisfies "SageMaker AI hosts the weighting model." Document that a gradient-boosted
regressor (XGBoost on SageMaker) is the natural v2 upgrade, trained on
`[recent MAE per source, lead_hours, regime, season, region]` → `[optimal weight vector]`, once there's
enough real historical data to train on — include this as a "Future Work" note, don't fake having trained it.

**Step C — blended value:**
`blended_value = Σ(weight_i × forecast_i)` per (region, lead, variable), for the most recent cycle.

**Step D — extreme detection (rule-based on top of the blended output):**
- Heavy rainfall: blended `rainfall_mm` over 24h > 115mm (IMD "very heavy rain" threshold) → flag, severity by magnitude.
- Heatwave: blended `temp_c` ≥ 40°C (plains) or ≥ 4.5°C above regional normal for 2+ consecutive forecast cycles.
- High wind: blended `wind_kmh` > 62 (gale-force threshold).
- Each flag carries a `confidence` = average of contributing models' weight on the dominant source, so a
  flag driven by one outlier model reads as lower-confidence than one where sources agree.

---

## 8. Frontend (dashboard) — UI/UX spec

**Design language:** clean operational/scientific dashboard, not a marketing site. Optimized for a judge
reading it quickly on a projector.

- **Background:** pure white (`#FFFFFF`) for all main surfaces; light gray (`#F5F6F8`) only for card
  containers to create subtle separation — never a colored or gradient background.
- **Text:** near-black (`#111318`) for all body/heading text — not pure `#000` (too harsh on white), not gray
  (readability). Minimum body text size **16px**, section headings **24–32px**, page title **36–40px**.
  Numbers in forecast cards (the actual value, e.g. "12.4 mm") are the largest element on the card —
  **28–36px, bold** — because that's the number a judge glances at from across the room.
- **Font:** a clean geometric/humanist sans-serif with good numeral legibility — Inter, or IBM Plex Sans, at
  system-font fallback. Use tabular numerals for any data table (`font-variant-numeric: tabular-nums`) so
  columns of numbers align.
- **Color use (restrained, functional only — never decorative):**
  - Primary accent (brand/action): deep blue `#1D4ED8` — buttons, active nav, links.
  - Data-source colors (consistent everywhere a source appears — legend, weight bars, chart lines):
    `NWP_GFS` → slate `#64748B`, `NWP_ECMWF` → teal `#0D9488`, `AI_GRAPHCAST` → indigo `#4F46E5`,
    `BLENDED` → the primary blue `#1D4ED8`, drawn **bolder/thicker** than the individual-model lines so it
    visually "wins" on every comparison chart.
  - Severity colors (extreme alerts only): amber `#D97706` (watch), orange `#EA580C` (warning),
    red `#DC2626` (severe) — never use red for anything else on the page.
  - Success/skill-improvement indicators: green `#16A34A`, used sparingly (e.g., "+18% skill vs best single
    model").
- **Whitespace:** generous card padding (24–32px), minimum 16px gutter between grid cards, section spacing
  of at least 48px between major dashboard blocks. Don't cram the weight-map, forecast cards, and charts into
  one dense screen — let each section breathe on its own visual band.
- **Layout:**
  1. **Top bar:** region selector (Pune/Mumbai/Nagpur tabs), last-updated timestamp, "Run Pipeline Now" button (admin only).
  2. **Hero row:** 4 large forecast cards (rainfall, temp, wind, extreme status) for the selected region, +24h lead by default, with a lead-time toggle (24/48/72/96h).
  3. **Weight map panel:** horizontal stacked bar per lead-time showing each model's contribution %, using the fixed source colors above, with a legend.
  4. **Map panel:** simple choropleth/marker map of the 3 regions colored by extreme-alert severity (or blended rainfall intensity) — can be a static SVG map of Maharashtra for the demo, no need for a real GIS library.
  5. **Skill comparison chart:** grouped bar or line chart, MAE per source vs. BLENDED, per variable — this is the single most important chart for judging, make it the widest element on the page.
  6. **Alerts feed:** simple list, severity-colored left border, timestamp, region, confidence.
  7. **Pipeline status (admin):** Step Functions execution state, stage-by-stage, with timestamps — visualizes the "operational workflow" deliverable live.
- **Components:** cards have a **1px `#E5E7EB` border**, no heavy drop shadows (a very subtle
  `0 1px 3px rgba(0,0,0,0.06)` at most) — keep it flat and scientific, not glossy.
- **Responsiveness:** desktop-first (this is a judged-on-a-laptop/projector demo), but don't break below
  1024px width; a single-column stack is fine on narrower screens.

---

## 9. Build order (what to actually do, in sequence)

1. **Data first.** Build the dummy data generator (§4.4) and seed RDS + S3 + DynamoDB via a one-off script.
   Nothing downstream matters if this data doesn't tell a believable story.
2. **Blending logic as a pure function/library**, unit-testable, before wiring any AWS service — implement
   §7 Steps A–D in plain TypeScript/Python with no infra dependency, test it against the seeded data, confirm
   `BLENDED` actually beats each individual source on MAE. This is your core IP; get it right in isolation.
3. **Wrap it for SageMaker** — package Step B as a SageMaker-compatible inference container/script, deploy to
   a real endpoint, confirm Lambda can invoke it.
4. **Step Functions pipeline**, stage by stage, each stage runnable/testable independently before chaining.
5. **API layer** (API Gateway + Lambda), reading from the now-populated DynamoDB/RDS.
6. **Dashboard**, built against the real API (not mocked fetches) once step 5 works, following §8.
7. **Auth (Cognito)**, **alerts (SNS)**, **monitoring (CloudWatch)** — wire these in last; they're important
   for the "AWS services used" checklist but shouldn't block the demo's core story if time runs short.
8. **IaC (CDK)** — write infra-as-code alongside each step above, not as a final pass; commit it as you go so
   the repo always deploys cleanly.

---

## 10. What "done" looks like for the SIH demo

- [ ] Selecting a region + lead time updates all 4 hero cards live from the real API.
- [ ] Weight map panel clearly shows different weight distributions across lead times and regions (not flat/uniform).
- [ ] Skill comparison chart shows `BLENDED` with lower MAE than every individual source, for at least rainfall and temperature.
- [ ] At least one seeded extreme-weather alert appears in the alerts feed with a plausible confidence score.
- [ ] "Run Pipeline Now" triggers a real Step Functions execution visible in the admin panel, end to end.
- [ ] CLAUDE.md (this file) stays in sync with whatever changes during the build — update it, don't let it drift.

---

## 11. Explicitly out of scope for the hackathon build

- Real NWP/GraphCast API integration (dummy data only, structured to swap in later).
- Real user accounts beyond one admin + one viewer demo login via Cognito.
- Multi-region AWS deployment / DR — single region is fine.
- Mobile app — dashboard is web-only.
- Real SMS/email delivery — SNS topic can exist with a console-visible subscriber for the demo.