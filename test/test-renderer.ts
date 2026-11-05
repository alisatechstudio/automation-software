import fs from 'fs';
import path from 'path';
import { PlaywrightImageRenderer } from '../src/services/renderer/playwright.js';
import { TEMPLATES } from '../src/config/constants.js';

async function testRenderer() {
  console.log('=== PHASE 2 TEST: PLAYWRIGHT BANGLA IMAGE RENDERER ===');

  const renderer = new PlaywrightImageRenderer();

  try {
    // Test 1: Square Breaking News Template (1080x1080) with complex Bengali text
    console.log('1. Rendering Square Breaking News (1080x1080) with auto-fit headline...');
    const result1 = await renderer.render({
      templateId: TEMPLATES.SQUARE_BREAKING,
      headline: 'রিপাবলিকানদের ঘাঁটি এলাকায় ডেমোক্র্যাটদের নাটকীয় জয়: হোয়াইট হাউসের রাজনীতিতে নতুন মেরুকরণ ও আলোড়ন',
      category: 'আন্তর্জাতিক',
      dateText: 'বৃহস্পতিবার, ৫ নভেম্বর ২০২৬',
      imageUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1080&q=80',
    });

    console.log(`✓ Result 1 rendered: ${result1.outputPath} (${result1.width}x${result1.height}), size: ${result1.imageBuffer.length} bytes`);
    if (!fs.existsSync(result1.outputPath!)) {
      throw new Error(`Output file missing at ${result1.outputPath}`);
    }

    // Test 2: Editorial Modern Template (1080x1080) with missing image (tests fallback image)
    console.log('\n2. Rendering Square Editorial Modern (1080x1080) with fallback placeholder image...');
    const result2 = await renderer.render({
      templateId: TEMPLATES.SQUARE_EDITORIAL,
      headline: 'দ্রব্যমূল্য নিয়ন্ত্রণে কঠোর পদক্ষেপের ঘোষণা বাণিজ্য উপদেষ্টার, পাইকারি ও খুচরা বাজারে চলবে বিশেষ তদারকি',
      category: 'অর্থনীতি',
      imageUrl: undefined, // Test fallback SVG rendering
    });

    console.log(`✓ Result 2 rendered: ${result2.outputPath} (${result2.width}x${result2.height}), size: ${result2.imageBuffer.length} bytes`);

    // Test 3: Landscape Standard Template (1200x630)
    console.log('\n3. Rendering Landscape Social Share (1200x630)...');
    const result3 = await renderer.render({
      templateId: TEMPLATES.LANDSCAPE_STANDARD,
      headline: 'টি-টোয়েন্টি বিশ্বকাপের ফাইনালে শ্বাসরুদ্ধকর ম্যাচে শেষ ওভারে ইতিহাস সৃষ্টি করল বাংলাদেশ ক্রিকেট দল',
      category: 'খেলাধুলা',
      imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
    });

    console.log(`✓ Result 3 rendered: ${result3.outputPath} (${result3.width}x${result3.height}), size: ${result3.imageBuffer.length} bytes`);

    console.log('\n=== PHASE 2 COMPLETE: ALL 3 TEMPLATES RENDERED PERFECTLY ===');
  } finally {
    await renderer.close();
  }
}

testRenderer().catch((err) => {
  console.error('Phase 2 test failed:', err);
  process.exit(1);
});

