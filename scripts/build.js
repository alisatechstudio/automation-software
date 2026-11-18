import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

try {
  console.log('[Build] Compiling TypeScript with tsc...');
  execSync('tsc', { stdio: 'inherit' });

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

  console.log('[Build] Build succeeded!');
} catch (err) {
  console.error('[Build] Build process failed:', err);
  process.exit(1);
}
