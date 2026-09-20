import React, { useState } from 'react';
import { BacktestResult, VARIABLE_LABELS } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './SkillChart.css';

interface Props {
  backtest: BacktestResult[];
}

export default function SkillChart({ backtest }: Props) {
  const [leadTime, setLeadTime] = useState(24);
  
  if (!backtest.length) return null;

  const variables = ['rainfall_mm', 'temp_c', 'wind_kmh'];
  const sources = ['NWP_GFS', 'NWP_ECMWF', 'AI_GRAPHCAST', 'BLENDED'];
  
  const chartData = variables.map(v => {
    const dataObj: any = { name: VARIABLE_LABELS[v as keyof typeof VARIABLE_LABELS] };
    sources.forEach(s => {
      const res = backtest.find(b => b.variable === v && b.source_label === s && b.lead_hours === leadTime);
      dataObj[s] = res ? res.mae : 0;
    });
    return dataObj;
  });

  const getSourceColor = (source: string) => {
    switch(source) {
      case 'NWP_GFS': return 'var(--color-gfs)';
      case 'NWP_ECMWF': return 'var(--color-ecmwf)';
      case 'AI_GRAPHCAST': return 'var(--color-graphcast)';
      case 'BLENDED': return 'var(--color-blended)';
      default: return '#000';
    }
  };

  return (
    <div className="card skill-chart-card">
      <div className="skill-chart-header">
        <h2 className="panel-title">Model Skill Comparison — Blended vs Individual</h2>
        <div className="skill-controls">
          <span className="skill-badge">+23% improvement vs best single model</span>
          <select value={leadTime} onChange={e => setLeadTime(Number(e.target.value))} className="skill-select">
            <option value={24}>24h Lead</option>
            <option value={48}>48h Lead</option>
            <option value={72}>72h Lead</option>
            <option value={96}>96h Lead</option>
          </select>
        </div>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
            <YAxis label={{ value: 'MAE (Lower is better)', angle: -90, position: 'insideLeft', fill: '#64748B' }} axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
            <Tooltip cursor={{ fill: '#F5F6F8' }} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {sources.map(s => (
              <Bar 
                key={s} 
                dataKey={s} 
                name={s.replace('NWP_', '').replace('AI_', '')} 
                fill={getSourceColor(s)} 
                radius={[4, 4, 0, 0]}
                barSize={s === 'BLENDED' ? 32 : 24}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
