import cron, { type ScheduledTask } from 'node-cron';
import type { SportsClipPipeline } from './pipeline.js';
import type { CopyrightMonitor } from '../monitoring/copyright-monitor.js';
import { logger } from '../logger.js';

export class SchedulerService {
  private pipeline: SportsClipPipeline;
  private monitor: CopyrightMonitor;
  private tasks: ScheduledTask[] = [];

  constructor(pipeline: SportsClipPipeline, monitor: CopyrightMonitor) {
    this.pipeline = pipeline;
    this.monitor = monitor;
  }

  public start(): void {
    logger.info('Initializing node-cron scheduler tasks...');

    // 1. Ingestion & Transformation pipeline (every 2 hours: at minute 0)
    const pipelineTask = cron.schedule('0 */2 * * *', async () => {
      logger.info('[CRON] Triggering scheduled pipeline cycle...');
      try {
        await this.pipeline.runCycle();
      } catch (err: any) {
        logger.error({ err: err.message }, '[CRON] Pipeline cycle error');
      }
    });
    this.tasks.push(pipelineTask);

    // 2. Copyright and Policy Monitoring task (every 30 minutes)
    const monitorTask = cron.schedule('*/30 * * * *', async () => {
      logger.info('[CRON] Polling YouTube & Facebook for copyright and policy strikes...');
      try {
        await this.monitor.pollPublishedPosts();
      } catch (err: any) {
        logger.error({ err: err.message }, '[CRON] Copyright monitoring error');
      }
    });
    this.tasks.push(monitorTask);

    logger.info('Scheduler started: Pipeline runs every 2 hours, Monitoring polls every 30 minutes.');
  }

  public stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    logger.info('Scheduler stopped all background cron tasks.');
  }
}
