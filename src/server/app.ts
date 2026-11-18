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

  // Serve the previous News Automation Dashboard (BD News 24/7) with in-memory caching
  let cachedNewsHtml: string | null = null;
  app.get(['/news-dashboard', '/legacy-dashboard', '/news'], (req: Request, res: Response) => {
    if (cachedNewsHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(cachedNewsHtml);
    }

    const candidatePaths = [
      path.resolve(process.cwd(), 'assets/dashboard.html'),
      path.resolve(process.cwd(), 'legacy_fb_news/templates/dashboard.html'),
      path.resolve(currentDir, '../../assets/dashboard.html'),
      path.resolve(currentDir, '../../../assets/dashboard.html'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        cachedNewsHtml = fs.readFileSync(p, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(cachedNewsHtml);
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

  // ==========================================
  // API endpoints for the News Automation Dashboard (Backed by MongoDB Atlas)
  // ==========================================
  app.get('/api/stats', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      const { isPaused } = await repo.isPipelinePaused().catch(() => ({ isPaused: false }));

      if (!db) {
        return res.json({
          queue: { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 },
          articlesCount: 0,
          reelsInDrive: 0,
          pagesCount: 0,
          sourcesCount: 0,
          groupsCount: 0,
          groupSharesCount: 0,
          reelsCount: 0,
          storiesCount: 0,
          youtubeCount: 0,
          youtubeChannelsCount: 0,
          gdriveChannelsCount: 0,
          tiktokCount: 0,
          successfulPosts: 0,
          dryRun: config.isDryRun,
          sportsPipeline: { active: !isPaused, dailyCap: config.config.compliance.dailyCapPerPlatform },
        });
      }

      const [
        articlesCount,
        reelsInDriveArticles,
        pagesCount,
        sourcesCount,
        youtubeChannels,
        gdriveChannels,
        reelLogsCount,
        postLogsCount,
        ytLogsCount,
        tiktokCount,
        storiesCount,
        groupsCount,
        groupSharesCount,
        publishedArticlesCount,
      ] = await Promise.all([
        db.collection('news_articles').countDocuments().catch(() => 0),
        db.collection('news_articles').countDocuments({ status: 'uploaded_to_drive' }).catch(() => 0),
        db.collection('facebook_pages').countDocuments().catch(() => 0),
        db.collection('rss_sources').countDocuments().catch(() => 0),
        db.collection('youtube_channels').find({}).toArray().catch(() => []),
        db.collection('gdrive_reel_configs').find({}).toArray().catch(() => []),
        db.collection('reel_logs').countDocuments({ status: { $in: ['published', 'success', 'dry_run'] } }).catch(() => 0),
        db.collection('post_logs').countDocuments({ status: { $in: ['published', 'success', 'dry_run'] } }).catch(() => 0),
        db.collection('youtube_upload_logs').countDocuments({ status: { $in: ['published', 'success', 'dry_run'] } }).catch(() => 0),
        db.collection('tiktok_upload_logs').countDocuments({ status: { $in: ['published', 'success', 'dry_run'] } }).catch(() => 0),
        db.collection('story_logs').countDocuments({ status: { $in: ['published', 'success', 'dry_run'] } }).catch(() => 0),
        db.collection('facebook_groups').countDocuments({ isActive: { $ne: false } }).catch(() => 0),
        db.collection('group_share_logs').countDocuments({ status: { $in: ['success', 'dry_run'] } }).catch(() => 0),
        db.collection('news_articles').countDocuments({ status: 'published' }).catch(() => 0),
      ]);

      const youtubeChannelsCount = (youtubeChannels as any[]).length;
      const gdriveChannelsCount = (gdriveChannels as any[]).length;

      const gdrivePostedTotal = (gdriveChannels as any[]).reduce(
        (sum: number, ch: any) => sum + (ch.postedVideoIds?.length || 0),
        0
      );
      const reelsCount = Math.max(reelLogsCount, gdrivePostedTotal);

      const ytVideosTotal = (youtubeChannels as any[]).reduce(
        (sum: number, ch: any) => sum + (parseInt(ch.videoCount || '0', 10) || 0),
        0
      );
      const youtubeCount = Math.max(ytLogsCount, ytVideosTotal);
      const successfulPosts = Math.max(postLogsCount, publishedArticlesCount);
      const reelsInDrive = reelsInDriveArticles;

      res.json({
        queue: { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 },
        articlesCount,
        reelsInDrive,
        pagesCount,
        sourcesCount,
        groupsCount,
        groupSharesCount,
        reelsCount,
        storiesCount,
        youtubeCount,
        youtubeChannelsCount,
        gdriveChannelsCount,
        tiktokCount,
        successfulPosts,
        dryRun: config.isDryRun,
        sportsPipeline: {
          active: !isPaused,
          dailyCap: config.config.compliance.dailyCapPerPlatform,
        },
      });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed computing /api/stats');
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sources', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json([]);
      const [rawSources, pages] = await Promise.all([
        db.collection('rss_sources').find({}).toArray().catch(() => []),
        db.collection('facebook_pages').find({}).toArray().catch(() => []),
      ]);
      const pageMap = new Map((pages as any[]).map((p: any) => [p._id?.toString(), p.name]));

      const sources = (rawSources as any[]).map((s: any) => {
        const pageId = s.pageId || s.page_id || '';
        return {
          id: s._id?.toString(),
          name: s.name || 'Untitled Source',
          url: s.url || '',
          is_active: s.isActive !== undefined ? Boolean(s.isActive) : (s.is_active !== undefined ? Boolean(s.is_active) : true),
          page_id: pageId,
          page_name: pageMap.get(pageId) || pageId || 'Default Page',
          gdrive_folder_url: s.gdriveFolderUrlOrId || s.gdrive_folder_url || '',
          gdrive_folder_id: s.gdriveFolderId || s.gdrive_folder_id || '',
          reel_theme: s.reelTheme || s.reel_theme || 'canva-studio-rotate',
          template_id: s.templateId || s.template_id || 'template-trendingnews-breaking',
          reel_duration: parseInt(String(s.reelDuration || s.reel_duration || 30), 10) || 30,
          created_at: s.createdAt || s.created_at || new Date(),
        };
      });
      res.json(sources);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/pages', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json([]);
      const pages = await db
        .collection('facebook_pages')
        .find({})
        .project({
          id: '$_id',
          name: 1,
          is_active: '$isActive',
          token_expires_at: '$tokenExpiresAt',
          created_at: '$createdAt',
        })
        .sort({ createdAt: -1 })
        .toArray()
        .catch(() => []);
      res.json(pages.map((p: any) => ({
        id: p.id?.toString(),
        name: p.name,
        is_active: p.is_active !== false,
        token_expires_at: p.token_expires_at,
        created_at: p.created_at,
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/groups', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json([]);
      const groups = await db.collection('facebook_groups').find({}).toArray().catch(() => []);
      res.json(groups.map((g: any) => ({
        ...g,
        id: g._id?.toString(),
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/groups/shares', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json([]);
      const shares = await db.collection('group_share_logs').find({}).sort({ createdAt: -1 }).limit(50).toArray().catch(() => []);
      res.json(shares);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/queue', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json([]);
      const articles = await db.collection('news_articles')
        .find({})
        .sort({ pubDate: -1, createdAt: -1 })
        .limit(50)
        .toArray()
        .catch(() => []);
      res.json(articles.map((a: any) => ({
        id: a._id?.toString(),
        title: a.title,
        article_title: a.title,
        link: a.link,
        article_link: a.link,
        category: a.category || 'খবর',
        imageUrl: a.imageUrl,
        status: a.status,
        created_at: a.createdAt || a.pubDate || new Date(),
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/logs', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json([]);
      const logs = await db.collection('reel_logs').find({}).sort({ createdAt: -1 }).limit(50).toArray().catch(() => []);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/articles', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json({ success: true, articles: [], total: 0 });
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const articles = await db.collection('news_articles').find({}).sort({ pubDate: -1, createdAt: -1 }).limit(limit).toArray().catch(() => []);
      res.json({ success: true, articles, total: articles.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/reels/logs', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json([]);
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const logs = await db.collection('reel_logs').find({}).sort({ createdAt: -1 }).limit(limit).toArray().catch(() => []);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/reels/settings', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json({ autoPostReels: false });
      const doc = await db.collection('settings').findOne({ key: 'reels_settings' }).catch(() => null);
      res.json(doc?.value || { autoPostReels: false });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/gdrive-reels/channels', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json({ success: true, channels: [] });
      const channels = await db.collection('gdrive_reel_configs').find({}).toArray().catch(() => []);
      res.json({ success: true, channels });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/gdrive-reels/auth/status', (req: Request, res: Response) => {
    res.json({ success: true, isAuthenticated: true });
  });

  app.get('/api/youtube/channels', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json({ success: true, channels: [] });
      const channels = await db.collection('youtube_channels').find({}).sort({ createdAt: -1 }).toArray().catch(() => []);
      res.json({ success: true, channels });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/youtube/status', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      const count = db ? await db.collection('youtube_channels').countDocuments().catch(() => 0) : 0;
      res.json({ success: true, configured: count > 0, channelsCount: count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/youtube/logs', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.json({ success: true, logs: [] });
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const logs = await db.collection('youtube_upload_logs').find({}).sort({ createdAt: -1 }).limit(limit).toArray().catch(() => []);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tiktok/status', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      const count = db ? await db.collection('tiktok_upload_logs').countDocuments().catch(() => 0) : 0;
      res.json({ success: true, configured: count > 0, count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/settings', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      const settingsDocs = db ? await db.collection('settings').find({}).toArray().catch(() => []) : [];
      const settingsObj: Record<string, any> = {
        auto_posting_enabled: 'false',
        dry_run: config.isDryRun ? 'true' : 'false',
      };
      for (const doc of settingsDocs) {
        if (doc.key) settingsObj[doc.key] = doc.value;
      }
      res.json({ success: true, settings: settingsObj });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cron', (req: Request, res: Response) => {
    res.json({ cronSecretConfigured: Boolean(process.env.CRON_SECRET) });
  });

  app.get('/api/cron/catalog', (req: Request, res: Response) => {
    res.json({
      routes: [
        { path: '/api/cron/input', description: 'Fetch RSS articles and generate videos/reels' },
        { path: '/api/cron/output', description: 'Publish staged videos to Facebook and YouTube' },
      ]
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
