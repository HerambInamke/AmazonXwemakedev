import React from 'react';
import { ExtremeAlert, REGION_NAMES } from '../types';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import './AlertsFeed.css';

interface Props {
  alerts: ExtremeAlert[];
}

export default function AlertsFeed({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="card alerts-card empty">
        <h2 className="panel-title">Extreme Weather Alerts</h2>
        <div className="no-alerts">
          <CheckCircle size={32} className="success-icon" />
          <p>No active alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card alerts-card">
      <h2 className="panel-title">Extreme Weather Alerts</h2>
      <div className="alerts-list">
        {alerts.map((a, i) => (
          <div key={i} className={`alert-item severity-${a.severity}`}>
            <div className="alert-icon-col">
              <AlertTriangle size={20} />
            </div>
            <div className="alert-content">
              <div className="alert-header">
                <strong>{REGION_NAMES[a.region_code]}</strong>
                <span className="alert-time">{new Date(a.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <p className="alert-msg">{a.message}</p>
              <div className="alert-footer">
                <span className="alert-type">{a.type.replace('_', ' ')}</span>
                <span className="alert-conf">Confidence: {a.confidence}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
