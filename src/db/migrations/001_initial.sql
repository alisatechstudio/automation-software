-- Migration 001: Initial Schema
-- Supports SQLite and is fully translatable to PostgreSQL

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facebook_pages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_expires_at DATETIME,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rss_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  page_id TEXT NOT NULL,
  template_id TEXT NOT NULL DEFAULT 'template-square-breaking',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (page_id) REFERENCES facebook_pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS news_articles (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  guid TEXT UNIQUE NOT NULL,
  link TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  pub_date DATETIME NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'ingested',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES rss_sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_articles_guid ON news_articles(guid);
CREATE INDEX IF NOT EXISTS idx_articles_link ON news_articles(link);
CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON news_articles(pub_date);
CREATE INDEX IF NOT EXISTS idx_articles_status ON news_articles(status);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  article_id TEXT,
  page_id TEXT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES facebook_pages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at ON jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_article_id ON jobs(article_id);

CREATE TABLE IF NOT EXISTS post_logs (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  fb_photo_id TEXT,
  fb_post_id TEXT,
  fb_comment_id TEXT,
  rendered_image_path TEXT,
  caption TEXT,
  comment TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES facebook_pages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_logs_article ON post_logs(article_id);
CREATE INDEX IF NOT EXISTS idx_post_logs_created ON post_logs(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

