import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { ImageRenderer, RenderInput, RenderOutput } from './types.js';
import { config } from '../../config/env.js';

export class CanvasCardRenderer implements ImageRenderer {
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

    let fontsDir = candidatePaths.find((p) => fs.existsSync(p));

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
      console.log('[CanvasCardRenderer] Bengali fonts registered successfully into Skia.');
    }
  }

  /**
   * Renders the 1080x1080 Canva Replica News Card to a high-quality JPEG Buffer
   */
  public async renderCard(input: RenderInput): Promise<Buffer> {
    this.registerFonts();

    const width = 1080;
    const height = 1080;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const headline = (input.headline || '').trim();
    const category = (input.category || 'বিশেষ খবর').trim();
    const imageUrl = input.imageUrl;

    // 1. Deep red gradient background
    const bgGrad = ctx.createRadialGradient(540, 324, 50, 540, 540, 750);
    bgGrad.addColorStop(0, '#7d0202');
    bgGrad.addColorStop(0.55, '#4d0000');
    bgGrad.addColorStop(1, '#250000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle dark vignette overlays
    const vig1 = ctx.createRadialGradient(216, 864, 0, 216, 864, 600);
    vig1.addColorStop(0, 'rgba(0,0,0,0.4)');
    vig1.addColorStop(1, 'transparent');
    ctx.fillStyle = vig1;
    ctx.fillRect(0, 0, width, height);

    // 2. Top Category Badge ("বিশেষ খবর" / "ব্রেকিং নিউজ")
    ctx.save();
    ctx.font = 'bold 28px "Hind Siliguri", sans-serif';
    const badgeText = category;
    const badgeWidth = ctx.measureText(badgeText).width + 76;
    const badgeHeight = 44;
    const badgeX = (width - badgeWidth) / 2;
    const badgeY = 28;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 22);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#8b0000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, 540, badgeY + badgeHeight / 2 + 2);
    ctx.restore();

    // 3. News Photo Frame (990x400)
    const photoX = 45;
    const photoY = 88;
    const photoW = 990;
    const photoH = 400;
    const photoRadius = 24;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.fill();
    ctx.restore();

    // Clip photo to rounded rectangle
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.clip();

    let imageLoaded = false;
    if (imageUrl) {
      try {
        const img = await loadImage(imageUrl);
        const imgRatio = img.width / img.height;
        const frameRatio = photoW / photoH;
        let drawW: number;
        let drawH: number;
        let drawX: number;
        let drawY: number;

        if (imgRatio > frameRatio) {
          drawH = photoH;
          drawW = photoH * imgRatio;
          drawX = photoX - (drawW - photoW) / 2;
          drawY = photoY;
        } else {
          drawW = photoW;
          drawH = photoW / imgRatio;
          drawX = photoX;
          drawY = photoY - (drawH - photoH) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        imageLoaded = true;
      } catch (err: any) {
        console.warn(`[CanvasCardRenderer] Could not load article image (${imageUrl}):`, err.message);
      }
    }

    if (!imageLoaded) {
      // Fallback dark gradient for photo frame
      const fallbackGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
      fallbackGrad.addColorStop(0, '#1e293b');
      fallbackGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = fallbackGrad;
      ctx.fillRect(photoX, photoY, photoW, photoH);

      ctx.fillStyle = '#64748b';
      ctx.font = '24px "Hind Siliguri", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BD News 24/7 Official News Update', photoX + photoW / 2, photoY + photoH / 2);
    }
    ctx.restore();

    // White border around photo
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.stroke();
    ctx.restore();

    // 4. Brand Bar (Logo + "বিডি নিউজ ২৪/৭")
    const brandY = 512;
    const logoSize = 68;
    const logoX = 350;

    const logoCandidates = [
      path.join(config.ASSETS_DIR, 'images', 'bdnews-logo.png'),
      path.join(config.ASSETS_DIR, 'images', 'favicon.png'),
      path.join(process.cwd(), 'assets', 'images', 'bdnews-logo.png'),
      path.join(process.cwd(), 'assets', 'images', 'favicon.png'),
    ];

    const finalLogoPath = logoCandidates.find((p) => fs.existsSync(p));

    ctx.save();
    if (finalLogoPath) {
      try {
        const logoImg = await loadImage(finalLogoPath);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, brandY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logoImg, logoX, brandY, logoSize, logoSize);
        ctx.restore();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, brandY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } catch (e) {
        // Fallback
      }
    }

    // Channel Name text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillText('বিডি নিউজ ২৪/৭', logoX + logoSize + 18, brandY + logoSize / 2);
    ctx.restore();

    // 5. White Headline Card (990x295)
    const cardX = 45;
    const cardY = 605;
    const cardW = 990;
    const cardH = 295;
    const cardRadius = 32;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.restore();

    // Draw Wrapped Bengali Headline Text
    ctx.save();
    ctx.fillStyle = '#990000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dynamic auto-fitting font size based on length
    let fontSize = 52;
    if (headline.length > 70) fontSize = 46;
    if (headline.length > 100) fontSize = 40;
    if (headline.length > 130) fontSize = 35;
    if (headline.length > 160) fontSize = 30;

    ctx.font = `bold ${fontSize}px "Hind Siliguri", sans-serif`;

    const words = headline.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    const maxTextWidth = cardW - 88;

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

    const lineHeight = fontSize * 1.35;
    const totalTextHeight = lines.length * lineHeight;
    const startY = cardY + (cardH - totalTextHeight) / 2 + lineHeight / 2;

    lines.forEach((line, index) => {
      ctx.fillText(line, 540, startY + index * lineHeight);
    });
    ctx.restore();

    // 6. Bottom Footer Bar ("Follow us on: https://bdnews.site" & "বিস্তারিত কমেন্টে")
    const footerY = 945;

    // Follow us pill
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(45, footerY, 440, 52, 26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '20px "Noto Sans Bengali", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Follow us on :  https://bdnews.site', 65, footerY + 26);
    ctx.restore();

    // "বিস্তারিত কমেন্টে" ribbon pill
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.roundRect(835, footerY, 200, 52, 12);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('বিস্তারিত কমেন্টে', 935, footerY + 28);
    ctx.restore();

    // Return high-quality JPEG Buffer (95% quality)
    return canvas.toBuffer('image/jpeg', 95);
  }

  public async renderToBuffer(input: RenderInput): Promise<Buffer> {
    return this.renderCard(input);
  }

  public async render(input: RenderInput): Promise<RenderOutput> {
    const imageBuffer = await this.renderCard(input);

    const renderedDir = path.join(config.DATA_DIR, 'rendered');
    if (!fs.existsSync(renderedDir)) {
      try {
        fs.mkdirSync(renderedDir, { recursive: true });
      } catch (e) {
        // Read-only filesystem safe
      }
    }

    const filename = `news_card_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
    const outputPath = path.join(renderedDir, filename);

    try {
      fs.writeFileSync(outputPath, imageBuffer);
    } catch (e) {
      // In serverless environments, writing to disk might be read-only; in-memory buffer is used
    }

    return {
      imageBuffer,
      outputPath,
      width: 1080,
      height: 1080,
      templateId: input.templateId || 'template-canva-bdnews',
    };
  }

  public async close(): Promise<void> {}
}
