import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { initDatabase, getDatabase, setDatabaseInstance } from '../src/db/index.js';
import { FileDatabase } from '../src/db/file-db.js';
import { InputPipelineService } from '../src/services/pipeline/input-pipeline.js';
import { GDriveReelService } from '../src/services/gdrive/service.js';
import { RssSource, GDriveReelConfig } from '../src/db/schema.js';
import { config } from '../src/config/env.js';

async function testInputPipeline() {
  console.log('====================================================');
  console.log('🎬 TESTING INPUT CRON PIPELINE & REEL GENERATION');
  console.log('====================================================');

  // Setup isolated test file database
  const testDbDir = path.join(config.DATA_DIR, 'test_db_' + Date.now());
  const testDb = new FileDatabase(testDbDir);
  setDatabaseInstance(testDb);

  const testFolderId = '1TestFolderIdXYZ789';
  const testSourceId = 'src_test_news_1';

  // Seed test channel
  await testDb.collection<GDriveReelConfig>('gdrive_reel_configs').insertOne({
    _id: 'channel_test_1',
    name: 'Alisa Tech Studio',
    folderUrlOrId: `https://drive.google.com/drive/folders/${testFolderId}`,
    folderId: testFolderId,
    pageId: '1268359636369219',
    pageName: 'Alisa Tech Studio',
    isActive: true,
    scheduleIntervalHours: 2,
    cronExpression: '0 */2 * * *',
    category: 'auto',
    captionStrategy: 'viral_hashtags',
    orderStrategy: 'oldest_first',
    postedVideoIds: [],
    postedVideoNames: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Seed test RSS source
  await testDb.collection<RssSource>('rss_sources').insertOne({
    _id: testSourceId,
    name: 'Al Jazeera News',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    pageId: '1268359636369219',
    isActive: true,
    reelDuration: 3, // Fast 3-second render for unit testing
    reelTheme: 'headline-card',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const pipeline = new InputPipelineService();

  // Test 1: Resolve Drive Folder
  console.log('\n[Test 1] Testing Folder Resolution for RSS Source...');
  const sourceDoc = await testDb.collection<RssSource>('rss_sources').findOne({ _id: testSourceId });
  assert.ok(sourceDoc, 'Source doc must exist');
  const folderInfo = await pipeline.resolveDriveFolderForSource(sourceDoc!);
  console.log('✓ Resolved folder info:', folderInfo);
  assert.strictEqual(folderInfo.folderId, testFolderId, 'Must resolve to the configured channel folder ID');

  // Test 2: Run Input Cron (First Run -> Render & Save)
  console.log('\n[Test 2] Running Input Cron (force: true, maxArticlesPerSource: 1)...');
  const result1 = await pipeline.runInputCron({
    sourceId: testSourceId,
    force: true,
    maxArticlesPerSource: 1,
  });

  console.log('✓ Input Cron run 1 result:', {
    success: result1.success,
    sourcesProcessed: result1.sourcesProcessed,
    totalFetched: result1.totalFetched,
    totalReelsCreated: result1.totalReelsCreated,
    totalUploadedToDrive: result1.totalUploadedToDrive,
    articles: result1.results[0]?.articles,
  });

  assert.strictEqual(result1.success, true, 'Input Cron must succeed');
  assert.ok(result1.totalFetched > 0, 'Must have fetched articles from RSS');
  assert.strictEqual(result1.totalReelsCreated, 1, 'Must have created 1 reel video');
  assert.strictEqual(result1.totalUploadedToDrive, 1, 'Must have uploaded 1 reel to Drive folder');

  // Verify file in staged drive folder
  const stagedDir = path.join(config.DATA_DIR, 'gdrive_folders', testFolderId);
  assert.strictEqual(fs.existsSync(stagedDir), true, 'Staged Drive folder directory must exist');
  const stagedFiles = fs.readdirSync(stagedDir);
  assert.ok(stagedFiles.length >= 1, 'Drive folder must contain at least 1 saved .mp4 video');
  console.log('✓ Found saved reel in drive folder:', stagedFiles[0]);

  // Verify database record
  const savedArticles = await testDb.collection('news_articles').find({}).toArray();
  assert.strictEqual(savedArticles.length, 1, 'Must have saved 1 article in database');
  assert.strictEqual(savedArticles[0].status, 'uploaded_to_drive', 'Article status must be uploaded_to_drive');
  assert.ok(savedArticles[0].gdriveFileId, 'Article must have gdriveFileId');
  console.log('✓ Verified article record in DB with status:', savedArticles[0].status, 'ID:', savedArticles[0].gdriveFileId);

  // Test 3: Deduplication Test (Second Run -> Duplicate Detected)
  console.log('\n[Test 3] Running Input Cron again without force (should detect duplicate)...');
  const result2 = await pipeline.runInputCron({
    sourceId: testSourceId,
    force: false,
    maxArticlesPerSource: 1,
  });

  console.log('✓ Input Cron run 2 result:', {
    success: result2.success,
    reelsCreated: result2.totalReelsCreated,
    uploadedToDrive: result2.totalUploadedToDrive,
    skippedDuplicate: result2.results[0]?.skippedDuplicate,
  });

  assert.ok((result2.results[0]?.skippedDuplicate || 0) >= 1, 'First article must be detected as duplicate and skipped');

  // Test 4: Unrendered Article Recovery Test
  console.log('\n[Test 4] Testing recovery of an unrendered article (status: ingested)...');
  const latestArticle = await testDb.collection('news_articles').findOne({}, { sort: { createdAt: -1 } });
  assert.ok(latestArticle, 'Latest article must exist');

  // Mark the article as 'ingested' with no gdriveFileId to simulate a previous crash/failure
  await testDb.collection('news_articles').updateOne(
    { _id: latestArticle!._id },
    { $set: { status: 'ingested', gdriveFileId: null } }
  );

  const result3 = await pipeline.runInputCron({
    sourceId: testSourceId,
    force: false,
    maxArticlesPerSource: 1,
  });

  console.log('✓ Recovery run result:', {
    success: result3.success,
    reelsCreated: result3.totalReelsCreated,
    uploadedToDrive: result3.totalUploadedToDrive,
  });

  assert.strictEqual(result3.totalReelsCreated, 1, 'Previously failed/unrendered article must be rendered and uploaded!');
  assert.strictEqual(result3.totalUploadedToDrive, 1, 'Recovered article must be saved to Drive folder!');

  // Verify updated status
  const recoveredDoc = await testDb.collection('news_articles').findOne({ _id: latestArticle!._id });
  assert.strictEqual(recoveredDoc?.status, 'uploaded_to_drive', 'Recovered article must now be uploaded_to_drive');
  assert.ok(recoveredDoc?.gdriveFileId, 'Recovered article must have gdriveFileId');

  // Test 5: Split Input Cron (Feed + Drive Folder Wise)
  console.log('\n[Test 5] Testing Split Input Cron across multiple feeds & Drive folders...');
  const testFolderId2 = '2SecondFolderIdABC456';
  const testSourceId2 = 'src_test_news_2';

  // Seed second RSS source with its own dedicated folder
  await testDb.collection<RssSource>('rss_sources').insertOne({
    _id: testSourceId2,
    name: 'BBC World News',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    gdriveFolderUrlOrId: `https://drive.google.com/drive/folders/${testFolderId2}`,
    gdriveFolderId: testFolderId2,
    pageId: '1302276172975819',
    isActive: true,
    reelDuration: 3,
    reelTheme: 'headline-card',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 5A: Dedicated Split Run for Source 2
  console.log('5A: Running isolated Input Cron specifically for Source 2 (feed-wise)...');
  const splitResSource2 = await pipeline.runInputCron({
    sourceId: testSourceId2,
    force: true,
    maxArticlesPerSource: 1,
  });

  assert.strictEqual(splitResSource2.success, true, 'Split cron for Source 2 must succeed');
  assert.strictEqual(splitResSource2.sourcesProcessed, 1, 'Must process ONLY the targeted Source 2');
  assert.strictEqual(splitResSource2.results[0].sourceId, testSourceId2, 'Processed source must be Source 2');
  assert.strictEqual(splitResSource2.results[0].folderId, testFolderId2, 'Must upload to Source 2 dedicated folder');
  console.log('✓ Verified isolated execution for Source 2 -> Folder 2:', splitResSource2.results[0].folderId);

  // 5B: Dedicated Split Run by Folder ID
  console.log('5B: Running isolated Input Cron by Folder ID (folder-wise)...');
  const splitResFolder1 = await pipeline.runInputCron({
    folderId: testFolderId,
    force: true,
    maxArticlesPerSource: 1,
  });
  assert.strictEqual(splitResFolder1.success, true, 'Split cron for Folder 1 must succeed');
  assert.strictEqual(splitResFolder1.sourcesProcessed, 1, 'Must process ONLY source linked to Folder 1');
  assert.strictEqual(splitResFolder1.results[0].folderId, testFolderId, 'Target folder must match Folder 1');
  console.log('✓ Verified isolated execution by Folder ID:', splitResFolder1.results[0].folderId);

  // 5C: Auto Round-Robin Single-Feed Mode (when no source is specified among multiple feeds)
  console.log('5C: Testing Auto Round-Robin single feed execution to prevent timeouts...');
  const roundRobinRes = await pipeline.runInputCron({
    force: true,
    maxArticlesPerSource: 1,
  });
  assert.strictEqual(roundRobinRes.success, true, 'Round-robin run must succeed');
  assert.strictEqual(roundRobinRes.sourcesProcessed, 1, 'Generic run must process exactly 1 feed at a time to prevent serverless timeout!');
  console.log('✓ Verified safe single-feed round-robin execution:', roundRobinRes.results[0].sourceName);

  // Cleanup test files
  try {
    for (const f of stagedFiles) {
      fs.unlinkSync(path.join(stagedDir, f));
    }
    fs.rmdirSync(stagedDir);
    const stagedDir2 = path.join(config.DATA_DIR, 'gdrive_folders', testFolderId2);
    if (fs.existsSync(stagedDir2)) {
      const files2 = fs.readdirSync(stagedDir2);
      for (const f of files2) fs.unlinkSync(path.join(stagedDir2, f));
      fs.rmdirSync(stagedDir2);
    }
    fs.rmSync(testDbDir, { recursive: true, force: true });
  } catch {}

  console.log('\n====================================================');
  console.log('🎉 ALL INPUT CRON PIPELINE & REEL TESTS PASSED!');
  console.log('====================================================');
  process.exit(0);
}

testInputPipeline().catch((err) => {
  console.error('❌ Input pipeline test failed:', err);
  process.exit(1);
});
