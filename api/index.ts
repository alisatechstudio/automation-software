let cachedApp: any = null;

export default async function handler(req: any, res: any) {
  try {
    if (!cachedApp) {
      const { initDatabase } = await import('../src/db/index.js');
      const { createServer } = await import('../src/server/app.js');
      const { loadConfig } = await import('../src/config/index.js');
      const { DbRepository } = await import('../src/db/repository.js');
      const { ApprovalManager } = await import('../src/approval/manager.js');
      const { SportsClipPipeline } = await import('../src/scheduler/pipeline.js');

      if (process.env.MONGODB_URI) {
        try {
          await initDatabase(process.env.MONGODB_URI, process.env.MONGODB_DB_NAME || 'news_automation');
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
        if (err) reject(err);
        else resolve();
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
