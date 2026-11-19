import { getDatabase } from '../db/index.js';
import { getDbSetting, setDbSetting } from './settings.js';
import { logger } from '../logger.js';

export interface CronJobSchedule {
  timezone?: string;
  hours?: number[];
  minutes?: number[];
  mdays?: number[];
  months?: number[];
  wdays?: number[];
  expiresAt?: number;
}

export interface CronJobItem {
  jobId: number;
  enabled: boolean;
  title: string;
  saveResponses?: boolean;
  url: string;
  lastStatus?: number; // 0=Unknown, 1=OK, 2=Failed, 4=Timeout, etc.
  lastDuration?: number; // ms
  lastExecution?: number; // unix timestamp
  nextExecution?: number; // unix timestamp
  type?: number;
  requestTimeout?: number;
  redirectSuccess?: boolean;
  folderId?: number;
  schedule: CronJobSchedule;
  requestMethod?: number; // 0=GET, 1=POST
}

export interface CronJobHistoryItem {
  jobLogId: number;
  jobId: number;
  identifier: string;
  date: number; // unix timestamp
  datePlanned: number;
  jitter: number;
  url: string;
  duration: number; // ms
  status: number; // 1=OK, 2=Failed, etc.
  statusText?: string;
  httpStatus?: number;
}

export class CronJobOrgService {
  private static readonly API_BASE = 'https://api.cron-job.org';

  /**
   * Fetches active API key from DB settings or environment
   */
  public async getApiKey(): Promise<string> {
    try {
      const db = getDatabase();
      if (db) {
        const doc = await db.collection('settings').findOne({
          $or: [{ key: 'CRONJOB_API_KEY' }, { _id: 'CRONJOB_API_KEY' as any }],
        });
        if (doc?.value) return String(doc.value).trim();
      }
    } catch {}
    return (process.env.CRONJOB_API_KEY || '').trim();
  }

  /**
   * Saves updated API Key into MongoDB settings & process.env
   */
  public async saveApiKey(apiKey: string): Promise<void> {
    const cleanKey = (apiKey || '').trim();
    process.env.CRONJOB_API_KEY = cleanKey;
    try {
      const db = getDatabase();
      if (db) {
        await db.collection('settings').replaceOne(
          { _id: 'CRONJOB_API_KEY' as any },
          { _id: 'CRONJOB_API_KEY', key: 'CRONJOB_API_KEY', value: cleanKey, updatedAt: new Date() },
          { upsert: true }
        );
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed saving CRONJOB_API_KEY to database');
    }
  }

  /**
   * Tests API key validity against cron-job.org
   */
  public async testConnection(apiKey?: string): Promise<{ valid: boolean; jobsCount?: number; error?: string }> {
    const key = apiKey || (await this.getApiKey());
    if (!key) return { valid: false, error: 'No cron-job.org API Key configured' };

    try {
      const res = await fetch(`${CronJobOrgService.API_BASE}/jobs`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        return { valid: true, jobsCount: Array.isArray(data.jobs) ? data.jobs.length : 0 };
      }
      const errText = await res.text();
      return { valid: false, error: `cron-job.org returned HTTP ${res.status}: ${errText}` };
    } catch (e: any) {
      return { valid: false, error: e.message };
    }
  }

  /**
   * Lists all cron jobs
   */
  public async listJobs(apiKey?: string): Promise<{ jobs: CronJobItem[]; error?: string }> {
    const key = apiKey || (await this.getApiKey());
    if (!key) return { jobs: [], error: 'API key is missing. Please save your cron-job.org API Key.' };

    try {
      const res = await fetch(`${CronJobOrgService.API_BASE}/jobs`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { jobs: [], error: (errJson as any)?.error?.message || `HTTP ${res.status} from cron-job.org` };
      }
      const data = (await res.json()) as any;
      return { jobs: data.jobs || [] };
    } catch (e: any) {
      return { jobs: [], error: e.message };
    }
  }

  /**
   * Retrieves single job details
   */
  public async getJob(jobId: number | string): Promise<{ job?: any; error?: string }> {
    const key = await this.getApiKey();
    if (!key) return { error: 'API key is missing' };

    try {
      const res = await fetch(`${CronJobOrgService.API_BASE}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const data = (await res.json()) as any;
      return { job: data.jobDetails || data.job };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  /**
   * Retrieves execution history for a job
   */
  public async getJobHistory(jobId: number | string): Promise<{ history: CronJobHistoryItem[]; predictions?: number[]; error?: string }> {
    const key = await this.getApiKey();
    if (!key) return { history: [], error: 'API key is missing' };

    try {
      const res = await fetch(`${CronJobOrgService.API_BASE}/jobs/${jobId}/history`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return { history: [], error: `HTTP ${res.status}` };
      const data = (await res.json()) as any;
      return { history: data.history || [], predictions: data.predictions || [] };
    } catch (e: any) {
      return { history: [], error: e.message };
    }
  }

  /**
   * Creates a new job on cron-job.org
   */
  public async createJob(jobData: {
    title: string;
    url: string;
    enabled?: boolean;
    timezone?: string;
    scheduleInterval?: string; // e.g. "15m", "30m", "1h", "2h", "daily"
    customMinutes?: number[];
    customHours?: number[];
  }): Promise<{ success: boolean; jobId?: number; error?: string }> {
    const key = await this.getApiKey();
    if (!key) return { success: false, error: 'API key is missing' };

    const schedule = this.buildSchedule(jobData.scheduleInterval || '1h', jobData.timezone || 'Asia/Dhaka', {
      minutes: jobData.customMinutes,
      hours: jobData.customHours,
    });

    const body = {
      job: {
        url: jobData.url.trim(),
        title: jobData.title.trim(),
        enabled: jobData.enabled !== false,
        saveResponses: true,
        requestTimeout: 30,
        redirectSuccess: false,
        requestMethod: 0, // GET
        schedule,
      },
    };

    try {
      const res = await fetch(`${CronJobOrgService.API_BASE}/jobs`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => ({}))) as any;
      if (res.ok && data.jobId) {
        return { success: true, jobId: data.jobId };
      }
      return { success: false, error: data.error?.message || `Failed creating job (HTTP ${res.status})` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Updates an existing job (PATCH /jobs/{id})
   */
  public async updateJob(
    jobId: number | string,
    updates: {
      title?: string;
      url?: string;
      enabled?: boolean;
      scheduleInterval?: string;
      timezone?: string;
      customMinutes?: number[];
      customHours?: number[];
    }
  ): Promise<{ success: boolean; error?: string }> {
    const key = await this.getApiKey();
    if (!key) return { success: false, error: 'API key is missing' };

    const jobPatch: Record<string, any> = {};
    if (updates.title !== undefined) jobPatch.title = updates.title.trim();
    if (updates.url !== undefined) jobPatch.url = updates.url.trim();
    if (updates.enabled !== undefined) jobPatch.enabled = Boolean(updates.enabled);

    if (updates.scheduleInterval || updates.timezone || updates.customMinutes || updates.customHours) {
      jobPatch.schedule = this.buildSchedule(
        updates.scheduleInterval || '1h',
        updates.timezone || 'Asia/Dhaka',
        { minutes: updates.customMinutes, hours: updates.customHours }
      );
    }

    try {
      const res = await fetch(`${CronJobOrgService.API_BASE}/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job: jobPatch }),
      });

      if (res.ok) return { success: true };
      const err = await res.json().catch(() => ({}));
      return { success: false, error: (err as any).error?.message || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Deletes a job from cron-job.org
   */
  public async deleteJob(jobId: number | string): Promise<{ success: boolean; error?: string }> {
    const key = await this.getApiKey();
    if (!key) return { success: false, error: 'API key is missing' };

    try {
      const res = await fetch(`${CronJobOrgService.API_BASE}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { success: true };
      const err = await res.json().catch(() => ({}));
      return { success: false, error: (err as any).error?.message || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Manually executes a cron job's target URL right now with real latency & status inspection
   */
  public async runJobUrl(targetUrl: string): Promise<{
    success: boolean;
    status: number;
    statusText: string;
    durationMs: number;
    bodyPreview: string;
  }> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 28000); // 28s timeout

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Automation-Software-CronRunner/2.0 (cron-job.org simulator)',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const durationMs = Date.now() - start;
      const text = await res.text();
      let preview = text.slice(0, 500);
      try {
        const json = JSON.parse(text);
        preview = JSON.stringify(json, null, 2).slice(0, 500);
      } catch {}

      return {
        success: res.ok,
        status: res.status,
        statusText: res.statusText,
        durationMs,
        bodyPreview: preview,
      };
    } catch (e: any) {
      return {
        success: false,
        status: 0,
        statusText: e.name === 'AbortError' ? 'Execution Timed Out (28s)' : e.message,
        durationMs: Date.now() - start,
        bodyPreview: e.message,
      };
    }
  }

  /**
   * Helper to convert interval presets into cron-job.org schedule structure
   */
  public buildSchedule(
    interval: string,
    timezone = 'Asia/Dhaka',
    custom?: { minutes?: number[]; hours?: number[] }
  ): CronJobSchedule {
    if (custom?.minutes && custom.minutes.length > 0) {
      return {
        timezone,
        hours: custom.hours && custom.hours.length > 0 ? custom.hours : [-1],
        minutes: custom.minutes,
        mdays: [-1],
        months: [-1],
        wdays: [-1],
        expiresAt: 0,
      };
    }

    switch (interval.toLowerCase()) {
      case '5m':
      case 'every_5_mins':
        return {
          timezone,
          hours: [-1],
          minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
          mdays: [-1],
          months: [-1],
          wdays: [-1],
          expiresAt: 0,
        };
      case '10m':
      case 'every_10_mins':
        return {
          timezone,
          hours: [-1],
          minutes: [0, 10, 20, 30, 40, 50],
          mdays: [-1],
          months: [-1],
          wdays: [-1],
          expiresAt: 0,
        };
      case '15m':
      case 'every_15_mins':
        return {
          timezone,
          hours: [-1],
          minutes: [0, 15, 30, 45],
          mdays: [-1],
          months: [-1],
          wdays: [-1],
          expiresAt: 0,
        };
      case '30m':
      case 'every_30_mins':
        return {
          timezone,
          hours: [-1],
          minutes: [0, 30],
          mdays: [-1],
          months: [-1],
          wdays: [-1],
          expiresAt: 0,
        };
      case '2h':
      case 'every_2_hours':
        return {
          timezone,
          hours: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
          minutes: [0],
          mdays: [-1],
          months: [-1],
          wdays: [-1],
          expiresAt: 0,
        };
      case '6h':
      case 'every_6_hours':
        return {
          timezone,
          hours: [0, 6, 12, 18],
          minutes: [0],
          mdays: [-1],
          months: [-1],
          wdays: [-1],
          expiresAt: 0,
        };
      case '12h':
      case 'every_12_hours':
        return {
          timezone,
          hours: [0, 12],
          minutes: [0],
          mdays: [-1],
          months: [-1],
          wdays: [-1],
          expiresAt: 0,
        };
      case 'daily':
        return {
          timezone,
          hours: [0],
          minutes: [0],
          mdays: [-1],
          months: [-1],
          wdays: [-1],
          expiresAt: 0,
        };
      case '1h':
      case 'every_1_hour':
      default:
        return {
          timezone,
          hours: [-1],
          minutes: [0],
          mdays: [-1],
          months: [-1],
          wdays: [-1],
          expiresAt: 0,
        };
    }
  }

  /**
   * Converts a cron-job.org schedule object into a readable human string
   */
  public formatScheduleText(schedule: CronJobSchedule): string {
    if (!schedule) return 'Unscheduled';
    const mins = schedule.minutes || [];
    const hrs = schedule.hours || [];

    if (mins.length === 12 && hrs.length === 1 && hrs[0] === -1) return 'Every 5 minutes';
    if (mins.length === 6 && hrs.length === 1 && hrs[0] === -1) return 'Every 10 minutes';
    if (mins.length === 4 && hrs.length === 1 && hrs[0] === -1) return 'Every 15 minutes';
    if (mins.length === 2 && hrs.length === 1 && hrs[0] === -1) return 'Every 30 minutes';
    if (mins.length === 1 && hrs.length === 1 && hrs[0] === -1) return 'Every 1 hour';
    if (hrs.length === 12 && mins.length === 1) return 'Every 2 hours';
    if (hrs.length === 4 && mins.length === 1) return 'Every 6 hours';
    if (hrs.length === 2 && mins.length === 1) return 'Every 12 hours';
    if (hrs.length === 1 && hrs[0] !== -1 && mins.length === 1) return `Daily at ${hrs[0]}:00`;

    if (hrs.length === 1 && hrs[0] === -1) {
      return `Hourly at :${mins.join(', :')}`;
    }

    return `Custom (${mins.length}m / ${hrs.length}h)`;
  }
}
