import crypto from 'crypto';
import cron, { ScheduledTask } from 'node-cron';
import { getDatabase } from '../../db/index.js';
import { GDriveReelConfig, FacebookPage, ReelLog } from '../../db/schema.js';
import { FacebookGraphClient } from '../facebook/client.js';
import { generateViralReelHashtags } from '../../config/constants.js';
import { config } from '../../config/env.js';

export interface GDriveVideoItem {
  id: string;
  name: string;
  cleanTitle: string;
  sizeBytes: number;
  sizeMb: string;
  mimeType: string;
  modifiedTime: Date;
  isPosted: boolean;
}

export interface GDriveScanResult {
  folderId: string;
  folderUrl: string;
  totalVideos: number;
  postedCount: number;
  pendingCount: number;
  videos: GDriveVideoItem[];
  error?: string;
}

const DEFAULT_GDRIVE_CONFIG_ID = 'default_gdrive_reels';
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv'];

export class GDriveReelService {
  private fbClient: FacebookGraphClient;
  private cronTask: ScheduledTask | null = null;
  private isPublishing = false;

  constructor() {
    this.fbClient = new FacebookGraphClient();
  }

  /**
   * Helper to extract Google Drive Folder ID from full URL or raw ID
   * Examples:
   * https://drive.google.com/drive/folders/1ABC123xyz?usp=sharing -> 1ABC123xyz
   * https://drive.google.com/drive/u/0/folders/1ABC123xyz -> 1ABC123xyz
   * 1ABC123xyz -> 1ABC123xyz
   */
  public extractFolderId(input: string): string {
    const trimmed = (input || '').trim();
    if (!trimmed) return '';

    // Match /folders/ID
    const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_\-]+)/i);
    if (folderMatch && folderMatch[1]) return folderMatch[1];

    // Match ?id=ID or &id=ID
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_\-]+)/i);
    if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

    // Clean raw alphanumeric string (typical GDrive IDs are 25-45 chars)
    const cleanId = trimmed.replace(/[^a-zA-Z0-9_\-]/g, '');
    return cleanId || trimmed;
  }

  /**
   * Helper to clean video filenames into attractive human-readable titles
   */
  public cleanVideoTitle(filename: string): string {
    let title = filename;
    // Strip extension
    const extIdx = title.lastIndexOf('.');
    if (extIdx !== -1) {
      title = title.substring(0, extIdx);
    }
    // Strip leading track numbers or dates (e.g. "01_", "2026-11-05_")
    title = title.replace(/^[\d\-_.]+\s*[-_.]*\s*/, '');
    // Replace separators with spaces
    title = title.replace(/[-_.]+/g, ' ').trim();
    // Capitalize words nicely if mostly lowercase
    if (title === title.toLowerCase()) {
      title = title.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return title || filename;
  }

  /**
   * Retrieves or initializes Google Drive reels configuration
   */
  public async getConfig(): Promise<GDriveReelConfig> {
    const db = getDatabase();
    let conf = await db.collection<GDriveReelConfig>('gdrive_reel_configs').findOne({ _id: DEFAULT_GDRIVE_CONFIG_ID });
    if (!conf) {
      const defaultPage = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
      conf = {
        _id: DEFAULT_GDRIVE_CONFIG_ID,
        folderUrlOrId: '',
        folderId: '',
        apiKey: process.env.GOOGLE_DRIVE_API_KEY || '',
        pageId: defaultPage?._id || '',
        pageName: defaultPage?.name || '',
        isActive: false,
        scheduleIntervalHours: 2, // Every 2 hours
        cronExpression: '0 */2 * * *',
        captionStrategy: 'viral_hashtags',
        customCaption: '',
        firstCommentText: '',
        orderStrategy: 'oldest_first',
        postedVideoIds: [],
        postedVideoNames: [],
        lastPostedAt: null,
        lastPostedFile: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection<GDriveReelConfig>('gdrive_reel_configs').insertOne(conf);
    }
    return conf;
  }

  /**
   * Saves or updates configuration
   */
  public async saveConfig(updates: Partial<GDriveReelConfig>): Promise<GDriveReelConfig> {
    const db = getDatabase();
    const current = await this.getConfig();

    const folderUrlOrId = updates.folderUrlOrId !== undefined ? updates.folderUrlOrId : current.folderUrlOrId;
    const folderId = this.extractFolderId(folderUrlOrId);

    const interval = updates.scheduleIntervalHours ?? current.scheduleIntervalHours ?? 2;
    let cronExpr = updates.cronExpression || current.cronExpression;
    if (updates.scheduleIntervalHours !== undefined || !cronExpr) {
      cronExpr = interval === 1 ? '0 * * * *' : `0 */${interval} * * *`;
    }

    let pageName = updates.pageName || current.pageName;
    if (updates.pageId && updates.pageId !== current.pageId) {
      const page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: updates.pageId });
      if (page) pageName = page.name;
    }

    const payload: Partial<GDriveReelConfig> = {
      ...updates,
      folderUrlOrId,
      folderId,
      cronExpression: cronExpr,
      pageName,
      updatedAt: new Date(),
    };

    await db.collection<GDriveReelConfig>('gdrive_reel_configs').updateOne(
      { _id: DEFAULT_GDRIVE_CONFIG_ID },
      { $set: payload }
    );

    const updated = await this.getConfig();
    await this.restartScheduler();
    return updated;
  }

  /**
   * Scans a Google Drive folder and lists all video files and their status
   */
  public async scanFolder(customUrlOrId?: string, customApiKey?: string): Promise<GDriveScanResult> {
    const conf = await this.getConfig();
    const rawInput = (customUrlOrId || conf.folderUrlOrId || conf.folderId || '').trim();
    const folderId = this.extractFolderId(rawInput);
    const apiKey = (customApiKey || conf.apiKey || process.env.GOOGLE_DRIVE_API_KEY || '').trim();

    if (!folderId) {
      return {
        folderId: '',
        folderUrl: rawInput,
        totalVideos: 0,
        postedCount: 0,
        pendingCount: 0,
        videos: [],
        error: 'Please paste your Google Drive folder link or folder ID.',
      };
    }

    if (!apiKey) {
      return {
        folderId,
        folderUrl: rawInput,
        totalVideos: 0,
        postedCount: 0,
        pendingCount: 0,
        videos: [],
        error: 'Google Drive API Key is required. Please provide an API Key in the settings below.',
      };
    }

    try {
      // Query Google Drive v3 API
      // q: 'FOLDER_ID' in parents and trashed = false
      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent('files(id,name,size,mimeType,createdTime,modifiedTime)');
      const apiUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000&key=${apiKey}`;

      const res = await fetch(apiUrl);
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as any;
        const msg = errorData.error?.message || `Google Drive API error (${res.status} ${res.statusText})`;
        return {
          folderId,
          folderUrl: rawInput,
          totalVideos: 0,
          postedCount: 0,
          pendingCount: 0,
          videos: [],
          error: msg,
        };
      }

      const data = (await res.json()) as any;
      const rawFiles: any[] = data.files || [];

      const postedIdSet = new Set(conf.postedVideoIds || []);
      const postedNameSet = new Set((conf.postedVideoNames || []).map((n) => n.toLowerCase()));

      const videoList: GDriveVideoItem[] = [];
      for (const f of rawFiles) {
        const isVideoMime = (f.mimeType || '').startsWith('video/');
        const ext = f.name ? (f.name.substring(f.name.lastIndexOf('.')).toLowerCase()) : '';
        const isVideoExt = VIDEO_EXTENSIONS.includes(ext);

        if (isVideoMime || isVideoExt) {
          const sizeNum = parseInt(f.size || '0', 10);
          const isPosted = postedIdSet.has(f.id) || postedNameSet.has((f.name || '').toLowerCase());

          videoList.push({
            id: f.id,
            name: f.name || 'Untitled Video',
            cleanTitle: this.cleanVideoTitle(f.name || 'Untitled Video'),
            sizeBytes: sizeNum,
            sizeMb: sizeNum > 0 ? (sizeNum / (1024 * 1024)).toFixed(2) : 'N/A',
            mimeType: f.mimeType || 'video/mp4',
            modifiedTime: new Date(f.modifiedTime || f.createdTime || Date.now()),
            isPosted,
          });
        }
      }

      // Sort according to orderStrategy
      const strategy = conf.orderStrategy || 'oldest_first';
      if (strategy === 'oldest_first') {
        videoList.sort((a, b) => a.modifiedTime.getTime() - b.modifiedTime.getTime());
      } else if (strategy === 'newest_first') {
        videoList.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
      } else if (strategy === 'alphabetical') {
        videoList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      } else if (strategy === 'random') {
        videoList.sort(() => Math.random() - 0.5);
      }

      const postedCount = videoList.filter((v) => v.isPosted).length;
      const pendingCount = videoList.length - postedCount;

      return {
        folderId,
        folderUrl: rawInput,
        totalVideos: videoList.length,
        postedCount,
        pendingCount,
        videos: videoList,
      };
    } catch (err: any) {
      return {
        folderId,
        folderUrl: rawInput,
        totalVideos: 0,
        postedCount: 0,
        pendingCount: 0,
        videos: [],
        error: `Failed to connect to Google Drive: ${err.message}`,
      };
    }
  }

  /**
   * Publishes the next pending video from the Google Drive folder
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
      if (!conf.folderId && !conf.folderUrlOrId) {
        return { success: false, error: 'Google Drive folder link is not configured.' };
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

      const scan = await this.scanFolder();
      if (scan.error) {
        return { success: false, error: scan.error };
      }

      const pendingVideos = scan.videos.filter((v) => !v.isPosted);
      if (pendingVideos.length === 0) {
        console.log(`[GDriveReelService] All ${scan.totalVideos} videos in Google Drive folder have already been posted.`);
        return {
          success: false,
          error: `All ${scan.totalVideos} videos in your Google Drive folder have already been published! Click "Reset History" if you wish to cycle through them again.`,
        };
      }

      const targetVideo = pendingVideos[0];
      return await this.executePublishVideo(targetVideo, page, conf);
    } finally {
      this.isPublishing = false;
    }
  }

  /**
   * Publishes a specific selected file from Google Drive
   */
  public async publishSpecificFile(fileId: string): Promise<{
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

      const scan = await this.scanFolder();
      const targetVideo = scan.videos.find((v) => v.id === fileId);
      if (!targetVideo) {
        return { success: false, error: `Video ID "${fileId}" not found in Google Drive folder scan.` };
      }

      return await this.executePublishVideo(targetVideo, page, conf);
    } finally {
      this.isPublishing = false;
    }
  }

  /**
   * Internal execution helper: downloads video from Google Drive into RAM and posts to Meta Graph API
   */
  private async executePublishVideo(
    video: GDriveVideoItem,
    page: FacebookPage,
    conf: GDriveReelConfig
  ): Promise<{
    success: boolean;
    filename?: string;
    cleanTitle?: string;
    videoId?: string;
    postId?: string;
    error?: string;
  }> {
    const db = getDatabase();
    const apiKey = (conf.apiKey || process.env.GOOGLE_DRIVE_API_KEY || '').trim();

    console.log(`[GDriveReelService] ☁️ Downloading "${video.name}" (${video.sizeMb} MB) from Google Drive into memory...`);

    try {
      // 1. Download file media from Google Drive v3 API
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${video.id}?alt=media&key=${apiKey}`;
      const downloadRes = await fetch(downloadUrl);

      if (!downloadRes.ok) {
        throw new Error(`Failed to download video from Google Drive (${downloadRes.status} ${downloadRes.statusText})`);
      }

      const arrayBuffer = await downloadRes.arrayBuffer();
      const videoBuffer = Buffer.from(arrayBuffer);

      console.log(`[GDriveReelService] ✓ Download complete (${videoBuffer.length} bytes). Publishing to page ${page.name} (${page._id})...`);

      // 2. Generate Caption & Viral Hashtags
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
        // Algorithm optimized viral hashtags based on keywords in title
        caption = generateViralReelHashtags({
          headline: video.cleanTitle,
          category: 'বিশেষ খবর',
        });
      }

      // 3. Publish to Meta Graph API
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
          console.log(`✓ [GDriveReelService] First comment posted to Reel ${commentTargetId}`);
        } catch (cErr: any) {
          console.warn(`[GDriveReelService] Could not post first comment:`, cErr.message);
        }
      }

      // 5. Update posted state in MongoDB
      const now = new Date();
      await db.collection<GDriveReelConfig>('gdrive_reel_configs').updateOne(
        { _id: DEFAULT_GDRIVE_CONFIG_ID },
        {
          $addToSet: {
            postedVideoIds: video.id,
            postedVideoNames: video.name,
          },
          $set: {
            lastPostedAt: now,
            lastPostedFile: video.name,
            updatedAt: now,
          },
        }
      );

      // 6. Record to reel_logs
      await db.collection<ReelLog>('reel_logs').insertOne({
        _id: crypto.randomUUID(),
        articleId: `gdrive_${video.id}`,
        articleTitle: video.cleanTitle,
        pageId: page._id,
        pageName: page.name,
        theme: 'gdrive-video',
        fbVideoId: videoId,
        fbPostId: postId,
        status: config.DRY_RUN ? 'dry_run' : 'published',
        caption: caption,
        durationSeconds: 15,
        createdAt: now,
      });

      console.log(`✓ [GDriveReelService] Successfully published Reel "${video.name}"! Video ID: ${videoId}, Post ID: ${postId}`);

      return {
        success: true,
        filename: video.name,
        cleanTitle: video.cleanTitle,
        videoId,
        postId,
      };
    } catch (err: any) {
      console.error(`[GDriveReelService] Failed to publish Reel "${video.name}":`, err.message);
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
    await db.collection<GDriveReelConfig>('gdrive_reel_configs').updateOne(
      { _id: DEFAULT_GDRIVE_CONFIG_ID },
      { $set: { postedVideoIds: [], postedVideoNames: [], updatedAt: new Date() } }
    );
    console.log('[GDriveReelService] Posted video history reset.');
  }

  /**
   * Starts the background cron scheduler (used on long-running node servers or Vercel cron endpoints)
   */
  public async startScheduler(): Promise<void> {
    const conf = await this.getConfig();
    if (!conf.isActive) {
      console.log('[GDriveReelService] Google Drive automation is disabled (isActive=false). Scheduler on standby.');
      return;
    }

    const cronExpr = conf.cronExpression || '0 */2 * * *';
    if (!cron.validate(cronExpr)) {
      console.warn(`[GDriveReelService] Invalid cron expression "${cronExpr}". Scheduler aborted.`);
      return;
    }

    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }

    console.log(`[GDriveReelService] ⏰ Starting automated Google Drive reel scheduler with cron "${cronExpr}"...`);
    this.cronTask = cron.schedule(cronExpr, async () => {
      console.log(`[GDriveReelService - Cron] Scheduled Google Drive reel upload triggered at ${new Date().toISOString()}`);
      try {
        const result = await this.publishNext();
        if (result.success) {
          console.log(`✓ [GDriveReelService - Cron] Scheduled Reel posted: "${result.filename}" (${result.videoId})`);
        } else {
          console.log(`[GDriveReelService - Cron] Note: ${result.error}`);
        }
      } catch (err: any) {
        console.error(`[GDriveReelService - Cron] Error:`, err.message);
      }
    });
  }

  /**
   * Restarts the cron scheduler
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
      console.log('[GDriveReelService] Scheduler stopped.');
    }
  }
}
