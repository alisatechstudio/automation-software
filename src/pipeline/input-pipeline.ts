import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDatabase, isDbConnected, initDatabase } from '../db/index.js';
import { NewsArticle, RssSource, Setting } from '../db/schema.js';
import { RssParserService } from '../services/rss/parser.js';
import { ReelVideoRenderer } from '../services/renderer/reel.js';
import { CanvasCardRenderer } from '../services/renderer/canvas.js';
import { GoogleDriveUploader } from '../services/gdrive/uploader.js';
import {
  generateTrendingNewsHashtags,
  generateViralReelHashtags,
  isEnglishText,
} from '../config/constants.js';
import { config } from '../config/env.js';

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

export interface PipelineJobState {
  isRunning: boolean;
  stage: string;
  progressPercent: number;
  logs: string[];
  startedAt: string | null;
  completedAt: string | null;
  lastResult: InputCronResult | null;
  lastError: string | null;
}

export class InputPipelineService {
  private parserService: RssParserService;
  private reelRenderer: ReelVideoRenderer;
  private canvasRenderer: CanvasCardRenderer;
  private gdriveUploader: GoogleDriveUploader;
  private isRunning: boolean = false;
  private jobState: PipelineJobState = {
    isRunning: false,
    stage: 'idle',
    progressPercent: 0,
    logs: [],
    startedAt: null,
    completedAt: null,
    lastResult: null,
    lastError: null,
  };

  constructor() {
    this.parserService = new RssParserService();
    this.reelRenderer = new ReelVideoRenderer();
    this.canvasRenderer = new CanvasCardRenderer();
    this.gdriveUploader = new GoogleDriveUploader();
  }

  public getJobState(): PipelineJobState {
    return this.jobState;
  }

  public isJobRunning(): boolean {
    return this.jobState.isRunning;
  }

  public addLog(msg: string) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const line = `[${time}] ${msg}`;
    console.log(`[InputPipeline] ${msg}`);
    this.jobState.logs.push(line);
    if (this.jobState.logs.length > 80) {
      this.jobState.logs.shift();
    }
  }

  public getParser(): RssParserService {
    return this.parserService;
  }

  public getReelRenderer(): ReelVideoRenderer {
    return this.reelRenderer;
  }

  public getCanvasRenderer(): CanvasCardRenderer {
    return this.canvasRenderer;
  }

  public getUploader(): GoogleDriveUploader {
    return this.gdriveUploader;
  }

  public sanitizeFilename(title: string): string {
    return title
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
  }

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
        error: 'Input Cron already in progress. Please wait for current run to finish.',
      };
    }

    this.isRunning = true;
    this.jobState.isRunning = true;
    this.jobState.stage = 'starting';
    this.jobState.progressPercent = 5;
    this.jobState.logs = [];
    this.jobState.startedAt = new Date().toISOString();
    this.jobState.completedAt = null;
    this.jobState.lastError = null;
    this.addLog('🚀 Starting Input Automation cycle...');

    try {
      if (!isDbConnected()) {
        try {
          this.addLog('Connecting to database...');
          await initDatabase(config.MONGODB_URI, config.MONGODB_DB_NAME);
          this.addLog('✓ Connected to MongoDB Atlas.');
        } catch (dbErr: any) {
          this.addLog(`Note: MongoDB connection warning: ${dbErr.message}`);
          console.warn('[InputPipeline] Note: MongoDB connection warning:', dbErr.message);
        }
      }

      let allSources: RssSource[] = [];
      let dbAvailable = false;
      let sourcesCol: any = null;
      let articlesCol: any = null;
      let settingsCol: any = null;

      try {
        const db = getDatabase();
        sourcesCol = db.collection<RssSource>('rss_sources');
        articlesCol = db.collection<NewsArticle>('news_articles');
        settingsCol = db.collection<Setting>('settings');
        allSources = await sourcesCol.find({}).toArray();
        dbAvailable = true;
      } catch (findErr: any) {
        console.warn('[InputPipeline] Could not query sources collection from DB:', findErr.message);
      }

      // If no DB sources, provide fallback default sources
      if (allSources.length === 0) {
        allSources = [
          {
            _id: 'default_bdnews',
            name: 'BD News 24/7',
            url: 'https://bdnews.site/feed/',
            pageId: 'default',
            templateId: 'template-canva-bdnews',
            gdriveFolderId: config.GDRIVE_FOLDER_ID,
            reelTheme: 'canva-studio-rotate',
            reelDuration: config.REEL_DEFAULT_DURATION,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            _id: 'default_trendingnews',
            name: 'Trending News World',
            url: 'https://trendingnews.world/feed/',
            pageId: 'trending',
            templateId: 'template-trendingnews-breaking',
            gdriveFolderId: config.GDRIVE_FOLDER_ID,
            reelTheme: 'canva-studio-rotate',
            reelDuration: config.REEL_DEFAULT_DURATION,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      }

      let activeSources = allSources.filter((s: any) => {
        const act = s.isActive ?? s.is_active ?? true;
        return act !== false && act !== 0 && act !== '0' && act !== 'false';
      });

      if (options?.sourceId) {
        activeSources = activeSources.filter((s) => s._id === options.sourceId);
      } else if (options?.folderId) {
        const cleanTarget = this.gdriveUploader.extractFolderId(options.folderId);
        activeSources = activeSources.filter((s: any) => {
          const directFid = this.gdriveUploader.extractFolderId(
            s.gdriveFolderId || s.gdriveFolderUrlOrId || s.gdrive_folder_url
          );
          return directFid && directFid === cleanTarget;
        });
      } else if (options?.pageId && options.pageId !== 'all') {
        activeSources = activeSources.filter((s: any) => (s.pageId || s.page_id) === options.pageId);
      } else if (!options?.allSources && activeSources.length > 1) {
        activeSources.sort((a: any, b: any) => {
          const timeA = a.lastPolledAt ? new Date(a.lastPolledAt).getTime() : 0;
          const timeB = b.lastPolledAt ? new Date(b.lastPolledAt).getTime() : 0;
          return timeA - timeB;
        });
        activeSources = [activeSources[0]];
      }

      this.addLog(`📥 Evaluating ${activeSources.length} active source(s)...`);
      this.jobState.stage = 'evaluating_sources';

      const maxAgeHours = config.MAX_ARTICLE_AGE_HOURS;
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      const maxPerSource = options?.limit || options?.maxArticlesPerSource || 1;

      const sourceResults: SourceInputResult[] = [];
      let grandTotalFetched = 0;
      let grandTotalReelsCreated = 0;
      let grandTotalUploadedToDrive = 0;

      for (const source of activeSources) {
        this.addLog(`📡 Fetching source: "${source.name}" (${source.url})...`);
        this.jobState.stage = 'fetching_rss';
        const folderId = this.gdriveUploader.extractFolderId(
          source.gdriveFolderId || source.gdriveFolderUrlOrId || config.GDRIVE_FOLDER_ID || ''
        );

        let fetchedItems: any[] = [];
        try {
          fetchedItems = await this.parserService.fetchAndParse(source.url, 15);
        } catch (fetchErr: any) {
          console.error(`[InputPipeline] Error fetching RSS from "${source.name}":`, fetchErr.message);
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

        fetchedItems.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
        const allOlderThanCutoff =
          fetchedItems.length > 0 && fetchedItems.every((it) => it.pubDate < cutoffTime);

        let newArticlesFound = 0;
        let skippedDuplicate = 0;
        let skippedTooOld = 0;
        let reelsCreated = 0;
        let uploadedToDrive = 0;
        const processedArticles: SourceInputResult['articles'] = [];

        const targetItems: any[] = [];
        for (const item of fetchedItems) {
          if (targetItems.length >= maxPerSource) break;

          if (options?.force) {
            targetItems.push(item);
            break;
          }

          if (item.pubDate < cutoffTime && !allOlderThanCutoff) {
            skippedTooOld++;
            continue;
          }

          if (dbAvailable && articlesCol) {
            const existing = await articlesCol.findOne({
              $or: [{ guid: item.guid }, { link: item.link }],
            });
            const hasRealDriveFile =
              Boolean(existing.gdriveFileId) && !existing.gdriveFileId.startsWith('local_');
            const alreadyInDrive =
              existing &&
              ((existing.status === 'uploaded_to_drive' && hasRealDriveFile) ||
                existing.status === 'published' ||
                hasRealDriveFile);

            if (alreadyInDrive) {
              skippedDuplicate++;
              continue;
            }
          }

          targetItems.push(item);
        }

        for (const item of targetItems) {
          newArticlesFound++;
          const articleId = crypto.randomUUID();

          const isEnglish =
            Boolean(source.templateId && source.templateId.includes('trendingnews')) ||
            isEnglishText(item.title) ||
            isEnglishText(item.category || '');

          let effectiveCategory = item.category || (isEnglish ? 'BREAKING NEWS' : 'বিশেষ খবর');
          if (isEnglish) effectiveCategory = effectiveCategory.toUpperCase();

          const effectiveWebsite = isEnglish ? 'https://trendingnews.world' : 'https://bdnews.site';
          const targetTheme = source.reelTheme || config.REEL_DEFAULT_THEME;
          const reelDuration = source.reelDuration || config.REEL_DEFAULT_DURATION;

          if (!item.imageUrl && item.link) {
            try {
              item.imageUrl = await this.parserService.scrapeOgImage(item.link);
            } catch {}
          }

          this.addLog(
            `🎬 Rendering Reel for: "${item.title.substring(0, 45)}..." (Theme: ${targetTheme}, Duration: ${reelDuration}s)...`
          );
          this.jobState.stage = 'rendering_reel';

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
            console.warn(`[InputPipeline] Reel render error: ${renderErr.message}`);
          }

          let gdriveFileId: string | null = null;
          let filename: string = '';

          if (reelBuffer) {
            const hashtags = isEnglish
              ? generateTrendingNewsHashtags({ category: effectiveCategory, headline: item.title })
              : generateViralReelHashtags({ category: effectiveCategory, headline: item.title });

            const cleanHeadline = this.sanitizeFilename(item.title);
            const firstTag = hashtags.split(' ')[0] || '#Shorts';
            filename = `${cleanHeadline} ${firstTag}.mp4`;

            this.addLog(
              `☁️ Uploading reel "${filename}" to Google Drive folder "${folderId}"...`
            );
            this.jobState.stage = 'uploading_drive';

            try {
              const uploadRes = await this.gdriveUploader.uploadVideo({
                folderId,
                videoBuffer: reelBuffer,
                filename,
              });

              if (uploadRes.success && !uploadRes.isLocalFallback && uploadRes.fileId && !uploadRes.fileId.startsWith('local_')) {
                gdriveFileId = uploadRes.fileId;
                uploadedToDrive++;
                grandTotalUploadedToDrive++;
                this.addLog(`✓ Saved to Google Drive! File ID: ${gdriveFileId}`);
                console.log(`✓ [InputPipeline] Saved to Drive folder! (ID: ${gdriveFileId})`);
              } else {
                const failReason = uploadRes.error || (uploadRes.isLocalFallback ? 'Saved to local temp only (Google Drive upload failed)' : 'Drive upload failed');
                this.addLog(`⚠️ Google Drive upload failed for "${filename}": ${failReason}`);
                console.warn(`[InputPipeline] ⚠️ Google Drive upload failed for "${filename}": ${failReason}`);
              }
            } catch (upErr: any) {
              this.addLog(`❌ Google Drive upload error: ${upErr.message}`);
              console.error('[InputPipeline] Drive upload failed:', upErr.message);
            }

            const isReallyUploaded = !!gdriveFileId && !gdriveFileId.startsWith('local_');
            if (dbAvailable && articlesCol) {
              try {
                await articlesCol.updateOne(
                  { $or: [{ guid: item.guid }, { link: item.link }] },
                  {
                    $set: {
                      sourceId: source._id,
                      guid: item.guid,
                      link: item.link,
                      title: item.title,
                      description: item.description || '',
                      category: effectiveCategory,
                      pubDate: item.pubDate,
                      imageUrl: item.imageUrl || null,
                      status: isReallyUploaded ? 'uploaded_to_drive' : 'rendered',
                      gdriveFileId: isReallyUploaded ? gdriveFileId : null,
                      gdriveFolderId: folderId,
                      gdriveUploadStatus: isReallyUploaded ? 'uploaded' : 'failed',
                      updatedAt: new Date(),
                    },
                    $setOnInsert: {
                      _id: articleId,
                      createdAt: new Date(),
                    },
                  },
                  { upsert: true }
                );
              } catch (dbErr: any) {
                console.warn('[InputPipeline] DB update note:', dbErr.message);
              }
            }
          }

          const isReallyUploaded = !!gdriveFileId && !gdriveFileId.startsWith('local_');
          processedArticles.push({
            title: item.title,
            gdriveFileId: isReallyUploaded && gdriveFileId ? gdriveFileId : undefined,
            filename,
            status: isReallyUploaded ? 'uploaded_to_drive' : reelBuffer ? 'rendered' : 'skipped',
          });
        }

        if (dbAvailable && sourcesCol) {
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
        }

        const effectiveFetchedCount = targetItems.length > 0 ? targetItems.length : 1;
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
      let summaryMsg = `✓ Cycle Complete in ${totalDuration}ms: Generated ${grandTotalReelsCreated} reel(s), uploaded ${grandTotalUploadedToDrive} to Drive!`;
      if (grandTotalReelsCreated > 0 && grandTotalUploadedToDrive === 0) {
        summaryMsg = `⚠️ Cycle Complete with warnings: Generated ${grandTotalReelsCreated} reel(s), but Google Drive upload failed: ${this.gdriveUploader.lastAuthError || this.gdriveUploader.lastUploadError || 'OAuth/Upload Error'}`;
      }

      console.log(`\n[InputPipeline] ${summaryMsg}`);

      const result: InputCronResult = {
        success: grandTotalUploadedToDrive > 0 || grandTotalReelsCreated === 0,
        timestamp: new Date().toISOString(),
        durationMs: totalDuration,
        sourcesProcessed: activeSources.length,
        totalFetched: grandTotalFetched,
        totalReelsCreated: grandTotalReelsCreated,
        totalUploadedToDrive: grandTotalUploadedToDrive,
        results: sourceResults,
        ...(grandTotalReelsCreated > 0 && grandTotalUploadedToDrive === 0
          ? { error: `Google Drive upload failed: ${this.gdriveUploader.lastAuthError || this.gdriveUploader.lastUploadError || 'Check Drive refresh token'}` }
          : {}),
      };

      this.jobState.isRunning = false;
      this.jobState.stage = 'completed';
      this.jobState.progressPercent = 100;
      this.jobState.completedAt = new Date().toISOString();
      this.jobState.lastResult = result;
      this.addLog(summaryMsg);

      return result;
    } catch (err: any) {
      console.error('[InputPipeline] Fatal cycle error:', err);
      this.jobState.isRunning = false;
      this.jobState.stage = 'error';
      this.jobState.lastError = err.message;
      this.addLog(`⚠️ Fatal pipeline error: ${err.message}`);
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
      this.jobState.isRunning = false;
    }
  }
}
