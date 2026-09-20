import {
  RegionCode,
  LatestBlendedForecast,
  WeightMapEntry,
  ExtremeAlert,
  SkillScore,
  BacktestResult,
  PipelineExecution
} from '../types';

const BASE_URL = 'http://localhost:3001/api/v1';

async function fetchWithMockFallback<T>(url: string, mockData: T): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('API failed');
    return await response.json();
  } catch (error) {
    console.warn(`Falling back to mock data for ${url}`);
    return mockData;
  }
}

export async function fetchForecast(region: RegionCode): Promise<LatestBlendedForecast> {
  const mockData: LatestBlendedForecast = {
    region,
    issued_at: new Date().toISOString(),
    extreme_flag: true,
    forecast: {
      rainfall_mm: {
        '24': { value: 12.5, confidence: 85, weights: { NWP_GFS: 0.2, NWP_ECMWF: 0.3, AI_GRAPHCAST: 0.5 } },
        '48': { value: 18.2, confidence: 80, weights: { NWP_GFS: 0.25, NWP_ECMWF: 0.35, AI_GRAPHCAST: 0.4 } },
        '72': { value: 5.0, confidence: 70, weights: { NWP_GFS: 0.3, NWP_ECMWF: 0.3, AI_GRAPHCAST: 0.4 } },
        '96': { value: 2.1, confidence: 60, weights: { NWP_GFS: 0.33, NWP_ECMWF: 0.33, AI_GRAPHCAST: 0.34 } },
      },
      temp_c: {
        '24': { value: 28.5, confidence: 90, weights: { NWP_GFS: 0.4, NWP_ECMWF: 0.4, AI_GRAPHCAST: 0.2 } },
        '48': { value: 29.1, confidence: 85, weights: { NWP_GFS: 0.35, NWP_ECMWF: 0.45, AI_GRAPHCAST: 0.2 } },
        '72': { value: 27.8, confidence: 80, weights: { NWP_GFS: 0.3, NWP_ECMWF: 0.5, AI_GRAPHCAST: 0.2 } },
        '96': { value: 28.0, confidence: 75, weights: { NWP_GFS: 0.33, NWP_ECMWF: 0.33, AI_GRAPHCAST: 0.34 } },
      },
      wind_kmh: {
        '24': { value: 15.0, confidence: 85, weights: { NWP_GFS: 0.3, NWP_ECMWF: 0.3, AI_GRAPHCAST: 0.4 } },
        '48': { value: 18.5, confidence: 80, weights: { NWP_GFS: 0.25, NWP_ECMWF: 0.35, AI_GRAPHCAST: 0.4 } },
        '72': { value: 22.1, confidence: 75, weights: { NWP_GFS: 0.2, NWP_ECMWF: 0.4, AI_GRAPHCAST: 0.4 } },
        '96': { value: 12.0, confidence: 70, weights: { NWP_GFS: 0.33, NWP_ECMWF: 0.33, AI_GRAPHCAST: 0.34 } },
      }
    }
  };
  return fetchWithMockFallback(`${BASE_URL}/forecast/${region}`, mockData);
}

export async function fetchWeights(region: RegionCode): Promise<WeightMapEntry[]> {
  const mockData: WeightMapEntry[] = [
    { region_code: region, lead_hours: 24, regime: 'monsoon', updated_at: new Date().toISOString(), weights: { NWP_GFS: 0.2, NWP_ECMWF: 0.3, AI_GRAPHCAST: 0.5 } },
    { region_code: region, lead_hours: 48, regime: 'monsoon', updated_at: new Date().toISOString(), weights: { NWP_GFS: 0.25, NWP_ECMWF: 0.35, AI_GRAPHCAST: 0.4 } },
    { region_code: region, lead_hours: 72, regime: 'monsoon', updated_at: new Date().toISOString(), weights: { NWP_GFS: 0.3, NWP_ECMWF: 0.3, AI_GRAPHCAST: 0.4 } },
    { region_code: region, lead_hours: 96, regime: 'monsoon', updated_at: new Date().toISOString(), weights: { NWP_GFS: 0.33, NWP_ECMWF: 0.33, AI_GRAPHCAST: 0.34 } },
  ];
  return fetchWithMockFallback(`${BASE_URL}/weights/${region}`, mockData);
}

export async function fetchAlerts(region?: RegionCode): Promise<ExtremeAlert[]> {
  const mockData: ExtremeAlert[] = [
    { region_code: region || 'PUN', timestamp: new Date().toISOString(), type: 'heavy_rainfall', severity: 'warning', confidence: 85, message: 'Heavy rainfall expected in next 24h', variable: 'rainfall_mm', value: 12.5, threshold: 10 },
    { region_code: region || 'MUM', timestamp: new Date().toISOString(), type: 'high_wind', severity: 'watch', confidence: 70, message: 'Gusty winds developing', variable: 'wind_kmh', value: 22.1, threshold: 20 },
  ];
  return fetchWithMockFallback(`${BASE_URL}/alerts${region ? `?region=${region}` : ''}`, mockData);
}

export async function fetchSkillHistory(region: RegionCode): Promise<SkillScore[]> {
  const mockData: SkillScore[] = [];
  const sources = ['NWP_GFS', 'NWP_ECMWF', 'AI_GRAPHCAST'] as const;
  for (const source of sources) {
    mockData.push({ model_source: source, region_code: region, lead_hours: 24, variable: 'rainfall_mm', weather_regime: 'monsoon', score_date: new Date().toISOString(), mae: Math.random() * 2 + 1, skill_weight: 0.33 });
  }
  return fetchWithMockFallback(`${BASE_URL}/skill/${region}`, mockData);
}

export async function fetchBacktest(): Promise<BacktestResult[]> {
  const mockData: BacktestResult[] = [
    { region_code: 'PUN', variable: 'rainfall_mm', lead_hours: 24, source_label: 'NWP_GFS', mae: 2.5, rmse: 3.1, eval_window: '30d' },
    { region_code: 'PUN', variable: 'rainfall_mm', lead_hours: 24, source_label: 'NWP_ECMWF', mae: 2.1, rmse: 2.8, eval_window: '30d' },
    { region_code: 'PUN', variable: 'rainfall_mm', lead_hours: 24, source_label: 'AI_GRAPHCAST', mae: 1.8, rmse: 2.3, eval_window: '30d' },
    { region_code: 'PUN', variable: 'rainfall_mm', lead_hours: 24, source_label: 'BLENDED', mae: 1.2, rmse: 1.6, eval_window: '30d' },
    
    { region_code: 'PUN', variable: 'temp_c', lead_hours: 24, source_label: 'NWP_GFS', mae: 1.5, rmse: 2.1, eval_window: '30d' },
    { region_code: 'PUN', variable: 'temp_c', lead_hours: 24, source_label: 'NWP_ECMWF', mae: 1.2, rmse: 1.8, eval_window: '30d' },
    { region_code: 'PUN', variable: 'temp_c', lead_hours: 24, source_label: 'AI_GRAPHCAST', mae: 1.6, rmse: 2.2, eval_window: '30d' },
    { region_code: 'PUN', variable: 'temp_c', lead_hours: 24, source_label: 'BLENDED', mae: 0.9, rmse: 1.3, eval_window: '30d' },

    { region_code: 'PUN', variable: 'wind_kmh', lead_hours: 24, source_label: 'NWP_GFS', mae: 3.5, rmse: 4.1, eval_window: '30d' },
    { region_code: 'PUN', variable: 'wind_kmh', lead_hours: 24, source_label: 'NWP_ECMWF', mae: 3.2, rmse: 3.8, eval_window: '30d' },
    { region_code: 'PUN', variable: 'wind_kmh', lead_hours: 24, source_label: 'AI_GRAPHCAST', mae: 2.8, rmse: 3.5, eval_window: '30d' },
    { region_code: 'PUN', variable: 'wind_kmh', lead_hours: 24, source_label: 'BLENDED', mae: 2.1, rmse: 2.7, eval_window: '30d' },
  ];
  return fetchWithMockFallback(`${BASE_URL}/backtest`, mockData);
}

export async function triggerPipeline(): Promise<PipelineExecution> {
  const mockExecution: PipelineExecution = {
    executionId: Math.random().toString(36).substring(7),
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    stages: [
      { name: 'Ingest Model Outputs', status: 'PENDING' },
      { name: 'Normalize & Validate', status: 'PENDING' },
      { name: 'Compute Skill Scores', status: 'PENDING' },
      { name: 'Invoke Blend Weight Model', status: 'PENDING' },
      { name: 'Compute Blended Forecast', status: 'PENDING' },
      { name: 'Detect Extreme Conditions', status: 'PENDING' },
      { name: 'Run Backtest', status: 'PENDING' },
    ]
  };
  return fetchWithMockFallback(`${BASE_URL}/pipeline/trigger`, mockExecution);
}

export async function fetchPipelineStatus(id: string): Promise<PipelineExecution> {
  // A mock status just for types, logic will mostly be handled in components for demo
  const mockExecution: PipelineExecution = {
    executionId: id,
    status: 'SUCCEEDED',
    startedAt: new Date().toISOString(),
    stages: [
      { name: 'Ingest Model Outputs', status: 'SUCCEEDED' },
      { name: 'Normalize & Validate', status: 'SUCCEEDED' },
      { name: 'Compute Skill Scores', status: 'SUCCEEDED' },
      { name: 'Invoke Blend Weight Model', status: 'SUCCEEDED' },
      { name: 'Compute Blended Forecast', status: 'SUCCEEDED' },
      { name: 'Detect Extreme Conditions', status: 'SUCCEEDED' },
      { name: 'Run Backtest', status: 'SUCCEEDED' },
    ]
  };
  return fetchWithMockFallback(`${BASE_URL}/pipeline/status/${id}`, mockExecution);
}
