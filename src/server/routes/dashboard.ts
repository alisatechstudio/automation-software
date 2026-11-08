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

/**
 * Terms of Service route for Google OAuth / Meta compliance
 */
dashboardRouter.get('/terms', (req: Request, res: Response) => {
  const host = req.get('host') || 'automation-software';
  const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const domain = `${protocol}://${host}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getTermsHtml(domain));
});

/**
 * Privacy Policy route for Google OAuth / Meta compliance
 */
dashboardRouter.get('/privacy', (req: Request, res: Response) => {
  const host = req.get('host') || 'automation-software';
  const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const domain = `${protocol}://${host}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getPrivacyHtml(domain));
});

function getTermsHtml(domain: string): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - Automation Software</title>
  <link rel="stylesheet" href="/assets/css/tailwind.min.css">
</head>
<body class="bg-slate-950 text-slate-200 min-h-screen py-10 px-4 sm:px-6">
  <div class="max-w-3xl mx-auto space-y-6 bg-slate-900/60 p-6 sm:p-10 rounded-2xl border border-slate-800 shadow-xl">
    <div class="flex items-center justify-between border-b border-slate-800 pb-4">
      <div>
        <h1 class="text-2xl font-black text-white">Terms of Service</h1>
        <p class="text-xs text-slate-400 mt-1">Effective Date: November 2026</p>
      </div>
      <a href="/" class="text-xs font-semibold text-cyan-400 hover:text-cyan-300">← Back to Dashboard</a>
    </div>

    <div class="space-y-4 text-sm leading-relaxed text-slate-300">
      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">1. Overview</h2>
        <p>These Terms of Service govern your use of the Automation Software application hosted at <code class="text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono text-xs">${domain}</code>. By using this service, you agree to comply with these terms.</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">2. Scope of Service</h2>
        <p>This software is a private content pipeline automation tool designed to generate visual news reels and automatically stage, syndicate, and publish video and visual card content to authorized social channels (Facebook, YouTube, TikTok, Google Drive).</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">3. Third-Party API Compliance</h2>
        <p>Users must comply with all terms and conditions set by third-party platforms utilized by this software, including:</p>
        <ul class="list-disc list-inside space-y-1 text-slate-400 text-xs">
          <li><strong>Google APIs:</strong> Users agree to the Google Terms of Service and Google API Services User Data Policy.</li>
          <li><strong>YouTube:</strong> Use of YouTube Shorts uploading adheres to the YouTube Terms of Service.</li>
          <li><strong>Meta / Facebook:</strong> Graph API operations adhere to Meta Platform Terms.</li>
          <li><strong>TikTok:</strong> Video submissions adhere to the TikTok Terms of Service.</li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">4. User Responsibilities & Content Ownership</h2>
        <p>You represent and warrant that you own or have obtained the necessary rights and licenses to ingest, render, and publish all content, RSS feeds, images, and videos processed through this automation system.</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">5. Termination & Modifications</h2>
        <p>We reserve the right to modify these terms at any time. Continued use of the platform represents agreement to updated terms.</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">6. Contact</h2>
        <p>For questions or inquiries regarding these Terms of Service, contact the platform administrator at <a href="${domain}" class="text-cyan-400 hover:underline">${domain}</a>.</p>
      </section>
    </div>

    <div class="pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
      &copy; 2026 Automation Software. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

function getPrivacyHtml(domain: string): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Automation Software</title>
  <link rel="stylesheet" href="/assets/css/tailwind.min.css">
</head>
<body class="bg-slate-950 text-slate-200 min-h-screen py-10 px-4 sm:px-6">
  <div class="max-w-3xl mx-auto space-y-6 bg-slate-900/60 p-6 sm:p-10 rounded-2xl border border-slate-800 shadow-xl">
    <div class="flex items-center justify-between border-b border-slate-800 pb-4">
      <div>
        <h1 class="text-2xl font-black text-white">Privacy Policy</h1>
        <p class="text-xs text-slate-400 mt-1">Effective Date: November 2026</p>
      </div>
      <a href="/" class="text-xs font-semibold text-emerald-400 hover:text-emerald-300">← Back to Dashboard</a>
    </div>

    <div class="space-y-4 text-sm leading-relaxed text-slate-300">
      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">1. Introduction</h2>
        <p>This Privacy Policy explains how Automation Software (<code class="text-emerald-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono text-xs">${domain}</code>) collects, stores, and protects user data when connecting to third-party APIs (Google Drive, YouTube, Facebook, TikTok).</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">2. Information We Collect</h2>
        <ul class="list-disc list-inside space-y-1 text-slate-400 text-xs">
          <li><strong>OAuth Credentials & Tokens:</strong> Refresh tokens and access tokens authorized by the user to upload videos to Google Drive and YouTube, and publish to Facebook Pages and TikTok.</li>
          <li><strong>Content Data:</strong> RSS article headlines, summaries, and generated video buffers used exclusively to create and publish content.</li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">3. How Information Is Used</h2>
        <p>All collected credentials and data are used strictly for:</p>
        <ul class="list-disc list-inside space-y-1 text-slate-400 text-xs">
          <li>Staging generated MP4 reels in your specified Google Drive folder.</li>
          <li>Automating publication of reels to your selected social channels.</li>
          <li>Managing zero-database queue cleanup (moving staged files to Trash after publishing).</li>
        </ul>
        <p class="font-bold text-white text-xs pt-1">We do not sell, rent, or share your data or credentials with any third parties under any circumstances.</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">4. Google API Limited Use Disclosure</h2>
        <p>Our use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" class="text-emerald-400 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">5. Data Retention & Deletion</h2>
        <p>Authentication tokens are stored securely in your private database and can be revoked or deleted at any time from the application dashboard or directly through your Google Account permissions page.</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-white">6. Contact</h2>
        <p>If you have any questions about this Privacy Policy, please contact the administrator via <a href="${domain}" class="text-emerald-400 hover:underline">${domain}</a>.</p>
      </section>
    </div>

    <div class="pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
      &copy; 2026 Automation Software. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}
