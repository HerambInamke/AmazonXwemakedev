import React, { useState } from 'react';
import './App.css';
import { RegionCode, LeadHours } from './types';
import { useForecasts } from './hooks/useForecasts';

import TopBar from './components/TopBar';
import HeroRow from './components/HeroRow';
import WeightMapPanel from './components/WeightMapPanel';
import RegionMap from './components/RegionMap';
import SkillChart from './components/SkillChart';
import AlertsFeed from './components/AlertsFeed';
import PipelineStatus from './components/PipelineStatus';

function App() {
  const [region, setRegion] = useState<RegionCode>('PUN');
  const [leadHours, setLeadHours] = useState<LeadHours>(24);

  const { forecast, weights, alerts, backtest, pipeline, setPipeline, loading, runPipeline } = useForecasts(region, leadHours);

  return (
    <div className="app">
      <TopBar 
        region={region} 
        setRegion={setRegion} 
        lastUpdated={forecast?.issued_at}
        onRunPipeline={runPipeline}
      />
      
      <main className="dashboard">
        <HeroRow 
          forecast={forecast} 
          leadHours={leadHours} 
          setLeadHours={setLeadHours} 
          loading={loading}
        />
        
        <div className="dashboard-grid top-grid">
          <WeightMapPanel weights={weights} leadHours={leadHours} />
          <RegionMap 
            selectedRegion={region} 
            onSelectRegion={setRegion}
            alerts={alerts}
          />
        </div>
        
        <SkillChart backtest={backtest} />
        
        <div className="dashboard-grid bottom-grid">
          <AlertsFeed alerts={alerts} />
          <PipelineStatus pipeline={pipeline} setPipeline={setPipeline} />
        </div>
      </main>
    </div>
  );
}

export default App;
