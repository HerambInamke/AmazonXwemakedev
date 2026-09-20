import React from 'react';
import { RegionCode, REGION_NAMES, ExtremeAlert } from '../types';
import MaharashtraOutline from '../assets/maharashtra';
import './RegionMap.css';

interface Props {
  selectedRegion: RegionCode;
  onSelectRegion: (r: RegionCode) => void;
  alerts: ExtremeAlert[];
}

export default function RegionMap({ selectedRegion, onSelectRegion, alerts }: Props) {
  const regions: { code: RegionCode; x: number; y: number }[] = [
    { code: 'MUM', x: 200, y: 350 },
    { code: 'PUN', x: 250, y: 400 },
    { code: 'NGP', x: 550, y: 250 },
  ];

  const getMarkerColor = (code: RegionCode) => {
    const regionAlerts = alerts.filter(a => a.region_code === code);
    if (regionAlerts.some(a => a.severity === 'severe')) return 'var(--color-severe)';
    if (regionAlerts.some(a => a.severity === 'warning')) return 'var(--color-warning)';
    if (regionAlerts.some(a => a.severity === 'watch')) return 'var(--color-watch)';
    return 'var(--primary-blue)';
  };

  return (
    <div className="card region-map-card">
      <h2 className="panel-title">Regional Overview</h2>
      <div className="map-container">
        <MaharashtraOutline className="map-svg" />
        {regions.map(r => (
          <div 
            key={r.code}
            className={`map-marker ${selectedRegion === r.code ? 'active' : ''}`}
            style={{ 
              left: `${(r.x / 800) * 100}%`, 
              top: `${(r.y / 600) * 100}%`,
              backgroundColor: getMarkerColor(r.code)
            }}
            onClick={() => onSelectRegion(r.code)}
          >
            <div className="marker-ring"></div>
            <span className="marker-label">{REGION_NAMES[r.code]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
