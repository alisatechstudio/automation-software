import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  DRY_RUN: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => val === true || val === 'true' || val === '1'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017'),
  MONGODB_DB_NAME: z.string().default('sports_clip_bot'),

  // Anthropic API for script writing & advertiser friendliness screening
  ANTHROPIC_API_KEY: z.string().optional(),

  // YouTube OAuth Credentials
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REFRESH_TOKEN: z.string().optional(),

  // Facebook Graph API Credentials
  FACEBOOK_PAGE_ID: z.string().optional(),
  FACEBOOK_PAGE_ACCESS_TOKEN: z.string().optional(),

  // Telegram Approval Bot
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_ADMIN_USER_ID: z.string().optional(),

  // External APIs
  ACOUSTID_API_KEY: z.string().optional(),
  PEXELS_API_KEY: z.string().optional(),
  PIXABAY_API_KEY: z.string().optional(),

  // Dashboard Security
  DASHBOARD_ADMIN_USER: z.string().default('admin'),
  DASHBOARD_ADMIN_PASSWORD: z.string().default('admin12345'),
  SESSION_SECRET: z.string().default('sportsclipbot-super-secure-secret-key-2026'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export const ConfigYamlSchema = z.object({
  app: z.object({
    name: z.string().default('SportsClipBot'),
    dataDir: z.string().default('./data'),
    inboxDir: z.string().default('./data/inbox'),
    musicDir: z.string().default('./data/music'),
    outputDir: z.string().default('./data/output'),
    tempDir: z.string().default('./data/temp'),
  }),

  originality: z.object({
    maxLicensedFootageRatio: z.number().min(0.1).max(0.9).default(0.6), // default max 60%
    minOriginalContentRatio: z.number().min(0.1).max(0.9).default(0.4), // default min 40%
    maxTextSimilarityThreshold: z.number().min(0.1).max(1.0).default(0.65), // Levenshtein / Cosine
    minFrameHammingDistance: z.number().min(1).max(64).default(10), // pHash distance
    requireVoiceover: z.boolean().default(true),
    requireGraphics: z.boolean().default(true),
  }),

  compliance: z.object({
    dailyCapPerPlatform: z.number().int().positive().default(3),
    minDurationSec: z.number().int().min(5).default(15),
    maxDurationSec: z.number().int().max(60).default(45),
    requireCommercialLicense: z.boolean().default(true),
    blockNonCommercial: z.boolean().default(true),
    blocklist: z.array(z.string()).default([
      'espn',
      'sky sports',
      'skysports',
      'nbc sports',
      'bbc sport',
      'fox sports',
      'dazn',
      'tnt sports',
      'bt sport',
      'star sports',
      'sony sports',
      'eurosport',
      'fifa',
      'uefa',
      'premier league',
      'la liga',
      'serie a',
      'bundesliga',
      'ligue 1',
      'nba',
      'nfl',
      'mlb',
      'nhl',
      'formula 1',
      'f1',
      'icc',
      'olympics',
      'ioc',
      'wwe',
      'ufc',
    ]),
  }),

  sources: z.object({
    watchedFolder: z
      .object({
        enabled: z.boolean().default(true),
        path: z.string().default('./data/inbox'),
        requirePermissionFile: z.boolean().default(true),
      })
      .default({ enabled: true, path: './data/inbox', requirePermissionFile: true }),
    youtubeCc: z
      .object({
        enabled: z.boolean().default(false),
        queries: z.array(z.string()).default(['skateboarding creative commons', 'calisthenics cc-by']),
        maxResults: z.number().default(5),
      })
      .default({ enabled: false, queries: [], maxResults: 5 }),
    commonsArchive: z
      .object({
        enabled: z.boolean().default(true),
        defaultCategories: z.array(z.string()).default(['Sports', 'Athletics']),
      })
      .default({ enabled: true, defaultCategories: ['Sports'] }),
    pexels: z
      .object({
        enabled: z.boolean().default(true),
        searchSports: z.array(z.string()).default(['basketball', 'running', 'soccer', 'cycling']),
      })
      .default({ enabled: true, searchSports: ['basketball', 'running'] }),
    pixabay: z
      .object({
        enabled: z.boolean().default(true),
        searchSports: z.array(z.string()).default(['football', 'tennis', 'boxing']),
      })
      .default({ enabled: true, searchSports: ['football', 'tennis'] }),
    partnerFeeds: z
      .array(
        z.object({
          name: z.string(),
          url: z.string(),
          licenseType: z.literal('LICENSED_PARTNER'),
          licenseTerms: z.string(),
          agreementId: z.string(),
        })
      )
      .default([]),
  }),

  editor: z.object({
    targetWidth: z.number().default(1080),
    targetHeight: z.number().default(1920),
    fps: z.number().default(30),
    videoBitrate: z.string().default('4500k'),
    audioBitrate: z.string().default('192k'),
    loudnorm: z
      .object({
        targetI: z.number().default(-16),
        lra: z.number().default(11),
        tp: z.number().default(-1.5),
      })
      .default({ targetI: -16, lra: 11, tp: -1.5 }),
    musicVolume: z.number().min(0).max(1).default(0.15),
    voiceVolume: z.number().min(0).max(2).default(1.0),
    enableSubtitles: z.boolean().default(true),
  }),

  publishing: z.object({
    dryRun: z.boolean().default(false),
    googleDrive: z
      .object({
        enabled: z.boolean().default(true),
        folderId: z.string().default('1E7y1TxCkbd7UJUeGG5oEb9hmXwcMKlFh'),
        folderUrl: z.string().default('https://drive.google.com/drive/u/0/folders/1E7y1TxCkbd7UJUeGG5oEb9hmXwcMKlFh'),
        saveBeforePost: z.boolean().default(true),
      })
      .default({
        enabled: true,
        folderId: '1E7y1TxCkbd7UJUeGG5oEb9hmXwcMKlFh',
        folderUrl: 'https://drive.google.com/drive/u/0/folders/1E7y1TxCkbd7UJUeGG5oEb9hmXwcMKlFh',
        saveBeforePost: true,
      }),
    youtube: z
      .object({
        enabled: z.boolean().default(true),
        privacyStatus: z.enum(['private', 'public', 'unlisted']).default('public'),
        defaultTags: z.array(z.string()).default(['Sports', 'Highlights', 'Athletics', 'Shorts']),
      })
      .default({ enabled: true, privacyStatus: 'public', defaultTags: ['Sports', 'Shorts'] }),
    facebook: z
      .object({
        enabled: z.boolean().default(true),
        defaultTags: z.array(z.string()).default(['Sports', 'Highlights', 'Reels']),
      })
      .default({ enabled: true, defaultTags: ['Sports', 'Reels'] }),
  }),

  monitoring: z.object({
    pollIntervalMinutes: z.number().default(30),
    autoPauseOnStrikeOrClaim: z.boolean().default(true),
    notifyAdminOnEvent: z.boolean().default(true),
  }),

  approval: z.object({
    mandatoryReview: z.literal(true).default(true), // CAN NEVER BE FALSE
    telegramEnabled: z.boolean().default(true),
    dashboardEnabled: z.boolean().default(true),
  }),
});

export type AppConfig = z.infer<typeof ConfigYamlSchema>;
