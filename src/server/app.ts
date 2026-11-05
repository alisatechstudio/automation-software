import express, { Express, Request, Response } from 'express';
import path from 'path';
import { apiRouter } from './routes/api.js';
import { dashboardRouter } from './routes/dashboard.js';
import { authMiddleware } from './middleware/auth.js';
import { requestLogger } from './middleware/logging.js';
import { PersistentJobQueue } from '../services/queue/queue.js';
import { getDatabase } from '../db/index.js';
import { config } from '../config/env.js';

export function createServer(): Express {
  const app = express();
  const queue = new PersistentJobQueue();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logger
  app.use(requestLogger);

  // Serve static assets (fonts, images, rendered)
  app.use('/assets', express.static(config.ASSETS_DIR));
  app.use('/rendered', express.static(path.join(config.DATA_DIR, 'rendered')));

  // Unauthenticated Health Check Endpoint
  app.get(['/health', '/healthz'], (req: Request, res: Response) => {
    try {
      const db = getDatabase();
      db.prepare('SELECT 1').get();

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        dryRun: config.DRY_RUN,
        queue: queue.getStats(),
        memoryUsage: process.memoryUsage(),
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'unhealthy',
        error: err.message,
      });
    }
  });

  // Password-protected routes
  app.use(authMiddleware);

  // Mount API & Web Dashboard
  app.use('/api', apiRouter);
  app.use('/', dashboardRouter);

  return app;
}

