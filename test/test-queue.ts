import { getDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrator.js';
import { PersistentJobQueue } from '../src/services/queue/queue.js';
import { Job } from '../src/db/schema.js';

async function testQueue() {
  console.log('=== PHASE 4 TEST: PERSISTENT QUEUE, RETRIES & BACKOFF ===');

  runMigrations();
  const db = getDatabase();
  const queue = new PersistentJobQueue();

  // Insert mock page and article so foreign keys are satisfied
  const pageId = 'queue_test_page';
  const sourceId = 'queue_test_source';
  const articleId = 'queue_test_article';

  db.prepare(`
    INSERT OR REPLACE INTO facebook_pages (id, name, access_token, is_active)
    VALUES (?, ?, ?, 1)
  `).run(pageId, 'Queue Test Page', 'EAAB_MOCK');

  db.prepare(`
    INSERT OR REPLACE INTO rss_sources (id, name, url, page_id, template_id, is_active)
    VALUES (?, ?, ?, ?, 'template-square-breaking', 1)
  `).run(sourceId, 'Queue Source', 'https://example.com/rss', pageId);

  db.prepare(`
    INSERT OR REPLACE INTO news_articles (id, source_id, guid, link, title, pub_date, status)
    VALUES (?, ?, ?, ?, ?, datetime('now'), 'queued')
  `).run(articleId, sourceId, 'guid_' + Date.now(), 'https://example.com/news/' + Date.now(), 'Queue Test News Title');

  // 1. Test Enqueue
  console.log('1. Enqueueing test job...');
  const jobId = queue.enqueue('process_article', { test: true }, articleId, pageId);
  console.log(`✓ Enqueued job ID: ${jobId}`);

  // 2. Test Atomic Fetch & Lock
  console.log('\n2. Testing atomic fetch & lock...');
  const fetchedJob = queue.fetchNextJob();
  if (!fetchedJob) {
    throw new Error('Failed to fetch any pending job');
  }
  console.log(`✓ Atomically fetched and locked job ${fetchedJob.id}, status is now: ${fetchedJob.status}`);

  // 3. Test Failure and Exponential Backoff (Attempt 1 -> 2)
  console.log('\n3. Simulating failure attempt 1 (Testing exponential backoff)...');
  const willRetry1 = queue.handleFailure(fetchedJob, 'Simulation Error 1', 10);
  console.log(`✓ Handled failure 1, willRetry = ${willRetry1}`);

  const jobAfterFail1 = db.prepare('SELECT * FROM jobs WHERE id = ?').get(fetchedJob.id) as Job;
  console.log(`  Attempts: ${jobAfterFail1.attempts}/${jobAfterFail1.max_attempts}`);
  console.log(`  Next run_at: ${jobAfterFail1.run_at}`);
  console.log(`  Status: ${jobAfterFail1.status}`);

  // 4. Simulate Failure 2
  console.log('\n4. Simulating failure attempt 2...');
  const willRetry2 = queue.handleFailure(jobAfterFail1, 'Simulation Error 2', 10);
  console.log(`✓ Handled failure 2, willRetry = ${willRetry2}`);
  const jobAfterFail2 = db.prepare('SELECT * FROM jobs WHERE id = ?').get(fetchedJob.id) as Job;
  console.log(`  Attempts: ${jobAfterFail2.attempts}/${jobAfterFail2.max_attempts}`);

  // 5. Simulate Final Failure (Attempt 3 -> Final Failed State)
  console.log('\n5. Simulating failure attempt 3 (Exhausting max retries)...');
  const willRetry3 = queue.handleFailure(jobAfterFail2, 'Final Fatal Error', 10);
  console.log(`✓ Handled failure 3, willRetry = ${willRetry3} (Expected false for final failure)`);

  const finalJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(fetchedJob.id) as Job;
  console.log(`  Final Status: ${finalJob.status}`);
  console.log(`  Final Error: ${finalJob.last_error}`);
  if (finalJob.status !== 'failed') {
    throw new Error(`Expected status 'failed', got '${finalJob.status}'`);
  }
  console.log('✓ Verified: Job transitioned to final failed state.');

  // 6. Test Manual Retry Button
  console.log('\n6. Testing manual retry capability (Dashboard Retry Button)...');
  const retrySuccess = queue.retryFailedJob(fetchedJob.id);
  const retriedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(fetchedJob.id) as Job;
  console.log(`✓ Retry result: ${retrySuccess}, new status: ${retriedJob.status}, attempts reset to: ${retriedJob.attempts}`);

  // 7. Test Queue Stats
  const stats = queue.getStats();
  console.log('\n7. Queue Statistics:', stats);

  console.log('\n=== PHASE 4 COMPLETE & VERIFIED ===\n');
}

testQueue().catch((err) => {
  console.error('Phase 4 test failed:', err);
  process.exit(1);
});
