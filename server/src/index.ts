import express from 'express';
import cors from 'cors';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';
import { store } from './data/store';

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/admin', adminRoutes);

const PORT = 3001;

async function start() {
    console.log('Loading data and running pipeline...');
    store.load();
    store.runPipeline();
    console.log('Pipeline complete.');
    
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

start();
