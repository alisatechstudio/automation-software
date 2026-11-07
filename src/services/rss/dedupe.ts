import crypto from 'crypto';
import { getDatabase } from '../../db/index.js';
import { NewsArticle, RssSource, Job } from '../../db/schema.js';
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
   * Polls a single RSS source, filters by max age, dedupes against MongoDB,
   * inserts new articles, and schedules jobs in FIFO order (oldest first).
   */
  public async pollSource(source: RssSource): Promise<IngestionResult> {
    const db = getDatabase();
    const articlesCol = db.collection<NewsArticle>('news_articles');
    const jobsCol = db.collection<Job>('jobs');

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

    for (const item of fetchedItems) {
      // Age filter
      if (item.pubDate < cutoffTime) {
        skippedTooOld++;
        continue;
      }

      // Dedupe check: check both GUID and link
      const existing = await articlesCol.findOne({
        $or: [{ guid: item.guid }, { link: item.link }],
      });

      if (existing) {
        skippedDuplicate++;
        continue;
      }

      const articleId = crypto.randomUUID();
      const jobId = crypto.randomUUID();

      const articleDoc: NewsArticle = {
        _id: articleId,
        sourceId: source._id,
        guid: item.guid,
        link: item.link,
        title: item.title,
        description: item.description || '',
        category: item.category || 'সাধারণ',
        pubDate: item.pubDate,
        imageUrl: item.imageUrl || null,
        status: 'queued',
        createdAt: new Date(),
      };

      const jobDoc: Job = {
        _id: jobId,
        type: 'process_article',
        articleId,
        pageId: source.pageId,
        payload: {
          articleId,
          sourceId: source._id,
          pageId: source.pageId,
          templateId: source.templateId,
        },
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        runAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await articlesCol.insertOne(articleDoc as any);
      await jobsCol.insertOne(jobDoc as any);

      newArticlesIngested++;
      queuedJobs++;
    }

    return {
      sourceId: source._id,
      sourceName: source.name,
      totalFetched: fetchedItems.length,
      newArticlesIngested,
      skippedDuplicate,
      skippedTooOld,
      queuedJobs,
    };
  }

  /**
   * Polls all active RSS sources in MongoDB, optionally filtered by target page ID
   */
  public async pollAllActiveSources(pageId?: string): Promise<IngestionResult[]> {
    const db = getDatabase();
    const sourcesCol = db.collection<RssSource>('rss_sources');
    const filter: any = { isActive: true };
    if (pageId && pageId !== 'all') {
      filter.pageId = pageId;
    }
    const activeSources = await sourcesCol.find(filter).toArray();

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
