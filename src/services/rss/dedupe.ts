import crypto from 'crypto';
import { getDatabase } from '../../db/index.js';
import { NewsArticle, RssSource } from '../../db/schema.js';
import { ParsedArticle, RssParserService } from './parser.js';
import { config } from '../../config/env.js';

export interface IngestionResult {
  sourceId: string;
  sourceName: string;
  totalFetched: number;
  newArticlesIngested: number;
  skippedDuplicate: number;
  skippedTooOld: number;
  queuedJobs: number;
}

export class ArticleDedupeService {
  private parserService: RssParserService;

  constructor() {
    this.parserService = new RssParserService();
  }

  /**
   * Polls a single RSS source, filters by max age, dedupes against DB,
   * inserts new articles, and schedules jobs in FIFO order (oldest first).
   */
  public async pollSource(source: RssSource): Promise<IngestionResult> {
    const db = getDatabase();
    const fetchedItems = await this.parserService.fetchAndParse(source.url);

    const now = new Date();
    const maxAgeMs = config.MAX_ARTICLE_AGE_HOURS * 60 * 60 * 1000;
    const cutoffTime = new Date(now.getTime() - maxAgeMs);

    // 1. Sort items OLDEST FIRST as required
    fetchedItems.sort((a, b) => a.pubDate.getTime() - b.pubDate.getTime());

    let newArticlesIngested = 0;
    let skippedDuplicate = 0;
    let skippedTooOld = 0;
    let queuedJobs = 0;

    const checkExistingStmt = db.prepare(`
      SELECT id FROM news_articles WHERE guid = ? OR link = ? LIMIT 1
    `);

    const insertArticleStmt = db.prepare(`
      INSERT INTO news_articles (
        id, source_id, guid, link, title, description, category, pub_date, image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued')
    `);

    const insertJobStmt = db.prepare(`
      INSERT INTO jobs (
        id, type, article_id, page_id, payload, status, attempts, max_attempts, run_at
      ) VALUES (?, 'process_article', ?, ?, ?, 'pending', 0, 3, datetime('now'))
    `);

    for (const item of fetchedItems) {
      // Age filter
      if (item.pubDate < cutoffTime) {
        skippedTooOld++;
        continue;
      }

      // Dedupe check: check both GUID and link
      const existing = checkExistingStmt.get(item.guid, item.link);
      if (existing) {
        skippedDuplicate++;
        continue;
      }

      const articleId = crypto.randomUUID();
      const jobId = crypto.randomUUID();

      const payload = JSON.stringify({
        articleId,
        sourceId: source.id,
        pageId: source.page_id,
        templateId: source.template_id,
      });

      // Insert article and job atomically
      const tx = db.transaction(() => {
        insertArticleStmt.run(
          articleId,
          source.id,
          item.guid,
          item.link,
          item.title,
          item.description || '',
          item.category || 'সাধারণ',
          item.pubDate.toISOString(),
          item.imageUrl || null
        );

        insertJobStmt.run(
          jobId,
          articleId,
          source.page_id,
          payload
        );
      });

      tx();
      newArticlesIngested++;
      queuedJobs++;
    }

    return {
      sourceId: source.id,
      sourceName: source.name,
      totalFetched: fetchedItems.length,
      newArticlesIngested,
      skippedDuplicate,
      skippedTooOld,
      queuedJobs,
    };
  }

  /**
   * Polls all active RSS sources in the database
   */
  public async pollAllActiveSources(): Promise<IngestionResult[]> {
    const db = getDatabase();
    const activeSources = db
      .prepare('SELECT * FROM rss_sources WHERE is_active = 1')
      .all() as RssSource[];

    const results: IngestionResult[] = [];
    for (const source of activeSources) {
      try {
        console.log(`[RssPoller] Polling source "${source.name}" (${source.url})...`);
        const result = await this.pollSource(source);
        results.push(result);
        console.log(
          `[RssPoller] Source "${source.name}": Fetched ${result.totalFetched}, Ingested ${result.newArticlesIngested}, Duplicates ${result.skippedDuplicate}, Too old ${result.skippedTooOld}`
        );
      } catch (err) {
        console.error(`[RssPoller] Error polling source "${source.name}":`, err);
      }
    }

    return results;
  }
}

