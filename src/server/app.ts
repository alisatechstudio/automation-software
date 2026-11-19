import express, { Express, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { InputPipelineService } from '../pipeline/input-pipeline.js';
import { isDbConnected, getDatabase, initDatabase, getLastDbError } from '../db/index.js';
import { config } from '../config/env.js';
import { RssSource } from '../db/schema.js';

export function createInputServer(pipeline: InputPipelineService): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Static assets serving
  const publicDir = path.join(process.cwd(), 'public');
  const assetsDir = path.join(process.cwd(), 'assets');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }
  if (fs.existsSync(assetsDir)) {
    app.use('/assets', express.static(assetsDir));
  }

  // Dashboard HTML entrypoint
  app.get(['/', '/dashboard'], (req: Request, res: Response) => {
    const indexPath = path.join(process.cwd(), 'public', 'index.html');
    if (fs.existsSync(indexPath) && req.accepts('html')) {
      return res.sendFile(indexPath);
    }
    // Fallback JSON if index.html is missing or API client requests json
    res.json({
      status: 'ok',
      service: 'Input Automation (Source -> Reel -> Google Drive Folder)',
      databaseConnected: isDbConnected(),
      cronEnabled: config.CRON_ENABLED,
      cronSchedule: config.CRON_SCHEDULE,
      driveFolderConfigured: Boolean(config.GDRIVE_FOLDER_ID),
      time: new Date().toISOString(),
    });
  });

  // Health check endpoint
  app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Input Automation (Source -> Reel -> Google Drive Folder)',
      databaseConnected: isDbConnected(),
      cronEnabled: config.CRON_ENABLED,
      cronSchedule: config.CRON_SCHEDULE,
      driveFolderConfigured: Boolean(config.GDRIVE_FOLDER_ID),
      time: new Date().toISOString(),
    });
  });

  // Comprehensive Diagnostics & Status
  app.get(['/api/status', '/api/diagnostics'], async (_req: Request, res: Response) => {
    try {
      let articlesCount = 0;
      let driveUploadedCount = 0;
      let renderedCount = 0;
      let pendingCount = 0;
      let failedCount = 0;
      let sourcesCount = 0;
      let activeSourcesCount = 0;

      const dbConnected = isDbConnected();
      const lastErr = getLastDbError();

      if (dbConnected) {
        const db = getDatabase();
        const articlesCol = db.collection('news_articles');
        const sourcesCol = db.collection('rss_sources');

        articlesCount = await articlesCol.countDocuments();
        driveUploadedCount = await articlesCol.countDocuments({ status: 'uploaded_to_drive' });
        renderedCount = await articlesCol.countDocuments({ status: 'rendered' });
        pendingCount = await articlesCol.countDocuments({ status: { $in: ['ingested', 'queued', 'rendering'] } });
        failedCount = await articlesCol.countDocuments({ status: 'failed' });

        sourcesCount = await sourcesCol.countDocuments();
        activeSourcesCount = await sourcesCol.countDocuments({
          $or: [{ isActive: true }, { is_active: true }, { isActive: { $exists: false } }],
        });
      }

      let driveAuthMode = 'none';
      if (config.GOOGLE_CLIENT_ID && config.GOOGLE_REFRESH_TOKEN) {
        driveAuthMode = 'oauth2';
      } else if (config.GOOGLE_DRIVE_API_KEY) {
        driveAuthMode = 'api_key';
      }

      const detectedStorageKeys: string[] = [];
      [
        'MONGODB_URI',
        'MONGODB_URL',
        'MONGO_URL',
        'DATABASE_URL',
        'POSTGRES_URL',
        'POSTGRES_PRISMA_URL',
        'KV_URL',
        'KV_REST_API_URL',
        'BLOB_READ_WRITE_TOKEN',
      ].forEach((k) => {
        if (process.env[k]) detectedStorageKeys.push(k);
      });

      const isMongoDetected = Boolean(
        process.env.MONGODB_URI ||
          process.env.MONGODB_URL ||
          process.env.MONGO_URL ||
          process.env.DATABASE_URL?.startsWith('mongodb')
      );

      res.json({
        success: true,
        environment: {
          nodeEnv: config.NODE_ENV || 'production',
          isVercel: Boolean(process.env.VERCEL),
          serverTime: new Date().toISOString(),
        },
        database: {
          connected: dbConnected,
          error: lastErr,
          dbName: config.MONGODB_DB_NAME,
          vercelStorage: {
            detectedKeys: detectedStorageKeys,
            isMongoDetected,
            note: detectedStorageKeys.length === 0
              ? 'No storage environment variables detected. Connect MongoDB Atlas to persist sources and article history.'
              : 'Database storage variables detected.',
          },
        },
        sources: {
          total: sourcesCount,
          active: activeSourcesCount,
        },
        articles: {
          total: articlesCount,
          uploadedToDrive: driveUploadedCount,
          rendered: renderedCount,
          pending: pendingCount,
          failed: failedCount,
        },
        staging: {
          configured: Boolean(config.GDRIVE_FOLDER_ID),
          folderId: config.GDRIVE_FOLDER_ID ? `${config.GDRIVE_FOLDER_ID.substring(0, 8)}...` : null,
          fullFolderId: config.GDRIVE_FOLDER_ID || '',
          authMode: driveAuthMode,
          dataDir: config.DATA_DIR,
        },
        scheduler: {
          cronEnabled: config.CRON_ENABLED,
          schedule: config.CRON_SCHEDULE,
          dryRun: config.DRY_RUN,
          maxArticleAgeHours: config.MAX_ARTICLE_AGE_HOURS,
        },
        config: {
          defaultDuration: config.REEL_DEFAULT_DURATION,
          defaultTheme: config.REEL_DEFAULT_THEME,
          dryRun: config.DRY_RUN,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Reconnect MongoDB on-demand
  app.post('/api/db/connect', async (req: Request, res: Response) => {
    try {
      const customUri = (req.body?.uri || '').trim();
      const targetUri =
        customUri ||
        process.env.MONGODB_URI ||
        process.env.MONGODB_URL ||
        process.env.MONGO_URL ||
        (process.env.DATABASE_URL?.startsWith('mongodb') ? process.env.DATABASE_URL : '') ||
        config.MONGODB_URI;

      if (!targetUri || targetUri.includes('127.0.0.1') || targetUri.includes('localhost')) {
        return res.status(400).json({
          success: false,
          error:
            'No external MongoDB URI provided. Provide a valid MongoDB Atlas connection string (mongodb+srv://...) to connect.',
        });
      }

      await initDatabase(targetUri, config.MONGODB_DB_NAME);
      res.json({
        success: true,
        message: `Connected to MongoDB database (${config.MONGODB_DB_NAME}) successfully!`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Real-time Pipeline Execution Status & Live Log Stream
  app.get(['/api/input/status', '/api/pipeline/status'], (_req: Request, res: Response) => {
    res.json({
      success: true,
      ...pipeline.getJobState(),
    });
  });

  // Trigger Input Pipeline Cycle (Fetch RSS -> AI/TTS & Video Reel Rendering -> Google Drive Staging)
  app.all(['/api/cron/input', '/api/input/run', '/api/pipeline/run'], async (req: Request, res: Response) => {
    const force = req.query.force === 'true' || req.body?.force === true;
    const sourceId = (req.query.sourceId || req.body?.sourceId) as string | undefined;
    const folderId = (req.query.folderId || req.body?.folderId) as string | undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : req.body?.limit
      ? parseInt(req.body.limit as string, 10)
      : 1;
    const isSync = req.query.sync === 'true' || req.body?.sync === true;

    // Check if pipeline is already running
    if (pipeline.isJobRunning()) {
      return res.status(200).json({
        success: true,
        alreadyRunning: true,
        message: 'Input pipeline cycle is already in progress.',
        jobState: pipeline.getJobState(),
      });
    }

    if (isSync) {
      console.log(`[InputServer] 🚀 Triggering Input cycle in SYNC mode (limit=${limit})...`);
      try {
        const result = await pipeline.runInputCron({
          force,
          sourceId,
          folderId,
          limit,
        });
        return res.json(result);
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // ASYNC execution: prevents Vercel 504 Gateway Timeout while supporting live log polling
    console.log(`[InputServer] 🚀 Triggering Input cycle in ASYNC mode (limit=${limit})...`);
    const jobPromise = pipeline.runInputCron({
      force,
      sourceId,
      folderId,
      limit,
    });

    // Notify Vercel runtime to keep the serverless process alive in background
    try {
      const vercelFn = await import('@vercel/functions').catch(() => null);
      if (vercelFn && typeof vercelFn.waitUntil === 'function') {
        vercelFn.waitUntil(jobPromise);
      }
    } catch {
      // Non-Vercel environment
    }

    jobPromise.catch((err) => {
      console.error('[InputServer] Background pipeline error:', err);
    });

    return res.status(200).json({
      success: true,
      status: 'started',
      message: 'Input automation cycle started in background! Polling live status...',
      options: { force, sourceId, folderId, limit },
      jobState: pipeline.getJobState(),
    });
  });

  // List all RSS Sources
  app.get('/api/sources', async (_req: Request, res: Response) => {
    try {
      if (!isDbConnected()) {
        const defaultSources = [
          {
            _id: 'default_bdnews',
            name: 'BD News 24/7',
            url: 'https://bdnews.site/feed/',
            pageId: 'default',
            templateId: 'template-canva-bdnews',
            gdriveFolderId: config.GDRIVE_FOLDER_ID,
            reelTheme: 'canva-studio-rotate',
            reelDuration: config.REEL_DEFAULT_DURATION,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            _id: 'default_trendingnews',
            name: 'Trending News World',
            url: 'https://trendingnews.world/feed/',
            pageId: 'trending',
            templateId: 'template-trendingnews-breaking',
            gdriveFolderId: config.GDRIVE_FOLDER_ID,
            reelTheme: 'canva-studio-rotate',
            reelDuration: config.REEL_DEFAULT_DURATION,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
        return res.json({
          success: true,
          count: defaultSources.length,
          sources: defaultSources,
          message: 'Showing default fallback sources (MongoDB not connected).',
        });
      }

      const db = getDatabase();
      const sources = await db.collection<any>('rss_sources').find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray();

      // If database collection is empty, populate with default sources
      if (sources.length === 0) {
        const defaultSources = [
          {
            _id: 'default_bdnews',
            name: 'BD News 24/7',
            url: 'https://bdnews.site/feed/',
            pageId: 'default',
            templateId: 'template-canva-bdnews',
            gdriveFolderId: config.GDRIVE_FOLDER_ID,
            reelTheme: 'canva-studio-rotate',
            reelDuration: config.REEL_DEFAULT_DURATION,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            _id: 'default_trendingnews',
            name: 'Trending News World',
            url: 'https://trendingnews.world/feed/',
            pageId: 'trending',
            templateId: 'template-trendingnews-breaking',
            gdriveFolderId: config.GDRIVE_FOLDER_ID,
            reelTheme: 'canva-studio-rotate',
            reelDuration: config.REEL_DEFAULT_DURATION,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
        return res.json({ success: true, count: defaultSources.length, sources: defaultSources });
      }

      res.json({ success: true, count: sources.length, sources });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create or Upsert an RSS Source
  app.post('/api/sources', async (req: Request, res: Response) => {
    try {
      if (!isDbConnected()) {
        return res.status(400).json({
          success: false,
          error: 'MongoDB is not connected. Connect database to save new sources.',
        });
      }

      const body = req.body || {};
      const url = (body.url || '').trim();
      const name = (body.name || '').trim();

      if (!url || !name) {
        return res.status(400).json({ success: false, error: 'Source name and RSS feed URL are required.' });
      }

      const uploader = pipeline.getUploader();
      const rawFolder = body.gdriveFolderUrlOrId || body.gdriveFolderId || config.GDRIVE_FOLDER_ID || '';
      const cleanFolderId = uploader.extractFolderId(rawFolder);

      const sourceId = body._id || `source_${crypto.randomUUID().substring(0, 8)}`;
      const now = new Date();

      const newSource: RssSource = {
        _id: sourceId,
        name,
        url,
        pageId: body.pageId || 'default',
        templateId: body.templateId || 'template-canva-bdnews',
        gdriveFolderUrlOrId: rawFolder,
        gdriveFolderId: cleanFolderId,
        reelTheme: body.reelTheme || config.REEL_DEFAULT_THEME,
        reelDuration: body.reelDuration ? parseInt(body.reelDuration, 10) : config.REEL_DEFAULT_DURATION,
        isActive: body.isActive !== false && body.isActive !== 'false',
        createdAt: now,
        updatedAt: now,
      };

      const db = getDatabase();
      await db.collection<any>('rss_sources').updateOne(
        { _id: sourceId },
        {
          $set: {
            ...newSource,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );

      res.json({ success: true, message: `RSS Source "${name}" saved successfully!`, source: newSource });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update an RSS Source
  app.put('/api/sources/:id', async (req: Request, res: Response) => {
    try {
      if (!isDbConnected()) {
        return res.status(400).json({ success: false, error: 'Database not connected.' });
      }

      const sourceId = req.params.id;
      const body = req.body || {};
      const now = new Date();

      const updateFields: any = { updatedAt: now };

      if (body.name !== undefined) updateFields.name = String(body.name).trim();
      if (body.url !== undefined) updateFields.url = String(body.url).trim();
      if (body.pageId !== undefined) updateFields.pageId = String(body.pageId).trim();
      if (body.templateId !== undefined) updateFields.templateId = String(body.templateId).trim();
      if (body.reelTheme !== undefined) updateFields.reelTheme = String(body.reelTheme).trim();
      if (body.reelDuration !== undefined) updateFields.reelDuration = parseInt(body.reelDuration, 10);
      if (body.isActive !== undefined) updateFields.isActive = Boolean(body.isActive);

      if (body.gdriveFolderUrlOrId !== undefined || body.gdriveFolderId !== undefined) {
        const rawFolder = body.gdriveFolderUrlOrId || body.gdriveFolderId || '';
        const uploader = pipeline.getUploader();
        updateFields.gdriveFolderUrlOrId = rawFolder;
        updateFields.gdriveFolderId = uploader.extractFolderId(rawFolder);
      }

      const db = getDatabase();
      const result = await db.collection<any>('rss_sources').updateOne({ _id: sourceId }, { $set: updateFields });

      res.json({
        success: true,
        updated: result.matchedCount > 0,
        message: result.matchedCount > 0 ? 'Source updated successfully' : 'Source not found',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Delete an RSS Source
  app.delete('/api/sources/:id', async (req: Request, res: Response) => {
    try {
      if (!isDbConnected()) {
        return res.status(400).json({ success: false, error: 'Database not connected.' });
      }
      const db = getDatabase();
      const result = await db.collection<any>('rss_sources').deleteOne({ _id: req.params.id });
      res.json({ success: true, deleted: result.deletedCount > 0 });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Test & Preview an RSS Feed URL in real-time
  app.post('/api/sources/test', async (req: Request, res: Response) => {
    try {
      const url = (req.body?.url || req.query.url || '').toString().trim();
      if (!url) {
        return res.status(400).json({ success: false, error: 'RSS feed URL is required.' });
      }

      const limit = req.body?.limit ? parseInt(req.body.limit, 10) : 6;
      const parser = pipeline.getParser();
      const items = await parser.fetchAndParse(url, limit);

      res.json({
        success: true,
        url,
        count: items.length,
        items: items.map((it) => ({
          title: it.title,
          link: it.link,
          guid: it.guid,
          category: it.category,
          pubDate: it.pubDate,
          imageUrl: it.imageUrl || null,
          description: it.description?.slice(0, 160) || '',
        })),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Failed to parse RSS feed: ${err.message}` });
    }
  });

  // Query Ingested Articles & Google Drive Staging Status
  app.get(['/api/news-articles', '/api/articles'], async (req: Request, res: Response) => {
    try {
      if (!isDbConnected()) {
        return res.json({ success: true, count: 0, articles: [], message: 'Database not connected' });
      }

      const limit = Math.min(100, Math.max(1, req.query.limit ? parseInt(req.query.limit as string, 10) : 30));
      const status = req.query.status as string | undefined;
      const sourceId = req.query.sourceId as string | undefined;
      const search = req.query.search as string | undefined;

      const filter: any = {};
      if (status && status !== 'all') {
        filter.status = status;
      }
      if (sourceId && sourceId !== 'all') {
        filter.sourceId = sourceId;
      }
      if (search) {
        filter.title = { $regex: search, $options: 'i' };
      }

      const db = getDatabase();
      const articles = await db
        .collection('news_articles')
        .find(filter)
        .sort({ pubDate: -1, createdAt: -1 })
        .limit(limit)
        .toArray();

      res.json({ success: true, count: articles.length, articles });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Supported Reel Themes & Options
  app.get('/api/themes', (_req: Request, res: Response) => {
    const themes = [
      { id: 'canva-studio-rotate', name: 'Canva Studio Rotation (Recommended)', desc: 'Smart rotation across studio layouts' },
      { id: 'canva-studio-a', name: 'Canva Studio A (Modern Split)', desc: 'Clean headline & visual divider' },
      { id: 'canva-studio-b', name: 'Canva Studio B (Dynamic Ticker)', desc: 'Accent box with lower banner' },
      { id: 'canva-studio-c', name: 'Canva Studio C (Bold Breaking)', desc: 'High-visibility broadcast banner' },
      { id: 'auto-category', name: 'Auto-Category Theme', desc: 'Automatic color & styling matching article category' },
      { id: 'cat-bangladesh', name: 'National News (Bangladesh)', desc: 'Green & Red national branding' },
      { id: 'cat-politics', name: 'Politics Theme', desc: 'Authoritative deep blue & crimson accents' },
      { id: 'cat-economy', name: 'Economy & Business', desc: 'Emerald green financial aesthetics' },
      { id: 'cat-international', name: 'World & International', desc: 'Global navy & cyan highlights' },
      { id: 'cat-sports', name: 'Sports Highlights', desc: 'High-energy amber & dynamic angles' },
      { id: 'cat-technology', name: 'Technology & AI', desc: 'Cyber violet & electric blue' },
      { id: 'cat-entertainment', name: 'Showbiz & Entertainment', desc: 'Vibrant magenta & gold' },
      { id: 'breaking-bold', name: 'High-Contrast Breaking News', desc: 'Ultra-bold black & crimson' },
      { id: 'studio-red', name: 'Classic Studio Red', desc: 'Newsroom crimson with clean cards' },
      { id: 'viral-gradient', name: 'Viral Social Gradient', desc: 'Instagram/TikTok optimized social gradient' },
      { id: 'vertical-916', name: 'Clean 9:16 Vertical Reel', desc: 'Full-bleed vertical layout' },
    ];
    res.json({ success: true, themes, defaultTheme: config.REEL_DEFAULT_THEME, defaultDuration: config.REEL_DEFAULT_DURATION });
  });

  // On-Demand / Studio Reel Generation & Direct Staging
  app.post('/api/render-test', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const headline = (body.headline || body.title || '').trim();

      if (!headline) {
        return res.status(400).json({ success: false, error: 'Headline is required to render a reel.' });
      }

      const category = (body.category || 'BREAKING NEWS').trim();
      const imageUrl = (body.imageUrl || '').trim() || undefined;
      const theme = body.theme || config.REEL_DEFAULT_THEME;
      const durationSeconds = body.durationSeconds ? parseInt(body.durationSeconds, 10) : config.REEL_DEFAULT_DURATION;
      const website = (body.website || 'https://bdnews.site').trim();
      const uploadToDrive = Boolean(body.uploadToDrive);
      const targetFolderId = body.folderId || config.GDRIVE_FOLDER_ID;

      console.log(`[InputServer] 🎬 Studio manual reel render: "${headline}" (Theme: ${theme}, Duration: ${durationSeconds}s)...`);

      const reelRenderer = pipeline.getReelRenderer();
      const reelBuffer = await reelRenderer.renderReel({
        headline,
        category,
        imageUrl,
        theme,
        durationSeconds,
        fps: 24,
        website,
        isEnglish: /[a-zA-Z]{4,}/.test(headline),
        pageName: 'Studio Tester',
      });

      if (!reelBuffer) {
        return res.status(500).json({ success: false, error: 'Failed to generate reel video buffer.' });
      }

      let driveResult: any = null;
      if (uploadToDrive && targetFolderId) {
        const uploader = pipeline.getUploader();
        const cleanName = pipeline.sanitizeFilename(headline);
        const filename = `${cleanName} #ReelStudio.mp4`;

        driveResult = await uploader.uploadVideo({
          folderId: targetFolderId,
          videoBuffer: reelBuffer,
          filename,
        });
      }

      res.json({
        success: true,
        message: 'Reel rendered successfully!',
        headline,
        category,
        theme,
        durationSeconds,
        bufferSize: reelBuffer.length,
        driveResult,
      });
    } catch (err: any) {
      console.error('[InputServer] Studio render error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return app;
}
