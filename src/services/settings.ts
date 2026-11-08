import { getDatabase, isDbConnected } from '../db/index.js';
import { Setting } from '../db/schema.js';
import { config, registerSettingsLookup } from '../config/env.js';

const cache = new Map<string, string>();
let lastFetched = 0;
const CACHE_TTL_MS = 15_000; // 15-second in-memory cache for ultra-fast, zero-latency access

// Register synchronous lookup hook for config Proxy
registerSettingsLookup((key: string): string | undefined => {
  if (cache.has(key)) return cache.get(key);
  // Aliases support
  if (key === 'ENABLE_VIDEO_REELS' && cache.has('AUTO_POST_REELS')) {
    return cache.get('AUTO_POST_REELS');
  }
  return undefined;
});

/**
 * Refreshes settings from the database into the in-memory cache.
 * Automatically respects TTL unless force=true.
 */
export async function refreshDbSettings(force = false): Promise<Map<string, string>> {
  const now = Date.now();
  if (!force && now - lastFetched < CACHE_TTL_MS && cache.size > 0) {
    return cache;
  }

  if (!isDbConnected()) {
    return cache;
  }

  try {
    const db = getDatabase();
    const rows = await db.collection<Setting>('settings').find({}).toArray();
    cache.clear();
    for (const r of rows) {
      if (r && r._id && typeof r.value === 'string') {
        cache.set(r._id, r.value);
      }
    }
    lastFetched = Date.now();
  } catch (err: any) {
    console.warn('[SettingsService] Failed to refresh settings from DB:', err.message);
  }

  return cache;
}

/**
 * Gets a setting value from the database, falling back to static config/env if not found.
 */
export async function getDbSetting(key: string, fallback?: string): Promise<string> {
  await refreshDbSettings();
  if (cache.has(key)) {
    return cache.get(key)!;
  }
  return fallback !== undefined ? fallback : (config as any)[key] || process.env[key] || '';
}

/**
 * Synchronous read from the in-memory settings cache.
 */
export function getDbSettingSync(key: string, fallback?: string): string {
  if (cache.has(key)) {
    return cache.get(key)!;
  }
  return fallback !== undefined ? fallback : (config as any)[key] || process.env[key] || '';
}

/**
 * Gets a boolean setting from database.
 */
export async function getDbSettingBool(key: string, fallback?: boolean): Promise<boolean> {
  const str = await getDbSetting(key, fallback !== undefined ? String(fallback) : undefined);
  return str === 'true' || str === '1';
}

/**
 * Synchronous boolean read from in-memory cache.
 */
export function getDbSettingBoolSync(key: string, fallback?: boolean): boolean {
  const str = getDbSettingSync(key, fallback !== undefined ? String(fallback) : undefined);
  return str === 'true' || str === '1';
}

/**
 * Gets a numeric setting from database.
 */
export async function getDbSettingNumber(key: string, fallback?: number): Promise<number> {
  const str = await getDbSetting(key, fallback !== undefined ? String(fallback) : undefined);
  const n = parseInt(str, 10);
  return !isNaN(n) ? n : (fallback ?? 0);
}

/**
 * Checks whether DRY_RUN is active, prioritizing database setting over .env.
 */
export async function isDbDryRun(): Promise<boolean> {
  return getDbSettingBool('DRY_RUN', config.DRY_RUN);
}

/**
 * Synchronous DRY_RUN check from memory cache.
 */
export function isDbDryRunSync(): boolean {
  return getDbSettingBoolSync('DRY_RUN', config.DRY_RUN);
}

/**
 * Persists a setting into the database and immediately updates the in-memory cache.
 */
export async function setDbSetting(key: string, value: string): Promise<void> {
  cache.set(key, String(value));
  if (isDbConnected()) {
    try {
      const db = getDatabase();
      await db.collection<Setting>('settings').updateOne(
        { _id: key },
        {
          $set: {
            value: String(value),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (err: any) {
      console.warn(`[SettingsService] Could not persist setting ${key} to DB:`, err.message);
    }
  }
}

/**
 * Persists multiple settings at once and updates in-memory cache immediately.
 */
export async function setManyDbSettings(settings: Record<string, string | number | boolean>): Promise<void> {
  for (const [key, val] of Object.entries(settings)) {
    cache.set(key, String(val));
  }
  if (isDbConnected()) {
    try {
      const db = getDatabase();
      const settingsCol = db.collection<Setting>('settings');
      for (const [key, val] of Object.entries(settings)) {
        await settingsCol.updateOne(
          { _id: key },
          {
            $set: {
              value: String(val),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[SettingsService] Failed to save multiple settings to DB:', err.message);
    }
  }
}

/**
 * Returns all current database settings merged with defaults.
 */
export async function getAllDbSettings(): Promise<Record<string, string>> {
  await refreshDbSettings();
  const out: Record<string, string> = {};
  for (const [k, v] of cache.entries()) {
    out[k] = v;
  }
  return out;
}

/**
 * Invalidates cache to force a fresh DB read on next access.
 */
export function invalidateSettingsCache(): void {
  lastFetched = 0;
}
