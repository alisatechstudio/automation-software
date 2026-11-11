import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { FacebookGraphClient } from '../src/services/facebook/client.js';
import { GDriveReelService } from '../src/services/gdrive/service.js';
import { QueueWorker } from '../src/services/queue/worker.js';
import { FileDatabase } from '../src/db/file-db.js';
import { setDatabaseInstance } from '../src/db/index.js';
import { NewsArticle, FacebookPage, GDriveReelConfig, ReelLog } from '../src/db/schema.js';
import { config } from '../src/config/env.js';

async function runReelCommentingTests() {
  console.log('====================================================');
  console.log('💬 TESTING FACEBOOK REEL NEWS URL COMMENTING PIPELINE');
  console.log('====================================================');

  // Enable safe dry run mode for test execution
  (config as any).DRY_RUN = true;

  const fbClient = new FacebookGraphClient('v21.0');

  // --------------------------------------------------------------------------
  // Test 1: First Comment Formatting with News Article URL
  // --------------------------------------------------------------------------
  console.log('\n[Test 1] Testing Facebook First Comment Formatting...');

  const bengaliNewsUrl = 'https://www.prothomalo.com/bangladesh/district/weather-chittagong-winter-2026';
  const bnComment = fbClient.formatComment(bengaliNewsUrl);
  console.log('Generated Bengali Comment:\n', bnComment);

  assert.ok(bnComment.includes(bengaliNewsUrl), 'Bengali comment must include the news URL');
  assert.ok(bnComment.includes('👉'), 'Bengali comment must include the click pointer');
  assert.ok(bnComment.includes('সম্পূর্ণ প্রতিবেদন') || bnComment.includes('বিস্তারিত'), 'Bengali comment must include Bengali CTA');

  const englishNewsUrl = 'https://trendingnews.world/world/tech-breakthrough-ai-agents';
  const enComment = fbClient.formatComment(englishNewsUrl);
  console.log('\nGenerated English Comment:\n', enComment);

  assert.ok(enComment.includes(englishNewsUrl), 'English comment must include the news URL');
  assert.ok(enComment.includes('Read the full story'), 'English comment must include English CTA');

  // Custom template with {url}
  const customTpl = '🔗 সব তথ্য ও লাইভ আপডেট: {url} | শেয়ার করুন';
  const formattedCustom = fbClient.formatComment(bengaliNewsUrl, customTpl);
  assert.ok(formattedCustom.includes(bengaliNewsUrl), 'Custom template must substitute {url}');
  assert.strictEqual(formattedCustom.includes('{url}'), false, '{url} placeholder must be replaced');

  // Custom template without {url}
  const customTplNoUrl = '🔥 বিস্তারিত পড়তে ভিজিট করুন আমাদের ওয়েব পোর্টাল:';
  const formattedNoUrl = fbClient.formatComment(bengaliNewsUrl, customTplNoUrl);
  assert.ok(formattedNoUrl.includes(bengaliNewsUrl), 'Must append news URL when placeholder is omitted');
  assert.ok(formattedNoUrl.includes('👉'), 'Must include pointer with appended URL');

  // Empty news URL handling
  const emptyComment = fbClient.formatComment('');
  assert.strictEqual(emptyComment, '', 'Empty news URL must return empty string');
  console.log('✓ Test 1 passed: All comment formatting scenarios verified.');

  // --------------------------------------------------------------------------
  // Test 2: Target Post & Video ID Candidate Resolution
  // --------------------------------------------------------------------------
  console.log('\n[Test 2] Testing Candidate ID Resolution & Dry-Run Commenting...');

  const mockVideoId = '987654321012345';
  const mockPageId = '1526917347161119';
  const mockPostId = `${mockPageId}_${mockVideoId}`;

  // Testing dry run on numeric Reel video ID
  const dryRunRes1 = await fbClient.publishComment(
    mockVideoId,
    'MOCK_ACCESS_TOKEN',
    bnComment,
    true,
    mockPostId
  );
  assert.ok(dryRunRes1.commentId, 'Dry run should return mock commentId');
  assert.ok(dryRunRes1.commentId.startsWith('dryrun_comment_'), 'Mock commentId must start with dryrun_comment_');

  // Testing dry run with composite ID (should resolve and post to extracted numeric ID)
  const dryRunRes2 = await fbClient.publishComment(
    mockPostId,
    'MOCK_ACCESS_TOKEN',
    bnComment,
    true
  );
  assert.ok(dryRunRes2.commentId, 'Composite ID dry run should succeed');

  // Empty comment text should be safely rejected without calling Facebook API
  const dryRunEmpty = await fbClient.publishComment(mockVideoId, 'MOCK_TOKEN', '', true);
  assert.strictEqual(dryRunEmpty.commentId, '', 'Empty comment text must return empty string');
  console.log('✓ Test 2 passed: Candidate resolution and dry-run comments verified.');

  // --------------------------------------------------------------------------
  // Test 3: QueueWorker resolveCommentUrl
  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Testing QueueWorker resolveCommentUrl...');

  const testDbDir = path.join(config.DATA_DIR, 'test_db_commenting_' + Date.now());
  const testDb = new FileDatabase(testDbDir);
  setDatabaseInstance(testDb);

  const worker = new QueueWorker();

  const articleWithProthomAloLink: NewsArticle = {
    _id: 'art_prothomalo_1',
    sourceId: 'src_1',
    guid: 'guid_123',
    link: 'https://www.prothomalo.com/bangladesh/sample-news-story-123',
    title: 'নমুনা সংবাদ প্রতিবেদন',
    pubDate: new Date(),
    status: 'ingested',
  };

  const resolvedUrl = await worker.resolveCommentUrl(articleWithProthomAloLink, false, testDb);
  console.log('Resolved Comment URL for article:', resolvedUrl);
  assert.strictEqual(resolvedUrl, articleWithProthomAloLink.link, 'Should return the exact article news URL');

  const articleWithoutLink: NewsArticle = {
    _id: 'art_no_link',
    sourceId: 'src_2',
    guid: 'guid_456',
    link: '',
    title: 'সংবাদ শিরোনাম',
    pubDate: new Date(),
    status: 'ingested',
  };
  const resolvedFallback = await worker.resolveCommentUrl(articleWithoutLink, false, testDb);
  assert.strictEqual(resolvedFallback, 'https://bdnews.site', 'Should fallback to default portal domain');
  console.log('✓ Test 3 passed: resolveCommentUrl properly preserves direct article news link.');

  // --------------------------------------------------------------------------
  // Test 4: GDriveReelService Stage 2 Publishing with News URL Commenting
  // --------------------------------------------------------------------------
  console.log('\n[Test 4] Testing GDriveReelService Stage 2 Reel Publishing & Comment Injection...');

  const testFolderId = '1FolderReelsTest789';
  const gdriveFileId = '1DriveFileMockId12345';
  const videoHeadline = 'চট্টগ্রামে শীতের তীব্রতা বাড়ার পূর্বাভাস';
  const videoFilename = `${videoHeadline} #Shorts.mp4`;

  // Seed Facebook Page
  await testDb.collection<FacebookPage>('facebook_pages').insertOne({
    _id: mockPageId,
    name: 'BD News Site Page',
    accessToken: 'EAAMockTokenForTesting',
    category: 'News',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Seed GDrive Reel Channel
  await testDb.collection<GDriveReelConfig>('gdrive_reel_configs').insertOne({
    _id: 'channel_bdnews',
    name: 'BD News Channel',
    folderUrlOrId: testFolderId,
    folderId: testFolderId,
    pageId: mockPageId,
    pageName: 'BD News Site Page',
    isActive: true,
    scheduleIntervalHours: 2,
    orderStrategy: 'oldest_first',
    firstCommentText: '', // Empty: should auto-generate high-CTR comment with news URL
    postedVideoIds: [],
    postedVideoNames: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const gdriveService = new GDriveReelService();

  // Upload video via uploadVideoToFolder (staged to local drive folder fallback)
  const uploadRes = await gdriveService.uploadVideoToFolder({
    folderId: testFolderId,
    videoBuffer: Buffer.from('Mock MP4 video content for reel commenting test'),
    filename: videoFilename,
  });

  assert.strictEqual(uploadRes.success, true, 'Video upload to staged folder must succeed');
  const targetFileId = uploadRes.fileId || `local_${videoFilename}`;

  // Seed NewsArticle originated from RSS or Input Cron with matching gdriveFileId and title
  const articleTargetUrl = 'https://www.prothomalo.com/bangladesh/weather-chittagong-winter-2026';
  await testDb.collection<NewsArticle>('news_articles').insertOne({
    _id: 'art_target_weather',
    sourceId: 'src_weather',
    guid: 'guid_weather_999',
    link: articleTargetUrl,
    title: videoHeadline,
    category: 'জাতীয়',
    pubDate: new Date(),
    status: 'uploaded_to_drive',
    gdriveFileId: targetFileId,
    gdriveFolderId: testFolderId,
  });

  // Execute channel publish (Dry Run)
  console.log(`Executing publishSpecificFileForChannel for video "${videoFilename}" (File ID: ${targetFileId})...`);
  const publishRes = await gdriveService.publishSpecificFileForChannel(
    'channel_bdnews',
    targetFileId
  );

  console.log('Publish result:', publishRes);
  assert.strictEqual(publishRes.success, true, 'GDrive publishVideo should succeed');

  // Verify ReelLog recorded the first comment with the news URL
  const reelLog = await testDb.collection<ReelLog>('reel_logs').findOne({
    articleTitle: videoHeadline,
  });

  assert.ok(reelLog, 'ReelLog must be created');
  console.log('\nLogged Reel Record:');
  console.log('  Video ID:', reelLog.fbVideoId);
  console.log('  Post ID:', reelLog.fbPostId);
  console.log('  Status:', reelLog.status);
  console.log('  First Comment:', (reelLog as any).comment);
  console.log('  Comment ID:', (reelLog as any).fbCommentId);

  assert.ok((reelLog as any).comment, 'ReelLog must store the first comment');
  assert.ok((reelLog as any).comment.includes(articleTargetUrl), 'First comment must contain the actual news article URL');
  assert.ok((reelLog as any).comment.includes('👉'), 'First comment must contain the CTA pointer');
  console.log('✓ Test 4 passed: GDrive Stage 2 publishing automatically found news URL and added first comment!');

  // Cleanup test files
  try {
    if (fs.existsSync(stagedVideoPath)) fs.unlinkSync(stagedVideoPath);
    if (fs.existsSync(stagedDir)) fs.rmdirSync(stagedDir);
    if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });
  } catch {}

  console.log('\n====================================================');
  console.log('🎉 ALL REEL NEWS URL COMMENTING TESTS PASSED (100%)!');
  console.log('====================================================\n');
}

runReelCommentingTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
