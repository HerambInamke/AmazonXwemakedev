export type ModelSource = 'NWP_GFS' | 'NWP_ECMWF' | 'AI_GRAPHCAST';
export type RegionCode = 'PUN' | 'MUM' | 'NGP';
export type Variable = 'rainfall_mm' | 'temp_c' | 'wind_kmh';
export type LeadHours = 24 | 48 | 72 | 96;
export type ExtremeType = 'heavy_rainfall' | 'heatwave' | 'high_wind';

export interface BlendedForecastValue {
  value: number;
  confidence: number;
  weights: Record<ModelSource, number>;
}

export interface LatestBlendedForecast {
  region: RegionCode;
  issued_at: string;
  forecast: Record<Variable, Record<string, BlendedForecastValue>>;
  extreme_flag: boolean;
}

export interface WeightMapEntry {
  region_code: RegionCode;
  lead_hours: LeadHours;
  regime: string;
  weights: Record<ModelSource, number>;
  updated_at: string;
}

export interface ExtremeAlert {
  region_code: RegionCode;
  timestamp: string;
  type: ExtremeType;
  severity: 'watch' | 'warning' | 'severe';
  confidence: number;
  message: string;
  variable: Variable;
  value: number;
  threshold: number;
}

export interface SkillScore {
  model_source: ModelSource;
  region_code: RegionCode;
  lead_hours: LeadHours;
  variable: Variable;
  weather_regime: string;
  score_date: string;
  mae: number;
  skill_weight: number;
}

export interface BacktestResult {
  region_code: RegionCode;
  variable: Variable;
  lead_hours: LeadHours;
  source_label: ModelSource | 'BLENDED';
  mae: number;
  rmse: number;
  eval_window: string;
}

export interface PipelineExecution {
  executionId: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  startedAt: string;
  stages: Array<{
    name: string;
    status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    startedAt?: string;
    completedAt?: string;
  }>;
}

export const REGION_NAMES: Record<RegionCode, string> = {
  PUN: 'Pune',
  MUM: 'Mumbai',
  NGP: 'Nagpur',
};

export const VARIABLE_LABELS: Record<Variable, string> = {
  rainfall_mm: 'Rainfall',
  temp_c: 'Temperature',
  wind_kmh: 'Wind Speed',
};

export const VARIABLE_UNITS: Record<Variable, string> = {
  rainfall_mm: 'mm',
  temp_c: '°C',
  wind_kmh: 'km/h',
};

export const SOURCE_COLORS: Record<ModelSource | 'BLENDED', string> = {
  NWP_GFS: '#64748B',
  NWP_ECMWF: '#0D9488',
  AI_GRAPHCAST: '#4F46E5',
  BLENDED: '#1D4ED8',
};

export const SEVERITY_COLORS = {
  watch: '#D97706',
  warning: '#EA580C',
  severe: '#DC2626',
};
