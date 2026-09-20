import fs from 'fs';
import path from 'path';
import { ForecastRaw, ObservationTruth, RegionCode, ModelSource, Variable, LatestBlendedForecast, WeightMapEntry, ExtremeAlert, SkillScore, BacktestResult } from '../types';
import { runBlendPipeline } from '../blend/index';
import { generateData } from './generator';

class Store {
  forecasts: ForecastRaw[] = [];
  observations: ObservationTruth[] = [];
  
  latestBlendedForecasts: Record<string, LatestBlendedForecast | null> = { PUN: null, MUM: null, NGP: null };
  weightMaps: Record<string, WeightMapEntry[]> = { PUN: [], MUM: [], NGP: [] };
  alerts: ExtremeAlert[] = [];
  skillHistory: SkillScore[] = [];
  backtestResults: BacktestResult[] = [];

  load() {
    const outDir = path.join(__dirname, '../../generated-data');
    if (!fs.existsSync(path.join(outDir, 'forecast_raw.json'))) {
      generateData();
    }
    this.forecasts = JSON.parse(fs.readFileSync(path.join(outDir, 'forecast_raw.json'), 'utf8'));
    this.observations = JSON.parse(fs.readFileSync(path.join(outDir, 'observation_truth.json'), 'utf8'));
  }

  getForecasts(region?: RegionCode, source?: ModelSource, variable?: Variable) {
    let result = this.forecasts;
    if (region) result = result.filter(f => f.region_code === region);
    if (source) result = result.filter(f => f.model_source === source);
    if (variable) result = result.filter(f => f.variable === variable);
    return result;
  }

  getObservations(region?: RegionCode, variable?: Variable) {
    let result = this.observations;
    if (region) result = result.filter(o => o.region_code === region);
    if (variable) result = result.filter(o => o.variable === variable);
    return result;
  }

  getLatestBlended(region: RegionCode) {
    return this.latestBlendedForecasts[region];
  }

  getWeights(region: RegionCode) {
    return this.weightMaps[region] || [];
  }

  getAlerts(region?: RegionCode) {
    if (region) return this.alerts.filter(a => a.region_code === region);
    return this.alerts;
  }

  getSkillHistory(region: RegionCode) {
    return this.skillHistory.filter(s => s.region_code === region);
  }

  getBacktestResults() {
    return this.backtestResults;
  }

  runPipeline() {
    const results = runBlendPipeline(this.forecasts, this.observations);
    this.latestBlendedForecasts = results.latestBlendedForecasts;
    this.weightMaps = results.weightMaps;
    this.alerts = results.alerts;
    this.skillHistory = results.skillHistory;
    this.backtestResults = results.backtestResults;
    return { executionId: Date.now().toString(), status: 'completed' };
  }
}

export const store = new Store();
