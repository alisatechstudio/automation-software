export interface FacebookPage {
  _id: string; // Facebook Page ID
  name: string;
  accessToken: string;
  tokenExpiresAt?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RssSource {
  _id: string; // Source ID (UUID)
  name: string;
  url: string;
  pageId: string;
  templateId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ArticleStatus =
  | 'ingested'
  | 'queued'
  | 'rendering'
  | 'rendered'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'skipped';

export interface NewsArticle {
  _id: string; // Article ID (UUID)
  sourceId: string;
  guid: string;
  link: string;
  title: string;
  description?: string;
  category?: string;
  pubDate: Date;
  imageUrl?: string | null;
  status: ArticleStatus;
  createdAt: Date;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobPayload {
  articleId: string;
  sourceId: string;
  pageId: string;
  templateId?: string;
  [key: string]: any;
}

export interface Job {
  _id: string; // Job ID (UUID)
  type: string;
  articleId?: string | null;
  pageId?: string | null;
  payload: JobPayload;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostLog {
  _id: string;
  articleId: string;
  pageId: string;
  fbPhotoId?: string | null;
  fbPostId?: string | null;
  fbCommentId?: string | null;
  fbReelId?: string | null;
  fbVideoId?: string | null;
  fbStoryId?: string | null;
  storyStatus?: 'success' | 'failed' | 'dry_run' | 'skipped';
  ytVideoId?: string | null;
  ytStatus?: 'success' | 'failed' | 'dry_run' | 'skipped';
  renderedImagePath?: string | null;
  renderedVideoPath?: string | null;
  caption?: string | null;
  comment?: string | null;
  durationMs?: number | null;
  status: 'success' | 'failed' | 'dry_run';
  errorMessage?: string | null;
  createdAt: Date;
}

export interface ReelLog {
  _id: string;
  articleId?: string | null;
  articleTitle: string;
  pageId: string;
  pageName: string;
  theme?: string;
  fbVideoId: string;
  fbPostId: string;
  durationMs?: number | null;
  status: 'success' | 'failed' | 'dry_run';
  errorMessage?: string | null;
  createdAt: Date;
}

export interface StoryLog {
  _id: string;
  articleId?: string | null;
  articleTitle: string;
  pageId: string;
  pageName: string;
  fbPhotoId: string;
  fbStoryId: string;
  renderedImagePath?: string | null;
  durationMs?: number | null;
  status: 'success' | 'failed' | 'dry_run';
  errorMessage?: string | null;
  createdAt: Date;
}

export interface YouTubeUploadLog {
  _id: string;
  articleId?: string | null;
  articleTitle: string;
  channelId?: string | null;
  channelTitle?: string | null;
  ytVideoId: string;
  ytVideoUrl: string;
  durationMs?: number | null;
  status: 'success' | 'failed' | 'dry_run';
  errorMessage?: string | null;
  createdAt: Date;
}

export interface YouTubeChannel {
  _id: string; // channel ID
  title: string;
  customUrl?: string;
  description?: string;
  thumbnailUrl?: string;
  subscriberCount?: string;
  videoCount?: string;
  isActive: boolean;
  updatedAt: Date;
}

export interface Setting {
  _id: string; // Setting key
  value: string;
  description?: string | null;
  updatedAt: Date;
}

export interface FacebookGroup {
  _id: string; // Facebook Group ID (or numeric string)
  name: string;
  categories: string[]; // e.g. ['all'] or ['রাজনীতি', 'খেলাধুলা', 'জাতীয়']
  autoShare: boolean;
  isActive?: boolean;
  pageId?: string; // Connected page ID or 'all'
  accessToken?: string | null; // Optional user token override; if null/empty, uses Page access token
  delaySeconds?: number; // Delay between group shares (default 5s)
  totalShares?: number;
  lastSharedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupShareRecord {
  groupId: string;
  groupName: string;
  fbSharePostId?: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  sharedAt: Date;
}

export interface GroupShareLog {
  _id: string;
  groupId: string;
  groupName: string;
  articleId: string;
  articleTitle: string;
  fbPostId: string;
  sharePostId?: string | null;
  status: 'success' | 'failed' | 'dry_run' | 'skipped';
  errorMessage?: string | null;
  durationMs?: number | null;
  createdAt: Date;
}

export interface GDriveReelConfig {
  _id: string; // Identifier e.g. 'default_gdrive_reels' or UUID
  name?: string; // Friendly label, e.g. "Channel 1 - Daily Reels"
  folderUrlOrId: string; // Full Drive folder URL or ID
  folderId: string; // Clean extracted Google Drive Folder ID
  apiKey?: string; // Google Drive API Key (or fallback to global)
  pageId: string; // Target Facebook Page ID
  pageName?: string;
  isActive: boolean; // Automated scheduling ON/OFF
  scheduleIntervalHours: number; // e.g. 1, 2, 3, 4, 6, 12, 24
  cronExpression?: string; // e.g. "0 */2 * * *"
  captionStrategy: 'viral_hashtags' | 'custom';
  customCaption?: string;
  firstCommentText?: string;
  orderStrategy: 'oldest_first' | 'newest_first' | 'alphabetical' | 'random';
  postedVideoIds: string[]; // List of Google Drive file IDs already published
  postedVideoNames: string[]; // List of file names published
  lastPostedAt?: Date | null;
  lastPostedFile?: string | null;
  createdAt: Date;
  updatedAt: Date;
}


