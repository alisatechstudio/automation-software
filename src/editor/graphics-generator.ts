import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { EditGraphicCard } from '../types/index.js';

export interface GraphicsGeneratorOptions {
  tempDir: string;
}

export class GraphicsGenerator {
  private tempDir: string;

  constructor(options: GraphicsGeneratorOptions) {
    this.tempDir = path.resolve(process.cwd(), options.tempDir);
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    } catch {
      // In read-only filesystems (e.g., Vercel Lambda /var/task), fallback to os.tmpdir()
      this.tempDir = path.join(os.tmpdir(), 'sports_clip_bot_graphics');
      try {
        if (!fs.existsSync(this.tempDir)) {
          fs.mkdirSync(this.tempDir, { recursive: true });
        }
      } catch {
        // Safe no-op
      }
    }
  }

  /**
   * Generates a 1080x1920 transparent PNG with an official Lower-Third License & Attribution banner.
   */
  public async generateLowerThird(credit: string, licenseType: string, id: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `lower_third_${id}.png`);
    const cleanCredit = this.escapeXml(credit.length > 70 ? `${credit.slice(0, 67)}...` : credit);
    const cleanLicense = this.escapeXml(licenseType);

    const svg = `
      <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ltGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0f172a" stop-opacity="0.92" />
            <stop offset="100%" stop-color="#1e293b" stop-opacity="0.85" />
          </linearGradient>
        </defs>
        <!-- Lower Third Box (in safe zone: Y=1620, Height=140) -->
        <rect x="60" y="1620" width="960" height="140" rx="20" fill="url(#ltGrad)" stroke="#38bdf8" stroke-width="3" />
        
        <!-- License Tag Pill -->
        <rect x="90" y="1645" width="220" height="38" rx="8" fill="#0284c7" />
        <text x="200" y="1670" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">
          ${cleanLicense}
        </text>

        <!-- Attribution Header -->
        <text x="330" y="1670" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#38bdf8">
          FOOTAGE LICENSE EVIDENCE
        </text>

        <!-- Credit Text -->
        <text x="90" y="1725" font-family="Arial, sans-serif" font-size="22" fill="#f8fafc">
          ${cleanCredit}
        </text>
      </svg>
    `;

    await sharp(Buffer.from(svg)).png().toFile(outputPath);
    return outputPath;
  }

  /**
   * Generates an original animated/static sports breakdown stats card overlay (1080x1920 transparent PNG).
   */
  public async generateStatsCard(card: EditGraphicCard, id: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `stats_card_${id}_${card.startTime}.png`);
    const cleanTitle = this.escapeXml(card.title);
    const cleanFact = this.escapeXml(card.statOrFact);
    const cleanSub = this.escapeXml(card.subtitle || 'SPORTS INSIGHTS & HISTORICAL CONTEXT');

    const svg = `
      <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e1b4b" stop-opacity="0.96" />
            <stop offset="100%" stop-color="#312e81" stop-opacity="0.92" />
          </linearGradient>
        </defs>

        <!-- Stats Card Container (Top Center: Y=240, Height=320) -->
        <rect x="70" y="240" width="940" height="300" rx="28" fill="url(#cardGrad)" stroke="#818cf8" stroke-width="4" />
        
        <!-- Badge -->
        <rect x="110" y="275" width="260" height="40" rx="10" fill="#4f46e5" />
        <text x="240" y="302" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle">
          ORIGINAL ANALYSIS
        </text>

        <!-- Title -->
        <text x="110" y="370" font-family="Arial, sans-serif" font-size="44" font-weight="900" fill="#ffffff">
          ${cleanTitle}
        </text>

        <!-- Key Stat or Fact -->
        <text x="110" y="440" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#38bdf8">
          ${cleanFact}
        </text>

        <!-- Subtitle Context -->
        <text x="110" y="495" font-family="Arial, sans-serif" font-size="22" fill="#cbd5e1">
          ${cleanSub}
        </text>
      </svg>
    `;

    await sharp(Buffer.from(svg)).png().toFile(outputPath);
    return outputPath;
  }

  /**
   * Generates a 1080x1920 thumbnail combining background frame with bold typography and compliance banner.
   */
  public async generateThumbnail(
    baseFramePath: string,
    title: string,
    outputPath: string,
    sport = 'SPORTS'
  ): Promise<string> {
    const cleanTitle = this.escapeXml(title.length > 50 ? `${title.slice(0, 47)}...` : title);
    const cleanSport = this.escapeXml(sport.toUpperCase());

    const accentColors = ['#f43f5e', '#f97316', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#eab308'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = (hash * 31 + title.charCodeAt(i)) & 0xffffffff;
    }
    const pillColor = accentColors[Math.abs(hash) % accentColors.length];
    const strokeColor = accentColors[Math.abs(hash + 2) % accentColors.length];

    const overlaySvg = `
      <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.75" />
            <stop offset="35%" stop-color="#000000" stop-opacity="0.1" />
            <stop offset="65%" stop-color="#000000" stop-opacity="0.1" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0.85" />
          </linearGradient>
        </defs>

        <!-- Dark Gradient Vignette for Text Contrast -->
        <rect x="0" y="0" width="1080" height="1920" fill="url(#vignette)" />

        <!-- Sport Category Pill (Top) -->
        <rect x="70" y="160" width="280" height="64" rx="16" fill="${pillColor}" />
        <text x="210" y="204" font-family="Arial, sans-serif" font-size="32" font-weight="900" fill="#ffffff" text-anchor="middle">
          ${cleanSport}
        </text>

        <!-- Main Catchy Title Box (Bottom Center) -->
        <rect x="60" y="1320" width="960" height="260" rx="24" fill="#0f172a" fill-opacity="0.9" stroke="${strokeColor}" stroke-width="4" />
        <text x="100" y="1420" font-family="Arial, sans-serif" font-size="52" font-weight="900" fill="#ffffff">
          ${cleanTitle}
        </text>
        <text x="100" y="1500" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#38bdf8">
          CRITICAL BREAKDOWN &amp; ANALYSIS
        </text>
      </svg>
    `;

    await sharp(baseFramePath)
      .resize(1080, 1920, { fit: 'cover' })
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    return outputPath;
  }

  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
