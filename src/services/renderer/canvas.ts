import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { ImageRenderer, RenderInput, RenderOutput } from './types.js';
import { config } from '../../config/env.js';
import { isEnglishText } from '../../config/constants.js';

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
      console.log('[CanvasCardRenderer] Bengali fonts registered successfully into Skia.');
    }
  }

  /**
   * Renders the ultra-crisp 1080x1080 Television Studio-Grade News Card to a high-quality JPEG Buffer.
   * Engineered for maximum Bengali typography readability, high contrast, and brand consistency.
   */
  public async renderCard(input: RenderInput): Promise<Buffer> {
    this.registerFonts();

    const width = input.width || 1080;
    const height = input.height || 1080;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const headline = (input.headline || '').trim();
    const templateId = input.templateId || '';
    const isEnglish =
      templateId.includes('trendingnews') ||
      isEnglishText(headline) ||
      isEnglishText(input.category) ||
      Boolean(input.website && input.website.includes('trendingnews'));

    const category = (input.category || (isEnglish ? 'BREAKING NEWS' : 'বিশেষ খবর')).trim();
    const imageUrl = input.imageUrl;
    const website = input.website || (isEnglish ? 'https://trendingnews.world' : 'https://bdnews.site');

    // --- 1. STUDIO BROADCAST BACKGROUND ---
    // Deep multi-stop radial gradient for television studio depth
    const bgGrad = ctx.createRadialGradient(540, 360, 40, 540, 540, 780);
    if (isEnglish) {
      bgGrad.addColorStop(0, '#0e2343');
      bgGrad.addColorStop(0.35, '#09152a');
      bgGrad.addColorStop(0.7, '#050c18');
      bgGrad.addColorStop(1, '#02050b');
    } else {
      bgGrad.addColorStop(0, '#8c0404');
      bgGrad.addColorStop(0.35, '#6a0101');
      bgGrad.addColorStop(0.7, '#3d0000');
      bgGrad.addColorStop(1, '#1a0000');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Elegant curved light streaks (studio broadcast ambient flare)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-100, 200);
    ctx.bezierCurveTo(300, 100, 800, 450, 1180, 250);
    ctx.lineWidth = 140;
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.05)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-100, 900);
    ctx.bezierCurveTo(350, 750, 750, 1050, 1180, 850);
    ctx.lineWidth = 120;
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.04)';
    ctx.stroke();
    ctx.restore();

    // Corner Vignettes for cinematic focus
    const vigTop = ctx.createLinearGradient(0, 0, 0, 180);
    vigTop.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    vigTop.addColorStop(1, 'transparent');
    ctx.fillStyle = vigTop;
    ctx.fillRect(0, 0, width, 180);

    const vigBottom = ctx.createLinearGradient(0, 900, 0, 1080);
    vigBottom.addColorStop(0, 'transparent');
    vigBottom.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vigBottom;
    ctx.fillRect(0, 900, width, 180);

    // --- 2. TOP CATEGORY BADGE ---
    ctx.save();
    ctx.font = isEnglish ? 'bold 24px sans-serif' : 'bold 28px "Hind Siliguri", sans-serif';
    const cleanCategory = isEnglish ? category.toUpperCase() : (category || 'বিশেষ খবর');
    const catTextWidth = ctx.measureText(cleanCategory).width;

    // Badge dimensions with broadcast dot indicator
    const dotRadius = 5;
    const dotGap = 12;
    const paddingX = 36;
    const badgeWidth = catTextWidth + dotRadius * 2 + dotGap + paddingX * 2;
    const badgeHeight = 46;
    const badgeX = (width - badgeWidth) / 2;
    const badgeY = 26;

    // Badge Glass Shadow & Body
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 23);
    ctx.fill();

    // Subtle inner border
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Red broadcast live dot
    const dotX = badgeX + paddingX + dotRadius;
    const dotY = badgeY + badgeHeight / 2;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Category Text (High contrast crimson)
    ctx.fillStyle = '#850000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanCategory, dotX + dotRadius + dotGap, dotY + 1);
    ctx.restore();

    // --- 3. NEWS PHOTO FRAME (990x405) ---
    const photoX = 45;
    const photoY = 88;
    const photoW = 990;
    const photoH = 405;
    const photoRadius = 26;

    // Deep Drop Shadow behind photo frame
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.fill();
    ctx.restore();

    // Clip photo to rounded rectangle
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.clip();

    let photoRendered = false;
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
        photoRendered = true;
      } catch (e: any) {
        console.warn(`[CanvasCardRenderer] Could not load article image (${imageUrl}):`, e.message);
      }
    }

    if (!photoRendered) {
      // Elegant fallback news graphic
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

    // Soft bottom dark gradient over photo so white border and elements pop
    const photoBottomGrad = ctx.createLinearGradient(0, photoY + photoH - 90, 0, photoY + photoH);
    photoBottomGrad.addColorStop(0, 'transparent');
    photoBottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = photoBottomGrad;
    ctx.fillRect(photoX, photoY + photoH - 90, photoW, 90);
    ctx.restore();

    // Crisp White Border around photo
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, photoRadius);
    ctx.stroke();
    ctx.restore();

    // --- 4. BRAND BAR (Logo + Brand Name) - PERFECTLY CENTERED ---
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

    // Render circular logo
    const logoCandidates = (
      isEnglish
        ? [
            input.logoUrl,
            path.join(config.ASSETS_DIR, 'images', 'trendingnews-logo.png'),
            path.join(process.cwd(), 'assets', 'images', 'trendingnews-logo.png'),
            path.join(__dirname, '..', '..', '..', 'assets', 'images', 'trendingnews-logo.png'),
          ]
        : [
            input.logoUrl,
            path.join(config.ASSETS_DIR, 'images', 'bdnews-logo.png'),
            path.join(config.ASSETS_DIR, 'images', 'favicon.png'),
            path.join(process.cwd(), 'assets', 'images', 'bdnews-logo.png'),
            path.join(process.cwd(), 'assets', 'images', 'favicon.png'),
            path.join(__dirname, '..', '..', '..', 'assets', 'images', 'bdnews-logo.png'),
            path.join(__dirname, '..', '..', '..', 'assets', 'images', 'favicon.png'),
          ]
    ).filter(Boolean) as string[];

    const finalLogoPath = logoCandidates.find((p) => p && (p.startsWith('http') || fs.existsSync(p)));
    let logoRendered = false;

    if (finalLogoPath) {
      try {
        const logoImg = await loadImage(finalLogoPath);
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, brandCenterY, logoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logoImg, logoX, brandCenterY - logoSize / 2, logoSize, logoSize);
        ctx.restore();

        // White ring border around logo
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, brandCenterY, logoSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        logoRendered = true;
      } catch (e: any) {
        console.warn('[CanvasCardRenderer] Could not load brand logo:', e.message);
      }
    }

    if (!logoRendered && isEnglish) {
      // Draw Globe Emblem for Trending News World
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, brandCenterY, logoSize / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, brandCenterY, logoSize / 2 - 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(logoX + logoSize / 2, brandCenterY, 14, logoSize / 2 - 8, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(logoX + 8, brandCenterY);
      ctx.lineTo(logoX + logoSize - 8, brandCenterY);
      ctx.stroke();
      ctx.restore();
    }

    // Channel Name Text (Crystal Clear White with Drop Shadow)
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillText(brandText, textX, brandCenterY + 1);
    ctx.restore();

    // --- 5. ULTRA-CLEAR WHITE HEADLINE CARD (990x305) ---
    const cardX = 45;
    const cardY = 600;
    const cardW = 990;
    const cardH = 305;
    const cardRadius = 32;

    // 3D Drop Shadow behind headline card
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    // Ultra-subtle border for card definition
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(180, 0, 0, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // --- HEADLINE TEXT FORMATTING & MAXIMUM VISIBILITY ---
    ctx.save();
    // High-contrast color: deep ruby crimson for Bangla, navy/black for English
    ctx.fillStyle = isEnglish ? '#0b1329' : '#800000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const cleanHeadline = headline.trim();
    const maxTextWidth = cardW - 84; // 42px horizontal padding on each side

    // Calculate optimal font size to balance card filling and legibility
    let fontSize = 54;
    if (cleanHeadline.length > 60) fontSize = 50;
    if (cleanHeadline.length > 85) fontSize = 46;
    if (cleanHeadline.length > 115) fontSize = 41;
    if (cleanHeadline.length > 145) fontSize = 36;
    if (cleanHeadline.length > 180) fontSize = 32;

    ctx.font = isEnglish ? `bold ${fontSize}px sans-serif` : `bold ${fontSize}px "Hind Siliguri", sans-serif`;

    // Word-wrap logic
    const words = cleanHeadline.split(/\s+/);
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

    // Line height tuned for language
    const lineHeight = Math.round(fontSize * (isEnglish ? 1.26 : 1.38));
    const totalTextHeight = lines.length * lineHeight;

    // Mathematically exact vertical centering inside the 305px card
    const startY = cardY + (cardH - totalTextHeight) / 2;

    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, startY + index * lineHeight);
    });
    ctx.restore();

    // --- 6. BOTTOM FOOTER ENGAGEMENT BAR ---
    const footerY = 948;
    const footerH = 54;

    // Left: "🌐 Follow us on : domain"
    ctx.save();
    const followW = isEnglish ? 490 : 460;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(45, footerY, followW, footerH, 27);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Small Globe icon circle
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

    // Clean domain display
    const cleanHost = website.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    ctx.font = isEnglish ? '600 17px sans-serif' : '500 18px "Noto Sans Bengali", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'left';
    ctx.fillText('Follow us on :', iconCenterX + iconRadius + 10, iconCenterY);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(cleanHost, iconCenterX + iconRadius + (isEnglish ? 125 : 130), iconCenterY);
    ctx.restore();

    // Right: Ribbon Pill
    ctx.save();
    const ribbonW = isEnglish ? 275 : 210;
    const ribbonX = width - 45 - ribbonW;

    // Elegant White Ribbon with Silver Glow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(ribbonX, footerY, ribbonW, footerH, 16);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Chat Icon + Text
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('💬', ribbonX + 18, footerY + footerH / 2 + 1);

    ctx.fillStyle = '#0f172a';
    ctx.font = isEnglish ? 'bold 18px sans-serif' : 'bold 22px "Hind Siliguri", sans-serif';
    ctx.fillText(isEnglish ? 'Full Story in Comments' : 'বিস্তারিত কমেন্টে', ribbonX + (isEnglish ? 46 : 50), footerY + footerH / 2 + 1);
    ctx.restore();

    // Output 95% Quality JPEG Buffer
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
