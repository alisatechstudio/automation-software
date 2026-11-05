import express, { Express, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { apiRouter } from './routes/api.js';
import { dashboardRouter } from './routes/dashboard.js';
import { authMiddleware } from './middleware/auth.js';
import { requestLogger } from './middleware/logging.js';
import { PersistentJobQueue } from '../services/queue/queue.js';
import { ArticleDedupeService } from '../services/rss/dedupe.js';
import { QueueWorker } from '../services/queue/worker.js';
import { getDatabase, isMongoConnected, getLastMongoError, initMongoDb } from '../db/index.js';
import { config } from '../config/env.js';

export function createServer(): Express {
  const app = express();
  const queue = new PersistentJobQueue();
  const dedupeService = new ArticleDedupeService();
  const worker = new QueueWorker();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Strip Vercel rewrite prefix if present
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url.startsWith('/api/index')) {
      req.url = req.url.replace(/^\/api\/index/, '') || '/';
    }
    next();
  });

  // Request logger
  app.use(requestLogger);

  // Serve static assets (fonts, images, rendered)
  app.use('/assets', express.static(config.ASSETS_DIR));
  app.use('/rendered', express.static(path.join(config.DATA_DIR, 'rendered')));

  // Favicon handler serving the official BD News 24/7 favicon
  app.get(['/favicon.ico', '/favicon.png'], (req: Request, res: Response) => {
    const faviconPath = path.join(config.ASSETS_DIR, 'images', 'favicon.png');
    if (fs.existsSync(faviconPath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(faviconPath).pipe(res);
    } else {
      res.status(204).end();
    }
  });

  // Public Privacy Policy Page for Meta App Review & Live Mode Compliance
  app.get(['/privacy', '/privacy-policy'], (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - BD News 24/7 Automation</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-200 min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans">
  <div class="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 shadow-2xl">
    <div class="flex items-center gap-3 mb-8 pb-6 border-b border-slate-800">
      <img src="/favicon.png" alt="BD News 24/7" class="w-10 h-10 rounded-full border border-red-500/30">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Privacy Policy</h1>
        <p class="text-xs text-slate-400">Automation Software for BD News 24/7 • Last Updated: November 2026</p>
      </div>
    </div>
    
    <div class="space-y-6 text-sm text-slate-300 leading-relaxed">
      <section>
        <h2 class="text-base font-semibold text-white mb-2">1. Overview</h2>
        <p>This Privacy Policy explains how <strong>Automation Software</strong> ("we", "our") manages data when automating news publications for Facebook Pages, including BD News 24/7. We are committed to transparency and respecting the privacy of our users and audience.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-white mb-2">2. Information We Process</h2>
        <p>Our automation software processes public RSS news feeds (article headlines, links, publication dates, and publicly available editorial imagery) and Page Access Tokens provided by authorized page administrators. We do <strong>not</strong> collect, harvest, store, or sell personal personal data or private profile information of visitors.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-white mb-2">3. Use of Meta (Facebook) Graph API</h2>
        <p>Our application interacts with Meta's Graph API solely to publish formatted news headlines, branded images, and article links to authorized Facebook Pages. We adhere strictly to the <a href="https://developers.facebook.com/terms/" target="_blank" class="text-red-400 hover:underline">Meta Developer Platform Terms</a> and Privacy Policies.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-white mb-2">4. Data Storage and Security</h2>
        <p>Tokens and scheduling configuration are encrypted and stored in secure, private database instances. We never share access credentials or content with third parties.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-white mb-2">5. User Data Deletion Instructions</h2>
        <p>Page administrators may revoke access at any time via the Meta Business Integrations settings (<a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" class="text-red-400 hover:underline">facebook.com/settings</a>) or delete the page connection directly from the Automation Dashboard. All cached tokens and queue jobs are permanently deleted immediately upon removal.</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-white mb-2">6. Contact Us</h2>
        <p>For inquiries regarding this privacy policy or data requests, please contact the administrators via the official Facebook Page: <strong>BD News 24/7</strong>.</p>
      </section>
    </div>

    <div class="mt-10 pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
      &copy; 2026 BD News 24/7. All rights reserved.
    </div>
  </div>
</body>
</html>`);
  });

  // Unauthenticated Health Check Endpoint (Returns 200 so Vercel/containers don't kill the service)
  app.get(['/health', '/healthz'], async (req: Request, res: Response) => {
    const mongoReady = isMongoConnected();
    let queueStats = { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };

    if (mongoReady) {
      try {
        const db = getDatabase();
        await db.command({ ping: 1 });
        queueStats = await queue.getStats();
      } catch (e) {
        // If ping fails
      }
    }

    res.status(200).json({
      status: mongoReady ? 'healthy' : 'degraded',
      database: mongoReady ? 'connected (MongoDB)' : 'disconnected',
      mongoError: mongoReady ? null : getLastMongoError(),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      dryRun: config.DRY_RUN,
      queue: queueStats,
      environment: {
        vercel: !!process.env.VERCEL,
        nodeEnv: config.NODE_ENV,
        hasMongoUri: !!process.env.MONGODB_URI || !!process.env.MONGODB_URL,
      },
    });
  });

  // Vercel Cron Endpoint: Triggered by Vercel Cron schedule
  app.all('/api/cron', async (req: Request, res: Response) => {
    console.log('[Vercel Cron] Triggered scheduled RSS poll & queue tick...');
    try {
      if (!isMongoConnected()) {
        await initMongoDb();
      }
      if (!isMongoConnected()) {
        res.status(503).json({ error: 'MongoDB not connected', details: getLastMongoError() });
        return;
      }

      const pollResults = await dedupeService.pollAllActiveSources();
      const job = await queue.fetchNextJob();
      if (job) {
        await worker.processJob(job);
      }

      res.json({
        success: true,
        pollResults,
        processedJobId: job ? job._id : null,
      });
    } catch (err: any) {
      console.error('[Vercel Cron] Error during cron execution:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Password-protected routes (Health check & /api/cron bypass inside authMiddleware)
  app.use(authMiddleware);

  // Database Connection Auto-Retry Middleware
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    // Template preview endpoints don't require database access
    if (req.path.startsWith('/api/preview')) {
      return next();
    }

    // If MongoDB is not connected, try to reconnect lazily
    if (!isMongoConnected()) {
      await initMongoDb();
    }

    // If still not connected and accessing root or web UI, show helpful Setup Diagnostics
    if (!isMongoConnected()) {
      if (req.path.startsWith('/api') && req.path !== '/api/cron' && !req.path.startsWith('/api/preview')) {
        res.status(503).json({
          error: 'MongoDB Not Connected',
          details: getLastMongoError() || 'MONGODB_URI not configured in Vercel',
        });
        return;
      }

      const maskedUri = (process.env.MONGODB_URI || config.MONGODB_URI || '').replace(/:([^@]+)@/, ':****@') || '(Not Set)';
      const errorMsg = getLastMongoError() || 'MONGODB_URI environment variable is missing';

      const setupHtml = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <title>MongoDB Connection Required - News Automation</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6">
  <div class="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
    <div class="flex items-center gap-3 mb-6">
      <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold">⚠️</div>
      <div>
        <h1 class="text-xl font-bold text-slate-100">MongoDB Connection Required</h1>
        <p class="text-xs text-slate-400">Vercel Deployment Diagnostic</p>
      </div>
    </div>

    <div class="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono mb-6 space-y-1">
      <div class="text-slate-400"><strong class="text-slate-200">Current URI:</strong> ${maskedUri}</div>
      <div class="text-red-400"><strong class="text-slate-200">Error:</strong> ${errorMsg}</div>
    </div>

    <div class="space-y-4 text-sm text-slate-300">
      <h2 class="font-semibold text-slate-100">How to Fix on Vercel:</h2>
      <ol class="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-400">
        <li>Open your project on the <a href="https://vercel.com/dashboard" target="_blank" class="text-red-400 underline">Vercel Dashboard</a>.</li>
        <li>Go to <strong>Settings</strong> ➔ <strong>Environment Variables</strong>.</li>
        <li>Add <code class="bg-slate-800 text-slate-200 px-1 py-0.5 rounded">MONGODB_URI</code> with your MongoDB Atlas or Vercel Storage connection string (e.g., <code class="bg-slate-800 text-slate-200 px-1 py-0.5 rounded">mongodb+srv://user:pass@cluster.mongodb.net/news_automation?retryWrites=true&w=majority</code>).</li>
        <li>In MongoDB Atlas, verify <strong>Network Access</strong> allows IP <code class="bg-slate-800 text-slate-200 px-1 py-0.5 rounded">0.0.0.0/0</code> (Allow access from anywhere).</li>
        <li>Redeploy or reload this page.</li>
      </ol>
    </div>

    <div class="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
      <span class="text-xs text-slate-500">Auto-retrying on page reload</span>
      <button onclick="window.location.reload()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-lg transition">
        Retry Connection
      </button>
    </div>
  </div>
</body>
</html>`;
      res.send(setupHtml);
      return;
    }

    next();
  });

  // Mount API & Web Dashboard
  app.use('/api', apiRouter);
  app.use('/', dashboardRouter);

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Global Server Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: err?.message || String(err),
      });
    }
  });

  return app;
}

const defaultApp = createServer();
export default defaultApp;
