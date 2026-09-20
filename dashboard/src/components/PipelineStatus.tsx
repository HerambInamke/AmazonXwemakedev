import React, { useEffect, useState } from 'react';
import { PipelineExecution } from '../types';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import './PipelineStatus.css';

interface Props {
  pipeline: PipelineExecution | null;
  setPipeline: (p: PipelineExecution | null) => void;
}

export default function PipelineStatus({ pipeline, setPipeline }: Props) {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    if (pipeline && pipeline.status === 'RUNNING') {
      const interval = setInterval(() => {
        setActiveStage(prev => {
          if (prev >= pipeline.stages.length - 1) {
            clearInterval(interval);
            setPipeline({ ...pipeline, status: 'SUCCEEDED' });
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setActiveStage(0);
    }
  }, [pipeline, setPipeline]);

  const stages = [
    'Ingest Model Outputs',
    'Normalize & Validate',
    'Compute Skill Scores',
    'Invoke Blend Weight Model',
    'Compute Blended Forecast',
    'Detect Extreme Conditions',
    'Run Backtest'
  ];

  return (
    <div className="card pipeline-card">
      <div className="pipeline-header">
        <h2 className="panel-title">Pipeline Execution Status</h2>
        {pipeline?.status === 'RUNNING' && <span className="running-badge">Running</span>}
        {pipeline?.status === 'SUCCEEDED' && <span className="success-badge">Completed</span>}
      </div>
      
      <div className="stepper">
        {stages.map((stage, idx) => {
          let status = 'pending';
          if (pipeline) {
            if (pipeline.status === 'SUCCEEDED') status = 'done';
            else if (idx < activeStage) status = 'done';
            else if (idx === activeStage) status = 'running';
          }

          return (
            <div key={idx} className={`step ${status}`}>
              <div className="step-icon">
                {status === 'done' && <CheckCircle2 size={20} className="icon-done" />}
                {status === 'running' && <Loader2 size={20} className="icon-running spin" />}
                {status === 'pending' && <Circle size={20} className="icon-pending" />}
              </div>
              <div className="step-content">
                <span className="step-label">{stage}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
