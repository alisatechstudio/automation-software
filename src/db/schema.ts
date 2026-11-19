export interface RssSource {
  _id: string; // Source ID (UUID or slug)
  name: string;
  url: string;
  pageId?: string;
  templateId?: string;
  gdriveFolderUrlOrId?: string;
  gdriveFolderId?: string;
  reelTheme?: string;
  reelDuration?: number;
  isActive: boolean;
  lastPolledAt?: Date | null;
  lastReelsCreated?: number;
  lastUploadedToDrive?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ArticleStatus =
  | 'ingested'
  | 'queued'
  | 'rendering'
  | 'rendered'
  | 'uploaded_to_drive'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'skipped';

export interface NewsArticle {
  _id: string;
  sourceId: string;
  guid: string;
  link: string;
  title: string;
  description?: string;
  category?: string;
  pubDate: Date;
  imageUrl?: string | null;
  status: ArticleStatus;
  gdriveFileId?: string | null;
  gdriveFolderId?: string | null;
  renderedVideoPath?: string | null;
  gdriveUploadStatus?: 'pending' | 'uploaded' | 'failed' | 'skipped';
  createdAt: Date;
  updatedAt?: Date;
}

export interface Setting {
  _id: string;
  value: string;
  description?: string | null;
  updatedAt: Date;
}
