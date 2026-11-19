import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface InputAppConfig {
  PORT: number;
  NODE_ENV: string;
  MONGODB_URI: string;
  MONGODB_DB_NAME: string;
  DRY_RUN: boolean;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  GOOGLE_DRIVE_API_KEY?: string;
  GDRIVE_FOLDER_ID?: string;
  CRON_ENABLED: boolean;
  CRON_SCHEDULE: string;
  MAX_ARTICLE_AGE_HOURS: number;
  REEL_DEFAULT_DURATION: number;
  REEL_DEFAULT_THEME: string;
  DATA_DIR: string;
  ASSETS_DIR: string;
}

const rootDir = process.cwd();
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data');
const assetsDir = process.env.ASSETS_DIR || path.join(rootDir, 'assets');

const ATLAS_DEFAULT_URI =
  'mongodb+srv://Vercel-Admin-atlas-copper-notebook:BNp8pQVDocNKaDwL@atlas-copper-notebook.0czlcmy.mongodb.net/?retryWrites=true&w=majority';

export const config: InputAppConfig = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI:
    process.env.MONGODB_URI ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URL ||
    (process.env.DATABASE_URL?.startsWith('mongodb') ? process.env.DATABASE_URL : '') ||
    ATLAS_DEFAULT_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'news_automation',
  DRY_RUN: process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN:
    process.env.GOOGLE_REFRESH_TOKEN ||
    process.env.GDRIVE_REFRESH_TOKEN ||
    process.env.YOUTUBE_REFRESH_TOKEN,
  GOOGLE_DRIVE_API_KEY: process.env.GOOGLE_DRIVE_API_KEY || process.env.GDRIVE_API_KEY,
  GDRIVE_FOLDER_ID: process.env.GDRIVE_FOLDER_ID || process.env.GDRIVE_SPORTS_FOLDER_ID || '',
  CRON_ENABLED: process.env.CRON_ENABLED !== 'false',
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || '*/15 * * * *',
  MAX_ARTICLE_AGE_HOURS: process.env.MAX_ARTICLE_AGE_HOURS ? parseInt(process.env.MAX_ARTICLE_AGE_HOURS, 10) : 24,
  REEL_DEFAULT_DURATION: process.env.REEL_DEFAULT_DURATION ? parseInt(process.env.REEL_DEFAULT_DURATION, 10) : 15,
  REEL_DEFAULT_THEME: process.env.REEL_DEFAULT_THEME || 'canva-studio-rotate',
  DATA_DIR: dataDir,
  ASSETS_DIR: assetsDir,
};
