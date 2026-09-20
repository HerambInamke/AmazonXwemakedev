import { Router } from 'express';
import { store } from '../data/store';
import { RegionCode } from '../types';

const router = Router();

router.get('/skill-history/:region', (req, res) => {
    const region = req.params.region as RegionCode;
    res.json(store.getSkillHistory(region));
});

router.get('/backtest', (req, res) => {
    res.json(store.getBacktestResults());
});

router.get('/models', (req, res) => {
    res.json([
        { source: 'NWP_GFS', type: 'physical' },
        { source: 'NWP_ECMWF', type: 'physical' },
        { source: 'AI_GRAPHCAST', type: 'ai' }
    ]);
});

router.post('/pipeline/run', (req, res) => {
    const result = store.runPipeline();
    res.json(result);
});

router.get('/pipeline/status/:id', (req, res) => {
    res.json({
        status: 'completed',
        stages: ['skill_score', 'weight_calc', 'blend', 'extreme_detect']
    });
});

export default router;
