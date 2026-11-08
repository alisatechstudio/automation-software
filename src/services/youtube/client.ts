import crypto from 'crypto';
import { getDatabase } from '../../db/index.js';
import { Setting, YouTubeChannel } from '../../db/schema.js';
import { config } from '../../config/env.js';

export interface YouTubeUploadInput {
  videoBuffer: Buffer;
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus?: 'public' | 'unlisted' | 'private';
  isEnglish?: boolean;
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

/**
 * Strips category prefixes from headlines or filenames.
 * Examples:
 *   "International - US President Announces Major Policy" -> "US President Announces Major Policy"
 *   "খেলাধুলা - বাংলাদেশ দলের প্রস্তুতি" -> "বাংলাদেশ দলের প্রস্তুতি"
 *   "[World News] : Major Summit Begins" -> "Major Summit Begins"
 *   "Breaking News - Massive Storm Approaching" -> "Massive Storm Approaching"
 */
export function stripCategoryFromTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle.trim();

  // 1. Strip bracketed or parenthesized tags at start: [Category], (Category)
  title = title.replace(/^\[[^\]]+\]\s*[-–—:|•~]*\s*/i, '');
  title = title.replace(/^\([^)]+\)\s*[-–—:|•~]*\s*/i, '');

  const categoryNames = [
    'international news', 'international', 'world news', 'world', 'breaking news', 'breaking', 'special report',
    'national news', 'national', 'us politics', 'politics', 'political news', 'us news', 'usa news',
    'economy news', 'economy', 'business news', 'business', 'finance news', 'finance', 'market update',
    'technology news', 'technology', 'tech news', 'tech', 'entertainment news', 'entertainment', 'showbiz', 'hollywood',
    'sports news', 'sports', 'football news', 'football', 'cricket news', 'cricket',
    'lifestyle', 'health news', 'health', 'science news', 'science', 'opinion', 'editorial', 'education', 'general news', 'general',
    'আন্তর্জাতিক সংবাদ', 'আন্তর্জাতিক', 'সারাদেশ', 'জাতীয় সংবাদ', 'জাতীয়', 'রাজনীতি সংবাদ', 'রাজনীতি', 'রাজনৈতিক খবর',
    'অর্থনীতি সংবাদ', 'অর্থনীতি', 'বাণিজ্য সংবাদ', 'বাণিজ্য', 'শেয়ারবাজার', 'খেলাধুলা সংবাদ', 'খেলাধুলা', 'খেলা', 'আজকের খেলা',
    'তথ্যপ্রযুক্তি সংবাদ', 'তথ্যপ্রযুক্তি', 'প্রযুক্তি সংবাদ', 'প্রযুক্তি', 'বিনোদন সংবাদ', 'বিনোদন',
    'মতামত', 'কলাম', 'জীবনযাপন', 'স্বাস্থ্য সংবাদ', 'স্বাস্থ্য', 'শিক্ষা সংবাদ', 'শিক্ষা', 'চাকরি সংবাদ', 'চাকরি', 'ধর্ম',
    'ব্রেকিং নিউজ', 'ব্রেকিং', 'সাধারণ সংবাদ', 'সাধারণ', 'জরুরি সংবাদ', 'জরুরি', 'বাংলাদেশ সংবাদ', 'বাংলাদেশ'
  ];

  const escapedCategories = categoryNames.map((c) => c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
  // Match category when followed by a separator (- : | • ~)
  const catWithSeparator = new RegExp('^(?:' + escapedCategories + ')\\s*[-–—:|•~]+\\s*', 'i');
  title = title.replace(catWithSeparator, '');

  // Fallback: any 2-25 char prefix ending in separator: e.g. 'Some Prefix - '
  title = title.replace(/^[A-Za-z\u0980-\u09FF\s&]{2,25}\s*[-–—:|•~]\s+/i, '');

  return title.trim() || rawTitle.trim();
}

/**
 * Formats an engaging, viral YouTube Short title:
 * - Strips category name / prefix from title
 * - Cleans and formats headline
 * - Appends maximum high-performing viral hashtags (#Shorts #Viral #Trending #News #FYP) within YouTube's 100-character limit
 */
export function formatYouTubeShortTitle(rawTitle: string, isEnglish: boolean = false): string {
  let title = stripCategoryFromTitle(rawTitle);

  // Strip existing hashtags from title so we control and format them cleanly
  title = title.replace(/#[a-zA-Z0-9_\u0980-\u09FF]+/g, '').trim();

  // Normalize whitespace and trailing punctuation
  title = title.replace(/\s+/g, ' ').replace(/[-–—:|•\s]+$/, '').trim();

  // High-velocity viral hashtags for YouTube Shorts
  const viralTags = isEnglish
    ? ['#Shorts', '#Viral', '#Trending', '#News', '#FYP', '#ShortsFeed']
    : ['#Shorts', '#Viral', '#Trending', '#খবর', '#BDNews', '#সংবাদ'];

  // Reserve space for tags: Title max length in YouTube Data API is 100 characters.
  // Cap base title length to leave room for viral tags
  if (title.length > 70) {
    const truncated = title.substring(0, 68);
    const lastSpace = truncated.lastIndexOf(' ');
    title = (lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated).trim() + '...';
  }

  let finalTitle = title;
  for (const tag of viralTags) {
    if ((finalTitle + ' ' + tag).length <= 100) {
      finalTitle = finalTitle + ' ' + tag;
    } else {
      break;
    }
  }

  // Ensure #Shorts is ALWAYS present
  if (!finalTitle.includes('#Shorts')) {
    finalTitle = `${finalTitle.substring(0, 92)} #Shorts`;
  }

  return finalTitle;
}

export class YouTubeClient {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private channelId?: string;
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(clientId?: string, clientSecret?: string, refreshToken?: string, channelId?: string) {
    this.clientId = clientId || process.env.YOUTUBE_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.YOUTUBE_CLIENT_SECRET || '';
    this.refreshToken = refreshToken || process.env.YOUTUBE_REFRESH_TOKEN || '';
    this.channelId = channelId;
  }

  /**
   * Factory method to create a YouTubeClient for a specific configured channel
   */
  public static forChannel(
    channel: YouTubeChannel,
    fallbackClientId?: string,
    fallbackClientSecret?: string
  ): YouTubeClient {
    return new YouTubeClient(
      channel.clientId || fallbackClientId,
      channel.clientSecret || fallbackClientSecret,
      channel.refreshToken,
      channel._id
    );
  }

  /**
   * Tests connection and retrieves profile for this client
   */
  public async testConnection(): Promise<{ success: boolean; profile?: YouTubeChannelProfile; error?: string }> {
    try {
      const profile = await this.getChannelProfile();
      return { success: true, profile };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Initializes credentials from database if not passed via env
   */
  public async initCredentials(): Promise<boolean> {
    try {
      const db = getDatabase();
      const sId = await db.collection<Setting>('settings').findOne({
        _id: { $in: ['GOOGLE_CLIENT_ID', 'GDRIVE_CLIENT_ID', 'YOUTUBE_CLIENT_ID'] as any },
      });
      const sSec = await db.collection<Setting>('settings').findOne({
        _id: { $in: ['GOOGLE_CLIENT_SECRET', 'GDRIVE_CLIENT_SECRET', 'YOUTUBE_CLIENT_SECRET'] as any },
      });
      const sRef = await db.collection<Setting>('settings').findOne({
        _id: { $in: ['GOOGLE_REFRESH_TOKEN', 'GDRIVE_REFRESH_TOKEN', 'YOUTUBE_REFRESH_TOKEN'] as any },
      });

      this.clientId =
        (sId?.value && sId.value.trim()) ||
        this.clientId ||
        process.env.GOOGLE_CLIENT_ID ||
        process.env.GDRIVE_CLIENT_ID ||
        process.env.YOUTUBE_CLIENT_ID ||
        '';
      this.clientSecret =
        (sSec?.value && sSec.value.trim()) ||
        this.clientSecret ||
        process.env.GOOGLE_CLIENT_SECRET ||
        process.env.GDRIVE_CLIENT_SECRET ||
        process.env.YOUTUBE_CLIENT_SECRET ||
        '';
      this.refreshToken =
        (sRef?.value && sRef.value.trim()) ||
        this.refreshToken ||
        process.env.GOOGLE_REFRESH_TOKEN ||
        process.env.GDRIVE_REFRESH_TOKEN ||
        process.env.YOUTUBE_REFRESH_TOKEN ||
        '';

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
    redirectUri: string,
    options?: { persistSetting?: boolean; settingKey?: string }
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
      if (options?.persistSetting !== false) {
        try {
          const settingKey = options?.settingKey || 'YOUTUBE_REFRESH_TOKEN';
          const db = getDatabase();
          await db.collection<Setting>('settings').updateOne(
            { _id: settingKey as any },
            { $set: { value: data.refresh_token, updatedAt: new Date() } },
            { upsert: true }
          );
        } catch (err) {
          console.warn('Could not persist refresh token to database:', err);
        }
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

    // 1. Remove category name and add multiple viral hashtags to the title (<100 chars)
    const cleanTitle = formatYouTubeShortTitle(input.title, Boolean(input.isEnglish));

    // 2. Comprehensive viral hashtags for description (20+ algorithm discovery tags)
    const coreViralTags = input.isEnglish
      ? '#Shorts #YouTubeShorts #Viral #Trending #FYP #Explore #ViralShorts #ShortsFeed #ShortsViral #Algorithm #BreakingNews #News #TrendingNews #USNews #WorldNews #DailyNews #Headlines #ViralVideo'
      : '#Shorts #YouTubeShorts #Viral #Trending #FYP #ViralShorts #ShortsFeed #ShortsViral #খবর #সংবাদ #বাংলাখবর #ব্রেকিংনিউজ #বাংলাদেশ #BDNews #Bangladesh #BanglaNews #NewsUpdate #ViralVideo';

    let finalDescription = (input.description || '').trim();
    if (!finalDescription) {
      finalDescription = coreViralTags;
    } else {
      const existingTagCount = (finalDescription.match(/#[a-zA-Z0-9_\u0980-\u09FF]+/g) || []).length;
      if (existingTagCount < 10) {
        finalDescription = `${finalDescription}\n\n${coreViralTags}`;
      }
    }

    // 3. High-traffic YouTube search keyword tags
    const defaultTags = input.isEnglish
      ? [
          'Shorts',
          'YouTubeShorts',
          'Viral',
          'Trending',
          'FYP',
          'ViralShorts',
          'ShortsFeed',
          'TrendingNews',
          'USNews',
          'WorldNews',
          'BreakingNews',
          'NewsUpdate',
          'DailyNews',
          'Headlines',
          'ViralVideo',
        ]
      : [
          'Shorts',
          'YouTubeShorts',
          'Viral',
          'Trending',
          'FYP',
          'ViralShorts',
          'ShortsFeed',
          'BDNews',
          'Bangladesh',
          'BanglaNews',
          'NewsUpdate',
          'বাংলাখবর',
          'ব্রেকিংনিউজ',
          'খবর',
          'সংবাদ',
          'ViralVideo',
        ];

    const tags = Array.from(
      new Set([
        ...(input.tags || []),
        ...defaultTags,
      ])
    );

    const metadata = {
      snippet: {
        title: cleanTitle,
        description: finalDescription,
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
