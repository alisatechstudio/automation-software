import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { config } from '../../config/env.js';

let ffmpegPath: string = '';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  ffmpegPath = ffmpegInstaller.path;
} catch (e) {
  ffmpegPath = 'ffmpeg';
}

export type ReelTheme =
  | 'studio-red'
  | 'breaking-bold'
  | 'dark-cinema'
  | 'viral-gradient'
  | 'vertical-916';

export interface ReelRenderInput {
  headline: string;
  category?: string;
  imageUrl?: string;
  website?: string;
  durationSeconds?: number;
  fps?: number;
  width?: number;
  height?: number;
  theme?: ReelTheme | string;
}

export class ReelVideoRenderer {
  private fontsRegistered: boolean = false;

  constructor() {
    this.registerFonts();
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

    const theme = (input.theme || 'studio-red') as ReelTheme;
    const isVertical = theme === 'vertical-916' || input.height === 1920;
    const width = isVertical ? 1080 : input.width || 1080;
    const height = isVertical ? 1920 : input.height || 1080;

    const headline = (input.headline || '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি').trim();
    const category = (input.category || 'বিশেষ খবর').trim();
    const website = (input.website || 'bdnews.site').replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    let articleImg: any = null;
    if (input.imageUrl) {
      try {
        articleImg = await loadImage(input.imageUrl);
      } catch (e) {}
    }

    const logoImg = await this.loadLogoImage();
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    this.renderFrameByTheme(theme, ctx, width, height, 0.4, 8, articleImg, logoImg, headline, category, website);
    return canvas.toBuffer('image/jpeg', 92);
  }

  /**
   * Generates a television studio-grade MP4 news reel video buffer with dynamic motion and broadcast theme audio
   */
  public async renderReel(input: ReelRenderInput): Promise<Buffer> {
    this.registerFonts();

    const theme = (input.theme || 'studio-red') as ReelTheme;
    const isVertical = theme === 'vertical-916' || input.height === 1920;
    const width = isVertical ? 1080 : input.width || 1080;
    const height = isVertical ? 1920 : input.height || 1080;

    const durationSeconds = input.durationSeconds || 8;
    const fps = input.fps || 20;
    const totalFrames = durationSeconds * fps;

    const headline = (input.headline || '').trim();
    const category = (input.category || 'বিশেষ খবর').trim();
    const website = (input.website || 'bdnews.site').replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    // 1. Preload article image
    let articleImg: any = null;
    if (input.imageUrl) {
      try {
        articleImg = await loadImage(input.imageUrl);
      } catch (e: any) {
        console.warn('[ReelVideoRenderer] Could not load article image for reel:', e.message);
      }
    }

    // 2. Preload channel logo
    const logoImg = await this.loadLogoImage();

    // 3. Audio soundtrack check
    const audioCandidates = [
      path.join(config.ASSETS_DIR, 'video', 'broadcast_news_theme.aac'),
      path.join(process.cwd(), 'assets', 'video', 'broadcast_news_theme.aac'),
      path.join(__dirname, '..', '..', '..', 'assets', 'video', 'broadcast_news_theme.aac'),
    ];
    const audioPath = audioCandidates.find((p) => fs.existsSync(p));

    // Temporary output file in /tmp or data directory
    const tempOutputDir = process.env.VERCEL ? '/tmp' : path.join(config.DATA_DIR, 'temp');
    if (!fs.existsSync(tempOutputDir)) {
      try {
        fs.mkdirSync(tempOutputDir, { recursive: true });
      } catch (e) {}
    }
    const tempFile = path.join(tempOutputDir, `reel_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp4`);

    // 4. Configure FFmpeg spawn arguments
    const ffmpegArgs = [
      '-y',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-r', String(fps),
      '-i', '-', // Stream from stdin
    ];

    if (audioPath) {
      ffmpegArgs.push('-i', audioPath);
    }

    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '22',
      '-pix_fmt', 'yuv420p'
    );

    if (audioPath) {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
    }

    ffmpegArgs.push(tempFile);

    const ffmpegProcess = spawn(ffmpegPath || 'ffmpeg', ffmpegArgs);

    let ffmpegErr = '';
    ffmpegProcess.stderr.on('data', (d) => {
      ffmpegErr += d.toString();
    });

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 5. Render frames loop
    for (let f = 0; f < totalFrames; f++) {
      const progress = f / totalFrames; // 0.0 -> 1.0

      ctx.clearRect(0, 0, width, height);
      this.renderFrameByTheme(theme, ctx, width, height, progress, f, articleImg, logoImg, headline, category, website);

      // Write frame to ffmpeg stdin
      const frameBuffer = canvas.toBuffer('image/jpeg', 85);
      ffmpegProcess.stdin.write(frameBuffer);
    }

    ffmpegProcess.stdin.end();

    // Wait for ffmpeg to complete
    await new Promise<void>((resolve, reject) => {
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${ffmpegErr}`));
        }
      });
      ffmpegProcess.on('error', reject);
    });

    const videoBuffer = fs.readFileSync(tempFile);

    // Clean up temporary file
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {}

    return videoBuffer;
  }

  private async loadLogoImage(): Promise<any> {
    const logoCandidates = [
      path.join(config.ASSETS_DIR, 'images', 'bdnews-logo.png'),
      path.join(config.ASSETS_DIR, 'images', 'favicon.png'),
      path.join(process.cwd(), 'assets', 'images', 'bdnews-logo.png'),
      path.join(process.cwd(), 'assets', 'images', 'favicon.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'images', 'bdnews-logo.png'),
    ];
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
    website: string
  ): void {
    switch (theme) {
      case 'breaking-bold':
        this.renderFrameBreakingBold(ctx, width, height, progress, f, articleImg, logoImg, headline, category, website);
        break;
      case 'dark-cinema':
        this.renderFrameDarkCinema(ctx, width, height, progress, f, articleImg, logoImg, headline, category, website);
        break;
      case 'viral-gradient':
        this.renderFrameViralGradient(ctx, width, height, progress, f, articleImg, logoImg, headline, category, website);
        break;
      case 'vertical-916':
        this.renderFrameVertical916(ctx, width, height, progress, f, articleImg, logoImg, headline, category, website);
        break;
      case 'studio-red':
      default:
        this.renderFrameStudioRed(ctx, width, height, progress, f, articleImg, logoImg, headline, category, website);
        break;
    }
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
    website: string
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
      ctx.font = 'bold 32px "Hind Siliguri", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BD News 24/7 • শীর্ষ সংবাদ', photoX + photoW / 2, photoY + photoH / 2);
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
    ctx.font = 'bold 28px "Hind Siliguri", sans-serif';
    const catTextWidth = ctx.measureText(category).width;
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
    ctx.fillText('SPECIAL REPORT', 78, 52);

    ctx.font = '500 20px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'right';
    ctx.fillText('LIKE & FOLLOW for more', width - 45, 52);
    ctx.restore();

    // D. Centered Brand Bar (Logo + "বিডি নিউজ ২৪/৭")
    const brandCenterY = 545;
    const logoSize = 72;
    ctx.save();
    ctx.font = 'bold 44px "Hind Siliguri", sans-serif';
    const brandText = 'বিডি নিউজ ২৪/৭';
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

    // Bengali Headline Text
    ctx.save();
    ctx.fillStyle = '#800000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxTextWidth = cardW - 84;
    let fontSize = 52;
    if (headline.length > 60) fontSize = 48;
    if (headline.length > 85) fontSize = 44;
    if (headline.length > 115) fontSize = 40;
    if (headline.length > 145) fontSize = 35;
    if (headline.length > 180) fontSize = 31;

    ctx.font = `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * 1.38);
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

    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌐', iconCenterX, iconCenterY);

    ctx.font = '500 18px "Noto Sans Bengali", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'left';
    ctx.fillText('Follow us on :', iconCenterX + iconRadius + 10, iconCenterY);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(website, iconCenterX + iconRadius + 130, iconCenterY);
    ctx.restore();

    ctx.save();
    const ribbonW = 210;
    const ribbonX = width - 45 - ribbonW;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(ribbonX, footerY, ribbonW, footerH, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('💬', ribbonX + 20, footerY + footerH / 2 + 1);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
    ctx.fillText('বিস্তারিত কমেন্টে', ribbonX + 50, footerY + footerH / 2 + 1);
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
    website: string
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
    ctx.font = 'bold 36px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('⚡ ব্রেকিং নিউজ • BREAKING NEWS ⚡', width / 2, 42);
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
    ctx.font = 'bold 26px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText('BD NEWS 24/7', photoX + 90, photoY + 48);
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

    // Bengali Headline Text with Yellow Accent
    ctx.save();
    const maxTextWidth = boxW - 120;
    let fontSize = 52;
    if (headline.length > 60) fontSize = 48;
    if (headline.length > 85) fontSize = 44;
    if (headline.length > 115) fontSize = 39;
    if (headline.length > 145) fontSize = 34;

    ctx.font = `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * 1.38);
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
    ctx.font = 'bold 24px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔴 BD NEWS 24/7 • শীর্ষ সংবাদ আপডেট • চোখ রাখুন আমাদের পেজে • বিস্তারিত কমেন্টে 🔴', width / 2 - tickerOffset + 150, 990);
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
    website: string
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
    ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(category, 86, 51);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('BD NEWS 24/7 DIGITAL', width - 45, 51);
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
    ctx.font = 'bold 38px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('বিডি নিউজ ২৪/৭', width / 2 - 60, brandCenterY + 2);
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

    ctx.font = `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * 1.38);
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

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌐 ' + website, 75, footerY + 25);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(width - 45 - 280, footerY, 280, 50, 25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💬 বিস্তারিত কমেন্টে পড়ুন', width - 45 - 140, footerY + 25);
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
    website: string
  ): void {
    // A. Multi-stop Sunset Mesh Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#312e81');
    bgGrad.addColorStop(0.35, '#831843');
    bgGrad.addColorStop(0.7, '#9f1239');
    bgGrad.addColorStop(1, '#431407');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ambient floating glow
    ctx.save();
    ctx.fillStyle = 'rgba(251, 146, 60, 0.15)';
    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.2, 350, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // B. Top Badges
    ctx.save();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(50, 28, 250, 48, 24);
    ctx.fill();

    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥 ' + category, 175, 52);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('👍 লাইক ও ফলো করুন', width - 50, 52);
    ctx.restore();

    // C. Floating 3D Photo Box
    const floatY = Math.sin(progress * Math.PI * 2) * 6;
    const photoX = 50;
    const photoY = 95 + floatY;
    const photoW = 980;
    const photoH = 410;
    const photoRadius = 28;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;
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
      const zoom = 1.0 + progress * 0.08;
      this.drawZoomedImage(ctx, articleImg, photoX, photoY, photoW, photoH, zoom);
    } else {
      ctx.fillStyle = '#1e1b4b';
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

    // D. Center Brand
    const brandCenterY = 538;
    const logoSize = 68;
    ctx.save();
    if (logoImg) {
      ctx.beginPath();
      ctx.arc(width / 2 - 110, brandCenterY, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, width / 2 - 110 - logoSize / 2, brandCenterY - logoSize / 2, logoSize, logoSize);
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('বিডি নিউজ ২৪/৭', width / 2 - 60, brandCenterY + 2);
    ctx.restore();

    // E. Headline White Card
    const cardX = 50;
    const cardY = 600;
    const cardW = 980;
    const cardH = 300;
    const cardRadius = 32;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Text in deep plum
    ctx.save();
    const maxTextWidth = cardW - 80;
    let fontSize = 52;
    if (headline.length > 60) fontSize = 48;
    if (headline.length > 85) fontSize = 44;
    if (headline.length > 115) fontSize = 40;
    if (headline.length > 145) fontSize = 35;

    ctx.font = `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    ctx.fillStyle = '#4c0519';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * 1.38);
    const totalTextHeight = lines.length * lineHeight;
    const startY = cardY + (cardH - totalTextHeight) / 2;

    lines.forEach((l, i) => {
      ctx.fillText(l, width / 2, startY + i * lineHeight);
    });
    ctx.restore();

    // F. Footer
    ctx.save();
    const footerY = 935;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(50, footerY, 460, 52, 26);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌐 ' + website, 80, footerY + 26);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(width - 50 - 240, footerY, 240, 52, 26);
    ctx.fill();

    ctx.fillStyle = '#831843';
    ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👉 বিস্তারিত কমেন্টে', width - 50 - 120, footerY + 26);
    ctx.restore();
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
    website: string
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
    ctx.font = 'bold 46px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 12;
    ctx.fillText('বিডি নিউজ ২৪/৭', width / 2, 225);

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

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Hind Siliguri", sans-serif';
    ctx.fillText('লাইভ ব্রেকিং • ' + category, width / 2 + 10, 279);
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

    // Bengali Headline Text
    ctx.save();
    const maxTextWidth = cardW - 100;
    let fontSize = 54;
    if (headline.length > 60) fontSize = 50;
    if (headline.length > 85) fontSize = 46;
    if (headline.length > 115) fontSize = 42;
    if (headline.length > 145) fontSize = 38;

    ctx.font = `bold ${fontSize}px "Hind Siliguri", sans-serif`;
    ctx.fillStyle = '#7f1d1d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const lines = this.wrapText(ctx, headline, maxTextWidth);
    const lineHeight = Math.round(fontSize * 1.4);
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

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌐 ' + website, 75, pillY + 30);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(width - 40 - 240, pillY, 240, 60, 30);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💬 বিস্তারিত কমেন্টে', width - 40 - 120, pillY + 30);

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
    ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👆 ফলো ও শেয়ার করুন • BD News 24/7 অফিসিয়াল পেইজ', width / 2, ribbonY + 30);
    ctx.restore();
  }
}
