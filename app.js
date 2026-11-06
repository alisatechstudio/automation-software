// cPanel / Phusion Passenger Startup Entrypoint
// With comprehensive logging redirect, resource limits, and Auto-Reload watcher for FTP uploads
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '2';

const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'startup-debug.log');

function writeLog(prefix, args) {
  const timestamp = new Date().toISOString();
  const text = args.map(a => (typeof a === 'object' && a !== null ? (a.stack || JSON.stringify(a)) : String(a))).join(' ');
  const line = `[${timestamp}] ${prefix} ${text}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {}
}

const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;

console.log = function(...args) {
  writeLog('[INFO]', args);
  origLog.apply(console, args);
};

console.error = function(...args) {
  writeLog('[ERROR]', args);
  origError.apply(console, args);
};

console.warn = function(...args) {
  writeLog('[WARN]', args);
  origWarn.apply(console, args);
};

console.log('>>> app.js: Node.js process initialized by Passenger/cPanel');
console.log(`>>> Node: ${process.version} | CWD: ${process.cwd()} | PORT: ${process.env.PORT || 'default'}`);

process.on('uncaughtException', (err) => {
  console.error('!!! CRITICAL UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('!!! CRITICAL UNHANDLED REJECTION:', reason);
});

process.on('exit', (code) => {
  console.log(`!!! Process exited with code: ${code}`);
});

// --- AUTO-RELOAD WATCHER (Triggers Passenger reload on FTP sync) ---
try {
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const restartFile = path.join(tmpDir, 'restart.txt');
  if (!fs.existsSync(restartFile)) {
    fs.writeFileSync(restartFile, `${new Date().toISOString()}: Touch this file or upload to trigger reload.`);
  }

  let reloadTimeout = null;
  function triggerReload(reason) {
    if (reloadTimeout) clearTimeout(reloadTimeout);
    // 3-second debounce to ensure multi-file FTP uploads finish before restarting
    reloadTimeout = setTimeout(() => {
      console.log(`>>> [Auto-Reload] Change detected (${reason}). Gracefully recycling worker for Passenger...`);
      process.exit(0);
    }, 3000);
  }

  // 1. Watch dist directory
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    try {
      fs.watch(distDir, { recursive: true }, (event, filename) => {
        triggerReload(`file in dist/${filename || ''}`);
      });
    } catch {}
  }

  // 2. Watch dist/src/index.js specifically (Linux fallback)
  const indexJs = path.join(distDir, 'src', 'index.js');
  if (fs.existsSync(indexJs)) {
    fs.watchFile(indexJs, { interval: 2000 }, (curr, prev) => {
      if (curr.mtimeMs !== prev.mtimeMs) {
        triggerReload('dist/src/index.js updated');
      }
    });
  }

  // 3. Watch .env file
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.watchFile(envPath, { interval: 2000 }, (curr, prev) => {
      if (curr.mtimeMs !== prev.mtimeMs) {
        triggerReload('.env updated');
      }
    });
  }

  // 4. Watch Passenger native restart.txt
  fs.watchFile(restartFile, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      triggerReload('tmp/restart.txt modified');
    }
  });

  console.log('>>> [Auto-Reload] Active: Watching ./dist, .env, and tmp/restart.txt for FTP updates.');
} catch (watchErr) {
  console.warn('>>> [Auto-Reload] Notice:', watchErr.message);
}

try {
  console.log('>>> Requiring compiled entrypoint: ./dist/src/index.js ...');
  require('./dist/src/index.js');
  console.log('>>> ./dist/src/index.js executed synchronously.');
} catch (err) {
  console.error('!!! FATAL STARTUP ERROR IN REQUIRE:', err);
  throw err;
}
