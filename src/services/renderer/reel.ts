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

export interface ReelRenderInput {
  headline: string;
  category?: string;
  imageUrl?: string;
  website?: string;
  durationSeconds?: number;
  fps?: number;
  width?: number;
  height?: number;
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
   * Generates a television studio-grade 1080x1080 MP4 news reel video buffer with dynamic motion and broadcast theme audio
   */
  public async renderReel(input: ReelRenderInput): Promise<Buffer> {
    this.registerFonts();

    const durationSeconds = input.durationSeconds || 8;
    const fps = input.fps || 20;
    const totalFrames = durationSeconds * fps;
    const width = input.width || 1080;
    const height = input.height || 1080;

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
    let logoImg: any = null;
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
        logoImg = await loadImage(finalLogoPath);
      } catch (e) {}
    }

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
        const imgRatio = articleImg.width / articleImg.height;
        const frameRatio = photoW / photoH;
        let drawW: number;
        let drawH: number;

        if (imgRatio > frameRatio) {
          drawH = photoH * zoom;
          drawW = drawH * imgRatio;
        } else {
          drawW = photoW * zoom;
          drawH = drawW / imgRatio;
        }
        const drawX = photoX - (drawW - photoW) / 2;
        const drawY = photoY - (drawH - photoH) / 2;
        ctx.drawImage(articleImg, drawX, drawY, drawW, drawH);
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
      const dotGap = 12;
      const paddingX = 36;
      const badgeWidth = catTextWidth + 10 + dotGap + paddingX * 2;
      const badgeHeight = 46;
      const badgeX = (width - badgeWidth) / 2;
      const badgeY = 26;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 23);
      ctx.fill();

      // Pulsing red live dot
      const dotX = badgeX + paddingX + 5;
      const dotY = badgeY + badgeHeight / 2;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#850000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(category, dotX + 5 + dotGap, dotY + 1);
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

      // E. Ultra-Clear White Headline Card (Slide-up entry animation)
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

      const words = headline.split(/\s+/);
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(testLine).width > maxTextWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

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

      // Left: "🌐 Follow us on : bdnews.site"
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

      // Right: "💬 বিস্তারিত কমেন্টে"
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
}
