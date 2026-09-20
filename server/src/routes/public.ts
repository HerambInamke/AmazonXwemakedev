import { Router } from 'express';
import { store } from '../data/store';
import { RegionCode, Variable } from '../types';

const router = Router();

router.get('/forecast/:region', (req, res) => {
    const region = req.params.region as RegionCode;
    const data = store.getLatestBlended(region);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
});

router.get('/forecast/:region/:variable', (req, res) => {
    const region = req.params.region as RegionCode;
    const variable = req.params.variable as Variable;
    const data = store.getLatestBlended(region);
    if (!data) return res.status(404).json({ error: 'Not found' });
    
    const filtered = {
        ...data,
        forecast: {
            [variable]: data.forecast[variable] || {}
        }
    };
    res.json(filtered);
});

router.get('/weights/:region', (req, res) => {
    const region = req.params.region as RegionCode;
    res.json(store.getWeights(region));
});

router.get('/alerts', (req, res) => {
    res.json(store.getAlerts());
});

router.get('/alerts/:region', (req, res) => {
    const region = req.params.region as RegionCode;
    res.json(store.getAlerts(region));
});

export default router;
