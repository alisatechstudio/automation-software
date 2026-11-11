import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  PORT: number;
  NODE_ENV: string;
  DB_TYPE: 'mysql' | 'mongodb';
  MYSQL_HOST: string;
  MYSQL_PORT: number;
  MYSQL_USER: string;
  MYSQL_PASSWORD?: string;
  MYSQL_DATABASE: string;
  MONGODB_URI: string;
  MONGODB_DB_NAME: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  POLL_INTERVAL_CRON: string;
  MAX_ARTICLE_AGE_HOURS: number;
  MAX_POSTS_PER_HOUR: number;
  MIN_DELAY_SECONDS: number;
  MAX_DELAY_SECONDS: number;
  DRY_RUN: boolean;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DEFAULT_HASHTAGS: string;
  DEFAULT_CAPTION_FORMAT: string;
  DEFAULT_COMMENT_FORMAT: string;
  ENABLE_VIDEO_REELS: boolean;
  TTS_PROVIDER: string;
  PUTER_AUTH_TOKEN?: string;
  PUTER_TTS_PROVIDER: string;
  PUTER_TTS_MODEL: string;
  PUTER_TTS_VOICE: string;
  PUTER_TTS_INSTRUCTIONS: string;
  DATA_DIR: string;
  ASSETS_DIR: string;
}

let dynamicLookup: ((key: string) => string | undefined) | null = null;

/**
 * Registers a synchronous settings resolver function to enable 100% database-driven runtime configuration.
 */
export function registerSettingsLookup(lookup: (key: string) => string | undefined): void {
  dynamicLookup = lookup;
}

const rootDir = process.cwd();
const isVercel = !!process.env.VERCEL;
const dataDir = process.env.DATA_DIR || (isVercel ? '/tmp/data' : path.join(rootDir, 'data'));
const assetsDir = process.env.ASSETS_DIR || path.join(rootDir, 'assets');

const resolvedDbType: 'mysql' | 'mongodb' =
  process.env.DB_TYPE === 'mysql'
    ? 'mysql'
    : process.env.DB_TYPE === 'mongodb'
    ? 'mongodb'
    : isVercel
    ? (process.env.MYSQL_DATABASE && !process.env.MONGODB_URI ? 'mysql' : 'mongodb')
    : (process.env.MONGODB_URI || process.env.MONGODB_URL ? 'mongodb' : (process.env.MYSQL_DATABASE ? 'mysql' : 'mongodb'));

const baseConfig: AppConfig = {
  PORT: process.env.PORT && !isNaN(Number(process.env.PORT)) ? parseInt(process.env.PORT, 10) : 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_TYPE: resolvedDbType,
  MYSQL_HOST: process.env.MYSQL_HOST || '127.0.0.1',
  MYSQL_PORT: parseInt(process.env.MYSQL_PORT || '3306', 10),
  MYSQL_USER: process.env.MYSQL_USER || (isVercel ? '' : 'alisatec_automation'),
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || (isVercel ? '' : 'alisatec_automation'),
  MONGODB_URI:
    process.env.MONGODB_URI ||
    process.env.MONGODB_URL ||
    (isVercel ? '' : 'mongodb://127.0.0.1:27017/news_automation'),
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'news_automation',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'Admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'SAROmyw4',
  POLL_INTERVAL_CRON: process.env.POLL_INTERVAL_CRON || '*/10 * * * *', // Every 10 minutes
  MAX_ARTICLE_AGE_HOURS: parseInt(process.env.MAX_ARTICLE_AGE_HOURS || '24', 10),
  MAX_POSTS_PER_HOUR: parseInt(process.env.MAX_POSTS_PER_HOUR || '10', 10),
  MIN_DELAY_SECONDS: parseInt(process.env.MIN_DELAY_SECONDS || '30', 10),
  MAX_DELAY_SECONDS: parseInt(process.env.MAX_DELAY_SECONDS || '60', 10),
  DRY_RUN: process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  DEFAULT_HASHTAGS: process.env.DEFAULT_HASHTAGS || '#BreakingNews #BanglaNews #ViralNews #Bangladesh #NewsUpdate',
  DEFAULT_CAPTION_FORMAT:
    process.env.DEFAULT_CAPTION_FORMAT || '{headline}\n\n{summary}\n\n{hashtags}',
  DEFAULT_COMMENT_FORMAT:
    process.env.DEFAULT_COMMENT_FORMAT || 'বিস্তারিত পড়ুন: {url}',
  ENABLE_VIDEO_REELS: process.env.ENABLE_VIDEO_REELS !== 'false',
  TTS_PROVIDER: process.env.TTS_PROVIDER || 'auto',
  PUTER_AUTH_TOKEN:
    process.env.PUTER_AUTH_TOKEN ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InYyIn0.eyJ0IjoidCIsInYiOiIyIiwidG9rZW5fdWlkIjoiMmE5MjdhMDItMzFlZi00MzQxLThlOTktMTUwMmU4ZThiOGVlIiwidXUiOiI5NTdKVDNvdlJ6R2FzYXZpSGQxd0tRPT0iLCJzdSI6ImlDaXQzQzV2UlVhSENvRkg3Y0s4UlE9PSIsImFpIjoiOTU3SlQzb3ZSekdhc2F2aUhkMXdLUT09IiwiZnVsbF9hY2Nlc3MiOnRydWUsImlhdCI6MTc5NDI0MDI2MH0.doxhpusznGPA8Br-LEdF7kQIjjSKFypiu1xSzjRt9zU',
  PUTER_TTS_PROVIDER: process.env.PUTER_TTS_PROVIDER || 'gemini',
  PUTER_TTS_MODEL: process.env.PUTER_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
  PUTER_TTS_VOICE: process.env.PUTER_TTS_VOICE || 'Charon',
  PUTER_TTS_INSTRUCTIONS:
    process.env.PUTER_TTS_INSTRUCTIONS ||
    'Speak in a confident, authoritative, clear, and professional male television news broadcast voice.',
  DATA_DIR: dataDir,
  ASSETS_DIR: assetsDir,
};

/**
 * Proxied config object: queries the in-memory database settings cache on every access,
 * falling back to .env baseConfig if not configured in the database.
 */
export const config: AppConfig = new Proxy(baseConfig, {
  get(target, prop: string) {
    if (dynamicLookup) {
      const dbVal = dynamicLookup(prop);
      if (dbVal !== undefined && dbVal !== null && dbVal !== '') {
        if (prop === 'DRY_RUN') return dbVal === 'true' || dbVal === '1';
        if (prop === 'ENABLE_VIDEO_REELS') return dbVal === 'true' || dbVal === '1';
        if (
          prop === 'MAX_ARTICLE_AGE_HOURS' ||
          prop === 'MAX_POSTS_PER_HOUR' ||
          prop === 'MIN_DELAY_SECONDS' ||
          prop === 'MAX_DELAY_SECONDS'
        ) {
          const num = parseInt(dbVal, 10);
          if (!isNaN(num)) return num;
        }
        return dbVal;
      }
    }
    return (target as any)[prop];
  },
});
