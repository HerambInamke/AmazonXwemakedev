import React from 'react';
import { LatestBlendedForecast, LeadHours } from '../types';
import ForecastCard from './ForecastCard';
import './HeroRow.css';

interface Props {
  forecast: LatestBlendedForecast | null;
  leadHours: LeadHours;
  setLeadHours: (l: LeadHours) => void;
  loading: boolean;
}

export default function HeroRow({ forecast, leadHours, setLeadHours, loading }: Props) {
  const leadOptions: LeadHours[] = [24, 48, 72, 96];

  if (loading || !forecast) {
    return <div className="hero-row-loading">Loading forecast...</div>;
  }

  const rainData = forecast.forecast.rainfall_mm[leadHours.toString()];
  const tempData = forecast.forecast.temp_c[leadHours.toString()];
  const windData = forecast.forecast.wind_kmh[leadHours.toString()];

  return (
    <div className="hero-row-container">
      <div className="lead-time-toggle">
        {leadOptions.map(l => (
          <button 
            key={l}
            className={`lead-btn ${leadHours === l ? 'active' : ''}`}
            onClick={() => setLeadHours(l)}
          >
            +{l}h
          </button>
        ))}
      </div>
      <div className="hero-grid">
        <ForecastCard variable="rainfall_mm" data={rainData} extremeFlag={forecast.extreme_flag} />
        <ForecastCard variable="temp_c" data={tempData} extremeFlag={false} />
        <ForecastCard variable="wind_kmh" data={windData} extremeFlag={false} />
        <div className={`card extreme-status-card ${forecast.extreme_flag ? 'extreme' : 'normal'}`}>
          <h3>Extreme Weather Status</h3>
          <div className="status-indicator">
            <span className={`pulse-dot ${forecast.extreme_flag ? 'pulsing' : ''}`}></span>
            {forecast.extreme_flag ? 'Active Alerts' : 'All Clear'}
          </div>
        </div>
      </div>
    </div>
  );
}
