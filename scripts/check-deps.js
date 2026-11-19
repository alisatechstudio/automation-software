import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const allDeps = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  'fs', 'path', 'crypto', 'os', 'child_process', 'url', 'http', 'https', 'stream', 'events', 'util',
  'node:fs', 'node:path', 'node:crypto', 'node:os', 'node:child_process', 'node:url', 'node:http', 'node:https',
  'node:stream', 'node:events', 'node:util', 'node:module', 'node:buffer', 'module', 'buffer', 'assert'
]);

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const missing = new Set();
for (const f of getFiles('src')) {
  const content = fs.readFileSync(f, 'utf8');
  const importRegex = /(?:from\s+['"]|import\s*\(['"]|require\(['"])([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const imp = match[1];
    if (imp.startsWith('.') || imp.startsWith('/')) continue;
    let basePkg = imp.startsWith('@') ? imp.split('/').slice(0, 2).join('/') : imp.split('/')[0];
    if (!allDeps.has(basePkg) && !allDeps.has(imp)) {
      missing.add(`${basePkg} in ${f}`);
    }
  }
}
console.log('Missing dependencies:', Array.from(missing));
