import { useState, useEffect } from 'react';
import { RegionCode, LeadHours, LatestBlendedForecast, WeightMapEntry, ExtremeAlert, BacktestResult, PipelineExecution } from '../types';
import { fetchForecast, fetchWeights, fetchAlerts, fetchBacktest, triggerPipeline } from '../api/client';

export function useForecasts(region: RegionCode, leadHours: LeadHours) {
  const [forecast, setForecast] = useState<LatestBlendedForecast | null>(null);
  const [weights, setWeights] = useState<WeightMapEntry[]>([]);
  const [alerts, setAlerts] = useState<ExtremeAlert[]>([]);
  const [backtest, setBacktest] = useState<BacktestResult[]>([]);
  const [pipeline, setPipeline] = useState<PipelineExecution | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetchForecast(region),
      fetchWeights(region),
      fetchAlerts(region),
      fetchBacktest()
    ]).then(([fData, wData, aData, bData]) => {
      if (mounted) {
        setForecast(fData);
        setWeights(wData);
        setAlerts(aData);
        setBacktest(bData);
        setLoading(false);
      }
    }).catch(err => {
      console.error(err);
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, [region]); // deliberately left leadHours out of deps if it doesn't need to refetch all, but backtest and forecast contain all lead times.

  const runPipeline = async () => {
    try {
      const exec = await triggerPipeline();
      setPipeline(exec);
    } catch (e) {
      console.error(e);
    }
  };

  return { forecast, weights, alerts, backtest, pipeline, setPipeline, loading, runPipeline };
}
