import crypto from 'crypto';
import { getDatabase } from '../../db/index.js';
import { Job, JobStatus, JobPayload } from '../../db/schema.js';

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export class PersistentJobQueue {
  /**
   * Enqueues a new job
   */
  public async enqueue(
    type: string,
    payload: JobPayload,
    articleId?: string,
    pageId?: string,
    runAtSecondsFromNow: number = 0
  ): Promise<string> {
    const db = getDatabase();
    const jobsCol = db.collection<Job>('jobs');
    const jobId = crypto.randomUUID();

    const runAt =
      runAtSecondsFromNow > 0
        ? new Date(Date.now() + runAtSecondsFromNow * 1000)
        : new Date();

    const jobDoc: Job = {
      _id: jobId,
      type,
      articleId: articleId || null,
      pageId: pageId || null,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      runAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await jobsCol.insertOne(jobDoc as any);
    return jobId;
  }

  /**
   * Atomically fetches the next available job whose runAt <= NOW
   * and sets status to 'processing'
   */
  public async fetchNextJob(): Promise<Job | null> {
    const db = getDatabase();
    const jobsCol = db.collection<Job>('jobs');

    const result = await jobsCol.findOneAndUpdate(
      {
        status: 'pending',
        runAt: { $lte: new Date() },
      },
      {
        $set: {
          status: 'processing',
          updatedAt: new Date(),
        },
      },
      {
        sort: { runAt: 1, createdAt: 1 },
        returnDocument: 'after',
      }
    );

    return result || null;
  }

  /**
   * Marks a job as completed
   */
  public async markCompleted(jobId: string): Promise<void> {
    const db = getDatabase();
    const jobsCol = db.collection<Job>('jobs');
    await jobsCol.updateOne(
      { _id: jobId },
      {
        $set: {
          status: 'completed',
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Records a failure with exponential backoff or marks as failed if retries exhausted.
   * Returns true if job was rescheduled, false if it reached final failure.
   */
  public async handleFailure(job: Job, errorMessage: string, baseBackoffSeconds: number = 60): Promise<boolean> {
    const db = getDatabase();
    const jobsCol = db.collection<Job>('jobs');
    const newAttempts = job.attempts + 1;

    if (newAttempts < job.maxAttempts) {
      // Exponential backoff: 2^(attempts-1) * baseBackoff (e.g. 1m, 2m, 4m...)
      const backoffSeconds = Math.pow(2, newAttempts - 1) * baseBackoffSeconds;
      const nextRunAt = new Date(Date.now() + backoffSeconds * 1000);

      await jobsCol.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'pending',
            attempts: newAttempts,
            runAt: nextRunAt,
            lastError: errorMessage,
            updatedAt: new Date(),
          },
        }
      );

      console.log(
        `[JobQueue] Job ${job._id} failed (attempt ${newAttempts}/${job.maxAttempts}). Rescheduled for ${nextRunAt.toISOString()} (+${backoffSeconds}s). Error: ${errorMessage}`
      );
      return true;
    } else {
      // Final failure
      await jobsCol.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'failed',
            attempts: newAttempts,
            lastError: errorMessage,
            updatedAt: new Date(),
          },
        }
      );

      console.error(
        `[JobQueue] Job ${job._id} PERMANENTLY FAILED after ${newAttempts} attempts: ${errorMessage}`
      );
      return false;
    }
  }

  /**
   * Resets a failed job to pending for manual retry
   */
  public async retryFailedJob(jobId: string): Promise<boolean> {
    const db = getDatabase();
    const jobsCol = db.collection<Job>('jobs');
    const res = await jobsCol.updateOne(
      { _id: jobId, status: 'failed' },
      {
        $set: {
          status: 'pending',
          attempts: 0,
          lastError: null,
          runAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return res.modifiedCount > 0;
  }

  /**
   * Returns statistics about the queue
   */
  public async getStats(): Promise<QueueStats> {
    const db = getDatabase();
    const jobsCol = db.collection<Job>('jobs');

    const counts = await jobsCol
      .aggregate<{ _id: JobStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .toArray();

    const stats: QueueStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    for (const r of counts) {
      if (r._id in stats) {
        (stats as any)[r._id] = r.count;
      }
      stats.total += r.count;
    }

    return stats;
  }
}
