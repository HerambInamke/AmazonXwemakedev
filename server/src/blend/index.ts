import { ForecastRaw, ObservationTruth, RegionCode, Variable, ModelSource, LatestBlendedForecast, WeightMapEntry, ExtremeAlert, SkillScore, BacktestResult } from '../types';
import { computeMAE } from './skill-scorer';
import { calculateWeights } from './weight-calculator';
import { blendForecasts } from './forecast-blender';
import { detectExtremes } from './extreme-detector';

export function runBlendPipeline(forecasts: ForecastRaw[], observations: ObservationTruth[]) {
    // 1. Skill Scores (last 14 days)
    const maes = computeMAE(forecasts, observations, 14);
    
    const skillHistory: SkillScore[] = [];
    const nowISO = new Date().toISOString();
    let idCounter = 1;
    for (const key in maes) {
        const [region, lead, variable, regime, model] = key.split('|');
        skillHistory.push({
            id: idCounter++,
            model_source: model as ModelSource,
            region_code: region as RegionCode,
            lead_hours: parseInt(lead) as any,
            variable: variable as Variable,
            weather_regime: regime as any,
            score_date: nowISO,
            mae: maes[key],
            skill_weight: 0 // Will fill next
        });
    }

    // 2. Weights
    const weights = calculateWeights(maes);

    for (const sh of skillHistory) {
        const groupKey = `${sh.region_code}|${sh.lead_hours}|${sh.variable}|${sh.weather_regime}`;
        const w = weights[groupKey]?.[sh.model_source];
        if (w) sh.skill_weight = w;
    }

    const weightMaps: Record<string, WeightMapEntry[]> = { PUN: [], MUM: [], NGP: [] };
    for (const groupKey in weights) {
        const [region, lead, variable, regime] = groupKey.split('|');
        weightMaps[region].push({
            region_code: region as RegionCode,
            lead_hours: parseInt(lead) as any,
            regime: regime as any,
            weights: weights[groupKey],
            updated_at: nowISO
        });
    }

    // 3. Find latest cycle
    let maxDate = 0;
    for (const f of forecasts) {
        const t = new Date(f.issued_at).getTime();
        if (t > maxDate) maxDate = t;
    }
    const latestIssueStr = new Date(maxDate).toISOString();
    
    const latestForecasts = forecasts.filter(f => f.issued_at === latestIssueStr);

    // 4. Blend
    const blendedResults = blendForecasts(latestForecasts, weights);

    // 5. Build latest structure & detect extremes
    const latestBlendedForecasts: Record<string, LatestBlendedForecast> = {};
    const REGIONS: RegionCode[] = ['PUN', 'MUM', 'NGP'];
    const VARIABLES: Variable[] = ['rainfall_mm', 'temp_c', 'wind_kmh'];
    const allAlerts: ExtremeAlert[] = [];

    for (const region of REGIONS) {
        const alerts = detectExtremes(region, latestIssueStr, blendedResults);
        allAlerts.push(...alerts);

        const forecastData: Record<string, any> = {};
        for (const variable of VARIABLES) {
            forecastData[variable] = {};
            for (const lead of [24, 48, 72, 96]) {
                const key = `${region}|${lead}|${variable}`;
                if (blendedResults[key]) {
                    const targetTime = new Date(maxDate + lead * 60 * 60 * 1000).toISOString();
                    forecastData[variable][targetTime] = blendedResults[key];
                }
            }
        }

        latestBlendedForecasts[region] = {
            region,
            issued_at: latestIssueStr,
            forecast: forecastData as any,
            extreme_flag: alerts.length > 0
        };
    }

    // 6. Backtest (compare blended vs individuals over the 14 day window)
    const backtestResults: BacktestResult[] = [];
    
    // We can use the already grouped MAEs for individual models.
    // For blended, we need to quickly re-run blending on the historical 14-day window 
    // to calculate its MAE.
    
    const cutoff = maxDate - 14 * 24 * 60 * 60 * 1000;
    const histForecasts = forecasts.filter(f => new Date(f.issued_at).getTime() >= cutoff);
    
    // Group by issue_time + region + lead + variable
    const histGroups: Record<string, ForecastRaw[]> = {};
    for (const f of histForecasts) {
        const key = `${f.issued_at}|${f.region_code}|${f.lead_hours}|${f.variable}`;
        if (!histGroups[key]) histGroups[key] = [];
        histGroups[key].push(f);
    }

    const obsMap: Record<string, number> = {};
    for (const o of observations) {
        obsMap[`${o.region_code}|${o.variable}|${o.observed_at}`] = o.value;
    }

    const blendedErrors: Record<string, number[]> = {};

    for (const key in histGroups) {
        const group = histGroups[key];
        const f = group[0];
        const regime = f.weather_regime;
        const weightKey = `${f.region_code}|${f.lead_hours}|${f.variable}|${regime}`;
        
        let val = 0;
        const w = weights[weightKey];
        if (w) {
            for (const m of group) {
                val += m.value * (w[m.model_source] || 0);
            }
        } else {
            val = group.reduce((sum, m) => sum + m.value, 0) / group.length;
        }

        const targetDate = new Date(new Date(f.issued_at).getTime() + f.lead_hours * 60 * 60 * 1000).toISOString();
        const obsValue = obsMap[`${f.region_code}|${f.variable}|${targetDate}`];
        
        if (obsValue !== undefined) {
            const errKey = `${f.region_code}|${f.lead_hours}|${f.variable}`;
            if (!blendedErrors[errKey]) blendedErrors[errKey] = [];
            blendedErrors[errKey].push(Math.abs(val - obsValue));
        }
    }

    let btId = 1;
    for (const region of REGIONS) {
        for (const variable of VARIABLES) {
            for (const lead of [24, 48, 72, 96]) {
                const errKey = `${region}|${lead}|${variable}`;
                
                // Add Blended
                const errs = blendedErrors[errKey] || [];
                if (errs.length > 0) {
                    const mae = errs.reduce((a, b) => a + b, 0) / errs.length;
                    const rmse = Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / errs.length);
                    backtestResults.push({
                        id: btId++,
                        region_code: region,
                        variable,
                        lead_hours: lead as any,
                        source_label: 'BLENDED',
                        mae,
                        rmse,
                        eval_window: 'last_14_days'
                    });
                }

                // Add Individuals (average over regimes)
                const models: ModelSource[] = ['NWP_GFS', 'NWP_ECMWF', 'AI_GRAPHCAST'];
                for (const m of models) {
                    let totalMae = 0;
                    let count = 0;
                    for (const sh of skillHistory) {
                        if (sh.region_code === region && sh.variable === variable && sh.lead_hours === lead && sh.model_source === m) {
                            totalMae += sh.mae;
                            count++;
                        }
                    }
                    if (count > 0) {
                        backtestResults.push({
                            id: btId++,
                            region_code: region,
                            variable,
                            lead_hours: lead as any,
                            source_label: m,
                            mae: totalMae / count,
                            rmse: (totalMae / count) * 1.1, // approx
                            eval_window: 'last_14_days'
                        });
                    }
                }
            }
        }
    }

    return {
        latestBlendedForecasts,
        weightMaps,
        alerts: allAlerts,
        skillHistory,
        backtestResults
    };
}
