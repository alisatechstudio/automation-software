import { getDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrator.js';
import { ArticleDedupeService } from '../src/services/rss/dedupe.js';
import { QueueWorker } from '../src/services/queue/worker.js';
import { createServer } from '../src/server/app.js';
import { config } from '../src/config/env.js';

async function testEndToEnd() {
  console.log('===============================================================');
  console.log('🧪 END-TO-END VERIFICATION: FULL NEWS-TO-FACEBOOK PIPELINE');
  console.log('===============================================================');

  // Ensure DRY_RUN is active for test
  config.DRY_RUN = true;

  // 1. Database Migrations
  console.log('\n[Step 1] Initializing Database & Migrations...');
  runMigrations();
  const db = getDatabase();

  // 2. Setup Test Page and RSS Source
  console.log('\n[Step 2] Configuring Test Facebook Page & RSS Source...');
  const pageId = 'page_bd_news_live';
  const pageName = 'Daily Bangla News 24';
  const mockToken = 'EAAB...VALID_LONG_LIVED_TOKEN...';

  db.prepare(`
    INSERT OR REPLACE INTO facebook_pages (id, name, access_token, is_active)
    VALUES (?, ?, ?, 1)
  `).run(pageId, pageName, mockToken);

  const sourceId = 'source_bbc_live_' + Date.now();
  const rssUrl = 'https://feeds.bbci.co.uk/bengali/rss.xml';

  db.prepare(`
    INSERT INTO rss_sources (id, name, url, page_id, template_id, is_active)
    VALUES (?, 'BBC Bangla Live', ?, ?, 'template-square-breaking', 1)
  `).run(sourceId, rssUrl, pageId);

  const source = db.prepare('SELECT * FROM rss_sources WHERE id = ?').get(sourceId) as any;

  // 3. Poll RSS and Ingest Items
  console.log('\n[Step 3] Ingesting RSS items and verifying Deduplication...');
  const dedupeService = new ArticleDedupeService();
  const ingestion = await dedupeService.pollSource(source);
  console.log('Ingestion Summary:', ingestion);

  // 4. Fetch the newly queued job for this source (Oldest first)
  console.log('\n[Step 4] Fetching next pending job for this live source...');
  let job = db.prepare(`
    SELECT j.*, a.title as article_title
    FROM jobs j
    JOIN news_articles a ON j.article_id = a.id
    WHERE a.source_id = ? AND j.status = 'pending'
    ORDER BY datetime(a.pub_date) ASC
    LIMIT 1
  `).get(sourceId) as any;

  if (!job) {
    // If all items were duplicates from earlier tests, pick any article belonging to bbc
    job = db.prepare(`
      SELECT j.*, a.title as article_title
      FROM jobs j
      JOIN news_articles a ON j.article_id = a.id
      WHERE a.source_id LIKE 'source_bbc%' AND j.article_id IS NOT NULL
      ORDER BY j.created_at DESC
      LIMIT 1
    `).get() as any;

    // Reset its status to pending
    if (job) {
      db.prepare("UPDATE jobs SET status = 'pending' WHERE id = ?").run(job.id);
    }
  }

  if (!job) {
    throw new Error('No pending jobs found for test');
  }

  // Atomically set to processing
  db.prepare("UPDATE jobs SET status = 'processing' WHERE id = ?").run(job.id);
  job.status = 'processing';

  console.log(`✓ Fetched Job ID: ${job.id}`);
  console.log(`  Article: "${job.article_title}"`);

  // 5. Process job with Queue Worker (Renders image + publishes photo + adds comment)
  console.log('\n[Step 5] Executing Queue Worker Pipeline (Render ➔ Publish Photo ➔ Publish Comment)...');
  const worker = new QueueWorker();
  await worker.processJob(job);

  // 6. Verify Post Log and Article Status
  console.log('\n[Step 6] Verifying Results in Database...');
  const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id) as any;
  const article = db.prepare('SELECT * FROM news_articles WHERE id = ?').get(job.article_id) as any;
  const postLog = db.prepare('SELECT * FROM post_logs WHERE article_id = ? ORDER BY created_at DESC LIMIT 1').get(job.article_id) as any;

  console.log(`  Job Status: ${updatedJob.status} (Expected: 'completed')`);
  console.log(`  Article Status: ${article.status} (Expected: 'published')`);
  console.log(`  Rendered Image: ${postLog.rendered_image_path}`);
  console.log(`  Photo ID: ${postLog.fb_photo_id}`);
  console.log(`  Post ID: ${postLog.fb_post_id}`);
  console.log(`  Comment ID: ${postLog.fb_comment_id}`);
  console.log(`  Duration: ${postLog.duration_ms}ms`);
  console.log('\n  First Comment:');
  console.log(`  "${postLog.comment}"`);

  if (updatedJob.status !== 'completed' || article.status !== 'published') {
    throw new Error('Pipeline did not complete successfully!');
  }

  // 7. Verify Health Check Endpoint
  console.log('\n[Step 7] Testing Web Server Health Endpoint (/health)...');
  const app = createServer();
  const testServer = app.listen(3099, async () => {
    try {
      const res = await fetch('http://localhost:3099/health');
      const healthData = await res.json();
      console.log('Health Check Response:\n', JSON.stringify(healthData, null, 2));
      testServer.close();

      console.log('\n===============================================================');
      console.log('✅ ALL PHASES VERIFIED: COMPLETE END-TO-END PIPELINE WORKING!');
      console.log('===============================================================\n');
      process.exit(0);
    } catch (err) {
      testServer.close();
      throw err;
    }
  });
}

testEndToEnd().catch((err) => {
  console.error('End-to-End Test Failed:', err);
  process.exit(1);
});
