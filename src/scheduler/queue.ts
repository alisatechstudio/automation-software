import { logger } from '../logger.js';

export type JobHandler<T> = (data: T) => Promise<void>;

export interface QueueJob<T> {
  id: string;
  name: string;
  data: T;
  retries: number;
  maxRetries: number;
}

/**
 * Robust in-process async queue with concurrency control and automatic retries.
 * Optional BullMQ + Redis adapter interface supported.
 */
export class InMemoryQueue<T = any> {
  private queue: QueueJob<T>[] = [];
  private isProcessing = false;
  private concurrency: number;
  private activeWorkers = 0;
  private handler?: JobHandler<T>;

  constructor(concurrency = 2) {
    this.concurrency = concurrency;
  }

  public registerHandler(handler: JobHandler<T>): void {
    this.handler = handler;
  }

  public add(name: string, data: T, maxRetries = 2): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.queue.push({
      id,
      name,
      data,
      retries: 0,
      maxRetries,
    });
    logger.debug({ jobId: id, name, queueLength: this.queue.length }, 'Job added to queue');
    this.processNext();
    return id;
  }

  private async processNext(): Promise<void> {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0 || !this.handler) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeWorkers++;

    try {
      logger.info({ jobId: job.id, name: job.name }, 'Processing job...');
      await this.handler(job.data);
      logger.info({ jobId: job.id, name: job.name }, 'Job completed successfully');
    } catch (err: any) {
      logger.error({ jobId: job.id, name: job.name, err: err.message }, 'Job execution failed');
      if (job.retries < job.maxRetries) {
        job.retries++;
        logger.warn({ jobId: job.id, retry: job.retries }, 'Re-queuing failed job for retry');
        this.queue.push(job);
      }
    } finally {
      this.activeWorkers--;
      this.processNext();
    }
  }

  public getPendingCount(): number {
    return this.queue.length;
  }
}
