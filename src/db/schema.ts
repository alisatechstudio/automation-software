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
  renderedImagePath?: string | null;
  caption?: string | null;
  comment?: string | null;
  durationMs?: number | null;
  status: 'success' | 'failed' | 'dry_run';
  errorMessage?: string | null;
  createdAt: Date;
}

export interface Setting {
  _id: string; // Setting key
  value: string;
  description?: string | null;
  updatedAt: Date;
}
