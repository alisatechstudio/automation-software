export interface FacebookPage {
  id: string; // Page ID
  name: string;
  access_token: string;
  token_expires_at?: string | null;
  is_active: number; // 1 or 0
  created_at: string;
  updated_at: string;
}

export interface RssSource {
  id: string;
  name: string;
  url: string;
  page_id: string;
  template_id: string;
  is_active: number; // 1 or 0
  created_at: string;
  updated_at: string;
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
  id: string;
  source_id: string;
  guid: string;
  link: string;
  title: string;
  description?: string | null;
  category?: string | null;
  pub_date: string;
  image_url?: string | null;
  status: ArticleStatus;
  created_at: string;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: string;
  article_id?: string | null;
  page_id?: string | null;
  payload: string; // JSON string
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_at: string;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostLog {
  id: string;
  article_id: string;
  page_id: string;
  fb_photo_id?: string | null;
  fb_post_id?: string | null;
  fb_comment_id?: string | null;
  rendered_image_path?: string | null;
  caption?: string | null;
  comment?: string | null;
  duration_ms?: number | null;
  status: 'success' | 'failed' | 'dry_run';
  error_message?: string | null;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
  description?: string | null;
  updated_at: string;
}

