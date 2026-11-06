import crypto from 'crypto';
import { getDatabase } from '../../db/index.js';
import { Setting } from '../../db/schema.js';
import { config } from '../../config/env.js';

export interface YouTubeUploadInput {
  videoBuffer: Buffer;
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus?: 'public' | 'unlisted' | 'private';
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  isDryRun: boolean;
}

export interface YouTubeChannelProfile {
  id: string;
  title: string;
  customUrl?: string;
  description?: string;
  thumbnailUrl?: string;
  subscriberCount?: string;
  videoCount?: string;
}

export class YouTubeClient {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(clientId?: string, clientSecret?: string, refreshToken?: string) {
    this.clientId = clientId || process.env.YOUTUBE_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.YOUTUBE_CLIENT_SECRET || '';
    this.refreshToken = refreshToken || process.env.YOUTUBE_REFRESH_TOKEN || '';
  }

  /**
   * Initializes credentials from database if not passed via env
   */
  public async initCredentials(): Promise<boolean> {
    try {
      const db = getDatabase();
      const sId = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_ID' });
      const sSec = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_CLIENT_SECRET' });
      const sRef = await db.collection<Setting>('settings').findOne({ _id: 'YOUTUBE_REFRESH_TOKEN' });

      this.clientId = (sId?.value && sId.value.trim()) || this.clientId || process.env.YOUTUBE_CLIENT_ID || '';
      this.clientSecret = (sSec?.value && sSec.value.trim()) || this.clientSecret || process.env.YOUTUBE_CLIENT_SECRET || '';
      this.refreshToken = (sRef?.value && sRef.value.trim()) || this.refreshToken || process.env.YOUTUBE_REFRESH_TOKEN || '';

      // Auto-sync refresh token to DB if present in env but not in DB
      if (!sRef?.value && this.refreshToken) {
        await db.collection<Setting>('settings').updateOne(
          { _id: 'YOUTUBE_REFRESH_TOKEN' },
          { $set: { value: this.refreshToken, updatedAt: new Date() } },
          { upsert: true }
        );
      }

      return Boolean(this.clientId && this.clientSecret && this.refreshToken);
    } catch (e) {
      return Boolean(this.clientId && this.clientSecret && this.refreshToken);
    }
  }

  /**
   * Exchanges authorization code for refresh_token and access_token
   */
  public async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<{ refreshToken: string; accessToken: string }> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await res.json()) as any;
    if (!res.ok || data.error) {
      throw new Error(`Token exchange failed: ${data.error_description || data.error || res.statusText}`);
    }

    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
      try {
        const db = getDatabase();
        await db.collection<Setting>('settings').updateOne(
          { _id: 'YOUTUBE_REFRESH_TOKEN' },
          { $set: { value: data.refresh_token, updatedAt: new Date() } },
          { upsert: true }
        );
      } catch (err) {
        console.warn('Could not persist refresh token to database:', err);
      }
    }

    this.cachedAccessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

    return {
      refreshToken: data.refresh_token || '',
      accessToken: data.access_token,
    };
  }

  public isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.refreshToken);
  }

  /**
   * Refreshes OAuth2 access token using the stored refresh token
   */
  public async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedAccessToken;
    }

    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      await this.initCredentials();
    }

    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error(
        'YouTube credentials missing. Please configure Client ID, Client Secret, and Refresh Token.'
      );
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await res.json()) as any;
    if (!res.ok || data.error) {
      throw new Error(
        `Failed to refresh YouTube access token: ${data.error_description || data.error || res.statusText}`
      );
    }

    this.cachedAccessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return this.cachedAccessToken as string;
  }

  /**
   * Retrieves profile and statistics for the authenticated YouTube Channel
   */
  public async getChannelProfile(): Promise<YouTubeChannelProfile> {
    // 1. Get access token first - propagate error if credentials or token refresh fails
    const accessToken = await this.getAccessToken();

    // 2. Query channel details (swallow 403 scope error if upload-only scope is granted)
    try {
      const url = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true';

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      const data = (await res.json().catch(() => ({}))) as any;
      const item = data.items?.[0];

      if (res.ok && item) {
        return {
          id: item.id,
          title: item.snippet?.title || 'YouTube Channel',
          customUrl: item.snippet?.customUrl,
          description: item.snippet?.description,
          thumbnailUrl: item.snippet?.thumbnails?.default?.url || item.snippet?.thumbnails?.medium?.url,
          subscriberCount: item.statistics?.subscriberCount,
          videoCount: item.statistics?.videoCount,
        };
      }

      // If scope only has youtube.upload or channels.list has no items, channel is still fully ready for upload!
      return {
        id: 'upload-active',
        title: 'YouTube Channel (Upload Active)',
        description: 'Channel authenticated for automatic YouTube Shorts video uploads.',
      };
    } catch (err: any) {
      console.warn('[YouTubeClient] getChannelProfile note:', err.message);
      return {
        id: 'upload-active',
        title: 'YouTube Channel (Upload Active)',
        description: 'Channel authenticated for automatic YouTube Shorts video uploads.',
      };
    }
  }

  /**
   * Uploads a 15-second MP4 news video directly as a YouTube Short
   */
  public async uploadShort(
    input: YouTubeUploadInput,
    dryRun: boolean = config.DRY_RUN
  ): Promise<YouTubeUploadResult> {
    if (dryRun) {
      const mockId = `dryrun_yt_${Date.now()}`;
      console.log(`[YouTubeClient - DRY RUN] Simulated YouTube Short upload:`);
      console.log(`  Title: ${input.title}`);
      console.log(`  Size: ${input.videoBuffer.length} bytes`);
      return {
        videoId: mockId,
        videoUrl: `https://youtube.com/shorts/${mockId}`,
        isDryRun: true,
      };
    }

    const accessToken = await this.getAccessToken();

    // Ensure title has #Shorts for automatic indexing
    let cleanTitle = input.title.trim();
    if (!cleanTitle.includes('#Shorts') && !cleanTitle.includes('#shorts')) {
      cleanTitle = `${cleanTitle.substring(0, 88)} #Shorts`;
    }

    const tags = Array.from(
      new Set([
        ...(input.tags || []),
        'Shorts',
        'YouTubeShorts',
        'BDNews',
        'Bangladesh',
        'BanglaNews',
        'NewsUpdate',
      ])
    );

    const metadata = {
      snippet: {
        title: cleanTitle,
        description: input.description || '#Shorts #BDNews #Bangladesh #NewsUpdate',
        tags,
        categoryId: '25', // News & Politics
      },
      status: {
        privacyStatus: input.privacyStatus || 'public',
        selfDeclaredMadeForKids: false,
      },
    };

    console.log(`[YouTubeClient] Initiating resumable video upload for "${cleanTitle}"...`);

    // Step 1: Start resumable upload session
    const initiateUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
    const initRes = await fetch(initiateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(input.videoBuffer.length),
      },
      body: JSON.stringify(metadata),
    });

    if (!initRes.ok) {
      const errData = (await initRes.json().catch(() => ({}))) as any;
      const errorMsg = errData.error?.message || initRes.statusText;
      const reason = errData.error?.errors?.[0]?.reason || errData.error?.status;

      if (reason === 'uploadLimitExceeded' || errorMsg?.includes('exceeded the number of videos')) {
        throw new Error(
          `[YOUTUBE_DAILY_LIMIT_EXCEEDED] YouTube upload limit reached: ${errorMsg}. YouTube enforces a 24-hour limit (~10-15 videos) on unverified/new channels. Verify your channel at youtube.com/verify to increase upload limits.`
        );
      }
      throw new Error(`YouTube upload initiation failed: ${errorMsg}`);
    }

    const uploadLocation = initRes.headers.get('location');
    if (!uploadLocation) {
      throw new Error('Did not receive YouTube resumable upload location header.');
    }

    console.log(`[YouTubeClient] Streaming ${input.videoBuffer.length} bytes to YouTube...`);

    // Step 2: Stream the MP4 video binary
    const uploadRes = await fetch(uploadLocation, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(input.videoBuffer.length),
      },
      body: new Uint8Array(input.videoBuffer),
    });

    const uploadData = (await uploadRes.json()) as any;
    if (!uploadRes.ok || uploadData.error) {
      throw new Error(`YouTube video upload failed: ${uploadData.error?.message || uploadRes.statusText}`);
    }

    const videoId = uploadData.id;
    const videoUrl = `https://youtube.com/shorts/${videoId}`;
    console.log(`✓ [YouTubeClient] Successfully published YouTube Short! ID: ${videoId} (${videoUrl})`);

    return {
      videoId,
      videoUrl,
      isDryRun: false,
    };
  }

  /**
   * Adds the news link as a pinned top-level comment on the uploaded Short
   */
  public async addComment(videoId: string, commentText: string): Promise<string | null> {
    try {
      const accessToken = await this.getAccessToken();
      const url = 'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            videoId,
            topLevelComment: {
              snippet: {
                textOriginal: commentText,
              },
            },
          },
        }),
      });

      const data = (await res.json()) as any;
      return data?.id || null;
    } catch (e: any) {
      console.warn(`[YouTubeClient] Could not post comment to video ${videoId}:`, e.message);
      return null;
    }
  }
}
