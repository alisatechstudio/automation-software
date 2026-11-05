import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  PORT: number;
  NODE_ENV: string;
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
  DATA_DIR: string;
  ASSETS_DIR: string;
}

const rootDir = process.cwd();
const isVercel = !!process.env.VERCEL;
const dataDir = process.env.DATA_DIR || (isVercel ? '/tmp/data' : path.join(rootDir, 'data'));
const assetsDir = process.env.ASSETS_DIR || path.join(rootDir, 'assets');

export const config: AppConfig = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
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
  DEFAULT_HASHTAGS: process.env.DEFAULT_HASHTAGS || '#BreakingNews #Bangladesh #NewsUpdate',
  DEFAULT_CAPTION_FORMAT:
    process.env.DEFAULT_CAPTION_FORMAT || '{headline}\n\n{summary}\n\n{hashtags}',
  DEFAULT_COMMENT_FORMAT:
    process.env.DEFAULT_COMMENT_FORMAT || 'বিস্তারিত পড়ুন: {url}',
  DATA_DIR: dataDir,
  ASSETS_DIR: assetsDir,
};
