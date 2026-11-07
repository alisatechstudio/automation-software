import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import { config } from '../../config/env.js';

export const dashboardRouter = Router();

let cachedHtml: string | null = null;

/**
 * Loads the dashboard HTML template with multi-path resolution and production caching.
 */
function getDashboardHtml(): string {
  // In production, serve from memory cache for maximum throughput
  if (cachedHtml && process.env.NODE_ENV === 'production') {
    return cachedHtml;
  }

  const candidatePaths = [
    path.join(config.ASSETS_DIR, 'dashboard.html'),
    path.join(process.cwd(), 'assets', 'dashboard.html'),
    path.join(process.cwd(), 'src', 'templates', 'dashboard.html'),
    path.join(process.cwd(), 'dist', 'src', 'templates', 'dashboard.html'),
  ];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        cachedHtml = fs.readFileSync(filePath, 'utf-8');
        return cachedHtml;
      } catch (err: any) {
        console.warn(`[DashboardRouter] Error reading ${filePath}:`, err.message);
      }
    }
  }

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <title>BD News 24/7 - Dashboard</title>
  <link rel="stylesheet" href="/assets/css/tailwind.min.css">
</head>
<body class="bg-slate-950 text-slate-100 p-8 text-center font-sans">
  <h1 class="text-xl font-bold text-red-500 mb-2">Dashboard Template Not Found</h1>
  <p class="text-sm text-slate-400">Please ensure <code>assets/dashboard.html</code> exists.</p>
</body>
</html>`;
}

/**
 * Dashboard main route
 */
dashboardRouter.get(['/', '/dashboard'], (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getDashboardHtml());
});
