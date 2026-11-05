import crypto from 'crypto';
import { getDatabase } from '../../db/index.js';
import { NewsArticle, FacebookPage, RssSource, Job } from '../../db/schema.js';
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
    console.log('[QueueWorker] Started persistent queue worker.');
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
    try {
      const job = this.queue.fetchNextJob();
      if (job) {
        await this.processJob(job);
        // Process next available job with a brief pause
        this.scheduleNextTick(2000);
      } else {
        // No jobs pending, wait before polling again
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

    console.log(`[QueueWorker] Processing job ${job.id} (type: ${job.type}, attempt: ${job.attempts + 1}/${job.max_attempts})...`);

    if (job.type !== 'process_article') {
      console.log(`[QueueWorker] Unknown job type: ${job.type}. Marking completed.`);
      this.queue.markCompleted(job.id);
      return;
    }

    const payload = JSON.parse(job.payload);
    const { articleId, pageId, templateId } = payload;

    const article = db.prepare('SELECT * FROM news_articles WHERE id = ?').get(articleId) as NewsArticle | undefined;
    const page = db.prepare('SELECT * FROM facebook_pages WHERE id = ?').get(pageId) as FacebookPage | undefined;
    const source = article ? (db.prepare('SELECT * FROM rss_sources WHERE id = ?').get(article.source_id) as RssSource | undefined) : undefined;

    if (!article || !page) {
      const errMsg = `Missing dependencies for job ${job.id}: article=${!!article}, page=${!!page}`;
      console.error(`[QueueWorker] ${errMsg}`);
      this.queue.markCompleted(job.id); // Cannot be processed, discard
      return;
    }

    try {
      // 1. Hourly Rate Cap Enforcement
      const isUnderCap = this.checkHourlyCap(page.id);
      if (!isUnderCap) {
        console.warn(`[QueueWorker] Hourly post cap (${config.MAX_POSTS_PER_HOUR}/hr) reached for page ${page.name} (${page.id}). Rescheduling job in 10 minutes.`);
        // Reschedule job 10 mins from now
        db.prepare(`
          UPDATE jobs
          SET status = 'pending', run_at = datetime('now', '+10 minutes'), updated_at = datetime('now')
          WHERE id = ?
        `).run(job.id);
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
          templateId: templateId || source?.template_id,
          headline: article.title,
          category: article.category || 'সাধারণ',
          dateText: new Intl.DateTimeFormat('bn-BD', { dateStyle: 'full' }).format(new Date(article.pub_date)),
          imageUrl: article.image_url || undefined,
        });
        renderedBuffer = renderResult.imageBuffer;
        renderedPath = renderResult.outputPath;
      } catch (renderError: any) {
        console.warn(`[QueueWorker] Playwright render failed: ${renderError.message}. Initiating graceful fallback to original news image...`);
        renderedBuffer = await this.fetchOriginalImageFallback(article.image_url);
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
        page.id,
        page.access_token,
        renderedBuffer,
        caption,
        config.DRY_RUN
      );

      console.log(`[QueueWorker] Adding news link as first comment to post ${postId}...`);
      const { commentId } = await this.fbClient.publishComment(
        postId,
        page.access_token,
        commentText,
        config.DRY_RUN
      );

      const durationMs = Date.now() - startTime;

      // 6. Record Post Log
      const logId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO post_logs (
          id, article_id, page_id, fb_photo_id, fb_post_id, fb_comment_id,
          rendered_image_path, caption, comment, duration_ms, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        logId,
        article.id,
        page.id,
        photoId,
        postId,
        commentId,
        renderedPath || null,
        caption,
        commentText,
        durationMs,
        config.DRY_RUN ? 'dry_run' : 'success'
      );

      // Update article status & mark job completed
      db.prepare("UPDATE news_articles SET status = 'published' WHERE id = ?").run(article.id);
      this.queue.markCompleted(job.id);

      console.log(`✓ [QueueWorker] Successfully processed & published article "${article.title.substring(0, 40)}..." (Took ${durationMs}ms)`);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err.message || String(err);
      console.error(`[QueueWorker] Error processing job ${job.id}:`, errorMessage);

      const willRetry = this.queue.handleFailure(job, errorMessage);

      if (!willRetry) {
        // Retries completely exhausted: Final Failure State
        db.prepare("UPDATE news_articles SET status = 'failed' WHERE id = ?").run(article.id);

        // Record failure in post_logs
        const logId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO post_logs (
            id, article_id, page_id, duration_ms, status, error_message
          ) VALUES (?, ?, ?, ?, 'failed', ?)
        `).run(logId, article.id, page.id, durationMs, errorMessage);

        // Dispatch Telegram Bot Alert
        await this.alertService.sendFailureAlert({
          articleTitle: article.title,
          sourceName: source?.name,
          pageId: page.id,
          attempts: job.max_attempts,
          maxAttempts: job.max_attempts,
          errorMessage,
          articleUrl: article.link,
        });
      }
    }
  }

  /**
   * Enforces max posts-per-hour cap for a specific page
   */
  private checkHourlyCap(pageId: string): boolean {
    const db = getDatabase();
    const result = db
      .prepare(`
        SELECT COUNT(*) as count
        FROM post_logs
        WHERE page_id = ?
          AND status IN ('success', 'dry_run')
          AND datetime(created_at) >= datetime('now', '-1 hour')
      `)
      .get(pageId) as { count: number };

    return result.count < config.MAX_POSTS_PER_HOUR;
  }

  /**
   * Applies random 30-60s delay between posts to prevent anti-spam rate flags.
   * If in DRY_RUN or testing, uses a minimal 500ms delay.
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
   * Graceful fallback: downloads the original article image buffer directly
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

    // Ultimate fallback: render the fallback image buffer directly
    const fallbackSvg = await this.renderer.renderToBuffer({
      headline: 'সংবাদ চিত্র',
      imageUrl: undefined,
    });
    return fallbackSvg;
  }
}

