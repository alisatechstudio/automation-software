import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import { config } from '../../config/env.js';

export const dashboardRouter = Router();

let cachedHtml: string | null = null;
let cachedJs: string | null = null;
let cachedCss: string | null = null;

function getDashboardJs(): string {
  if (cachedJs && process.env.NODE_ENV === 'production') {
    return cachedJs;
  }
  const candidatePaths = [
    path.join(config.ASSETS_DIR, 'js', 'dashboard.js'),
    path.join(process.cwd(), 'assets', 'js', 'dashboard.js'),
    path.join(process.cwd(), 'dist', 'assets', 'js', 'dashboard.js'),
  ];
  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        cachedJs = fs.readFileSync(filePath, 'utf-8');
        return cachedJs;
      } catch (err: any) {
        console.warn(`[DashboardRouter] Error reading ${filePath}:`, err.message);
      }
    }
  }
  return '';
}

function getDashboardCss(): string {
  if (cachedCss && process.env.NODE_ENV === 'production') {
    return cachedCss;
  }
  const candidatePaths = [
    path.join(config.ASSETS_DIR, 'css', 'dashboard.css'),
    path.join(process.cwd(), 'assets', 'css', 'dashboard.css'),
    path.join(process.cwd(), 'dist', 'assets', 'css', 'dashboard.css'),
  ];
  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        cachedCss = fs.readFileSync(filePath, 'utf-8');
        return cachedCss;
      } catch (err: any) {
        console.warn(`[DashboardRouter] Error reading ${filePath}:`, err.message);
      }
    }
  }
  return '';
}

/**
 * Loads the dashboard HTML template with multi-path resolution and inlined JS/CSS.
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

  let rawHtml: string | null = null;
  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        rawHtml = fs.readFileSync(filePath, 'utf-8');
        break;
      } catch (err: any) {
        console.warn(`[DashboardRouter] Error reading ${filePath}:`, err.message);
      }
    }
  }

  if (rawHtml) {
    const css = getDashboardCss();
    const js = getDashboardJs();

    if (css && rawHtml.includes('<link rel="stylesheet" href="/assets/css/dashboard.css">')) {
      rawHtml = rawHtml.replace(
        '<link rel="stylesheet" href="/assets/css/dashboard.css">',
        `<style id="inlined-dashboard-css">\n${css}\n</style>`
      );
    }
    if (js && rawHtml.includes('<script src="/assets/js/dashboard.js"></script>')) {
      rawHtml = rawHtml.replace(
        '<script src="/assets/js/dashboard.js"></script>',
        `<script id="inlined-dashboard-js">\n${js}\n</script>`
      );
    }

    cachedHtml = rawHtml;
    return cachedHtml;
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
 * Explicit routes for JavaScript & CSS assets to prevent 404/HTML fallback
 */
dashboardRouter.get(['/assets/js/dashboard.js', '/js/dashboard.js'], (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(getDashboardJs());
});

dashboardRouter.get(['/assets/css/dashboard.css', '/css/dashboard.css'], (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(getDashboardCss());
});

/**
 * Dashboard main route
 */
dashboardRouter.get(['/', '/dashboard'], (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getDashboardHtml());
});
