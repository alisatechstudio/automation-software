import { initDatabase } from '../src/db/index.js';
import { createServer } from '../src/server/app.js';
import { loadConfig } from '../src/config/index.js';
import { DbRepository } from '../src/db/repository.js';
import { ApprovalManager } from '../src/approval/manager.js';
import { SportsClipPipeline } from '../src/scheduler/pipeline.js';

let cachedApp: any = null;

export default async function handler(req: any, res: any) {
  try {
    if (!cachedApp) {
      if (process.env.MONGODB_URI) {
        try {
          const db = await initDatabase(process.env.MONGODB_URI, process.env.MONGODB_DB_NAME || 'news_automation');
          const settingsDocs = await db.collection('settings').find({}).toArray().catch(() => []);
          for (const s of settingsDocs) {
            const k = (typeof s.key === 'string' && s.key.trim()) || (typeof s._id === 'string' && s._id.trim()) || '';
            if (k && s.value !== undefined && !process.env[k]) {
              process.env[k] = String(s.value);
            }
          }
          // Ensure aliases are set for Google OAuth
          if (!process.env.GOOGLE_CLIENT_ID && process.env.YOUTUBE_CLIENT_ID) {
            process.env.GOOGLE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
          }
          if (!process.env.GOOGLE_CLIENT_SECRET && process.env.YOUTUBE_CLIENT_SECRET) {
            process.env.GOOGLE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
          }
          if (!process.env.GOOGLE_REFRESH_TOKEN && process.env.GDRIVE_REFRESH_TOKEN) {
            process.env.GOOGLE_REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;
          }
        } catch (dbErr) {
          console.warn('MongoDB connection warning:', dbErr);
        }
      }

      const config = loadConfig();
      const repo = new DbRepository();
      const approvalManager = new ApprovalManager(repo);
      const pipeline = new SportsClipPipeline(repo, config);
      cachedApp = createServer({ repo, approvalManager, pipeline, config });
    }

    return new Promise<void>((resolve, reject) => {
      res.on('finish', () => resolve());
      res.on('close', () => resolve());
      res.on('error', (err: any) => reject(err));
      cachedApp(req, res, (err: any) => {
        if (err) {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err?.message || 'Internal Server Error' }));
          }
          resolve();
        } else {
          if (!res.headersSent) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not Found', path: req.url }));
          }
          resolve();
        }
      });
    });
  } catch (err: any) {
    console.error('Fatal API crash:', err);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`
      <div style="font-family: monospace; padding: 24px; background: #0f172a; color: #f87171; min-height: 100vh;">
        <h2 style="color: #ef4444; margin-top: 0;">⚡ SportsClipBot - Serverless Diagnostic Error</h2>
        <p><strong style="color: #f1f5f9;">Message:</strong> ${err?.message || String(err)}</p>
        <pre style="background: #1e293b; padding: 16px; border-radius: 8px; color: #cbd5e1; overflow-x: auto;">${err?.stack || 'No stack trace available'}</pre>
      </div>
    `);
  }
}
