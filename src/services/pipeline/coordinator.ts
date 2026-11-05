import cron, { ScheduledTask } from 'node-cron';
import { ArticleDedupeService } from '../rss/dedupe.js';
import { QueueWorker } from '../queue/worker.js';
import { isMongoConnected, initMongoDb } from '../../db/index.js';
import { config } from '../../config/env.js';

export class PipelineCoordinator {
  private dedupeService: ArticleDedupeService;
  private worker: QueueWorker;
  private cronTask: ScheduledTask | null = null;

  constructor() {
    this.dedupeService = new ArticleDedupeService();
    this.worker = new QueueWorker();
  }

  public async start(): Promise<void> {
    console.log('[Coordinator] Initializing automation pipeline coordinator...');

    // 1. Start queue worker
    this.worker.start();

    // 2. Perform initial RSS poll upon startup if MongoDB is ready
    if (isMongoConnected()) {
      console.log('[Coordinator] Triggering initial RSS poll on startup...');
      this.dedupeService
        .pollAllActiveSources()
        .catch((err) => console.error('[Coordinator] Initial poll error:', err));
    } else {
      console.log('[Coordinator] Waiting for MongoDB connection before initial RSS poll...');
    }

    // 3. Schedule cron job
    const cronExpr = config.POLL_INTERVAL_CRON;
    if (cron.validate(cronExpr)) {
      this.cronTask = cron.schedule(cronExpr, async () => {
        console.log(`[Coordinator - Cron] Running scheduled RSS poll at ${new Date().toISOString()}`);
        try {
          if (!isMongoConnected()) {
            await initMongoDb();
          }
          if (isMongoConnected()) {
            await this.dedupeService.pollAllActiveSources();
          }
        } catch (err) {
          console.error('[Coordinator - Cron] Error during scheduled RSS poll:', err);
        }
      });
      console.log(`[Coordinator] Scheduled RSS polling with cron: "${cronExpr}"`);
    } else {
      console.warn(`[Coordinator] Invalid cron expression "${cronExpr}". Scheduled polling disabled.`);
    }
  }

  public stop(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
    this.worker.stop();
    console.log('[Coordinator] Pipeline coordinator stopped cleanly.');
  }
}

