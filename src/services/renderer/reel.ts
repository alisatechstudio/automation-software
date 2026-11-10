import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { config } from '../../config/env.js';
import { resolveCategoryTheme, isEnglishText } from '../../config/constants.js';
import { UnifiedTtsService } from '../tts/index.js';

let ffmpegPath: string = '';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  ffmpegPath = ffmpegInstaller.path;
} catch (e) {
  ffmpegPath = 'ffmpeg';
}

export type ReelTheme =
  | 'auto-category'
  | 'cat-bangladesh'
  | 'cat-politics'
  | 'cat-economy'
  | 'cat-international'
  | 'cat-sports'
  | 'cat-technology'
  | 'cat-entertainment'
  | 'cat-opinion'
  | 'cat-religion'
  | 'cat-education'
  | 'cat-job'
  | 'cat-lifestyle'
  | 'cat-todays-match'
  | 'rolling'
  | 'studio-red'
  | 'breaking-bold'
  | 'dark-cinema'
  | 'viral-gradient'
  | 'vertical-916';

export interface CategoryReelStyle {
  id: string;
  banglaName: string;
  gradientStops: [string, string, string, string];
  ambientOrbColor: string;
  ambientOrb2Color: string;
  badgeBg: string;
  badgeText: string;
  badgeDot: string;
  cardBorder: string;
  cardGlow: string;
  headlineColor: string;
  shimmerColor: string;
  audioFilter: string;
}

export const CATEGORY_STYLES: Record<string, CategoryReelStyle> = {
  'cat-bangladesh': {
    id: 'cat-bangladesh',
    banglaName: 'বাংলাদেশ',
    gradientStops: ['#064e3b', '#065f46', '#831843', '#1e293b'],
    ambientOrbColor: 'rgba(16, 185, 129, 0.22)',
    ambientOrb2Color: 'rgba(225, 29, 72, 0.18)',
    badgeBg: '#059669',
    badgeText: '#ffffff',
    badgeDot: '#dc2626',
    cardBorder: 'rgba(16, 185, 129, 0.45)',
    cardGlow: 'rgba(16, 185, 129, 0.25)',
    headlineColor: '#064e3b',
    shimmerColor: '#a7f3d0',
    audioFilter: 'bass=g=5:f=120,treble=g=3:f=3500',
  },
  'cat-politics': {
    id: 'cat-politics',
    banglaName: 'রাজনীতি',
    gradientStops: ['#450a0a', '#7f1d1d', '#991b1b', '#1c1917'],
    ambientOrbColor: 'rgba(239, 68, 68, 0.25)',
    ambientOrb2Color: 'rgba(245, 158, 11, 0.18)',
    badgeBg: '#b91c1c',
    badgeText: '#ffffff',
    badgeDot: '#f59e0b',
    cardBorder: 'rgba(220, 38, 38, 0.5)',
    cardGlow: 'rgba(220, 38, 38, 0.3)',
    headlineColor: '#450a0a',
    shimmerColor: '#fecaca',
    audioFilter: 'bass=g=7:f=100,treble=g=-1,equalizer=f=250:g=4:w=1',
  },
  'cat-economy': {
    id: 'cat-economy',
    banglaName: 'অর্থনীতি',
    gradientStops: ['#0f172a', '#1e3a8a', '#065f46', '#042f2e'],
    ambientOrbColor: 'rgba(14, 165, 233, 0.22)',
    ambientOrb2Color: 'rgba(16, 185, 129, 0.20)',
    badgeBg: '#0284c7',
    badgeText: '#ffffff',
    badgeDot: '#10b981',
    cardBorder: 'rgba(2, 132, 199, 0.45)',
    cardGlow: 'rgba(2, 132, 199, 0.25)',
    headlineColor: '#0c4a6e',
    shimmerColor: '#bae6fd',
    audioFilter: 'atempo=1.03,equalizer=f=1200:width_type=h:width=250:g=5,treble=g=5:f=4000,bass=g=2',
  },
  'cat-international': {
    id: 'cat-international',
    banglaName: 'আন্তর্জাতিক',
    gradientStops: ['#312e81', '#831843', '#9f1239', '#431407'],
    ambientOrbColor: 'rgba(251, 146, 60, 0.22)',
    ambientOrb2Color: 'rgba(168, 85, 247, 0.20)',
    badgeBg: '#facc15',
    badgeText: '#1e1b4b',
    badgeDot: '#dc2626',
    cardBorder: 'rgba(236, 72, 153, 0.45)',
    cardGlow: 'rgba(236, 72, 153, 0.25)',
    headlineColor: '#4c0519',
    shimmerColor: '#fde047',
    audioFilter: 'aecho=0.8:0.88:350:0.28,bass=g=4:f=120,treble=g=3:f=3000',
  },
  'cat-sports': {
    id: 'cat-sports',
    banglaName: 'খেলাধুলা',
    gradientStops: ['#030712', '#1d4ed8', '#c2410c', '#7c2d12'],
    ambientOrbColor: 'rgba(249, 115, 22, 0.28)',
    ambientOrb2Color: 'rgba(59, 130, 246, 0.22)',
    badgeBg: '#ea580c',
    badgeText: '#ffffff',
    badgeDot: '#facc15',
    cardBorder: 'rgba(234, 88, 12, 0.5)',
    cardGlow: 'rgba(234, 88, 12, 0.3)',
    headlineColor: '#1e3a8a',
    shimmerColor: '#fed7aa',
    audioFilter: 'asetrate=44100*1.12,aresample=48000,bass=g=6:f=90,treble=g=4:f=4500',
  },
  'cat-technology': {
    id: 'cat-technology',
    banglaName: 'তথ্যপ্রযুক্তি',
    gradientStops: ['#030712', '#0e7490', '#1e1b4b', '#020617'],
    ambientOrbColor: 'rgba(6, 182, 212, 0.25)',
    ambientOrb2Color: 'rgba(99, 102, 241, 0.20)',
    badgeBg: '#06b6d4',
    badgeText: '#082f49',
    badgeDot: '#38bdf8',
    cardBorder: 'rgba(6, 182, 212, 0.5)',
    cardGlow: 'rgba(6, 182, 212, 0.3)',
    headlineColor: '#083344',
    shimmerColor: '#a5f3fc',
    audioFilter: 'asetrate=44100*1.05,aresample=48000,flanger=delay=3.5:speed=0.8:depth=2,treble=g=6:f=5000',
  },
  'cat-entertainment': {
    id: 'cat-entertainment',
    banglaName: 'বিনোদন',
    gradientStops: ['#4a044e', '#86198f', '#be185d', '#180424'],
    ambientOrbColor: 'rgba(236, 72, 153, 0.28)',
    ambientOrb2Color: 'rgba(217, 70, 239, 0.22)',
    badgeBg: '#db2777',
    badgeText: '#ffffff',
    badgeDot: '#fde047',
    cardBorder: 'rgba(219, 39, 119, 0.5)',
    cardGlow: 'rgba(219, 39, 119, 0.3)',
    headlineColor: '#500724',
    shimmerColor: '#fbcfe8',
    audioFilter: 'asetrate=44100*1.08,aresample=48000,flanger=delay=2.5:speed=0.6,treble=g=5:f=4500,bass=g=3',
  },
  'cat-opinion': {
    id: 'cat-opinion',
    banglaName: 'মতামত',
    gradientStops: ['#1e293b', '#334155', '#475569', '#0f172a'],
    ambientOrbColor: 'rgba(217, 119, 6, 0.20)',
    ambientOrb2Color: 'rgba(148, 163, 184, 0.18)',
    badgeBg: '#d97706',
    badgeText: '#ffffff',
    badgeDot: '#f59e0b',
    cardBorder: 'rgba(217, 119, 6, 0.45)',
    cardGlow: 'rgba(217, 119, 6, 0.25)',
    headlineColor: '#0f172a',
    shimmerColor: '#fde68a',
    audioFilter: 'atempo=0.92,lowpass=f=3800,bass=g=4:f=140',
  },
  'cat-religion': {
    id: 'cat-religion',
    banglaName: 'ধর্ম',
    gradientStops: ['#064e3b', '#047857', '#14532d', '#022c22'],
    ambientOrbColor: 'rgba(234, 179, 8, 0.22)',
    ambientOrb2Color: 'rgba(16, 185, 129, 0.20)',
    badgeBg: '#ca8a04',
    badgeText: '#14532d',
    badgeDot: '#15803d',
    cardBorder: 'rgba(202, 138, 4, 0.5)',
    cardGlow: 'rgba(202, 138, 4, 0.3)',
    headlineColor: '#064e3b',
    shimmerColor: '#fef08a',
    audioFilter: 'lowpass=f=3200,aecho=0.7:0.7:550:0.25,volume=1.1',
  },
  'cat-education': {
    id: 'cat-education',
    banglaName: 'শিক্ষা',
    gradientStops: ['#1e3a8a', '#2563eb', '#1d4ed8', '#0f172a'],
    ambientOrbColor: 'rgba(56, 189, 248, 0.25)',
    ambientOrb2Color: 'rgba(96, 165, 250, 0.20)',
    badgeBg: '#2563eb',
    badgeText: '#ffffff',
    badgeDot: '#38bdf8',
    cardBorder: 'rgba(37, 99, 235, 0.5)',
    cardGlow: 'rgba(37, 99, 235, 0.3)',
    headlineColor: '#1e3a8a',
    shimmerColor: '#bfdbfe',
    audioFilter: 'equalizer=f=2200:g=4:w=1,treble=g=4:f=3800,atempo=1.02',
  },
  'cat-job': {
    id: 'cat-job',
    banglaName: 'চাকরি',
    gradientStops: ['#134e4a', '#0f766e', '#042f2e', '#0f172a'],
    ambientOrbColor: 'rgba(52, 211, 153, 0.22)',
    ambientOrb2Color: 'rgba(45, 212, 191, 0.20)',
    badgeBg: '#059669',
    badgeText: '#ffffff',
    badgeDot: '#34d399',
    cardBorder: 'rgba(5, 150, 105, 0.5)',
    cardGlow: 'rgba(5, 150, 105, 0.3)',
    headlineColor: '#134e4a',
    shimmerColor: '#a7f3d0',
    audioFilter: 'atempo=1.04,bass=g=4:f=130,treble=g=3:f=3200',
  },
  'cat-lifestyle': {
    id: 'cat-lifestyle',
    banglaName: 'জীবনযাপন',
    gradientStops: ['#881337', '#9f1239', '#fb7185', '#4c0519'],
    ambientOrbColor: 'rgba(251, 113, 133, 0.25)',
    ambientOrb2Color: 'rgba(251, 146, 60, 0.20)',
    badgeBg: '#f97316',
    badgeText: '#ffffff',
    badgeDot: '#fb7185',
    cardBorder: 'rgba(249, 115, 22, 0.5)',
    cardGlow: 'rgba(249, 115, 22, 0.3)',
    headlineColor: '#4c0519',
    shimmerColor: '#fed7aa',
    audioFilter: 'treble=g=4:f=3500,equalizer=f=800:g=3:w=1,bass=g=2:f=150',
  },
  'cat-todays-match': {
    id: 'cat-todays-match',
    banglaName: 'আজকের খেলা',
    gradientStops: ['#7f1d1d', '#b91c1c', '#d97706', '#450a0a'],
    ambientOrbColor: 'rgba(239, 68, 68, 0.32)',
    ambientOrb2Color: 'rgba(245, 158, 11, 0.28)',
    badgeBg: '#dc2626',
    badgeText: '#ffffff',
    badgeDot: '#facc15',
    cardBorder: 'rgba(220, 38, 38, 0.65)',
    cardGlow: 'rgba(220, 38, 38, 0.45)',
    headlineColor: '#450a0a',
    shimmerColor: '#fef08a',
    audioFilter: 'asetrate=44100*1.18,aresample=48000,bass=g=7:f=85,treble=g=5:f=4500',
  },
};

export interface ReelRenderInput {
  headline: string;
  category?: string;
  imageUrl?: string;
  website?: string;
  durationSeconds?: number;
  fps?: number;
  width?: number;
  height?: number;
  aspectRatio?: '1:1' | '9:16';
  theme?: ReelTheme | string;
  isEnglish?: boolean;
  pageName?: string;
  pageId?: string;
  description?: string;
  voiceoverBuffer?: Buffer;
}

export class ReelVideoRenderer {
  private fontsRegistered: boolean = false;
  private ttsService: UnifiedTtsService;

  constructor() {
    this.registerFonts();
    this.ttsService = new UnifiedTtsService();
  }

  private registerFonts(): void {
    if (this.fontsRegistered) return;

    const candidatePaths = [
      path.join(config.ASSETS_DIR, 'fonts'),
      path.join(process.cwd(), 'assets', 'fonts'),
      path.join(__dirname, '..', '..', '..', 'assets', 'fonts'),
    ];

    const fontsDir = candidatePaths.find((p) => fs.existsSync(p));

    if (fontsDir) {
      const boldPath = path.join(fontsDir, 'HindSiliguri-Bold.ttf');
      const regularPath = path.join(fontsDir, 'HindSiliguri-Regular.ttf');
      const notoPath = path.join(fontsDir, 'NotoSansBengali-Regular.ttf');

      if (fs.existsSync(boldPath)) {
        GlobalFonts.registerFromPath(boldPath, 'Hind Siliguri');
      }
      if (fs.existsSync(regularPath)) {
        GlobalFonts.registerFromPath(regularPath, 'Hind Siliguri Regular');
      }
      if (fs.existsSync(notoPath)) {
        GlobalFonts.registerFromPath(notoPath, 'Noto Sans Bengali');
      }
      this.fontsRegistered = true;
    }
  }

  /**
   * Helper to wrap Bengali text within a max width
   */
  private wrapText(ctx: any, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  /**
   * Helper to draw an article image with Ken Burns slow zoom
   */
  private drawZoomedImage(
    ctx: any,
    img: any,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom: number = 1.0,
    panY: number = 0
  ) {
    if (!img) return;
    const imgRatio = img.width / img.height;
    const frameRatio = w / h;
    let drawW: number;
    let drawH: number;

    if (imgRatio > frameRatio) {
      drawH = h * zoom;
      drawW = drawH * imgRatio;
    } else {
      drawW = w * zoom;
      drawH = drawW / imgRatio;
    }

    const drawX = x - (drawW - w) / 2;
    const drawY = y - (drawH - h) / 2 + panY;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  /**
   * Generates a single static preview JPEG buffer for a specific theme
   */
  public async renderStaticPreview(input: ReelRenderInput): Promise<Buffer> {
    this.registerFonts();

    const rawTheme = input.theme || 'auto-category';
    const headline = (input.headline || '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি').trim();
    const isEnglish = Boolean(
      input.isEnglish ||
      (input.website && input.website.includes('trendingnews')) ||
      (input.pageName && input.pageName.includes('Trending')) ||
      (input.pageId === '1526917347161119') ||
      (typeof rawTheme === 'string' && rawTheme.includes('trendingnews')) ||
      isEnglishText(headline)
    );

    let category = (input.category || '').trim();
    if (isEnglish) {
      if (!category || category === 'সাধারণ' || !isEnglishText(category)) {
        category = 'BREAKING NEWS';
      } else {
        category = category.toUpperCase();
      }
    } else {
      if (!category) {
        category = 'আন্তর্জাতিক';
      }
    }

    const defaultSite = isEnglish ? 'trendingnews.world' : 'bdnews.site';
    const website = (input.website || defaultSite).replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    let theme = rawTheme;
    if (theme === 'auto-category') {
      theme = resolveCategoryTheme(category);
    } else if (theme === 'rolling') {
      theme = 'viral-gradient';
    }

    // All Reels are 9:16 vertical format by default (required by Meta Reels, YouTube Shorts, and TikTok).
    // Enforce minimum resolution of AT LEAST 720p HD:
    // Vertical 9:16: minimum 720 x 1280 (720p HD) or 1080 x 1920 (1080p Full HD)
    // Square 1:1: minimum 720 x 720
    const isExplicitlySquare = input.aspectRatio === '1:1' || Boolean(input.height && input.width && input.height === input.width && input.theme !== 'vertical-916');
    const isVertical = !isExplicitlySquare;

    const minWidth = 720;
    const minHeight = isVertical ? 1280 : 720;

    let width = input.width ? Math.max(minWidth, input.width) : minWidth;
    let height = input.height ? Math.max(minHeight, input.height) : minHeight;

    if (isVertical) {
      if (width < 720) width = 720;
      if (height < 1280) height = 1280;
    } else {
      if (width < 720) width = 720;
      if (height < 720) height = 720;
    }

    const refWidth = 1080;
    const refHeight = isVertical ? 1920 : 1080;
    const scaleX = width / refWidth;
    const scaleY = height / refHeight;

    let articleImg: any = null;
    if (input.imageUrl) {
      try {
        articleImg = await loadImage(input.imageUrl);
      } catch (e) {}
    }

    const logoImg = await this.loadLogoImage(isEnglish);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.save();
    if (scaleX !== 1 || scaleY !== 1) {
      ctx.scale(scaleX, scaleY);
    }
    this.renderFrameByTheme(theme, ctx, refWidth, refHeight, 0.4, 8, articleImg, logoImg, headline, category, website, isEnglish);
    ctx.restore();
    return canvas.toBuffer('image/jpeg', 92);
  }

  /**
   * Generates a television studio-grade MP4 news reel video buffer with dynamic motion and broadcast theme audio
   */
  public async renderReel(input: ReelRenderInput): Promise<Buffer> {
    this.registerFonts();

    const rawTheme = input.theme || 'auto-category';
    const headline = (input.headline || '').trim();
    const isEnglish = Boolean(
      input.isEnglish ||
      (input.website && input.website.includes('trendingnews')) ||
      (input.pageName && input.pageName.includes('Trending')) ||
      (input.pageId === '1526917347161119') ||
      (typeof rawTheme === 'string' && rawTheme.includes('trendingnews')) ||
      isEnglishText(headline)
    );

    let category = (input.category || '').trim();
    if (isEnglish) {
      if (!category || category === 'সাধারণ' || !isEnglishText(category)) {
        category = 'BREAKING NEWS';
      } else {
        category = category.toUpperCase();
      }
    } else {
      if (!category) {
        category = 'বিশেষ খবর';
      }
    }

    const defaultSite = isEnglish ? 'trendingnews.world' : 'bdnews.site';
    const website = (input.website || defaultSite).replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    let theme = rawTheme;
    if (theme === 'auto-category') {
      theme = resolveCategoryTheme(category);
    } else if (theme === 'rolling') {
      theme = 'viral-gradient';
    }

    // All Reels are 9:16 vertical format by default (required by Meta Reels, YouTube Shorts, and TikTok).
    // Enforce minimum resolution of AT LEAST 720p HD:
    // Vertical 9:16: minimum 720 x 1280 (720p HD) or 1080 x 1920 (1080p Full HD)
    // Square 1:1: minimum 720 x 720
    const isExplicitlySquare = input.aspectRatio === '1:1' || Boolean(input.height && input.width && input.height === input.width && input.theme !== 'vertical-916');
    const isVertical = !isExplicitlySquare;

    const minWidth = 720;
    const minHeight = isVertical ? 1280 : 720;

    let width = input.width ? Math.max(minWidth, input.width) : minWidth;
    let height = input.height ? Math.max(minHeight, input.height) : minHeight;

    if (isVertical) {
      if (width < 720) width = 720;
      if (height < 1280) height = 1280;
    } else {
      if (width < 720) width = 720;
      if (height < 720) height = 720;
    }

    const refWidth = 1080;
    const refHeight = isVertical ? 1920 : 1080;
    const scaleX = width / refWidth;
    const scaleY = height / refHeight;
    const needsScale = scaleX !== 1 || scaleY !== 1;

    let durationSeconds = input.durationSeconds || 30; // 30 seconds default (for full description readout)
    // Meta Reels strictly requires frame rate between 24 and 60 fps (Sub-24 fps triggers Error 1363129)
    const fps = Math.max(24, input.fps || 24);

    // 1. Preload article image
    let articleImg: any = null;
    if (input.imageUrl) {
      try {
        articleImg = await loadImage(input.imageUrl);
      } catch (e: any) {
        console.warn('[ReelVideoRenderer] Could not load article image for reel:', e.message);
      }
    }

    // 2. Preload channel logo (English or Bengali channel)
    const logoImg = await this.loadLogoImage(isEnglish);

    // 3. Audio soundtrack check - resolve dedicated category audio or category audio filter
    const activeCategoryStyle = CATEGORY_STYLES[theme] || CATEGORY_STYLES[resolveCategoryTheme(category)];
    const catAudioSlug = (activeCategoryStyle?.id || theme).replace('cat-', '');

    const specificAudioCandidates = [
      path.join(config.ASSETS_DIR, 'video', `theme_${catAudioSlug}.aac`),
      path.join(config.ASSETS_DIR, 'video', `theme_${catAudioSlug}.mp3`),
      path.join(process.cwd(), 'assets', 'video', `theme_${catAudioSlug}.aac`),
      path.join(process.cwd(), 'assets', 'video', `theme_${catAudioSlug}.mp3`),
    ];
    const specificAudioPath = specificAudioCandidates.find((p) => fs.existsSync(p));

    const audioCandidates = [
      path.join(config.ASSETS_DIR, 'video', 'broadcast_news_theme.aac'),
      path.join(process.cwd(), 'assets', 'video', 'broadcast_news_theme.aac'),
      path.join(__dirname, '..', '..', '..', 'assets', 'video', 'broadcast_news_theme.aac'),
    ];
    const defaultAudioPath = audioCandidates.find((p) => fs.existsSync(p));

    const finalAudioPath = specificAudioPath || defaultAudioPath;
    const useAudioFilter = !specificAudioPath && !!activeCategoryStyle?.audioFilter;

    // Temporary output file in /tmp or data directory
    const tempOutputDir = process.env.VERCEL ? '/tmp' : path.join(config.DATA_DIR, 'temp');
    if (!fs.existsSync(tempOutputDir)) {
      try {
        fs.mkdirSync(tempOutputDir, { recursive: true });
      } catch (e) {}
    }
    const tempFile = path.join(tempOutputDir, `reel_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp4`);

    // 3B. Synthesize voiceover reading the description (or headline if description is empty)
    let voiceoverBuffer = input.voiceoverBuffer || null;
    const textToSpeak = (input.description && input.description.trim()) ? input.description : headline;
    if (!voiceoverBuffer && textToSpeak) {
      const speechScript = this.ttsService.cleanDescription(textToSpeak, headline);
      if (speechScript) {
        try {
          console.log(`[ReelVideoRenderer] 🎙️ Requesting speech voiceover for: "${speechScript.substring(0, 45)}..."`);
          voiceoverBuffer = await this.ttsService.synthesize(speechScript, {
            isEnglish,
          });
          if (voiceoverBuffer) {
            console.log(`✓ [ReelVideoRenderer] Voiceover generated successfully (${voiceoverBuffer.length} bytes)!`);
          }
        } catch (ttsErr: any) {
          console.warn('[ReelVideoRenderer] TTS note:', ttsErr.message);
        }
      }
    }

    let tempVoiceFile: string | null = null;
    if (voiceoverBuffer && voiceoverBuffer.length > 500) {
      // Estimate voice duration from audio buffer to ensure the reel plays out the full description
      let estVoiceSecs = 0;
      if (voiceoverBuffer.toString('ascii', 0, 4) === 'RIFF') {
        estVoiceSecs = voiceoverBuffer.length / 48000;
      } else {
        estVoiceSecs = voiceoverBuffer.length / 16000;
      }
      if (estVoiceSecs > 0) {
        durationSeconds = Math.max(durationSeconds, Math.min(60, Math.ceil(estVoiceSecs + 1.5)));
      }

      tempVoiceFile = path.join(tempOutputDir, `voice_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp3`);
      try {
        fs.writeFileSync(tempVoiceFile, voiceoverBuffer);
      } catch (e: any) {
        console.warn('[ReelVideoRenderer] Could not write temporary voice file:', e.message);
        tempVoiceFile = null;
      }
    }

    const totalFrames = durationSeconds * fps;

    // 4. Configure FFmpeg spawn arguments (strictly 1 thread to respect shared hosting/CloudLinux limits)
    const ffmpegArgs = [
      '-y',
      '-threads', '1',
      '-thread_queue_size', '1',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-r', String(fps),
      '-i', '-', // Stream from stdin
    ];

    if (finalAudioPath) {
      ffmpegArgs.push(
        '-thread_queue_size', '1',
        '-stream_loop', '-1',
        '-i', finalAudioPath
      );
    } else {
      // Meta Reels strictly requires a stereo 48kHz audio track (generate silent stereo fallback if asset is missing)
      ffmpegArgs.push(
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'
      );
    }

    if (tempVoiceFile) {
      ffmpegArgs.push(
        '-thread_queue_size', '1',
        '-i', tempVoiceFile
      );
    }

    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-threads', '1',
      '-x264opts', 'threads=1:sliced-threads=0:lookahead_threads=0',
      '-crf', '26',
      '-pix_fmt', 'yuv420p',
      '-g', String(fps * 2), // Closed GOP (2s keyframe interval as required by Meta)
      '-keyint_min', String(fps * 2),
      '-sc_threshold', '0'
    );

    if (tempVoiceFile) {
      // Duck background audio to 10% volume while voiceover plays boosted at 220% volume with weights
      const bgFilter = useAudioFilter && activeCategoryStyle?.audioFilter
        ? `${activeCategoryStyle.audioFilter},volume=0.10,aformat=channel_layouts=stereo:sample_rates=48000`
        : 'volume=0.10,aformat=channel_layouts=stereo:sample_rates=48000';
      ffmpegArgs.push(
        '-filter_complex',
        `[1:a]${bgFilter}[bg];[2:a]volume=2.2,aformat=channel_layouts=stereo:sample_rates=48000[voice];[bg][voice]amix=inputs=2:duration=first:dropout_transition=2:weights=0.15 1[aout]`,
        '-map', '0:v',
        '-map', '[aout]'
      );
    } else if (useAudioFilter && activeCategoryStyle?.audioFilter) {
      ffmpegArgs.push('-af', activeCategoryStyle.audioFilter);
    }

    ffmpegArgs.push(
      '-c:a', 'aac',
      '-b:a', '128k', // 128kbps+ AAC as required by Meta
      '-ar', '48000', // 48kHz sample rate as required by Meta
      '-ac', '2',     // Stereo channels as required by Meta
      '-threads', '1',
      '-shortest'
    );

    ffmpegArgs.push('-movflags', '+faststart');
    ffmpegArgs.push(tempFile);

    const ffmpegProcess = spawn(ffmpegPath || 'ffmpeg', ffmpegArgs);

    let ffmpegErr = '';
    let spawnError: any = null;
    let isTerminated = false;

    ffmpegProcess.on('error', (err: any) => {
      spawnError = err;
      isTerminated = true;
    });

    if (ffmpegProcess.stderr) {
      ffmpegProcess.stderr.on('data', (d) => {
        ffmpegErr += d.toString();
      });
    }

    // CRITICAL: Prevent unhandled EPIPE exception if FFmpeg exits early
    if (ffmpegProcess.stdin) {
      ffmpegProcess.stdin.on('error', () => {
        isTerminated = true;
      });
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 5. Render frames loop
    for (let f = 0; f < totalFrames; f++) {
      if (isTerminated || spawnError || !ffmpegProcess.stdin || !ffmpegProcess.stdin.writable) {
        break;
      }

      const progress = f / totalFrames; // 0.0 -> 1.0

      ctx.clearRect(0, 0, width, height);
      if (needsScale) {
        ctx.save();
        ctx.scale(scaleX, scaleY);
        this.renderFrameByTheme(theme, ctx, refWidth, refHeight, progress, f, articleImg, logoImg, headline, category, website, isEnglish);
        ctx.restore();
      } else {
        this.renderFrameByTheme(theme, ctx, width, height, progress, f, articleImg, logoImg, headline, category, website, isEnglish);
      }

      // Write frame to ffmpeg stdin safely with flow control
      const frameBuffer = canvas.toBuffer('image/jpeg', 80);
      try {
        if (!isTerminated && ffmpegProcess.stdin && ffmpegProcess.stdin.writable) {
          const ok = ffmpegProcess.stdin.write(frameBuffer, (wErr) => {
            if (wErr) isTerminated = true;
          });
          if (!ok && !isTerminated) {
            await new Promise<void>((res) => {
              ffmpegProcess.stdin.once('drain', res);
              setTimeout(res, 250);
            });
          }
        } else {
          break;
        }
      } catch {
        isTerminated = true;
        break;
      }
    }

    try {
      if (ffmpegProcess.stdin && ffmpegProcess.stdin.writable) {
        ffmpegProcess.stdin.end();
      }
    } catch {}

    // 30-second watchdog timer to guarantee FFmpeg process is ALWAYS killed and never leaks
    const killWatchdog = setTimeout(() => {
      try {
        if (!ffmpegProcess.killed) {
          console.warn('[ReelVideoRenderer] Watchdog: FFmpeg exceeded 30s timeout, terminating process...');
          ffmpegProcess.kill('SIGKILL');
        }
      } catch {}
    }, 30000);

    try {
      // Wait for ffmpeg to complete
      await new Promise<void>((resolve, reject) => {
        if (spawnError) {
          return reject(spawnError);
        }
        ffmpegProcess.on('close', (code) => {
          clearTimeout(killWatchdog);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg exited with code ${code}: ${ffmpegErr}`));
          }
        });
        ffmpegProcess.on('error', (err) => {
          clearTimeout(killWatchdog);
          reject(err);
        });
      });

      const videoBuffer = fs.readFileSync(tempFile);
      return videoBuffer;
    } finally {
      clearTimeout(killWatchdog);
      try {
        if (!ffmpegProcess.killed) {
          ffmpegProcess.kill('SIGKILL');
        }
      } catch {}
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch {}
      try {
        if (tempVoiceFile && fs.existsSync(tempVoiceFile)) {
          fs.unlinkSync(tempVoiceFile);
        }
      } catch {}
    }
  }

  private async loadLogoImage(isEnglish: boolean = false): Promise<any> {
    const englishCandidates = [
      path.join(config.ASSETS_DIR, 'images', 'trendingnews-logo.png'),
      path.join(process.cwd(), 'assets', 'images', 'trendingnews-logo.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'images', 'trendingnews-logo.png'),
    ];
    const bdCandidates = [
      path.join(config.ASSETS_DIR, 'images', 'bdnews-logo.png'),
      path.join(config.ASSETS_DIR, 'images', 'favicon.png'),
      path.join(process.cwd(), 'assets', 'images', 'bdnews-logo.png'),
      path.join(process.cwd(), 'assets', 'images', 'favicon.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'images', 'bdnews-logo.png'),
    ];
    const logoCandidates = isEnglish ? englishCandidates : bdCandidates;
    const finalLogoPath = logoCandidates.find((p) => fs.existsSync(p));
    if (finalLogoPath) {
      try {
        return await loadImage(finalLogoPath);
      } catch (e) {}
    }
    return null;
  }

  /**
   * Router to render a single frame by theme
   */
  private renderFrameByTheme(
    theme: ReelTheme | string,
    ctx: any,
    width: number,
    height: number,
    progress: number,
    f: number,
    articleImg: any,
    logoImg: any,
    headline: string,
    category: string,
    website: string,
    isEnglish: boolean = false
  ): void {
    if (height >= 1280 || height > width || theme === 'vertical-916') {
      this.renderVerticalFrameWithTheme(theme, ctx, width, height, progress, f, articleImg, logoImg, headline, category, website, isEnglish);
      return;
    }

    if (theme === 'auto-category' || (typeof theme === 'string' && theme.startsWith('cat-'))) {
      const resolvedKey = theme === 'auto-category' ? resolveCategoryTheme(category) : theme;
      const catStyle = CATEGORY_STYLES[resolvedKey] || CATEGORY_STYLES['cat-international'];
      this.renderCategoryReelFrame(catStyle, ctx, width, height, progress, f, articleImg, logoImg, headline, category, website, isEnglish);
      return;
    }

    switch (theme) {
      case 'breaking-bold':
        this.renderFrameBreakingBold(ctx, width, height, progress, f, articleImg, logoImg, headline, category, website, isEnglish);
        break;
      case 'dark-cinema':
        this.renderFrameDarkCinema(ctx, width, height, progress, f, articleImg, logoImg, headline, category, website, isEnglish);
        break;
      case 'studio-red':
        this.renderFrameStudioRed(ctx, width, height, progress, f, articleImg, logoImg, headline, category, website, isEnglish);
        break;
      case 'viral-gradient':
      default:
        this.renderCategoryReelFrame(CATEGORY_STYLES['cat-international'], ctx, width, height, progress, f, articleImg, logoImg, headline, category, website, isEnglish);
        break;
    }
  }

  /**
   * Broadcast-grade unified 9:16 vertical fullscreen Reel (1080x1920) with theme-specific
   * color schemes, typography, and live television studio graphics (Somoy TV / Jamuna TV / BBC style).
   */
  private renderVerticalFrameWithTheme(
    theme: ReelTheme | string,
    ctx: any,
    width: number,
    height: number,
    progress: number,
    f: number,
    articleImg: any,
    logoImg: any,
    headline: string,
    category: string,
    website: string,
    isEnglish: boolean = false
  ): void {
    // 1. Theme Configuration
    let bgColors = ['#3d0202', '#1a0000', '#0f172a', '#020617'];
    let strapBg = '#b91c1c';
    let strapAccent = '#f59e0b';
    let strapText = isEnglish ? 'BREAKING NEWS • SPECIAL DISPATCH' : 'ব্রেকিং নিউজ | BREAKING NEWS';
    let deskColor = '#fecaca';
    let cardBg = '#ffffff';
    let cardBorderColor = 'rgba(185, 28, 28, 0.3)';
    let headlineColor = '#7f1d1d';
    let pillBg = '#ef4444';
    let pillText = '#ffffff';
    let pillPrefix = isEnglish ? 'LIVE • ' : 'লাইভ • ';
    let commentPillBg = '#ffffff';
    let commentPillText = '#0f172a';
    let ribbonBg = 'rgba(185, 28, 28, 0.95)';
    let ribbonBorder = '#ef4444';
    let ribbonText = '#ffffff';

    const activeCategoryKey = theme === 'auto-category' ? resolveCategoryTheme(category) : (typeof theme === 'string' && theme.startsWith('cat-') ? theme : '');
    const catStyle = activeCategoryKey ? CATEGORY_STYLES[activeCategoryKey] : null;

    if (catStyle) {
      bgColors = catStyle.gradientStops;
      strapBg = catStyle.badgeBg;
      strapAccent = catStyle.badgeDot || '#f59e0b';
      strapText = isEnglish ? `${catStyle.id.replace('cat-', '').toUpperCase()} • SPECIAL DISPATCH` : `${catStyle.banglaName} | বিশেষ সংবাদ`;
      deskColor = catStyle.badgeBg;
      cardBorderColor = catStyle.cardBorder;
      headlineColor = catStyle.headlineColor;
      pillBg = catStyle.badgeBg;
      pillText = catStyle.badgeText;
      commentPillBg = catStyle.badgeBg;
      commentPillText = catStyle.badgeText;
      ribbonBg = catStyle.badgeBg;
      ribbonBorder = catStyle.badgeDot || catStyle.badgeBg;
      ribbonText = catStyle.badgeText;
    } else if (theme === 'breaking-bold') {
      bgColors = ['#1e1b4b', '#0f172a', '#090d16', '#020617'];
      strapBg = '#f59e0b';
      strapAccent = '#fbbf24';
      strapText = isEnglish ? 'URGENT NEWS • SPECIAL DISPATCH' : 'জরুরি সংবাদ | URGENT NEWS';
      deskColor = '#78350f';
      cardBg = '#0f172a';
      cardBorderColor = '#f59e0b';
      headlineColor = '#fef08a';
      pillBg = '#f59e0b';
      pillText = '#000000';
      pillPrefix = isEnglish ? 'URGENT • ' : 'জরুরি • ';
      commentPillBg = '#f59e0b';
      commentPillText = '#000000';
      ribbonBg = 'rgba(245, 158, 11, 0.95)';
      ribbonBorder = '#f59e0b';
      ribbonText = '#000000';
    } else if (theme === 'dark-cinema') {
      bgColors = ['#09090b', '#18181b', '#0f172a', '#020617'];
      strapBg = '#10b981';
      strapAccent = '#34d399';
      strapText = isEnglish ? 'LIVE BULLETIN • WORLD EDITION' : 'লাইভ বুলেটিন | LIVE BULLETIN';
      deskColor = '#064e3b';
      cardBg = '#18181b';
      cardBorderColor = 'rgba(56, 189, 248, 0.4)';
      headlineColor = '#f8fafc';
      pillBg = '#10b981';
      pillText = '#ffffff';
      pillPrefix = isEnglish ? 'BULLETIN • ' : 'বুলেটিন • ';
      commentPillBg = '#38bdf8';
      commentPillText = '#020617';
      ribbonBg = 'rgba(16, 185, 129, 0.95)';
      ribbonBorder = '#10b981';
      ribbonText = '#ffffff';
    } else if (theme === 'viral-gradient') {
      bgColors = ['#581c87', '#3b0764', '#1e1b4b', '#020617'];
      strapBg = '#ec4899';
      strapAccent = '#f472b6';
      strapText = isEnglish ? 'TRENDING UPDATE • VIRAL NOW' : 'ভাইরাল আপডেট | VIRAL UPDATE';
      deskColor = '#831843';
      cardBg = '#ffffff';
      cardBorderColor = 'rgba(236, 72, 153, 0.3)';
      headlineColor = '#4c1d95';
      pillBg = '#ec4899';
      pillText = '#ffffff';
      pillPrefix = isEnglish ? 'VIRAL • ' : 'ভাইরাল • ';
      commentPillBg = '#ec4899';
      commentPillText = '#ffffff';
      ribbonBg = 'rgba(236, 72, 153, 0.95)';
      ribbonBorder = '#ec4899';
      ribbonText = '#ffffff';
    }

    // 1. Overall Background (1080x1920)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, bgColors[0]);
    bgGrad.addColorStop(0.35, bgColors[1]);
    bgGrad.addColorStop(0.7, bgColors[2]);
    bgGrad.addColorStop(1, bgColors[3]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Full-Bleed News Photo (Edge-to-Edge: 1080x1175)
    const photoH = 1175;
    if (articleImg) {
      const zoom = 1.0 + progress * 0.08;
      this.drawZoomedImage(ctx, articleImg, 0, 0, width, photoH, zoom);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, width, photoH);

      ctx.fillStyle = '#94a3b8';
      ctx.font = isEnglish ? 'bold 38px sans-serif' : 'bold 38px "Hind Siliguri", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isEnglish ? 'Trending News World • Top Headlines' : 'BD News 24/7 • শীর্ষ সংবাদ', width / 2, photoH / 2);
    }

    // Top subtle vignette for header bug contrast
    const topVig = ctx.createLinearGradient(0, 0, 0, 220);
    topVig.addColorStop(0, 'rgba(0,0,0,0.85)');
    topVig.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topVig;
    ctx.fillRect(0, 0, width, 220);

    // Bottom cinematic vignette transitioning into the lower third
    const botVig = ctx.createLinearGradient(0, photoH - 260, 0, photoH);
    botVig.addColorStop(0, 'rgba(0,0,0,0)');
    botVig.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = botVig;
    ctx.fillRect(0, photoH - 260, width, 260);

    // 3. Top Television Header Bug (Y: 45 to 115)
    ctx.save();
    const logoCenterY = 80;
    const logoRadius = 36;
    if (logoImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(75, logoCenterY, logoRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, 75 - logoRadius, logoCenterY - logoRadius, logoRadius * 2, logoRadius * 2);
      ctx.restore();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(75, logoCenterY, logoRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(75, logoCenterY, logoRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Channel name watermark
    const brandText = isEnglish ? 'TRENDING NEWS WORLD' : 'বিডি নিউজ ২৪/৭';
    ctx.fillStyle = '#ffffff';
    ctx.font = isEnglish ? 'bold 30px sans-serif' : 'bold 36px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 10;
    ctx.fillText(brandText, 128, logoCenterY);

    // Live Category Badge (Top Right)
    const pillW = 280;
    const pillX = width - 35 - pillW;
    ctx.fillStyle = pillBg;
    ctx.beginPath();
    ctx.roundRect(pillX, 55, pillW, 50, 25);
    ctx.fill();

    const dotRadius = 5 + Math.sin(f * 0.4) * 1.5;
    ctx.fillStyle = pillText;
    ctx.beginPath();
    ctx.arc(pillX + 30, logoCenterY, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    const displayCategory = isEnglish ? (isEnglishText(category) ? category.toUpperCase() : 'BREAKING NEWS') : category;
    ctx.fillStyle = pillText;
    ctx.font = isEnglish ? 'bold 22px sans-serif' : 'bold 24px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pillPrefix + displayCategory, pillX + pillW / 2 + 12, logoCenterY);
    ctx.restore();

    // 4. FULL-WIDTH Breaking News Category Strap (1080px Edge-to-Edge!)
    const strapY = 1175;
    const strapH = 72;
    ctx.save();
    ctx.fillStyle = strapBg;
    ctx.fillRect(0, strapY, width, strapH);

    // Accent line on top
    ctx.fillStyle = strapAccent;
    ctx.fillRect(0, strapY, width, 4);

    // Glowing dot + Breaking strap text
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(42, strapY + strapH / 2, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = isEnglish ? 'bold 28px sans-serif' : 'bold 30px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(strapText, 62, strapY + strapH / 2);

    // Right category desk
    ctx.font = isEnglish ? 'bold 24px sans-serif' : 'bold 26px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = deskColor;
    ctx.fillText(isEnglish ? displayCategory + ' DESK' : category + ' ডেস্ক', width - 35, strapY + strapH / 2);
    ctx.restore();

    // 5. FULL-WIDTH Headline Banner (1080px Edge-to-Edge!)
    const cardY = 1247;
    const cardH = 435;
    ctx.save();
    ctx.fillStyle = cardBg;
    ctx.fillRect(0, cardY, width, cardH);

    // Bottom accent border
    ctx.fillStyle = cardBorderColor;
    ctx.fillRect(0, cardY + cardH - 3, width, 3);

    // Dynamic Headline Font Sizing
    let fontSize = 66;
    if (headline.length > 55) fontSize = 60;
    if (headline.length > 85) fontSize = 54;
    if (headline.length > 115) fontSize = 48;

    ctx.font = isEnglish ? `bold ${fontSize}px sans-serif` : `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    ctx.fillStyle = headlineColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxTextWidth = width - 80;
    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * (isEnglish ? 1.25 : 1.35));
    const totalTextHeight = lines.length * lineHeight;
    const startY = cardY + (cardH - totalTextHeight) / 2;

    lines.forEach((l, i) => {
      ctx.fillText(l, width / 2, startY + i * lineHeight);
    });
    ctx.restore();

    // 6. Action Bar (Y: 1700 to 1768)
    const actionY = 1700;
    const actionPillW = 505;
    ctx.save();
    // Website Pill (Left)
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(25, actionY, actionPillW, 66, 33);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(65, actionY + 33, 6, 0, Math.PI * 2);
    ctx.fill();

    const cleanWebsite = (website || (isEnglish ? 'trendingnews.world' : 'bdnews.site')).toUpperCase();
    ctx.fillStyle = '#f8fafc';
    ctx.font = isEnglish ? 'bold 24px sans-serif' : 'bold 26px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanWebsite, 85, actionY + 33);

    // Comment Link Pill (Right)
    const comPillX = width - 25 - actionPillW;
    ctx.fillStyle = commentPillBg;
    ctx.beginPath();
    ctx.roundRect(comPillX, actionY, actionPillW, 66, 33);
    ctx.fill();

    // Chat bubble vector icon
    ctx.fillStyle = commentPillText;
    const cIconX = comPillX + 45;
    const cIconY = actionY + 33;
    ctx.beginPath();
    ctx.roundRect(cIconX - 12, cIconY - 9, 22, 16, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cIconX - 4, cIconY + 7);
    ctx.lineTo(cIconX - 8, cIconY + 12);
    ctx.lineTo(cIconX + 1, cIconY + 7);
    ctx.fill();

    ctx.fillStyle = commentPillText;
    ctx.font = isEnglish ? 'bold 24px sans-serif' : 'bold 26px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(isEnglish ? 'Full story in first comment' : 'বিস্তারিত প্রথম কমেন্টে দেখুন', cIconX + 22, actionY + 33);
    ctx.restore();

    // 7. FULL-WIDTH Follow Ticker Strip (1080px Edge-to-Edge!)
    const ribbonY = 1790;
    const ribbonH = 65;
    ctx.save();
    ctx.fillStyle = ribbonBg;
    ctx.fillRect(0, ribbonY, width, ribbonH);

    ctx.fillStyle = ribbonText;
    ctx.beginPath();
    ctx.arc(220, ribbonY + ribbonH / 2, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ribbonText;
    ctx.font = isEnglish ? 'bold 22px sans-serif' : 'bold 24px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isEnglish ? 'Follow & Share • Trending News World Official Page' : 'ফলো ও শেয়ার করুন • BD News 24/7 অফিসিয়াল পেইজ', width / 2, ribbonY + ribbonH / 2);
    ctx.restore();
  }

  // ============================================================================
  // THEME 1: Studio Red (Canva Replica Studio - 1080x1080)
  // ============================================================================
  private renderFrameStudioRed(
    ctx: any,
    width: number,
    height: number,
    progress: number,
    f: number,
    articleImg: any,
    logoImg: any,
    headline: string,
    category: string,
    website: string,
    isEnglish: boolean = false
  ): void {
    // A. Studio Red Gradient Background
    const bgGrad = ctx.createRadialGradient(540, 360, 40, 540, 540, 780);
    bgGrad.addColorStop(0, '#8c0404');
    bgGrad.addColorStop(0.35, '#6a0101');
    bgGrad.addColorStop(0.7, '#3d0000');
    bgGrad.addColorStop(1, '#1a0000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Moving ambient light streak
    ctx.save();
    ctx.beginPath();
    const beamOffset = Math.sin(progress * Math.PI) * 60;
    ctx.moveTo(-100, 200 + beamOffset);
    ctx.bezierCurveTo(300, 100 - beamOffset, 800, 450 + beamOffset, 1180, 250);
    ctx.lineWidth = 140;
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.06)';
    ctx.stroke();
    ctx.restore();

    // B. Photo Frame with Ken Burns Zoom (1.0 -> 1.08)
    const photoX = 45;
    const photoY = 88;
    const photoW = 990;
    const photoH = 405;
    const photoRadius = 26;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.clip();

    if (articleImg) {
      const zoom = 1.0 + progress * 0.08;
      this.drawZoomedImage(ctx, articleImg, photoX, photoY, photoW, photoH, zoom);
    } else {
      const fallbackGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
      fallbackGrad.addColorStop(0, '#1e293b');
      fallbackGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = fallbackGrad;
      ctx.fillRect(photoX, photoY, photoW, photoH);

      ctx.fillStyle = '#94a3b8';
      ctx.font = isEnglish ? 'bold 28px sans-serif' : 'bold 32px "Hind Siliguri", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isEnglish ? 'Trending News World • Special Report' : 'BD News 24/7 • শীর্ষ সংবাদ', photoX + photoW / 2, photoY + photoH / 2);
    }
    ctx.restore();

    // Crisp White Border around photo
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.stroke();
    ctx.restore();

    // C. Top Category Badge with Pulsing Live Indicator
    ctx.save();
    ctx.font = isEnglish ? 'bold 26px sans-serif' : 'bold 28px "Hind Siliguri", sans-serif';
    const displayCategory = isEnglish ? (isEnglishText(category) ? category.toUpperCase() : 'SPECIAL REPORT') : (category || 'SPECIAL REPORT');
    const dotRadius = 5 + Math.sin(f * 0.4) * 1.5;

    ctx.beginPath();
    ctx.arc(60, 52, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayCategory, 78, 52);

    ctx.font = '500 20px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'right';
    ctx.fillText(isEnglish ? 'LIKE & FOLLOW for updates' : 'LIKE & FOLLOW for more', width - 45, 52);
    ctx.restore();

    // D. Centered Brand Bar (Logo + Brand Name)
    const brandCenterY = 545;
    const logoSize = 72;
    ctx.save();
    ctx.font = isEnglish ? 'bold 36px sans-serif' : 'bold 44px "Hind Siliguri", sans-serif';
    const brandText = isEnglish ? 'TRENDING NEWS WORLD' : 'বিডি নিউজ ২৪/৭';
    const brandTextWidth = ctx.measureText(brandText).width;
    const brandGap = 18;
    const totalBrandWidth = logoSize + brandGap + brandTextWidth;
    const brandStartX = (width - totalBrandWidth) / 2;
    const logoX = brandStartX;
    const textX = brandStartX + logoSize + brandGap;

    if (logoImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, brandCenterY, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, logoX, brandCenterY - logoSize / 2, logoSize, logoSize);
      ctx.restore();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, brandCenterY, logoSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isEnglish) {
      ctx.save();
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, brandCenterY, logoSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(logoX + logoSize / 2, brandCenterY, 14, logoSize / 2 - 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(logoX + 8, brandCenterY);
      ctx.lineTo(logoX + logoSize - 8, brandCenterY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillText(brandText, textX, brandCenterY + 1);
    ctx.restore();

    // E. Ultra-Clear White Headline Card
    const cardX = 45;
    const targetCardY = 600;
    const animOffset = Math.max(0, (1 - Math.min(1, progress * 4)) * 30);
    const cardY = targetCardY + animOffset;
    const cardW = 990;
    const cardH = 305;
    const cardRadius = 32;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(180, 0, 0, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Headline Text
    ctx.save();
    ctx.fillStyle = isEnglish ? '#0b1329' : '#800000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxTextWidth = cardW - 84;
    let fontSize = 52;
    if (headline.length > 60) fontSize = 48;
    if (headline.length > 85) fontSize = 44;
    if (headline.length > 115) fontSize = 40;
    if (headline.length > 145) fontSize = 35;
    if (headline.length > 180) fontSize = 31;

    ctx.font = isEnglish ? `bold ${fontSize}px sans-serif` : `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * (isEnglish ? 1.25 : 1.38));
    const totalTextHeight = lines.length * lineHeight;
    const startY = cardY + (cardH - totalTextHeight) / 2;

    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, startY + index * lineHeight);
    });
    ctx.restore();

    // F. Bottom Footer Bar
    const footerY = 948;
    const footerH = 54;

    ctx.save();
    const followW = 460;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(45, footerY, followW, footerH, 27);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const iconRadius = 13;
    const iconCenterX = 45 + 24;
    const iconCenterY = footerY + footerH / 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, iconRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '500 18px "Noto Sans Bengali", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Follow us on :', iconCenterX + iconRadius + 10, iconCenterY);

    const cleanWebsite = (website || (isEnglish ? 'trendingnews.world' : 'bdnews.site')).toLowerCase();
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(cleanWebsite, iconCenterX + iconRadius + (isEnglish ? 120 : 130), iconCenterY);
    ctx.restore();

    ctx.save();
    const ribbonW = isEnglish ? 275 : 210;
    const ribbonX = width - 45 - ribbonW;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(ribbonX, footerY, ribbonW, footerH, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Chat bubble vector icon
    ctx.fillStyle = '#0f172a';
    const cIconX = ribbonX + 28;
    const cIconY = footerY + footerH / 2;
    ctx.beginPath();
    ctx.roundRect(cIconX - 10, cIconY - 8, 18, 13, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cIconX - 3, cIconY + 5);
    ctx.lineTo(cIconX - 6, cIconY + 9);
    ctx.lineTo(cIconX + 1, cIconY + 5);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = isEnglish ? 'bold 18px sans-serif' : 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(isEnglish ? 'Full Story in Comments' : 'বিস্তারিত কমেন্টে', cIconX + (isEnglish ? 14 : 18), footerY + footerH / 2 + 1);
    ctx.restore();
  }

  // ============================================================================
  // THEME 2: Breaking News TV Flash (ব্রেকিং নিউজ - 1080x1080)
  // ============================================================================
  private renderFrameBreakingBold(
    ctx: any,
    width: number,
    height: number,
    progress: number,
    f: number,
    articleImg: any,
    logoImg: any,
    headline: string,
    category: string,
    website: string,
    isEnglish: boolean = false
  ): void {
    // A. Dark TV Newsroom Background
    const bgRad = ctx.createRadialGradient(540, 540, 60, 540, 540, 750);
    bgRad.addColorStop(0, '#2e0207');
    bgRad.addColorStop(0.5, '#170104');
    bgRad.addColorStop(1, '#050001');
    ctx.fillStyle = bgRad;
    ctx.fillRect(0, 0, width, height);

    // Subtle laser beam scan across bottom
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    const scanY = 500 + Math.sin(progress * Math.PI * 2) * 200;
    ctx.fillRect(0, scanY, width, 18);
    ctx.restore();

    // B. Top Flashing Breaking Banner
    ctx.save();
    const flashColor = f % 10 < 5 ? '#dc2626' : '#b91c1c';
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, width, 85);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 80, width, 6);

    ctx.fillStyle = '#ffffff';
    ctx.font = isEnglish ? 'bold 30px sans-serif' : 'bold 36px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText(isEnglish ? '⚡ BREAKING NEWS • SPECIAL DISPATCH ⚡' : '⚡ ব্রেকিং নিউজ • BREAKING NEWS ⚡', width / 2, 42);
    ctx.restore();

    // C. Photo Box with Gold & Crimson Dual Border
    const photoX = 40;
    const photoY = 115;
    const photoW = 1000;
    const photoH = 420;
    const photoRadius = 24;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.clip();

    if (articleImg) {
      const zoom = 1.0 + progress * 0.07;
      const panY = -progress * 15;
      this.drawZoomedImage(ctx, articleImg, photoX, photoY, photoW, photoH, zoom, panY);

      // Vignette gradient over bottom of photo
      const vig = ctx.createLinearGradient(0, photoY + photoH - 120, 0, photoY + photoH);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = vig;
      ctx.fillRect(photoX, photoY + photoH - 120, photoW, 120);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(photoX, photoY, photoW, photoH);
    }
    ctx.restore();

    // Dual Border
    ctx.save();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.stroke();

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Channel Brand in photo
    if (logoImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(photoX + 48, photoY + 48, 30, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, photoX + 18, photoY + 18, 60, 60);
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = isEnglish ? 'bold 24px sans-serif' : 'bold 26px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText(isEnglish ? 'TRENDING NEWS WORLD' : 'BD NEWS 24/7', photoX + 90, photoY + 48);
    ctx.restore();

    // D. High-Visibility Headline Box
    const boxX = 40;
    const boxY = 560;
    const boxW = 1000;
    const boxH = 360;
    const boxRadius = 28;

    ctx.save();
    const boxGrad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
    boxGrad.addColorStop(0, '#991b1b');
    boxGrad.addColorStop(0.5, '#7f1d1d');
    boxGrad.addColorStop(1, '#450a0a');
    ctx.fillStyle = boxGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, boxRadius);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Yellow side bar
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(boxX + 15, boxY + 20, 10, boxH - 40, 5);
    ctx.fill();
    ctx.restore();

    // Headline Text with Yellow Accent
    ctx.save();
    const maxTextWidth = boxW - 120;
    let fontSize = 52;
    if (headline.length > 60) fontSize = 48;
    if (headline.length > 85) fontSize = 44;
    if (headline.length > 115) fontSize = 39;
    if (headline.length > 145) fontSize = 34;

    ctx.font = isEnglish ? `bold ${fontSize}px sans-serif` : `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * (isEnglish ? 1.25 : 1.38));
    const totalTextHeight = lines.length * lineHeight;
    const startY = boxY + (boxH - totalTextHeight) / 2;

    lines.forEach((l, i) => {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;

      if (i === 0) {
        ctx.fillStyle = '#fef08a'; // Vibrant Gold Highlight for opening
      } else {
        ctx.fillStyle = '#ffffff';
      }
      ctx.fillText(l, boxX + 45, startY + i * lineHeight);
    });
    ctx.restore();

    // E. Bottom Ticker Strap
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 955, width, 70);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 950, width, 5);

    const tickerOffset = (progress * 300) % 600;
    ctx.fillStyle = '#ffffff';
    ctx.font = isEnglish ? 'bold 20px sans-serif' : 'bold 24px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isEnglish
        ? '🔴 TRENDING NEWS WORLD • TOP DISPATCHES • FOLLOW FOR LIVE UPDATES • FULL STORY IN COMMENTS 🔴'
        : '🔴 BD NEWS 24/7 • শীর্ষ সংবাদ আপডেট • চোখ রাখুন আমাদের পেজে • বিস্তারিত কমেন্টে 🔴',
      width / 2 - tickerOffset + 150,
      990
    );
    ctx.restore();
  }

  // ============================================================================
  // THEME 3: Cinematic Dark Cyber (বিবিসি / রয়টার্স স্টাইল - 1080x1080)
  // ============================================================================
  private renderFrameDarkCinema(
    ctx: any,
    width: number,
    height: number,
    progress: number,
    f: number,
    articleImg: any,
    logoImg: any,
    headline: string,
    category: string,
    website: string,
    isEnglish: boolean = false
  ): void {
    // A. Obsidian Background with Ambient Cyan Glow
    const bgRad = ctx.createRadialGradient(540, 200, 60, 540, 540, 800);
    bgRad.addColorStop(0, '#0f172a');
    bgRad.addColorStop(0.5, '#090d16');
    bgRad.addColorStop(1, '#020408');
    ctx.fillStyle = bgRad;
    ctx.fillRect(0, 0, width, height);

    // B. Top Category Badge & Minimalist Brand
    ctx.save();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
    ctx.beginPath();
    ctx.roundRect(45, 28, 240, 46, 23);
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const dotRadius = 5 + Math.sin(f * 0.4) * 1.5;
    ctx.beginPath();
    ctx.arc(68, 51, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee';
    ctx.fill();

    ctx.fillStyle = '#22d3ee';
    ctx.font = isEnglish ? 'bold 22px sans-serif' : 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const catText = isEnglish ? (isEnglishText(category) ? category.toUpperCase() : 'WORLD DESK') : (category || 'আন্তর্জাতিক');
    ctx.fillText(catText, 86, 51);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(isEnglish ? 'TRENDING NEWS WORLD WIRE' : 'BD NEWS 24/7 DIGITAL', width - 45, 51);
    ctx.restore();

    // C. Letterboxed Photo Frame
    const photoX = 45;
    const photoY = 95;
    const photoW = 990;
    const photoH = 440;
    const photoRadius = 24;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.clip();

    if (articleImg) {
      const zoom = 1.0 + progress * 0.08;
      this.drawZoomedImage(ctx, articleImg, photoX, photoY, photoW, photoH, zoom);
    } else {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(photoX, photoY, photoW, photoH);
    }

    // Subtle scanline overlay
    ctx.fillStyle = 'rgba(6, 182, 212, 0.03)';
    for (let y = photoY; y < photoY + photoH; y += 8) {
      ctx.fillRect(photoX, y, photoW, 2);
    }
    ctx.restore();

    // Cyan Border
    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.stroke();
    ctx.restore();

    // D. Center Brand Shield
    const brandCenterY = 580;
    const logoSize = 64;
    ctx.save();
    if (logoImg) {
      ctx.beginPath();
      ctx.arc(width / 2 - 110, brandCenterY, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, width / 2 - 110 - logoSize / 2, brandCenterY - logoSize / 2, logoSize, logoSize);
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.font = isEnglish ? 'bold 36px sans-serif' : 'bold 38px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(isEnglish ? 'TRENDING NEWS WORLD' : 'বিডি নিউজ ২৪/৭', width / 2 - 60, brandCenterY + 2);
    ctx.restore();

    // E. Frosted Dark Glass Headline Card
    const cardX = 45;
    const cardY = 635;
    const cardW = 990;
    const cardH = 270;
    const cardRadius = 24;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cyan Quote Accent
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 64px serif';
    ctx.fillText('“', cardX + 30, cardY + 65);
    ctx.restore();

    // Text
    ctx.save();
    const maxTextWidth = cardW - 140;
    let fontSize = 48;
    if (headline.length > 60) fontSize = 44;
    if (headline.length > 85) fontSize = 40;
    if (headline.length > 115) fontSize = 36;
    if (headline.length > 145) fontSize = 32;

    ctx.font = isEnglish ? `bold ${fontSize}px sans-serif` : `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * (isEnglish ? 1.25 : 1.38));
    const totalTextHeight = lines.length * lineHeight;
    const startY = cardY + (cardH - totalTextHeight) / 2;

    lines.forEach((l, i) => {
      ctx.fillText(l, cardX + 75, startY + i * lineHeight);
    });
    ctx.restore();

    // F. Footer
    ctx.save();
    const footerY = 935;
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.beginPath();
    ctx.roundRect(45, footerY, 450, 50, 25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const cleanWebsite = (website || (isEnglish ? 'trendingnews.world' : 'bdnews.site')).toLowerCase();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌐 ' + cleanWebsite, 75, footerY + 25);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(width - 45 - 280, footerY, 280, 50, 25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = isEnglish ? 'bold 18px sans-serif' : 'bold 20px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isEnglish ? '💬 Full story in comments' : '💬 বিস্তারিত কমেন্টে পড়ুন', width - 45 - 140, footerY + 25);
    ctx.restore();
  }

  // ============================================================================
  // UNIVERSAL LIVELY ANIMATED CATEGORY REEL FRAME (1080x1080 - 13 CATEGORIES)
  // ============================================================================
  private renderCategoryReelFrame(
    style: CategoryReelStyle,
    ctx: any,
    width: number,
    height: number,
    progress: number,
    f: number,
    articleImg: any,
    logoImg: any,
    headline: string,
    category: string,
    website: string,
    isEnglish: boolean = false
  ): void {
    // A. Multi-stop Category Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, style.gradientStops[0]);
    bgGrad.addColorStop(0.35, style.gradientStops[1]);
    bgGrad.addColorStop(0.7, style.gradientStops[2]);
    bgGrad.addColorStop(1, style.gradientStops[3]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // B. Atmospheric Moving Glow Orbs (Subtle Studio Broadcast Ambiance)
    const orb1X = width * 0.75 + Math.sin(progress * Math.PI * 2) * 50;
    const orb1Y = height * 0.18 + Math.cos(progress * Math.PI * 2) * 30;
    ctx.save();
    ctx.fillStyle = style.ambientOrbColor;
    ctx.beginPath();
    ctx.arc(orb1X, orb1Y, 360, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const orb2X = width * 0.22 + Math.cos(progress * Math.PI * 2) * 45;
    const orb2Y = height * 0.82 + Math.sin(progress * Math.PI * 2) * 35;
    ctx.save();
    ctx.fillStyle = style.ambientOrb2Color;
    ctx.beginPath();
    ctx.arc(orb2X, orb2Y, 320, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // C. Top Category Badge with Animated Live Pulsing Beacon
    const displayCategory = isEnglish
      ? (isEnglishText(category) && category !== 'সাধারণ' ? category.toUpperCase() : 'BREAKING NEWS')
      : (category || style.banglaName || 'সংবাদ').trim();
    ctx.save();
    ctx.font = isEnglish ? 'bold 24px sans-serif' : 'bold 24px "Hind Siliguri", sans-serif';
    const textWidth = ctx.measureText(displayCategory).width;
    const badgeW = Math.max(isEnglish ? 240 : 220, textWidth + 80);
    const badgeH = 48;
    const badgeX = 50;
    const badgeY = 28;

    // Badge Pill
    ctx.fillStyle = style.badgeBg;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 24);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Pulsing Beacon Core Dot
    const pulseR = 5.5 + Math.sin(f * 0.35) * 1.8;
    const beaconX = badgeX + 26;
    const beaconY = badgeY + badgeH / 2;
    ctx.fillStyle = style.badgeDot;
    ctx.shadowColor = style.badgeDot;
    ctx.shadowBlur = 10 + Math.sin(f * 0.35) * 6;
    ctx.beginPath();
    ctx.arc(beaconX, beaconY, pulseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Expanding Beacon Ripple Ring (1s period)
    const ripplePhase = (f % 24) / 24;
    const rippleR = 5.5 + ripplePhase * 14;
    const rippleAlpha = Math.max(0, 0.65 * (1 - ripplePhase));
    ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(beaconX, beaconY, rippleR, 0, Math.PI * 2);
    ctx.stroke();

    // Badge Category Text
    ctx.fillStyle = style.badgeText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayCategory, beaconX + 16, beaconY);

    // Top Right Follow CTA
    ctx.fillStyle = '#ffffff';
    ctx.font = isEnglish ? 'bold 22px sans-serif' : 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(isEnglish ? 'LIKE & FOLLOW' : 'লাইক ও ফলো করুন', width - 50, beaconY);
    ctx.restore();

    // D. Floating 3D Framed Photo Box with Ken Burns Motion
    const floatY = Math.sin(progress * Math.PI * 2) * 5;
    const photoX = 50;
    const photoY = 95 + floatY;
    const photoW = 980;
    const photoH = 410;
    const photoRadius = 28;

    // Photo Box Drop Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.fill();
    ctx.restore();

    // Photo Image with Ken Burns Zoom & Subtle Pan
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.clip();

    if (articleImg) {
      const zoom = 1.0 + progress * 0.08;
      const panY = Math.sin(progress * Math.PI) * 10;
      this.drawZoomedImage(ctx, articleImg, photoX, photoY, photoW, photoH, zoom, panY);
    } else {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(photoX, photoY, photoW, photoH);
    }
    ctx.restore();

    // 8px White Photo Border with Animated Specular Shimmer Sweep
    ctx.save();
    const gleamPos = ((f * 20) % (photoW + 400)) - 200;
    const borderGrad = ctx.createLinearGradient(
      photoX + gleamPos - 120,
      photoY,
      photoX + gleamPos + 120,
      photoY + photoH
    );
    borderGrad.addColorStop(0, '#ffffff');
    borderGrad.addColorStop(0.5, style.shimmerColor);
    borderGrad.addColorStop(1, '#ffffff');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.stroke();
    ctx.restore();

    // E. Center Brand Section with Dynamic Logo + Channel Typography
    const brandCenterY = 538;
    const logoSize = 68;
    const brandText = isEnglish ? 'TRENDING NEWS WORLD' : 'বিডি নিউজ ২৪/৭';
    ctx.save();
    ctx.font = isEnglish ? 'bold 36px sans-serif' : 'bold 42px "Hind Siliguri", sans-serif';
    const brandTextWidth = ctx.measureText(brandText).width;
    const brandGap = 16;
    const totalBrandWidth = logoSize + brandGap + brandTextWidth;
    const brandStartX = (width - totalBrandWidth) / 2;
    const logoCenterX = brandStartX + logoSize / 2;
    const textStartX = brandStartX + logoSize + brandGap;

    if (logoImg) {
      // Circular Logo
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoCenterX, brandCenterY, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        logoImg,
        logoCenterX - logoSize / 2,
        brandCenterY - logoSize / 2,
        logoSize,
        logoSize
      );
      ctx.restore();

      // Pulsing Logo Halo Ring
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 + Math.sin(f * 0.25) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(logoCenterX, brandCenterY, logoSize / 2 + 3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isEnglish) {
      // Clean Globe Vector Emblem Fallback
      ctx.save();
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(logoCenterX, brandCenterY, logoSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(logoCenterX, brandCenterY, 12, logoSize / 2 - 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(logoCenterX - logoSize / 2 + 6, brandCenterY);
      ctx.lineTo(logoCenterX + logoSize / 2 - 6, brandCenterY);
      ctx.stroke();
      ctx.restore();
    }

    // Brand Name Typography
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 12;
    ctx.fillText(brandText, textStartX, brandCenterY + 2);
    ctx.restore();

    // F. Headline White Card with Smooth Slide Entrance and Organic Float
    // Smooth ease-out entrance during first 12 frames (0.5s at 24fps)
    const entranceFactor = Math.min(1, f / 12);
    const easeOut = 1 - Math.pow(1 - entranceFactor, 3);
    const entranceOffset = (1 - easeOut) * 35; // Slides up from +35px
    const breathingOffset = Math.sin(f * 0.08) * 3; // Gentle organic hover
    const cardX = 50;
    const cardY = 600 + entranceOffset + breathingOffset;
    const cardW = 980;
    const cardH = 300;
    const cardRadius = 32;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    // Subtle category border accent
    ctx.shadowBlur = 0;
    ctx.strokeStyle = style.cardBorder;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Headline Typography
    ctx.save();
    const maxTextWidth = cardW - 80;
    let fontSize = 52;
    if (headline.length > 60) fontSize = 48;
    if (headline.length > 85) fontSize = 44;
    if (headline.length > 115) fontSize = 40;
    if (headline.length > 145) fontSize = 35;

    ctx.font = isEnglish ? `bold ${fontSize}px sans-serif` : `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    ctx.fillStyle = style.headlineColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * (isEnglish ? 1.25 : 1.38));
    const totalTextHeight = lines.length * lineHeight;
    const startY = cardY + (cardH - totalTextHeight) / 2;

    lines.forEach((l, i) => {
      ctx.fillText(l, width / 2, startY + i * lineHeight);
    });
    ctx.restore();

    // G. Footer Action Buttons with Interactive Feedback
    ctx.save();
    const footerY = 935;

    // Website Pill (Left)
    const cleanWebsite = (website || (isEnglish ? 'trendingnews.world' : 'bdnews.site')).toLowerCase();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(50, footerY, 460, 52, 26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cyan Globe Dot
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(80, footerY + 26, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = isEnglish ? 'bold 20px sans-serif' : 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanWebsite, 98, footerY + 26);

    // Call-To-Action Pill (Right) with Attention Bounce
    const btnFloat = Math.sin(f * 0.22) * 2;
    const rightPillW = isEnglish ? 300 : 280;
    const rightPillX = width - 50 - rightPillW;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.roundRect(rightPillX, footerY + btnFloat, rightPillW, 52, 26);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Vector Chat Bubble Icon
    ctx.fillStyle = style.gradientStops[1];
    const cIconX = rightPillX + (isEnglish ? 28 : 35);
    const cIconY = footerY + btnFloat + 26;
    ctx.beginPath();
    ctx.roundRect(cIconX - 10, cIconY - 8, 18, 13, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cIconX - 3, cIconY + 5);
    ctx.lineTo(cIconX - 6, cIconY + 9);
    ctx.lineTo(cIconX + 1, cIconY + 5);
    ctx.fill();

    ctx.fillStyle = style.gradientStops[0];
    ctx.font = isEnglish ? 'bold 20px sans-serif' : 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(isEnglish ? 'Full Story in Comments' : 'বিস্তারিত কমেন্টে', cIconX + 16, cIconY);
    ctx.restore();
  }

  // ============================================================================
  // THEME 4: Viral Social Mesh (ভাইরাল সোশ্যাল গ্র্যাডিয়েন্ট - 1080x1080)
  // ============================================================================
  private renderFrameViralGradient(
    ctx: any,
    width: number,
    height: number,
    progress: number,
    f: number,
    articleImg: any,
    logoImg: any,
    headline: string,
    category: string,
    website: string,
    isEnglish: boolean = false
  ): void {
    this.renderCategoryReelFrame(
      CATEGORY_STYLES['cat-international'],
      ctx,
      width,
      height,
      progress,
      f,
      articleImg,
      logoImg,
      headline,
      category,
      website,
      isEnglish
    );
  }

  // ============================================================================
  // THEME 5: Vertical Fullscreen Reel (9:16 মোবাইল ফুলস্ক্রিন - 1080x1920)
  // ============================================================================
  private renderFrameVertical916(
    ctx: any,
    width: number,
    height: number,
    progress: number,
    f: number,
    articleImg: any,
    logoImg: any,
    headline: string,
    category: string,
    website: string,
    isEnglish: boolean = false
  ): void {
    // A. 9:16 Vertical Gradient Background (1080x1920)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#500707');
    bgGrad.addColorStop(0.3, '#1f0404');
    bgGrad.addColorStop(0.65, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // B. Top Header Section (y: 60 - 310)
    if (logoImg) {
      ctx.save();
      const logoRadius = 55;
      const logoCenterY = 125;
      ctx.beginPath();
      ctx.arc(width / 2, logoCenterY, logoRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, width / 2 - logoRadius, logoCenterY - logoRadius, logoRadius * 2, logoRadius * 2);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(width / 2, logoCenterY, logoRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = isEnglish ? 'bold 40px sans-serif' : 'bold 46px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 12;
    ctx.fillText(isEnglish ? 'TRENDING NEWS WORLD' : 'বিডি নিউজ ২৪/৭', width / 2, 225);

    // Live pill
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 140, 255, 280, 48, 24);
    ctx.fill();

    const dotRadius = 5 + Math.sin(f * 0.4) * 1.5;
    ctx.beginPath();
    ctx.arc(width / 2 - 100, 279, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const displayCategory = isEnglish ? (isEnglishText(category) ? category.toUpperCase() : 'BREAKING NEWS') : category;
    ctx.fillStyle = '#ffffff';
    ctx.font = isEnglish ? 'bold 22px sans-serif' : 'bold 24px "Hind Siliguri", sans-serif';
    ctx.fillText(isEnglish ? 'LIVE BREAKING • ' + displayCategory : 'লাইভ ব্রেকিং • ' + category, width / 2 + 10, 279);
    ctx.restore();

    // C. Massive Central Photo Box (1000x880)
    const photoX = 40;
    const photoY = 330;
    const photoW = 1000;
    const photoH = 880;
    const photoRadius = 36;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.clip();

    if (articleImg) {
      const zoom = 1.0 + progress * 0.08;
      this.drawZoomedImage(ctx, articleImg, photoX, photoY, photoW, photoH, zoom);

      // Dark vignette gradient at bottom
      const vig = ctx.createLinearGradient(0, photoY + photoH - 180, 0, photoY + photoH);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = vig;
      ctx.fillRect(photoX, photoY + photoH - 180, photoW, 180);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(photoX, photoY, photoW, photoH);
    }
    ctx.restore();

    // 8px White Border
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.stroke();
    ctx.restore();

    // D. Lower-Third White Headline Card (1000x440)
    const cardX = 40;
    const cardY = 1245;
    const cardW = 1000;
    const cardH = 440;
    const cardRadius = 36;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(185, 28, 28, 0.2)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Headline Text
    ctx.save();
    const maxTextWidth = cardW - 100;
    let fontSize = 54;
    if (headline.length > 60) fontSize = 50;
    if (headline.length > 85) fontSize = 46;
    if (headline.length > 115) fontSize = 42;
    if (headline.length > 145) fontSize = 38;

    ctx.font = isEnglish ? `bold ${fontSize}px sans-serif` : `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    ctx.fillStyle = isEnglish ? '#0b1329' : '#7f1d1d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * (isEnglish ? 1.25 : 1.4));
    const totalTextHeight = lines.length * lineHeight;
    const startY = cardY + (cardH - totalTextHeight) / 2;

    lines.forEach((l, i) => {
      ctx.fillText(l, width / 2, startY + i * lineHeight);
    });
    ctx.restore();

    // E. Social Action Pills (y: 1720)
    ctx.save();
    const pillY = 1718;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(40, pillY, 460, 60, 30);
    ctx.fill();

    const cleanWebsite = (website || (isEnglish ? 'trendingnews.world' : 'bdnews.site')).toLowerCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌐 ' + cleanWebsite, 75, pillY + 30);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(width - 40 - 240, pillY, 240, 60, 30);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = isEnglish ? 'bold 20px sans-serif' : 'bold 24px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isEnglish ? '💬 Full story in comments' : '💬 বিস্তারিত কমেন্টে', width - 40 - 120, pillY + 30);

    // Follow Ribbon (y: 1800)
    const ribbonY = 1800;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.beginPath();
    ctx.roundRect(40, ribbonY, 1000, 60, 30);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fca5a5';
    ctx.font = isEnglish ? 'bold 20px sans-serif' : 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isEnglish ? '👆 Follow & Share • Trending News World Official Page' : '👆 ফলো ও শেয়ার করুন • BD News 24/7 অফিসিয়াল পেইজ', width / 2, ribbonY + 30);
    ctx.restore();
  }
}
