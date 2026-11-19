import crypto from 'crypto';
import { getDatabase } from '../../db/index.js';
import { Setting, TikTokUploadLog } from '../../db/schema.js';
import { config } from '../../config/env.js';

export interface TikTokUploadInput {
  videoBuffer: Buffer;
  title: string;
  tags?: string[];
  isEnglish?: boolean;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
}

export interface TikTokUploadResult {
  success: boolean;
  publishId?: string;
  isDryRun: boolean;
  error?: string;
}

export class TikTokClient {
  private accessToken: string;
  private clientKey: string;
  private clientSecret: string;

  constructor(accessToken?: string, clientKey?: string, clientSecret?: string) {
    this.accessToken = accessToken || process.env.TIKTOK_ACCESS_TOKEN || '';
    this.clientKey = clientKey || process.env.TIKTOK_CLIENT_KEY || '';
    this.clientSecret = clientSecret || process.env.TIKTOK_CLIENT_SECRET || '';
  }

  /**
   * Initializes TikTok credentials from settings table if available
   */
  public async initCredentials(): Promise<boolean> {
    try {
      const db = getDatabase();
      const sTok = await db.collection<Setting>('settings').findOne({ _id: 'TIKTOK_ACCESS_TOKEN' });
      const sKey = await db.collection<Setting>('settings').findOne({ _id: 'TIKTOK_CLIENT_KEY' });
      const sSec = await db.collection<Setting>('settings').findOne({ _id: 'TIKTOK_CLIENT_SECRET' });

      if (sTok?.value && sTok.value.trim()) {
        this.accessToken = sTok.value.trim();
      }
      if (sKey?.value && sKey.value.trim()) {
        this.clientKey = sKey.value.trim();
      }
      if (sSec?.value && sSec.value.trim()) {
        this.clientSecret = sSec.value.trim();
      }

      return Boolean(this.accessToken);
    } catch {
      return Boolean(this.accessToken);
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.accessToken && this.accessToken.trim());
  }

  /**
   * Publishes a vertical video reel to TikTok Content Posting API v2
   */
  public async uploadVideo(
    input: TikTokUploadInput,
    dryRun: boolean = config.DRY_RUN
  ): Promise<TikTokUploadResult> {
    const startTime = Date.now();
    await this.initCredentials();

    let cleanTitle = (input.title || '').trim();
    if (input.tags && input.tags.length > 0) {
      const tagsStr = input.tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
      if (!cleanTitle.includes('#')) {
        cleanTitle = `${cleanTitle.slice(0, 120)} ${tagsStr}`.trim();
      }
    }

    if (dryRun || !this.isConfigured()) {
      const mockId = `dryrun_tiktok_${Date.now()}`;
      console.log(`[TikTokClient - DRY RUN / MOCK] Video upload simulated:`);
      console.log(`  Title: ${cleanTitle}`);
      console.log(`  Size: ${input.videoBuffer.length} bytes`);
      console.log(`  Configured: ${this.isConfigured() ? 'Yes' : 'No (Token not set)'}`);

      try {
        const db = getDatabase();
        await db.collection<TikTokUploadLog>('tiktok_upload_logs').insertOne({
          _id: crypto.randomUUID(),
          videoTitle: cleanTitle,
          publishId: mockId,
          status: 'dry_run',
          durationMs: Date.now() - startTime,
          createdAt: new Date(),
        });
      } catch (logErr: any) {
        console.warn('[TikTokClient] Note saving dry-run log:', logErr.message);
      }

      return {
        success: true,
        publishId: mockId,
        isDryRun: true,
      };
    }

    try {
      console.log(`[TikTokClient] 🚀 Initializing TikTok Content Posting API v2 for "${cleanTitle}" (${input.videoBuffer.length} bytes)...`);

      // 1. Initialize video upload
      const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title: cleanTitle.slice(0, 150),
            privacy_level: input.privacyLevel || 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: input.videoBuffer.length,
            chunk_size: input.videoBuffer.length,
            total_chunk_count: 1,
          },
        }),
      });

      const initData = (await initRes.json().catch(() => ({}))) as any;
      if (!initRes.ok || initData.error?.code) {
        const errMsg = initData.error?.message || `TikTok Init Error HTTP ${initRes.status}`;
        throw new Error(errMsg);
      }

      const publishId = initData.data?.publish_id;
      const uploadUrl = initData.data?.upload_url;

      if (!uploadUrl) {
        throw new Error('TikTok API did not return an upload_url');
      }

      // 2. Upload video binary
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes 0-${input.videoBuffer.length - 1}/${input.videoBuffer.length}`,
        },
        body: input.videoBuffer as any,
      });

      if (!uploadRes.ok) {
        throw new Error(`TikTok binary upload failed with status ${uploadRes.status}`);
      }

      console.log(`✓ [TikTokClient] Video uploaded to TikTok successfully! Publish ID: ${publishId}`);

      try {
        const db = getDatabase();
        await db.collection<TikTokUploadLog>('tiktok_upload_logs').insertOne({
          _id: crypto.randomUUID(),
          videoTitle: cleanTitle,
          publishId,
          status: 'success',
          durationMs: Date.now() - startTime,
          createdAt: new Date(),
        });
      } catch {}

      return {
        success: true,
        publishId,
        isDryRun: false,
      };
    } catch (err: any) {
      console.error('[TikTokClient] Upload error:', err.message);

      try {
        const db = getDatabase();
        await db.collection<TikTokUploadLog>('tiktok_upload_logs').insertOne({
          _id: crypto.randomUUID(),
          videoTitle: cleanTitle,
          status: 'failed',
          errorMessage: err.message,
          durationMs: Date.now() - startTime,
          createdAt: new Date(),
        });
      } catch {}

      return {
        success: false,
        error: err.message,
        isDryRun: false,
      };
    }
  }
}
