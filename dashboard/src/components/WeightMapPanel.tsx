import React from 'react';
import { WeightMapEntry, LeadHours } from '../types';
import './WeightMapPanel.css';

interface Props {
  weights: WeightMapEntry[];
  leadHours: LeadHours;
}

export default function WeightMapPanel({ weights, leadHours }: Props) {
  const sources = [
    { key: 'NWP_GFS', label: 'NWP GFS', color: 'var(--color-gfs)' },
    { key: 'NWP_ECMWF', label: 'NWP ECMWF', color: 'var(--color-ecmwf)' },
    { key: 'AI_GRAPHCAST', label: 'AI GraphCast', color: 'var(--color-graphcast)' },
  ];

  const leadTimes = [24, 48, 72, 96];

  return (
    <div className="card weight-panel">
      <h2 className="panel-title">Model Weight Distribution</h2>
      
      <div className="weight-legend">
        {sources.map(s => (
          <div key={s.key} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: s.color }}></span>
            <span className="legend-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="weight-bars">
        {leadTimes.map(lt => {
          const entry = weights.find(w => w.lead_hours === lt);
          if (!entry) return null;
          
          return (
            <div key={lt} className={`weight-row ${lt === leadHours ? 'active' : ''}`}>
              <div className="wr-label">+{lt}h</div>
              <div className="wr-bar-container">
                {sources.map(s => {
                  const val = entry.weights[s.key as keyof typeof entry.weights] * 100;
                  return (
                    <div 
                      key={s.key} 
                      className="wr-segment"
                      style={{ width: `${val}%`, backgroundColor: s.color }}
                    >
                      {val >= 15 ? `${val.toFixed(0)}%` : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
