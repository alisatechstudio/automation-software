import crypto from 'crypto';
import { getDatabase, isMongoConnected } from '../../db/index.js';
import { NewsArticle, FacebookPage, RssSource, Job, PostLog, FacebookGroup, GroupShareLog, ReelLog, StoryLog, YouTubeUploadLog, Setting } from '../../db/schema.js';
import { PersistentJobQueue } from './queue.js';
import { PlaywrightImageRenderer } from '../renderer/playwright.js';
import { CanvasCardRenderer } from '../renderer/canvas.js';
import { ReelVideoRenderer } from '../renderer/reel.js';
import { FacebookGraphClient } from '../facebook/client.js';
import { YouTubeClient } from '../youtube/client.js';
import { TelegramAlertService } from '../alert/telegram.js';
import { REEL_THEME_KEYS } from '../../config/constants.js';
import { config } from '../../config/env.js';

/**
 * Resolves the next theme in the round-robin sequence across all 5 reel designs:
 * 1. studio-red (Canva replica)
 * 2. breaking-bold (Flash breaking yellow)
 * 3. dark-cinema (Cyber dark obsidian)
 * 4. viral-gradient (Sunset mesh viral)
 * 5. vertical-916 (9:16 vertical fullscreen)
 */
export async function getNextRollingReelTheme(db: any): Promise<string> {
  try {
    const lastReel = await db.collection('reel_logs').findOne(
      { theme: { $exists: true, $nin: [null, '', 'rolling'] } },
      { sort: { createdAt: -1 } }
    );

    if (!lastReel || !lastReel.theme) {
      return REEL_THEME_KEYS[0];
    }

    const lastIndex = REEL_THEME_KEYS.indexOf(lastReel.theme as any);
    if (lastIndex === -1) {
      return REEL_THEME_KEYS[0];
    }

    const nextIndex = (lastIndex + 1) % REEL_THEME_KEYS.length;
    return REEL_THEME_KEYS[nextIndex];
  } catch (err: any) {
    console.warn('[RollingReels] Failed to determine next rolling theme:', err.message);
    return REEL_THEME_KEYS[0];
  }
}

export class QueueWorker {
  private queue: PersistentJobQueue;
  private renderer: PlaywrightImageRenderer;
  private canvasRenderer: CanvasCardRenderer;
  private reelRenderer: ReelVideoRenderer;
  private fbClient: FacebookGraphClient;
  private ytClient: YouTubeClient;
  private alertService: TelegramAlertService;
  private isRunning: boolean = false;
  private loopTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.queue = new PersistentJobQueue();
    this.renderer = new PlaywrightImageRenderer();
    this.canvasRenderer = new CanvasCardRenderer();
    this.reelRenderer = new ReelVideoRenderer();
    this.fbClient = new FacebookGraphClient();
    this.ytClient = new YouTubeClient();
    this.alertService = new TelegramAlertService();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[QueueWorker] Started persistent MongoDB queue worker.');
    this.scheduleNextTick(1000);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
    console.log('[QueueWorker] Stopped queue worker.');
  }

  private scheduleNextTick(delayMs: number): void {
    if (!this.isRunning) return;
    this.loopTimeout = setTimeout(() => this.tick(), delayMs);
  }

  private async tick(): Promise<void> {
    if (!isMongoConnected()) {
      // Database not connected yet, wait before retrying
      this.scheduleNextTick(10000);
      return;
    }

    try {
      const job = await this.queue.fetchNextJob();
      if (job) {
        await this.processJob(job);
        this.scheduleNextTick(2000);
      } else {
        this.scheduleNextTick(5000);
      }
    } catch (err) {
      console.error('[QueueWorker] Unexpected error in worker loop:', err);
      this.scheduleNextTick(5000);
    }
  }

  public async processJob(job: Job): Promise<void> {
    const startTime = Date.now();
    const db = getDatabase();

    console.log(`[QueueWorker] Processing job ${job._id} (type: ${job.type}, attempt: ${job.attempts + 1}/${job.maxAttempts})...`);

    if (job.type !== 'process_article') {
      console.log(`[QueueWorker] Unknown job type: ${job.type}. Marking completed.`);
      await this.queue.markCompleted(job._id);
      return;
    }

    const { articleId, pageId, templateId } = job.payload;

    const articlesCol = db.collection<NewsArticle>('news_articles');
    const pagesCol = db.collection<FacebookPage>('facebook_pages');
    const sourcesCol = db.collection<RssSource>('rss_sources');
    const logsCol = db.collection<PostLog>('post_logs');
    const jobsCol = db.collection<Job>('jobs');

    const article = await articlesCol.findOne({ _id: articleId });
    let page = await pagesCol.findOne({ _id: pageId });
    const source = article ? await sourcesCol.findOne({ _id: article.sourceId }) : null;

    // Robust Fallback: If pageId does not match directly, fall back to source pageId or any active page
    if (!page) {
      if (source?.pageId) {
        page = await pagesCol.findOne({ _id: source.pageId });
      }
      if (!page) {
        page = await pagesCol.findOne({ isActive: true });
      }
      if (page) {
        console.log(`[QueueWorker] Mismatched pageId (${pageId}) resolved to active page "${page.name}" (${page._id}) for job ${job._id}`);
      }
    }

    if (!article || !page) {
      const errMsg = `Missing dependencies for job ${job._id}: article=${!!article}, page=${!!page}`;
      console.error(`[QueueWorker] ${errMsg}`);
      await this.queue.markCompleted(job._id);
      return;
    }

    try {
      // 1. Hourly Rate Cap Enforcement
      const isUnderCap = await this.checkHourlyCap(page._id);
      if (!isUnderCap) {
        console.warn(`[QueueWorker] Hourly post cap (${config.MAX_POSTS_PER_HOUR}/hr) reached for page ${page.name} (${page._id}). Rescheduling job in 10 minutes.`);
        await jobsCol.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'pending',
              runAt: new Date(Date.now() + 10 * 60 * 1000),
              updatedAt: new Date(),
            },
          }
        );
        return;
      }

      // 2. Random Jitter Delay (30-60s) to avoid spam flags
      await this.applyPostingJitter();

      // Check Posting Mode: Reels-only mode (video reels must be true)
      const disablePosterSetting = await db.collection<Setting>('settings').findOne({ _id: 'DISABLE_POSTER' });
      let isPosterDisabled = disablePosterSetting ? disablePosterSetting.value !== 'false' : true;

      // Reel Configuration
      const reelThemeSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_REEL_THEME' });
      const reelDurationSetting = await db.collection<Setting>('settings').findOne({ _id: 'REEL_DURATION_SECONDS' });
      let targetReelTheme = job.payload?.reelTheme || reelThemeSetting?.value || 'rolling';
      const reelDuration = parseInt(reelDurationSetting?.value || '15', 10) || 15;

      if (!targetReelTheme || targetReelTheme === 'rolling') {
        targetReelTheme = await getNextRollingReelTheme(db);
        console.log(`[QueueWorker] 🔄 Rolling Rotation selected next theme: "${targetReelTheme}"`);
      }

      const caption = this.fbClient.formatCaption(
        article.title,
        article.description || '',
        config.DEFAULT_HASHTAGS,
        config.DEFAULT_CAPTION_FORMAT
      );

      const commentText = this.fbClient.formatComment(
        article.link,
        config.DEFAULT_COMMENT_FORMAT
      );

      let reelBuffer: Buffer | null = null;
      if (isPosterDisabled) {
        // =========================================================================
        // REELS-ONLY MODE: 15-Second MP4 Video Reel (Ultra-Fast Parallel Distribution)
        // =========================================================================
        const reelFps = process.env.VERCEL ? 10 : 15;
        console.log(`[QueueWorker] 🎬 Reels Mode: Rendering ${reelDuration}s MP4 Reel at ${reelFps}fps (${targetReelTheme}) for "${article.title}"...`);
        try {
          reelBuffer = await this.reelRenderer.renderReel({
            headline: article.title,
            category: article.category || 'বিশেষ খবর',
            imageUrl: article.imageUrl || undefined,
            theme: targetReelTheme,
            durationSeconds: reelDuration,
            fps: reelFps,
          });
        } catch (reelErr: any) {
          console.warn(`[QueueWorker] ⚠️ MP4 Reel video rendering failed (${reelErr.message}). Gracefully falling back to 1080x1080 JPG News Card...`);
          reelBuffer = null;
          isPosterDisabled = false;
        }
      }

      if (isPosterDisabled && reelBuffer) {
        // Caption: ONLY hashtags (no headline and no summary, as requested)
        const hashtagSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_HASHTAGS' });
        const configuredHashtags = hashtagSetting?.value || config.DEFAULT_HASHTAGS;
        const reelCaption = (configuredHashtags + ' #Reels #FBReels #Bangladesh #NewsUpdate').trim();

        // Pre-render Story poster card if enabled (takes ~100ms)
        const storySetting = await db.collection<Setting>('settings').findOne({ _id: 'POST_POSTER_TO_STORIES' });
        const shouldPostStory = storySetting ? storySetting.value !== 'false' : true;
        let posterRenderResult: any = null;

        if (shouldPostStory) {
          try {
            posterRenderResult = await this.canvasRenderer.render({
              templateId: 'template-canva-bdnews',
              headline: article.title,
              category: article.category || 'বিশেষ খবর',
              imageUrl: article.imageUrl || undefined,
            });
          } catch (e: any) {
            console.warn('[QueueWorker] Story render note:', e.message);
          }
        }

        // Shared upload state
        let reelVideoId: string | null = null;
        let reelPostId: string | null = null;
        let reelCommentId: string | null = null;
        let reelError: string | null = null;
        let storyPhotoId: string | null = null;
        let storyId: string | null = null;
        let storyStatus: 'success' | 'failed' | 'dry_run' | 'skipped' = 'skipped';
        let ytVideoId: string | null = null;
        let ytStatus: 'success' | 'failed' | 'dry_run' | 'skipped' = 'skipped';

        const publishTasks: Promise<any>[] = [];

        // TASK 1: Publish Facebook Feed Reel + First Comment
        publishTasks.push((async () => {
          try {
            console.log(`[QueueWorker] 🚀 [Parallel] Publishing ${reelDuration}s Reel to Facebook Page ${page.name}...`);
            const res = await this.fbClient.publishReel(
              page._id,
              page.accessToken,
              reelBuffer,
              reelCaption,
              undefined,
              config.DRY_RUN
            );
            reelVideoId = res.videoId;
            reelPostId = res.postId;

            if (article.link && reelPostId) {
              try {
                const commentFormatSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_COMMENT_FORMAT' });
                const commentTemplate = commentFormatSetting?.value || config.DEFAULT_COMMENT_FORMAT;
                const commentText = this.fbClient.formatComment(article.link, commentTemplate);
                const { commentId } = await this.fbClient.publishComment(
                  reelPostId,
                  page.accessToken,
                  commentText,
                  config.DRY_RUN
                );
                reelCommentId = commentId;
                console.log(`✓ [QueueWorker] First comment posted to Reel! (Comment ID: ${commentId})`);
              } catch (ce: any) {
                console.warn(`[QueueWorker] Reel comment note:`, ce.message);
              }
            }
          } catch (re: any) {
            reelError = re.message || String(re);
            console.error('[QueueWorker] Reel publish error:', reelError);

            // GRACEFUL FALLBACK: If Facebook rejected video/reels API (e.g. missing publish_video permission),
            // immediately publish the high-resolution 1080x1080 News Card image to the feed!
            try {
              console.log(`[QueueWorker] ⚠️ Reels API rejected. Executing fallback to 1080x1080 News Card Image for "${article.title}"...`);
              let fallbackCard = posterRenderResult;
              if (!fallbackCard?.imageBuffer) {
                fallbackCard = await this.canvasRenderer.render({
                  templateId: 'template-canva-bdnews',
                  headline: article.title,
                  category: article.category || 'বিশেষ খবর',
                  imageUrl: article.imageUrl || undefined,
                });
              }
              const feedCaption = this.fbClient.formatCaption(
                article.title,
                article.description || '',
                config.DEFAULT_HASHTAGS,
                config.DEFAULT_CAPTION_FORMAT
              );
              const photoRes = await this.fbClient.publishPhoto(
                page._id,
                page.accessToken,
                fallbackCard.imageBuffer,
                feedCaption,
                config.DRY_RUN
              );
              reelPostId = photoRes.postId;
              reelVideoId = photoRes.photoId;
              reelError = null; // Fallback succeeded!
              console.log(`✓ [QueueWorker] Fallback News Card photo published successfully! Post ID: ${reelPostId}`);

              if (article.link && reelPostId) {
                try {
                  const commentFormatSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_COMMENT_FORMAT' });
                  const commentTemplate = commentFormatSetting?.value || config.DEFAULT_COMMENT_FORMAT;
                  const commentText = this.fbClient.formatComment(article.link, commentTemplate);
                  const { commentId } = await this.fbClient.publishComment(
                    reelPostId,
                    page.accessToken,
                    commentText,
                    config.DRY_RUN
                  );
                  reelCommentId = commentId;
                } catch {}
              }
            } catch (fallbackErr: any) {
              console.error('[QueueWorker] Fallback photo publish also failed:', fallbackErr.message);
              reelError = `${reelError} | Fallback photo error: ${fallbackErr.message}`;
            }
          }
        })());

        // TASK 2: Publish Facebook Page Story (1080x1080 JPG)
        if (shouldPostStory && posterRenderResult?.imageBuffer) {
          publishTasks.push((async () => {
            try {
              console.log(`[QueueWorker] 📸 [Parallel] Publishing JPG poster to Facebook Page Stories...`);
              const storyPublishResult = await this.fbClient.publishPhotoStory(
                page._id,
                page.accessToken,
                posterRenderResult.imageBuffer,
                config.DRY_RUN
              );
              storyPhotoId = storyPublishResult.photoId;
              storyId = storyPublishResult.storyId;
              storyStatus = config.DRY_RUN ? 'dry_run' : 'success';

              await db.collection<StoryLog>('story_logs').insertOne({
                _id: crypto.randomUUID(),
                articleId: article._id,
                articleTitle: article.title,
                pageId: page._id,
                pageName: page.name,
                fbPhotoId: storyPhotoId,
                fbStoryId: storyId,
                renderedImagePath: posterRenderResult.outputPath || null,
                durationMs: 0,
                status: storyStatus,
                createdAt: new Date(),
              });
              console.log(`✓ [QueueWorker] Published to Facebook Stories! (ID: ${storyId})`);
            } catch (storyErr: any) {
              storyStatus = 'failed';
              console.warn(`[QueueWorker] Facebook Story note:`, storyErr.message);
            }
          })());
        }

        // TASK 3: Publish YouTube Shorts
        const isYtConfigured = await this.ytClient.initCredentials();
        const ytAutoSetting = await db.collection<Setting>('settings').findOne({ _id: 'AUTO_POST_YOUTUBE' });
        const shouldPostYt = ytAutoSetting ? ytAutoSetting.value !== 'false' : isYtConfigured;

        if (isYtConfigured && shouldPostYt) {
          publishTasks.push((async () => {
            const ytStartTime = Date.now();
            try {
              console.log(`[QueueWorker] 📺 [Parallel] Uploading 15s MP4 Video to YouTube Shorts...`);
              const ytResult = await this.ytClient.uploadShort(
                {
                  videoBuffer: reelBuffer,
                  title: article.title,
                  description: `${configuredHashtags} #Shorts #YouTubeShorts\n\nবিস্তারিত পড়ুন: ${article.link}`,
                },
                config.DRY_RUN
              );
              ytVideoId = ytResult.videoId;
              ytStatus = config.DRY_RUN ? 'dry_run' : 'success';

              if (article.link && ytVideoId && !config.DRY_RUN) {
                await this.ytClient.addComment(ytVideoId, `বিস্তারিত খবর পড়ুন: ${article.link}`);
              }

              await db.collection<YouTubeUploadLog>('youtube_upload_logs').insertOne({
                _id: crypto.randomUUID(),
                articleId: article._id,
                articleTitle: article.title,
                ytVideoId: ytResult.videoId,
                ytVideoUrl: ytResult.videoUrl,
                durationMs: Date.now() - ytStartTime,
                status: ytStatus,
                createdAt: new Date(),
              });
              console.log(`✓ [QueueWorker] Published to YouTube Shorts! (URL: ${ytResult.videoUrl})`);
            } catch (ytErr: any) {
              ytStatus = 'failed';
              const ytErrMsg = ytErr.message || String(ytErr);
              console.error(`❌ [QueueWorker] YouTube Short upload failed: ${ytErrMsg}`);

              await db.collection<YouTubeUploadLog>('youtube_upload_logs').insertOne({
                _id: crypto.randomUUID(),
                articleId: article._id,
                articleTitle: article.title,
                ytVideoId: '',
                ytVideoUrl: '',
                durationMs: Date.now() - ytStartTime,
                status: 'failed',
                errorMessage: ytErrMsg,
                createdAt: new Date(),
              });
            }
          })());
        } else {
          console.log(`[QueueWorker] ℹ️ YouTube Shorts skipped: isConfigured=${isYtConfigured}, shouldPost=${shouldPostYt}`);
        }

        // Wait for all 3 platform tasks simultaneously
        await Promise.allSettled(publishTasks);
        const durationMs = Date.now() - startTime;

        const isReelSuccess = config.DRY_RUN ? true : (!!reelPostId && !reelError);
        const overallStatus = config.DRY_RUN ? 'dry_run' : (isReelSuccess ? 'success' : 'failed');

        // Record Post & Reel Log
        const logId = crypto.randomUUID();
        const logDoc: PostLog = {
          _id: logId,
          articleId: article._id,
          pageId: page._id,
          fbPostId: reelPostId,
          fbCommentId: reelCommentId,
          fbReelId: reelVideoId,
          fbVideoId: reelVideoId,
          fbStoryId: storyId,
          storyStatus: storyStatus,
          ytVideoId,
          ytStatus,
          caption: reelCaption,
          comment: article.link || null,
          durationMs,
          status: overallStatus,
          errorMessage: isReelSuccess ? null : reelError,
          createdAt: new Date(),
        };
        await logsCol.insertOne(logDoc as any);

        await db.collection<ReelLog>('reel_logs').insertOne({
          _id: crypto.randomUUID(),
          articleId: article._id,
          articleTitle: article.title,
          pageId: page._id,
          pageName: page.name,
          theme: targetReelTheme,
          fbVideoId: reelVideoId || '',
          fbPostId: reelPostId || '',
          durationMs,
          status: overallStatus,
          errorMessage: isReelSuccess ? null : reelError,
          createdAt: new Date(),
        });

        if (!isReelSuccess && !config.DRY_RUN) {
          console.error(`❌ [QueueWorker] Facebook Reel publish failed for article "${article.title}". Error: ${reelError}`);
          await this.queue.handleFailure(job, reelError || 'Facebook Reel upload failed');
          return;
        }

        // Update article status & mark job completed
        await articlesCol.updateOne({ _id: article._id }, { $set: { status: 'published' } });
        await this.queue.markCompleted(job._id);

        console.log(`✓ [QueueWorker] Successfully published ${reelDuration}s Reel for "${article.title.substring(0, 40)}..." (Reel ID: ${reelVideoId}, Post ID: ${reelPostId}, Took ${durationMs}ms)`);

        // Auto Share Reel to Relevant Facebook Groups
        if (reelPostId) {
          try {
            await this.autoShareToRelevantGroups(page, article, reelPostId);
          } catch (groupShareErr: any) {
            console.warn(`[QueueWorker] Group auto-share encountered an error: ${groupShareErr.message}`);
          }
        }
      } else {
        // =========================================================================
        // STANDARD MODE: Render & Publish JPG Poster Card
        // =========================================================================
        let renderedBuffer: Buffer;
        let renderedPath: string | undefined;

        try {
          console.log(`[QueueWorker] Rendering 1080x1080 JPG news card for article "${article.title}"...`);
          if (templateId === 'template-canva-bdnews' || !templateId || source?.templateId === 'template-canva-bdnews' || process.env.VERCEL) {
            const renderResult = await this.canvasRenderer.render({
              templateId: 'template-canva-bdnews',
              headline: article.title,
              category: article.category || 'বিশেষ খবর',
              imageUrl: article.imageUrl || undefined,
            });
            renderedBuffer = renderResult.imageBuffer;
            renderedPath = renderResult.outputPath;
          } else {
            const renderResult = await this.renderer.render({
              templateId: templateId || source?.templateId || 'template-canva-bdnews',
              headline: article.title,
              category: article.category || 'বিশেষ খবর',
              dateText: new Intl.DateTimeFormat('bn-BD', { dateStyle: 'full' }).format(new Date(article.pubDate)),
              imageUrl: article.imageUrl || undefined,
            });
            renderedBuffer = renderResult.imageBuffer;
            renderedPath = renderResult.outputPath;
          }
        } catch (renderError: any) {
          console.warn(`[QueueWorker] Primary render failed: ${renderError.message}. Using Canvas Card fallback...`);
          try {
            const fallbackResult = await this.canvasRenderer.render({
              templateId: 'template-canva-bdnews',
              headline: article.title,
              category: article.category || 'বিশেষ খবর',
              imageUrl: article.imageUrl || undefined,
            });
            renderedBuffer = fallbackResult.imageBuffer;
            renderedPath = fallbackResult.outputPath;
          } catch (canvasErr: any) {
            console.warn(`[QueueWorker] Canvas render also failed: ${canvasErr.message}. Gracefully using original photo...`);
            renderedBuffer = await this.fetchOriginalImageFallback(article.imageUrl);
          }
        }

        // Publish Photo to Facebook Page (or Dry-Run)
        console.log(`[QueueWorker] Publishing photo to page ${page.name}...`);
        const { photoId, postId } = await this.fbClient.publishPhoto(
          page._id,
          page.accessToken,
          renderedBuffer,
          caption,
          config.DRY_RUN
        );

        console.log(`[QueueWorker] Adding news link as first comment to post ${postId}...`);
        const { commentId } = await this.fbClient.publishComment(
          postId,
          page.accessToken,
          commentText,
          config.DRY_RUN
        );

        const durationMs = Date.now() - startTime;

        // Record Post Log
        const logId = crypto.randomUUID();
        const logDoc: PostLog = {
          _id: logId,
          articleId: article._id,
          pageId: page._id,
          fbPhotoId: photoId,
          fbPostId: postId,
          fbCommentId: commentId,
          renderedImagePath: renderedPath || null,
          caption,
          comment: commentText,
          durationMs,
          status: config.DRY_RUN ? 'dry_run' : 'success',
          createdAt: new Date(),
        };
        await logsCol.insertOne(logDoc as any);

        // Update article status & mark job completed
        await articlesCol.updateOne({ _id: article._id }, { $set: { status: 'published' } });
        await this.queue.markCompleted(job._id);

        console.log(`✓ [QueueWorker] Successfully processed & published article "${article.title.substring(0, 40)}..." (Took ${durationMs}ms)`);

        // Auto Share to Relevant Facebook Groups (Non-blocking)
        try {
          await this.autoShareToRelevantGroups(page, article, postId);
        } catch (groupShareErr: any) {
          console.warn(`[QueueWorker] Group auto-share encountered an error: ${groupShareErr.message}`);
        }

        // Auto Create & Publish Facebook Reel (if enabled in settings or job payload)
        try {
          const autoReelSetting = await db.collection<Setting>('settings').findOne({ _id: 'AUTO_POST_REELS' });
          const shouldPostReel =
            autoReelSetting ? autoReelSetting.value !== 'false' : true;

          if (shouldPostReel) {
            console.log(`[QueueWorker] Generating and publishing MP4 Reel (${targetReelTheme}) for article "${article.title}"...`);
            let reelBuffer: Buffer | null = null;
            try {
              reelBuffer = await this.reelRenderer.renderReel({
                headline: article.title,
                category: article.category || 'বিশেষ খবর',
                imageUrl: article.imageUrl || undefined,
                theme: targetReelTheme,
                durationSeconds: reelDuration,
                fps: 15,
              });
            } catch (rErr: any) {
              console.warn(`[QueueWorker] Reel render failed on shared host (${rErr.message}). Skipping reel for this article.`);
            }

            if (reelBuffer) {
              const { videoId: reelVideoId, postId: reelPostId } = await this.fbClient.publishReel(
                page._id,
                page.accessToken,
                reelBuffer,
                caption,
                article.title,
                config.DRY_RUN
              );

              await db.collection<ReelLog>('reel_logs').insertOne({
                _id: crypto.randomUUID(),
                articleId: article._id,
                articleTitle: article.title,
                pageId: page._id,
                pageName: page.name,
                theme: targetReelTheme,
                fbVideoId: reelVideoId,
                fbPostId: reelPostId,
                durationMs: Date.now() - startTime,
                status: config.DRY_RUN ? 'dry_run' : 'success',
                createdAt: new Date(),
              });
              console.log(`✓ [QueueWorker] MP4 Reel published successfully! Reel ID: ${reelVideoId}`);
            }
          }
        } catch (reelErr: any) {
          console.warn(`[QueueWorker] Reel generation or publish encountered an error: ${reelErr.message}`);
        }
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err.message || String(err);
      console.error(`[QueueWorker] Error processing job ${job._id}:`, errorMessage);

      const willRetry = await this.queue.handleFailure(job, errorMessage);

      if (!willRetry) {
        // Retries completely exhausted: Final Failure State
        await articlesCol.updateOne({ _id: article._id }, { $set: { status: 'failed' } });

        const logId = crypto.randomUUID();
        const failLog: PostLog = {
          _id: logId,
          articleId: article._id,
          pageId: page._id,
          durationMs,
          status: 'failed',
          errorMessage,
          createdAt: new Date(),
        };
        await logsCol.insertOne(failLog as any);

        // Dispatch Telegram Bot Alert
        await this.alertService.sendFailureAlert({
          articleTitle: article.title,
          sourceName: source?.name,
          pageId: page._id,
          attempts: job.maxAttempts,
          maxAttempts: job.maxAttempts,
          errorMessage,
          articleUrl: article.link,
        });
      }
    }
  }

  /**
   * Enforces max posts-per-hour cap for a specific page
   */
  private async checkHourlyCap(pageId: string): Promise<boolean> {
    const db = getDatabase();
    const logsCol = db.collection<PostLog>('post_logs');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const count = await logsCol.countDocuments({
      pageId,
      status: { $in: ['success', 'dry_run'] },
      createdAt: { $gte: oneHourAgo },
    });

    return count < config.MAX_POSTS_PER_HOUR;
  }

  /**
   * Applies random 30-60s delay between posts to prevent anti-spam rate flags.
   */
  private async applyPostingJitter(): Promise<void> {
    if (config.DRY_RUN || process.env.NODE_ENV === 'test' || process.env.VERCEL) {
      await new Promise((r) => setTimeout(r, 1000));
      return;
    }

    const min = config.MIN_DELAY_SECONDS;
    const max = config.MAX_DELAY_SECONDS;
    const delaySeconds = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`[QueueWorker] Enforcing anti-spam jitter delay: sleeping for ${delaySeconds} seconds before publish...`);
    await new Promise((r) => setTimeout(r, delaySeconds * 1000));
  }

  /**
   * Graceful fallback: downloads original image buffer directly
   */
  private async fetchOriginalImageFallback(imageUrl?: string | null): Promise<Buffer> {
    if (imageUrl) {
      try {
        const response = await fetch(imageUrl, {
          headers: { 'User-Agent': 'FBAutomationBot/1.0' },
        });
        if (response.ok) {
          const arrayBuf = await response.arrayBuffer();
          return Buffer.from(arrayBuf);
        }
      } catch (err) {
        console.warn(`[QueueWorker] Failed to download original image fallback from ${imageUrl}:`, err);
      }
    }

    const fallbackSvg = await this.renderer.renderToBuffer({
      headline: 'সংবাদ চিত্র',
      imageUrl: undefined,
    });
    return fallbackSvg;
  }

  /**
   * Automatically shares a newly published Facebook Page post to relevant Facebook Groups.
   * Matches groups based on configured category tags, keywords, or wildcard ('all' / '*').
   */
  public async autoShareToRelevantGroups(
    page: FacebookPage,
    article: NewsArticle,
    postId: string
  ): Promise<any[]> {
    const db = getDatabase();
    const groupsCol = db.collection<FacebookGroup>('facebook_groups');
    const shareLogsCol = db.collection<GroupShareLog>('group_share_logs');

    // 1. Fetch active groups configured for this page or 'all'
    const groups = await groupsCol
      .find({
        autoShare: true,
        $or: [
          { pageId: page._id },
          { pageId: { $exists: false } },
          { pageId: 'all' },
          { pageId: '' },
          { pageId: null as any },
        ],
      })
      .toArray();

    if (!groups.length) {
      return [];
    }

    // 2. Filter groups by relevance
    const relevantGroups = groups.filter((g) => this.isGroupRelevant(g, article));

    if (!relevantGroups.length) {
      console.log(`[QueueWorker] No Facebook groups matched relevance criteria for article "${article.title}".`);
      return [];
    }

    console.log(
      `[QueueWorker] Found ${relevantGroups.length} relevant group(s) to share post "${article.title.substring(0, 30)}...": ` +
        relevantGroups.map((g) => g.name).join(', ')
    );

    const postPermalink = `https://www.facebook.com/${postId}`;
    const shareMessage = `🔴 ${article.title}\n\nবিস্তারিত পড়ুন প্রথম কমেন্টে বা লিংকে:`;
    const shareResults: any[] = [];

    for (const group of relevantGroups) {
      const shareStartTime = Date.now();
      // Apply stagger delay to respect Meta API rate limits and avoid spam detection (default 3s on Vercel, 5s elsewhere)
      const delaySec = process.env.VERCEL ? Math.min(group.delaySeconds || 3, 3) : (group.delaySeconds || 5);
      await new Promise((r) => setTimeout(r, delaySec * 1000));

      const tokenToUse = group.accessToken || page.accessToken;
      const shareLogId = crypto.randomUUID();

      try {
        console.log(`[QueueWorker] Sharing to group "${group.name}" (${group._id})...`);
        const { sharePostId } = await this.fbClient.shareToGroup(
          group._id,
          tokenToUse,
          postPermalink,
          shareMessage,
          config.DRY_RUN
        );

        const durationMs = Date.now() - shareStartTime;

        await shareLogsCol.insertOne({
          _id: shareLogId,
          groupId: group._id,
          groupName: group.name,
          articleId: article._id,
          articleTitle: article.title,
          fbPostId: postId,
          sharePostId,
          status: config.DRY_RUN ? 'dry_run' : 'success',
          durationMs,
          createdAt: new Date(),
        } as any);

        await groupsCol.updateOne(
          { _id: group._id },
          {
            $inc: { totalShares: 1 },
            $set: { lastSharedAt: new Date(), updatedAt: new Date() },
          }
        );

        shareResults.push({
          groupId: group._id,
          groupName: group.name,
          status: 'success',
          sharePostId,
        });

        console.log(`✓ [QueueWorker] Successfully shared to group "${group.name}"! Share ID: ${sharePostId}`);
      } catch (err: any) {
        const durationMs = Date.now() - shareStartTime;
        console.warn(`[QueueWorker] Failed to share to group "${group.name}" (${group._id}):`, err.message);

        await shareLogsCol.insertOne({
          _id: shareLogId,
          groupId: group._id,
          groupName: group.name,
          articleId: article._id,
          articleTitle: article.title,
          fbPostId: postId,
          status: 'failed',
          errorMessage: err.message || String(err),
          durationMs,
          createdAt: new Date(),
        } as any);

        shareResults.push({
          groupId: group._id,
          groupName: group.name,
          status: 'failed',
          error: err.message,
        });
      }
    }

    return shareResults;
  }

  /**
   * Determines if a Facebook group is relevant for a given article.
   * Matches wildcard ('all', '*'), category equality, or headline/summary keywords.
   */
  public isGroupRelevant(group: FacebookGroup, article: NewsArticle): boolean {
    if (!group.categories || group.categories.length === 0) return true;

    const normalizedCats = group.categories.map((c) => c.trim().toLowerCase()).filter(Boolean);
    if (
      normalizedCats.includes('all') ||
      normalizedCats.includes('*') ||
      normalizedCats.includes('সব') ||
      normalizedCats.includes('সকল')
    ) {
      return true;
    }

    const articleCat = (article.category || '').trim().toLowerCase();
    const articleTitle = (article.title || '').toLowerCase();
    const articleDesc = (article.description || '').toLowerCase();

    // Check category match
    if (
      articleCat &&
      normalizedCats.some(
        (c) => c === articleCat || articleCat.includes(c) || c.includes(articleCat)
      )
    ) {
      return true;
    }

    // Check keyword match in headline or description
    for (const cat of normalizedCats) {
      if (cat && (articleTitle.includes(cat) || articleDesc.includes(cat))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Manually triggers rendering and publishing of an MP4 Reel for a specific news article
   */
  public async publishReelForArticle(
    articleId: string,
    targetPageId?: string,
    theme?: string,
    durationSeconds: number = 15
  ): Promise<{ success: boolean; videoId?: string; postId?: string; error?: string }> {
    const db = getDatabase();
    const article = await db.collection<NewsArticle>('news_articles').findOne({ _id: articleId });
    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }

    let page: FacebookPage | null = null;
    if (targetPageId) {
      page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: targetPageId });
    }
    if (!page) {
      page = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
    }
    if (!page) {
      throw new Error('No active Facebook Page found');
    }

    let selectedTheme = theme;
    if (!selectedTheme || selectedTheme === 'rolling') {
      selectedTheme = await getNextRollingReelTheme(db);
      console.log(`[QueueWorker] 🔄 Rolling Rotation selected: "${selectedTheme}" for article: "${article.title}"`);
    }

    const startTime = Date.now();
    const reelBuffer = await this.reelRenderer.renderReel({
      headline: article.title,
      category: article.category || 'বিশেষ খবর',
      imageUrl: article.imageUrl || undefined,
      theme: selectedTheme,
      durationSeconds,
      fps: 15,
    });

    // Caption: ONLY hashtags (no headline, no summary)
    const hashtagSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_HASHTAGS' });
    const configuredHashtags = hashtagSetting?.value || config.DEFAULT_HASHTAGS;
    const caption = (configuredHashtags + ' #Reels #FBReels #Bangladesh #NewsUpdate').trim();

    try {
      const { videoId, postId } = await this.fbClient.publishReel(
        page._id,
        page.accessToken,
        reelBuffer,
        caption,
        undefined, // No title/headline in post metadata
        config.DRY_RUN
      );

      // News URL in First Comment
      if (article.link && postId) {
        try {
          const commentFormatSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_COMMENT_FORMAT' });
          const commentTemplate = commentFormatSetting?.value || config.DEFAULT_COMMENT_FORMAT;
          const commentText = this.fbClient.formatComment(article.link, commentTemplate);
          await this.fbClient.publishComment(postId, page.accessToken, commentText, config.DRY_RUN);
          console.log(`✓ [QueueWorker] First comment with news URL posted to Reel ${postId}!`);
        } catch (cErr: any) {
          console.warn(`[QueueWorker] Could not post first comment on Reel:`, cErr.message);
        }
      }

      await db.collection<ReelLog>('reel_logs').insertOne({
        _id: crypto.randomUUID(),
        articleId: article._id,
        articleTitle: article.title,
        pageId: page._id,
        pageName: page.name,
        theme: selectedTheme,
        fbVideoId: videoId,
        fbPostId: postId,
        durationMs: Date.now() - startTime,
        status: config.DRY_RUN ? 'dry_run' : 'success',
        createdAt: new Date(),
      });

      return { success: true, videoId, postId };
    } catch (publishErr: any) {
      console.error(`[QueueWorker] Manual Reel publish failed:`, publishErr.message);
      await db.collection<ReelLog>('reel_logs').insertOne({
        _id: crypto.randomUUID(),
        articleId: article._id,
        articleTitle: article.title,
        pageId: page._id,
        pageName: page.name,
        theme: selectedTheme,
        fbVideoId: '',
        fbPostId: '',
        durationMs: Date.now() - startTime,
        status: 'failed',
        errorMessage: publishErr.message,
        createdAt: new Date(),
      });
      return { success: false, error: publishErr.message };
    }
  }

  /**
   * Manually render and publish a JPG news card to Facebook Page Stories (NOT feed)
   */
  public async publishStoryForArticle(
    articleId: string,
    pageId?: string
  ): Promise<{ success: boolean; photoId: string; storyId: string; pageName: string }> {
    const db = getDatabase();
    const article = await db.collection<NewsArticle>('news_articles').findOne({ _id: articleId });
    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }

    let page: FacebookPage | null = null;
    if (pageId && pageId !== 'all') {
      page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: pageId });
    }
    if (!page) {
      page = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
    }
    if (!page) {
      throw new Error('No active Facebook Page found');
    }

    const storyStartTime = Date.now();
    const renderResult = await this.canvasRenderer.render({
      templateId: 'template-canva-bdnews',
      headline: article.title,
      category: article.category || 'বিশেষ খবর',
      imageUrl: article.imageUrl || undefined,
    });

    const { photoId, storyId } = await this.fbClient.publishPhotoStory(
      page._id,
      page.accessToken,
      renderResult.imageBuffer,
      config.DRY_RUN
    );

    await db.collection<StoryLog>('story_logs').insertOne({
      _id: crypto.randomUUID(),
      articleId: article._id,
      articleTitle: article.title,
      pageId: page._id,
      pageName: page.name,
      fbPhotoId: photoId,
      fbStoryId: storyId,
      renderedImagePath: renderResult.outputPath || null,
      durationMs: Date.now() - storyStartTime,
      status: config.DRY_RUN ? 'dry_run' : 'success',
      createdAt: new Date(),
    });

    return { success: true, photoId, storyId, pageName: page.name };
  }

  /**
   * Manually upload an article's 15s MP4 reel to YouTube Shorts
   */
  public async uploadShortForArticle(
    articleId: string
  ): Promise<{ success: boolean; videoId: string; videoUrl: string }> {
    const db = getDatabase();
    const article = await db.collection<NewsArticle>('news_articles').findOne({ _id: articleId });
    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }

    const reelBuffer = await this.reelRenderer.renderReel({
      headline: article.title,
      category: article.category || 'বিশেষ খবর',
      imageUrl: article.imageUrl || undefined,
      theme: 'vertical-916', // YouTube Shorts prefers 9:16 vertical fullscreen
      durationSeconds: 15,
      fps: 20,
    });

    const hashtagSetting = await db.collection<Setting>('settings').findOne({ _id: 'DEFAULT_HASHTAGS' });
    const configuredHashtags = hashtagSetting?.value || config.DEFAULT_HASHTAGS;

    const ytStartTime = Date.now();
    try {
      const result = await this.ytClient.uploadShort(
        {
          videoBuffer: reelBuffer,
          title: article.title,
          description: `${configuredHashtags} #Shorts #YouTubeShorts\n\nবিস্তারিত পড়ুন: ${article.link}`,
        },
        config.DRY_RUN
      );

      if (article.link && result.videoId && !config.DRY_RUN) {
        await this.ytClient.addComment(result.videoId, `বিস্তারিত খবর পড়ুন: ${article.link}`);
      }

      await db.collection<YouTubeUploadLog>('youtube_upload_logs').insertOne({
        _id: crypto.randomUUID(),
        articleId: article._id,
        articleTitle: article.title,
        ytVideoId: result.videoId,
        ytVideoUrl: result.videoUrl,
        durationMs: Date.now() - ytStartTime,
        status: config.DRY_RUN ? 'dry_run' : 'success',
        createdAt: new Date(),
      });

      return { success: true, videoId: result.videoId, videoUrl: result.videoUrl };
    } catch (ytErr: any) {
      const ytErrMsg = ytErr.message || String(ytErr);
      await db.collection<YouTubeUploadLog>('youtube_upload_logs').insertOne({
        _id: crypto.randomUUID(),
        articleId: article._id,
        articleTitle: article.title,
        ytVideoId: '',
        ytVideoUrl: '',
        durationMs: Date.now() - ytStartTime,
        status: 'failed',
        errorMessage: ytErrMsg,
        createdAt: new Date(),
      });
      throw ytErr;
    }
  }
}
