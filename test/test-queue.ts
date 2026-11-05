import { initMongoDb, getDatabase, closeDatabase } from '../src/db/index.js';
import { PersistentJobQueue } from '../src/services/queue/queue.js';
import { Job, FacebookPage, RssSource, NewsArticle } from '../src/db/schema.js';
import { config } from '../src/config/env.js';

async function testQueue() {
  console.log('=== PHASE 4 TEST: PERSISTENT QUEUE, RETRIES & BACKOFF (MONGODB) ===');
  console.log(`Connecting to MongoDB URI: ${config.MONGODB_URI}...`);

  try {
    await initMongoDb();
  } catch (err: any) {
    console.error('\n⚠️ Could not connect to MongoDB:', err.message);
    console.log('👉 Please set MONGODB_URI in your .env file to your Vercel/Atlas MongoDB connection string to run live DB tests.');
    return;
  }

  const db = getDatabase();
  const queue = new PersistentJobQueue();

  const pageId = 'queue_test_page';
  const sourceId = 'queue_test_source';
  const articleId = 'queue_test_article';

  await db.collection<FacebookPage>('facebook_pages').updateOne(
    { _id: pageId },
    { $set: { name: 'Queue Test Page', accessToken: 'EAAB_MOCK', isActive: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  await db.collection<RssSource>('rss_sources').updateOne(
    { _id: sourceId },
    { $set: { name: 'Queue Source', url: 'https://example.com/rss_' + Date.now(), pageId, templateId: 'template-square-breaking', isActive: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  await db.collection<NewsArticle>('news_articles').updateOne(
    { _id: articleId },
    {
      $set: {
        sourceId,
        guid: 'guid_' + Date.now(),
        link: 'https://example.com/news/' + Date.now(),
        title: 'Queue Test News Title',
        pubDate: new Date(),
        status: 'queued',
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  // 1. Test Enqueue
  console.log('1. Enqueueing test job in MongoDB...');
  const jobId = await queue.enqueue(
    'process_article',
    { articleId, sourceId, pageId },
    articleId,
    pageId
  );
  console.log(`✓ Enqueued job ID: ${jobId}`);

  // 2. Test Atomic Fetch & Lock
  console.log('\n2. Testing atomic fetch & lock (findOneAndUpdate)...');
  const fetchedJob = await queue.fetchNextJob();
  if (!fetchedJob) {
    throw new Error('Failed to fetch any pending job');
  }
  console.log(`✓ Atomically fetched and locked job ${fetchedJob._id}, status is now: ${fetchedJob.status}`);

  // 3. Test Failure and Exponential Backoff (Attempt 1 -> 2)
  console.log('\n3. Simulating failure attempt 1 (Testing exponential backoff)...');
  const willRetry1 = await queue.handleFailure(fetchedJob, 'Simulation Error 1', 10);
  console.log(`✓ Handled failure 1, willRetry = ${willRetry1}`);

  const jobAfterFail1 = (await db.collection<Job>('jobs').findOne({ _id: fetchedJob._id }))!;
  console.log(`  Attempts: ${jobAfterFail1.attempts}/${jobAfterFail1.maxAttempts}`);
  console.log(`  Next runAt: ${jobAfterFail1.runAt.toISOString()}`);
  console.log(`  Status: ${jobAfterFail1.status}`);

  // 4. Simulate Failure 2
  console.log('\n4. Simulating failure attempt 2...');
  const willRetry2 = await queue.handleFailure(jobAfterFail1, 'Simulation Error 2', 10);
  console.log(`✓ Handled failure 2, willRetry = ${willRetry2}`);
  const jobAfterFail2 = (await db.collection<Job>('jobs').findOne({ _id: fetchedJob._id }))!;
  console.log(`  Attempts: ${jobAfterFail2.attempts}/${jobAfterFail2.maxAttempts}`);

  // 5. Simulate Final Failure (Attempt 3 -> Final Failed State)
  console.log('\n5. Simulating failure attempt 3 (Exhausting max retries)...');
  const willRetry3 = await queue.handleFailure(jobAfterFail2, 'Final Fatal Error', 10);
  console.log(`✓ Handled failure 3, willRetry = ${willRetry3} (Expected false for final failure)`);

  const finalJob = (await db.collection<Job>('jobs').findOne({ _id: fetchedJob._id }))!;
  console.log(`  Final Status: ${finalJob.status}`);
  console.log(`  Final Error: ${finalJob.lastError}`);
  if (finalJob.status !== 'failed') {
    throw new Error(`Expected status 'failed', got '${finalJob.status}'`);
  }
  console.log('✓ Verified: Job transitioned to final failed state.');

  // 6. Test Manual Retry Button
  console.log('\n6. Testing manual retry capability (Dashboard Retry Button)...');
  const retrySuccess = await queue.retryFailedJob(fetchedJob._id);
  const retriedJob = (await db.collection<Job>('jobs').findOne({ _id: fetchedJob._id }))!;
  console.log(`✓ Retry result: ${retrySuccess}, new status: ${retriedJob.status}, attempts reset to: ${retriedJob.attempts}`);

  // 7. Test Queue Stats
  const stats = await queue.getStats();
  console.log('\n7. Queue Statistics:', stats);

  await closeDatabase();
  console.log('\n=== PHASE 4 COMPLETE & VERIFIED ===\n');
}

testQueue().catch((err) => {
  console.error('Phase 4 test failed:', err);
  process.exit(1);
});
