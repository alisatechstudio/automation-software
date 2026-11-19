import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase } from '../dist/db/index.js';
import { ReelVideoRenderer } from '../dist/services/renderer/reel.js';
import { GDriveReelService } from '../dist/services/gdrive/service.js';

function sanitizeFilename(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

async function main() {
  console.log('🚀 Starting Reel creation for BD News Site...');
  const startTime = Date.now();

  // 1. Initialize DB and find latest article
  const db = await initDatabase();
  const article = await db.collection('news_articles').findOne(
    {
      $or: [
        { link: { $regex: /bdnews\.site/i } },
        { imageUrl: { $regex: /bdnews\.site/i } },
        { sourceName: { $regex: /bd\s*news/i } }
      ]
    },
    { sort: { pubDate: -1, createdAt: -1 } }
  );

  if (!article) {
    throw new Error('No article found for BD News Site!');
  }

  console.log(`📰 Selected Article: "${article.title}"`);
  console.log(`🏷️ Category: ${article.category || 'বাংলাদেশ'}`);
  console.log(`🖼️ Image URL: ${article.imageUrl || 'None'}`);

  // 2. Render Reel using ReelVideoRenderer
  console.log('🎬 Rendering 9:16 vertical video reel with Edge TTS voiceover and Canvas animations...');
  const renderer = new ReelVideoRenderer();
  
  const reelBuffer = await renderer.renderReel({
    headline: article.title,
    category: article.category || 'বিনোদন',
    imageUrl: article.imageUrl || undefined,
    theme: 'cat-entertainment',
    durationSeconds: 25,
    fps: 24,
    website: 'bdnews.site',
    isEnglish: false,
    pageName: 'BD News 24/7- বিডি নিউজ ২৪/৭',
    description: article.description || undefined,
  });

  if (!reelBuffer || reelBuffer.length === 0) {
    throw new Error('Reel rendering failed: buffer is empty');
  }

  console.log(`✅ Reel rendered successfully! Size: ${(reelBuffer.length / (1024 * 1024)).toFixed(2)} MB (${reelBuffer.length} bytes)`);

  // 3. Save locally in data/rendered
  const cleanTitle = sanitizeFilename(article.title);
  const filename = `${cleanTitle} #Shorts.mp4`;

  const renderedDir = path.resolve('data/rendered');
  if (!fs.existsSync(renderedDir)) fs.mkdirSync(renderedDir, { recursive: true });
  const localRenderPath = path.join(renderedDir, filename);
  fs.writeFileSync(localRenderPath, reelBuffer);
  console.log(`💾 Saved local copy at: ${localRenderPath}`);

  // 4. Target Google Drive folder for BD News Site
  const targetFolderId = '1BiCbgwkRVS-XHt92MXcwuOEcbKjtgRq8';
  console.log(`☁️ Uploading reel to Google Drive folder: "${targetFolderId}" (BD News Site)...`);

  const gdriveService = new GDriveReelService();
  const uploadResult = await gdriveService.uploadVideoToFolder({
    folderId: targetFolderId,
    videoBuffer: reelBuffer,
    filename: filename,
    mimeType: 'video/mp4'
  });

  console.log('\n================ UPLOAD RESULT ================');
  console.log(`Success: ${uploadResult.success}`);
  console.log(`Filename: ${uploadResult.filename}`);
  console.log(`File ID: ${uploadResult.fileId || 'N/A'}`);
  console.log(`WebView Link: ${uploadResult.webViewLink || 'N/A'}`);
  console.log(`Local Fallback: ${uploadResult.isLocalFallback}`);
  if (uploadResult.error) {
    console.error(`Error: ${uploadResult.error}`);
  }
  console.log(`Total Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log('================================================\n');

  setTimeout(() => process.exit(0), 1000);
}

main().catch(err => {
  console.error('❌ Failed:', err);
  setTimeout(() => process.exit(1), 1000);
});
