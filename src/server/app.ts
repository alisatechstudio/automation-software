import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import type { DbRepository } from '../db/repository.js';
import type { ApprovalManager } from '../approval/manager.js';
import type { SportsClipPipeline } from '../scheduler/pipeline.js';
import type { LoadedConfig } from '../config/index.js';
import { logger } from '../logger.js';
import { scanGoogleDriveFolder, extractFolderId } from '../services/gdrive-scanner.js';
import { GoogleDriveUploader } from '../services/gdrive-uploader.js';
import { GDriveReelService } from '../services/gdrive/service.js';
import { InputPipelineService } from '../services/pipeline/input-pipeline.js';

export interface ServerDependencies {
  repo: DbRepository;
  approvalManager: ApprovalManager;
  pipeline: SportsClipPipeline;
  config: LoadedConfig;
}

export function createServer(deps: ServerDependencies) {
  const app = express();
  const { repo, approvalManager, pipeline, config } = deps;
  const gdriveUploader = new GoogleDriveUploader(repo);
  const gdriveReelService = new GDriveReelService();
  const inputPipelineService = new InputPipelineService();

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

  // ==========================================
  // UNIFIED AUTOMATION DASHBOARD (ONE DASHBOARD)
  // SportsClipBot + News Automation + Studio
  // ==========================================
  let cachedDashboardHtml: string | null = null;
  const sendUnifiedDashboard = (req: Request, res: Response) => {
    if (cachedDashboardHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(cachedDashboardHtml);
    }

    const candidatePaths = [
      path.resolve(process.cwd(), 'assets/dashboard.html'),
      path.resolve(process.cwd(), 'legacy_fb_news/templates/dashboard.html'),
      path.resolve(currentDir, '../../assets/dashboard.html'),
      path.resolve(currentDir, '../../../assets/dashboard.html'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        cachedDashboardHtml = fs.readFileSync(p, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(cachedDashboardHtml);
      }
    }
    res.status(404).send('Unified dashboard template not found in assets/dashboard.html');
  };

  // All primary entrypoints lead to the ONE unified dashboard
  app.get(['/', '/dashboard', '/news-dashboard', '/legacy-dashboard', '/news', '/api/index', '/api'], sendUnifiedDashboard);

  // Raw EJS compliance fallback view (if needed)
  app.get(['/sports-approval-raw', '/legacy-ejs-dashboard'], async (req: Request, res: Response) => {
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
      logger.error({ err: err.message }, 'Failed rendering EJS dashboard');
      res.status(500).send(`Dashboard error: ${err.message}`);
    }
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

  // Helper to fetch Google Drive global API Key from settings or env
  const getGlobalGDriveApiKey = async (): Promise<string> => {
    try {
      const db = repo.getDb();
      if (db) {
        const doc = await db.collection('settings').findOne({
          key: { $in: ['GDRIVE_API_KEY', 'GOOGLE_DRIVE_API_KEY'] }
        }).catch(() => null);
        if (doc?.value) return String(doc.value).trim();
      }
      return (process.env.GDRIVE_API_KEY || process.env.GOOGLE_DRIVE_API_KEY || '').trim();
    } catch {
      return '';
    }
  };

  // 1. List All Google Drive Multi-Channel Configurations
  app.get('/api/gdrive-reels/channels', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      const globalApiKey = await getGlobalGDriveApiKey();
      if (!db) return res.json({ success: true, channels: [], globalApiKey });
      const channels = await db.collection('gdrive_reel_configs').find({}).toArray().catch(() => []);
      res.json({ success: true, channels, globalApiKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Save Global Google Drive API Key
  app.post('/api/gdrive-reels/global-api-key', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      const apiKey = (req.body?.apiKey || '').trim();
      if (db) {
        await db.collection('settings').updateOne(
          { key: 'GDRIVE_API_KEY' },
          { $set: { key: 'GDRIVE_API_KEY', value: apiKey, updatedAt: new Date() } },
          { upsert: true }
        );
        await db.collection('settings').updateOne(
          { key: 'GOOGLE_DRIVE_API_KEY' },
          { $set: { key: 'GOOGLE_DRIVE_API_KEY', value: apiKey, updatedAt: new Date() } },
          { upsert: true }
        );
      }
      process.env.GDRIVE_API_KEY = apiKey;
      logger.info({ hasKey: Boolean(apiKey) }, 'Global Google Drive API key updated successfully');
      res.json({ success: true, apiKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Google Drive Auth & Write Status
  app.get('/api/gdrive-reels/auth/status', async (req: Request, res: Response) => {
    try {
      const globalApiKey = await getGlobalGDriveApiKey();
      const token = await gdriveUploader.getGoogleAccessToken();
      const hasOAuth = Boolean(token);
      const hasApiKey = Boolean(globalApiKey);
      res.json({
        success: true,
        hasApiKey,
        hasOAuth,
        canDeleteFiles: hasOAuth,
        isAuthenticated: hasApiKey || hasOAuth,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Get Single Channel Details & Live Scan
  app.get('/api/gdrive-reels/channels/:id', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.status(404).json({ error: 'Database not initialized' });

      const channel = await db.collection('gdrive_reel_configs').findOne({ _id: req.params.id as any }).catch(() => null);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      const globalApiKey = await getGlobalGDriveApiKey();
      const token = await gdriveUploader.getGoogleAccessToken();
      const scan = await scanGoogleDriveFolder({
        folderUrlOrId: channel.folderUrlOrId || channel.folderId || '',
        apiKey: channel.apiKey || globalApiKey,
        accessToken: token,
        postedVideoIds: channel.postedVideoIds || [],
      });
      scan.channelId = String(channel._id);
      scan.channelName = channel.name;

      res.json({ success: true, channel, scan });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Create or Update a Channel
  app.post('/api/gdrive-reels/channels', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.status(500).json({ error: 'Database not initialized' });

      const channel = req.body || {};
      const channelId = channel._id || `gdrive_ch_${Date.now().toString(36)}`;
      channel._id = channelId;
      if (channel.folderUrlOrId) {
        channel.folderId = extractFolderId(channel.folderUrlOrId);
      }
      channel.updatedAt = new Date();

      await db.collection('gdrive_reel_configs').updateOne(
        { _id: channelId as any },
        { $set: channel },
        { upsert: true }
      );

      const globalApiKey = await getGlobalGDriveApiKey();
      const token = await gdriveUploader.getGoogleAccessToken();
      const scan = await scanGoogleDriveFolder({
        folderUrlOrId: channel.folderUrlOrId || channel.folderId || '',
        apiKey: channel.apiKey || globalApiKey,
        accessToken: token,
        postedVideoIds: channel.postedVideoIds || [],
      });

      res.json({ success: true, channel, scan });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Delete Channel
  app.delete('/api/gdrive-reels/channels/:id', async (req: Request, res: Response) => {
    try {
      const db = repo.getDb();
      if (!db) return res.status(500).json({ error: 'Database not initialized' });
      await db.collection('gdrive_reel_configs').deleteOne({ _id: req.params.id as any });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Direct Folder Scan Endpoint
  app.post('/api/gdrive-reels/scan', async (req: Request, res: Response) => {
    try {
      const { folderUrlOrId, apiKey: customApiKey } = req.body || {};
      const globalApiKey = await getGlobalGDriveApiKey();
      const token = await gdriveUploader.getGoogleAccessToken();
      const scan = await scanGoogleDriveFolder({
        folderUrlOrId: folderUrlOrId || '',
        apiKey: customApiKey || globalApiKey,
        accessToken: token,
      });
      res.json({ success: true, scan });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Publish Next Reel for Channel
  app.post('/api/gdrive-reels/channels/:id/publish-next', async (req: Request, res: Response) => {
    try {
      logger.info({ channelId: req.params.id }, 'Manual trigger: Publish next reel for channel');
      const result = await gdriveReelService.publishNextForChannel(req.params.id);
      res.json(result);
    } catch (err: any) {
      logger.error({ channelId: req.params.id, err: err.message }, 'Failed publishing next reel');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 9. Publish Specific File for Channel
  app.post('/api/gdrive-reels/channels/:id/publish-file', async (req: Request, res: Response) => {
    try {
      const { fileId } = req.body || {};
      if (!fileId) return res.status(400).json({ success: false, error: 'Missing fileId in body' });
      logger.info({ channelId: req.params.id, fileId }, 'Manual trigger: Publish specific file');
      const result = await gdriveReelService.publishSpecificFileForChannel(req.params.id, fileId);
      res.json(result);
    } catch (err: any) {
      logger.error({ channelId: req.params.id, err: err.message }, 'Failed publishing specific file');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 10. Publish All Due Channels Immediately
  app.post('/api/gdrive-reels/publish-all-due', async (req: Request, res: Response) => {
    try {
      logger.info('Manual trigger: Publish all due channels');
      const result = await gdriveReelService.publishAllDueChannels({ force: true });
      res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed publishing all due channels');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 11. Delete Specific Drive File
  app.delete('/api/gdrive-reels/files/:fileId', async (req: Request, res: Response) => {
    try {
      const result = await gdriveReelService.deleteDriveFile(req.params.fileId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 12. OAuth Auth URL
  app.get('/api/gdrive-reels/auth/url', (req: Request, res: Response) => {
    res.json({ success: true, url: '/api/youtube/auth/url?origin=gdrive' });
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

  // ==========================================
  // SPORTS SUMMARY API (For the Unified Dashboard)
  // ==========================================
  app.get('/api/sports/summary', async (req: Request, res: Response) => {
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

      res.json({
        success: true,
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
        dryRun: config.isDryRun,
      });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed fetching sports summary');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // CRON WEBHOOKS FOR cron-job.org
  // ==========================================
  const verifyCronSecret = (req: Request, res: Response): boolean => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || cronSecret.trim() === '') {
      return true; // Open trigger if not configured
    }
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1] === cronSecret) {
        return true;
      }
    }
    const customHeader = req.headers['x-cron-secret'];
    if (customHeader && customHeader === cronSecret) return true;

    const querySecret = (req.query.secret as string) || (req.query.key as string);
    if (querySecret && querySecret === cronSecret) return true;

    res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid cron secret. Pass "Authorization: Bearer <token>" header or "?secret=<token>".',
    });
    return false;
  };

  // 1. SportsClipBot: Ingestion, Transformation & Compliance Cycle
  app.all(['/api/cron/sports-pipeline', '/api/cron/sports', '/api/cron/sports-cycle'], async (req: Request, res: Response) => {
    if (!verifyCronSecret(req, res)) return;
    try {
      const { isPaused, reason } = await repo.isPipelinePaused();
      if (isPaused) {
        return res.json({
          success: false,
          job: 'sports_pipeline_cycle',
          status: 'skipped',
          message: `Pipeline is paused: ${reason}`,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('External cron trigger: SportsClipBot Pipeline Cycle');
      const cyclePromise = pipeline.runCycle();
      if (process.env.VERCEL) {
        await cyclePromise.catch(err => logger.error({ err: err.message }, 'Sports pipeline error in cron'));
      }
      res.json({
        success: true,
        job: 'sports_pipeline_cycle',
        status: 'completed',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed running sports pipeline cron');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. SportsClipBot: Copyright & Policy Monitoring Poller
  app.all(['/api/cron/sports-monitoring', '/api/cron/monitoring'], async (req: Request, res: Response) => {
    if (!verifyCronSecret(req, res)) return;
    try {
      const posts = await repo.getPublishedPosts(20);
      logger.info({ count: posts.length }, 'External cron trigger: SportsClipBot Monitoring Poller');
      res.json({
        success: true,
        job: 'sports_monitoring',
        polledPosts: posts.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. News Automation: Stage 1 Input (RSS Ingest -> Drive Staging)
  app.all(['/api/cron/input', '/api/cron/input/:sourceId'], async (req: Request, res: Response) => {
    if (!verifyCronSecret(req, res)) return;
    try {
      const targetSourceId = (req.params.sourceId as string) || (req.query.sourceId as string) || (req.query.source as string) || (req.query.feed as string);
      const targetFolderId = (req.query.folderId as string) || (req.query.folder as string);
      const targetPageId = (req.query.pageId as string) || (req.query.page as string);
      const allParam = req.query.all === 'true' || req.query.allSources === 'true';
      const force = req.query.force === 'true';
      const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const maxArticles = parseInt((req.query.max as string) || (req.query.limit as string) || '1', 10) || 1;

      logger.info({ targetSourceId, targetFolderId, maxArticles }, 'External cron trigger: News Stage 1 Input');
      const inputResult = await inputPipelineService.runInputCron({
        sourceId: targetSourceId,
        folderId: targetFolderId,
        pageId: targetPageId,
        allSources: allParam,
        force,
        maxArticlesPerSource: maxArticles,
        limit: limitParam,
      });

      res.json({
        ...inputResult,
        job: 'input_cron',
        stage: '1_input_ingest_render_drive',
      });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed running news input cron');
      res.status(500).json({ success: false, job: 'input_cron', error: err.message });
    }
  });

  // 4. News Automation: Stage 2 Output (Drive Staged -> Social Networks)
  app.all(['/api/cron/output', '/api/cron/output/:channelId'], async (req: Request, res: Response) => {
    if (!verifyCronSecret(req, res)) return;
    try {
      const channelId = (req.params.channelId as string) || (req.query.channelId as string) || (req.query.channel as string);
      const folderId = (req.query.folderId as string) || (req.query.folder as string);
      const pageId = (req.query.pageId as string) || (req.query.page as string);
      const force = req.query.force !== 'false';

      logger.info({ channelId, folderId, force }, 'External cron trigger: News Stage 2 Output');
      const outputResult = await gdriveReelService.publishAllDueChannels({
        force,
        channelId,
        folderId,
        pageId,
      });

      res.json({
        success: true,
        job: 'output_cron',
        stage: '2_output_drive_post_social_networks',
        channelId: channelId || 'all',
        folderId: folderId || 'all',
        pageId: pageId || 'all',
        timestamp: new Date().toISOString(),
        result: outputResult,
      });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed running news output cron');
      res.status(500).json({ success: false, job: 'output_cron', error: err.message });
    }
  });

  // 4B. Universal Cron Gateway Endpoint (/api/cron)
  app.all('/api/cron', async (req: Request, res: Response) => {
    if (!verifyCronSecret(req, res)) return;
    const jobParam = ((req.query.job as string) || '').toLowerCase().trim();
    if (jobParam === 'input') {
      try {
        const targetSourceId = (req.query.sourceId as string) || (req.query.source as string);
        const maxArticles = parseInt((req.query.max as string) || '1', 10) || 1;
        const inputResult = await inputPipelineService.runInputCron({
          sourceId: targetSourceId,
          maxArticlesPerSource: maxArticles,
        });
        return res.json({ ...inputResult, job: 'input_cron' });
      } catch (err: any) {
        return res.status(500).json({ success: false, job: 'input_cron', error: err.message });
      }
    }
    if (jobParam === 'output') {
      try {
        const channelId = (req.query.channelId as string) || (req.query.channel as string);
        const outputResult = await gdriveReelService.publishAllDueChannels({
          force: true,
          channelId,
        });
        return res.json({ success: true, job: 'output_cron', result: outputResult });
      } catch (err: any) {
        return res.status(500).json({ success: false, job: 'output_cron', error: err.message });
      }
    }
    if (jobParam === 'sports' || jobParam === 'sports-pipeline') {
      try {
        const sportsResult = await pipeline.runCycle();
        return res.json({ success: true, job: 'sports_pipeline_cycle', result: sportsResult });
      } catch (err: any) {
        return res.status(500).json({ success: false, job: 'sports_pipeline_cycle', error: err.message });
      }
    }
    // Default redirect to dynamic catalog
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.get('host') || 'automation-software-ten.vercel.app';
    const baseUrl = `${protocol}://${host}`;
    return res.redirect(`${baseUrl}/api/cron/catalog`);
  });

  // 5. News Automation: Stories Publishing
  app.all(['/api/cron/stories'], async (req: Request, res: Response) => {
    if (!verifyCronSecret(req, res)) return;
    res.json({
      success: true,
      job: 'stories_cron',
      stage: 'stories_publish',
      timestamp: new Date().toISOString(),
    });
  });

  // 6. News Automation: YouTube Sync & Upload
  app.all(['/api/cron/youtube'], async (req: Request, res: Response) => {
    if (!verifyCronSecret(req, res)) return;
    res.json({
      success: true,
      job: 'youtube_cron',
      stage: 'youtube_sync_upload',
      timestamp: new Date().toISOString(),
    });
  });

  // 7. Dynamic Cron Catalog for cron-job.org
  app.get('/api/cron/catalog', async (req: Request, res: Response) => {
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.get('host') || 'automation-software-ten.vercel.app';
    const baseUrl = `${protocol}://${host}`;
    const cronSecret = process.env.CRON_SECRET;
    const secretParam = cronSecret ? `?secret=${encodeURIComponent(cronSecret)}` : '';

    const db = repo.getDb();
    const rawSources = db ? await db.collection('rss_sources').find({}).toArray().catch(() => []) : [];
    const gdriveChannels = db ? await db.collection('gdrive_reel_configs').find({}).toArray().catch(() => []) : [];

    res.json({
      success: true,
      baseUrl,
      cronSecretConfigured: Boolean(cronSecret),
      authNote: cronSecret
        ? 'Pass "Authorization: Bearer <secret>" header or append "?secret=<secret>"'
        : 'CRON_SECRET not set, endpoints accept public triggers',
      cronJobs: [
        {
          id: 'sports_pipeline',
          title: 'SportsClipBot - Ingestion & Compliance Cycle',
          url: `${baseUrl}/api/cron/sports-pipeline${secretParam}`,
          method: 'GET',
          recommendedSchedule: 'Every 2 hours (0 */2 * * *)',
          purpose: 'Ingests licensed sports clips, Claude commentary script, compliance gate, video editing & queues for approval',
        },
        {
          id: 'sports_monitoring',
          title: 'SportsClipBot - Copyright & Policy Monitoring',
          url: `${baseUrl}/api/cron/sports-monitoring${secretParam}`,
          method: 'GET',
          recommendedSchedule: 'Every 30 minutes (*/30 * * * *)',
          purpose: 'Monitors YouTube & Facebook for copyright claims, Content ID strikes, or policy warnings',
        },
        {
          id: 'news_input_universal',
          title: 'News Automation - Stage 1 (Feed Ingest -> Drive)',
          url: `${baseUrl}/api/cron/input${secretParam}`,
          method: 'GET',
          recommendedSchedule: 'Every 15 minutes (*/15 * * * *)',
          purpose: 'Ingests RSS feeds round-robin, renders 9:16 vertical reels, and saves to Google Drive folder',
        },
        {
          id: 'news_output_universal',
          title: 'News Automation - Stage 2 (Drive -> Social Networks)',
          url: `${baseUrl}/api/cron/output${secretParam}`,
          method: 'GET',
          recommendedSchedule: 'Every 1 hour (0 * * * *)',
          purpose: 'Publishes staged reels from Google Drive to Facebook Pages, YouTube Shorts, and TikTok',
        },
        {
          id: 'news_stories',
          title: 'News Automation - Facebook Stories',
          url: `${baseUrl}/api/cron/stories${secretParam}`,
          method: 'GET',
          recommendedSchedule: 'Every 2 hours (0 */2 * * *)',
          purpose: 'Publishes photo card stories to Facebook Pages',
        },
        {
          id: 'news_youtube',
          title: 'News Automation - YouTube Channel Sync',
          url: `${baseUrl}/api/cron/youtube${secretParam}`,
          method: 'GET',
          recommendedSchedule: 'Every 2 hours (0 */2 * * *)',
          purpose: 'Synchronizes YouTube Shorts stats and upload statuses',
        },
        ...rawSources.map((s: any) => ({
          id: `news_input_source_${s._id}`,
          title: `Split Feed: ${s.name}`,
          url: `${baseUrl}/api/cron/input?sourceId=${encodeURIComponent(s._id)}${cronSecret ? `&secret=${encodeURIComponent(cronSecret)}` : ''}`,
          method: 'GET',
          recommendedSchedule: 'Every 30 minutes',
          purpose: `Dedicated isolated ingest trigger for ${s.name}`,
        })),
        ...gdriveChannels.map((c: any) => ({
          id: `news_output_channel_${c._id}`,
          title: `Split Channel: ${c.name || c._id}`,
          url: `${baseUrl}/api/cron/output?channelId=${encodeURIComponent(c._id)}${cronSecret ? `&secret=${encodeURIComponent(cronSecret)}` : ''}`,
          method: 'GET',
          recommendedSchedule: 'Every 1 to 2 hours',
          purpose: `Dedicated isolated publish trigger for Drive channel ${c.name || c._id}`,
        })),
      ],
    });
  });

  // 8. Universal Gateway
  app.all('/api/cron', async (req: Request, res: Response) => {
    if (!verifyCronSecret(req, res)) return;
    const job = ((req.query.job as string) || '').toLowerCase().trim();
    if (job === 'sports' || job === 'sports-pipeline') {
      req.url = '/api/cron/sports-pipeline';
      return app(req, res);
    }
    if (job === 'monitoring' || job === 'sports-monitoring') {
      req.url = '/api/cron/sports-monitoring';
      return app(req, res);
    }
    if (job === 'input') {
      req.url = '/api/cron/input';
      return app(req, res);
    }
    if (job === 'output') {
      req.url = '/api/cron/output';
      return app(req, res);
    }
    // Return catalog if no job query specified
    req.url = '/api/cron/catalog';
    return app(req, res);
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
  app.get(['/api/status', '/api/health', '/health'], async (req: Request, res: Response) => {
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

  // Fallback 404 handler: APIs MUST ALWAYS return JSON, never HTML
  app.use((req: Request, res: Response) => {
    if (!res.headersSent) {
      if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl || req.url });
      }
      return sendUnifiedDashboard(req, res);
    }
  });

  // Global error handler
  app.use((err: any, req: Request, res: Response, _next: any) => {
    logger.error({ err: err?.message || String(err) }, 'Server error');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
    }
  });

  return app;
}
