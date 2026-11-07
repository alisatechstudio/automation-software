import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { waitUntil } from '@vercel/functions';
import { getDatabase, isDbConnected, initDatabase } from '../../db/index.js';
import { FacebookPage, RssSource, Setting, NewsArticle, Job, PostLog, FacebookGroup, GroupShareLog, ReelLog, StoryLog, YouTubeUploadLog, GDriveReelConfig } from '../../db/schema.js';
import { PersistentJobQueue } from '../../services/queue/queue.js';
import { QueueWorker, getNextRollingReelTheme } from '../../services/queue/worker.js';
import { PlaywrightImageRenderer } from '../../services/renderer/playwright.js';
import { CanvasCardRenderer } from '../../services/renderer/canvas.js';
import { ReelVideoRenderer } from '../../services/renderer/reel.js';
import { FacebookTokenService } from '../../services/facebook/token.js';
import { FacebookGraphClient } from '../../services/facebook/client.js';
import { YouTubeClient } from '../../services/youtube/client.js';
import { ArticleDedupeService } from '../../services/rss/dedupe.js';
import { GDriveReelService } from '../../services/gdrive/service.js';
import { AVAILABLE_TEMPLATES, REEL_TEMPLATES, generateViralReelHashtags, generateViralShortsHashtags, generateTrendingNewsHashtags, isEnglishText } from '../../config/constants.js';
import { config } from '../../config/env.js';

export const apiRouter = Router();
const queue = new PersistentJobQueue();
const worker = new QueueWorker();
const renderer = new PlaywrightImageRenderer();
const canvasRenderer = new CanvasCardRenderer();
const reelRenderer = new ReelVideoRenderer();
const ytClient = new YouTubeClient();
const dedupeService = new ArticleDedupeService();
const gdriveReelService = new GDriveReelService();

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

apiRouter.get('/pages/:id/diagnose', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: req.params.id });
    if (!page) {
      res.status(404).json({ error: `Page ${req.params.id} not found in database` });
      return;
    }

    const token = page.accessToken;
    const tokenInfo = await FacebookTokenService.inspectToken(token);

    const pageCheckRes = await fetch(
      `https://graph.facebook.com/v21.0/${page._id}?fields=id,name,tasks,category&access_token=${encodeURIComponent(token)}`
    );
    const pageCheckData = (await pageCheckRes.json()) as any;

    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`
    );
    const meData = (await meRes.json()) as any;

    const isUserToken = tokenInfo.type?.toUpperCase() === 'USER';
    const isPageToken = tokenInfo.type?.toUpperCase() === 'PAGE';

    const requiredScopes = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'];
    const missingScopes = requiredScopes.filter((s) => !tokenInfo.scopes.includes(s));

    const tasks = pageCheckData.tasks || [];

    let diagnosis = 'Token is valid and has proper publishing permissions.';
    let canPost = true;

    if (!tokenInfo.isValid) {
      diagnosis = `❌ Token is INVALID or EXPIRED: ${tokenInfo.error || 'Unknown token error'}`;
      canPost = false;
    } else if (isUserToken) {
      diagnosis = `⚠️ ATTENTION: This is a USER token, NOT a Page Access Token! Facebook rejects video and photo posts when using a User Token. You must generate and enter a PAGE Access Token for "${page.name}".`;
      canPost = false;
    } else if (missingScopes.length > 0) {
      diagnosis = `⚠️ Missing required permissions in token: ${missingScopes.join(', ')}. Please re-generate token with these permissions.`;
      canPost = false;
    } else if (pageCheckData.error) {
      diagnosis = `⚠️ Meta Graph API error when inspecting page: ${pageCheckData.error.message} (code ${pageCheckData.error.code})`;
      canPost = false;
    }

    res.json({
      success: true,
      pageId: page._id,
      pageName: page.name,
      tokenType: tokenInfo.type,
      tokenSubject: meData.name ? `${meData.name} (${meData.id})` : 'Unknown',
      isPageToken,
      isUserToken,
      isValid: tokenInfo.isValid,
      expiresAt: tokenInfo.expiresAt,
      scopes: tokenInfo.scopes,
      missingScopes,
      tasks,
      canPost,
      diagnosis,
      pageApiCheck: pageCheckData,
    });
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
    const theme = (req.query.theme as string) || 'auto-category';
    const durationSeconds = parseInt(req.query.duration as string, 10) || 18;

    const videoBuffer = await reelRenderer.renderReel({
      headline,
      category,
      imageUrl,
      theme,
      durationSeconds,
      fps: 24,
    });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', videoBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(videoBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/reels/generate-hashtags', async (req: Request, res: Response) => {
  try {
    const { headline, category, userTags } = req.body;
    const db = getDatabase();
    const hashtagSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_HASHTAGS' });
    const configuredHashtags = userTags || hashtagSetting?.value || config.DEFAULT_HASHTAGS;
    const hashtags = generateViralReelHashtags({
      headline: headline || '',
      category: category || '',
      userTags: configuredHashtags,
    });
    res.json({ success: true, hashtags });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/reels/publish', async (req: Request, res: Response) => {
  try {
    const { articleId, headline, category, imageUrl, pageId, theme, duration, hashtags } = req.body;
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
    const durationSeconds = parseInt(duration as string, 10) || 18;

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
    
    // Caption: Intelligent viral hashtags optimized for Meta Reels discovery
    const customHashtags = (hashtags || '').trim();
    const hashtagSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_HASHTAGS' });
    const configuredHashtags = hashtagSetting?.value || config.DEFAULT_HASHTAGS;
    const caption = generateViralReelHashtags({
      category: targetCategory,
      headline: targetHeadline,
      userTags: customHashtags || configuredHashtags,
    });

    console.log(`[Reels API] Publishing ${durationSeconds}s Reel with viral hashtags: "${caption}"...`);
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
    let targetLink: string = (req.body.link || req.body.newsUrl || req.body.url || '').trim();
    if (!targetLink && finalArticleId) {
      const art = await db.collection<NewsArticle>('news_articles').findOne({ _id: finalArticleId });
      targetLink = art?.link || '';
    }
    if (!targetLink && targetHeadline) {
      const art = await db.collection<NewsArticle>('news_articles').findOne({ title: targetHeadline });
      if (art?.link) targetLink = art.link;
    }

    const commentTargetId = videoId || postId;
    if (targetLink && commentTargetId) {
      try {
        const commentFormatSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_COMMENT_FORMAT' });
        const commentTemplate = commentFormatSetting?.value || config.DEFAULT_COMMENT_FORMAT;
        const commentText = fbClient.formatComment(targetLink, commentTemplate);
        const commentRes = await fbClient.publishComment(commentTargetId, page.accessToken, commentText, config.DRY_RUN, postId);
        commentId = commentRes.commentId;
        console.log(`✓ [Reels API] Added news link as first comment to Reel (${commentTargetId})!`);
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
      reelDuration: parseInt(reelDuration?.value || '18', 10) || 18, // Default 18 seconds (15-20s range)
      reelTheme: reelTheme?.value || 'auto-category', // Default to auto-category matching
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
// GOOGLE DRIVE REELS MULTI-CHANNEL AUTOMATION API (CLOUD 24/7)
// -------------------------------------------------------------

// 1. Get all configured channels and global settings
apiRouter.get('/gdrive-reels/channels', async (req: Request, res: Response) => {
  try {
    const channels = await gdriveReelService.getAllChannels();
    const globalApiKey = await gdriveReelService.getGlobalApiKey();
    res.json({
      success: true,
      channels,
      globalApiKey,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Save Global Google Drive API Key
apiRouter.post('/gdrive-reels/global-api-key', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    const saved = await gdriveReelService.setGlobalApiKey(apiKey || '');
    res.json({ success: true, apiKey: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get single channel details and live scan
apiRouter.get('/gdrive-reels/channels/:id', async (req: Request, res: Response) => {
  try {
    const channel = await gdriveReelService.getChannel(req.params.id);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    const scan = await gdriveReelService.scanChannel(channel._id);
    res.json({ success: true, channel, scan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create or update a channel
apiRouter.post('/gdrive-reels/channels', async (req: Request, res: Response) => {
  try {
    const channelData = req.body;
    const savedChannel = await gdriveReelService.saveChannel(channelData);
    const scan = await gdriveReelService.scanChannel(savedChannel._id);
    res.json({ success: true, channel: savedChannel, scan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete a channel
apiRouter.delete('/gdrive-reels/channels/:id', async (req: Request, res: Response) => {
  try {
    const ok = await gdriveReelService.deleteChannel(req.params.id);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Scan a specific channel
apiRouter.post('/gdrive-reels/channels/:id/scan', async (req: Request, res: Response) => {
  try {
    const scan = await gdriveReelService.scanChannel(req.params.id);
    res.json({ success: true, scan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Publish next video for a specific channel
apiRouter.post('/gdrive-reels/channels/:id/publish-next', async (req: Request, res: Response) => {
  try {
    const result = await gdriveReelService.publishNextForChannel(req.params.id);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Publish specific file for a specific channel
apiRouter.post('/gdrive-reels/channels/:id/publish-file', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.body;
    if (!fileId) {
      res.status(400).json({ error: 'fileId is required' });
      return;
    }
    const result = await gdriveReelService.publishSpecificFileForChannel(req.params.id, fileId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Reset history for a specific channel
apiRouter.post('/gdrive-reels/channels/:id/reset-history', async (req: Request, res: Response) => {
  try {
    await gdriveReelService.resetHistoryForChannel(req.params.id);
    const scan = await gdriveReelService.scanChannel(req.params.id);
    res.json({ success: true, scan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Publish all due channels immediately
apiRouter.post('/gdrive-reels/publish-all-due', async (req: Request, res: Response) => {
  try {
    const summary = await gdriveReelService.publishAllDueChannels();
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Delete or trash specific file in Google Drive
apiRouter.delete('/gdrive-reels/files/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const result = await gdriveReelService.deleteDriveFile(fileId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Google Drive OAuth & Write Status
apiRouter.get('/gdrive-reels/auth/status', async (req: Request, res: Response) => {
  try {
    const globalApiKey = await gdriveReelService.getGlobalApiKey();
    const oauthToken = await gdriveReelService.getGoogleOAuthToken();
    res.json({
      success: true,
      hasApiKey: Boolean(globalApiKey),
      hasOAuth: Boolean(oauthToken),
      canDeleteFiles: Boolean(oauthToken),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Legacy / Single Channel Compatibility Endpoints ---
apiRouter.get('/gdrive-reels/status', async (req: Request, res: Response) => {
  try {
    const config = await gdriveReelService.getConfig();
    const scan = await gdriveReelService.scanChannel(config._id);
    res.json({ success: true, config, scan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/gdrive-reels/scan', async (req: Request, res: Response) => {
  try {
    const { folderUrlOrId, apiKey } = req.body;
    const scan = await gdriveReelService.scanFolderDirect(folderUrlOrId, apiKey);
    res.json({ success: true, scan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/gdrive-reels/config', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const updatedConfig = await gdriveReelService.saveConfig(updates);
    const scan = await gdriveReelService.scanChannel(updatedConfig._id);
    res.json({ success: true, config: updatedConfig, scan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/gdrive-reels/publish-next', async (req: Request, res: Response) => {
  try {
    const result = await gdriveReelService.publishNext();
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/gdrive-reels/publish-file', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.body;
    if (!fileId) {
      res.status(400).json({ error: 'fileId is required' });
      return;
    }
    const result = await gdriveReelService.publishSpecificFile(fileId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/gdrive-reels/reset-history', async (req: Request, res: Response) => {
  try {
    await gdriveReelService.resetPostedHistory();
    const config = await gdriveReelService.getConfig();
    const scan = await gdriveReelService.scanChannel(config._id);
    res.json({ success: true, config, scan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// EXTERNAL CRON / cron-job.org DISTINCT WEBHOOKS (/api/cron/*)
// -------------------------------------------------------------

/**
 * Validates the CRON_SECRET if one is defined in environment variables.
 * Allows authorization via:
 * - Authorization: Bearer <secret>
 * - x-cron-secret: <secret> header
 * - ?secret=<secret> or ?key=<secret> query parameter
 */
function verifyCronAuth(req: Request, res: Response): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === '') {
    return true; // No secret configured, allow open execution
  }

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1] === cronSecret) {
      return true;
    }
  }

  const customHeader = req.headers['x-cron-secret'];
  if (customHeader && customHeader === cronSecret) {
    return true;
  }

  const querySecret = (req.query.secret as string) || (req.query.key as string);
  if (querySecret && querySecret === cronSecret) {
    return true;
  }

  res.status(401).json({
    success: false,
    error: 'Unauthorized: Invalid or missing cron secret. Provide Authorization: Bearer <token>, x-cron-secret header, or ?secret=<token> query parameter.',
  });
  return false;
}

function safeWaitUntil(promise: Promise<any>): void {
  if (process.env.VERCEL) {
    try {
      waitUntil(promise);
    } catch {
      promise.catch(() => {});
    }
  }
}

// Handler: 1. RSS Ingestion
async function executeRssCron(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const targetPageId = (req.query.pageId as string) || (req.query.page as string);
    const results = await dedupeService.pollAllActiveSources(targetPageId);
    res.json({
      success: true,
      job: 'rss_poll',
      pageId: targetPageId || 'all',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      results,
    });
  } catch (err: any) {
    console.error('[RSS Cron] Error:', err);
    res.status(500).json({ success: false, job: 'rss_poll', error: err.message });
  }
}

// Handler: 2. Facebook Post/Reels Publishing
async function executePublishCron(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const db = getDatabase();
    const targetPageId = (req.query.pageId as string) || (req.query.page as string);
    let job = await queue.fetchNextJob(targetPageId);

    if (!job) {
      // If queue is empty, check for unposted articles for this specific page or active pages
      const articlesCol = db.collection<NewsArticle>('news_articles');
      const pagesCol = db.collection<FacebookPage>('facebook_pages');
      const jobsCol = db.collection<Job>('jobs');
      const sourcesCol = db.collection<RssSource>('rss_sources');

      let pageQuery: any = { isActive: true };
      if (targetPageId && targetPageId !== 'all') {
        pageQuery = { _id: targetPageId, isActive: true };
      }
      let page = await pagesCol.findOne(pageQuery);
      if (!page && targetPageId && targetPageId !== 'all') {
        page = await pagesCol.findOne({ _id: targetPageId });
      }

      if (page) {
        const pageSources = await sourcesCol.find({ pageId: page._id }).toArray();
        const sourceIds = pageSources.map(s => s._id);

        let articleQuery: any = { status: { $ne: 'published' } };
        if (sourceIds.length > 0) {
          articleQuery.sourceId = { $in: sourceIds };
        }
        let article = await articlesCol.findOne(articleQuery, { sort: { createdAt: -1 } });
        if (!article) {
          const failedLog = await db.collection<PostLog>('post_logs').findOne(
            {
              pageId: page._id,
              $or: [{ fbPostId: { $in: [null, ''] } }, { status: 'failed' }]
            },
            { sort: { createdAt: -1 } }
          );
          if (failedLog?.articleId) {
            article = await articlesCol.findOne({ _id: failedLog.articleId });
          }
        }

        if (article) {
          const matchedSource = pageSources.find(s => s._id === article?.sourceId);
          const templateId = matchedSource?.templateId || (isEnglishText(article.title) ? 'template-trendingnews-breaking' : 'template-canva-bdnews');
          const jobId = crypto.randomUUID();
          job = {
            _id: jobId,
            type: 'process_article',
            articleId: article._id,
            pageId: page._id,
            payload: {
              articleId: article._id,
              sourceId: article.sourceId,
              pageId: page._id,
              templateId,
            },
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            runAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await jobsCol.insertOne(job as any);
          console.log(`[Publish Cron] Created immediate job ${jobId} for article "${article.title}" on page "${page.name}"`);
        }
      }
    }

    if (!job) {
      res.json({
        success: true,
        job: 'facebook_publish',
        pageId: targetPageId || 'all',
        processed: false,
        durationMs: Date.now() - startTime,
        message: targetPageId ? `Queue is empty and all articles published for page ${targetPageId}.` : 'Queue is empty and all articles have been published.',
      });
      return;
    }

    console.log(`[Publish Cron] Executing job ${job._id} for page ${job.pageId}...`);
    const jobPromise = worker.processJob(job);

    if (req.query.async === 'true' && process.env.VERCEL) {
      safeWaitUntil(jobPromise);
      res.json({
        success: true,
        job: 'facebook_publish',
        async: true,
        jobId: job._id,
        pageId: job.pageId,
        durationMs: Date.now() - startTime,
        message: 'Job dispatched to background worker via Vercel waitUntil.',
      });
      return;
    }

    await jobPromise;
    const logsCol = db.collection<PostLog>('post_logs');
    const latestLog = await logsCol.findOne({ articleId: job.articleId }, { sort: { createdAt: -1 } });
    const isSuccess = latestLog?.status === 'success' || latestLog?.status === 'dry_run';

    res.json({
      success: isSuccess,
      job: 'facebook_publish',
      processed: true,
      jobId: job._id,
      pageId: job.pageId,
      log: latestLog,
      durationMs: Date.now() - startTime,
      error: !isSuccess ? (latestLog?.errorMessage || 'Reel or post failed to upload') : undefined,
    });
  } catch (err: any) {
    console.error('[Publish Cron] Error:', err);
    res.status(500).json({ success: false, job: 'facebook_publish', error: err.message });
  }
}

// Handler: 3. Google Drive Multi-Channel Reels
async function executeGdriveCron(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const pageId = (req.query.pageId as string) || (req.query.page as string);
    const channelId = (req.query.channelId as string) || (req.query.channel as string);
    const force = req.query.force !== 'false';

    const result = await gdriveReelService.publishAllDueChannels({
      force,
      channelId,
      pageId,
    });
    res.json({
      success: true,
      job: 'gdrive_reels',
      pageId: pageId || 'all',
      channelId: channelId || 'all',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      result,
    });
  } catch (err: any) {
    console.error('[GDrive Cron] Error:', err);
    res.status(500).json({ success: false, job: 'gdrive_reels', error: err.message });
  }
}

// Handler: 4. Facebook 24-Hour Stories
async function executeStoriesCron(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const db = getDatabase();
    const page = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
    if (!page) {
      res.status(400).json({ success: false, job: 'facebook_stories', error: 'No active Facebook Page found' });
      return;
    }

    const recentStoryLogs = await db
      .collection<StoryLog>('story_logs')
      .find({ status: { $in: ['success', 'dry_run'] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    const recentArticleIds = recentStoryLogs.map((s: StoryLog) => s.articleId).filter(Boolean);

    let targetArticle = await db.collection<NewsArticle>('news_articles').findOne(
      { _id: { $nin: recentArticleIds as string[] } },
      { sort: { pubDate: -1, createdAt: -1 } }
    );
    if (!targetArticle) {
      targetArticle = await db.collection<NewsArticle>('news_articles').findOne({}, { sort: { pubDate: -1, createdAt: -1 } });
    }

    if (!targetArticle) {
      res.json({
        success: true,
        job: 'facebook_stories',
        processed: false,
        durationMs: Date.now() - startTime,
        message: 'No articles available to generate Facebook Story.',
      });
      return;
    }

    console.log(`[Stories Cron] Rendering 1080x1080 card for "${targetArticle.title}"...`);
    const renderResult = await canvasRenderer.render({
      templateId: 'template-canva-bdnews',
      headline: targetArticle.title,
      category: targetArticle.category || 'বিশেষ খবর',
      imageUrl: targetArticle.imageUrl || undefined,
    });

    const fbClient = new FacebookGraphClient();
    console.log(`[Stories Cron] Publishing Photo Story to page "${page.name}"...`);
    const { photoId, storyId } = await fbClient.publishPhotoStory(
      page._id,
      page.accessToken,
      renderResult.imageBuffer,
      config.DRY_RUN
    );

    const durationMs = Date.now() - startTime;
    await db.collection<StoryLog>('story_logs').insertOne({
      _id: crypto.randomUUID(),
      articleId: targetArticle._id,
      articleTitle: targetArticle.title,
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
      job: 'facebook_stories',
      processed: true,
      headline: targetArticle.title,
      pageName: page.name,
      photoId,
      storyId,
      durationMs,
    });
  } catch (err: any) {
    console.error('[Stories Cron] Error:', err);
    res.status(500).json({ success: false, job: 'facebook_stories', error: err.message });
  }
}

// Handler: 5. YouTube Shorts Auto-Upload
async function executeYoutubeCron(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const db = getDatabase();
    await ytClient.initCredentials();
    if (!ytClient.isConfigured()) {
      res.json({
        success: false,
        job: 'youtube_shorts',
        configured: false,
        message: 'YouTube client credentials not configured or authenticated in Settings.',
      });
      return;
    }

    const autoSetting = await db.collection<Setting>('settings').findOne({ _id: 'AUTO_POST_YOUTUBE' });
    if (autoSetting?.value === 'false') {
      res.json({
        success: false,
        job: 'youtube_shorts',
        enabled: false,
        message: 'AUTO_POST_YOUTUBE is disabled in Settings.',
      });
      return;
    }

    const uploadedLogs = await db
      .collection<YouTubeUploadLog>('youtube_upload_logs')
      .find({ status: { $in: ['success', 'dry_run'] } })
      .toArray();
    const uploadedArticleIds = uploadedLogs.map((l: YouTubeUploadLog) => l.articleId).filter(Boolean);

    let targetArticle = await db.collection<NewsArticle>('news_articles').findOne(
      { _id: { $nin: uploadedArticleIds as string[] } },
      { sort: { pubDate: -1, createdAt: -1 } }
    );
    if (!targetArticle) {
      targetArticle = await db.collection<NewsArticle>('news_articles').findOne({}, { sort: { pubDate: -1, createdAt: -1 } });
    }

    if (!targetArticle) {
      res.json({
        success: true,
        job: 'youtube_shorts',
        processed: false,
        durationMs: Date.now() - startTime,
        message: 'No articles available to upload to YouTube.',
      });
      return;
    }

    console.log(`[YouTube Cron] Uploading short for article "${targetArticle.title}"...`);
    const result = await worker.uploadShortForArticle(targetArticle._id);

    res.json({
      success: result.success,
      job: 'youtube_shorts',
      processed: true,
      articleTitle: targetArticle.title,
      articleId: targetArticle._id,
      durationMs: Date.now() - startTime,
      result,
    });
  } catch (err: any) {
    console.error('[YouTube Cron] Error:', err);
    res.status(500).json({ success: false, job: 'youtube_shorts', error: err.message });
  }
}

// Handler: 6. Self-Healing Queue Maintenance & Reset
async function executeCleanupCron(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const db = getDatabase();
    // 1. Unstick jobs stuck in 'processing' status > 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const stuckRes = await db.collection<Job>('jobs').updateMany(
      {
        status: 'processing',
        updatedAt: { $lt: fifteenMinsAgo },
      },
      {
        $set: {
          status: 'pending',
          updatedAt: new Date(),
          lastError: 'Job execution timed out; reset to pending by self-healing cleanup cron',
        },
      }
    );

    // 2. Reset unposted articles whose logs falsely said success with empty fbPostId
    const unpostedLogs = await db.collection<PostLog>('post_logs').find({
      $and: [
        { status: 'success' },
        { $or: [{ fbPostId: null }, { fbPostId: '' }] },
      ],
    }).toArray();
    const articleIds = Array.from(new Set(unpostedLogs.map((l: PostLog) => l.articleId).filter(Boolean)));
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
      job: 'cleanup',
      durationMs: Date.now() - startTime,
      unlockedStuckJobs: stuckRes.modifiedCount,
      resetUnpostedArticles: articleIds.length,
      message: `Self-healing cleanup complete: unlocked ${stuckRes.modifiedCount} stuck jobs, reset ${articleIds.length} unposted articles`,
    });
  } catch (err: any) {
    console.error('[Cleanup Cron] Error:', err);
    res.status(500).json({ success: false, job: 'cleanup', error: err.message });
  }
}

// -------------------------------------------------------------
// DISTINCT CRON-JOB.ORG ENDPOINTS
// -------------------------------------------------------------

// 1. RSS Ingestion Endpoint
apiRouter.all(['/cron/rss', '/cron/poll', '/cron/ingest'], async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;
  await executeRssCron(req, res);
});

// 2. Facebook Post/Reels Publishing Endpoint
apiRouter.all(['/cron/publish', '/cron/queue', '/cron/post'], async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;
  await executePublishCron(req, res);
});

// 3. Google Drive Multi-Channel Reels Endpoint
apiRouter.all(['/cron/gdrive-reels', '/cron/gdrive', '/cron/drive'], async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;
  await executeGdriveCron(req, res);
});

// 4. Facebook Stories Endpoint
apiRouter.all(['/cron/stories', '/cron/story'], async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;
  await executeStoriesCron(req, res);
});

// 5. YouTube Shorts Endpoint
apiRouter.all(['/cron/youtube', '/cron/shorts'], async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;
  await executeYoutubeCron(req, res);
});

// 6. Queue Maintenance & Cleanup Endpoint
apiRouter.all(['/cron/cleanup', '/cron/maintain', '/cron/repair'], async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;
  await executeCleanupCron(req, res);
});

// 7. Unified Pipeline Endpoint (Polls RSS for page & immediately publishes)
apiRouter.all(['/cron/pipeline', '/cron/page-rss'], async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;
  const targetPageId = (req.query.pageId as string) || (req.query.page as string);
  try {
    await dedupeService.pollAllActiveSources(targetPageId);
  } catch (err: any) {
    console.warn('[Pipeline Cron] Note polling RSS:', err.message);
  }
  await executePublishCron(req, res);
});

// 8. Universal Gateway Endpoint (/api/cron)
apiRouter.all('/cron', async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;

  const jobParam = ((req.query.job as string) || '').toLowerCase().trim();
  if (jobParam === 'rss' || jobParam === 'poll' || jobParam === 'ingest') {
    return executeRssCron(req, res);
  }
  if (jobParam === 'publish' || jobParam === 'queue' || jobParam === 'post') {
    return executePublishCron(req, res);
  }
  if (jobParam === 'gdrive' || jobParam === 'gdrive-reels' || jobParam === 'drive') {
    return executeGdriveCron(req, res);
  }
  if (jobParam === 'pipeline' || jobParam === 'page-rss') {
    const targetPageId = (req.query.pageId as string) || (req.query.page as string);
    try {
      await dedupeService.pollAllActiveSources(targetPageId);
    } catch {}
    return executePublishCron(req, res);
  }
  if (jobParam === 'stories' || jobParam === 'story') {
    return executeStoriesCron(req, res);
  }
  if (jobParam === 'youtube' || jobParam === 'shorts') {
    return executeYoutubeCron(req, res);
  }
  if (jobParam === 'cleanup' || jobParam === 'maintain' || jobParam === 'repair') {
    return executeCleanupCron(req, res);
  }

  // If GET without a specific job, return full distinct cron catalog
  if (req.method === 'GET') {
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const cronSecret = process.env.CRON_SECRET;
    const secretSuffix = cronSecret ? `?secret=${encodeURIComponent(cronSecret)}` : '';
    const defs = await getDynamicWebhookDefinitions(baseUrl, secretSuffix);

    return res.json({
      status: 'active',
      name: 'Multi-Page Distinct Cron Webhooks (RSS & Google Drive)',
      timestamp: new Date().toISOString(),
      cronSecretConfigured: Boolean(cronSecret),
      authInstructions: cronSecret
        ? 'Pass "Authorization: Bearer <secret>" or "x-cron-secret: <secret>" header, or append "?secret=<secret>" to URLs.'
        : 'CRON_SECRET is not set in environment; webhooks are open for triggers.',
      endpoints: defs,
    });
  }

  // If POST without ?job=..., run backward-compatible safe pass
  const results: any = { timestamp: new Date().toISOString(), legacyPass: true };
  try {
    results.rss = await dedupeService.pollAllActiveSources();
  } catch (e: any) {
    results.rssError = e.message;
  }
  try {
    results.gdriveReels = await gdriveReelService.publishAllDueChannels();
  } catch (e: any) {
    results.gdriveError = e.message;
  }
  res.json({ success: true, ...results });
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
    const { templateId, headline, category, imageUrl, website } = req.body;
    const isEnglish = (templateId && templateId.includes('trendingnews')) || isEnglishText(headline) || isEnglishText(category);

    const sampleHeadline =
      headline ||
      (isEnglish
        ? 'White House Unveils Major Economic Overhaul as Senate Prepares for High-Stakes Vote'
        : '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি');

    const html = renderer.compileHtml({
      templateId: templateId || (isEnglish ? 'template-trendingnews-breaking' : 'template-canva-bdnews'),
      headline: sampleHeadline,
      category: category || (isEnglish ? 'US POLITICS' : 'বিশেষ খবর'),
      imageUrl: imageUrl || undefined,
      website: website || (isEnglish ? 'https://trendingnews.world' : 'https://bdnews.site'),
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
    const { templateId, headline, category, imageUrl, website } = req.body;
    const isEnglish = (templateId && templateId.includes('trendingnews')) || isEnglishText(headline) || isEnglishText(category);

    const sampleHeadline =
      headline ||
      (isEnglish
        ? 'White House Unveils Major Economic Overhaul as Senate Prepares for High-Stakes Vote'
        : '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি');

    // Instant Skia Canvas 1080x1080 JPG card rendering (40ms)
    const buffer = await canvasRenderer.renderCard({
      templateId: templateId || (isEnglish ? 'template-trendingnews-breaking' : 'template-canva-bdnews'),
      headline: sampleHeadline,
      category: category || (isEnglish ? 'US POLITICS' : 'বিশেষ খবর'),
      imageUrl: imageUrl || undefined,
      website: website || (isEnglish ? 'https://trendingnews.world' : 'https://bdnews.site'),
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

    const articleIds = Array.from(new Set(unpostedLogs.map((l: PostLog) => l.articleId).filter(Boolean)));

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
      REEL_DURATION_SECONDS: '18',
      DEFAULT_REEL_THEME: 'auto-category',
      YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID || '',
      YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET ? '••••••••' : '',
      YOUTUBE_REFRESH_TOKEN: '',
      AUTO_POST_YOUTUBE: 'true',
      CRONJOB_API_KEY: config.CRONJOB_API_KEY || process.env.CRONJOB_API_KEY || '',
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
// 8.1. cron-job.org Management API (Full CRUD, Sync & Manual Runner)
// ==============================================================================

async function getCronJobApiKey(): Promise<string> {
  try {
    if (isDbConnected()) {
      const db = getDatabase();
      const setting = await db.collection<Setting>('settings').findOne({ _id: 'CRONJOB_API_KEY' });
      if (setting && setting.value && setting.value.trim().length > 0) {
        return setting.value.trim();
      }
    }
  } catch {
    // fallback
  }
  return (config.CRONJOB_API_KEY || process.env.CRONJOB_API_KEY || '').trim();
}

async function callCronJobApi(path: string, options: { method?: string; body?: any; apiKey?: string } = {}) {
  const apiKey = options.apiKey || (await getCronJobApiKey());
  if (!apiKey) {
    throw new Error('cron-job.org API Key is not configured. Please save your API key in Settings.');
  }
  const url = `https://api.cron-job.org${path}`;
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };
  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }
  const response = await fetch(url, fetchOptions);
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `cron-job.org API error (HTTP ${response.status})`;
    const error: any = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function callCronJobApiWithRetry(
  path: string,
  options: { method?: string; body?: any; apiKey?: string } = {},
  retries = 3
): Promise<any> {
  try {
    return await callCronJobApi(path, options);
  } catch (err: any) {
    if ((err.status === 429 || String(err.message).includes('429')) && retries > 0) {
      console.warn(`[cron-job.org] Rate limit (429) on ${path}. Waiting 1500ms before retry (${retries} left)...`);
      await new Promise((r) => setTimeout(r, 1500));
      return callCronJobApiWithRetry(path, options, retries - 1);
    }
    throw err;
  }
}

function parseCronJobSchedule(preset: string, timezone: string = 'Asia/Dhaka', customMinutes?: number[], customHours?: number[]) {
  const schedule: any = {
    timezone: timezone || 'Asia/Dhaka',
    hours: [-1],
    mdays: [-1],
    minutes: [0],
    months: [-1],
    wdays: [-1],
  };

  switch (preset) {
    case '5m':
      schedule.minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
      break;
    case '10m':
      schedule.minutes = [0, 10, 20, 30, 40, 50];
      break;
    case '15m':
      schedule.minutes = [0, 15, 30, 45];
      break;
    case '30m':
      schedule.minutes = [0, 30];
      break;
    case '1h':
      schedule.minutes = [0];
      break;
    case '1h_15':
      schedule.minutes = [15];
      break;
    case '2h':
      schedule.hours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
      schedule.minutes = [0];
      break;
    case '6h':
      schedule.hours = [0, 6, 12, 18];
      schedule.minutes = customMinutes && customMinutes.length > 0 ? customMinutes : [45];
      break;
    case '12h':
      schedule.hours = [0, 12];
      schedule.minutes = [0];
      break;
    case '24h':
      schedule.hours = [0];
      schedule.minutes = [0];
      break;
    case 'custom':
      if (Array.isArray(customHours) && customHours.length > 0) {
        schedule.hours = customHours;
      }
      if (Array.isArray(customMinutes) && customMinutes.length > 0) {
        schedule.minutes = customMinutes;
      }
      break;
    default:
      if (Array.isArray(customMinutes) && customMinutes.length > 0) {
        schedule.minutes = customMinutes;
      } else {
        schedule.minutes = [0, 10, 20, 30, 40, 50];
      }
      break;
  }
  return schedule;
}

// 8.1.1. List all cron jobs
apiRouter.get('/cron-jobs', async (req: Request, res: Response) => {
  try {
    const apiKey = await getCronJobApiKey();
    if (!apiKey) {
      res.json({
        success: false,
        apiKeyConfigured: false,
        error: 'cron-job.org API Key is not configured. Please set CRONJOB_API_KEY in Settings.',
        jobs: [],
      });
      return;
    }

    const data = await callCronJobApi('/jobs');
    res.json({
      success: true,
      apiKeyConfigured: true,
      jobs: data.jobs || [],
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      apiKeyConfigured: true,
      error: err.message,
    });
  }
});

interface WebhookDefinition {
  slug: string;
  title: string;
  path: string;
  fullUrl: string;
  preset: string;
  method: number;
  desc: string;
  pageId?: string;
  pageName?: string;
  channelId?: string;
  type: 'rss' | 'publish' | 'gdrive' | 'system';
  customMinutes?: number[];
}

async function getDynamicWebhookDefinitions(baseUrl: string, secretSuffix: string): Promise<WebhookDefinition[]> {
  let allPages: FacebookPage[] = [];
  let allSources: RssSource[] = [];
  let allGdriveChannels: GDriveReelConfig[] = [];

  try {
    if (!isDbConnected()) {
      await initDatabase().catch(() => null);
    }
    if (isDbConnected()) {
      const db = getDatabase();
      const pagesCol = db.collection<FacebookPage>('facebook_pages');
      const sourcesCol = db.collection<RssSource>('rss_sources');
      const gdriveCol = db.collection<GDriveReelConfig>('gdrive_reel_configs');

      allPages = await pagesCol.find({ isActive: { $ne: false } }).toArray();
      allSources = await sourcesCol.find({ isActive: { $ne: false } }).toArray();
      allGdriveChannels = await gdriveCol.find({}).toArray();
    }
  } catch (err: any) {
    console.warn('[API] Could not query database for dynamic webhook definitions, using fallback:', err.message);
  }

  // Fallbacks if database is initializing or empty
  if (allPages.length === 0) {
    allPages = [
      { _id: '1526917347161119', name: 'Trending News World', isActive: true } as any,
      { _id: '1405135646008133', name: 'BD News 24/7- বিডি নিউজ ২৪/৭', isActive: true } as any,
      { _id: '1268359636369219', name: 'Alisa Tech Studio', isActive: true } as any,
      { _id: '1302276172975819', name: 'হক কথা', isActive: true } as any,
    ];
  }
  if (allGdriveChannels.length === 0) {
    allGdriveChannels = [
      {
        _id: 'default_gdrive_reels',
        name: 'হক কথা',
        pageId: '1302276172975819',
        pageName: 'হক কথা',
        folderUrlOrId: 'dummy',
        isActive: true,
        scheduleIntervalHours: 1,
      } as any,
      {
        _id: 'gdrive_ch_53ba65aa',
        name: 'Alisa Tech Studio',
        pageId: '1268359636369219',
        pageName: 'Alisa Tech Studio',
        folderUrlOrId: 'dummy',
        isActive: true,
        scheduleIntervalHours: 1,
      } as any,
    ];
  }

  const activeGdrive = allGdriveChannels.filter((c) => c.isActive !== false && (c.folderUrlOrId || c.folderId));

  const defs: WebhookDefinition[] = [];

  const buildUrl = (path: string) => {
    if (!secretSuffix) return `${baseUrl}${path}`;
    const separator = path.includes('?') ? '&' : '?';
    return `${baseUrl}${path}${secretSuffix.replace('?', separator)}`;
  };

  // 1. Global RSS Poller (Ingests & queues articles)
  defs.push({
    slug: 'rss',
    title: '1. RSS Ingestion (All Feeds)',
    path: '/api/cron/rss',
    fullUrl: buildUrl('/api/cron/rss'),
    preset: '10m',
    method: 0,
    desc: 'Polls all active Bangla & English RSS feeds and queues new articles',
    type: 'rss',
  });

  // 2. Identify RSS Pages vs Google Drive Pages
  const gdrivePageIds = new Set(allGdriveChannels.map((c) => c.pageId).filter(Boolean));
  const rssPageIds = new Set(allSources.map((s) => s.pageId).filter(Boolean));

  // Determine RSS target pages: pages explicitly mapped to RSS feeds, or active pages not dedicated to Drive
  const rssTargetPages = allPages.filter((p) => rssPageIds.has(p._id) || !gdrivePageIds.has(p._id));

  if (rssTargetPages.length > 0) {
    for (const page of rssTargetPages) {
      defs.push({
        slug: `publish_${page._id}`,
        title: `2. FB Publisher - ${page.name}`,
        path: `/api/cron/publish?pageId=${page._id}`,
        fullUrl: buildUrl(`/api/cron/publish?pageId=${page._id}`),
        preset: '15m',
        method: 0,
        desc: `Dispatches queued articles & renders cards/reels specifically for ${page.name}`,
        pageId: page._id,
        pageName: page.name,
        type: 'publish',
      });
    }
  } else {
    defs.push({
      slug: 'publish',
      title: '2. Facebook Publisher (Global Queue)',
      path: '/api/cron/publish',
      fullUrl: buildUrl('/api/cron/publish'),
      preset: '15m',
      method: 0,
      desc: 'Dispatches next pending queued job to active Facebook pages',
      type: 'publish',
    });
  }

  // 3. For each active Google Drive Channel / Page (Dedicated distinct cron per Drive page)
  if (activeGdrive.length > 0) {
    for (const channel of activeGdrive) {
      const matchedPage = allPages.find((p) => p._id === channel.pageId);
      const pageLabel = matchedPage?.name || channel.pageName || channel.name || 'Drive Page';
      const path = channel.pageId
        ? `/api/cron/gdrive-reels?channelId=${channel._id}&pageId=${channel.pageId}`
        : `/api/cron/gdrive-reels?channelId=${channel._id}`;

      defs.push({
        slug: `gdrive_${channel._id}`,
        title: `3. GDrive Reels - ${pageLabel}`,
        path,
        fullUrl: buildUrl(path),
        preset: channel.scheduleIntervalHours === 1 ? '1h' : '30m',
        method: 0,
        desc: `Downloads scheduled video from Google Drive and posts with viral hashtags to ${pageLabel}`,
        pageId: channel.pageId,
        pageName: pageLabel,
        channelId: channel._id,
        type: 'gdrive',
      });
    }
  } else {
    defs.push({
      slug: 'gdrive',
      title: '3. Google Drive Reels (All Due)',
      path: '/api/cron/gdrive-reels',
      fullUrl: buildUrl('/api/cron/gdrive-reels'),
      preset: '30m',
      method: 0,
      desc: 'Scans Google Drive channels and publishes video reels to Facebook',
      type: 'gdrive',
    });
  }

  // 4. Stories, YouTube Shorts, & System Maintenance
  defs.push({
    slug: 'stories',
    title: '4. Facebook Stories',
    path: '/api/cron/stories',
    fullUrl: buildUrl('/api/cron/stories'),
    preset: '1h',
    method: 0,
    desc: 'Uploads 1080x1080 visual poster to Facebook Page Stories',
    type: 'system',
  });

  defs.push({
    slug: 'youtube',
    title: '5. YouTube Shorts',
    path: '/api/cron/youtube',
    fullUrl: buildUrl('/api/cron/youtube'),
    preset: '1h_15',
    customMinutes: [15],
    method: 0,
    desc: 'Auto-uploads vertical news reels to YouTube Shorts',
    type: 'system',
  });

  defs.push({
    slug: 'cleanup',
    title: '6. Self Cleaning Maintenance',
    path: '/api/cron/cleanup',
    fullUrl: buildUrl('/api/cron/cleanup'),
    preset: '6h',
    customMinutes: [45],
    method: 0,
    desc: 'Self-healing queue repair and maintenance',
    type: 'system',
  });

  return defs;
}

// 8.1.1b. Get Dynamic Distinct Webhook Endpoints
apiRouter.get('/cron-jobs/system-webhooks', async (req: Request, res: Response) => {
  try {
    const rawBaseUrl = (req.query.baseUrl as string) || `${req.protocol}://${req.get('host')}`;
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const cronSecret = process.env.CRON_SECRET;
    const secretSuffix = cronSecret ? `?secret=${encodeURIComponent(cronSecret)}` : '';
    const defs = await getDynamicWebhookDefinitions(baseUrl, secretSuffix);
    res.json({
      success: true,
      baseUrl,
      cronSecretConfigured: Boolean(cronSecret),
      endpoints: defs,
      webhooks: defs,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.1.1c. One-Click Setup / Sync All Distinct Webhooks to cron-job.org
apiRouter.post('/cron-jobs/sync-all', async (req: Request, res: Response) => {
  try {
    const rawBaseUrl = req.body.baseUrl || `${req.protocol}://${req.get('host')}`;
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const cronSecret = process.env.CRON_SECRET;
    const secretSuffix = cronSecret ? `?secret=${encodeURIComponent(cronSecret)}` : '';

    const webhookDefs = await getDynamicWebhookDefinitions(baseUrl, secretSuffix);

    // Fetch existing jobs from cron-job.org with retry
    const existing = await callCronJobApiWithRetry('/jobs');
    const existingJobs: any[] = existing.jobs || [];

    const results: any[] = [];
    const matchedJobIds = new Set<number>();

    for (const def of webhookDefs) {
      const fullUrl = def.fullUrl;

      // Intelligent match by pageId, channelId, slug, title, or exact path
      const matched = existingJobs.find((j: any) => {
        if (matchedJobIds.has(j.jobId)) return false;
        const jUrl = j.url || '';
        const jTitle = (j.title || '').toLowerCase();
        const defTitle = def.title.toLowerCase();

        // 1. Exact match by pageId query param
        if (def.pageId && jUrl.includes(`pageId=${def.pageId}`)) return true;
        // 2. Exact match by channelId query param
        if (def.channelId && jUrl.includes(`channelId=${def.channelId}`)) return true;
        // 3. Exact path match
        if (jUrl.includes(def.path)) return true;
        // 4. Exact title match
        if (jTitle === defTitle) return true;
        // 5. Page name in title match
        if (def.pageName && jTitle.includes(def.pageName.toLowerCase())) return true;
        // 6. Old generic publish job fallback for first unmapped publisher def
        if (def.type === 'publish' && (jTitle.includes('facebook publisher') || jUrl.endsWith('/api/cron/'))) return true;
        // 7. Special fallback for RSS poller
        if (def.slug === 'rss' && (jTitle.includes('rss ingestion') || jUrl.includes('/api/cron/rss'))) return true;
        // 8. Special fallback for GDrive global
        if (def.slug === 'gdrive' && (jTitle.includes('google drive') || jUrl.includes('/api/cron/gdrive-reels'))) return true;

        return false;
      });

      // 650ms delay between API calls to respect cron-job.org rate limits
      await new Promise((r) => setTimeout(r, 650));

      const schedule = parseCronJobSchedule(def.preset, 'Asia/Dhaka', def.customMinutes);

      if (matched) {
        matchedJobIds.add(matched.jobId);
        await callCronJobApiWithRetry(`/jobs/${matched.jobId}`, {
          method: 'PATCH',
          body: {
            job: {
              title: def.title,
              url: fullUrl,
              enabled: true,
              schedule,
              requestMethod: def.method,
            },
          },
        });
        results.push({
          action: 'updated',
          jobId: matched.jobId,
          title: def.title,
          url: fullUrl,
        });
      } else {
        const created = await callCronJobApiWithRetry('/jobs', {
          method: 'PUT',
          body: {
            job: {
              title: def.title,
              url: fullUrl,
              enabled: true,
              saveResponses: true,
              schedule,
              requestMethod: def.method,
            },
          },
        });
        if (created?.jobId) {
          matchedJobIds.add(created.jobId);
        }
        results.push({
          action: 'created',
          jobId: created.jobId,
          title: def.title,
          url: fullUrl,
        });
      }
    }

    res.json({
      success: true,
      baseUrl,
      results,
      message: `Successfully synchronized ${results.length} distinct webhooks on cron-job.org for all configured pages`,
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
    });
  }
});

// 8.1.2. Get specific cron job details
apiRouter.get('/cron-jobs/:id', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const data = await callCronJobApi(`/jobs/${jobId}`);
    res.json({
      success: true,
      job: data.jobDetails,
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
    });
  }
});

// 8.1.3. Create new cron job
apiRouter.post('/cron-jobs', async (req: Request, res: Response) => {
  try {
    const { title, url, enabled, schedule, preset, timezone, requestMethod, saveResponses, customMinutes, customHours } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ success: false, error: 'Job title is required' });
      return;
    }
    if (!url || !url.trim() || !url.startsWith('http')) {
      res.status(400).json({ success: false, error: 'A valid http/https URL is required' });
      return;
    }

    const finalSchedule = schedule && typeof schedule === 'object' && schedule.timezone
      ? schedule
      : parseCronJobSchedule(preset || '10m', timezone || 'Asia/Dhaka', customMinutes, customHours);

    const jobPayload: any = {
      title: title.trim(),
      url: url.trim(),
      enabled: enabled !== false,
      saveResponses: saveResponses !== false,
      schedule: finalSchedule,
      requestMethod: typeof requestMethod === 'number' ? requestMethod : 0,
    };

    const data = await callCronJobApi('/jobs', {
      method: 'PUT',
      body: { job: jobPayload },
    });

    res.json({
      success: true,
      jobId: data.jobId,
      message: 'Cron job created successfully',
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
    });
  }
});

// 8.1.4. Update existing cron job
apiRouter.patch('/cron-jobs/:id', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const { title, url, enabled, schedule, preset, timezone, requestMethod, saveResponses, customMinutes, customHours } = req.body;

    const jobUpdate: any = {};
    if (title !== undefined) jobUpdate.title = title.trim();
    if (url !== undefined) jobUpdate.url = url.trim();
    if (enabled !== undefined) jobUpdate.enabled = Boolean(enabled);
    if (saveResponses !== undefined) jobUpdate.saveResponses = Boolean(saveResponses);
    if (requestMethod !== undefined) jobUpdate.requestMethod = Number(requestMethod);

    if (schedule && typeof schedule === 'object' && schedule.timezone) {
      jobUpdate.schedule = schedule;
    } else if (preset) {
      jobUpdate.schedule = parseCronJobSchedule(preset, timezone || 'Asia/Dhaka', customMinutes, customHours);
    } else if (timezone) {
      jobUpdate.schedule = { timezone };
    }

    await callCronJobApi(`/jobs/${jobId}`, {
      method: 'PATCH',
      body: { job: jobUpdate },
    });

    res.json({
      success: true,
      message: 'Cron job updated successfully',
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
    });
  }
});

// 8.1.5. Toggle enabled / disabled status
apiRouter.post('/cron-jobs/:id/toggle', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    let targetEnabled = req.body.enabled;

    if (typeof targetEnabled !== 'boolean') {
      const details = await callCronJobApi(`/jobs/${jobId}`);
      targetEnabled = !details.jobDetails?.enabled;
    }

    await callCronJobApi(`/jobs/${jobId}`, {
      method: 'PATCH',
      body: { job: { enabled: targetEnabled } },
    });

    res.json({
      success: true,
      enabled: targetEnabled,
      message: `Cron job ${targetEnabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
    });
  }
});

// 8.1.6. Delete cron job
apiRouter.delete('/cron-jobs/:id', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    await callCronJobApi(`/jobs/${jobId}`, {
      method: 'DELETE',
    });

    res.json({
      success: true,
      message: 'Cron job deleted successfully',
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
    });
  }
});

// 8.1.7. Manual Trigger / Run Now
apiRouter.post('/cron-jobs/:id/run', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const jobId = req.params.id;
    let targetUrl = req.body.url;
    let targetMethod = req.body.method;

    if (!targetUrl) {
      const details = await callCronJobApi(`/jobs/${jobId}`);
      targetUrl = details.jobDetails?.url;
      if (targetMethod === undefined) {
        targetMethod = details.jobDetails?.requestMethod === 1 ? 'POST' : 'GET';
      }
    }

    if (!targetUrl) {
      res.status(400).json({ success: false, error: 'Job URL not found' });
      return;
    }

    const cronSecret = process.env.CRON_SECRET;
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'cron-job.org-manual-runner/1.0',
    };
    if (cronSecret) {
      fetchHeaders['Authorization'] = `Bearer ${cronSecret}`;
      fetchHeaders['x-cron-secret'] = cronSecret;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const runRes = await fetch(targetUrl, {
      method: targetMethod || 'GET',
      headers: fetchHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const duration = Date.now() - startTime;
    const text = await runRes.text();
    let parsedBody: any = null;
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text.slice(0, 300);
    }

    res.json({
      success: runRes.ok,
      httpStatus: runRes.status,
      statusText: runRes.statusText,
      durationMs: duration,
      response: parsedBody,
    });
  } catch (err: any) {
    const duration = Date.now() - startTime;
    res.json({
      success: false,
      httpStatus: 0,
      statusText: err.name === 'AbortError' ? 'Timeout (45s)' : 'Error',
      durationMs: duration,
      error: err.message,
    });
  }
});

// 8.1.8. Execution History / Logs
apiRouter.get('/cron-jobs/:id/history', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const data = await callCronJobApi(`/jobs/${jobId}/history`);
    res.json({
      success: true,
      history: data.history || [],
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
    });
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

apiRouter.get(['/youtube/auth/url', '/gdrive-reels/auth/url'], async (req: Request, res: Response) => {
  const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = req.get('host');
  const redirectUri = `${protocol}://${host}/api/youtube/auth/callback`;
  const db = getDatabase();
  const sId = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' });
  const clientId = sId?.value || process.env.YOUTUBE_CLIENT_ID || '';
  const originParam = (req.query.origin as string) || (req.path.includes('gdrive') ? 'gdrive' : 'youtube');
  const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/drive');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${originParam}`;

  res.json({
    authUrl,
    redirectUri,
  });
});

apiRouter.get('/youtube/auth/callback', async (req: Request, res: Response) => {
  const stateParam = (req.query.state as string) || 'youtube';
  const targetTab = stateParam === 'gdrive' ? 'gdrive-reels' : 'youtube';

  try {
    const errorParam = req.query.error as string;
    if (errorParam) {
      console.warn('[Google OAuth Callback] Google returned error:', errorParam);
      return res.redirect(`/?tab=${targetTab}&auth_error=${encodeURIComponent(errorParam)}`);
    }

    const code = req.query.code as string;
    if (!code) {
      return res.redirect(`/?tab=${targetTab}&auth_error=missing_code`);
    }

    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host');
    const redirectUri = `${protocol}://${host}/api/youtube/auth/callback`;

    await ytClient.initCredentials();
    await ytClient.exchangeCodeForTokens(code, redirectUri);

    res.redirect(`/?tab=${targetTab}&auth=success`);
  } catch (err: any) {
    console.error('[Google OAuth Callback] Exchange error:', err.message);
    res.redirect(`/?tab=${targetTab}&auth_error=${encodeURIComponent(err.message)}`);
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

