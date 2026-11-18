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

  // Strip Vercel rewrite prefix & restore original requested route if rewritten
  app.use((req: Request, res: Response, next) => {
    const forwardedUri = (req.headers['x-forwarded-uri'] || req.headers['x-matched-path']) as string;
    if (forwardedUri && forwardedUri !== '/api/index' && forwardedUri !== '/api') {
      req.url = forwardedUri;
    } else if (req.originalUrl && !req.originalUrl.startsWith('/api/index')) {
      req.url = req.originalUrl;
    } else if (req.url.startsWith('/api/index')) {
      req.url = req.url.replace(/^\/api\/index/, '') || '/';
    }
    next();
  });

  // Set up EJS views with multi-environment fallback (local src, built dist, Vercel serverless)
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  let viewsDir = path.resolve(currentDir, 'views');
  if (!fs.existsSync(viewsDir)) {
    const cwdSrc = path.resolve(process.cwd(), 'src/server/views');
    const cwdDist = path.resolve(process.cwd(), 'dist/server/views');
    if (fs.existsSync(cwdSrc)) {
      viewsDir = cwdSrc;
    } else if (fs.existsSync(cwdDist)) {
      viewsDir = cwdDist;
    }
  }
  app.set('views', viewsDir);
  app.set('view engine', 'ejs');

  // Serve static output files (videos, thumbnails)
  app.use('/output', express.static(path.resolve(process.cwd(), config.config.app.outputDir)));

  // Serve static assets for News Automation Dashboard
  app.use('/assets', express.static(path.resolve(process.cwd(), 'assets')));
  app.use('/assets', express.static(path.resolve(process.cwd(), 'public/assets')));

  // Root redirect & Vercel rewrite alias
  app.get(['/', '/api/index', '/api'], (req: Request, res: Response) => {
    res.redirect('/dashboard');
  });

  // Serve the previous News Automation Dashboard (BD News 24/7)
  app.get(['/news-dashboard', '/legacy-dashboard', '/news'], (req: Request, res: Response) => {
    const candidatePaths = [
      path.resolve(process.cwd(), 'assets/dashboard.html'),
      path.resolve(process.cwd(), 'legacy_fb_news/templates/dashboard.html'),
      path.resolve(currentDir, '../../assets/dashboard.html'),
      path.resolve(currentDir, '../../../assets/dashboard.html'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.sendFile(p);
      }
    }
    res.status(404).send('Previous news dashboard template not found in assets/dashboard.html');
  });

  // Terms and Privacy for Legal Compliance
  app.get(['/terms', '/terms-of-service'], (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <title>Terms of Service - Automation Software</title>
  <link rel="stylesheet" href="/assets/css/tailwind.min.css">
</head>
<body class="bg-slate-950 text-slate-100 p-8 font-sans max-w-2xl mx-auto">
  <h1 class="text-2xl font-bold mb-4">Terms of Service</h1>
  <p class="text-sm text-slate-400 mb-6">Automation Software Content Syndication & Publishing Platform.</p>
  <div class="space-x-3">
    <a href="/dashboard" class="px-3 py-1.5 bg-blue-600 rounded text-xs">← SportsClipBot Dashboard</a>
    <a href="/news-dashboard" class="px-3 py-1.5 bg-slate-800 rounded text-xs">← News Automation Dashboard</a>
  </div>
</body>
</html>`);
  });

  app.get(['/privacy', '/privacy-policy'], (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <title>Privacy Policy - Automation Software</title>
  <link rel="stylesheet" href="/assets/css/tailwind.min.css">
</head>
<body class="bg-slate-950 text-slate-100 p-8 font-sans max-w-2xl mx-auto">
  <h1 class="text-2xl font-bold mb-4">Privacy Policy</h1>
  <p class="text-sm text-slate-400 mb-6">We respect user privacy and adhere to Meta Platform and Google API policies.</p>
  <div class="space-x-3">
    <a href="/dashboard" class="px-3 py-1.5 bg-blue-600 rounded text-xs">← SportsClipBot Dashboard</a>
    <a href="/news-dashboard" class="px-3 py-1.5 bg-slate-800 rounded text-xs">← News Automation Dashboard</a>
  </div>
</body>
</html>`);
  });

  // API endpoints expected by the News Automation Dashboard
  app.get('/api/stats', async (req: Request, res: Response) => {
    const { isPaused } = await repo.isPipelinePaused();
    res.json({
      success: true,
      queue: { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 },
      articles: 0,
      pages: 0,
      sources: 0,
      youtubeChannels: 0,
      reelLogs: 0,
      postLogs: 0,
      sportsPipeline: {
        active: !isPaused,
        dailyCap: config.config.compliance.dailyCapPerPlatform,
      }
    });
  });

  app.get('/api/settings', async (req: Request, res: Response) => {
    res.json({
      success: true,
      settings: {
        auto_posting_enabled: 'false',
        dry_run: config.isDryRun ? 'true' : 'false',
      }
    });
  });

  app.get('/api/articles', async (req: Request, res: Response) => {
    res.json({
      success: true,
      articles: [],
      total: 0,
    });
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
