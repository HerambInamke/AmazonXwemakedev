Hybrid AI–NWP Multi-Model Forecast Blending System — Implementation Plan
SIH 2026 · PS 26081 — Forecast Blend module for the SkyGuard AI monorepo

Overview
We're building a full-stack weather forecast blending system that takes outputs from 3 model sources (NWP_GFS, NWP_ECMWF, AI_GRAPHCAST), scores their historical accuracy, computes adaptive blend weights, and presents an optimized blended forecast via a dashboard + API. All data is synthetic/dummy but structured to match real data shapes for seamless future swap-in.

IMPORTANT

The build follows the exact sequence from §9 of 
claude.md
: Data → Blending logic → SageMaker → Pipeline → API → Dashboard → Auth/Alerts/Monitoring → IaC. Each phase is testable independently before moving on.

Proposed Changes
Phase 1 — Repository Scaffold & Shared Types
Create the full directory structure as specified in §3:

[NEW] Directory structure

apps/forecast-blend/
├── dashboard/           # React SPA (Vite) → Amplify Hosting
├── pipeline/            # ECS/Fargate task containers
├── functions/           # Lambda handlers
├── stepfunctions/       # State machine definitions (ASL JSON)
├── sagemaker/           # Training + inference code
├── infra/               # IaC (CDK, TypeScript)
└── data/dummy/          # Synthetic data generators + seed fixtures
packages/
└── shared-types/        # Shared TS types
Phase 2 — Shared Types (packages/shared-types)
[NEW] packages/shared-types/src/index.ts
TypeScript interfaces for all data models from §4:

ForecastRaw — raw forecast record per source/region/cycle
ObservationTruth — ground truth from SkyGuard corrected observations
SkillScore — per-source skill score with MAE + normalized weight
BacktestResult — blended vs individual MAE/RMSE comparison
LatestBlendedForecast — DynamoDB hot-path shape
WeightMap — DynamoDB weight map shape
ExtremeAlert — DynamoDB extreme alert shape
All enum types: ModelSource, RegionCode, Variable, WeatherRegime, LeadHours
Phase 3 — Synthetic Data Generator (data/dummy)
IMPORTANT

This is the foundation — nothing downstream works without believable synthetic data. Each model source gets deliberate, consistent bias (§4.4) so the blend weights are meaningful and demonstrable.

[NEW] apps/forecast-blend/data/dummy/generate.ts
Generates data for 3 regions (PUN, MUM, NGP), 4 lead times (24/48/72/96h), 4 variables (rainfall_mm, temp_c, wind_kmh, extreme_flag), 3 model sources, over 30-day rolling history
Ground truth = smooth seasonal/diurnal signal + noise
Model forecasts = truth + source-specific bias + regime-dependent noise:
NWP_GFS: better at +72h/+96h, worse in convective
NWP_ECMWF: best baseline, weaker in monsoon_synoptic for MUM
AI_GRAPHCAST: best at +24h and convective, weakest at +96h
Fixed random seed for reproducibility
Outputs: SQL seed files, JSON fixtures for S3, DynamoDB seed items
[NEW] apps/forecast-blend/data/dummy/seed-db.ts
Script to populate local PostgreSQL (or JSON files for demo) with generated data
Phase 4 — Blending Logic Library
Pure-function library, unit-testable with zero AWS dependency.

[NEW] apps/forecast-blend/pipeline/src/blend/skill-scorer.ts
Computes MAE_source = mean(|forecast − truth|) over trailing window per (region, lead, variable, regime) (§7 Step A)
[NEW] apps/forecast-blend/pipeline/src/blend/weight-calculator.ts
Inverse-error softmax: weight_i = (1/(MAE_i + ε)) / Σ(1/(MAE_j + ε)) (§7 Step B)
Weights sum to 1 per group
[NEW] apps/forecast-blend/pipeline/src/blend/forecast-blender.ts
blended_value = Σ(weight_i × forecast_i) per (region, lead, variable) (§7 Step C)
[NEW] apps/forecast-blend/pipeline/src/blend/extreme-detector.ts
Rule-based detection on blended output (§7 Step D):
Heavy rainfall: >115mm/24h
Heatwave: ≥40°C or ≥4.5°C above regional normal for 2+ cycles
High wind: >62 km/h
Confidence = average weight of dominant source
[NEW] apps/forecast-blend/pipeline/src/blend/__tests__/
Unit tests confirming BLENDED beats each individual source on MAE (the core proof point)
Phase 5 — SageMaker Inference Container
[NEW] apps/forecast-blend/sagemaker/inference/
Wraps Step B (inverse-MAE softmax) in a SageMaker-compatible inference script
Input: recent skill_score features → Output: normalized weight vector
Documented that XGBoost regressor is the v2 upgrade path
Phase 6 — Step Functions Pipeline
[NEW] apps/forecast-blend/stepfunctions/forecast-blend-pipeline.asl.json
7-stage state machine (§5): Ingest → Normalize → Score → InvokeBlendModel → Blend → DetectExtreme → Backtest
Parallel branches for model source ingestion
Error handling and retry policies
[NEW] apps/forecast-blend/pipeline/src/stages/
Individual stage implementations (ingest, normalize, score, blend, detect, backtest)
Each stage independently runnable/testable
Phase 7 — API Layer (Lambda + API Gateway)
[NEW] apps/forecast-blend/functions/
Lambda handlers per endpoint from §6:
GET /public/forecast/{region} — reads DynamoDB LatestBlendedForecast
GET /public/weights/{region} — reads DynamoDB WeightMap
GET /public/alerts — reads DynamoDB ExtremeAlert
GET /admin/skill-history/{region} — queries RDS skill_score
GET /admin/backtest — queries RDS backtest_result
POST /admin/pipeline/run — triggers Step Functions
GET /admin/pipeline/status/{executionId} — polls Step Functions
For demo/local development, a simple Express.js server will serve the same endpoints reading from the seed data files.

Phase 8 — Dashboard (React + Vite SPA)
Following §8 UI/UX spec exactly:

[NEW] apps/forecast-blend/dashboard/
Vite + React + TypeScript project
Design system:
White backgrounds (#FFFFFF), light gray cards (#F5F6F8)
Inter font, tabular numerals
Fixed source colors: GFS=#64748B, ECMWF=#0D9488, GraphCast=#4F46E5, Blended=#1D4ED8
Severity: amber #D97706, orange #EA580C, red #DC2626
Key components:

Top bar — Region selector (Pune/Mumbai/Nagpur), timestamp, "Run Pipeline" button
Hero row — 4 large forecast cards (rainfall, temp, wind, extreme) with lead-time toggle
Weight map panel — Horizontal stacked bars per lead-time
Map panel — SVG choropleth of Maharashtra with 3 region markers
Skill comparison chart — Grouped bar chart (MAE per source vs BLENDED) — widest element
Alerts feed — Severity-colored list with timestamps and confidence
Pipeline status — Stage-by-stage execution state (admin)
Phase 9 — Auth, Alerts, Monitoring (Stretch)
[NEW] Cognito setup, SNS topic, CloudWatch dashboards
Cognito: admin + viewer demo users
SNS: extreme-weather-alerts topic
CloudWatch: pipeline-run dashboards, staleness alarms
Phase 10 — Infrastructure as Code (CDK)
[NEW] apps/forecast-blend/infra/
CDK stacks covering all AWS services from §2
Written alongside each phase (committed incrementally)
Open Questions
IMPORTANT

Local vs AWS-first development: Should we build Phase 1–8 entirely locally first (Express API server + local JSON data) to get the dashboard working end-to-end, then layer in AWS services? Or do you want real AWS deployment from the start? Recommendation: local-first, so we can iterate on the dashboard and blending logic without AWS costs/delays.

IMPORTANT

Database for local dev: For the demo, should we use a local PostgreSQL instance, or mock the database with in-memory JSON/SQLite? SQLite would be simplest for "run anywhere" demo.

IMPORTANT

SageMaker endpoint: For the hackathon demo, do you want a real SageMaker endpoint deployed, or is it acceptable to have the blending logic run locally (showing the code is SageMaker-ready but skipping the deployment cost)?

IMPORTANT

Package manager: The repo is empty. Should we use npm, pnpm, or bun as the monorepo package manager?

Verification Plan
Automated Tests
Unit tests for blending logic: confirm BLENDED MAE < each individual source MAE
Data generator tests: verify output shapes match schema, biases are present
API endpoint tests: verify response shapes match §6 spec
npm run build succeeds for all packages
Manual Verification
Dashboard visually matches §8 spec: white/clean, correct colors, readable on projector
Selecting region + lead time updates all 4 hero cards
Weight map shows non-uniform distributions
Skill chart shows BLENDED winning
At least 1 extreme alert appears with confidence
"Run Pipeline Now" triggers visible pipeline execution