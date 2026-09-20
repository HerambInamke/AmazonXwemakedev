import { ForecastRaw, ModelSource, BlendedForecastValue } from '../types';

export function blendForecasts(
    forecasts: ForecastRaw[], 
    weights: Record<string, Record<ModelSource, number>>
): Record<string, BlendedForecastValue> {
    
    // Group forecasts by region, lead, variable
    // Wait, the prompt says "for the most recent cycle". 
    // We should expect `forecasts` to only contain the most recent cycle's forecasts.
    
    const groups: Record<string, ForecastRaw[]> = {};

    for (const f of forecasts) {
        const groupKey = `${f.region_code}|${f.lead_hours}|${f.variable}`;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(f);
    }

    const blended: Record<string, BlendedForecastValue> = {};

    for (const groupKey in groups) {
        const models = groups[groupKey];
        // they should share the same regime for the same target in a cycle
        const regime = models[0].weather_regime;
        const weightKey = `${groupKey}|${regime}`;
        
        const groupWeights = weights[weightKey];
        
        if (!groupWeights) {
            // fallback if no weights: equal weights
            let sum = 0;
            for (const m of models) sum += m.value;
            const w: Partial<Record<ModelSource, number>> = {};
            for (const m of models) w[m.model_source] = 1 / models.length;

            blended[groupKey] = {
                value: sum / models.length,
                confidence: 1 / models.length,
                weights: w as Record<ModelSource, number>
            };
            continue;
        }

        let blendedValue = 0;
        let maxWeight = 0;

        for (const m of models) {
            const w = groupWeights[m.model_source] || 0;
            blendedValue += m.value * w;
            if (w > maxWeight) maxWeight = w;
        }

        blended[groupKey] = {
            value: blendedValue,
            confidence: maxWeight,
            weights: groupWeights
        };
    }

    return blended;
}
