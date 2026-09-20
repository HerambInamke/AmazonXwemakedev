import { ExtremeAlert, RegionCode, Variable, BlendedForecastValue, ExtremeType } from '../types';

export function detectExtremes(
    region: RegionCode,
    issueTime: string,
    blended: Record<string, BlendedForecastValue>
): ExtremeAlert[] {
    const alerts: ExtremeAlert[] = [];

    // Keys in blended: `region_code|lead_hours|variable`
    for (const key in blended) {
        const [r, leadStr, variableStr] = key.split('|');
        if (r !== region) continue;

        const lead = parseInt(leadStr, 10);
        const variable = variableStr as Variable;
        const result = blended[key];
        const val = result.value;
        const targetDate = new Date(new Date(issueTime).getTime() + lead * 60 * 60 * 1000).toISOString();

        if (variable === 'rainfall_mm') {
            if (val > 115) {
                let severity: 'watch' | 'warning' | 'severe' = 'watch';
                let threshold = 115;
                if (val > 200) { severity = 'severe'; threshold = 200; }
                else if (val > 150) { severity = 'warning'; threshold = 150; }
                
                alerts.push({
                    region_code: region,
                    timestamp: targetDate,
                    type: 'heavy_rainfall',
                    severity,
                    confidence: result.confidence,
                    message: `Heavy rainfall expected: ${val.toFixed(1)} mm`,
                    variable,
                    value: val,
                    threshold
                });
            }
        } else if (variable === 'temp_c') {
            if (val >= 40) {
                let severity: 'watch' | 'warning' | 'severe' = 'watch';
                let threshold = 40;
                if (val >= 45) { severity = 'severe'; threshold = 45; }
                else if (val >= 43) { severity = 'warning'; threshold = 43; }
                
                alerts.push({
                    region_code: region,
                    timestamp: targetDate,
                    type: 'heatwave',
                    severity,
                    confidence: result.confidence,
                    message: `Heatwave conditions expected: ${val.toFixed(1)} °C`,
                    variable,
                    value: val,
                    threshold
                });
            }
        } else if (variable === 'wind_kmh') {
            if (val > 62) {
                let severity: 'watch' | 'warning' | 'severe' = 'watch';
                let threshold = 62;
                if (val > 100) { severity = 'severe'; threshold = 100; }
                else if (val > 80) { severity = 'warning'; threshold = 80; }
                
                alerts.push({
                    region_code: region,
                    timestamp: targetDate,
                    type: 'high_wind',
                    severity,
                    confidence: result.confidence,
                    message: `High winds expected: ${val.toFixed(1)} km/h`,
                    variable,
                    value: val,
                    threshold
                });
            }
        }
    }

    return alerts;
}
