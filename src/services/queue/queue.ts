import crypto from 'crypto';
import { getDatabase } from '../../db/index.js';
import { Job, JobStatus } from '../../db/schema.js';

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
  public enqueue(
    type: string,
    payload: any,
    articleId?: string,
    pageId?: string,
    runAtSecondsFromNow: number = 0
  ): string {
    const db = getDatabase();
    const jobId = crypto.randomUUID();

    const runAt =
      runAtSecondsFromNow > 0
        ? new Date(Date.now() + runAtSecondsFromNow * 1000).toISOString()
        : new Date().toISOString();

    db.prepare(`
      INSERT INTO jobs (id, type, article_id, page_id, payload, status, attempts, max_attempts, run_at)
      VALUES (?, ?, ?, ?, ?, 'pending', 0, 3, ?)
    `).run(jobId, type, articleId || null, pageId || null, JSON.stringify(payload), runAt);

    return jobId;
  }

  /**
   * Atomically fetches the next available job whose run_at <= NOW
   * and marks it as 'processing'
   */
  public fetchNextJob(): Job | null {
    const db = getDatabase();

    let selectedJob: Job | null = null;

    const tx = db.transaction(() => {
      // Find the oldest pending job that is ready to run
      const job = db
        .prepare(`
          SELECT * FROM jobs
          WHERE status = 'pending' AND datetime(run_at) <= datetime('now')
          ORDER BY datetime(run_at) ASC, created_at ASC
          LIMIT 1
        `)
        .get() as Job | undefined;

      if (job) {
        db.prepare(`
          UPDATE jobs
          SET status = 'processing', updated_at = datetime('now')
          WHERE id = ?
        `).run(job.id);

        selectedJob = { ...job, status: 'processing' };
      }
    });

    tx();
    return selectedJob;
  }

  /**
   * Marks a job as completed
   */
  public markCompleted(jobId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE jobs
      SET status = 'completed', updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);
  }

  /**
   * Records a failure with exponential backoff or marks as failed if retries exhausted.
   * Returns true if job was rescheduled, false if it reached final failure.
   */
  public handleFailure(job: Job, errorMessage: string, baseBackoffSeconds: number = 60): boolean {
    const db = getDatabase();
    const newAttempts = job.attempts + 1;

    if (newAttempts < job.max_attempts) {
      // Exponential backoff: 2^(attempts-1) * baseBackoff (e.g. 1m, 2m, 4m...)
      const backoffSeconds = Math.pow(2, newAttempts - 1) * baseBackoffSeconds;
      const nextRunAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

      db.prepare(`
        UPDATE jobs
        SET status = 'pending',
            attempts = ?,
            run_at = ?,
            last_error = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(newAttempts, nextRunAt, errorMessage, job.id);

      console.log(
        `[JobQueue] Job ${job.id} failed (attempt ${newAttempts}/${job.max_attempts}). Rescheduled for ${nextRunAt} (+${backoffSeconds}s). Error: ${errorMessage}`
      );
      return true;
    } else {
      // Final failure
      db.prepare(`
        UPDATE jobs
        SET status = 'failed',
            attempts = ?,
            last_error = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(newAttempts, errorMessage, job.id);

      console.error(
        `[JobQueue] Job ${job.id} PERMANENTLY FAILED after ${newAttempts} attempts: ${errorMessage}`
      );
      return false;
    }
  }

  /**
   * Resets a failed job to pending for manual retry
   */
  public retryFailedJob(jobId: string): boolean {
    const db = getDatabase();
    const res = db.prepare(`
      UPDATE jobs
      SET status = 'pending', attempts = 0, last_error = NULL, run_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status = 'failed'
    `).run(jobId);

    return res.changes > 0;
  }

  /**
   * Returns statistics about the queue
   */
  public getStats(): QueueStats {
    const db = getDatabase();
    const rows = db
      .prepare('SELECT status, COUNT(*) as count FROM jobs GROUP BY status')
      .all() as { status: JobStatus; count: number }[];

    const stats: QueueStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    for (const r of rows) {
      if (r.status in stats) {
        (stats as any)[r.status] = r.count;
      }
      stats.total += r.count;
    }

    return stats;
  }
}

