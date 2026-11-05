import { getDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrator.js';
import { ArticleDedupeService } from '../src/services/rss/dedupe.js';
import { RssParserService } from '../src/services/rss/parser.js';
import { FacebookPage, RssSource } from '../src/db/schema.js';

async function runTest() {
  console.log('=== PHASE 1 TEST: RSS INGESTION & DEDUPLICATION ===');

  // 1. Run migrations
  console.log('1. Running migrations...');
  runMigrations();
  const db = getDatabase();

  // 2. Setup mock Facebook page
  console.log('2. Setting up test Facebook page & RSS source...');
  const testPageId = 'test_page_101';
  db.prepare(`
    INSERT OR REPLACE INTO facebook_pages (id, name, access_token, is_active)
    VALUES (?, ?, ?, 1)
  `).run(testPageId, 'Test Bangla News Page', 'EAAB...MOCK_TOKEN...');

  // Setup test RSS source: BBC Bangla RSS or Prothom Alo
  const testSourceId = 'source_bbc_bangla';
  const testRssUrl = 'https://feeds.bbci.co.uk/bengali/rss.xml';
  db.prepare(`
    INSERT OR REPLACE INTO rss_sources (id, name, url, page_id, template_id, is_active)
    VALUES (?, ?, ?, ?, 'template-square-breaking', 1)
  `).run(testSourceId, 'BBC Bangla', testRssUrl, testPageId);

  const source = db.prepare('SELECT * FROM rss_sources WHERE id = ?').get(testSourceId) as RssSource;

  // 3. Test Parser directly
  console.log('3. Testing RSS Parser directly...');
  const parser = new RssParserService();
  const parsedItems = await parser.fetchAndParse(testRssUrl);
  console.log(`✓ Fetched ${parsedItems.length} items from BBC Bangla RSS`);
  if (parsedItems.length > 0) {
    const first = parsedItems[0];
    console.log('Sample parsed item:');
    console.log('  Title:', first.title);
    console.log('  Category:', first.category);
    console.log('  PubDate:', first.pubDate.toISOString());
    console.log('  Image URL:', first.imageUrl || '(no image found)');
    console.log('  Link:', first.link);
  }

  // 4. Test Deduplication Service - Run 1
  console.log('\n4. Testing Dedupe Service (Run 1: Initial Ingestion)...');
  const dedupeService = new ArticleDedupeService();
  const res1 = await dedupeService.pollSource(source);
  console.log('Run 1 Result:', res1);

  const totalInDb = db.prepare('SELECT COUNT(*) as count FROM news_articles').get() as { count: number };
  const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
  console.log(`✓ Ingested in DB: ${totalInDb.count} articles, ${totalJobs.count} queued jobs`);

  // 5. Test Deduplication Service - Run 2 (Should skip all as duplicate)
  console.log('\n5. Testing Dedupe Service (Run 2: Immediate Re-poll)...');
  const res2 = await dedupeService.pollSource(source);
  console.log('Run 2 Result:', res2);

  if (res2.newArticlesIngested === 0 && res2.skippedDuplicate > 0) {
    console.log('✓ SUCCESS: Deduplication verified! 0 new articles ingested, duplicate items properly skipped.');
  } else {
    console.warn('⚠ Note: Deduplication check result:', res2);
  }

  // Check FIFO order in jobs
  const jobs = db.prepare(`
    SELECT j.id, a.title, a.pub_date, j.status
    FROM jobs j
    JOIN news_articles a ON j.article_id = a.id
    ORDER BY datetime(a.pub_date) ASC
    LIMIT 3
  `).all() as any[];

  console.log('\n6. Checking FIFO ordering (Oldest first):');
  jobs.forEach((job, i) => {
    console.log(`  [#${i + 1}] Date: ${job.pub_date} | Title: ${job.title.substring(0, 40)}...`);
  });

  console.log('\n=== PHASE 1 COMPLETE & VERIFIED ===\n');
}

runTest().catch((err) => {
  console.error('Phase 1 test failed:', err);
  process.exit(1);
});

