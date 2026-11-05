import { FacebookGraphClient } from '../src/services/facebook/client.js';

async function testFacebook() {
  console.log('=== PHASE 3 TEST: FACEBOOK GRAPH PUBLISHER & FORMATTING ===');

  const fbClient = new FacebookGraphClient('v21.0');

  // 1. Test Caption Formatting
  console.log('1. Testing Caption Formatting (Headline + Summary + Hashtags, NO link)...');
  const headline = 'ঢাকায় তাপমাত্রা হ্রাস, শীতের আগমনে শুরু হয়েছে মৌসুমি আবহাওয়া পরিবর্তন';
  const summary = 'আবহাওয়া অধিদপ্তরের পূর্বাভাস অনুযায়ী আগামী কয়েক দিনে রাতের তাপমাত্রা আরও কমতে পারে। উত্তরাঞ্চলে বইতে শুরু করেছে হিমেল হাওয়া।';
  const hashtags = '#WeatherUpdate #Bangladesh #Winter2026';

  const caption = fbClient.formatCaption(headline, summary, hashtags);
  console.log('Generated Caption:\n------------------------');
  console.log(caption);
  console.log('------------------------');

  if (caption.includes('http://') || caption.includes('https://')) {
    throw new Error('Caption must NOT contain links as per requirements!');
  }
  console.log('✓ Verified: Caption contains NO links.');

  // 2. Test Comment Formatting
  console.log('\n2. Testing First Comment Formatting...');
  const newsUrl = 'https://newsportal.com/bangladesh/weather-update-winter-2026';
  const comment = fbClient.formatComment(newsUrl);
  console.log(`Generated Comment: "${comment}"`);

  if (!comment.includes('বিস্তারিত পড়ুন:') || !comment.includes(newsUrl)) {
    throw new Error('Comment must contain "বিস্তারিত পড়ুন: <url>"');
  }
  console.log('✓ Verified: First comment formatted correctly.');

  // 3. Test Dry-Run Photo Upload
  console.log('\n3. Testing Dry-Run Photo Upload...');
  const mockBuffer = Buffer.from('fake-png-buffer-for-test');
  const photoResult = await fbClient.publishPhoto('page_123456789', 'MOCK_TOKEN', mockBuffer, caption, true);
  console.log('✓ Photo Result:', photoResult);

  // 4. Test Dry-Run Comment Post
  console.log('\n4. Testing Dry-Run Comment Post...');
  const commentResult = await fbClient.publishComment(photoResult.postId, 'MOCK_TOKEN', comment, true);
  console.log('✓ Comment Result:', commentResult);

  console.log('\n=== PHASE 3 COMPLETE & VERIFIED ===\n');
}

testFacebook().catch((err) => {
  console.error('Phase 3 test failed:', err);
  process.exit(1);
});

