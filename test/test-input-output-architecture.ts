import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { GDriveReelService } from '../src/services/gdrive/service.js';
import { TikTokClient } from '../src/services/tiktok/client.js';
import { InputPipelineService } from '../src/services/pipeline/input-pipeline.js';
import { PipelineCoordinator } from '../src/services/pipeline/coordinator.js';
import { config } from '../src/config/env.js';

async function runArchitectureTests() {
  console.log('====================================================');
  console.log('🧪 TESTING NEW 2-STAGE AUTOMATION ARCHITECTURE');
  console.log('====================================================');

  // Test 1: TikTok Client
  console.log('\n[Test 1] Testing TikTok Client (Safe Simulated Mode)...');
  const tikTokClient = new TikTokClient();
  const mockVideoBuffer = Buffer.from('Mock MP4 video binary content for automated testing');
  const tikResult = await tikTokClient.uploadVideo({
    videoBuffer: mockVideoBuffer,
    title: 'Test Headline for TikTok',
    tags: ['#Trending', '#ViralNews'],
    isEnglish: true,
  }, true);

  assert.strictEqual(tikResult.success, true, 'TikTok upload should succeed in simulated mode');
  assert.strictEqual(tikResult.isDryRun, true, 'TikTok upload should be marked as dry run');
  console.log('✓ TikTok Client simulated upload verified:', tikResult);

  // Test 2: GDriveReelService Folder Upload & Local Fallback
  console.log('\n[Test 2] Testing Google Drive Video Staging & Upload...');
  const gdriveService = new GDriveReelService();
  const testFolderId = 'test_source_folder_123';
  const testFilename = 'Test_News_Reel_Breaking_Hashtags.mp4';

  const uploadResult = await gdriveService.uploadVideoToFolder({
    folderId: testFolderId,
    videoBuffer: mockVideoBuffer,
    filename: testFilename,
  });

  assert.strictEqual(uploadResult.success, true, 'Upload to folder should succeed');
  assert.ok(uploadResult.fileId, 'File ID must be generated');

  const stagedLocalPath = path.join(config.DATA_DIR, 'gdrive_folders', testFolderId, testFilename);
  assert.strictEqual(fs.existsSync(stagedLocalPath), true, 'Staged local fallback video must exist on disk');
  console.log('✓ Google Drive folder upload and local staging verified:', uploadResult);

  // Test 3: GDriveReelService Scanning (Folder-wise)
  console.log('\n[Test 3] Testing Folder-wise Scanning & Oldest-First Sequence...');
  const scanResult = await gdriveService.scanFolderDirect(testFolderId, undefined, {
    _id: 'test_conf',
    folderUrlOrId: testFolderId,
    folderId: testFolderId,
    pageId: '123',
    isActive: true,
    scheduleIntervalHours: 2,
    captionStrategy: 'viral_hashtags',
    orderStrategy: 'oldest_first',
    postedVideoIds: [],
    postedVideoNames: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.strictEqual(scanResult.folderId, testFolderId, 'Scanned folderId must match');
  assert.ok(scanResult.videos.length > 0, 'Scan must find the staged video file');
  const foundVideo = scanResult.videos.find((v) => v.name === testFilename);
  assert.ok(foundVideo, 'Found video must match filename');
  assert.strictEqual(foundVideo?.isPosted, false, 'Video must be marked unposted');
  console.log(`✓ Folder-wise scanning verified: Found ${scanResult.totalVideos} videos (${scanResult.pendingCount} pending)`);

  // Test 4: PipelineCoordinator Status & Methods (Zero Internal Cron)
  console.log('\n[Test 4] Testing Pipeline Coordinator Status (Zero Internal Crons)...');
  const coordinator = new PipelineCoordinator();
  const status = coordinator.getStatus();
  assert.ok(status.inputCronSchedule, 'Coordinator must provide input cron schedule info');
  assert.strictEqual(status.inputCronActive, false, 'Internal cron must be completely inactive / deleted');
  console.log('✓ Pipeline Coordinator status verified (100% External Webhook Driven):', status);

  // Clean up test file
  if (fs.existsSync(stagedLocalPath)) {
    fs.unlinkSync(stagedLocalPath);
    try {
      fs.rmdirSync(path.join(config.DATA_DIR, 'gdrive_folders', testFolderId));
    } catch {}
  }

  console.log('\n====================================================');
  console.log('🎉 ALL ARCHITECTURE UNIT & INTEGRATION TESTS PASSED!');
  console.log('====================================================');
}

runArchitectureTests().catch((err) => {
  console.error('❌ Architecture test failed:', err);
  process.exit(1);
});

