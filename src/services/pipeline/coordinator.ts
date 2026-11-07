import cron, { ScheduledTask } from 'node-cron';
import { InputPipelineService, InputCronResult } from './input-pipeline.js';
import { QueueWorker } from '../queue/worker.js';
import { GDriveReelService } from '../gdrive/service.js';
import { isMongoConnected, initMongoDb } from '../../db/index.js';
import { config } from '../../config/env.js';

export class PipelineCoordinator {
  private inputPipeline: InputPipelineService;
  private worker: QueueWorker;
  private gdriveReelService: GDriveReelService;
  private inputCronTask: ScheduledTask | null = null;
  private lastInputRun: Date | null = null;
  private lastOutputRun: Date | null = null;

  constructor() {
    this.inputPipeline = new InputPipelineService();
    this.worker = new QueueWorker();
    this.gdriveReelService = new GDriveReelService();
  }

  public getInputPipeline(): InputPipelineService {
    return this.inputPipeline;
  }

  public getGdriveService(): GDriveReelService {
    return this.gdriveReelService;
  }

  public getStatus() {
    return {
      inputCronActive: !!this.inputCronTask,
      inputCronSchedule: config.POLL_INTERVAL_CRON,
      lastInputRun: this.lastInputRun,
      lastOutputRun: this.lastOutputRun,
      workerRunning: true,
    };
  }

  public async start(): Promise<void> {
    console.log('[Coordinator] 🚀 Initializing 2-Stage Automation Pipeline (Input Cron -> Google Drive -> Output Cron)...');

    // 1. Start queue worker for background reliability
    this.worker.start();

    // 2. Start Stage 2: Output Cron (Folder-wise Google Drive -> Facebook + YouTube + TikTok)
    try {
      await this.gdriveReelService.startScheduler();
      console.log('[Coordinator] ✓ Stage 2 (Output Cron - Folder-wise) scheduler active.');
    } catch (gErr: any) {
      console.warn('[Coordinator] Note starting Google Drive Output Reel scheduler:', gErr.message);
    }

    // 3. Stage 1: Input Cron Scheduler (RSS -> Render Reel -> Save to Linked Drive Folder)
    const cronExpr = config.POLL_INTERVAL_CRON || '0 * * * *';
    if (cron.validate(cronExpr)) {
      this.inputCronTask = cron.schedule(cronExpr, async () => {
        console.log(`[Coordinator - Input Cron] Running scheduled Input Pipeline at ${new Date().toISOString()}`);
        try {
          if (!isMongoConnected()) {
            await initMongoDb();
          }
          if (isMongoConnected()) {
            this.lastInputRun = new Date();
            await this.inputPipeline.runInputCron();
          }
        } catch (err) {
          console.error('[Coordinator - Input Cron] Error during scheduled input run:', err);
        }
      });
      console.log(`[Coordinator] ✓ Stage 1 (Input Cron) scheduled with cron: "${cronExpr}"`);
    } else {
      console.warn(`[Coordinator] Invalid cron expression "${cronExpr}". Scheduled polling disabled.`);
    }

    // 4. Initial execution on startup if database is ready
    if (isMongoConnected()) {
      console.log('[Coordinator] Database ready. Triggering initial Input Cron check in background...');
      setTimeout(() => {
        this.inputPipeline
          .runInputCron()
          .then(() => {
            this.lastInputRun = new Date();
          })
          .catch((err) => console.warn('[Coordinator] Initial Input Cron note:', err.message));
      }, 5000);
    }
  }

  /**
   * Manually executes Stage 1 (Input Cron: RSS -> Reels -> Save to Drive Folder)
   */
  public async runInputNow(options?: { sourceId?: string; pageId?: string; force?: boolean }): Promise<InputCronResult> {
    this.lastInputRun = new Date();
    return await this.inputPipeline.runInputCron(options);
  }

  /**
   * Manually executes Stage 2 (Output Cron: Folder-wise Get Oldest from Drive -> Post to FB + YouTube + TikTok)
   */
  public async runOutputNow(options?: { channelId?: string; pageId?: string; force?: boolean }) {
    this.lastOutputRun = new Date();
    return await this.gdriveReelService.publishAllDueChannels({
      force: options?.force !== false,
      channelId: options?.channelId,
      pageId: options?.pageId,
    });
  }

  public stop(): void {
    if (this.inputCronTask) {
      this.inputCronTask.stop();
      this.inputCronTask = null;
    }
    this.gdriveReelService.stopScheduler();
    this.worker.stop();
    console.log('[Coordinator] Automation pipeline coordinator stopped cleanly.');
  }
}
