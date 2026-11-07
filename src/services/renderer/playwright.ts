import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import handlebars from 'handlebars';
import type { Browser, BrowserContext } from 'playwright';
import { ImageRenderer, RenderInput, RenderOutput } from './types.js';
import { AVAILABLE_TEMPLATES, TEMPLATES, isEnglishText } from '../../config/constants.js';
import { config } from '../../config/env.js';

export class PlaywrightImageRenderer implements ImageRenderer {
  private browser: Browser | null = null;
  private templatesCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private fontNotoBase64: string = '';
  private fontHindBoldBase64: string = '';
  private fallbackImageBase64: string = '';
  private logoBase64: string = '';

  constructor() {
    this.loadStaticAssets();
  }

  private loadStaticAssets(): void {
    const assetsDir = config.ASSETS_DIR;
    const notoPath = path.join(assetsDir, 'fonts', 'NotoSansBengali-Regular.ttf');
    const hindBoldPath = path.join(assetsDir, 'fonts', 'HindSiliguri-Bold.ttf');
    const fallbackPath = path.join(assetsDir, 'images', 'fallback.svg');
    const bdLogoPath = path.join(assetsDir, 'images', 'bdnews-logo.png');
    const faviconPath = path.join(assetsDir, 'images', 'favicon.png');
    const logoPath = path.join(assetsDir, 'images', 'logo.svg');

    if (fs.existsSync(notoPath)) {
      this.fontNotoBase64 = `data:font/truetype;charset=utf-8;base64,${fs.readFileSync(notoPath).toString('base64')}`;
    }
    if (fs.existsSync(hindBoldPath)) {
      this.fontHindBoldBase64 = `data:font/truetype;charset=utf-8;base64,${fs.readFileSync(hindBoldPath).toString('base64')}`;
    }
    if (fs.existsSync(fallbackPath)) {
      this.fallbackImageBase64 = `data:image/svg+xml;base64,${fs.readFileSync(fallbackPath).toString('base64')}`;
    }
    if (fs.existsSync(bdLogoPath)) {
      this.logoBase64 = `data:image/png;base64,${fs.readFileSync(bdLogoPath).toString('base64')}`;
    } else if (fs.existsSync(faviconPath)) {
      this.logoBase64 = `data:image/png;base64,${fs.readFileSync(faviconPath).toString('base64')}`;
    } else if (fs.existsSync(logoPath)) {
      this.logoBase64 = `data:image/svg+xml;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      const chromiumArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ];

      try {
        const { chromium } = await import('playwright');
        this.browser = await chromium.launch({
          headless: true,
          executablePath: process.env.CHROMIUM_PATH || undefined,
          args: chromiumArgs,
        });
      } catch (err: any) {
        console.warn(`[PlaywrightImageRenderer] Headless Chromium not available: ${err.message}`);
        throw new Error(
          `Headless Chromium is not available in this serverless runtime (${err.message}). Queue worker will gracefully use original news photo.`
        );
      }
    }
    return this.browser;
  }

  private getCompiledTemplate(templateId: string): {
    compiled: HandlebarsTemplateDelegate;
    width: number;
    height: number;
  } {
    const templateDef = AVAILABLE_TEMPLATES[templateId] || AVAILABLE_TEMPLATES[TEMPLATES.SQUARE_BREAKING];

    if (!this.templatesCache.has(templateDef.id)) {
      const candidatePaths = [
        path.join(process.cwd(), 'src', 'templates', templateDef.filename),
        path.join(process.cwd(), 'dist', 'src', 'templates', templateDef.filename),
        path.join(__dirname, '..', '..', 'templates', templateDef.filename),
        path.join(__dirname, '..', 'templates', templateDef.filename),
      ];

      let source = '';
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          source = fs.readFileSync(p, 'utf8');
          break;
        }
      }

      if (!source) {
        // Fallback inline template to prevent crash
        source = `<!DOCTYPE html><html><body style="background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:40px;"><h1>{{headline}}</h1></body></html>`;
      }

      const compiled = handlebars.compile(source);
      this.templatesCache.set(templateDef.id, compiled);
    }

    return {
      compiled: this.templatesCache.get(templateDef.id)!,
      width: templateDef.width,
      height: templateDef.height,
    };
  }

  public compileHtml(input: RenderInput): string {
    const templateId = input.templateId || TEMPLATES.CANVA_BDNEWS;
    const { compiled } = this.getCompiledTemplate(templateId);

    const isEnglish = templateId.includes('trendingnews') || isEnglishText(input.headline) || isEnglishText(input.category);
    const dateFormatted =
      input.dateText ||
      (isEnglish
        ? new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }).format(new Date())
        : new Intl.DateTimeFormat('bn-BD', {
            dateStyle: 'full',
          }).format(new Date()));

    const defaultCategory = isEnglish ? 'BREAKING NEWS' : 'বিশেষ খবর';

    return compiled({
      headline: input.headline,
      category: input.category || defaultCategory,
      dateText: dateFormatted,
      imageUrl: input.imageUrl || this.fallbackImageBase64,
      fallbackImage: this.fallbackImageBase64,
      logoUrl: input.logoUrl || this.logoBase64,
      fontNotoSansBengali: this.fontNotoBase64,
      fontHindSiliguriBold: this.fontHindBoldBase64,
      brandColor: input.brandColor || '#dc2626',
      website: input.website || (isEnglish ? 'https://trendingnews.world' : 'https://bdnews.site'),
    });
  }

  public async renderToBuffer(input: RenderInput): Promise<Buffer> {
    const templateId = input.templateId || TEMPLATES.SQUARE_BREAKING;
    const { compiled, width, height } = this.getCompiledTemplate(templateId);

    const renderWidth = input.width || width;
    const renderHeight = input.height || height;

    const isEnglish = templateId.includes('trendingnews') || isEnglishText(input.headline) || isEnglishText(input.category);
    const dateFormatted =
      input.dateText ||
      (isEnglish
        ? new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }).format(new Date())
        : new Intl.DateTimeFormat('bn-BD', {
            dateStyle: 'full',
          }).format(new Date()));

    const defaultCategory = isEnglish ? 'BREAKING NEWS' : 'সাধারণ';

    const html = compiled({
      headline: input.headline,
      category: input.category || defaultCategory,
      dateText: dateFormatted,
      imageUrl: input.imageUrl || this.fallbackImageBase64,
      fallbackImage: this.fallbackImageBase64,
      logoUrl: input.logoUrl || this.logoBase64,
      fontNotoSansBengali: this.fontNotoBase64,
      fontHindSiliguriBold: this.fontHindBoldBase64,
      brandColor: input.brandColor || '#dc2626',
      website: input.website || (isEnglish ? 'https://trendingnews.world' : 'https://bdnews.site'),
    });

    const browser = await this.getBrowser();
    const context: BrowserContext = await browser.newContext({
      viewport: { width: renderWidth, height: renderHeight },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 });

      // Ensure custom fonts and layout have fully settled
      await page.evaluate(async () => {
        if (document.fonts) {
          await document.fonts.ready;
        }
        // Force re-run of autoFit if present
        if (typeof (window as any).autoFit === 'function') {
          (window as any).autoFit();
        }
      });

      // Small pause for any image decode or repaint
      await page.waitForTimeout(100);

      const buffer = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: renderWidth, height: renderHeight },
      });

      return buffer;
    } finally {
      await page.close();
      await context.close();
    }
  }

  public async render(input: RenderInput): Promise<RenderOutput> {
    const templateId = input.templateId || TEMPLATES.SQUARE_BREAKING;
    const { width, height } = this.getCompiledTemplate(templateId);

    const imageBuffer = await this.renderToBuffer(input);

    const renderedDir = path.join(config.DATA_DIR, 'rendered');
    if (!fs.existsSync(renderedDir)) {
      fs.mkdirSync(renderedDir, { recursive: true });
    }

    const filename = `news_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`;
    const outputPath = path.join(renderedDir, filename);

    fs.writeFileSync(outputPath, imageBuffer);

    return {
      imageBuffer,
      outputPath,
      width: input.width || width,
      height: input.height || height,
      templateId,
    };
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

