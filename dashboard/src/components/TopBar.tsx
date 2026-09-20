import React from 'react';
import { RegionCode, REGION_NAMES } from '../types';
import { Cloud, Play } from 'lucide-react';
import './TopBar.css';

interface Props {
  region: RegionCode;
  setRegion: (r: RegionCode) => void;
  lastUpdated?: string;
  onRunPipeline: () => void;
}

export default function TopBar({ region, setRegion, lastUpdated, onRunPipeline }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Cloud className="topbar-icon" />
        <h1 className="topbar-title">ForecastBlend</h1>
      </div>
      <div className="topbar-center">
        {(Object.keys(REGION_NAMES) as RegionCode[]).map(code => (
          <button 
            key={code}
            className={`region-tab ${region === code ? 'active' : ''}`}
            onClick={() => setRegion(code)}
          >
            {REGION_NAMES[code]}
          </button>
        ))}
      </div>
      <div className="topbar-right">
        {lastUpdated && <span className="last-updated">Last updated: {new Date(lastUpdated).toLocaleString()}</span>}
        <button className="run-pipeline-btn" onClick={onRunPipeline}>
          <Play size={16} /> Run Pipeline Now
        </button>
      </div>
    </header>
  );
}
