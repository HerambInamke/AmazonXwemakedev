import { ForecastRaw, ObservationTruth } from '../types';

export function computeMAE(forecasts: ForecastRaw[], observations: ObservationTruth[], windowDays: number = 14) {
    const obsMap: Record<string, number> = {};
    for (const o of observations) {
        obsMap[`${o.region_code}|${o.variable}|${o.observed_at}`] = o.value;
    }

    const errors: Record<string, number[]> = {};

    let maxDate = 0;
    for (const f of forecasts) {
        const t = new Date(f.issued_at).getTime();
        if (t > maxDate) maxDate = t;
    }

    const cutoff = maxDate - windowDays * 24 * 60 * 60 * 1000;

    for (const f of forecasts) {
        const issueTime = new Date(f.issued_at).getTime();
        if (issueTime < cutoff) continue;

        const targetDate = new Date(issueTime + f.lead_hours * 60 * 60 * 1000).toISOString();
        const obsValue = obsMap[`${f.region_code}|${f.variable}|${targetDate}`];

        if (obsValue !== undefined) {
            const groupKey = `${f.region_code}|${f.lead_hours}|${f.variable}|${f.weather_regime}`;
            const key = `${groupKey}|${f.model_source}`;
            if (!errors[key]) errors[key] = [];
            errors[key].push(Math.abs(f.value - obsValue));
        }
    }

    const maes: Record<string, number> = {};
    for (const key in errors) {
        const errs = errors[key];
        const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
        maes[key] = mean;
    }

    return maes;
}
