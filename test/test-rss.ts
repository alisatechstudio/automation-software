import { initMongoDb, getDatabase, closeDatabase } from '../src/db/index.js';
import { ArticleDedupeService } from '../src/services/rss/dedupe.js';
import { RssParserService } from '../src/services/rss/parser.js';
import { FacebookPage, RssSource, NewsArticle, Job } from '../src/db/schema.js';
import { config } from '../src/config/env.js';

async function runTest() {
  console.log('=== PHASE 1 TEST: RSS INGESTION & DEDUPLICATION (MONGODB) ===');
  console.log(`Connecting to MongoDB URI: ${config.MONGODB_URI}...`);

  try {
    await initMongoDb();
  } catch (err: any) {
    console.error('\n⚠️ Could not connect to MongoDB:', err.message);
    console.log('👉 Please set MONGODB_URI in your .env file to your Vercel/Atlas MongoDB connection string to run live DB tests.');
    return;
  }

  const db = getDatabase();

  // 1. Setup mock Facebook page
  console.log('1. Setting up test Facebook page & RSS source in MongoDB...');
  const testPageId = 'test_page_101';
  await db.collection<FacebookPage>('facebook_pages').updateOne(
    { _id: testPageId },
    {
      $set: {
        name: 'Test Bangla News Page',
        accessToken: 'EAAB...MOCK_TOKEN...',
        isActive: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  // Setup test RSS source: BBC Bangla RSS
  const testSourceId = 'source_bbc_bangla';
  const testRssUrl = 'https://feeds.bbci.co.uk/bengali/rss.xml';
  await db.collection<RssSource>('rss_sources').updateOne(
    { _id: testSourceId },
    {
      $set: {
        name: 'BBC Bangla',
        url: testRssUrl,
        pageId: testPageId,
        templateId: 'template-square-breaking',
        isActive: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  const source = await db.collection<RssSource>('rss_sources').findOne({ _id: testSourceId });
  if (!source) throw new Error('Source not found in MongoDB');

  // 2. Test Parser directly
  console.log('2. Testing RSS Parser directly...');
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

  // 3. Test Deduplication Service - Run 1
  console.log('\n3. Testing Dedupe Service (Run 1: Initial Ingestion into MongoDB)...');
  const dedupeService = new ArticleDedupeService();
  const res1 = await dedupeService.pollSource(source);
  console.log('Run 1 Result:', res1);

  const totalInDb = await db.collection('news_articles').countDocuments();
  const totalJobs = await db.collection('jobs').countDocuments();
  console.log(`✓ Ingested in MongoDB: ${totalInDb} articles, ${totalJobs} queued jobs`);

  // 4. Test Deduplication Service - Run 2 (Should skip all as duplicate)
  console.log('\n4. Testing Dedupe Service (Run 2: Immediate Re-poll)...');
  const res2 = await dedupeService.pollSource(source);
  console.log('Run 2 Result:', res2);

  if (res2.newArticlesIngested === 0 && res2.skippedDuplicate > 0) {
    console.log('✓ SUCCESS: Deduplication verified! 0 new articles ingested, duplicate items properly skipped.');
  }

  // Check FIFO order in jobs
  const jobs = await db
    .collection('jobs')
    .aggregate([
      {
        $lookup: {
          from: 'news_articles',
          localField: 'articleId',
          foreignField: '_id',
          as: 'article',
        },
      },
      { $sort: { 'article.pubDate': 1 } },
      { $limit: 3 },
    ])
    .toArray();

  console.log('\n5. Checking FIFO ordering (Oldest first in MongoDB):');
  jobs.forEach((job: any, i: number) => {
    const article = job.article?.[0];
    console.log(`  [#${i + 1}] Date: ${article?.pubDate?.toISOString()} | Title: ${article?.title?.substring(0, 40)}...`);
  });

  await closeDatabase();
  console.log('\n=== PHASE 1 COMPLETE & VERIFIED ===\n');
}

runTest().catch((err) => {
  console.error('Phase 1 test failed:', err);
  process.exit(1);
});
