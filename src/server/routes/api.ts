import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { getDatabase } from '../../db/index.js';
import { FacebookPage, RssSource, Setting } from '../../db/schema.js';
import { PersistentJobQueue } from '../../services/queue/queue.js';
import { PlaywrightImageRenderer } from '../../services/renderer/playwright.js';
import { FacebookTokenService } from '../../services/facebook/token.js';
import { ArticleDedupeService } from '../../services/rss/dedupe.js';
import { AVAILABLE_TEMPLATES } from '../../config/constants.js';
import { config } from '../../config/env.js';

export const apiRouter = Router();
const queue = new PersistentJobQueue();
const renderer = new PlaywrightImageRenderer();
const dedupeService = new ArticleDedupeService();

// 1. Dashboard Overview Stats
apiRouter.get('/stats', (req: Request, res: Response) => {
  const db = getDatabase();
  const queueStats = queue.getStats();

  const totalArticles = db
    .prepare('SELECT COUNT(*) as count FROM news_articles')
    .get() as { count: number };
  const totalPages = db
    .prepare('SELECT COUNT(*) as count FROM facebook_pages')
    .get() as { count: number };
  const totalSources = db
    .prepare('SELECT COUNT(*) as count FROM rss_sources')
    .get() as { count: number };
  const successfulPosts = db
    .prepare("SELECT COUNT(*) as count FROM post_logs WHERE status IN ('success', 'dry_run')")
    .get() as { count: number };

  res.json({
    queue: queueStats,
    articlesCount: totalArticles.count,
    pagesCount: totalPages.count,
    sourcesCount: totalSources.count,
    successfulPosts: successfulPosts.count,
    dryRun: config.DRY_RUN,
  });
});

// 2. RSS Sources
apiRouter.get('/sources', (req: Request, res: Response) => {
  const db = getDatabase();
  const sources = db.prepare(`
    SELECT s.*, p.name as page_name
    FROM rss_sources s
    LEFT JOIN facebook_pages p ON s.page_id = p.id
    ORDER BY s.created_at DESC
  `).all();
  res.json(sources);
});

apiRouter.post('/sources', (req: Request, res: Response) => {
  const { name, url, page_id, template_id, is_active } = req.body;
  if (!name || !url || !page_id) {
    res.status(400).json({ error: 'Name, URL, and Facebook Page are required' });
    return;
  }

  const db = getDatabase();
  const id = crypto.randomUUID();

  try {
    db.prepare(`
      INSERT INTO rss_sources (id, name, url, page_id, template_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), url.trim(), page_id, template_id || 'template-square-breaking', is_active ?? 1);

    res.status(201).json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/sources/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  db.prepare('DELETE FROM rss_sources WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 3. Facebook Pages
apiRouter.get('/pages', (req: Request, res: Response) => {
  const db = getDatabase();
  const pages = db.prepare('SELECT id, name, is_active, token_expires_at, created_at FROM facebook_pages ORDER BY created_at DESC').all();
  res.json(pages);
});

apiRouter.post('/pages', async (req: Request, res: Response) => {
  const { id, name, access_token } = req.body;
  if (!id || !name || !access_token) {
    res.status(400).json({ error: 'Page ID, Name, and Page Access Token are required' });
    return;
  }

  const tokenInfo = await FacebookTokenService.inspectToken(access_token);
  const db = getDatabase();

  try {
    db.prepare(`
      INSERT OR REPLACE INTO facebook_pages (id, name, access_token, token_expires_at, is_active, updated_at)
      VALUES (?, ?, ?, ?, 1, datetime('now'))
    `).run(id.trim(), name.trim(), access_token.trim(), tokenInfo.expiresAt ? tokenInfo.expiresAt.toISOString() : null);

    res.status(201).json({
      success: true,
      id,
      tokenInfo: {
        isValid: tokenInfo.isValid,
        expiresAt: tokenInfo.expiresAt,
        scopes: tokenInfo.scopes,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pages/test', async (req: Request, res: Response) => {
  const { access_token } = req.body;
  if (!access_token) {
    res.status(400).json({ error: 'Access token required' });
    return;
  }

  const tokenInfo = await FacebookTokenService.inspectToken(access_token);
  res.json(tokenInfo);
});

apiRouter.delete('/pages/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  db.prepare('DELETE FROM facebook_pages WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 4. Queue & Job Management
apiRouter.get('/queue', (req: Request, res: Response) => {
  const db = getDatabase();
  const status = req.query.status as string;
  let query = `
    SELECT j.*, a.title as article_title, a.link as article_link, p.name as page_name
    FROM jobs j
    LEFT JOIN news_articles a ON j.article_id = a.id
    LEFT JOIN facebook_pages p ON j.page_id = p.id
  `;

  if (status) {
    query += ` WHERE j.status = '${status}'`;
  }
  query += ' ORDER BY j.created_at DESC LIMIT 50';

  const jobs = db.prepare(query).all();
  res.json(jobs);
});

apiRouter.post('/queue/:id/retry', (req: Request, res: Response) => {
  const success = queue.retryFailedJob(req.params.id as string);
  if (success) {
    res.json({ success: true, message: 'Job rescheduled for immediate processing' });
  } else {
    res.status(400).json({ error: 'Job not found or not in failed state' });
  }
});

// 5. Post Logs
apiRouter.get('/logs', (req: Request, res: Response) => {
  const db = getDatabase();
  const logs = db.prepare(`
    SELECT l.*, a.title as article_title, a.link as article_link, p.name as page_name
    FROM post_logs l
    LEFT JOIN news_articles a ON l.article_id = a.id
    LEFT JOIN facebook_pages p ON l.page_id = p.id
    ORDER BY l.created_at DESC
    LIMIT 50
  `).all();
  res.json(logs);
});

// 6. Template Live Preview
apiRouter.get('/templates', (req: Request, res: Response) => {
  res.json(Object.values(AVAILABLE_TEMPLATES));
});

apiRouter.post('/preview/render', async (req: Request, res: Response) => {
  try {
    const { templateId, headline, category, imageUrl } = req.body;

    const sampleHeadline =
      headline ||
      'রিপাবলিকানদের ঘাঁটি এলাকায় ডেমোক্র্যাটদের নাটকীয় জয়: হোয়াইট হাউসের রাজনীতিতে নতুন মেরুকরণ ও আলোড়ন';

    const buffer = await renderer.renderToBuffer({
      templateId: templateId || 'template-square-breaking',
      headline: sampleHeadline,
      category: category || 'ব্রেকিং নিউজ',
      imageUrl: imageUrl || undefined,
    });

    const base64Data = `data:image/png;base64,${buffer.toString('base64')}`;
    res.json({
      success: true,
      imageUri: base64Data,
      sizeBytes: buffer.length,
    });
  } catch (err: any) {
    console.error('[PreviewRender] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Manual trigger: Poll RSS Now
apiRouter.post('/poll-now', async (req: Request, res: Response) => {
  try {
    const results = await dedupeService.pollAllActiveSources();
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Settings
apiRouter.get('/settings', (req: Request, res: Response) => {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM settings').all() as Setting[];
  const settingsMap: Record<string, string> = {
    POLL_INTERVAL_CRON: config.POLL_INTERVAL_CRON,
    MAX_ARTICLE_AGE_HOURS: String(config.MAX_ARTICLE_AGE_HOURS),
    MAX_POSTS_PER_HOUR: String(config.MAX_POSTS_PER_HOUR),
    MIN_DELAY_SECONDS: String(config.MIN_DELAY_SECONDS),
    MAX_DELAY_SECONDS: String(config.MAX_DELAY_SECONDS),
    DRY_RUN: String(config.DRY_RUN),
    DEFAULT_HASHTAGS: config.DEFAULT_HASHTAGS,
    DEFAULT_CAPTION_FORMAT: config.DEFAULT_CAPTION_FORMAT,
    DEFAULT_COMMENT_FORMAT: config.DEFAULT_COMMENT_FORMAT,
  };

  for (const r of rows) {
    settingsMap[r.key] = r.value;
  }

  res.json(settingsMap);
});

apiRouter.post('/settings', (req: Request, res: Response) => {
  const db = getDatabase();
  const body = req.body;

  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        stmt.run(key, String(value));
      }
    }
  });

  tx();
  res.json({ success: true });
});
