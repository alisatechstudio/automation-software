import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { waitUntil } from '@vercel/functions';
import { getDatabase, isDbConnected, initDatabase } from '../../db/index.js';
import { getAllDbSettings, setManyDbSettings, getDbSetting, setDbSetting } from '../../services/settings.js';
import { FacebookPage, RssSource, Setting, NewsArticle, Job, PostLog, FacebookGroup, GroupShareLog, ReelLog, StoryLog, YouTubeUploadLog, YouTubeChannel, GDriveReelConfig } from '../../db/schema.js';
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
import { InputPipelineService } from '../../services/pipeline/input-pipeline.js';
import { TikTokClient } from '../../services/tiktok/client.js';
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
const inputPipeline = new InputPipelineService();
const tikTokClient = new TikTokClient();

// 1. Dashboard Overview Stats
apiRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const queueStats = await queue.getStats();

    const articlesCount = await db.collection('news_articles').countDocuments();
    const reelsInDrive = await db.collection('news_articles').countDocuments({
      status: 'uploaded_to_drive',
    });
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
      reelsInDrive,
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
    const rawSources = await db.collection<RssSource>('rss_sources').find({}).toArray();
    const pages = await db.collection<FacebookPage>('facebook_pages').find({}).toArray();
    const pageMap = new Map(pages.map((p) => [p._id, p.name]));

    const sources = rawSources.map((s: any) => ({
      id: s._id,
      name: s.name,
      url: s.url,
      page_id: s.pageId || s.page_id,
      template_id: s.templateId || s.template_id,
      gdrive_folder_url: s.gdriveFolderUrlOrId || s.gdrive_folder_url || s.gdriveFolderId || '',
      gdrive_folder_id: s.gdriveFolderId || s.gdrive_folder_id || '',
      reel_theme: s.reelTheme || s.reel_theme || 'auto-category',
      reel_duration: s.reelDuration || s.reel_duration || 18,
      is_active: s.isActive !== undefined ? s.isActive : (s.is_active ?? true),
      created_at: s.createdAt || s.created_at || new Date(),
      page_name: pageMap.get(s.pageId || s.page_id) || 'Unknown Page',
    }));

    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sources', async (req: Request, res: Response) => {
  const { name, url, page_id, template_id, is_active, gdrive_folder_url, reel_theme, reel_duration } = req.body;
  if (!name || !url || !page_id) {
    res.status(400).json({ error: 'Name, URL, and Facebook Page are required' });
    return;
  }

  const db = getDatabase();
  const id = crypto.randomUUID();
  const folderUrlOrId = (gdrive_folder_url || req.body.gdriveFolderUrlOrId || '').trim();
  const folderId = gdriveReelService.extractFolderId(folderUrlOrId);

  try {
    const doc: RssSource = {
      _id: id,
      name: name.trim(),
      url: url.trim(),
      pageId: page_id,
      templateId: template_id || 'template-square-breaking',
      gdriveFolderUrlOrId: folderUrlOrId,
      gdriveFolderId: folderId,
      reelTheme: reel_theme || req.body.reelTheme || 'auto-category',
      reelDuration: parseInt(reel_duration || req.body.reelDuration || '18', 10) || 18,
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

    const isEnglish =
      (page._id === '1526917347161119') ||
      Boolean(page.name && page.name.includes('Trending')) ||
      isEnglishText(targetHeadline) ||
      isEnglishText(targetCategory);

    let effectiveCategory = targetCategory;
    if (isEnglish) {
      if (!effectiveCategory || effectiveCategory === 'সাধারণ' || !isEnglishText(effectiveCategory)) {
        effectiveCategory = 'BREAKING NEWS';
      } else {
        effectiveCategory = effectiveCategory.toUpperCase();
      }
    } else {
      if (!effectiveCategory) {
        effectiveCategory = 'বিশেষ খবর';
      }
    }
    const effectiveWebsite = isEnglish ? 'https://trendingnews.world' : 'https://bdnews.site';

    console.log(`[Reels API] Rendering ${durationSeconds}s MP4 Reel (${targetTheme}) for "${targetHeadline}"...`);
    const startTime = Date.now();
    const reelBuffer = await reelRenderer.renderReel({
      headline: targetHeadline,
      category: effectiveCategory,
      imageUrl: targetImageUrl || undefined,
      theme: targetTheme,
      durationSeconds,
      fps: 24,
      website: effectiveWebsite,
      isEnglish: isEnglish,
      pageName: page.name,
      pageId: page._id,
    });

    const fbClient = new FacebookGraphClient();
    
    // Caption: Intelligent viral hashtags optimized for Meta Reels discovery
    const customHashtags = (hashtags || '').trim();
    const hashtagSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_HASHTAGS' });
    const configuredHashtags = hashtagSetting?.value || config.DEFAULT_HASHTAGS;
    const caption = isEnglish
      ? generateTrendingNewsHashtags({
          category: effectiveCategory,
          headline: targetHeadline,
          userTags: customHashtags || configuredHashtags,
        })
      : generateViralReelHashtags({
          category: effectiveCategory,
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

// 3b. Stream or preview a video file (Google Drive redirect or local file streaming)
apiRouter.get('/gdrive-reels/files/:fileId/preview', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const folderId = (req.query.folderId as string) || '';

    if (fileId.startsWith('local_')) {
      const rawName = fileId.replace(/^local_/, '');
      const candidatePaths = [
        folderId ? path.join(config.DATA_DIR, 'gdrive_folders', folderId, rawName) : '',
        path.join(config.DATA_DIR, 'rendered', rawName),
      ].filter(Boolean);

      const baseDir = path.join(config.DATA_DIR, 'gdrive_folders');
      if (fs.existsSync(baseDir)) {
        try {
          const subdirs = fs.readdirSync(baseDir);
          for (const sub of subdirs) {
            candidatePaths.push(path.join(baseDir, sub, rawName));
          }
        } catch {}
      }

      const foundPath = candidatePaths.find((p) => p && fs.existsSync(p));
      if (foundPath) {
        res.setHeader('Content-Type', 'video/mp4');
        const stream = fs.createReadStream(foundPath);
        stream.pipe(res);
        return;
      }
      res.status(404).send('Video file not found in local storage.');
      return;
    }

    res.redirect(`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`);
  } catch (err: any) {
    res.status(500).send(`Error previewing file: ${err.message}`);
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

// Handler: 1. Input Cron (Stage 1: RSS Ingestion -> Video Reels -> Save to Linked Drive Folder)
// Supports split execution by sourceId, folderId, pageId, or auto-round-robin
async function executeInputCron(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const targetSourceId = (req.params.sourceId as string) || (req.query.sourceId as string) || (req.query.source as string) || (req.query.feed as string);
    const targetFolderId = (req.query.folderId as string) || (req.query.folder as string);
    const targetPageId = (req.query.pageId as string) || (req.query.page as string);
    const allParam = req.query.all === 'true' || req.query.allSources === 'true';
    const force = req.query.force === 'true';
    const maxArticles = parseInt((req.query.max as string) || '1', 10) || 1;

    console.log(`[Input Cron] 📥 Starting Split Input Pipeline (sourceId: ${targetSourceId || 'auto-round-robin'}, folderId: ${targetFolderId || 'auto'}, pageId: ${targetPageId || 'all'})...`);
    const inputResult = await inputPipeline.runInputCron({
      sourceId: targetSourceId,
      folderId: targetFolderId,
      pageId: targetPageId,
      allSources: allParam,
      force,
      maxArticlesPerSource: maxArticles,
    });

    res.json({
      ...inputResult,
      job: 'input_cron',
      stage: '1_input_ingest_render_drive',
      sourceId: targetSourceId || inputResult.results[0]?.sourceId || 'auto',
      folderId: targetFolderId || inputResult.results[0]?.folderId || 'auto',
      pageId: targetPageId || 'all',
    });
  } catch (err: any) {
    console.error('[Input Cron] Error:', err);
    res.status(500).json({ success: false, job: 'input_cron', error: err.message });
  }
}

// Handler: 2B. Output Cron (Stage 2: Folder-wise Drive -> Facebook + YouTube + TikTok)
async function executeOutputCron(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const channelId = (req.params.channelId as string) || (req.query.channelId as string) || (req.query.channel as string);
    const folderId = (req.query.folderId as string) || (req.query.folder as string);
    const pageId = (req.query.pageId as string) || (req.query.page as string);
    const force = req.query.force !== 'false';

    console.log(`[Output Cron] 📤 Starting Output Pipeline (channelId: ${channelId || 'all'}, folderId: ${folderId || 'auto'}, pageId: ${pageId || 'all'})...`);
    const result = await gdriveReelService.publishAllDueChannels({
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
      durationMs: Date.now() - startTime,
      result,
    });
  } catch (err: any) {
    console.error('[Output Cron] Error:', err);
    res.status(500).json({ success: false, job: 'output_cron', error: err.message });
  }
}

// Helper to generate full catalog of universal and split crons
async function buildCronCatalog(baseUrl: string, secretSuffix: string) {
  const db = getDatabase();
  const rawSources = await db.collection<RssSource>('rss_sources').find({}).toArray();
  const pages = await db.collection<FacebookPage>('facebook_pages').find({}).toArray();
  const pageMap = new Map(pages.map((p) => [p._id, p.name]));
  const channels = await gdriveReelService.getAllChannels();

  const activeSources = rawSources.filter((s: any) => {
    const act = s.isActive ?? s.is_active ?? true;
    return act !== false && act !== 0 && act !== '0' && act !== 'false';
  });

  const splitInputCrons = await Promise.all(
    activeSources.map(async (s) => {
      const folderInfo = await inputPipeline.resolveDriveFolderForSource(s);
      const pageName = pageMap.get(s.pageId || (s as any).page_id) || 'Connected Page';
      return {
        sourceId: s._id,
        sourceName: s.name,
        feedUrl: s.url,
        targetPageId: s.pageId || (s as any).page_id,
        targetPageName: pageName,
        folderId: folderInfo.folderId,
        folderName: folderInfo.folderName || 'Google Drive Folder',
        path: `/api/cron/input?sourceId=${encodeURIComponent(s._id)}`,
        fullUrl: `${baseUrl}/api/cron/input?sourceId=${encodeURIComponent(s._id)}${secretSuffix}`,
        directPath: `/api/cron/input/${encodeURIComponent(s._id)}`,
        directFullUrl: `${baseUrl}/api/cron/input/${encodeURIComponent(s._id)}${secretSuffix}`,
      };
    })
  );

  const splitOutputCrons = channels
    .filter((c) => c.isActive && (c.folderUrlOrId || c.folderId))
    .map((c) => ({
      channelId: c._id,
      channelName: c.name,
      targetPageId: c.pageId,
      targetPageName: c.pageName || pageMap.get(c.pageId) || 'Connected Page',
      folderId: c.folderId,
      folderUrl: c.folderUrlOrId,
      path: `/api/cron/output?channelId=${encodeURIComponent(c._id)}`,
      fullUrl: `${baseUrl}/api/cron/output?channelId=${encodeURIComponent(c._id)}${secretSuffix}`,
      directPath: `/api/cron/output/${encodeURIComponent(c._id)}`,
      directFullUrl: `${baseUrl}/api/cron/output/${encodeURIComponent(c._id)}${secretSuffix}`,
    }));

  return {
    splitInputCrons,
    splitOutputCrons,
  };
}

// -------------------------------------------------------------
// AUTOMATION CRON ENDPOINTS (SPLIT FEED + DRIVE FOLDER WISE)
// -------------------------------------------------------------

// 1. Stage 1: Input Cron (Supports optional :sourceId param or ?sourceId= / ?folderId= query)
apiRouter.all(['/cron/input', '/cron/input/:sourceId'], async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;
  await executeInputCron(req, res);
});

// 2. Stage 2: Output Cron (Supports optional :channelId param or ?channelId= / ?folderId= query)
apiRouter.all(['/cron/output', '/cron/output/:channelId'], async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;
  await executeOutputCron(req, res);
});

// 3. Dynamic Cron Catalog Endpoint (/api/cron/catalog)
apiRouter.get('/cron/catalog', async (req: Request, res: Response) => {
  try {
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const cronSecret = process.env.CRON_SECRET;
    const secretSuffix = cronSecret ? `?secret=${encodeURIComponent(cronSecret)}` : '';
    const catalog = await buildCronCatalog(baseUrl, secretSuffix);

    res.json({
      success: true,
      baseUrl,
      cronSecretConfigured: Boolean(cronSecret),
      universalInputUrl: `${baseUrl}/api/cron/input${secretSuffix}`,
      universalOutputUrl: `${baseUrl}/api/cron/output${secretSuffix}`,
      ...catalog,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Universal Gateway Endpoint (/api/cron)
apiRouter.all('/cron', async (req: Request, res: Response) => {
  if (!verifyCronAuth(req, res)) return;

  const jobParam = ((req.query.job as string) || '').toLowerCase().trim();
  if (jobParam === 'input') {
    return executeInputCron(req, res);
  }
  if (jobParam === 'output') {
    return executeOutputCron(req, res);
  }

  // If GET without a specific job, return full catalog with split feed & folder webhooks
  if (req.method === 'GET') {
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const cronSecret = process.env.CRON_SECRET;
    const secretSuffix = cronSecret ? `?secret=${encodeURIComponent(cronSecret)}` : '';
    let splitInputCrons: any[] = [];
    let splitOutputCrons: any[] = [];
    try {
      const catalog = await buildCronCatalog(baseUrl, secretSuffix);
      splitInputCrons = catalog.splitInputCrons;
      splitOutputCrons = catalog.splitOutputCrons;
    } catch {}

    return res.json({
      status: 'active',
      name: 'BD News 24/7 Automation Pipeline (Split Feed + Drive Folder Architecture)',
      timestamp: new Date().toISOString(),
      cronSecretConfigured: Boolean(cronSecret),
      authInstructions: cronSecret
        ? 'Pass "Authorization: Bearer <secret>" or "x-cron-secret: <secret>" header, or append "?secret=<secret>" to URLs.'
        : 'CRON_SECRET is not set in environment; webhooks are open for triggers.',
      universal: {
        input: {
          slug: 'input',
          title: 'Stage 1: Universal Auto-Rotating Input Cron (1 feed per tick)',
          path: '/api/cron/input',
          fullUrl: `${baseUrl}/api/cron/input${secretSuffix}`,
          method: 'GET / POST',
          desc: 'Polls active RSS feeds one-by-one round-robin to prevent timeouts, creates vertical news reels, and saves them to linked Google Drive folders.',
        },
        output: {
          slug: 'output',
          title: 'Stage 2: Universal Output Cron (all due channels)',
          path: '/api/cron/output',
          fullUrl: `${baseUrl}/api/cron/output${secretSuffix}`,
          method: 'GET / POST',
          desc: 'Fetches the oldest reel from Google Drive folders, publishes to Facebook Pages, YouTube Shorts, and TikTok, then deletes the processed video from Drive.',
        },
      },
      splitInputCrons,
      splitOutputCrons,
      endpoints: [
        {
          slug: 'input',
          title: 'Stage 1: Universal Input Cron (Auto-rotates feeds)',
          path: '/api/cron/input',
          fullUrl: `${baseUrl}/api/cron/input${secretSuffix}`,
          method: 'GET / POST',
          desc: 'Polls active RSS feeds, creates vertical news reels with dynamic templates, and uploads to linked Google Drive folders.',
        },
        ...splitInputCrons.map((s) => ({
          slug: `input_${s.sourceId}`,
          title: `Stage 1 Input: ${s.sourceName} -> ${s.folderName}`,
          path: s.path,
          fullUrl: s.fullUrl,
          method: 'GET / POST',
          desc: `Isolated input cron for RSS feed "${s.sourceName}" (${s.feedUrl}). Uploads reels directly to Drive folder "${s.folderId}".`,
        })),
        {
          slug: 'output',
          title: 'Stage 2: Universal Output Cron',
          path: '/api/cron/output',
          fullUrl: `${baseUrl}/api/cron/output${secretSuffix}`,
          method: 'GET / POST',
          desc: 'Fetches the oldest reel from Google Drive folder, publishes to Facebook Pages, YouTube Shorts, and TikTok, then deletes the processed video folder from Drive.',
        },
        ...splitOutputCrons.map((c) => ({
          slug: `output_${c.channelId}`,
          title: `Stage 2 Output: ${c.channelName} -> ${c.targetPageName}`,
          path: c.path,
          fullUrl: c.fullUrl,
          method: 'GET / POST',
          desc: `Isolated output cron for channel "${c.channelName}" (Drive folder "${c.folderId}"). Broadcasts oldest reel to FB, YouTube & TikTok.`,
        })),
      ],
    });
  }

  res.status(400).json({
    success: false,
    error: 'Specify ?job=input or ?job=output or call /api/cron/input or /api/cron/output directly.',
  });
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
    const pageId = req.query.pageId as string;

    const matchStage: Record<string, any> = {};
    if (status) {
      matchStage.status = status;
    }
    if (pageId && pageId !== 'all') {
      matchStage.$or = [{ pageId: pageId }, { page_id: pageId }];
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
            pageId: '$pageId',
            page_id: '$pageId',
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

// 7a. Dedicated Automation Architecture Endpoints (Input Cron & Output Cron)
apiRouter.post('/pipeline/run-input', async (req: Request, res: Response) => {
  try {
    const { sourceId, folderId, pageId, force, maxArticles } = req.body || {};
    console.log('[API] 📥 Manual trigger: Running Input Cron (RSS -> Reels -> Drive Folder)...');
    const result = await inputPipeline.runInputCron({
      sourceId,
      folderId,
      pageId,
      force: force !== false,
      maxArticlesPerSource: maxArticles || 1,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/pipeline/run-output', async (req: Request, res: Response) => {
  try {
    const { channelId, folderId, pageId } = req.body || {};
    console.log('[API] 📤 Manual trigger: Running Output Cron (Folder-wise Drive -> FB, YT, TikTok)...');
    const result = await gdriveReelService.publishAllDueChannels({
      force: true,
      channelId,
      folderId,
      pageId,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/pipeline/status', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const sourcesCount = await db.collection('rss_sources').countDocuments({
      $or: [{ isActive: true }, { isActive: { $ne: false } }, { is_active: true }],
    });
    const channels = await gdriveReelService.getAllChannels();
    const activeChannels = channels.filter((c) => c.isActive);
    const pagesCount = await db.collection('facebook_pages').countDocuments({ isActive: true });
    const ytCount = await db.collection('youtube_channels').countDocuments({ isActive: true });
    await tikTokClient.initCredentials();

    res.json({
      success: true,
      architecture: {
        stage1_input: {
          name: 'Input Cron',
          description: 'Fetch RSS data ➔ Create 9:16 Video Reels ➔ Save to source-wise linked Google Drive folder',
          activeSourcesCount: sourcesCount,
          cronSchedule: config.POLL_INTERVAL_CRON,
          endpoint: '/api/cron/input',
        },
        stage2_output: {
          name: 'Output Cron (Folder-wise)',
          description: 'Scan Drive folder ➔ Get oldest video ➔ Broadcast to Facebook Page, YouTube Channel, TikTok',
          activeFoldersCount: activeChannels.length,
          totalFoldersCount: channels.length,
          connectedPages: pagesCount,
          connectedYouTubeChannels: ytCount,
          tikTokConfigured: tikTokClient.isConfigured(),
          endpoint: '/api/cron/output',
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TikTok Integration API
apiRouter.get('/tiktok/status', async (req: Request, res: Response) => {
  try {
    await tikTokClient.initCredentials();
    const db = getDatabase();
    const logs = await db
      .collection('tiktok_upload_logs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    res.json({
      configured: tikTokClient.isConfigured(),
      recentUploads: logs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/tiktok/settings', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { accessToken, clientKey, clientSecret } = req.body;

    if (accessToken !== undefined) {
      await db.collection('settings').updateOne(
        { _id: 'TIKTOK_ACCESS_TOKEN' as any },
        { $set: { value: (accessToken || '').trim(), updatedAt: new Date() } },
        { upsert: true }
      );
    }
    if (clientKey !== undefined) {
      await db.collection('settings').updateOne(
        { _id: 'TIKTOK_CLIENT_KEY' as any },
        { $set: { value: (clientKey || '').trim(), updatedAt: new Date() } },
        { upsert: true }
      );
    }
    if (clientSecret !== undefined) {
      await db.collection('settings').updateOne(
        { _id: 'TIKTOK_CLIENT_SECRET' as any },
        { $set: { value: (clientSecret || '').trim(), updatedAt: new Date() } },
        { upsert: true }
      );
    }

    await tikTokClient.initCredentials();
    res.json({ success: true, configured: tikTokClient.isConfigured() });
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

// 8. Settings (100% Database-Driven)
apiRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const dbSettings = await getAllDbSettings();
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
      ...dbSettings,
    };
    delete settingsMap['CRONJOB_API_KEY'];
    res.json(settingsMap);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (body && typeof body === 'object') {
      delete body['CRONJOB_API_KEY'];
      await setManyDbSettings(body);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 3.9. Multi-Channel YouTube Shorts Integration
// ==============================================================================

// 1. Get All Channels
apiRouter.get('/youtube/channels', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const channels = await worker.getActiveYouTubeChannels();
    const allChannels = await db
      .collection<YouTubeChannel>('youtube_channels')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      channels: allChannels.length > 0 ? allChannels : channels,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Add New Channel Manually
apiRouter.post('/youtube/channels', async (req: Request, res: Response) => {
  try {
    const { title, refreshToken, targetPageId, targetPageName, language, autoUpload, clientId, clientSecret } = req.body;
    if (!refreshToken || !String(refreshToken).trim()) {
      return res.status(400).json({ success: false, error: 'OAuth Refresh Token is required' });
    }

    const db = getDatabase();
    const sId = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' });
    const sSec = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_SECRET' });
    const effClientId = (clientId && String(clientId).trim()) || sId?.value || process.env.YOUTUBE_CLIENT_ID || '';
    const effClientSecret = (clientSecret && String(clientSecret).trim()) || sSec?.value || process.env.YOUTUBE_CLIENT_SECRET || '';

    // Verify channel with YouTube API
    const testClient = new YouTubeClient(effClientId, effClientSecret, String(refreshToken).trim());
    const testRes = await testClient.testConnection();
    if (!testRes.success || !testRes.profile) {
      return res.status(400).json({
        success: false,
        error: `Could not authenticate YouTube channel: ${testRes.error || 'Invalid credentials'}`,
      });
    }

    const profile = testRes.profile;
    let finalPageName = targetPageName;
    if (!finalPageName && targetPageId && targetPageId !== 'all') {
      const page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: targetPageId });
      if (page) finalPageName = page.name;
    }

    const channelId = profile.id && profile.id !== 'upload-active' ? profile.id : `yt_${crypto.randomUUID().slice(0, 8)}`;
    const newChannel: YouTubeChannel = {
      _id: channelId,
      title: title || profile.title || 'YouTube Channel',
      customUrl: profile.customUrl,
      description: profile.description,
      thumbnailUrl: profile.thumbnailUrl,
      subscriberCount: profile.subscriberCount,
      videoCount: profile.videoCount,
      clientId: clientId ? String(clientId).trim() : undefined,
      clientSecret: clientSecret ? String(clientSecret).trim() : undefined,
      refreshToken: String(refreshToken).trim(),
      targetPageId: targetPageId || 'all',
      targetPageName: finalPageName || 'All Pages',
      language: language || (targetPageId === '1526917347161119' ? 'en' : 'bn'),
      autoUpload: autoUpload !== false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection<YouTubeChannel>('youtube_channels').updateOne(
      { _id: newChannel._id },
      { $set: newChannel },
      { upsert: true }
    );

    res.json({
      success: true,
      channel: newChannel,
      message: `YouTube Channel "${newChannel.title}" successfully connected!`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Update Channel Settings
apiRouter.patch('/youtube/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetPageId, targetPageName, language, autoUpload, isActive, title } = req.body;
    const db = getDatabase();

    const updateFields: any = { updatedAt: new Date() };
    if (targetPageId !== undefined) updateFields.targetPageId = targetPageId;
    if (targetPageName !== undefined) updateFields.targetPageName = targetPageName;
    if (language !== undefined) updateFields.language = language;
    if (autoUpload !== undefined) updateFields.autoUpload = Boolean(autoUpload);
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);
    if (title !== undefined) updateFields.title = String(title).trim();

    await db.collection<YouTubeChannel>('youtube_channels').updateOne(
      { _id: id },
      { $set: updateFields }
    );

    res.json({ success: true, message: 'YouTube channel updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Delete Channel
apiRouter.delete('/youtube/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    await db.collection<YouTubeChannel>('youtube_channels').deleteOne({ _id: id });
    res.json({ success: true, message: 'YouTube channel removed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Sync Channel Profile from YouTube API
apiRouter.post('/youtube/channels/:id/sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const ch = await db.collection<YouTubeChannel>('youtube_channels').findOne({ _id: id });
    if (!ch) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    const sId = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' });
    const sSec = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_SECRET' });
    const client = YouTubeClient.forChannel(ch, sId?.value, sSec?.value);
    const profile = await client.getChannelProfile();

    const updateDoc: any = {
      updatedAt: new Date(),
    };
    if (profile.title && profile.title !== 'YouTube Channel (Upload Active)') updateDoc.title = profile.title;
    if (profile.customUrl) updateDoc.customUrl = profile.customUrl;
    if (profile.description) updateDoc.description = profile.description;
    if (profile.thumbnailUrl) updateDoc.thumbnailUrl = profile.thumbnailUrl;
    if (profile.subscriberCount) updateDoc.subscriberCount = profile.subscriberCount;
    if (profile.videoCount) updateDoc.videoCount = profile.videoCount;

    await db.collection<YouTubeChannel>('youtube_channels').updateOne({ _id: id }, { $set: updateDoc });

    res.json({ success: true, profile, message: 'Channel statistics synced' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Test Channel Connection
apiRouter.post('/youtube/channels/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const ch = await db.collection<YouTubeChannel>('youtube_channels').findOne({ _id: id });
    if (!ch) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    const sId = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' });
    const sSec = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_SECRET' });
    const client = YouTubeClient.forChannel(ch, sId?.value, sSec?.value);
    const result = await client.testConnection();

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/youtube/status', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const isConfigured = await ytClient.initCredentials();
    const clientIdSetting = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' });
    const clientSecretSetting = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_SECRET' });
    const refreshTokenSetting = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_REFRESH_TOKEN' });
    const autoPostSetting = await db.collection<Setting>('settings').findOne({ _id: 'AUTO_POST_YOUTUBE' });

    const channels = await worker.getActiveYouTubeChannels();

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
      isConfigured: isConfigured || channels.length > 0,
      autoPost: autoPostSetting ? autoPostSetting.value !== 'false' : true,
      clientId: clientIdSetting?.value || process.env.YOUTUBE_CLIENT_ID || '',
      hasClientSecret: Boolean(clientSecretSetting?.value || process.env.YOUTUBE_CLIENT_SECRET),
      hasRefreshToken: Boolean(refreshTokenSetting?.value || process.env.YOUTUBE_REFRESH_TOKEN),
      channel,
      channels,
      channelCount: channels.length,
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
    const { articleId, channelId } = req.body;
    const db = getDatabase();

    let targetArticleId = articleId;
    if (!targetArticleId) {
      // Pick appropriate article based on channel
      if (channelId) {
        const ch = await db.collection<YouTubeChannel>('youtube_channels').findOne({ _id: channelId });
        const isChEnglish = ch?.language === 'en' || ch?.targetPageId === '1526917347161119';
        const candidates = await db
          .collection<NewsArticle>('news_articles')
          .find({})
          .sort({ pubDate: -1 })
          .limit(30)
          .toArray();
        const matched = candidates.find((a: NewsArticle) =>
          isChEnglish
            ? isEnglishText(a.title) || (a.link && a.link.includes('trendingnews'))
            : !isEnglishText(a.title) && !(a.link && a.link.includes('trendingnews'))
        );
        if (matched) targetArticleId = matched._id;
      }

      if (!targetArticleId) {
        const candidates = await db
          .collection<NewsArticle>('news_articles')
          .find({ link: { $not: /trendingnews/i } })
          .sort({ pubDate: -1 })
          .limit(30)
          .toArray();
        const latestBdArt = candidates.find((a: NewsArticle) => !isEnglishText(a.title));
        if (!latestBdArt) {
          return res.status(404).json({ error: 'No article found to upload' });
        }
        targetArticleId = latestBdArt._id;
      }
    }

    const result = await worker.uploadShortForArticle(targetArticleId, channelId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/youtube/logs', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const channelId = req.query.channelId as string;
    const filter: any = {};
    if (channelId) filter.channelId = channelId;

    const logs = await db
      .collection<YouTubeUploadLog>('youtube_upload_logs')
      .find(filter)
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
  const targetPageId = (req.query.targetPageId as string) || '';
  const targetPageName = (req.query.targetPageName as string) || '';
  const language = (req.query.language as string) || '';

  const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/drive');

  const statePayload = {
    origin: originParam,
    targetPageId,
    targetPageName,
    language,
  };
  const stateEncoded = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${stateEncoded}`;

  res.json({
    authUrl,
    redirectUri,
  });
});

apiRouter.get('/youtube/auth/callback', async (req: Request, res: Response) => {
  const stateRaw = (req.query.state as string) || 'youtube';
  let statePayload: any = { origin: 'youtube' };

  try {
    const decoded = Buffer.from(stateRaw, 'base64url').toString('utf8');
    statePayload = JSON.parse(decoded);
  } catch {
    statePayload = { origin: stateRaw };
  }

  const targetTab = statePayload.origin === 'gdrive' ? 'gdrive-reels' : 'youtube';

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
    const tokenResult = await ytClient.exchangeCodeForTokens(code, redirectUri);

    const db = getDatabase();
    if (tokenResult.refreshToken) {
      await setDbSetting('GDRIVE_REFRESH_TOKEN', tokenResult.refreshToken);
      await setDbSetting('GOOGLE_REFRESH_TOKEN', tokenResult.refreshToken);
      try {
        await db.collection('settings').updateOne(
          { _id: 'GDRIVE_REFRESH_TOKEN' as any },
          { $set: { value: tokenResult.refreshToken, updatedAt: new Date() } },
          { upsert: true }
        );
        await db.collection('settings').updateOne(
          { _id: 'GOOGLE_REFRESH_TOKEN' as any },
          { $set: { value: tokenResult.refreshToken, updatedAt: new Date() } },
          { upsert: true }
        );
        console.log('[Google OAuth Callback] ✓ Google Drive & YouTube refresh tokens saved successfully to database settings!');
      } catch (saveErr: any) {
        console.warn('[Google OAuth Callback] Note saving GDRIVE_REFRESH_TOKEN:', saveErr.message);
      }
    }

    if (statePayload.origin === 'youtube') {
      const sId = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' });
      const sSec = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_SECRET' });

      // Create client with new token to inspect channel
      const chClient = new YouTubeClient(
        sId?.value || process.env.YOUTUBE_CLIENT_ID,
        sSec?.value || process.env.YOUTUBE_CLIENT_SECRET,
        tokenResult.refreshToken
      );
      const profile = await chClient.getChannelProfile();

      let pageName = statePayload.targetPageName;
      if (!pageName && statePayload.targetPageId && statePayload.targetPageId !== 'all') {
        const page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: statePayload.targetPageId });
        if (page) pageName = page.name;
      }

      const channelDoc: YouTubeChannel = {
        _id: profile.id && profile.id !== 'upload-active' ? profile.id : `yt_${crypto.randomUUID().slice(0, 8)}`,
        title: profile.title || 'YouTube Channel',
        customUrl: profile.customUrl,
        description: profile.description,
        thumbnailUrl: profile.thumbnailUrl,
        subscriberCount: profile.subscriberCount,
        videoCount: profile.videoCount,
        refreshToken: tokenResult.refreshToken,
        targetPageId: statePayload.targetPageId || 'all',
        targetPageName: pageName || 'All Pages',
        language: statePayload.language || (statePayload.targetPageId === '1526917347161119' ? 'en' : 'bn'),
        autoUpload: true,
        isActive: true,
        updatedAt: new Date(),
      };

      await db.collection<YouTubeChannel>('youtube_channels').updateOne(
        { _id: channelDoc._id },
        {
          $set: channelDoc,
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );

      return res.redirect(`/?tab=youtube&auth=success&channel_added=true&title=${encodeURIComponent(channelDoc.title)}`);
    }

    res.redirect(`/?tab=${targetTab}&auth=success&gdrive_connected=true`);
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

