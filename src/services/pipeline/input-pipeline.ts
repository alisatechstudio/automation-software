import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDatabase, isDbConnected, initDatabase } from '../../db/index.js';
import { NewsArticle, RssSource, GDriveReelConfig, Setting } from '../../db/schema.js';
import { RssParserService } from '../rss/parser.js';
import { ReelVideoRenderer } from '../renderer/reel.js';
import { CanvasCardRenderer } from '../renderer/canvas.js';
import { GDriveReelService } from '../gdrive/service.js';
import { getNextRollingReelTheme } from '../queue/worker.js';
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

    // 2. Look through all configured channels in database
    try {
      const allChannels = await this.gdriveService.getAllChannels();
      const targetPageId = source.pageId || (source as any).page_id;

      // 2A. Match by pageId or sourceId
      const matched = allChannels.find(
        (c) => (targetPageId && c.pageId === targetPageId) || (c as any).sourceId === source._id
      );
      if (matched && (matched.folderId || matched.folderUrlOrId)) {
        const extracted = this.gdriveService.extractFolderId(matched.folderUrlOrId || matched.folderId);
        if (extracted) {
          return { folderId: extracted, folderName: matched.name };
        }
      }

      // 2B. Fallback to any active channel with a folder
      for (const channel of allChannels) {
        if (channel.folderId || channel.folderUrlOrId) {
          const extracted = this.gdriveService.extractFolderId(channel.folderUrlOrId || channel.folderId);
          if (extracted) {
            return { folderId: extracted, folderName: channel.name };
          }
        }
      }
    } catch {}

    // 3. Fallback to settings / env
    try {
      const setting = await db.collection<Setting>('settings').findOne({
        _id: { $in: ['GDRIVE_DEFAULT_FOLDER', 'GDRIVE_FOLDER_ID', 'GOOGLE_DRIVE_FOLDER_ID'] as any },
      });
      if (setting?.value) {
        const extracted = this.gdriveService.extractFolderId(setting.value);
        if (extracted) {
          return { folderId: extracted, folderName: 'Default Settings Drive Folder' };
        }
      }
    } catch {}

    const envFolder = process.env.GDRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (envFolder) {
      const extracted = this.gdriveService.extractFolderId(envFolder);
      if (extracted) {
        return { folderId: extracted, folderName: 'Default Env Drive Folder' };
      }
    }

    // 4. Default fallback folder ID based on source
    const fallbackId = `folder_${source._id ? source._id.slice(0, 8) : 'default'}`;
    return { folderId: fallbackId, folderName: `${source.name} Default Folder` };
  }

  /**
   * Executes the full Input Pipeline:
   * 1. Fetches data from RSS source
   * 2. Creates reels/video with RSS data using predefined templates
   * 3. Saves the reels video in source-wise linked Google Drive folder
   *
   * Supports split execution by sourceId, folderId, pageId, or auto round-robin
   * (1 feed per execution when multiple feeds exist, preventing serverless timeouts).
   */
  public async runInputCron(options?: {
    sourceId?: string;
    folderId?: string;
    pageId?: string;
    force?: boolean;
    maxArticlesPerSource?: number;
    limit?: number;
    allSources?: boolean;
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
      if (!isDbConnected()) {
        try {
          await initDatabase();
        } catch {}
      }

      const db = getDatabase();
      const sourcesCol = db.collection<RssSource>('rss_sources');
      const articlesCol = db.collection<NewsArticle>('news_articles');
      const settingsCol = db.collection<Setting>('settings');

      // 1. Determine active sources to process
      let allSources: RssSource[] = [];
      try {
        await sourcesCol.updateMany(
          { name: { $regex: /bd news|trending news/i } },
          { $set: { reelTheme: 'rolling' } }
        );
        allSources = await sourcesCol.find({}).toArray();
      } catch (findErr: any) {
        console.error('[InputCron] Error fetching RSS sources:', findErr.message);
      }

      let activeSources = allSources.filter((s: any) => {
        const act = s.isActive ?? s.is_active ?? true;
        return act !== false && act !== 0 && act !== '0' && act !== 'false';
      });

      // Filter by specific source, folder, or page
      if (options?.sourceId) {
        activeSources = activeSources.filter((s) => s._id === options.sourceId);
      } else if (options?.folderId) {
        const cleanTarget = this.gdriveService.extractFolderId(options.folderId);
        let folderMatched = activeSources.filter((s: any) => {
          const directFid = this.gdriveService.extractFolderId(s.gdriveFolderId || s.gdriveFolderUrlOrId || s.gdrive_folder_url);
          return directFid && directFid === cleanTarget;
        });
        if (folderMatched.length === 0) {
          const allChannels = await this.gdriveService.getAllChannels();
          const matchingPageIds = allChannels
            .filter((c) => this.gdriveService.extractFolderId(c.folderUrlOrId || c.folderId) === cleanTarget)
            .map((c) => c.pageId);
          folderMatched = activeSources.filter((s: any) => matchingPageIds.includes(s.pageId || s.page_id));
        }
        activeSources = folderMatched;
      } else if (options?.pageId && options.pageId !== 'all') {
        activeSources = activeSources.filter((s: any) => {
          const pid = s.pageId || s.page_id;
          return pid === options.pageId;
        });
      } else if (!options?.allSources && activeSources.length > 1) {
        // Smart Staggered Round-Robin: If no specific feed is targeted, process exactly 1 feed
        // (the one that hasn't run for the longest time) to prevent timeouts & CPU overload.
        activeSources.sort((a: any, b: any) => {
          const timeA = a.lastPolledAt ? new Date(a.lastPolledAt).getTime() : 0;
          const timeB = b.lastPolledAt ? new Date(b.lastPolledAt).getTime() : 0;
          return timeA - timeB;
        });
        const chosen = activeSources[0];
        console.log(`[InputCron] 🔄 Split-Mode: Selected feed "${chosen.name}" (1 of ${allSources.length} active feeds) for this execution to prevent timeouts.`);
        activeSources = [chosen];
      }

      console.log(`[InputCron] 📥 Input Cron started! Evaluating ${activeSources.length} active RSS sources...`);

      if (activeSources.length === 0) {
        console.warn(`[InputCron] ⚠️ No active RSS sources found in database.`);
        return {
          success: true,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          sourcesProcessed: 0,
          totalFetched: 0,
          totalReelsCreated: 0,
          totalUploadedToDrive: 0,
          results: [],
        };
      }

      // 2. Determine max article age
      let maxAgeHours = config.MAX_ARTICLE_AGE_HOURS || 24;
      try {
        const ageSetting = await settingsCol.findOne({ _id: 'MAX_ARTICLE_AGE_HOURS' as any });
        if (ageSetting?.value) {
          const parsed = parseInt(ageSetting.value, 10);
          if (!isNaN(parsed) && parsed > 0) maxAgeHours = parsed;
        }
      } catch {}

      const now = new Date();
      const cutoffTime = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000);
      const maxPerSource = options?.limit || options?.maxArticlesPerSource || 1;

      // Safe execution time budget: 50s on Vercel (60s timeout); 240s elsewhere
      const MAX_EXECUTION_MS = process.env.VERCEL ? 50000 : 240000;

      const sourceResults: SourceInputResult[] = [];
      let grandTotalFetched = 0;
      let grandTotalReelsCreated = 0;
      let grandTotalUploadedToDrive = 0;

      for (const source of activeSources) {
        if (Date.now() - startTime > MAX_EXECUTION_MS) {
          console.log(`[InputCron] ⏱️ Reached execution budget limit (${Math.round((Date.now() - startTime) / 1000)}s). Wrapping up sources cleanly.`);
          break;
        }

        console.log(`\n[InputCron] 📡 Processing RSS source: "${source.name}" (${source.url})...`);
        const { folderId, folderName } = await this.resolveDriveFolderForSource(source);

        let fetchedItems: any[] = [];
        try {
          const parseLimit = options?.limit || (maxPerSource === 1 ? 15 : undefined);
          fetchedItems = await this.parserService.fetchAndParse(source.url, parseLimit);
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

        // Sort items NEWEST FIRST (most recent first - instant processing)
        fetchedItems.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

        // Check if all items in feed are older than cutoff
        const allOlderThanCutoff = fetchedItems.length > 0 && fetchedItems.every((it) => it.pubDate < cutoffTime);

        let newArticlesFound = 0;
        let skippedDuplicate = 0;
        let skippedTooOld = 0;
        let reelsCreated = 0;
        let uploadedToDrive = 0;
        const processedArticles: SourceInputResult['articles'] = [];

        // Select the single most recent article (or up to maxPerSource) - NO QUEUE in DB
        const targetItems: any[] = [];
        for (const item of fetchedItems) {
          if (targetItems.length >= maxPerSource) break;

          // If forced, immediately pick the most recent item
          if (options?.force) {
            targetItems.push(item);
            break;
          }

          // Age filter: skip if older than cutoffTime, UNLESS all feed items are older
          const isTooOld = item.pubDate < cutoffTime;
          if (isTooOld && !allOlderThanCutoff) {
            skippedTooOld++;
            continue;
          }

          // Deduplication: check against database
          const existing = await articlesCol.findOne({
            $or: [{ guid: item.guid }, { link: item.link }],
          });

          const alreadyInDrive = existing && (
            existing.status === 'uploaded_to_drive' ||
            existing.status === 'published' ||
            Boolean(existing.gdriveFileId)
          );

          if (alreadyInDrive) {
            skippedDuplicate++;
            continue;
          }

          targetItems.push(item);
        }

        if (targetItems.length === 0 && !options?.force) {
          console.log(`[InputCron] ℹ️ Feed "${source.name}" is up to date (no new articles). Most recent item already saved in Drive folder "${folderId}".`);
        }

        for (const item of targetItems) {
          newArticlesFound++;
          const existing = await articlesCol.findOne({
            $or: [{ guid: item.guid }, { link: item.link }],
          });
          const articleId = existing?._id || crypto.randomUUID();

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
          const sourceName = source.name || 'default';
          const isBdNews = sourceName.toLowerCase().includes('bd news');
          const isTrendingNews = sourceName.toLowerCase().includes('trending') || isEnglish;

          let targetTheme = source.reelTheme || source.templateId || 'auto-category';
          if (targetTheme === 'rolling' || isBdNews || isTrendingNews) {
            const rotKey = isTrendingNews ? 'trending_news' : (isBdNews ? 'bd_news' : sourceName);
            targetTheme = await getNextRollingReelTheme(db, rotKey);
            console.log(`[InputCron] 🔄 Rolling Rotation (${rotKey}) selected next theme: "${targetTheme}" for "${item.title}"`);
          }
          const reelDuration = source.reelDuration || 15;

          // Lazy-load cover image on-demand for this single target article if not present in RSS
          if (!item.imageUrl && item.link) {
            try {
              console.log(`[InputCron] 🖼️ Lazy-loading cover image for target article: ${item.link}...`);
              item.imageUrl = await this.parserService.scrapeOgImage(item.link);
            } catch (imgErr: any) {
              console.warn('[InputCron] Could not scrape cover image for target article:', imgErr.message);
            }
          }

          console.log(`[InputCron] 🎬 Instantly rendering Reel for most recent RSS item: "${item.title}" (Theme: ${targetTheme})...`);

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
              description: item.description || undefined,
            });
            reelsCreated++;
            grandTotalReelsCreated++;
          } catch (renderErr: any) {
            console.warn(`[InputCron] Reel video rendering note for "${item.title}":`, renderErr.message);
          }

          // If reel buffer succeeded, upload directly to source-wise linked Google Drive folder
          let gdriveFileId: string | null = null;
          let filename: string = '';

          if (reelBuffer) {
            const hashtags = isEnglish
              ? generateTrendingNewsHashtags({ category: effectiveCategory, headline: item.title })
              : generateViralReelHashtags({ category: effectiveCategory, headline: item.title });

            const cleanHeadline = this.sanitizeFilename(item.title);
            const firstTag = hashtags.split(' ')[0] || '#Shorts';
            filename = `${cleanHeadline} ${firstTag}.mp4`;

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

            // Record in DB for deduplication only - NO QUEUE in database
            const articleDoc: any = {
              sourceId: source._id,
              guid: item.guid,
              link: item.link,
              title: item.title,
              description: item.description || '',
              category: effectiveCategory,
              pubDate: item.pubDate,
              imageUrl: item.imageUrl || null,
              status: gdriveFileId ? 'uploaded_to_drive' : 'rendered',
              gdriveFileId,
              gdriveFolderId: folderId,
              renderedVideoPath: localVideoPath,
              gdriveUploadStatus: gdriveFileId ? 'uploaded' : 'pending',
              updatedAt: new Date(),
            };

            if (existing) {
              await articlesCol.updateOne({ _id: existing._id }, { $set: articleDoc });
            } else {
              articleDoc._id = articleId;
              articleDoc.createdAt = new Date();
              await articlesCol.insertOne(articleDoc as any);
            }
          }

          processedArticles.push({
            title: item.title,
            gdriveFileId: gdriveFileId || undefined,
            filename,
            status: gdriveFileId ? 'uploaded_to_drive' : (reelBuffer ? 'rendered' : 'skipped'),
          });
        }

        try {
          await sourcesCol.updateOne(
            { _id: source._id },
            {
              $set: {
                lastPolledAt: new Date(),
                lastReelsCreated: reelsCreated,
                lastUploadedToDrive: uploadedToDrive,
                updatedAt: new Date(),
              },
            }
          );
        } catch {}

        const effectiveFetchedCount = targetItems.length > 0
          ? targetItems.length
          : (skippedDuplicate > 0 ? 1 : Math.min(fetchedItems.length, maxPerSource));

        grandTotalFetched += effectiveFetchedCount;

        sourceResults.push({
          sourceId: source._id,
          sourceName: source.name,
          folderId,
          totalFetched: effectiveFetchedCount,
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

