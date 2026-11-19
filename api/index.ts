import { initDatabase } from '../src/db/index.js';
import { InputPipelineService } from '../src/pipeline/input-pipeline.js';
import { createInputServer } from '../src/server/app.js';
import { config } from '../src/config/env.js';

let cachedApp: any = null;

export default async function handler(req: any, res: any) {
  try {
    if (!cachedApp) {
      if (process.env.MONGODB_URI) {
        try {
          await initDatabase(process.env.MONGODB_URI, process.env.MONGODB_DB_NAME || 'news_automation');
        } catch (dbErr: any) {
          console.warn('[Vercel Input API] MongoDB connection note:', dbErr.message);
        }
      }

      const pipeline = new InputPipelineService();
      cachedApp = createInputServer(pipeline);
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
    console.error('[Vercel Input API] Fatal crash:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || String(err), stack: err?.stack }));
  }
}
