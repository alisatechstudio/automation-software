import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { getDatabase } from '../../db/index.js';
import { FacebookPage, RssSource, Setting, NewsArticle, Job, PostLog } from '../../db/schema.js';
import { PersistentJobQueue } from '../../services/queue/queue.js';
import { QueueWorker } from '../../services/queue/worker.js';
import { PlaywrightImageRenderer } from '../../services/renderer/playwright.js';
import { FacebookTokenService } from '../../services/facebook/token.js';
import { ArticleDedupeService } from '../../services/rss/dedupe.js';
import { AVAILABLE_TEMPLATES } from '../../config/constants.js';
import { config } from '../../config/env.js';

export const apiRouter = Router();
const queue = new PersistentJobQueue();
const worker = new QueueWorker();
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
    let finalAccessToken = access_token.trim();
    let tokenInfo = await FacebookTokenService.inspectToken(finalAccessToken);
    let autoResolved = false;

    // If user mistakenly pasted a USER access token instead of a PAGE access token,
    // automatically attempt to resolve the actual Page Access Token via /me/accounts
    if (tokenInfo.type === 'USER' || tokenInfo.type === 'user') {
      try {
        console.log(`[TokenService] User token detected for page ${id}. Resolving Page Access Token via /me/accounts...`);
        const accountsRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(finalAccessToken)}`
        );
        const accountsData = (await accountsRes.json()) as any;
        if (accountsData?.data && Array.isArray(accountsData.data)) {
          const matched = accountsData.data.find((p: any) => p.id === id.trim());
          if (matched && matched.access_token) {
            finalAccessToken = matched.access_token;
            autoResolved = true;
            tokenInfo = await FacebookTokenService.inspectToken(finalAccessToken);
            console.log(`[TokenService] Successfully resolved Page Access Token for "${matched.name}" (${matched.id})!`);
          }
        }
      } catch (e: any) {
        console.warn('[TokenService] Auto-resolve page token failed:', e.message);
      }
    }

    const db = getDatabase();

    await db.collection<FacebookPage>('facebook_pages').updateOne(
      { _id: id.trim() },
      {
        $set: {
          name: name.trim(),
          accessToken: finalAccessToken,
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
        type: tokenInfo.type,
        expiresAt: tokenInfo.expiresAt,
        scopes: tokenInfo.scopes,
        autoResolvedPageToken: autoResolved,
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

apiRouter.post('/pages/exchange-permanent', async (req: Request, res: Response) => {
  const { user_token, app_id, app_secret } = req.body;
  if (!user_token || !app_id || !app_secret) {
    res.status(400).json({ error: 'user_token, app_id, and app_secret are required' });
    return;
  }

  try {
    const pages = await FacebookTokenService.getPermanentPageTokens(user_token, app_id, app_secret);
    res.json({ success: true, pages });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
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
      const job = await queue.fetchNextJob();
      if (job) {
        await worker.processJob(job);
      }
      res.json({ success: true, message: 'Job rescheduled and processed immediately' });
    } else {
      res.status(400).json({ error: 'Job not found' });
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

apiRouter.post('/preview/html', (req: Request, res: Response) => {
  try {
    const { templateId, headline, category, imageUrl } = req.body;

    const sampleHeadline =
      headline ||
      '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি';

    const html = renderer.compileHtml({
      templateId: templateId || 'template-canva-bdnews',
      headline: sampleHeadline,
      category: category || 'বিশেষ খবর',
      imageUrl: imageUrl || undefined,
    });

    res.json({
      success: true,
      html,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/preview/render', async (req: Request, res: Response) => {
  try {
    const { templateId, headline, category, imageUrl } = req.body;

    const sampleHeadline =
      headline ||
      '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি';

    // 8-second safety timeout on serverless to avoid 504 Gateway Timeout
    const renderPromise = renderer.renderToBuffer({
      templateId: templateId || 'template-canva-bdnews',
      headline: sampleHeadline,
      category: category || 'বিশেষ খবর',
      imageUrl: imageUrl || undefined,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Serverless Chromium render timed out (Use Instant Live Preview)')),
        8500
      )
    );

    const buffer = await Promise.race([renderPromise, timeoutPromise]);

    const base64Data = `data:image/png;base64,${buffer.toString('base64')}`;
    res.json({
      success: true,
      imageUri: base64Data,
      sizeBytes: buffer.length,
    });
  } catch (err: any) {
    console.warn('[PreviewRender] Warning:', err.message);
    res.status(200).json({
      success: false,
      error: err.message,
      useHtmlPreview: true,
    });
  }
});

// 7. Manual trigger: Poll RSS Now & Process Next Job
apiRouter.post('/poll-now', async (req: Request, res: Response) => {
  try {
    const results = await dedupeService.pollAllActiveSources();
    const job = await queue.fetchNextJob();
    let publishedPostId: string | null = null;

    if (job) {
      console.log(`[Manual Poll] Immediate worker execution for job ${job._id}...`);
      await worker.processJob(job);
      publishedPostId = job.articleId || null;
    }

    res.json({
      success: true,
      results,
      processedJob: !!job,
      jobId: job ? job._id : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7b. Manual trigger: Publish Next Available Article immediately
apiRouter.post('/queue/publish-next', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const articlesCol = db.collection<NewsArticle>('news_articles');
    const pagesCol = db.collection<FacebookPage>('facebook_pages');
    const jobsCol = db.collection<Job>('jobs');

    const page = await pagesCol.findOne({ isActive: true });
    if (!page) {
      res.status(400).json({ error: 'No active Facebook page connected' });
      return;
    }

    // Find the latest article that hasn't been published yet, or fall back to most recent
    let article = await articlesCol.findOne({ status: { $ne: 'published' } }, { sort: { createdAt: -1 } });
    if (!article) {
      article = await articlesCol.findOne({}, { sort: { createdAt: -1 } });
    }

    if (!article) {
      res.status(404).json({ error: 'No news articles available. Please Poll RSS first.' });
      return;
    }

    const jobId = crypto.randomUUID();
    const jobDoc: Job = {
      _id: jobId,
      type: 'process_article',
      articleId: article._id,
      pageId: page._id,
      payload: {
        articleId: article._id,
        sourceId: article.sourceId,
        pageId: page._id,
        templateId: 'template-canva-bdnews',
      },
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      runAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await jobsCol.insertOne(jobDoc as any);
    console.log(`[PublishNext] Created immediate job ${jobId} for article "${article.title}". Executing worker...`);

    await worker.processJob(jobDoc);

    const logsCol = db.collection<PostLog>('post_logs');
    const latestLog = await logsCol.findOne({ articleId: article._id }, { sort: { createdAt: -1 } });

    res.json({
      success: true,
      articleTitle: article.title,
      pageName: page.name,
      pageId: page._id,
      log: latestLog,
    });
  } catch (err: any) {
    console.error('[PublishNext] Error:', err);
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
