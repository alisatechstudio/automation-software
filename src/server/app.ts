import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import type { DbRepository } from '../db/repository.js';
import type { ApprovalManager } from '../approval/manager.js';
import type { SportsClipPipeline } from '../scheduler/pipeline.js';
import type { LoadedConfig } from '../config/index.js';
import { logger } from '../logger.js';

export interface ServerDependencies {
  repo: DbRepository;
  approvalManager: ApprovalManager;
  pipeline: SportsClipPipeline;
  config: LoadedConfig;
}

export function createServer(deps: ServerDependencies) {
  const app = express();
  const { repo, approvalManager, pipeline, config } = deps;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Set up EJS views with multi-environment fallback (local src, built dist, Vercel serverless)
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  let viewsDir = path.resolve(currentDir, 'views');
  if (!fs.existsSync(viewsDir)) {
    const cwdDist = path.resolve(process.cwd(), 'dist/server/views');
    const cwdSrc = path.resolve(process.cwd(), 'src/server/views');
    if (fs.existsSync(cwdDist)) {
      viewsDir = cwdDist;
    } else if (fs.existsSync(cwdSrc)) {
      viewsDir = cwdSrc;
    }
  }
  app.set('views', viewsDir);
  app.set('view engine', 'ejs');

  // Serve static output files (videos, thumbnails)
  app.use('/output', express.static(path.resolve(process.cwd(), config.config.app.outputDir)));

  // Root redirect
  app.get('/', (req: Request, res: Response) => {
    res.redirect('/dashboard');
  });

  // Main Compliance & Approval Dashboard
  app.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const pendingApprovals = await repo.getPendingApprovals();
      const publishedPosts = await repo.getPublishedPosts(25);
      const rejectedClips = await repo.getClipsByStatus('COMPLIANCE_FAILED', 25);
      const auditLogs = await repo.getRecentAuditLogs(50);
      const monitoringEvents = await repo.getMonitoringEvents(20);
      const { isPaused, reason: pauseReason } = await repo.isPipelinePaused();

      const youtubePublishedToday = await repo.getCountPublishedToday('YOUTUBE');
      const facebookPublishedToday = await repo.getCountPublishedToday('FACEBOOK');
      const dailyCap = config.config.compliance.dailyCapPerPlatform;

      res.render('dashboard', {
        pendingApprovals,
        publishedPosts,
        rejectedClips,
        auditLogs,
        monitoringEvents,
        isPaused,
        pauseReason,
        youtubePublishedToday,
        facebookPublishedToday,
        dailyCap,
      });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed rendering dashboard');
      res.status(500).send(`Dashboard error: ${err.message}`);
    }
  });

  // Approve Video Endpoint
  app.post('/api/approvals/:id/approve', async (req: Request, res: Response) => {
    const videoId = req.params.id;
    const reviewer = req.body.reviewer || 'Dashboard Admin';
    const notes = req.body.notes || 'Approved via Web Dashboard';

    logger.info({ videoId, reviewer }, 'Dashboard approval requested');
    const result = await approvalManager.approve(videoId, reviewer, notes);

    if (req.headers.accept?.includes('application/json')) {
      return res.json(result);
    }
    res.redirect('/dashboard');
  });

  // Reject Video Endpoint
  app.post('/api/approvals/:id/reject', async (req: Request, res: Response) => {
    const videoId = req.params.id;
    const reviewer = req.body.reviewer || 'Dashboard Admin';
    const reason = req.body.reason || 'Rejected by Dashboard Reviewer';

    logger.info({ videoId, reviewer, reason }, 'Dashboard rejection requested');
    const result = await approvalManager.reject(videoId, reviewer, reason);

    if (req.headers.accept?.includes('application/json')) {
      return res.json(result);
    }
    res.redirect('/dashboard');
  });

  // Trigger Ingestion Pipeline
  app.post('/api/pipeline/trigger', async (req: Request, res: Response) => {
    logger.info('Manual pipeline execution triggered via Dashboard API');
    pipeline.runCycle().catch((err) => {
      logger.error({ err: err.message }, 'Error in manual pipeline run');
    });

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Pipeline cycle launched in background.' });
    }
    res.redirect('/dashboard');
  });

  // Pause Pipeline
  app.post('/api/pipeline/pause', async (req: Request, res: Response) => {
    await repo.setPipelinePaused(true, 'Manually paused from Web Dashboard', 'DASHBOARD_ADMIN');
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, isPaused: true });
    }
    res.redirect('/dashboard');
  });

  // Resume Pipeline
  app.post('/api/pipeline/resume', async (req: Request, res: Response) => {
    await repo.setPipelinePaused(false, '', 'DASHBOARD_ADMIN');
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, isPaused: false });
    }
    res.redirect('/dashboard');
  });

  // Health check API
  app.get('/api/status', async (req: Request, res: Response) => {
    const { isPaused, reason } = await repo.isPipelinePaused();
    res.json({
      status: 'OK',
      app: config.config.app.name,
      isPaused,
      pauseReason: reason,
      isDryRun: config.isDryRun,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
