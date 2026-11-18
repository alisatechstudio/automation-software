import { logger } from '../logger.js';

export class QuotaExceededError extends Error {
  constructor(public platform: string, message: string) {
    super(`[${platform}] Quota Exceeded: ${message}`);
    this.name = 'QuotaExceededError';
  }
}

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    platformName?: string;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  let delay = options.initialDelayMs ?? 1000;
  const platform = options.platformName || 'API';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err.message || '';
      const isQuota =
        msg.includes('quotaExceeded') ||
        msg.includes('rateLimitExceeded') ||
        err.code === 403 ||
        err.status === 429;

      if (isQuota) {
        throw new QuotaExceededError(platform, `Rate limit or daily API quota hit: ${msg}`);
      }

      if (attempt === maxRetries) {
        logger.error({ platform, attempt, err: msg }, 'All exponential backoff attempts exhausted.');
        throw err;
      }

      // Add jitter to delay (±20%)
      const jitter = delay * (0.8 + Math.random() * 0.4);
      logger.warn({ platform, attempt, nextDelayMs: Math.round(jitter), err: msg }, 'Retrying operation after backoff delay...');
      await new Promise((res) => setTimeout(res, jitter));
      delay *= 2;
    }
  }

  throw new Error(`${platform} backoff failed unexpectedly.`);
}
