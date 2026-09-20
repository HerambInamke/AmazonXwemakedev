export type ModelSource = 'NWP_GFS' | 'NWP_ECMWF' | 'AI_GRAPHCAST';
export type RegionCode = 'PUN' | 'MUM' | 'NGP';
export type Variable = 'rainfall_mm' | 'temp_c' | 'wind_kmh';
export type WeatherRegime = 'convective' | 'monsoon_synoptic' | 'clear' | 'western_disturbance';
export type LeadHours = 24 | 48 | 72 | 96;
export type ExtremeType = 'heavy_rainfall' | 'heatwave' | 'high_wind';

export interface ForecastRaw {
  id: number;
  model_source: ModelSource;
  region_code: RegionCode;
  issued_at: string; // ISO timestamp
  lead_hours: LeadHours;
  variable: Variable;
  value: number;
  weather_regime: WeatherRegime;
}

export interface ObservationTruth {
  id: number;
  region_code: RegionCode;
  observed_at: string;
  variable: Variable;
  value: number;
}

export interface SkillScore {
  id: number;
  model_source: ModelSource;
  region_code: RegionCode;
  lead_hours: LeadHours;
  variable: Variable;
  weather_regime: WeatherRegime;
  score_date: string;
  mae: number;
  skill_weight: number;
}

export interface BacktestResult {
  id: number;
  region_code: RegionCode;
  variable: Variable;
  lead_hours: LeadHours;
  source_label: ModelSource | 'BLENDED';
  mae: number;
  rmse: number;
  eval_window: string;
}

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
  regime: WeatherRegime;
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
