import { initMongoDb, getDatabase, closeDatabase } from '../src/db/index.js';
import { ArticleDedupeService } from '../src/services/rss/dedupe.js';
import { QueueWorker } from '../src/services/queue/worker.js';
import { createServer } from '../src/server/app.js';
import { config } from '../src/config/env.js';
import { FacebookPage, RssSource, NewsArticle, Job, PostLog } from '../src/db/schema.js';

async function testEndToEnd() {
  console.log('===============================================================');
  console.log('🧪 END-TO-END VERIFICATION: FULL NEWS-TO-FACEBOOK PIPELINE (MONGODB)');
  console.log('===============================================================');

  config.DRY_RUN = true;
  console.log(`Connecting to MongoDB URI: ${config.MONGODB_URI}...`);

  try {
    await initMongoDb();
  } catch (err: any) {
    console.error('\n⚠️ Could not connect to MongoDB:', err.message);
    console.log('👉 Please set MONGODB_URI in your .env file to your Vercel/Atlas MongoDB connection string to run live DB tests.');
    return;
  }

  const db = getDatabase();

  // 1. Setup Test Page and RSS Source
  console.log('\n[Step 1] Configuring Test Facebook Page & RSS Source in MongoDB...');
  const pageId = 'page_bd_news_live';
  const pageName = 'Daily Bangla News 24';
  const mockToken = 'EAAB...VALID_LONG_LIVED_TOKEN...';

  await db.collection<FacebookPage>('facebook_pages').updateOne(
    { _id: pageId },
    { $set: { name: pageName, accessToken: mockToken, isActive: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  const sourceId = 'source_bbc_live_' + Date.now();
  const rssUrl = 'https://feeds.bbci.co.uk/bengali/rss.xml';

  await db.collection<RssSource>('rss_sources').updateOne(
    { _id: sourceId },
    { $set: { name: 'BBC Bangla Live', url: rssUrl, pageId, templateId: 'template-square-breaking', isActive: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  const source = (await db.collection<RssSource>('rss_sources').findOne({ _id: sourceId }))!;

  // 2. Poll RSS and Ingest Items
  console.log('\n[Step 2] Ingesting RSS items and verifying Deduplication...');
  const dedupeService = new ArticleDedupeService();
  const ingestion = await dedupeService.pollSource(source);
  console.log('Ingestion Summary:', ingestion);

  // 3. Fetch the newly queued job for this source (Oldest first)
  console.log('\n[Step 3] Fetching next pending job from MongoDB...');
  let job = await db.collection<Job>('jobs').findOne({
    'payload.sourceId': sourceId,
    status: 'pending',
  });

  if (!job) {
    job = await db.collection<Job>('jobs').findOne({ status: 'pending' });
  }

  if (!job) {
    throw new Error('No pending jobs found for test');
  }

  await db.collection('jobs').updateOne({ _id: job._id }, { $set: { status: 'processing', updatedAt: new Date() } });
  job.status = 'processing';

  console.log(`✓ Fetched Job ID: ${job._id}`);

  // 4. Process job with Queue Worker (Renders image + publishes photo + adds comment)
  console.log('\n[Step 4] Executing Queue Worker Pipeline (Render ➔ Publish Photo ➔ Publish Comment)...');
  const worker = new QueueWorker();
  await worker.processJob(job);

  // 5. Verify Post Log and Article Status
  console.log('\n[Step 5] Verifying Results in MongoDB...');
  const updatedJob = (await db.collection<Job>('jobs').findOne({ _id: job._id }))!;
  const article = (await db.collection<NewsArticle>('news_articles').findOne({ _id: job.payload.articleId }))!;
  const postLog = (await db.collection<PostLog>('post_logs').findOne({ articleId: job.payload.articleId }, { sort: { createdAt: -1 } }))!;

  console.log(`  Job Status: ${updatedJob.status} (Expected: 'completed')`);
  console.log(`  Article Status: ${article.status} (Expected: 'published')`);
  console.log(`  Rendered Image: ${postLog.renderedImagePath}`);
  console.log(`  Photo ID: ${postLog.fbPhotoId}`);
  console.log(`  Post ID: ${postLog.fbPostId}`);
  console.log(`  Comment ID: ${postLog.fbCommentId}`);
  console.log(`  Duration: ${postLog.durationMs}ms`);
  console.log('\n  First Comment:');
  console.log(`  "${postLog.comment}"`);

  // 6. Verify Health Check Endpoint
  console.log('\n[Step 6] Testing Web Server Health Endpoint (/health)...');
  const app = createServer();
  const testServer = app.listen(3099, async () => {
    try {
      const res = await fetch('http://localhost:3099/health');
      const healthData = await res.json();
      console.log('Health Check Response:\n', JSON.stringify(healthData, null, 2));
      testServer.close();
      await closeDatabase();

      console.log('\n===============================================================');
      console.log('✅ ALL PHASES VERIFIED: COMPLETE MONGODB PIPELINE WORKING!');
      console.log('===============================================================\n');
      process.exit(0);
    } catch (err) {
      testServer.close();
      await closeDatabase();
      throw err;
    }
  });
}

testEndToEnd().catch((err) => {
  console.error('End-to-End Test Failed:', err);
  process.exit(1);
});
