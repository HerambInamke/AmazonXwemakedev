import { ModelSource, RegionCode, LeadHours, Variable, WeatherRegime } from '../types';

export function calculateWeights(maes: Record<string, number>) {
    const groups: Record<string, { model: ModelSource, mae: number }[]> = {};
    
    for (const key in maes) {
        const [region, lead, variable, regime, model] = key.split('|');
        const groupKey = `${region}|${lead}|${variable}|${regime}`;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push({ model: model as ModelSource, mae: maes[key] });
    }

    const epsilon = 0.01;
    const weights: Record<string, Record<ModelSource, number>> = {};

    for (const groupKey in groups) {
        const group = groups[groupKey];
        let totalScore = 0;
        
        const scores = group.map(g => {
            const score = 1 / (g.mae + epsilon);
            totalScore += score;
            return { model: g.model, score };
        });

        const groupWeights: Partial<Record<ModelSource, number>> = {};
        for (const s of scores) {
            groupWeights[s.model] = s.score / totalScore;
        }

        weights[groupKey] = groupWeights as Record<ModelSource, number>;
    }

    return weights;
}
