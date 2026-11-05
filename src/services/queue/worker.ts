import crypto from 'crypto';
import { getDatabase, isMongoConnected } from '../../db/index.js';
import { NewsArticle, FacebookPage, RssSource, Job, PostLog } from '../../db/schema.js';
import { PersistentJobQueue } from './queue.js';
import { PlaywrightImageRenderer } from '../renderer/playwright.js';
import { FacebookGraphClient } from '../facebook/client.js';
import { TelegramAlertService } from '../alert/telegram.js';
import { config } from '../../config/env.js';

export class QueueWorker {
  private queue: PersistentJobQueue;
  private renderer: PlaywrightImageRenderer;
  private fbClient: FacebookGraphClient;
  private alertService: TelegramAlertService;
  private isRunning: boolean = false;
  private loopTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.queue = new PersistentJobQueue();
    this.renderer = new PlaywrightImageRenderer();
    this.fbClient = new FacebookGraphClient();
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
    const page = await pagesCol.findOne({ _id: pageId });
    const source = article ? await sourcesCol.findOne({ _id: article.sourceId }) : null;

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

      // 3. Render Image with Graceful Fallback
      let renderedBuffer: Buffer;
      let renderedPath: string | undefined;

      try {
        console.log(`[QueueWorker] Rendering image for article "${article.title}" with template ${templateId}...`);
        const renderResult = await this.renderer.render({
          templateId: templateId || source?.templateId,
          headline: article.title,
          category: article.category || 'সাধারণ',
          dateText: new Intl.DateTimeFormat('bn-BD', { dateStyle: 'full' }).format(new Date(article.pubDate)),
          imageUrl: article.imageUrl || undefined,
        });
        renderedBuffer = renderResult.imageBuffer;
        renderedPath = renderResult.outputPath;
      } catch (renderError: any) {
        console.warn(`[QueueWorker] Playwright render failed: ${renderError.message}. Initiating graceful fallback to original news image...`);
        renderedBuffer = await this.fetchOriginalImageFallback(article.imageUrl);
      }

      // 4. Format Caption & First Comment
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

      // 5. Publish to Facebook Page (or Dry-Run)
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

      // 6. Record Post Log
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
    if (config.DRY_RUN || process.env.NODE_ENV === 'test') {
      await new Promise((r) => setTimeout(r, 200));
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
}
