import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import handlebars from 'handlebars';
import type { Browser, BrowserContext } from 'playwright';
import { ImageRenderer, RenderInput, RenderOutput } from './types.js';
import { AVAILABLE_TEMPLATES, TEMPLATES } from '../../config/constants.js';
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
    if (fs.existsSync(logoPath)) {
      this.logoBase64 = `data:image/svg+xml;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      let chromiumExecutable = process.env.CHROMIUM_PATH || undefined;
      let chromiumArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ];
      let headlessMode: boolean | 'shell' = true;

      // On Vercel / AWS Lambda, use @sparticuz/chromium serverless binary
      if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        try {
          const sparticuzModule = await import('@sparticuz/chromium');
          const sparticuz = (sparticuzModule as any).default || sparticuzModule;
          chromiumExecutable = await sparticuz.executablePath();
          chromiumArgs = sparticuz.args || chromiumArgs;
          headlessMode = sparticuz.headless ?? true;
          console.log('[Playwright] Loaded @sparticuz/chromium for Vercel at', chromiumExecutable);
        } catch (e: any) {
          console.warn('[Playwright] @sparticuz/chromium load failed:', e.message);
        }
      }

      // Try playwright-core with the configured executable path
      try {
        const { chromium: coreChromium } = await import('playwright-core');
        this.browser = await coreChromium.launch({
          headless: headlessMode as any,
          executablePath: chromiumExecutable,
          args: chromiumArgs,
        });
      } catch (coreErr: any) {
        // Fallback to standard playwright for local development / VPS
        try {
          const { chromium: standardChromium } = await import('playwright');
          this.browser = await standardChromium.launch({
            headless: true,
            args: chromiumArgs,
          });
        } catch (stdErr: any) {
          console.warn(`[PlaywrightImageRenderer] Headless Chromium launch failed: ${coreErr.message}`);
          throw new Error(
            `Headless Chromium is not available in this runtime (${coreErr.message}). Queue worker will gracefully use original news photo.`
          );
        }
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

  public async renderToBuffer(input: RenderInput): Promise<Buffer> {
    const templateId = input.templateId || TEMPLATES.SQUARE_BREAKING;
    const { compiled, width, height } = this.getCompiledTemplate(templateId);

    const renderWidth = input.width || width;
    const renderHeight = input.height || height;

    const dateFormatted =
      input.dateText ||
      new Intl.DateTimeFormat('bn-BD', {
        dateStyle: 'full',
      }).format(new Date());

    const html = compiled({
      headline: input.headline,
      category: input.category || 'সাধারণ',
      dateText: dateFormatted,
      imageUrl: input.imageUrl || this.fallbackImageBase64,
      fallbackImage: this.fallbackImageBase64,
      logoUrl: input.logoUrl || this.logoBase64,
      fontNotoSansBengali: this.fontNotoBase64,
      fontHindSiliguriBold: this.fontHindBoldBase64,
      brandColor: input.brandColor || '#dc2626',
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

