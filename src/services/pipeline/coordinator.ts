import { InputPipelineService, InputCronResult } from './input-pipeline.js';
import { QueueWorker } from '../queue/worker.js';
import { GDriveReelService } from '../gdrive/service.js';
import { isMongoConnected, initMongoDb } from '../../db/index.js';
import { config } from '../../config/env.js';

export class PipelineCoordinator {
  private inputPipeline: InputPipelineService;
  private worker: QueueWorker;
  private gdriveReelService: GDriveReelService;
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
      inputCronActive: false,
      inputCronSchedule: 'External Webhook (cron-job.org: /api/cron/input)',
      outputCronSchedule: 'External Webhook (cron-job.org: /api/cron/output)',
      lastInputRun: this.lastInputRun,
      lastOutputRun: this.lastOutputRun,
      workerRunning: false,
    };
  }

  public async start(): Promise<void> {
    console.log('[Coordinator] 🚀 2-Stage Automation Pipeline Ready (External Crons via cron-job.org).');
    console.log('[Coordinator] ℹ️ All internal crons deleted. Triggers are 100% external webhooks (/api/cron/input & /api/cron/output).');
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
    console.log('[Coordinator] Automation pipeline coordinator stopped cleanly.');
  }
}
