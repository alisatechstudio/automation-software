import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import YAML from 'yaml';
import { ConfigYamlSchema, EnvSchema, type AppConfig, type EnvConfig } from './schema.js';

// Load .env
dotenv.config();

const DEFAULT_CONFIG_YAML = `
app:
  name: "SportsClipBot"
  dataDir: "./data"
  inboxDir: "./data/inbox"
  musicDir: "./data/music"
  outputDir: "./data/output"
  tempDir: "./data/temp"

originality:
  maxLicensedFootageRatio: 0.60
  minOriginalContentRatio: 0.40
  maxTextSimilarityThreshold: 0.65
  minFrameHammingDistance: 10
  requireVoiceover: true
  requireGraphics: true

compliance:
  dailyCapPerPlatform: 3
  minDurationSec: 15
  maxDurationSec: 45
  requireCommercialLicense: true
  blockNonCommercial: true
  blocklist:
    - espn
    - sky sports
    - skysports
    - nbc sports
    - bbc sport
    - fox sports
    - dazn
    - tnt sports
    - bt sport
    - star sports
    - sony sports
    - eurosport
    - fifa
    - uefa
    - premier league
    - la liga
    - serie a
    - bundesliga
    - ligue 1
    - nba
    - nfl
    - mlb
    - nhl
    - formula 1
    - f1
    - icc
    - olympics
    - ioc
    - wwe
    - ufc

sources:
  watchedFolder:
    enabled: true
    path: "./data/inbox"
    requirePermissionFile: true
  commonsArchive:
    enabled: true
    defaultCategories:
      - Athletics
      - Cycling
      - Gymnastics
      - Swimming
      - Skateboarding
  youtubeCc:
    enabled: false
    queries:
      - "calisthenics creative commons"
      - "amateur skateboarding cc-by"
    maxResults: 5
  pexels:
    enabled: true
    searchSports:
      - basketball
      - running
      - athletics
      - cycling
  pixabay:
    enabled: true
    searchSports:
      - soccer
      - tennis
      - boxing
  partnerFeeds: []

editor:
  targetWidth: 1080
  targetHeight: 1920
  fps: 30
  videoBitrate: "4500k"
  audioBitrate: "192k"
  loudnorm:
    targetI: -16
    lra: 11
    tp: -1.5
  musicVolume: 0.15
  voiceVolume: 1.0
  enableSubtitles: true

publishing:
  dryRun: false
  googleDrive:
    enabled: true
    folderId: "1E7y1TxCkbd7UJUeGG5oEb9hmXwcMKlFh"
    folderUrl: "https://drive.google.com/drive/u/0/folders/1E7y1TxCkbd7UJUeGG5oEb9hmXwcMKlFh"
    saveBeforePost: true
  youtube:
    enabled: true
    privacyStatus: "public"
    defaultTags:
      - SportsAnalysis
      - Biomechanics
      - Shorts
      - PeakPerformance
  facebook:
    enabled: true
    defaultTags:
      - SportsAnalysis
      - Reels
      - Performance

monitoring:
  pollIntervalMinutes: 30
  autoPauseOnStrikeOrClaim: true
  notifyAdminOnEvent: true

approval:
  mandatoryReview: true
  telegramEnabled: true
  dashboardEnabled: true
`;

export interface LoadedConfig {
  env: EnvConfig;
  config: AppConfig;
  isDryRun: boolean;
}

let cachedConfig: LoadedConfig | null = null;

export function loadConfig(configPath = './config.yaml'): LoadedConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // 1. Validate Environment Variables
  const envParsed = EnvSchema.safeParse(process.env);
  if (!envParsed.success) {
    console.error('Invalid environment variables:', envParsed.error.format());
    throw new Error('Environment configuration validation failed');
  }
  const env = envParsed.data;

  // 2. Load & Validate config.yaml (checking multiple candidate locations with built-in default fallback)
  let rawYaml = '';
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(process.cwd(), configPath),
    path.resolve(process.cwd(), 'config.yaml'),
    path.resolve(currentDir, 'config.yaml'),
    path.resolve(currentDir, '../config.yaml'),
    path.resolve(currentDir, '../../config.yaml'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      rawYaml = fs.readFileSync(candidate, 'utf8');
      break;
    }
  }

  if (!rawYaml) {
    console.warn('[Config] config.yaml not found on disk. Falling back to built-in default configuration.');
    rawYaml = DEFAULT_CONFIG_YAML;
  }

  const parsedYaml = YAML.parse(rawYaml);
  const configParsed = ConfigYamlSchema.safeParse(parsedYaml);
  if (!configParsed.success) {
    console.error('Invalid config.yaml structure:', configParsed.error.format());
    throw new Error('config.yaml validation failed');
  }
  const config = configParsed.data;

  // Ensure necessary runtime directories exist (ignoring read-only filesystem environments)
  const dirsToEnsure = [
    config.app.dataDir,
    config.app.inboxDir,
    config.app.musicDir,
    config.app.outputDir,
    config.app.tempDir,
  ];

  for (const dir of dirsToEnsure) {
    try {
      const fullPath = path.resolve(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    } catch {
      // Ignore directory creation failure in read-only environments (e.g., serverless Lambda/Vercel)
    }
  }

  // Dry run can be forced by env DRY_RUN=true or config.publishing.dryRun
  const isDryRun = Boolean(env.DRY_RUN || config.publishing.dryRun);

  cachedConfig = {
    env,
    config,
    isDryRun,
  };

  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
