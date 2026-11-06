import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { getDatabase } from '../../db/index.js';
import { FacebookPage, RssSource, Setting, NewsArticle, Job, PostLog, FacebookGroup, GroupShareLog, ReelLog, StoryLog, YouTubeUploadLog } from '../../db/schema.js';
import { PersistentJobQueue } from '../../services/queue/queue.js';
import { QueueWorker, getNextRollingReelTheme } from '../../services/queue/worker.js';
import { PlaywrightImageRenderer } from '../../services/renderer/playwright.js';
import { CanvasCardRenderer } from '../../services/renderer/canvas.js';
import { ReelVideoRenderer } from '../../services/renderer/reel.js';
import { FacebookTokenService } from '../../services/facebook/token.js';
import { FacebookGraphClient } from '../../services/facebook/client.js';
import { YouTubeClient } from '../../services/youtube/client.js';
import { ArticleDedupeService } from '../../services/rss/dedupe.js';
import { AVAILABLE_TEMPLATES, REEL_TEMPLATES } from '../../config/constants.js';
import { config } from '../../config/env.js';

export const apiRouter = Router();
const queue = new PersistentJobQueue();
const worker = new QueueWorker();
const renderer = new PlaywrightImageRenderer();
const canvasRenderer = new CanvasCardRenderer();
const reelRenderer = new ReelVideoRenderer();
const ytClient = new YouTubeClient();
const dedupeService = new ArticleDedupeService();

// 1. Dashboard Overview Stats
apiRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const queueStats = await queue.getStats();

    const articlesCount = await db.collection('news_articles').countDocuments();
    const pagesCount = await db.collection('facebook_pages').countDocuments();
    const sourcesCount = await db.collection('rss_sources').countDocuments();
    const groupsCount = await db.collection('facebook_groups').countDocuments();
    const groupSharesCount = await db.collection('group_share_logs').countDocuments({
      status: { $in: ['success', 'dry_run'] },
    });
    const reelsCount = await db.collection('reel_logs').countDocuments({
      status: { $in: ['success', 'dry_run'] },
    });
    const storiesCount = await db.collection('story_logs').countDocuments({
      status: { $in: ['success', 'dry_run'] },
    });
    const youtubeCount = await db.collection('youtube_upload_logs').countDocuments({
      status: { $in: ['success', 'dry_run'] },
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
      reelsCount,
      storiesCount,
      youtubeCount,
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

// ==============================================================================
// 3.5. Facebook Groups (Auto-Share to Relevant Groups)
// ==============================================================================
apiRouter.get('/groups', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const groups = await db
      .collection<FacebookGroup>('facebook_groups')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/groups', async (req: Request, res: Response) => {
  try {
    let { id, name, categories, auto_share, page_id, access_token, delay_seconds } = req.body;

    if (!id || !name) {
      res.status(400).json({ error: 'Group ID (or URL) and Group Name are required' });
      return;
    }

    // Auto extract group ID if user provided a URL (e.g. facebook.com/groups/123456789)
    let cleanId = id.toString().trim();
    const urlMatch = cleanId.match(/facebook\.com\/groups\/([^\/?#]+)/i);
    if (urlMatch && urlMatch[1]) {
      cleanId = urlMatch[1];
    }

    // Parse categories: support array or comma-separated string
    let parsedCategories: string[] = [];
    if (Array.isArray(categories)) {
      parsedCategories = categories.map((c) => String(c).trim()).filter(Boolean);
    } else if (typeof categories === 'string') {
      parsedCategories = categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
    }
    if (parsedCategories.length === 0) {
      parsedCategories = ['all'];
    }

    const db = getDatabase();

    const doc: FacebookGroup = {
      _id: cleanId,
      name: name.trim(),
      categories: parsedCategories,
      autoShare: auto_share !== undefined ? Boolean(auto_share) : true,
      pageId: page_id ? page_id.trim() : 'all',
      accessToken: access_token ? access_token.trim() : null,
      delaySeconds: delay_seconds ? parseInt(delay_seconds, 10) : 5,
      totalShares: 0,
      lastSharedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection<FacebookGroup>('facebook_groups').updateOne(
      { _id: cleanId },
      {
        $set: {
          name: doc.name,
          categories: doc.categories,
          autoShare: doc.autoShare,
          pageId: doc.pageId,
          accessToken: doc.accessToken,
          delaySeconds: doc.delaySeconds,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          totalShares: 0,
          lastSharedAt: null,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.status(201).json({ success: true, group: doc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/groups/:id', async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id;
    const { name, categories, auto_share, page_id, access_token, delay_seconds } = req.body;

    const db = getDatabase();
    const updateFields: any = { updatedAt: new Date() };

    if (name !== undefined) updateFields.name = String(name).trim();
    if (auto_share !== undefined) updateFields.autoShare = Boolean(auto_share);
    if (page_id !== undefined) updateFields.pageId = String(page_id).trim();
    if (access_token !== undefined) updateFields.accessToken = access_token ? String(access_token).trim() : null;
    if (delay_seconds !== undefined) updateFields.delaySeconds = parseInt(delay_seconds, 10) || 5;

    if (categories !== undefined) {
      if (Array.isArray(categories)) {
        updateFields.categories = categories.map((c) => String(c).trim()).filter(Boolean);
      } else if (typeof categories === 'string') {
        updateFields.categories = categories.split(',').map((c) => c.trim()).filter(Boolean);
      }
    }

    await db.collection<FacebookGroup>('facebook_groups').updateOne(
      { _id: groupId },
      { $set: updateFields }
    );

    res.json({ success: true, groupId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/groups/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    await db.collection<FacebookGroup>('facebook_groups').deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/groups/shares', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const limit = parseInt(req.query.limit as string, 10) || 30;
    const shares = await db
      .collection<GroupShareLog>('group_share_logs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.json(shares);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/groups/:id/test-share', async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id;
    const db = getDatabase();

    const group = await db.collection<FacebookGroup>('facebook_groups').findOne({ _id: groupId });
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Find latest published log
    const latestPost = await db
      .collection<PostLog>('post_logs')
      .findOne({ status: { $in: ['success', 'dry_run'] }, fbPostId: { $ne: null } }, { sort: { createdAt: -1 } });

    if (!latestPost || !latestPost.fbPostId) {
      res.status(400).json({ error: 'No published Facebook posts found to test share with. Please publish a post first.' });
      return;
    }

    // Find token to use
    let tokenToUse = group.accessToken;
    if (!tokenToUse) {
      const page = await db.collection<FacebookPage>('facebook_pages').findOne({
        ...(group.pageId && group.pageId !== 'all' ? { _id: group.pageId } : { isActive: true })
      });
      if (page) {
        tokenToUse = page.accessToken;
      }
    }

    if (!tokenToUse) {
      res.status(400).json({ error: 'No active Facebook Access Token found for this group or connected page' });
      return;
    }

    const postPermalink = `https://www.facebook.com/${latestPost.fbPostId}`;
    const fbGraph = new FacebookGraphClient();
    const message = `🔴 [টেস্ট শেয়ার]\n\nবিস্তারিত দেখুনঃ`;

    const result = await fbGraph.shareToGroup(
      groupId,
      tokenToUse,
      postPermalink,
      message,
      config.DRY_RUN
    );

    // Record share log
    await db.collection<GroupShareLog>('group_share_logs').insertOne({
      _id: crypto.randomUUID(),
      groupId: group._id,
      groupName: group.name,
      articleId: latestPost.articleId,
      articleTitle: 'Manual Test Share',
      fbPostId: latestPost.fbPostId,
      sharePostId: result.sharePostId,
      status: config.DRY_RUN ? 'dry_run' : 'success',
      durationMs: 400,
      createdAt: new Date(),
    } as any);

    await db.collection<FacebookGroup>('facebook_groups').updateOne(
      { _id: groupId },
      { $inc: { totalShares: 1 }, $set: { lastSharedAt: new Date() } }
    );

    res.json({
      success: true,
      sharePostId: result.sharePostId,
      groupName: group.name,
      postUrl: postPermalink,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, classification: (err as any).classification });
  }
});

// ==============================================================================
// 3.8. Facebook Reels (Create & Publish MP4 Reels)
// ==============================================================================
apiRouter.get('/reels/templates', (req: Request, res: Response) => {
  res.json({
    success: true,
    templates: REEL_TEMPLATES,
  });
});

apiRouter.get('/reels/preview-frame.jpg', async (req: Request, res: Response) => {
  try {
    const headline =
      (req.query.headline as string) ||
      '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি';
    const category = (req.query.category as string) || 'বিশেষ খবর';
    const imageUrl = req.query.imageUrl as string | undefined;
    const theme = (req.query.theme as string) || 'studio-red';

    const frameBuffer = await reelRenderer.renderStaticPreview({
      headline,
      category,
      imageUrl,
      theme,
    });

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', frameBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(frameBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/reels/preview.mp4', async (req: Request, res: Response) => {
  try {
    const headline =
      (req.query.headline as string) ||
      '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি';
    const category = (req.query.category as string) || 'বিশেষ খবর';
    const imageUrl = req.query.imageUrl as string | undefined;
    const theme = (req.query.theme as string) || 'studio-red';
    const durationSeconds = parseInt(req.query.duration as string, 10) || 15;

    const videoBuffer = await reelRenderer.renderReel({
      headline,
      category,
      imageUrl,
      theme,
      durationSeconds,
      fps: 20,
    });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', videoBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(videoBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/reels/publish', async (req: Request, res: Response) => {
  try {
    const { articleId, headline, category, imageUrl, pageId, theme, duration } = req.body;
    const db = getDatabase();

    let targetHeadline = headline;
    let targetCategory = category || 'বিশেষ খবর';
    let targetImageUrl = imageUrl;
    let finalArticleId = articleId;
    let targetTheme = theme;
    if (!targetTheme || targetTheme === 'rolling') {
      targetTheme = await getNextRollingReelTheme(db);
      console.log(`[Reels API] 🔄 Rolling Rotation selected: "${targetTheme}"`);
    }
    const durationSeconds = parseInt(duration as string, 10) || 15;

    if (articleId) {
      const art = await db.collection<NewsArticle>('news_articles').findOne({ _id: articleId });
      if (art) {
        targetHeadline = targetHeadline || art.title;
        targetCategory = targetCategory || art.category || 'বিশেষ খবর';
        targetImageUrl = targetImageUrl || art.imageUrl;
      }
    } else {
      const latestArt = await db.collection<NewsArticle>('news_articles').findOne({}, { sort: { pubDate: -1 } });
      if (latestArt) {
        targetHeadline = targetHeadline || latestArt.title;
        targetCategory = targetCategory || latestArt.category || 'বিশেষ খবর';
        targetImageUrl = targetImageUrl || latestArt.imageUrl;
        finalArticleId = latestArt._id;
      }
    }

    if (!targetHeadline) {
      res.status(400).json({ error: 'Headline is required to generate Reel' });
      return;
    }

    // Determine target page
    let page: FacebookPage | null = null;
    if (pageId && pageId !== 'all') {
      page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: pageId });
    }
    if (!page) {
      page = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
    }
    if (!page) {
      res.status(400).json({ error: 'No active Facebook Page found to publish Reel to' });
      return;
    }

    console.log(`[Reels API] Rendering ${durationSeconds}s MP4 Reel (${targetTheme}) for "${targetHeadline}"...`);
    const startTime = Date.now();
    const reelBuffer = await reelRenderer.renderReel({
      headline: targetHeadline,
      category: targetCategory,
      imageUrl: targetImageUrl || undefined,
      theme: targetTheme,
      durationSeconds,
      fps: 20,
    });

    const fbClient = new FacebookGraphClient();
    
    // Caption: ONLY hashtags (no headline, no summary)
    const hashtagSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_HASHTAGS' });
    const configuredHashtags = hashtagSetting?.value || config.DEFAULT_HASHTAGS;
    const caption = (configuredHashtags + ' #Reels #FBReels #ViralNews #Bangladesh').trim();

    console.log(`[Reels API] Publishing ${durationSeconds}s Reel to Facebook Page ${page.name} (${page._id})...`);
    const { videoId, postId } = await fbClient.publishReel(
      page._id,
      page.accessToken,
      reelBuffer,
      caption,
      undefined, // No title/headline in post metadata
      config.DRY_RUN
    );

    // News URL in First Comment
    let commentId: string | null = null;
    let targetLink: string | null = null;
    if (finalArticleId) {
      const art = await db.collection<NewsArticle>('news_articles').findOne({ _id: finalArticleId });
      targetLink = art?.link || null;
    }
    if (targetLink && postId) {
      try {
        const commentFormatSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_COMMENT_FORMAT' });
        const commentTemplate = commentFormatSetting?.value || config.DEFAULT_COMMENT_FORMAT;
        const commentText = fbClient.formatComment(targetLink, commentTemplate);
        const commentRes = await fbClient.publishComment(postId, page.accessToken, commentText, config.DRY_RUN);
        commentId = commentRes.commentId;
        console.log(`✓ [Reels API] Added news link as first comment to Reel post ${postId}!`);
      } catch (commentErr: any) {
        console.warn(`[Reels API] Could not post first comment on Reel:`, commentErr.message);
      }
    }

    const durationMs = Date.now() - startTime;

    // Record log
    await db.collection<ReelLog>('reel_logs').insertOne({
      _id: crypto.randomUUID(),
      articleId: finalArticleId || null,
      articleTitle: targetHeadline,
      pageId: page._id,
      pageName: page.name,
      theme: targetTheme,
      fbVideoId: videoId,
      fbPostId: postId,
      durationMs,
      status: config.DRY_RUN ? 'dry_run' : 'success',
      createdAt: new Date(),
    });

    res.json({
      success: true,
      videoId,
      postId,
      pageName: page.name,
      durationMs,
      headline: targetHeadline,
      durationSeconds,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/reels/logs', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const logs = await db
      .collection<ReelLog>('reel_logs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/reels/settings', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const autoReel = await db.collection<Setting>('settings').findOne({ _id: 'AUTO_POST_REELS' });
    const disablePoster = await db.collection<Setting>('settings').findOne({ _id: 'DISABLE_POSTER' });
    const postStories = await db.collection<Setting>('settings').findOne({ _id: 'POST_POSTER_TO_STORIES' });
    const reelDuration = await db.collection<Setting>('settings').findOne({ _id: 'REEL_DURATION_SECONDS' });
    const reelTheme = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_REEL_THEME' });

    res.json({
      autoPostReels: autoReel ? autoReel.value !== 'false' : true,
      disablePoster: disablePoster ? disablePoster.value !== 'false' : true, // Feed poster disabled, Reels-only active
      postPosterToStories: postStories ? postStories.value !== 'false' : true, // Stories poster enabled
      reelDuration: parseInt(reelDuration?.value || '15', 10) || 15, // Default 15 seconds
      reelTheme: reelTheme?.value || 'rolling', // Default to rolling round-robin rotation
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/reels/settings', async (req: Request, res: Response) => {
  try {
    const { autoPostReels, disablePoster, postPosterToStories, reelDuration, reelTheme } = req.body;
    const db = getDatabase();
    const settingsCol = db.collection<Setting>('settings');

    if (autoPostReels !== undefined) {
      await settingsCol.updateOne(
        { _id: 'AUTO_POST_REELS' },
        { $set: { value: Boolean(autoPostReels) ? 'true' : 'false', updatedAt: new Date() } },
        { upsert: true }
      );
    }
    if (disablePoster !== undefined) {
      await settingsCol.updateOne(
        { _id: 'DISABLE_POSTER' },
        { $set: { value: Boolean(disablePoster) ? 'true' : 'false', updatedAt: new Date() } },
        { upsert: true }
      );
    }
    if (postPosterToStories !== undefined) {
      await settingsCol.updateOne(
        { _id: 'POST_POSTER_TO_STORIES' },
        { $set: { value: Boolean(postPosterToStories) ? 'true' : 'false', updatedAt: new Date() } },
        { upsert: true }
      );
    }
    if (reelDuration !== undefined) {
      await settingsCol.updateOne(
        { _id: 'REEL_DURATION_SECONDS' },
        { $set: { value: String(reelDuration), updatedAt: new Date() } },
        { upsert: true }
      );
    }
    if (reelTheme !== undefined) {
      await settingsCol.updateOne(
        { _id: 'DEFAULT_REEL_THEME' },
        { $set: { value: String(reelTheme), updatedAt: new Date() } },
        { upsert: true }
      );
    }

    res.json({
      success: true,
      autoPostReels: autoPostReels !== undefined ? Boolean(autoPostReels) : true,
      disablePoster: disablePoster !== undefined ? Boolean(disablePoster) : true,
      postPosterToStories: postPosterToStories !== undefined ? Boolean(postPosterToStories) : true,
      reelDuration: reelDuration ? parseInt(String(reelDuration), 10) : 15,
      reelTheme: reelTheme || 'rolling',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// FACEBOOK STORIES API
// -------------------------------------------------------------
apiRouter.post('/stories/publish', async (req: Request, res: Response) => {
  try {
    const { articleId, headline, category, imageUrl, pageId } = req.body;
    const db = getDatabase();

    let targetHeadline = headline;
    let targetCategory = category || 'বিশেষ খবর';
    let targetImageUrl = imageUrl;
    let finalArticleId = articleId;

    if (articleId) {
      const art = await db.collection<NewsArticle>('news_articles').findOne({ _id: articleId });
      if (art) {
        targetHeadline = targetHeadline || art.title;
        targetCategory = targetCategory || art.category || 'বিশেষ খবর';
        targetImageUrl = targetImageUrl || art.imageUrl;
      }
    } else {
      const latestArt = await db.collection<NewsArticle>('news_articles').findOne({}, { sort: { pubDate: -1 } });
      if (latestArt) {
        targetHeadline = targetHeadline || latestArt.title;
        targetCategory = targetCategory || latestArt.category || 'বিশেষ খবর';
        targetImageUrl = targetImageUrl || latestArt.imageUrl;
        finalArticleId = latestArt._id;
      }
    }

    if (!targetHeadline) {
      res.status(400).json({ error: 'Headline is required to generate Story poster' });
      return;
    }

    let page: FacebookPage | null = null;
    if (pageId && pageId !== 'all') {
      page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: pageId });
    }
    if (!page) {
      page = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
    }
    if (!page) {
      res.status(400).json({ error: 'No active Facebook Page found' });
      return;
    }

    console.log(`[Stories API] Rendering 1080x1080 JPG poster card for "${targetHeadline}"...`);
    const startTime = Date.now();
    const renderResult = await canvasRenderer.render({
      templateId: 'template-canva-bdnews',
      headline: targetHeadline,
      category: targetCategory,
      imageUrl: targetImageUrl || undefined,
    });

    const fbClient = new FacebookGraphClient();
    console.log(`[Stories API] Publishing JPG Poster to Facebook Page Stories on ${page.name}...`);
    const { photoId, storyId } = await fbClient.publishPhotoStory(
      page._id,
      page.accessToken,
      renderResult.imageBuffer,
      config.DRY_RUN
    );

    const durationMs = Date.now() - startTime;

    await db.collection<StoryLog>('story_logs').insertOne({
      _id: crypto.randomUUID(),
      articleId: finalArticleId || null,
      articleTitle: targetHeadline,
      pageId: page._id,
      pageName: page.name,
      fbPhotoId: photoId,
      fbStoryId: storyId,
      renderedImagePath: renderResult.outputPath || null,
      durationMs,
      status: config.DRY_RUN ? 'dry_run' : 'success',
      createdAt: new Date(),
    });

    res.json({
      success: true,
      photoId,
      storyId,
      pageId: page._id,
      pageName: page.name,
      durationMs,
      headline: targetHeadline,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/stories/logs', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const logs = await db
      .collection<StoryLog>('story_logs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.json(logs);
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
            error_message: '$errorMessage',
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

    // Find the latest article that hasn't been published yet
    let article = await articlesCol.findOne({ status: { $ne: 'published' } }, { sort: { createdAt: -1 } });
    if (!article) {
      // If all are marked published, check if there are articles whose post_logs failed or have no fbPostId
      const failedLog = await db.collection<PostLog>('post_logs').findOne(
        { $or: [{ fbPostId: { $in: [null, ''] } }, { status: 'failed' }] },
        { sort: { createdAt: -1 } }
      );
      if (failedLog?.articleId) {
        article = await articlesCol.findOne({ _id: failedLog.articleId });
      }
    }
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
    const isSuccess = latestLog?.status === 'success' || latestLog?.status === 'dry_run';

    res.json({
      success: isSuccess,
      articleTitle: article.title,
      pageName: page.name,
      pageId: page._id,
      log: latestLog,
      error: !isSuccess ? (latestLog?.errorMessage || 'Facebook Reel failed to publish (no post ID generated)') : undefined,
    });
  } catch (err: any) {
    console.error('[PublishNext] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7c. Reset unposted articles whose logs falsely said success with empty fbPostId
apiRouter.post('/queue/reset-unposted', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    // Find all post_logs where fbPostId is null/empty and status is 'success'
    const unpostedLogs = await db.collection<PostLog>('post_logs').find({
      $and: [
        { status: 'success' },
        { $or: [{ fbPostId: null }, { fbPostId: '' }] },
      ],
    }).toArray();

    const articleIds = Array.from(new Set(unpostedLogs.map((l) => l.articleId).filter(Boolean)));

    if (unpostedLogs.length > 0) {
      await db.collection('post_logs').updateMany(
        { _id: { $in: unpostedLogs.map((l) => l._id) as any } },
        { $set: { status: 'failed', errorMessage: 'Reel was not uploaded to Facebook (empty post ID)' } }
      );
      await db.collection('reel_logs').updateMany(
        { fbPostId: { $in: [null, ''] }, status: 'success' },
        { $set: { status: 'failed', errorMessage: 'Reel was not uploaded to Facebook (empty post ID)' } }
      );
    }

    if (articleIds.length > 0) {
      await db.collection('news_articles').updateMany(
        { _id: { $in: articleIds as any } },
        { $set: { status: 'pending' } }
      );
    }

    res.json({
      success: true,
      message: `Reset ${articleIds.length} unposted articles back to pending queue`,
      count: articleIds.length,
    });
  } catch (err: any) {
    console.error('[ResetUnposted] Error:', err);
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
      DISABLE_POSTER: 'true',
      REEL_DURATION_SECONDS: '15',
      DEFAULT_REEL_THEME: 'studio-red',
      YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID || '',
      YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET ? '••••••••' : '',
      YOUTUBE_REFRESH_TOKEN: '',
      AUTO_POST_YOUTUBE: 'true',
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
// 3.9. YouTube Shorts Integration
// ==============================================================================
apiRouter.get('/youtube/status', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const isConfigured = await ytClient.initCredentials();
    const clientIdSetting = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' });
    const clientSecretSetting = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_SECRET' });
    const refreshTokenSetting = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_REFRESH_TOKEN' });
    const autoPostSetting = await db.collection<Setting>('settings').findOne({ _id: 'AUTO_POST_YOUTUBE' });

    let channel = null;
    let error = null;

    if (isConfigured) {
      try {
        channel = await ytClient.getChannelProfile();
      } catch (err: any) {
        error = err.message;
      }
    }

    res.json({
      success: true,
      isConfigured,
      autoPost: autoPostSetting ? autoPostSetting.value !== 'false' : true,
      clientId: clientIdSetting?.value || process.env.YOUTUBE_CLIENT_ID || '',
      hasClientSecret: Boolean(clientSecretSetting?.value || process.env.YOUTUBE_CLIENT_SECRET),
      hasRefreshToken: Boolean(refreshTokenSetting?.value || process.env.YOUTUBE_REFRESH_TOKEN),
      channel,
      error,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/youtube/setup', async (req: Request, res: Response) => {
  try {
    const { clientId, clientSecret, refreshToken, autoPost } = req.body;
    const db = getDatabase();
    const settingsCol = db.collection<Setting>('settings');

    if (clientId !== undefined && String(clientId).trim().length > 0) {
      await settingsCol.updateOne(
        { _id: 'YOUTUBE_CLIENT_ID' },
        { $set: { value: String(clientId).trim(), updatedAt: new Date() } },
        { upsert: true }
      );
    }
    if (clientSecret !== undefined && String(clientSecret).trim().length > 0) {
      await settingsCol.updateOne(
        { _id: 'YOUTUBE_CLIENT_SECRET' },
        { $set: { value: String(clientSecret).trim(), updatedAt: new Date() } },
        { upsert: true }
      );
    }
    if (refreshToken !== undefined && String(refreshToken).trim().length > 0) {
      await settingsCol.updateOne(
        { _id: 'YOUTUBE_REFRESH_TOKEN' },
        { $set: { value: String(refreshToken).trim(), updatedAt: new Date() } },
        { upsert: true }
      );
    }
    if (autoPost !== undefined) {
      await settingsCol.updateOne(
        { _id: 'AUTO_POST_YOUTUBE' },
        { $set: { value: String(autoPost), updatedAt: new Date() } },
        { upsert: true }
      );
    }

    await ytClient.initCredentials();

    let channel = null;
    let verifyError = null;
    if (ytClient.isConfigured()) {
      try {
        channel = await ytClient.getChannelProfile();
      } catch (err: any) {
        verifyError = err.message;
      }
    }

    res.json({
      success: true,
      isConfigured: ytClient.isConfigured(),
      channel,
      verifyError,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/youtube/upload', async (req: Request, res: Response) => {
  try {
    const { articleId } = req.body;
    const db = getDatabase();

    let targetArticleId = articleId;
    if (!targetArticleId) {
      const latestArt = await db.collection<NewsArticle>('news_articles').findOne({}, { sort: { pubDate: -1 } });
      if (!latestArt) {
        return res.status(404).json({ error: 'No article found to upload' });
      }
      targetArticleId = latestArt._id;
    }

    const result = await worker.uploadShortForArticle(targetArticleId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/youtube/logs', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const logs = await db
      .collection<YouTubeUploadLog>('youtube_upload_logs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/youtube/auth/url', async (req: Request, res: Response) => {
  const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = req.get('host');
  const redirectUri = `${protocol}://${host}/api/youtube/auth/callback`;
  const db = getDatabase();
  const sId = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' });
  const clientId = sId?.value || process.env.YOUTUBE_CLIENT_ID || '';
  const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  res.json({
    authUrl,
    redirectUri,
  });
});

apiRouter.get('/youtube/auth/callback', async (req: Request, res: Response) => {
  try {
    const errorParam = req.query.error as string;
    if (errorParam) {
      console.warn('[YouTube OAuth Callback] Google returned error:', errorParam);
      return res.redirect(`/?tab=youtube&auth_error=${encodeURIComponent(errorParam)}`);
    }

    const code = req.query.code as string;
    if (!code) {
      return res.redirect('/?tab=youtube&auth_error=missing_code');
    }

    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host');
    const redirectUri = `${protocol}://${host}/api/youtube/auth/callback`;

    await ytClient.initCredentials();
    await ytClient.exchangeCodeForTokens(code, redirectUri);

    res.redirect('/?tab=youtube&auth=success');
  } catch (err: any) {
    console.error('[YouTube OAuth Callback] Exchange error:', err.message);
    res.redirect(`/?tab=youtube&auth_error=${encodeURIComponent(err.message)}`);
  }
});

// Emergency System Process Restart
apiRouter.post('/system/restart', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Server process exiting to clear threads and recycle Passenger...' });
  setTimeout(() => {
    console.log('[System] Manual restart triggered via API. Exiting process with code 0...');
    if (!process.env.VERCEL) {
      process.exit(0);
    }
  }, 500);
});

