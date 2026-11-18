import { createServer } from '../dist/server/app.js';
import { loadConfig } from '../dist/config/index.js';
import { initDatabase } from '../dist/db/index.js';
import { DbRepository } from '../dist/db/repository.js';
import { ApprovalManager } from '../dist/approval/manager.js';
import { SportsClipPipeline } from '../dist/scheduler/pipeline.js';

let appInstance = null;
let initPromise = null;

async function getApp() {
  if (appInstance) {
    return appInstance;
  }

  const config = loadConfig();
  let db = null;

  // Attempt to connect to MongoDB if non-localhost MONGODB_URI is provided
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('127.0.0.1')) {
    try {
      db = await initDatabase(config.env.MONGODB_URI, config.env.MONGODB_DB_NAME);
    } catch (err) {
      console.warn('[Vercel Serverless] MongoDB connection failed, falling back to in-memory store:', err.message);
    }
  }

  const repo = new DbRepository(db);
  const approvalManager = new ApprovalManager(repo);
  const pipeline = new SportsClipPipeline(repo, config);
  appInstance = createServer({ repo, approvalManager, pipeline, config });
  return appInstance;
}

export default async function handler(req, res) {
  try {
    if (!initPromise) {
      initPromise = getApp();
    }
    const app = await initPromise;
    return app(req, res);
  } catch (err) {
    console.error('[Vercel Serverless] Uncaught handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/html');
      res.end(`<h1>500 Internal Server Error</h1><p>${err.message}</p><pre>${err.stack}</pre>`);
    }
  }
}
