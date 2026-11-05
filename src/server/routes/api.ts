import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { getDatabase } from '../../db/index.js';
import { FacebookPage, RssSource, Setting, NewsArticle, Job, PostLog, FacebookGroup, GroupShareLog } from '../../db/schema.js';
import { FacebookGraphClient } from '../../services/facebook/client.js';
import { GroupShareService } from '../../services/facebook/group-share.js';
import { PersistentJobQueue } from '../../services/queue/queue.js';
import { QueueWorker } from '../../services/queue/worker.js';
import { PlaywrightImageRenderer } from '../../services/renderer/playwright.js';
import { CanvasCardRenderer } from '../../services/renderer/canvas.js';
import { FacebookTokenService } from '../../services/facebook/token.js';
import { ArticleDedupeService } from '../../services/rss/dedupe.js';
import { AVAILABLE_TEMPLATES } from '../../config/constants.js';
import { config } from '../../config/env.js';

export const apiRouter = Router();
const queue = new PersistentJobQueue();
const worker = new QueueWorker();
const renderer = new PlaywrightImageRenderer();
const canvasRenderer = new CanvasCardRenderer();
const dedupeService = new ArticleDedupeService();
const fbClient = new FacebookGraphClient();
const groupShareService = new GroupShareService(fbClient);

// 1. Dashboard Overview Stats
apiRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const queueStats = await queue.getStats();

    const articlesCount = await db.collection('news_articles').countDocuments();
    const pagesCount = await db.collection('facebook_pages').countDocuments();
    const sourcesCount = await db.collection('rss_sources').countDocuments();
    const groupsCount = await db.collection('facebook_groups').countDocuments();
    const groupSharesCount = await db.collection('group_shares').countDocuments({
      status: 'success',
    });
    const successfulPosts = await db.collection('post_logs').countDocuments({
      status: { $in: ['success', 'dry_run'] },
    });

    res.json({
      queue: queueStats,
      articlesCount,
      pagesCount,
      sourcesCount,
      groupsCount,
      groupSharesCount,
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
            shared_groups: '$sharedGroups',
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
      '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি';

    // Instant Skia Canvas 1080x1080 JPG card rendering (40ms)
    const buffer = await canvasRenderer.renderCard({
      templateId: templateId || 'template-canva-bdnews',
      headline: sampleHeadline,
      category: category || 'বিশেষ খবর',
      imageUrl: imageUrl || undefined,
    });

    const base64Data = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    res.json({
      success: true,
      imageUri: base64Data,
      format: 'image/jpeg',
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

// Direct Image Card Endpoint (Streams high-res JPG)
apiRouter.get('/preview/card.jpg', async (req: Request, res: Response) => {
  try {
    const headline = (req.query.headline as string) || '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত';
    const category = (req.query.category as string) || 'বিশেষ খবর';
    const imageUrl = req.query.imageUrl as string | undefined;

    const buffer = await canvasRenderer.renderCard({
      headline,
      category,
      imageUrl,
    });

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

// ==============================================================================
// 10. Facebook Group Auto-Sharing Management
// ==============================================================================

// List all configured Facebook groups
apiRouter.get('/groups', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const groups = await db
      .collection<FacebookGroup>('facebook_groups')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(
      groups.map((g) => ({
        id: g._id,
        _id: g._id,
        name: g.name,
        pageId: g.pageId,
        categories: g.categories || [],
        auto_share: g.autoShare ?? true,
        is_active: g.isActive ?? true,
        hasCustomToken: !!(g.accessToken && g.accessToken.trim()),
        created_at: g.createdAt,
      }))
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add or update a Facebook group
apiRouter.post('/groups', async (req: Request, res: Response) => {
  const { id, name, categories, auto_share, is_active, access_token, page_id } = req.body;

  if (!id || !name) {
    res.status(400).json({ error: 'Group ID and Group Name are required' });
    return;
  }

  try {
    const db = getDatabase();
    const cleanId = String(id).trim();
    const cleanName = String(name).trim();

    // Parse categories: string array or comma-separated string
    let parsedCategories: string[] = [];
    if (Array.isArray(categories)) {
      parsedCategories = categories.map((c) => String(c).trim()).filter(Boolean);
    } else if (typeof categories === 'string') {
      parsedCategories = categories.split(',').map((c) => c.trim()).filter(Boolean);
    }

    if (parsedCategories.length === 0) {
      parsedCategories = ['*']; // Default to all news
    }

    const groupDoc: FacebookGroup = {
      _id: cleanId,
      name: cleanName,
      pageId: page_id ? String(page_id).trim() : undefined,
      categories: parsedCategories,
      accessToken: access_token ? String(access_token).trim() : null,
      autoShare: auto_share !== false,
      isActive: is_active !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection<FacebookGroup>('facebook_groups').updateOne(
      { _id: cleanId },
      {
        $set: {
          name: groupDoc.name,
          pageId: groupDoc.pageId,
          categories: groupDoc.categories,
          accessToken: groupDoc.accessToken,
          autoShare: groupDoc.autoShare,
          isActive: groupDoc.isActive,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({ success: true, group: groupDoc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update group
apiRouter.put('/groups/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { name, categories, auto_share, is_active, access_token } = req.body;
    const updateData: any = { updatedAt: new Date() };

    if (name) updateData.name = String(name).trim();
    if (auto_share !== undefined) updateData.autoShare = Boolean(auto_share);
    if (is_active !== undefined) updateData.isActive = Boolean(is_active);
    if (access_token !== undefined) updateData.accessToken = access_token ? String(access_token).trim() : null;

    if (categories !== undefined) {
      let parsedCategories: string[] = [];
      if (Array.isArray(categories)) {
        parsedCategories = categories.map((c) => String(c).trim()).filter(Boolean);
      } else if (typeof categories === 'string') {
        parsedCategories = categories.split(',').map((c) => c.trim()).filter(Boolean);
      }
      updateData.categories = parsedCategories;
    }

    await db.collection<FacebookGroup>('facebook_groups').updateOne(
      { _id: req.params.id },
      { $set: updateData }
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete group
apiRouter.delete('/groups/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    await db.collection<FacebookGroup>('facebook_groups').deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-discover groups linked to connected page or token
apiRouter.post('/groups/discover', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const activePage = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });

    if (!activePage) {
      res.status(400).json({ error: 'No active Facebook Page found to query groups' });
      return;
    }

    const linkedGroups = await fbClient.getLinkedGroups(activePage._id, activePage.accessToken);
    res.json({
      success: true,
      pageName: activePage.name,
      pageId: activePage._id,
      groups: linkedGroups,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test share to a specific group
apiRouter.post('/groups/:id/test-share', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const groupId = req.params.id;

    const group = await db.collection<FacebookGroup>('facebook_groups').findOne({ _id: groupId });
    if (!group) {
      res.status(404).json({ error: `Group ${groupId} not found` });
      return;
    }

    // Find the latest published post
    const latestLog = await db
      .collection<PostLog>('post_logs')
      .findOne({ status: { $in: ['success', 'dry_run'] }, fbPostId: { $ne: null } }, { sort: { createdAt: -1 } });

    if (!latestLog) {
      res.status(400).json({ error: 'No published posts available to test share. Please publish a post first.' });
      return;
    }

    const article = await db.collection<NewsArticle>('news_articles').findOne({ _id: latestLog.articleId });
    if (!article) {
      res.status(400).json({ error: 'Article corresponding to latest post not found.' });
      return;
    }

    const page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: latestLog.pageId });
    if (!page) {
      res.status(400).json({ error: 'Page corresponding to latest post not found.' });
      return;
    }

    const result = await groupShareService.shareToSpecificGroup(
      groupId,
      article,
      page,
      latestLog.fbPostId!
    );

    res.json({
      success: result.status === 'success',
      result,
      articleTitle: article.title,
      postId: latestLog.fbPostId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent group share logs
apiRouter.get('/groups/shares', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const limit = parseInt(req.query.limit as string) || 30;
    const logs = await db
      .collection<GroupShareLog>('group_shares')
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
