import React from 'react';
import { Variable, VARIABLE_LABELS, VARIABLE_UNITS, BlendedForecastValue } from '../types';
import { Droplets, Thermometer, Wind } from 'lucide-react';
import './ForecastCard.css';

interface Props {
  variable: Variable;
  data: BlendedForecastValue;
  extremeFlag: boolean;
}

export default function ForecastCard({ variable, data, extremeFlag }: Props) {
  const getIcon = () => {
    switch(variable) {
      case 'rainfall_mm': return <Droplets size={24} className="var-icon rain" />;
      case 'temp_c': return <Thermometer size={24} className="var-icon temp" />;
      case 'wind_kmh': return <Wind size={24} className="var-icon wind" />;
    }
  };

  return (
    <div className={`card forecast-card ${extremeFlag && variable === 'rainfall_mm' ? 'highlight' : ''}`}>
      <div className="fc-header">
        {getIcon()}
        <span className="fc-label">{VARIABLE_LABELS[variable]}</span>
      </div>
      <div className="fc-body">
        <span className="fc-value">{data.value.toFixed(1)}</span>
        <span className="fc-unit">{VARIABLE_UNITS[variable]}</span>
      </div>
      <div className="fc-footer">
        <div className="fc-confidence">Confidence: {data.confidence}%</div>
        <div className="weight-bar">
          <div className="wb-segment gfs" style={{ width: `${data.weights.NWP_GFS * 100}%` }} title="GFS" />
          <div className="wb-segment ecmwf" style={{ width: `${data.weights.NWP_ECMWF * 100}%` }} title="ECMWF" />
          <div className="wb-segment graphcast" style={{ width: `${data.weights.AI_GRAPHCAST * 100}%` }} title="GraphCast" />
        </div>
      </div>
    </div>
  );
}
