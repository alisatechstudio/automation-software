import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

try {
  console.log('[Build] Resolving TypeScript compiler...');
  const tscPath = path.resolve('node_modules/typescript/bin/tsc');
  let tscCmd = '';

  if (fs.existsSync(tscPath)) {
    tscCmd = `"${process.execPath}" "${tscPath}" --project tsconfig.json`;
  } else {
    tscCmd = 'npx --no-install tsc --project tsconfig.json';
  }

  console.log(`[Build] Executing: ${tscCmd}`);
  execSync(tscCmd, { stdio: 'inherit' });

  console.log('[Build] Copying views and public assets...');
  const viewsSrc = path.resolve('src/server/views');
  const viewsDest = path.resolve('dist/server/views');

  if (fs.existsSync(viewsSrc)) {
    fs.mkdirSync(viewsDest, { recursive: true });
    fs.cpSync(viewsSrc, viewsDest, { recursive: true });
  }

  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Copy legacy dashboard assets to public for static CDN serving
  const assetsSrc = path.resolve('assets');
  const publicAssetsDest = path.resolve('public/assets');
  if (fs.existsSync(assetsSrc)) {
    fs.mkdirSync(publicAssetsDest, { recursive: true });
    fs.cpSync(assetsSrc, publicAssetsDest, { recursive: true });
  }

  console.log('[Build] Build succeeded!');
} catch (err) {
  console.error('[Build] Build failed with error:', err.message);
  process.exit(1);
}
