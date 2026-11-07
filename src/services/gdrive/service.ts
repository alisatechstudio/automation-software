import crypto from 'crypto';
import cron, { ScheduledTask } from 'node-cron';
import { getDatabase } from '../../db/index.js';
import { GDriveReelConfig, FacebookPage, ReelLog } from '../../db/schema.js';
import { FacebookGraphClient } from '../facebook/client.js';
import { YouTubeClient } from '../youtube/client.js';
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
  channelId?: string;
  channelName?: string;
  folderId: string;
  folderUrl: string;
  totalVideos: number;
  postedCount: number;
  pendingCount: number;
  videos: GDriveVideoItem[];
  error?: string;
}

export const DEFAULT_GDRIVE_CONFIG_ID = 'default_gdrive_reels';
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv'];

export class GDriveReelService {
  private fbClient: FacebookGraphClient;
  private ytClient: YouTubeClient;
  private cronTask: ScheduledTask | null = null;
  private publishingChannels = new Set<string>();

  constructor() {
    this.fbClient = new FacebookGraphClient();
    this.ytClient = new YouTubeClient();
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
   * Retrieves or initializes the shared global Google Drive API key
   */
  public async getGlobalApiKey(): Promise<string> {
    const db = getDatabase();
    const setting = await db.collection('settings').findOne({ _id: 'gdrive_settings' as any });
    if (setting && setting.apiKey) {
      return (setting.apiKey as string).trim();
    }
    return (process.env.GOOGLE_DRIVE_API_KEY || '').trim();
  }

  /**
   * Saves or updates the shared global Google Drive API key
   */
  public async setGlobalApiKey(key: string): Promise<string> {
    const db = getDatabase();
    const cleanKey = (key || '').trim();
    await db.collection('settings').updateOne(
      { _id: 'gdrive_settings' as any },
      { $set: { apiKey: cleanKey, updatedAt: new Date() } },
      { upsert: true }
    );
    return cleanKey;
  }

  /**
   * Seeds an initial default channel if no channels exist
   */
  private async seedDefaultChannel(): Promise<GDriveReelConfig> {
    const db = getDatabase();
    const defaultPage = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
    const globalKey = await this.getGlobalApiKey();

    const conf: GDriveReelConfig = {
      _id: DEFAULT_GDRIVE_CONFIG_ID,
      name: defaultPage ? `${defaultPage.name} Channel` : 'Primary Reels Channel',
      folderUrlOrId: '',
      folderId: '',
      apiKey: globalKey,
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
      deleteAfterPosting: true,
      deleteAction: 'trash',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection<GDriveReelConfig>('gdrive_reel_configs').insertOne(conf);
    return conf;
  }

  /**
   * Retrieves all Google Drive reel channels/folder mappings
   */
  public async getAllChannels(): Promise<GDriveReelConfig[]> {
    const db = getDatabase();
    let channels = await db.collection<GDriveReelConfig>('gdrive_reel_configs').find({}).toArray();
    if (!channels || channels.length === 0) {
      const seeded = await this.seedDefaultChannel();
      channels = [seeded];
    }
    return channels;
  }

  /**
   * Retrieves a specific channel by ID
   */
  public async getChannel(id: string): Promise<GDriveReelConfig | null> {
    const db = getDatabase();
    const channel = await db.collection<GDriveReelConfig>('gdrive_reel_configs').findOne({ _id: id });
    if (!channel && id === DEFAULT_GDRIVE_CONFIG_ID) {
      return await this.seedDefaultChannel();
    }
    return channel;
  }

  /**
   * Creates or updates a Google Drive reel channel/mapping
   */
  public async saveChannel(data: Partial<GDriveReelConfig>): Promise<GDriveReelConfig> {
    const db = getDatabase();
    const channelId = data._id || `gdrive_ch_${crypto.randomUUID().slice(0, 8)}`;

    const existing = await db.collection<GDriveReelConfig>('gdrive_reel_configs').findOne({ _id: channelId });

    const folderUrlOrId = data.folderUrlOrId !== undefined ? data.folderUrlOrId : (existing?.folderUrlOrId || '');
    const folderId = this.extractFolderId(folderUrlOrId);

    const interval = data.scheduleIntervalHours ?? existing?.scheduleIntervalHours ?? 2;
    let cronExpr = data.cronExpression || existing?.cronExpression;
    if (data.scheduleIntervalHours !== undefined || !cronExpr) {
      cronExpr = interval === 1 ? '0 * * * *' : `0 */${interval} * * *`;
    }

    let pageName = data.pageName || existing?.pageName || '';
    const pageId = data.pageId !== undefined ? data.pageId : (existing?.pageId || '');
    if (pageId && pageId !== 'all') {
      const page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: pageId });
      if (page) pageName = page.name;
    }

    let name = data.name || existing?.name;
    if (!name) {
      name = pageName ? `${pageName} Reels` : 'Drive Channel';
    }

    const doc: GDriveReelConfig = {
      _id: channelId,
      name,
      folderUrlOrId,
      folderId,
      apiKey: data.apiKey !== undefined ? data.apiKey : (existing?.apiKey || ''),
      pageId,
      pageName,
      isActive: data.isActive !== undefined ? data.isActive : (existing?.isActive ?? false),
      scheduleIntervalHours: interval,
      cronExpression: cronExpr,
      captionStrategy: data.captionStrategy || existing?.captionStrategy || 'viral_hashtags',
      customCaption: data.customCaption !== undefined ? data.customCaption : (existing?.customCaption || ''),
      firstCommentText: data.firstCommentText !== undefined ? data.firstCommentText : (existing?.firstCommentText || ''),
      orderStrategy: data.orderStrategy || existing?.orderStrategy || 'oldest_first',
      postedVideoIds: existing?.postedVideoIds || [],
      postedVideoNames: existing?.postedVideoNames || [],
      lastPostedAt: existing?.lastPostedAt || null,
      lastPostedFile: existing?.lastPostedFile || null,
      deleteAfterPosting: data.deleteAfterPosting !== undefined ? Boolean(data.deleteAfterPosting) : (existing?.deleteAfterPosting ?? true),
      deleteAction: data.deleteAction || existing?.deleteAction || 'trash',
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    await db.collection<GDriveReelConfig>('gdrive_reel_configs').updateOne(
      { _id: channelId },
      { $set: doc },
      { upsert: true }
    );

    return doc;
  }

  /**
   * Deletes a channel mapping by ID
   */
  public async deleteChannel(id: string): Promise<boolean> {
    const db = getDatabase();
    const res = await db.collection<GDriveReelConfig>('gdrive_reel_configs').deleteOne({ _id: id });
    return (res.deletedCount || 0) > 0;
  }

  /**
   * Scans a specific channel's Google Drive folder
   */
  public async scanChannel(id: string): Promise<GDriveScanResult> {
    const channel = await this.getChannel(id);
    if (!channel) {
      return {
        channelId: id,
        folderId: '',
        folderUrl: '',
        totalVideos: 0,
        postedCount: 0,
        pendingCount: 0,
        videos: [],
        error: `Channel ID "${id}" not found.`,
      };
    }

    const globalKey = await this.getGlobalApiKey();
    const apiKey = (channel.apiKey || globalKey || '').trim();

    const scan = await this.scanFolderDirect(channel.folderUrlOrId || channel.folderId, apiKey, channel);
    scan.channelId = channel._id;
    scan.channelName = channel.name;
    return scan;
  }

  /**
   * Direct scanner for any folder URL/ID with optional API key and channel context
   */
  public async scanFolderDirect(
    folderUrlOrId: string,
    apiKeyInput?: string,
    channelCtx?: GDriveReelConfig
  ): Promise<GDriveScanResult> {
    const rawInput = (folderUrlOrId || '').trim();
    const folderId = this.extractFolderId(rawInput);
    const globalKey = await this.getGlobalApiKey();
    const apiKey = (apiKeyInput || globalKey || '').trim();

    if (!folderId) {
      return {
        folderId: '',
        folderUrl: rawInput,
        totalVideos: 0,
        postedCount: 0,
        pendingCount: 0,
        videos: [],
        error: 'Please paste a valid Google Drive folder link or folder ID.',
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
        error: 'Google Drive API Key is required. Please set your API Key above.',
      };
    }

    try {
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

      const postedIdSet = new Set(channelCtx?.postedVideoIds || []);
      const postedNameSet = new Set((channelCtx?.postedVideoNames || []).map((n) => n.toLowerCase()));

      const videoList: GDriveVideoItem[] = [];
      for (const f of rawFiles) {
        const isVideoMime = (f.mimeType || '').startsWith('video/');
        const ext = f.name ? f.name.substring(f.name.lastIndexOf('.')).toLowerCase() : '';
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

      // Sort
      const strategy = channelCtx?.orderStrategy || 'oldest_first';
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
   * Publishes the next pending video for a specific channel
   */
  public async publishNextForChannel(channelId: string): Promise<{
    success: boolean;
    channelId: string;
    channelName?: string;
    pageName?: string;
    filename?: string;
    cleanTitle?: string;
    videoId?: string;
    postId?: string;
    deletedFromDrive?: boolean;
    deleteError?: string;
    error?: string;
  }> {
    if (this.publishingChannels.has(channelId)) {
      return {
        success: false,
        channelId,
        error: `Upload already in progress for channel "${channelId}". Please wait.`,
      };
    }

    this.publishingChannels.add(channelId);
    try {
      const channel = await this.getChannel(channelId);
      if (!channel) {
        return { success: false, channelId, error: `Channel ID "${channelId}" not found.` };
      }

      if (!channel.folderId && !channel.folderUrlOrId) {
        return { success: false, channelId, error: 'Google Drive folder is not configured for this channel.' };
      }

      const db = getDatabase();
      let page: FacebookPage | null = null;
      if (channel.pageId && channel.pageId !== 'all') {
        page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: channel.pageId });
      }
      if (!page) {
        page = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
      }
      if (!page) {
        return {
          success: false,
          channelId,
          error: `No active Facebook Page assigned to channel "${channel.name}".`,
        };
      }

      const scan = await this.scanChannel(channelId);
      if (scan.error) {
        return { success: false, channelId, error: scan.error };
      }

      const pendingVideos = scan.videos.filter((v) => !v.isPosted);
      if (pendingVideos.length === 0) {
        return {
          success: false,
          channelId,
          channelName: channel.name,
          pageName: page.name,
          error: `All ${scan.totalVideos} videos in "${channel.name}" have already been published! Click Reset History to cycle again.`,
        };
      }

      const targetVideo = pendingVideos[0];
      const res = await this.executePublishVideo(targetVideo, page, channel);
      return {
        ...res,
        channelId,
        channelName: channel.name,
        pageName: page.name,
      };
    } finally {
      this.publishingChannels.delete(channelId);
    }
  }

  /**
   * Publishes a specific selected file from Google Drive for a channel
   */
  public async publishSpecificFileForChannel(
    channelId: string,
    fileId: string
  ): Promise<{
    success: boolean;
    channelId: string;
    channelName?: string;
    pageName?: string;
    filename?: string;
    cleanTitle?: string;
    videoId?: string;
    postId?: string;
    deletedFromDrive?: boolean;
    deleteError?: string;
    error?: string;
  }> {
    if (this.publishingChannels.has(channelId)) {
      return {
        success: false,
        channelId,
        error: `Upload already in progress for channel "${channelId}". Please wait.`,
      };
    }

    this.publishingChannels.add(channelId);
    try {
      const channel = await this.getChannel(channelId);
      if (!channel) {
        return { success: false, channelId, error: `Channel ID "${channelId}" not found.` };
      }

      const db = getDatabase();
      let page: FacebookPage | null = null;
      if (channel.pageId && channel.pageId !== 'all') {
        page = await db.collection<FacebookPage>('facebook_pages').findOne({ _id: channel.pageId });
      }
      if (!page) {
        page = await db.collection<FacebookPage>('facebook_pages').findOne({ isActive: true });
      }
      if (!page) {
        return {
          success: false,
          channelId,
          error: `No active Facebook Page assigned to channel "${channel.name}".`,
        };
      }

      const scan = await this.scanChannel(channelId);
      const targetVideo = scan.videos.find((v) => v.id === fileId);
      if (!targetVideo) {
        return {
          success: false,
          channelId,
          error: `Video ID "${fileId}" not found in folder for "${channel.name}".`,
        };
      }

      const res = await this.executePublishVideo(targetVideo, page, channel);
      return {
        ...res,
        channelId,
        channelName: channel.name,
        pageName: page.name,
      };
    } finally {
      this.publishingChannels.delete(channelId);
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
    deletedFromDrive?: boolean;
    deleteError?: string;
    error?: string;
  }> {
    const db = getDatabase();
    const globalKey = await this.getGlobalApiKey();
    const apiKey = (conf.apiKey || globalKey || '').trim();

    console.log(`[GDriveReelService] ☁️ Downloading "${video.name}" (${video.sizeMb} MB) for channel "${conf.name}" to page "${page.name}"...`);

    try {
      // 1. Download file media from Google Drive v3 API
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${video.id}?alt=media&key=${apiKey}`;
      const downloadRes = await fetch(downloadUrl);

      if (!downloadRes.ok) {
        throw new Error(`Failed to download video from Google Drive (${downloadRes.status} ${downloadRes.statusText})`);
      }

      const arrayBuffer = await downloadRes.arrayBuffer();
      const videoBuffer = Buffer.from(arrayBuffer);

      console.log(`[GDriveReelService] ✓ Download complete (${videoBuffer.length} bytes). Publishing to page "${page.name}" (${page._id})...`);

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
        // Algorithm optimized viral hashtags
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

      // 5. Update posted state in MongoDB for this specific channel
      const now = new Date();
      await db.collection<GDriveReelConfig>('gdrive_reel_configs').updateOne(
        { _id: conf._id },
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
        articleId: `gdrive_${conf._id}_${video.id}`,
        articleTitle: video.cleanTitle,
        pageId: page._id,
        pageName: page.name,
        theme: `gdrive-${conf._id}`,
        fbVideoId: videoId,
        fbPostId: postId,
        status: config.DRY_RUN ? 'dry_run' : 'published',
        caption: caption,
        durationSeconds: 15,
        createdAt: now,
      });

      console.log(`✓ [GDriveReelService] Successfully published Reel "${video.name}" to "${page.name}"! Video ID: ${videoId}`);

      // 7. Auto-delete or trash video from Google Drive after successful posting
      let deletedFromDrive = false;
      let deleteError: string | undefined;
      const shouldDelete = conf.deleteAfterPosting !== false; // Default true per user request

      if (shouldDelete) {
        console.log(`[GDriveReelService] 🗑️ Auto-deleting "${video.name}" (${video.id}) from Google Drive...`);
        const delRes = await this.deleteDriveFile(video.id, apiKey, conf);
        deletedFromDrive = delRes.success;
        deleteError = delRes.error;
        if (delRes.success) {
          console.log(`✓ [GDriveReelService] Successfully removed "${video.name}" (${video.id}) from Google Drive (${delRes.action})`);
        } else {
          console.warn(`⚠️ [GDriveReelService] Note deleting "${video.name}" from Google Drive: ${delRes.error}`);
        }
      }

      return {
        success: true,
        filename: video.name,
        cleanTitle: video.cleanTitle,
        videoId,
        postId,
        deletedFromDrive,
        deleteError,
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
   * Retrieves active Google OAuth access token if available
   */
  public async getGoogleOAuthToken(): Promise<string | null> {
    try {
      const db = getDatabase();
      const sRef = await db.collection('settings').findOne({ _id: 'GDRIVE_REFRESH_TOKEN' as any });
      if (sRef?.value) {
        const sId = await db.collection('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' as any });
        const sSec = await db.collection('settings').findOne({ _id: 'YOUTUBE_CLIENT_SECRET' as any });
        const clientId = sId?.value || process.env.YOUTUBE_CLIENT_ID || '';
        const clientSecret = sSec?.value || process.env.YOUTUBE_CLIENT_SECRET || '';
        if (clientId && clientSecret) {
          const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: sRef.value,
              grant_type: 'refresh_token',
            }).toString(),
          });
          const data = (await res.json()) as any;
          if (data.access_token) return data.access_token;
        }
      }

      const configured = await this.ytClient.initCredentials();
      if (configured) {
        return await this.ytClient.getAccessToken();
      }
    } catch (e: any) {
      console.warn('[GDriveReelService] Note fetching Google OAuth token:', e.message);
    }
    return null;
  }

  /**
   * Deletes or moves a file to trash in Google Drive
   */
  public async deleteDriveFile(
    fileId: string,
    apiKeyInput?: string,
    channelCtx?: GDriveReelConfig
  ): Promise<{ success: boolean; action?: 'trash' | 'permanent'; error?: string }> {
    const globalKey = await this.getGlobalApiKey();
    const apiKey = (apiKeyInput || channelCtx?.apiKey || globalKey || '').trim();
    const oauthToken = await this.getGoogleOAuthToken();
    const action = channelCtx?.deleteAction || 'trash';

    // 1. If Google OAuth token is available
    if (oauthToken) {
      try {
        if (action === 'permanent') {
          const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${oauthToken}` },
          });
          if (delRes.ok || delRes.status === 204 || delRes.status === 404) {
            return { success: true, action: 'permanent' };
          }
        }

        // Standard move to Trash (safest & instantly removes file from folder scan)
        const patchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${oauthToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trashed: true }),
        });

        if (patchRes.ok) {
          return { success: true, action: 'trash' };
        }

        // Fallback to permanent DELETE
        const delFallback = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${oauthToken}` },
        });

        if (delFallback.ok || delFallback.status === 204 || delFallback.status === 404) {
          return { success: true, action: 'permanent' };
        }

        const errData = (await patchRes.json().catch(() => ({}))) as any;
        return {
          success: false,
          error: errData?.error?.message || `Google Drive deletion returned HTTP ${patchRes.status}`,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // 2. If only API Key is available
    if (apiKey) {
      try {
        const patchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?key=${apiKey}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true }),
        });

        if (patchRes.ok) {
          return { success: true, action: 'trash' };
        }

        const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?key=${apiKey}`, {
          method: 'DELETE',
        });

        if (delRes.ok || delRes.status === 204 || delRes.status === 404) {
          return { success: true, action: 'permanent' };
        }

        return {
          success: false,
          error: 'Google Drive API requires Google OAuth (Google Sign-In) to delete files. API Key provides read-only access. Connect Google Account to enable file deletion.',
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return {
      success: false,
      error: 'No Google credentials (OAuth token or API key) available to delete file.',
    };
  }

  /**
   * Resets posted history for a specific channel
   */
  public async resetHistoryForChannel(channelId: string): Promise<void> {
    const db = getDatabase();
    await db.collection<GDriveReelConfig>('gdrive_reel_configs').updateOne(
      { _id: channelId },
      { $set: { postedVideoIds: [], postedVideoNames: [], updatedAt: new Date() } }
    );
    console.log(`[GDriveReelService] Posted video history reset for channel ${channelId}.`);
  }

  /**
   * Evaluates all active channels and publishes the next video for any that are due
   */
  public async publishAllDueChannels(): Promise<{
    totalChannels: number;
    activeChannels: number;
    processed: Array<{
      channelId: string;
      channelName: string;
      pageName: string;
      status: 'published' | 'skipped' | 'failed';
      result?: any;
      reason?: string;
    }>;
  }> {
    const channels = await this.getAllChannels();
    const active = channels.filter((c) => c.isActive && (c.folderUrlOrId || c.folderId));

    const processed: any[] = [];
    for (const channel of active) {
      const intervalMs = (channel.scheduleIntervalHours || 2) * 60 * 60 * 1000;
      const lastPost = channel.lastPostedAt ? new Date(channel.lastPostedAt).getTime() : 0;
      const isDue = Date.now() - lastPost >= intervalMs - 60000; // 1 min grace

      if (!isDue) {
        const nextDueInMin = Math.round((intervalMs - (Date.now() - lastPost)) / 60000);
        processed.push({
          channelId: channel._id,
          channelName: channel.name,
          pageName: channel.pageName || 'Unknown Page',
          status: 'skipped',
          reason: `Not due yet. Next post scheduled in ~${nextDueInMin} minutes.`,
        });
        continue;
      }

      try {
        console.log(`[GDriveReelService] Executing scheduled post for channel "${channel.name}"...`);
        const result = await this.publishNextForChannel(channel._id);
        if (result.success) {
          processed.push({
            channelId: channel._id,
            channelName: channel.name,
            pageName: channel.pageName || 'Unknown Page',
            status: 'published',
            result,
          });
        } else {
          processed.push({
            channelId: channel._id,
            channelName: channel.name,
            pageName: channel.pageName || 'Unknown Page',
            status: 'failed',
            reason: result.error,
          });
        }
      } catch (e: any) {
        processed.push({
          channelId: channel._id,
          channelName: channel.name,
          pageName: channel.pageName || 'Unknown Page',
          status: 'failed',
          reason: e.message,
        });
      }
    }

    return {
      totalChannels: channels.length,
      activeChannels: active.length,
      processed,
    };
  }

  // -------------------------------------------------------------
  // BACKWARD-COMPATIBLE WRAPPERS (for existing single-channel callers)
  // -------------------------------------------------------------
  public async getConfig(): Promise<GDriveReelConfig> {
    const channels = await this.getAllChannels();
    return channels[0];
  }

  public async saveConfig(updates: Partial<GDriveReelConfig>): Promise<GDriveReelConfig> {
    const targetId = updates._id || DEFAULT_GDRIVE_CONFIG_ID;
    return await this.saveChannel({ ...updates, _id: targetId });
  }

  public async scanFolder(customUrlOrId?: string, customApiKey?: string): Promise<GDriveScanResult> {
    if (customUrlOrId) {
      return await this.scanFolderDirect(customUrlOrId, customApiKey);
    }
    const conf = await this.getConfig();
    return await this.scanChannel(conf._id);
  }

  public async publishNext(): Promise<{
    success: boolean;
    filename?: string;
    cleanTitle?: string;
    videoId?: string;
    postId?: string;
    error?: string;
  }> {
    const conf = await this.getConfig();
    return await this.publishNextForChannel(conf._id);
  }

  public async publishSpecificFile(fileId: string): Promise<{
    success: boolean;
    filename?: string;
    cleanTitle?: string;
    videoId?: string;
    postId?: string;
    error?: string;
  }> {
    const conf = await this.getConfig();
    return await this.publishSpecificFileForChannel(conf._id, fileId);
  }

  public async resetPostedHistory(): Promise<void> {
    const conf = await this.getConfig();
    await this.resetHistoryForChannel(conf._id);
  }

  /**
   * Starts background scheduler
   */
  public async startScheduler(): Promise<void> {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }

    // Runs every 10 minutes to check if any active channel is due
    this.cronTask = cron.schedule('*/10 * * * *', async () => {
      try {
        await this.publishAllDueChannels();
      } catch (err: any) {
        console.error('[GDriveReelService - Scheduler Error]:', err.message);
      }
    });
  }

  public async restartScheduler(): Promise<void> {
    this.stopScheduler();
    await this.startScheduler();
  }

  public stopScheduler(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
  }
}
