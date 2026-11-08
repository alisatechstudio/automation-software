import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cron, { ScheduledTask } from 'node-cron';
import { getDatabase } from '../../db/index.js';
import { GDriveReelConfig, FacebookPage, ReelLog, YouTubeChannel, RssSource } from '../../db/schema.js';
import { FacebookGraphClient } from '../facebook/client.js';
import { YouTubeClient } from '../youtube/client.js';
import { TikTokClient } from '../tiktok/client.js';
import { GroupShareService } from '../facebook/group-share.js';
import { generateGDriveReelHashtags, generateViralReelHashtags, isEnglishText } from '../../config/constants.js';
import { config } from '../../config/env.js';
import { getDbSetting, setDbSetting } from '../settings.js';

export interface GDriveVideoItem {
  id: string;
  name: string;
  cleanTitle: string;
  sizeBytes: number;
  sizeMb: string;
  mimeType: string;
  modifiedTime: Date;
  isPosted: boolean;
  isLocalFallback?: boolean;
  webViewLink?: string;
  thumbnailLink?: string;
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
  private tikTokClient: TikTokClient;
  private groupShareService: GroupShareService;
  private cronTask: ScheduledTask | null = null;
  private publishingChannels = new Set<string>();

  constructor() {
    this.fbClient = new FacebookGraphClient();
    this.ytClient = new YouTubeClient();
    this.tikTokClient = new TikTokClient();
    this.groupShareService = new GroupShareService(this.fbClient);
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

    // If input is a web URL
    if (/^(https?:\/\/|www\.|drive\.google\.com)/i.test(trimmed)) {
      // 1. Match /folders/ID
      const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_\-]+)/i);
      if (folderMatch && folderMatch[1]) return folderMatch[1];

      // 2. Match /d/ID
      const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_\-]+)/i);
      if (dMatch && dMatch[1]) return dMatch[1];

      // 3. Match ?id=ID or &id=ID
      const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_\-]+)/i);
      if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

      // If it is a URL but doesn't match any Drive folder/file pattern, return empty
      return '';
    }

    // Direct alphanumeric string (Google Drive folder IDs are typically 15-45 characters)
    const cleanId = trimmed.replace(/[^a-zA-Z0-9_\-]/g, '');
    return cleanId || trimmed;
  }

  /**
   * Extracts embedded hashtags from filename or title text
   */
  public extractHashtags(text: string): string[] {
    if (!text) return [];
    const matches = text.match(/#([a-zA-Z0-9_\u0980-\u09FF]+)/g);
    return matches ? matches.map((m) => m.trim()) : [];
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
    // Remove hashtags from clean title (they are preserved for hashtags block)
    title = title.replace(/#[a-zA-Z0-9_\u0980-\u09FF]+/g, '').trim();
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
    try {
      const s1 = await getDbSetting('GDRIVE_API_KEY');
      if (s1 && s1.trim()) return s1.trim();

      const s2 = await getDbSetting('GOOGLE_DRIVE_API_KEY');
      if (s2 && s2.trim()) return s2.trim();

      const s3 = await getDbSetting('GDRIVE_GLOBAL_API_KEY');
      if (s3 && s3.trim()) return s3.trim();

      const db = getDatabase();
      const setting = await db.collection<any>('settings').findOne({ _id: 'gdrive_settings' as any });
      if (setting) {
        const val = (setting.apiKey || setting.value || '').trim();
        if (val) return val;
      }
    } catch {
      // Fallback gracefully to env variable if DB is not connected
    }
    return (process.env.GOOGLE_DRIVE_API_KEY || process.env.GDRIVE_API_KEY || '').trim();
  }

  /**
   * Saves or updates the shared global Google Drive API key
   */
  public async setGlobalApiKey(key: string): Promise<string> {
    const cleanKey = (key || '').trim();
    try {
      await setDbSetting('GDRIVE_API_KEY', cleanKey);
      await setDbSetting('GOOGLE_DRIVE_API_KEY', cleanKey);
      const db = getDatabase();
      await db.collection('settings').updateOne(
        { _id: 'gdrive_settings' as any },
        { $set: { apiKey: cleanKey, value: cleanKey, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (err: any) {
      console.warn('[GDriveReelService] Note saving gdrive_settings:', err.message);
    }
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
      category: 'auto',
      customHashtags: '',
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

    // Ensure dedicated Google Drive channels exist for the two Drive pages (হক কথা & Alisa Tech Studio)
    try {
      const pages = await db.collection<FacebookPage>('facebook_pages').find({ isActive: true }).toArray();
      const gdriveTargetPages = pages.filter((p) =>
        p._id === '1302276172975819' ||
        p._id === '1268359636369219' ||
        p.name.includes('হক কথা') ||
        p.name.includes('Alisa')
      );

      for (const targetPage of gdriveTargetPages) {
        const hasChannel = channels.some((c) => c.pageId === targetPage._id || (c.name && c.name.includes(targetPage.name)));
        if (!hasChannel) {
          const globalKey = await this.getGlobalApiKey();
          const channelId = `gdrive_${targetPage._id}`;
          const newChannel: GDriveReelConfig = {
            _id: channelId,
            name: targetPage.name,
            folderUrlOrId: '',
            folderId: '',
            apiKey: globalKey,
            pageId: targetPage._id,
            pageName: targetPage.name,
            isActive: true,
            scheduleIntervalHours: 2,
            cronExpression: '0 */2 * * *',
            category: 'auto',
            customHashtags: '',
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
          await db.collection<GDriveReelConfig>('gdrive_reel_configs').insertOne(newChannel);
          channels.push(newChannel);
        }
      }
    } catch (e: any) {
      console.warn('[GDriveReelService] Note auto-provisioning Drive channels for pages:', e.message);
    }

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
      youtubeChannelId: data.youtubeChannelId !== undefined ? data.youtubeChannelId : (existing?.youtubeChannelId || 'all'),
      autoPostYouTube: data.autoPostYouTube !== undefined ? Boolean(data.autoPostYouTube) : (existing?.autoPostYouTube ?? true),
      autoPostTikTok: data.autoPostTikTok !== undefined ? Boolean(data.autoPostTikTok) : (existing?.autoPostTikTok ?? true),
      tiktokAccessToken: data.tiktokAccessToken !== undefined ? data.tiktokAccessToken : (existing?.tiktokAccessToken || ''),
      postStory: data.postStory !== undefined ? Boolean(data.postStory) : (existing?.postStory ?? true),
      shareToGroups: data.shareToGroups !== undefined ? Boolean(data.shareToGroups) : (existing?.shareToGroups ?? false),
      sourceId: data.sourceId !== undefined ? data.sourceId : (existing?.sourceId || ''),
      isActive: data.isActive !== undefined ? data.isActive : (existing?.isActive ?? false),
      scheduleIntervalHours: interval,
      cronExpression: cronExpr,
      category: data.category !== undefined ? data.category : (existing?.category || 'auto'),
      customHashtags: data.customHashtags !== undefined ? data.customHashtags : (existing?.customHashtags || ''),
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
   * Uploads a video buffer directly into a Google Drive folder.
   * If Google OAuth credentials are present, uploads via Google Drive API v3 (resumable).
   * Also stages a copy into local storage (data/gdrive_folders/<folderId>/) for zero-data-loss fallback.
   */
  public async uploadVideoToFolder(options: {
    folderId: string;
    videoBuffer: Buffer;
    filename: string;
    apiKey?: string;
    mimeType?: string;
  }): Promise<{
    success: boolean;
    fileId?: string;
    filename: string;
    webViewLink?: string;
    isLocalFallback?: boolean;
    error?: string;
  }> {
    const cleanFolderId = this.extractFolderId(options.folderId);
    const mimeType = options.mimeType || 'video/mp4';
    const filename = options.filename;

    if (!cleanFolderId) {
      return { success: false, filename, error: 'Target Google Drive folder ID is missing or invalid.' };
    }

    // Always stage into local folder as persistent safety fallback
    const localDir = path.join(config.DATA_DIR, 'gdrive_folders', cleanFolderId);
    let localSaved = false;
    try {
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      const localFilePath = path.join(localDir, filename);
      fs.writeFileSync(localFilePath, options.videoBuffer);
      localSaved = true;
    } catch (fsErr: any) {
      console.warn(`[GDriveReelService] Note staging local fallback video: ${fsErr.message}`);
    }

    // 1. Check for Google OAuth token
    const oauthToken = await this.getGoogleOAuthToken();
    if (oauthToken && !config.DRY_RUN) {
      try {
        console.log(`[GDriveReelService] ☁️ Uploading "${filename}" (${options.videoBuffer.length} bytes) to Google Drive folder "${cleanFolderId}"...`);

        // Resumable upload initialization with full shared drive support
        const initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true';
        const isRealDriveFolder = !cleanFolderId.startsWith('folder_') && cleanFolderId.length > 10;
        const initRes = await fetch(initUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${oauthToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': String(options.videoBuffer.length),
          },
          body: JSON.stringify({
            name: filename,
            ...(isRealDriveFolder ? { parents: [cleanFolderId] } : {}),
          }),
        });

        if (initRes.ok) {
          const uploadLocation = initRes.headers.get('location');
          if (uploadLocation) {
            const putRes = await fetch(uploadLocation, {
              method: 'PUT',
              headers: {
                'Content-Type': mimeType,
                'Content-Length': String(options.videoBuffer.length),
              },
              body: options.videoBuffer as any,
            });

            if (putRes.ok) {
              const fileData = (await putRes.json().catch(() => ({}))) as any;
              console.log(`✓ [GDriveReelService] Video "${filename}" uploaded to Google Drive! File ID: ${fileData.id}`);
              return {
                success: true,
                fileId: fileData.id,
                filename,
                webViewLink: `https://drive.google.com/file/d/${fileData.id}/view`,
                isLocalFallback: false,
              };
            } else {
              const putErr = await putRes.text().catch(() => '');
              console.warn(`[GDriveReelService] Drive API upload chunk failed ${putRes.status}: ${putErr}`);
            }
          }
        } else {
          const errText = await initRes.text().catch(() => '');
          console.warn(`[GDriveReelService] Drive API upload init returned status ${initRes.status}: ${errText}. Using local folder fallback.`);
        }
      } catch (uploadErr: any) {
        console.warn(`[GDriveReelService] Drive API upload note: ${uploadErr.message}. Using local folder fallback.`);
      }
    }

    // Dry Run or Local Fallback
    const fallbackFileId = `local_${Buffer.from(filename).toString('hex').slice(0, 16)}`;
    console.log(`[GDriveReelService] ✓ Saved reel to linked folder "${cleanFolderId}" (Local Fallback: ${localSaved}, File ID: ${fallbackFileId})`);
    return {
      success: true,
      fileId: fallbackFileId,
      filename,
      isLocalFallback: true,
      webViewLink: `/api/gdrive-reels/files/${fallbackFileId}/preview`,
    };
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

    // Auto-link folder from RSS source if channel folder is not configured
    if (!channel.folderUrlOrId && !channel.folderId && channel.pageId) {
      try {
        const db = getDatabase();
        const src = await db.collection<RssSource>('rss_sources').findOne({
          pageId: channel.pageId,
          $or: [
            { gdriveFolderUrlOrId: { $exists: true, $ne: '' } },
            { gdriveFolderId: { $exists: true, $ne: '' } },
          ],
        });
        if (src && (src.gdriveFolderUrlOrId || src.gdriveFolderId)) {
          channel.folderUrlOrId = src.gdriveFolderUrlOrId || src.gdriveFolderId || '';
          channel.folderId = this.extractFolderId(channel.folderUrlOrId);
          await db.collection<GDriveReelConfig>('gdrive_reel_configs').updateOne(
            { _id: channel._id },
            { $set: { folderUrlOrId: channel.folderUrlOrId, folderId: channel.folderId, updatedAt: new Date() } }
          );
        }
      } catch (err: any) {
        console.warn('[GDriveReelService] Note auto-linking folder from RSS source:', err.message);
      }
    }

    const folderTarget = (channel.folderUrlOrId || channel.folderId || '').trim();
    if (!folderTarget) {
      return {
        channelId: channel._id,
        channelName: channel.name,
        folderId: '',
        folderUrl: '',
        totalVideos: 0,
        postedCount: 0,
        pendingCount: 0,
        videos: [],
        error: `No Google Drive folder linked to "${channel.name}". Click "✎ Edit" to add a Google Drive folder URL.`,
      };
    }

    const globalKey = await this.getGlobalApiKey();
    const apiKey = (channel.apiKey || globalKey || '').trim();

    const scan = await this.scanFolderDirect(folderTarget, apiKey, channel);
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
    const oauthToken = await this.getGoogleOAuthToken();

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

    const postedIdSet = new Set(channelCtx?.postedVideoIds || []);
    const postedNameSet = new Set((channelCtx?.postedVideoNames || []).map((n) => n.toLowerCase()));
    const videoList: GDriveVideoItem[] = [];
    let remoteError: string | undefined;

    // 1. Build Drive API query with modern attributes
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent('files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink,thumbnailLink)');
    const baseApiUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    let driveRes: Response | null = null;

    // A. Try OAuth token first if available
    if (oauthToken) {
      try {
        const res = await fetch(baseApiUrl, {
          headers: { Authorization: `Bearer ${oauthToken}` },
        });
        if (res.ok) {
          driveRes = res;
        } else {
          const errorData = (await res.json().catch(() => ({}))) as any;
          remoteError = errorData.error?.message || `Google Drive OAuth API error (${res.status} ${res.statusText})`;
        }
      } catch (err: any) {
        remoteError = `Google Drive OAuth network error: ${err.message}`;
      }
    }

    // B. If OAuth did not succeed or was missing, and API key is available, try API Key!
    if (!driveRes && apiKey) {
      try {
        const keyUrl = `${baseApiUrl}&key=${apiKey}`;
        const keyRes = await fetch(keyUrl);
        if (keyRes.ok) {
          driveRes = keyRes;
          remoteError = undefined; // Cleared because API key query succeeded!
        } else {
          const errorData = (await keyRes.json().catch(() => ({}))) as any;
          const keyErr = errorData.error?.message || `Google Drive API error (${keyRes.status} ${keyRes.statusText})`;
          remoteError = remoteError ? `${remoteError} | API Key error: ${keyErr}` : keyErr;
        }
      } catch (err: any) {
        const netErr = `Google Drive API Key network error: ${err.message}`;
        remoteError = remoteError ? `${remoteError} | ${netErr}` : netErr;
      }
    }

    if (!driveRes && !apiKey && !oauthToken) {
      remoteError = 'Google Drive API Key is not configured. Please enter your Google Drive API Key in the box above.';
    }

    // Parse files if drive query succeeded
    if (driveRes && driveRes.ok) {
      try {
        const data = (await driveRes.json()) as any;
        const rawFiles: any[] = data.files || [];

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
              isLocalFallback: false,
              webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
              thumbnailLink: f.thumbnailLink,
            });
          }
        }
      } catch (parseErr: any) {
        console.warn('[GDriveReelService] Note parsing drive response:', parseErr.message);
      }
    }

    // 2. Scan local fallback storage directory
    const localDirCandidates = [
      path.join(config.DATA_DIR, 'gdrive_folders', folderId),
    ];
    if (channelCtx?._id) {
      localDirCandidates.push(path.join(config.DATA_DIR, 'gdrive_folders', `folder_${channelCtx._id.slice(0, 8)}`));
    }
    if (channelCtx?.pageId) {
      localDirCandidates.push(path.join(config.DATA_DIR, 'gdrive_folders', `folder_${channelCtx.pageId.slice(0, 8)}`));
    }

    for (const localDir of localDirCandidates) {
      if (fs.existsSync(localDir)) {
        try {
          const localFiles = fs.readdirSync(localDir);
          for (const localFile of localFiles) {
            const ext = path.extname(localFile).toLowerCase();
            if (VIDEO_EXTENSIONS.includes(ext)) {
              const alreadyInList = videoList.some((v) => v.name.toLowerCase() === localFile.toLowerCase());
              if (!alreadyInList) {
                const filePath = path.join(localDir, localFile);
                const stat = fs.statSync(filePath);
                const isPosted = postedIdSet.has(`local_${localFile}`) || postedNameSet.has(localFile.toLowerCase());

                videoList.push({
                  id: `local_${localFile}`,
                  name: localFile,
                  cleanTitle: this.cleanVideoTitle(localFile),
                  sizeBytes: stat.size,
                  sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
                  mimeType: 'video/mp4',
                  modifiedTime: new Date(stat.mtime),
                  isPosted,
                  isLocalFallback: true,
                  webViewLink: `/api/gdrive-reels/files/${encodeURIComponent(`local_${localFile}`)}/preview?folderId=${encodeURIComponent(path.basename(localDir))}`,
                });
              }
            }
          }
        } catch (fsScanErr: any) {
          console.warn('[GDriveReelService] Local folder scan note:', fsScanErr.message);
        }
      }
    }

    // If local or remote files exist, clear remote error so user can proceed seamlessly
    if (videoList.length > 0) {
      remoteError = undefined;
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
      error: videoList.length === 0 ? remoteError : undefined,
    };
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

    console.log(`[GDriveReelService] ☁️ Preparing video "${video.name}" (${video.sizeMb} MB) for channel "${conf.name}" (Page: "${page.name}")...`);

    try {
      // 1. Obtain video buffer (from local staged folder or Google Drive API)
      let videoBuffer: Buffer | null = null;
      const cleanFolderId = this.extractFolderId(conf.folderUrlOrId || conf.folderId);
      
      const candidatePaths = [
        cleanFolderId ? path.join(config.DATA_DIR, 'gdrive_folders', cleanFolderId, video.name) : '',
        path.join(config.DATA_DIR, 'rendered', video.name),
      ].filter(Boolean);

      if (conf._id) {
        candidatePaths.push(path.join(config.DATA_DIR, 'gdrive_folders', `folder_${conf._id.slice(0, 8)}`, video.name));
      }
      if (conf.pageId) {
        candidatePaths.push(path.join(config.DATA_DIR, 'gdrive_folders', `folder_${conf.pageId.slice(0, 8)}`, video.name));
      }

      const existingLocalPath = candidatePaths.find((p) => p && fs.existsSync(p));

      if (existingLocalPath) {
        console.log(`[GDriveReelService] 📂 Reading video from local storage: ${existingLocalPath}`);
        videoBuffer = fs.readFileSync(existingLocalPath);
      } else {
        const oauthToken = await this.getGoogleOAuthToken();
        const baseDownloadUrl = `https://www.googleapis.com/drive/v3/files/${video.id}?alt=media&supportsAllDrives=true`;
        let downloadRes: Response | null = null;

        if (oauthToken) {
          try {
            const res = await fetch(baseDownloadUrl, { headers: { Authorization: `Bearer ${oauthToken}` } });
            if (res.ok) downloadRes = res;
          } catch {}
        }

        if (!downloadRes && apiKey) {
          try {
            const res = await fetch(`${baseDownloadUrl}&key=${apiKey}`);
            if (res.ok) downloadRes = res;
          } catch {}
        }

        if (!downloadRes || !downloadRes.ok) {
          throw new Error(`Failed to download video from Google Drive (${downloadRes ? downloadRes.status + ' ' + downloadRes.statusText : 'Drive download error'})`);
        }

        const arrayBuffer = await downloadRes.arrayBuffer();
        videoBuffer = Buffer.from(arrayBuffer);
      }

      console.log(`[GDriveReelService] ✓ Video media ready (${videoBuffer.length} bytes). Broadcasting to linked social networks...`);

      // 2. Generate Caption & Viral Hashtags
      const fileTags = this.extractHashtags(video.name);
      const customUserTags = [conf.customHashtags, ...fileTags].filter(Boolean).join(' ');
      const isEnglishChannel =
        Boolean(page?.name && (page.name.includes('Trending') || page.name.includes('English') || page.name.includes('Alisa'))) ||
        Boolean(conf.name && (conf.name.includes('Trending') || conf.name.includes('English') || conf.name.includes('Alisa'))) ||
        isEnglishText(video.cleanTitle);

      const hashtags = generateGDriveReelHashtags({
        videoTitle: video.cleanTitle,
        channelName: conf.name,
        category: conf.category,
        userTags: customUserTags,
        isEnglish: isEnglishChannel,
      });

      let caption = '';
      if (conf.captionStrategy === 'custom' && conf.customCaption?.trim()) {
        caption = conf.customCaption
          .replace(/{hashtags}/gi, hashtags)
          .replace(/{channel}/gi, conf.name || '')
          .replace(/{filename}/gi, '')
          .replace(/{title}/gi, '')
          .trim();
        if (!caption) {
          caption = hashtags.trim();
        }
      } else {
        caption = hashtags.trim();
      }

      // 3. MULTI-NETWORK PUBLISHING: Post to all linked social networks

      // 3A. Post to Facebook Page (Reels)
      console.log(`[GDriveReelService] 📘 [1/4] Publishing Reel to Facebook Page "${page.name}" (${page._id})...`);
      const { videoId, postId } = await this.fbClient.publishReel(
        page._id,
        page.accessToken,
        videoBuffer,
        caption,
        undefined,
        config.DRY_RUN
      );

      // Optional First Comment (CTA / Link)
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
          console.log(`✓ [GDriveReelService] First comment posted to Facebook Reel ${commentTargetId}`);
        } catch (cErr: any) {
          console.warn(`[GDriveReelService] Could not post first comment:`, cErr.message);
        }
      }

      // 3B. Post to YouTube Channel (Shorts)
      if (conf.autoPostYouTube !== false) {
        try {
          const ytChannels = await db.collection<YouTubeChannel>('youtube_channels').find({ isActive: true }).toArray();
          const targetYt = ytChannels.find((ch) => {
            if (!ch.autoUpload) return false;
            if (conf.youtubeChannelId && conf.youtubeChannelId !== 'all') {
              return ch._id === conf.youtubeChannelId;
            }
            if (ch.targetPageId && ch.targetPageId !== 'all') {
              return ch.targetPageId === page._id;
            }
            return true;
          });

          if (targetYt) {
            console.log(`[GDriveReelService] 📺 [2/4] Publishing Short to YouTube Channel "${targetYt.title}" (${targetYt._id})...`);
            const ytClientForChannel = YouTubeClient.forChannel(targetYt);
            const ytRes = await ytClientForChannel.uploadShort({
              videoBuffer,
              title: video.cleanTitle,
              tags: fileTags,
              isEnglish: isEnglishChannel,
            }, config.DRY_RUN);
            console.log(`✓ [GDriveReelService] YouTube Short uploaded successfully! Video ID: ${ytRes.videoId}`);
          } else {
            console.log(`[GDriveReelService] ℹ️ [2/4] No auto-upload YouTube Channel matched for page ${page.name}`);
          }
        } catch (ytErr: any) {
          console.warn(`[GDriveReelService] YouTube Short upload note:`, ytErr.message);
        }
      }

      // 3C. Post to TikTok
      if (conf.autoPostTikTok !== false) {
        try {
          console.log(`[GDriveReelService] 🎵 [3/4] Publishing video to TikTok...`);
          const customTikTok = conf.tiktokAccessToken
            ? new TikTokClient(conf.tiktokAccessToken)
            : this.tikTokClient;
          const tikRes = await customTikTok.uploadVideo({
            videoBuffer,
            title: video.cleanTitle,
            tags: fileTags,
            isEnglish: isEnglishChannel,
          }, config.DRY_RUN);
          if (tikRes.success) {
            console.log(`✓ [GDriveReelService] TikTok video published! Publish ID: ${tikRes.publishId}`);
          }
        } catch (tikErr: any) {
          console.warn(`[GDriveReelService] TikTok upload note:`, tikErr.message);
        }
      }

      // 3D. Cross-share to Facebook Groups
      if (conf.shareToGroups) {
        try {
          console.log(`[GDriveReelService] 👥 [4/4] Auto-sharing to connected Facebook Groups...`);
          const mockArticle: any = {
            _id: `gdrive_${conf._id}_${video.id}`,
            sourceId: conf._id,
            guid: video.id,
            link: '',
            title: video.cleanTitle,
            category: conf.category || 'General',
            pubDate: video.modifiedTime,
            status: 'published',
            createdAt: new Date(),
          };
          await this.groupShareService.autoShareArticle(mockArticle, page, postId || videoId);
        } catch (gErr: any) {
          console.warn('[GDriveReelService] Group share note:', gErr.message);
        }
      }

      // 4. Update posted state in MongoDB for this specific channel
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

      // 5. Record to reel_logs
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

      console.log(`✓ [GDriveReelService] Successfully published Reel "${video.name}" to all linked networks! Facebook Video ID: ${videoId}`);

      // 6. Auto-delete or trash video from Google Drive and local storage after successful posting
      let deletedFromDrive = false;
      let deleteError: string | undefined;
      const shouldDelete = conf.deleteAfterPosting !== false;

      if (shouldDelete) {
        // Clean up local fallback copy if exists
        const localCleanPath = existingLocalPath || (cleanFolderId ? path.join(config.DATA_DIR, 'gdrive_folders', cleanFolderId, video.name) : '');
        if (localCleanPath && fs.existsSync(localCleanPath)) {
          try {
            fs.unlinkSync(localCleanPath);
            console.log(`✓ [GDriveReelService] Cleaned up local fallback file ${localCleanPath}`);
          } catch {}
        }

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
      let refreshToken =
        (await getDbSetting('GDRIVE_REFRESH_TOKEN')) ||
        (await getDbSetting('GOOGLE_REFRESH_TOKEN')) ||
        (await getDbSetting('YOUTUBE_REFRESH_TOKEN'));

      if (!refreshToken) {
        const sRef = await db.collection('settings').findOne({
          _id: { $in: ['GDRIVE_REFRESH_TOKEN', 'GOOGLE_REFRESH_TOKEN', 'YOUTUBE_REFRESH_TOKEN'] as any },
        });
        if (sRef?.value) refreshToken = sRef.value;
      }

      // Check connected YouTube channels which were authorized with full Google Drive scope
      if (!refreshToken) {
        try {
          const ytChannel = await db.collection<any>('youtube_channels').findOne({
            refreshToken: { $exists: true, $ne: '' },
          });
          if (ytChannel?.refreshToken) {
            refreshToken = ytChannel.refreshToken;
          }
        } catch {}
      }

      if (!refreshToken) {
        refreshToken =
          process.env.GDRIVE_REFRESH_TOKEN ||
          process.env.GOOGLE_REFRESH_TOKEN ||
          process.env.YOUTUBE_REFRESH_TOKEN ||
          '';
      }

      if (refreshToken) {
        const sId = await db.collection('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' as any });
        const sSec = await db.collection('settings').findOne({ _id: 'YOUTUBE_CLIENT_SECRET' as any });
        const clientId = (sId?.value && sId.value.trim()) || process.env.YOUTUBE_CLIENT_ID || '';
        const clientSecret = (sSec?.value && sSec.value.trim()) || process.env.YOUTUBE_CLIENT_SECRET || '';

        if (clientId && clientSecret) {
          const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }).toString(),
          });
          const data = (await res.json()) as any;
          if (data.access_token) return data.access_token;
          if (data.error) {
            console.warn(`[GDriveReelService] Note refreshing Google OAuth token: ${data.error_description || data.error}`);
          }
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
   * Evaluates active channels and publishes the next video.
   * Supports targeting a specific channelId, folderId, pageId, or forcing immediate publish.
   */
  public async publishAllDueChannels(options?: {
    force?: boolean;
    channelId?: string;
    folderId?: string;
    pageId?: string;
  }): Promise<{
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
    let active: GDriveReelConfig[];

    if (options?.channelId) {
      active = channels.filter((c) => c._id === options.channelId);
    } else if (options?.folderId) {
      const cleanFid = this.extractFolderId(options.folderId);
      active = channels.filter((c) => this.extractFolderId(c.folderUrlOrId || c.folderId) === cleanFid);
    } else if (options?.pageId) {
      active = channels.filter((c) => c.pageId === options.pageId);
    } else {
      active = channels.filter((c) => c.isActive && (c.folderUrlOrId || c.folderId));
    }

    const processed: any[] = [];
    const isExplicitTrigger = Boolean(options?.force || options?.channelId || options?.folderId || options?.pageId);

    if (active.length === 0 && (options?.channelId || options?.folderId || options?.pageId)) {
      return {
        totalChannels: channels.length,
        activeChannels: 0,
        processed: [{
          channelId: options.channelId || options.folderId || 'unknown',
          channelName: 'Channel',
          pageName: options.pageId || 'Unknown Page',
          status: 'failed',
          reason: `No Google Drive channel found matching target filter. Please configure a channel in the Google Drive tab.`,
        }],
      };
    }

    for (const channel of active) {
      if (!channel.folderUrlOrId && !channel.folderId) {
        processed.push({
          channelId: channel._id,
          channelName: channel.name,
          pageName: channel.pageName || 'Unknown Page',
          status: 'failed',
          reason: `Google Drive Folder URL is not configured yet for ${channel.name} (${channel.pageName}). Please set the Folder link in Dashboard > Google Drive tab.`,
        });
        continue;
      }
      const intervalMs = (channel.scheduleIntervalHours || 2) * 60 * 60 * 1000;
      const lastPost = channel.lastPostedAt ? new Date(channel.lastPostedAt).getTime() : 0;
      const isDue = Date.now() - lastPost >= intervalMs - 60000; // 1 min grace

      if (!isDue && !isExplicitTrigger) {
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
        console.log(`[GDriveReelService] Executing post for channel "${channel.name}" (Page: ${channel.pageName || channel.pageId})...`);
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

    if (process.env.ENABLE_INTERNAL_CRON !== 'true') {
      console.log('[GDriveReelService] ℹ️ Internal 10m cron disabled. Output Cron is driven externally via cron-job.org (/api/cron/output).');
      return;
    }

    // Runs every 10 minutes to check if any active channel is due (only when explicitly enabled)
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
