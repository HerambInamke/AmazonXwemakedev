import fs from 'fs';
import path from 'path';
import { ForecastRaw, ObservationTruth, RegionCode, ModelSource, Variable, WeatherRegime, LeadHours } from '../types';

function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const random = mulberry32(42);

// normal distribution approx
function randomNormal(mean: number = 0, stdDev: number = 1) {
  let u = 1 - random();
  let v = random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

const REGIONS: RegionCode[] = ['PUN', 'MUM', 'NGP'];
const LEAD_HOURS: LeadHours[] = [24, 48, 72, 96];
const VARIABLES: Variable[] = ['rainfall_mm', 'temp_c', 'wind_kmh'];
const MODELS: ModelSource[] = ['NWP_GFS', 'NWP_ECMWF', 'AI_GRAPHCAST'];
const REGIMES: WeatherRegime[] = ['convective', 'monsoon_synoptic', 'clear', 'western_disturbance'];

function generateData() {
  const forecasts: ForecastRaw[] = [];
  const observations: ObservationTruth[] = [];
  
  let forecastId = 1;
  let obsId = 1;

  const now = new Date('2026-09-20T00:00:00Z');
  const days = 30;
  
  // pre-generate truths for target times
  const truths: Record<string, number> = {};
  
  for (let d = days; d >= -5; d--) {
    for (const cycle of [0, 6, 12, 18]) {
       const targetDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000 + cycle * 60 * 60 * 1000);
       const targetStr = targetDate.toISOString();
       const regime = REGIMES[Math.floor(random() * REGIMES.length)];

       for (const region of REGIONS) {
         for (const variable of VARIABLES) {
           let baseValue = 0;
           if (variable === 'rainfall_mm') {
             baseValue = regime === 'convective' ? 25 : (regime === 'clear' ? 0 : 10);
             if (region === 'MUM') baseValue += 10;
           } else if (variable === 'temp_c') {
             baseValue = region === 'NGP' ? 35 : (region === 'PUN' ? 28 : 31);
             if (regime === 'clear') baseValue += 3;
           } else if (variable === 'wind_kmh') {
             baseValue = regime === 'monsoon_synoptic' ? 30 : 15;
           }

           const truthValue = Math.max(0, randomNormal(baseValue, baseValue * 0.1));
           truths[`${region}_${variable}_${targetStr}`] = truthValue;
           
           observations.push({
             id: obsId++,
             region_code: region,
             observed_at: targetStr,
             variable,
             value: truthValue
           });
         }
       }
    }
  }
  
  for (let d = days; d >= 0; d--) {
    for (const cycle of [0, 6, 12, 18]) {
      const issueDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000 + cycle * 60 * 60 * 1000);
      const regime = REGIMES[Math.floor(random() * REGIMES.length)];

      for (const region of REGIONS) {
        for (const variable of VARIABLES) {
           for (const lead of LEAD_HOURS) {
              const targetDate = new Date(issueDate.getTime() + lead * 60 * 60 * 1000);
              const targetStr = targetDate.toISOString();
              
              const truthValue = truths[`${region}_${variable}_${targetStr}`] || 0;

              for (const model of MODELS) {
                 let bias = 0;
                 let noise = 1;

                 if (model === 'NWP_GFS') {
                   bias = variable === 'rainfall_mm' ? 2 : (variable === 'temp_c' ? 1.5 : 3);
                   noise = 2;
                   if (regime === 'convective') noise += 3;
                   if (lead >= 72) { bias -= 0.5; noise -= 0.5; }
                 } else if (model === 'NWP_ECMWF') {
                   bias = variable === 'rainfall_mm' ? 0.5 : (variable === 'temp_c' ? 0.8 : 1);
                   noise = 1;
                   if (regime === 'monsoon_synoptic' && region === 'MUM') {
                     bias += 5;
                     noise += 2;
                   }
                 } else if (model === 'AI_GRAPHCAST') {
                   bias = lead === 24 ? 1 : lead / 24; 
                   if (variable === 'temp_c') bias *= 0.5;
                   noise = lead === 24 ? 0.5 : (lead === 96 ? 4 : 2);
                   if (regime === 'convective' && lead == 24) { noise = 0.2; bias = 0; }
                 }

                 const forecastValue = Math.max(0, randomNormal(truthValue + bias, noise));

                 forecasts.push({
                    id: forecastId++,
                    model_source: model,
                    region_code: region,
                    issued_at: issueDate.toISOString(),
                    lead_hours: lead,
                    variable,
                    value: forecastValue,
                    weather_regime: regime
                 });
              }
           }
        }
      }
    }
  }

  const outDir = path.join(__dirname, '../../generated-data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outDir, 'forecast_raw.json'), JSON.stringify(forecasts, null, 2));
  fs.writeFileSync(path.join(outDir, 'observation_truth.json'), JSON.stringify(observations, null, 2));
  console.log('Data generation complete.');
}

if (require.main === module) {
  generateData();
}

export { generateData };
