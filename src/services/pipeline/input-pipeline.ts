import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDatabase } from '../../db/index.js';
import { NewsArticle, RssSource, GDriveReelConfig, Setting } from '../../db/schema.js';
import { RssParserService } from '../rss/parser.js';
import { ReelVideoRenderer } from '../renderer/reel.js';
import { CanvasCardRenderer } from '../renderer/canvas.js';
import { GDriveReelService } from '../gdrive/service.js';
import {
  generateTrendingNewsHashtags,
  generateViralReelHashtags,
  isEnglishText,
} from '../../config/constants.js';
import { config } from '../../config/env.js';

export interface SourceInputResult {
  sourceId: string;
  sourceName: string;
  folderId: string;
  totalFetched: number;
  newArticlesFound: number;
  reelsCreated: number;
  uploadedToDrive: number;
  skippedDuplicate: number;
  skippedTooOld: number;
  articles: Array<{
    title: string;
    gdriveFileId?: string;
    filename?: string;
    status: string;
  }>;
  error?: string;
}

export interface InputCronResult {
  success: boolean;
  timestamp: string;
  durationMs: number;
  sourcesProcessed: number;
  totalFetched: number;
  totalReelsCreated: number;
  totalUploadedToDrive: number;
  results: SourceInputResult[];
  error?: string;
}

export class InputPipelineService {
  private parserService: RssParserService;
  private reelRenderer: ReelVideoRenderer;
  private canvasRenderer: CanvasCardRenderer;
  private gdriveService: GDriveReelService;
  private isRunning: boolean = false;

  constructor() {
    this.parserService = new RssParserService();
    this.reelRenderer = new ReelVideoRenderer();
    this.canvasRenderer = new CanvasCardRenderer();
    this.gdriveService = new GDriveReelService();
  }

  /**
   * Cleans filename so it is safe for all filesystems and Google Drive
   */
  private sanitizeFilename(title: string): string {
    return title
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
  }

  /**
   * Resolves the linked Google Drive folder ID for a given RSS source
   */
  public async resolveDriveFolderForSource(source: RssSource): Promise<{ folderId: string; folderName?: string }> {
    const db = getDatabase();

    // 1. Direct folder ID/URL configured on the RSS source itself
    const sourceFolderInput = source.gdriveFolderId || source.gdriveFolderUrlOrId || (source as any).gdrive_folder_url;
    if (sourceFolderInput) {
      const extracted = this.gdriveService.extractFolderId(sourceFolderInput);
      if (extracted) {
        return { folderId: extracted, folderName: `${source.name} Drive Folder` };
      }
    }

    // 2. Folder configured for this source's target Facebook Page
    const targetPageId = source.pageId || (source as any).page_id;
    if (targetPageId) {
      const pageChannel = await db.collection<GDriveReelConfig>('gdrive_reel_configs').findOne({
        $or: [{ pageId: targetPageId }, { sourceId: source._id }],
      });
      if (pageChannel && (pageChannel.folderId || pageChannel.folderUrlOrId)) {
        const extracted = this.gdriveService.extractFolderId(pageChannel.folderUrlOrId || pageChannel.folderId);
        if (extracted) {
          return { folderId: extracted, folderName: pageChannel.name };
        }
      }
    }

    // 3. Fallback to default / primary Google Drive Reel channel
    const defaultChannel = await this.gdriveService.getConfig();
    if (defaultChannel && (defaultChannel.folderId || defaultChannel.folderUrlOrId)) {
      const extracted = this.gdriveService.extractFolderId(defaultChannel.folderUrlOrId || defaultChannel.folderId);
      if (extracted) {
        return { folderId: extracted, folderName: defaultChannel.name };
      }
    }

    // 4. Default fallback folder name based on source
    const fallbackId = `folder_${source._id.slice(0, 8)}`;
    return { folderId: fallbackId, folderName: `${source.name} Default Folder` };
  }

  /**
   * Executes the full Input Pipeline:
   * 1. Fetches data from RSS source
   * 2. Creates reels/video with RSS data using predefined templates
   * 3. Saves the reels video in source-wise linked Google Drive folder
   */
  public async runInputCron(options?: {
    sourceId?: string;
    pageId?: string;
    force?: boolean;
    maxArticlesPerSource?: number;
  }): Promise<InputCronResult> {
    const startTime = Date.now();
    if (this.isRunning && !options?.force) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        durationMs: 0,
        sourcesProcessed: 0,
        totalFetched: 0,
        totalReelsCreated: 0,
        totalUploadedToDrive: 0,
        results: [],
        error: 'Input Cron already in progress. Please wait for the current run to finish.',
      };
    }

    this.isRunning = true;
    try {
      const db = getDatabase();
      const sourcesCol = db.collection<RssSource>('rss_sources');
      const articlesCol = db.collection<NewsArticle>('news_articles');
      const settingsCol = db.collection<Setting>('settings');

      // 1. Determine active sources to process
      const filter: any = {
        $or: [
          { isActive: true },
          { isActive: { $ne: false } },
          { is_active: true },
          { is_active: { $ne: false } },
        ],
      };

      if (options?.sourceId) {
        filter._id = options.sourceId;
      } else if (options?.pageId && options.pageId !== 'all') {
        filter.$and = [
          {
            $or: [{ pageId: options.pageId }, { page_id: options.pageId }],
          },
        ];
      }

      const activeSources = await sourcesCol.find(filter).toArray();
      console.log(`[InputCron] 📥 Input Cron started! Evaluating ${activeSources.length} active RSS sources...`);

      // 2. Determine max article age
      let maxAgeHours = config.MAX_ARTICLE_AGE_HOURS || 24;
      try {
        const ageSetting = await settingsCol.findOne({ _id: 'MAX_ARTICLE_AGE_HOURS' });
        if (ageSetting?.value) {
          const parsed = parseInt(ageSetting.value, 10);
          if (!isNaN(parsed) && parsed > 0) maxAgeHours = parsed;
        }
      } catch {}

      const now = new Date();
      const cutoffTime = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000);
      const maxPerSource = options?.maxArticlesPerSource || 5;

      const sourceResults: SourceInputResult[] = [];
      let grandTotalFetched = 0;
      let grandTotalReelsCreated = 0;
      let grandTotalUploadedToDrive = 0;

      for (const source of activeSources) {
        console.log(`\n[InputCron] 📡 Processing RSS source: "${source.name}" (${source.url})...`);
        const { folderId, folderName } = await this.resolveDriveFolderForSource(source);

        let fetchedItems: any[] = [];
        try {
          fetchedItems = await this.parserService.fetchAndParse(source.url);
        } catch (fetchErr: any) {
          console.error(`[InputCron] Error fetching RSS from "${source.name}":`, fetchErr.message);
          sourceResults.push({
            sourceId: source._id,
            sourceName: source.name,
            folderId,
            totalFetched: 0,
            newArticlesFound: 0,
            reelsCreated: 0,
            uploadedToDrive: 0,
            skippedDuplicate: 0,
            skippedTooOld: 0,
            articles: [],
            error: `Failed to fetch RSS: ${fetchErr.message}`,
          });
          continue;
        }

        grandTotalFetched += fetchedItems.length;

        // Sort items OLDEST FIRST (FIFO order)
        fetchedItems.sort((a, b) => a.pubDate.getTime() - b.pubDate.getTime());

        let newArticlesFound = 0;
        let skippedDuplicate = 0;
        let skippedTooOld = 0;
        let reelsCreated = 0;
        let uploadedToDrive = 0;
        const processedArticles: SourceInputResult['articles'] = [];

        for (const item of fetchedItems) {
          // Age filter
          if (item.pubDate < cutoffTime) {
            skippedTooOld++;
            continue;
          }

          // Deduplication: check against database
          const existing = await articlesCol.findOne({
            $or: [{ guid: item.guid }, { link: item.link }],
          });

          if (existing) {
            skippedDuplicate++;
            continue;
          }

          if (newArticlesFound >= maxPerSource) {
            console.log(`[InputCron] Reached batch limit (${maxPerSource}) for source "${source.name}". Remaining articles will be processed on next tick.`);
            break;
          }

          newArticlesFound++;
          const articleId = crypto.randomUUID();

          // Detect language & category
          const isEnglish =
            (source.templateId && source.templateId.includes('trendingnews')) ||
            isEnglishText(item.title) ||
            isEnglishText(item.category || '');

          let effectiveCategory = item.category || (isEnglish ? 'BREAKING NEWS' : 'বিশেষ খবর');
          if (isEnglish) {
            effectiveCategory = effectiveCategory.toUpperCase();
          }

          const effectiveWebsite = isEnglish ? 'https://trendingnews.world' : 'https://bdnews.site';
          const targetTheme = source.reelTheme || source.templateId || 'auto-category';
          const reelDuration = source.reelDuration || 18;

          console.log(`[InputCron] 🎬 [${newArticlesFound}/${maxPerSource}] Rendering Reel for "${item.title}" (Theme: ${targetTheme})...`);

          let reelBuffer: Buffer | null = null;
          try {
            reelBuffer = await this.reelRenderer.renderReel({
              headline: item.title,
              category: effectiveCategory,
              imageUrl: item.imageUrl || undefined,
              theme: targetTheme,
              durationSeconds: reelDuration,
              fps: 24,
              website: effectiveWebsite,
              isEnglish,
              pageName: source.name,
              pageId: source.pageId,
            });
            reelsCreated++;
            grandTotalReelsCreated++;
          } catch (renderErr: any) {
            console.warn(`[InputCron] Reel video rendering note for "${item.title}":`, renderErr.message);
          }

          // If reel buffer succeeded, upload to source-wise linked Google Drive folder
          let gdriveFileId: string | null = null;
          let filename: string = '';

          if (reelBuffer) {
            const hashtags = isEnglish
              ? generateTrendingNewsHashtags({ category: effectiveCategory, headline: item.title })
              : generateViralReelHashtags({ category: effectiveCategory, headline: item.title });

            const cleanHeadline = this.sanitizeFilename(item.title);
            const firstTag = hashtags.split(' ')[0] || '#News';
            filename = `${effectiveCategory} - ${cleanHeadline} ${firstTag}.mp4`;

            // Cache locally in data/rendered
            const localRenderDir = path.join(config.DATA_DIR, 'rendered');
            const localVideoPath = path.join(localRenderDir, `${articleId}.mp4`);
            try {
              if (!fs.existsSync(localRenderDir)) fs.mkdirSync(localRenderDir, { recursive: true });
              fs.writeFileSync(localVideoPath, reelBuffer);
            } catch {}

            console.log(`[InputCron] ☁️ Saving reel "${filename}" to linked Drive folder "${folderId}" (${folderName})...`);
            try {
              const uploadRes = await this.gdriveService.uploadVideoToFolder({
                folderId,
                videoBuffer: reelBuffer,
                filename,
              });

              if (uploadRes.success) {
                gdriveFileId = uploadRes.fileId || null;
                uploadedToDrive++;
                grandTotalUploadedToDrive++;
                console.log(`✓ [InputCron] Saved to Drive folder! (ID: ${gdriveFileId})`);
              }
            } catch (upErr: any) {
              console.error(`[InputCron] Error uploading reel to Drive:`, upErr.message);
            }
          }

          // Insert article doc with full tracking
          const articleDoc: NewsArticle = {
            _id: articleId,
            sourceId: source._id,
            guid: item.guid,
            link: item.link,
            title: item.title,
            description: item.description || '',
            category: effectiveCategory,
            pubDate: item.pubDate,
            imageUrl: item.imageUrl || null,
            status: gdriveFileId ? 'uploaded_to_drive' : (reelBuffer ? 'rendered' : 'ingested'),
            gdriveFileId,
            gdriveFolderId: folderId,
            renderedVideoPath: reelBuffer ? path.join(config.DATA_DIR, 'rendered', `${articleId}.mp4`) : null,
            gdriveUploadStatus: gdriveFileId ? 'uploaded' : 'pending',
            createdAt: new Date(),
          };

          await articlesCol.insertOne(articleDoc as any);

          processedArticles.push({
            title: item.title,
            gdriveFileId: gdriveFileId || undefined,
            filename,
            status: articleDoc.status,
          });
        }

        sourceResults.push({
          sourceId: source._id,
          sourceName: source.name,
          folderId,
          totalFetched: fetchedItems.length,
          newArticlesFound,
          reelsCreated,
          uploadedToDrive,
          skippedDuplicate,
          skippedTooOld,
          articles: processedArticles,
        });
      }

      const totalDuration = Date.now() - startTime;
      console.log(`\n✓ [InputCron] Complete in ${totalDuration}ms: Ingested ${grandTotalReelsCreated} new reels and saved to linked Google Drive folders!`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        durationMs: totalDuration,
        sourcesProcessed: activeSources.length,
        totalFetched: grandTotalFetched,
        totalReelsCreated: grandTotalReelsCreated,
        totalUploadedToDrive: grandTotalUploadedToDrive,
        results: sourceResults,
      };
    } catch (err: any) {
      console.error('[InputCron] Fatal error:', err);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        sourcesProcessed: 0,
        totalFetched: 0,
        totalReelsCreated: 0,
        totalUploadedToDrive: 0,
        results: [],
        error: err.message,
      };
    } finally {
      this.isRunning = false;
    }
  }
}

