const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const ffmpeg = path.join(rootDir, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');
const inputVideo = path.join(rootDir, 'assets', 'video', 'canva_breaking_anchor.mp4');
const outDir = path.join(rootDir, 'assets', 'video', 'anchor_frames');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Extracting anchor frames at 24fps...');
execSync(`"${ffmpeg}" -i "${inputVideo}" -vf "fps=24,scale=1080:608:force_original_aspect_ratio=increase,crop=1080:608" -q:v 3 -y "${path.join(outDir, 'frame_%04d.jpg')}"`, { stdio: 'inherit' });

// Also extract the audio to assets/video/broadcast_news_theme.aac if needed
const audioOut = path.join(rootDir, 'assets', 'video', 'broadcast_news_theme.aac');
try {
  execSync(`"${ffmpeg}" -i "${inputVideo}" -vn -c:a aac -b:a 128k -y "${audioOut}"`);
  console.log('Updated broadcast_news_theme.aac with Canva template audio');
} catch (e) {
  console.warn('Audio extract note:', e.message);
}

const files = fs.readdirSync(outDir).filter(f => f.endsWith('.jpg'));
console.log(`Extracted ${files.length} anchor frames to ${outDir}`);
