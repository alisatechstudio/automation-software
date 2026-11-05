import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { getDatabase } from '../../db/index.js';
import { FacebookPage, RssSource, Setting, NewsArticle, Job, PostLog } from '../../db/schema.js';
import { PersistentJobQueue } from '../../services/queue/queue.js';
import { PlaywrightImageRenderer } from '../../services/renderer/playwright.js';
import { FacebookTokenService } from '../../services/facebook/token.js';
import { ArticleDedupeService } from '../../services/rss/dedupe.js';
import { AVAILABLE_TEMPLATES } from '../../config/constants.js';
import { config } from '../../config/env.js';

export const apiRouter = Router();
const queue = new PersistentJobQueue();
const renderer = new PlaywrightImageRenderer();
const dedupeService = new ArticleDedupeService();

// 1. Dashboard Overview Stats
apiRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const queueStats = await queue.getStats();

    const articlesCount = await db.collection('news_articles').countDocuments();
    const pagesCount = await db.collection('facebook_pages').countDocuments();
    const sourcesCount = await db.collection('rss_sources').countDocuments();
    const successfulPosts = await db.collection('post_logs').countDocuments({
      status: { $in: ['success', 'dry_run'] },
    });

    res.json({
      queue: queueStats,
      articlesCount,
      pagesCount,
      sourcesCount,
      successfulPosts,
      dryRun: config.DRY_RUN,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. RSS Sources
apiRouter.get('/sources', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const sources = await db
      .collection('rss_sources')
      .aggregate([
        {
          $lookup: {
            from: 'facebook_pages',
            localField: 'pageId',
            foreignField: '_id',
            as: 'pageDoc',
          },
        },
        {
          $project: {
            id: '$_id',
            name: 1,
            url: 1,
            page_id: '$pageId',
            template_id: '$templateId',
            is_active: '$isActive',
            created_at: '$createdAt',
            page_name: { $arrayElemAt: ['$pageDoc.name', 0] },
          },
        },
        { $sort: { created_at: -1 } },
      ])
      .toArray();

    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sources', async (req: Request, res: Response) => {
  const { name, url, page_id, template_id, is_active } = req.body;
  if (!name || !url || !page_id) {
    res.status(400).json({ error: 'Name, URL, and Facebook Page are required' });
    return;
  }

  const db = getDatabase();
  const id = crypto.randomUUID();

  try {
    const doc: RssSource = {
      _id: id,
      name: name.trim(),
      url: url.trim(),
      pageId: page_id,
      templateId: template_id || 'template-square-breaking',
      isActive: is_active !== undefined ? Boolean(is_active) : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection<RssSource>('rss_sources').insertOne(doc as any);
    res.status(201).json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/sources/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    await db.collection<RssSource>('rss_sources').deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Facebook Pages
apiRouter.get('/pages', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const pages = await db
      .collection<FacebookPage>('facebook_pages')
      .find({})
      .project({
        id: '$_id',
        name: 1,
        is_active: '$isActive',
        token_expires_at: '$tokenExpiresAt',
        created_at: '$createdAt',
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(pages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/pages', async (req: Request, res: Response) => {
  const { id, name, access_token } = req.body;
  if (!id || !name || !access_token) {
    res.status(400).json({ error: 'Page ID, Name, and Page Access Token are required' });
    return;
  }

  try {
    const tokenInfo = await FacebookTokenService.inspectToken(access_token);
    const db = getDatabase();

    await db.collection<FacebookPage>('facebook_pages').updateOne(
      { _id: id.trim() },
      {
        $set: {
          name: name.trim(),
          accessToken: access_token.trim(),
          tokenExpiresAt: tokenInfo.expiresAt || null,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.status(201).json({
      success: true,
      id,
      tokenInfo: {
        isValid: tokenInfo.isValid,
        expiresAt: tokenInfo.expiresAt,
        scopes: tokenInfo.scopes,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pages/test', async (req: Request, res: Response) => {
  const { access_token } = req.body;
  if (!access_token) {
    res.status(400).json({ error: 'Access token required' });
    return;
  }

  const tokenInfo = await FacebookTokenService.inspectToken(access_token);
  res.json(tokenInfo);
});

apiRouter.delete('/pages/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    await db.collection<FacebookPage>('facebook_pages').deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Queue & Job Management
apiRouter.get('/queue', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const status = req.query.status as string;

    const matchStage: Record<string, any> = {};
    if (status) {
      matchStage.status = status;
    }

    const jobs = await db
      .collection('jobs')
      .aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'news_articles',
            localField: 'articleId',
            foreignField: '_id',
            as: 'articleDoc',
          },
        },
        {
          $lookup: {
            from: 'facebook_pages',
            localField: 'pageId',
            foreignField: '_id',
            as: 'pageDoc',
          },
        },
        {
          $project: {
            id: '$_id',
            type: 1,
            status: 1,
            attempts: 1,
            max_attempts: '$maxAttempts',
            run_at: '$runAt',
            created_at: '$createdAt',
            last_error: '$lastError',
            article_title: { $arrayElemAt: ['$articleDoc.title', 0] },
            article_link: { $arrayElemAt: ['$articleDoc.link', 0] },
            page_name: { $arrayElemAt: ['$pageDoc.name', 0] },
          },
        },
        { $sort: { created_at: -1 } },
        { $limit: 50 },
      ])
      .toArray();

    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/queue/:id/retry', async (req: Request, res: Response) => {
  try {
    const success = await queue.retryFailedJob(req.params.id as string);
    if (success) {
      res.json({ success: true, message: 'Job rescheduled for immediate processing' });
    } else {
      res.status(400).json({ error: 'Job not found or not in failed state' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Post Logs
apiRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const logs = await db
      .collection('post_logs')
      .aggregate([
        {
          $lookup: {
            from: 'news_articles',
            localField: 'articleId',
            foreignField: '_id',
            as: 'articleDoc',
          },
        },
        {
          $lookup: {
            from: 'facebook_pages',
            localField: 'pageId',
            foreignField: '_id',
            as: 'pageDoc',
          },
        },
        {
          $project: {
            id: '$_id',
            status: 1,
            fb_photo_id: '$fbPhotoId',
            fb_post_id: '$fbPostId',
            fb_comment_id: '$fbCommentId',
            duration_ms: '$durationMs',
            created_at: '$createdAt',
            article_title: { $arrayElemAt: ['$articleDoc.title', 0] },
            article_link: { $arrayElemAt: ['$articleDoc.link', 0] },
            page_name: { $arrayElemAt: ['$pageDoc.name', 0] },
          },
        },
        { $sort: { created_at: -1 } },
        { $limit: 50 },
      ])
      .toArray();

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Template Live Preview
apiRouter.get('/templates', (req: Request, res: Response) => {
  res.json(Object.values(AVAILABLE_TEMPLATES));
});

apiRouter.post('/preview/render', async (req: Request, res: Response) => {
  try {
    const { templateId, headline, category, imageUrl } = req.body;

    const sampleHeadline =
      headline ||
      'রিপাবলিকানদের ঘাঁটি এলাকায় ডেমোক্র্যাটদের নাটকীয় জয়: হোয়াইট হাউসের রাজনীতিতে নতুন মেরুকরণ ও আলোড়ন';

    const buffer = await renderer.renderToBuffer({
      templateId: templateId || 'template-square-breaking',
      headline: sampleHeadline,
      category: category || 'ব্রেকিং নিউজ',
      imageUrl: imageUrl || undefined,
    });

    const base64Data = `data:image/png;base64,${buffer.toString('base64')}`;
    res.json({
      success: true,
      imageUri: base64Data,
      sizeBytes: buffer.length,
    });
  } catch (err: any) {
    console.error('[PreviewRender] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Manual trigger: Poll RSS Now
apiRouter.post('/poll-now', async (req: Request, res: Response) => {
  try {
    const results = await dedupeService.pollAllActiveSources();
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Settings
apiRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const rows = await db.collection<Setting>('settings').find({}).toArray();

    const settingsMap: Record<string, string> = {
      POLL_INTERVAL_CRON: config.POLL_INTERVAL_CRON,
      MAX_ARTICLE_AGE_HOURS: String(config.MAX_ARTICLE_AGE_HOURS),
      MAX_POSTS_PER_HOUR: String(config.MAX_POSTS_PER_HOUR),
      MIN_DELAY_SECONDS: String(config.MIN_DELAY_SECONDS),
      MAX_DELAY_SECONDS: String(config.MAX_DELAY_SECONDS),
      DRY_RUN: String(config.DRY_RUN),
      DEFAULT_HASHTAGS: config.DEFAULT_HASHTAGS,
      DEFAULT_CAPTION_FORMAT: config.DEFAULT_CAPTION_FORMAT,
      DEFAULT_COMMENT_FORMAT: config.DEFAULT_COMMENT_FORMAT,
    };

    for (const r of rows) {
      settingsMap[r._id] = r.value;
    }

    res.json(settingsMap);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const body = req.body;
    const settingsCol = db.collection<Setting>('settings');

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        await settingsCol.updateOne(
          { _id: key },
          {
            $set: {
              value: String(value),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
