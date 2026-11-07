import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cron, { ScheduledTask } from 'node-cron';
import { getDatabase, isMongoConnected } from '../../db/index.js';
import { LocalReelConfig, FacebookPage, ReelLog } from '../../db/schema.js';
import { FacebookGraphClient } from '../facebook/client.js';
import { generateViralReelHashtags } from '../../config/constants.js';
import { config } from '../../config/env.js';

export interface VideoFileInfo {
  name: string;
  cleanTitle: string;
  fullPath: string;
  sizeBytes: number;
  sizeMb: string;
  modifiedAt: Date;
  isPosted: boolean;
}

export interface FolderScanResult {
  folderPath: string;
  exists: boolean;
  totalVideos: number;
  postedCount: number;
  pendingCount: number;
  videos: VideoFileInfo[];
  error?: string;
}

const SUPPORTED_VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']);
const DEFAULT_CONFIG_ID = 'default_local_reels';

export class LocalReelService {
  private fbClient: FacebookGraphClient;
  private cronTask: ScheduledTask | null = null;
  private isPublishing = false;

  constructor() {
    this.fbClient = new FacebookGraphClient();
  }

  /**
   * Helper to turn video filenames into clean, human-readable titles
   * e.g. "01_Amazing-Football-Trick.mp4" -> "Amazing Football Trick"
   */
  public cleanVideoTitle(filename: string): string {
    const parsed = path.parse(filename);
    let title = parsed.name;
    // Strip leading track numbers or dates like "01_", "01 - ", "2026-11-05_"
    title = title.replace(/^[\d\-_.]+\s*[-_.]*\s*/, '');
    // Replace separators with spaces
    title = title.replace(/[-_.]+/g, ' ').trim();
    // Capitalize words nicely if mostly lowercase
    if (title === title.toLowerCase()) {
      title = title.replace(/\b\w/g, (char) => char.toUpperCase());
    }
    return title || parsed.name;
  }

  /**
   * Retrieves or initializes the local reels automation configuration
   */
  public async getConfig(): Promise<LocalReelConfig> {
    const db = getDatabase();
    let conf = await db.collection<LocalReelConfig>('local_reel_configs').findOne({ _id: DEFAULT_CONFIG_ID });
    if (!conf) {
      // Find active page for sensible default
      const defaultPage = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
      conf = {
        _id: DEFAULT_CONFIG_ID,
        folderPath: '',
        pageId: defaultPage?._id || '',
        pageName: defaultPage?.name || '',
        isActive: false,
        scheduleIntervalHours: 2, // Every 2 hours
        cronExpression: '0 */2 * * *',
        captionStrategy: 'viral_hashtags',
        customCaption: '',
        firstCommentText: '',
        orderStrategy: 'oldest_first',
        postedVideos: [],
        lastPostedAt: null,
        lastPostedFile: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection<LocalReelConfig>('local_reel_configs').insertOne(conf);
    }
    return conf;
  }

  /**
   * Saves or updates configuration
   */
  public async saveConfig(updates: Partial<LocalReelConfig>): Promise<LocalReelConfig> {
    const db = getDatabase();
    const current = await this.getConfig();

    const interval = updates.scheduleIntervalHours ?? current.scheduleIntervalHours ?? 2;
    // Derive standard cron expression from interval if not explicitly supplied
    let cronExpr = updates.cronExpression || current.cronExpression;
    if (updates.scheduleIntervalHours !== undefined || !cronExpr) {
      cronExpr = interval === 1 ? '0 * * * *' : `0 */${interval} * * *`;
    }

    // Resolve page name if pageId is updated
    let pageName = updates.pageName || current.pageName;
    if (updates.pageId && updates.pageId !== current.pageId) {
      const page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: updates.pageId });
      if (page) pageName = page.name;
    }

    const payload: Partial<LocalReelConfig> = {
      ...updates,
      cronExpression: cronExpr,
      pageName,
      updatedAt: new Date(),
    };

    await db.collection<LocalReelConfig>('local_reel_configs').updateOne(
      { _id: DEFAULT_CONFIG_ID },
      { $set: payload }
    );

    const updated = await this.getConfig();
    // Restart scheduler with new configuration
    await this.restartScheduler();
    return updated;
  }

  /**
   * Scans a target folder and lists all video files and their status
   */
  public async scanFolder(customFolderPath?: string): Promise<FolderScanResult> {
    const conf = await this.getConfig();
    const targetDir = (customFolderPath || conf.folderPath || '').trim();

    if (!targetDir) {
      return {
        folderPath: '',
        exists: false,
        totalVideos: 0,
        postedCount: 0,
        pendingCount: 0,
        videos: [],
        error: 'No local folder path configured. Please specify a directory path.',
      };
    }

    try {
      if (!fs.existsSync(targetDir)) {
        return {
          folderPath: targetDir,
          exists: false,
          totalVideos: 0,
          postedCount: 0,
          pendingCount: 0,
          videos: [],
          error: `Directory "${targetDir}" does not exist on server.`,
        };
      }

      const dirStats = fs.statSync(targetDir);
      if (!dirStats.isDirectory()) {
        return {
          folderPath: targetDir,
          exists: false,
          totalVideos: 0,
          postedCount: 0,
          pendingCount: 0,
          videos: [],
          error: `Path "${targetDir}" is a file, not a directory.`,
        };
      }

      const files = await fs.promises.readdir(targetDir);
      const postedSet = new Set((conf.postedVideos || []).map((f) => f.toLowerCase()));

      const videoList: VideoFileInfo[] = [];
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (SUPPORTED_VIDEO_EXTS.has(ext)) {
          const fullPath = path.join(targetDir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isFile() && stat.size > 1024) {
              const isPosted = postedSet.has(file.toLowerCase());
              videoList.push({
                name: file,
                cleanTitle: this.cleanVideoTitle(file),
                fullPath,
                sizeBytes: stat.size,
                sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
                modifiedAt: stat.mtime,
                isPosted,
              });
            }
          } catch (statErr) {
            // Ignore unreadable files
          }
        }
      }

      // Sort according to orderStrategy
      const strategy = conf.orderStrategy || 'oldest_first';
      if (strategy === 'oldest_first') {
        videoList.sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime());
      } else if (strategy === 'newest_first') {
        videoList.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
      } else if (strategy === 'alphabetical') {
        videoList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      } else if (strategy === 'random') {
        videoList.sort(() => Math.random() - 0.5);
      }

      const postedCount = videoList.filter((v) => v.isPosted).length;
      const pendingCount = videoList.length - postedCount;

      return {
        folderPath: targetDir,
        exists: true,
        totalVideos: videoList.length,
        postedCount,
        pendingCount,
        videos: videoList,
      };
    } catch (err: any) {
      return {
        folderPath: targetDir,
        exists: false,
        totalVideos: 0,
        postedCount: 0,
        pendingCount: 0,
        videos: [],
        error: `Failed to read folder: ${err.message}`,
      };
    }
  }

  /**
   * Publishes the next pending video from the local folder
   */
  public async publishNext(): Promise<{
    success: boolean;
    filename?: string;
    cleanTitle?: string;
    videoId?: string;
    postId?: string;
    error?: string;
  }> {
    if (this.isPublishing) {
      return { success: false, error: 'A video upload is already in progress. Please wait.' };
    }

    this.isPublishing = true;
    try {
      const conf = await this.getConfig();
      if (!conf.folderPath) {
        return { success: false, error: 'Folder path is not configured.' };
      }

      const db = getDatabase();

      // Resolve Facebook Page
      let page: FacebookPage | null = null;
      if (conf.pageId && conf.pageId !== 'all') {
        page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: conf.pageId });
      }
      if (!page) {
        page = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
      }
      if (!page) {
        return { success: false, error: 'No active Facebook Page found for publishing.' };
      }

      const scan = await this.scanFolder(conf.folderPath);
      if (!scan.exists) {
        return { success: false, error: scan.error || 'Video directory not accessible.' };
      }

      const pendingVideos = scan.videos.filter((v) => !v.isPosted);
      if (pendingVideos.length === 0) {
        console.log(`[LocalReelService] All ${scan.totalVideos} videos in "${conf.folderPath}" have already been posted.`);
        return {
          success: false,
          error: `All ${scan.totalVideos} videos in the folder have already been published! Click "Reset History" in the dashboard if you wish to cycle through them again.`,
        };
      }

      const targetVideo = pendingVideos[0];
      return await this.executePublishVideo(targetVideo, page, conf);
    } finally {
      this.isPublishing = false;
    }
  }

  /**
   * Publishes a specific selected file from the local folder
   */
  public async publishSpecificFile(filename: string): Promise<{
    success: boolean;
    filename?: string;
    cleanTitle?: string;
    videoId?: string;
    postId?: string;
    error?: string;
  }> {
    if (this.isPublishing) {
      return { success: false, error: 'A video upload is already in progress. Please wait.' };
    }

    this.isPublishing = true;
    try {
      const conf = await this.getConfig();
      const db = getDatabase();

      let page: FacebookPage | null = null;
      if (conf.pageId && conf.pageId !== 'all') {
        page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: conf.pageId });
      }
      if (!page) {
        page = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
      }
      if (!page) {
        return { success: false, error: 'No active Facebook Page found for publishing.' };
      }

      const fullPath = path.join(conf.folderPath, filename);
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: `File "${filename}" not found in ${conf.folderPath}` };
      }

      const stat = fs.statSync(fullPath);
      const videoInfo: VideoFileInfo = {
        name: filename,
        cleanTitle: this.cleanVideoTitle(filename),
        fullPath,
        sizeBytes: stat.size,
        sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
        modifiedAt: stat.mtime,
        isPosted: false,
      };

      return await this.executePublishVideo(videoInfo, page, conf);
    } finally {
      this.isPublishing = false;
    }
  }

  /**
   * Internal execution helper that reads file buffer and posts to Meta Graph API
   */
  private async executePublishVideo(
    video: VideoFileInfo,
    page: FacebookPage,
    conf: LocalReelConfig
  ): Promise<{
    success: boolean;
    filename?: string;
    cleanTitle?: string;
    videoId?: string;
    postId?: string;
    error?: string;
  }> {
    const db = getDatabase();
    console.log(`[LocalReelService] 🎬 Preparing Reel upload for "${video.name}" (${video.sizeMb} MB) to page ${page.name} (${page._id})...`);

    try {
      // 1. Build Caption & Viral Hashtags
      let caption = '';
      if (conf.captionStrategy === 'custom' && conf.customCaption?.trim()) {
        caption = conf.customCaption
          .replace('{title}', video.cleanTitle)
          .replace('{filename}', video.name);
        const viralTags = generateViralReelHashtags({
          headline: video.cleanTitle,
          category: 'বিশেষ খবর',
        });
        caption = caption.replace('{hashtags}', viralTags).trim();
      } else {
        // Default: 10-14 Algorithm Optimized Viral Tags tailored to video keywords
        caption = generateViralReelHashtags({
          headline: video.cleanTitle,
          category: 'বিশেষ খবর',
        });
      }

      // 2. Read video file into memory buffer
      const videoBuffer = await fs.promises.readFile(video.fullPath);

      // 3. Publish to Facebook Page via Meta Reels API
      const { videoId, postId } = await this.fbClient.publishReel(
        page._id,
        page.accessToken,
        videoBuffer,
        caption,
        video.cleanTitle,
        config.DRY_RUN
      );

      // 4. Optional First Comment (CTA / Link)
      if (conf.firstCommentText && conf.firstCommentText.trim() && (videoId || postId)) {
        try {
          const commentTargetId = videoId || postId;
          await this.fbClient.publishComment(
            commentTargetId,
            page.accessToken,
            conf.firstCommentText.trim(),
            config.DRY_RUN,
            postId
          );
          console.log(`✓ [LocalReelService] First comment posted to Reel ${commentTargetId}`);
        } catch (cErr: any) {
          console.warn(`[LocalReelService] Could not post first comment:`, cErr.message);
        }
      }

      // 5. Update postedVideos state in database (case-insensitive deduplication)
      const now = new Date();
      await db.collection<LocalReelConfig>('local_reel_configs').updateOne(
        { _id: DEFAULT_CONFIG_ID },
        {
          $addToSet: { postedVideos: video.name },
          $set: {
            lastPostedAt: now,
            lastPostedFile: video.name,
            updatedAt: now,
          },
        }
      );

      // 6. Record to reel_logs collection for dashboard visibility
      await db.collection<ReelLog>('reel_logs').insertOne({
        _id: crypto.randomUUID(),
        articleId: `local_${Date.now()}`,
        articleTitle: video.cleanTitle,
        pageId: page._id,
        pageName: page.name,
        theme: 'local-folder-mp4',
        fbVideoId: videoId,
        fbPostId: postId,
        status: config.DRY_RUN ? 'dry_run' : 'published',
        caption: caption,
        renderedVideoPath: video.fullPath,
        durationSeconds: 15,
        createdAt: now,
      });

      console.log(`✓ [LocalReelService] Successfully published Reel "${video.name}"! Video ID: ${videoId}, Post ID: ${postId}`);

      return {
        success: true,
        filename: video.name,
        cleanTitle: video.cleanTitle,
        videoId,
        postId,
      };
    } catch (err: any) {
      console.error(`[LocalReelService] Failed to publish Reel "${video.name}":`, err.message);
      return {
        success: false,
        filename: video.name,
        cleanTitle: video.cleanTitle,
        error: err.message,
      };
    }
  }

  /**
   * Resets the list of posted videos so user can re-cycle or start fresh
   */
  public async resetPostedHistory(): Promise<void> {
    const db = getDatabase();
    await db.collection<LocalReelConfig>('local_reel_configs').updateOne(
      { _id: DEFAULT_CONFIG_ID },
      { $set: { postedVideos: [], updatedAt: new Date() } }
    );
    console.log('[LocalReelService] Posted video history reset.');
  }

  /**
   * Starts the background cron scheduler
   */
  public async startScheduler(): Promise<void> {
    const conf = await this.getConfig();
    if (!conf.isActive) {
      console.log('[LocalReelService] Automation is currently disabled (isActive=false). Scheduler on standby.');
      return;
    }

    const cronExpr = conf.cronExpression || '0 */2 * * *';
    if (!cron.validate(cronExpr)) {
      console.warn(`[LocalReelService] Invalid cron expression "${cronExpr}". Scheduler aborted.`);
      return;
    }

    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }

    console.log(`[LocalReelService] ⏰ Starting automated local folder reel scheduler with cron "${cronExpr}"...`);
    this.cronTask = cron.schedule(cronExpr, async () => {
      console.log(`[LocalReelService - Cron] Scheduled local reel upload triggered at ${new Date().toISOString()}`);
      try {
        const result = await this.publishNext();
        if (result.success) {
          console.log(`✓ [LocalReelService - Cron] Scheduled Reel posted: "${result.filename}" (${result.videoId})`);
        } else {
          console.log(`[LocalReelService - Cron] Note: ${result.error}`);
        }
      } catch (err: any) {
        console.error(`[LocalReelService - Cron] Error:`, err.message);
      }
    });
  }

  /**
   * Restarts the cron scheduler with current configuration
   */
  public async restartScheduler(): Promise<void> {
    this.stopScheduler();
    await this.startScheduler();
  }

  /**
   * Stops the background cron scheduler cleanly
   */
  public stopScheduler(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      console.log('[LocalReelService] Scheduler stopped.');
    }
  }
}

