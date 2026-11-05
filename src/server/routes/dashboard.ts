import { Router, Request, Response } from 'express';

export const dashboardRouter = Router();

dashboardRouter.get('/', (req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="bn" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>News to Facebook Automation Control Center</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            bengali: ['Hind Siliguri', 'sans-serif'],
          },
          colors: {
            brand: { 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' }
          }
        }
      }
    }
  </script>
  <style>
    body { font-family: 'Inter', sans-serif; }
    .bn { font-family: 'Hind Siliguri', sans-serif; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col">

  <!-- Top Navbar -->
  <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white shadow-lg shadow-red-500/30">FB</div>
        <div>
          <span class="font-bold text-lg tracking-tight">News-to-FB Automation</span>
          <span class="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-400 border border-slate-700">Self-Hosted</span>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <span id="dry-run-badge" class="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Checking Mode...</span>
        <button onclick="triggerPollNow()" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Poll RSS Now
        </button>
      </div>
    </div>
  </header>

  <!-- Navigation Tabs -->
  <div class="border-b border-slate-800 bg-slate-900/40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-8 overflow-x-auto py-2">
      <button onclick="switchTab('overview')" class="tab-btn active px-3 py-2 text-sm font-medium rounded-md text-red-500 bg-red-500/10">Overview</button>
      <button onclick="switchTab('queue')" class="tab-btn px-3 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-slate-200">Queue & Logs</button>
      <button onclick="switchTab('sources')" class="tab-btn px-3 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-slate-200">RSS Sources</button>
      <button onclick="switchTab('pages')" class="tab-btn px-3 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-slate-200">Facebook Pages</button>
      <button onclick="switchTab('preview')" class="tab-btn px-3 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-slate-200">Template Preview</button>
      <button onclick="switchTab('settings')" class="tab-btn px-3 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-slate-200">Settings</button>
    </div>
  </div>

  <!-- Main Content Area -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">

    <!-- 1. OVERVIEW TAB -->
    <div id="tab-overview" class="tab-content space-y-6">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Pending In Queue</div>
          <div id="stat-pending" class="text-3xl font-bold mt-2 text-amber-400">0</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Published Successfully</div>
          <div id="stat-published" class="text-3xl font-bold mt-2 text-emerald-400">0</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Active RSS Feeds</div>
          <div id="stat-sources" class="text-3xl font-bold mt-2 text-sky-400">0</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Connected Pages</div>
          <div id="stat-pages" class="text-3xl font-bold mt-2 text-purple-400">0</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 class="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Pipeline Health & System Status
          </h3>
          <div class="space-y-3 text-sm text-slate-300">
            <div class="flex justify-between py-2 border-b border-slate-800">
              <span class="text-slate-400">Engine / Runtime:</span>
              <span class="font-mono text-xs">Node.js + Playwright Chromium</span>
            </div>
            <div class="flex justify-between py-2 border-b border-slate-800">
              <span class="text-slate-400">Local Bangla Fonts:</span>
              <span class="text-emerald-400 font-medium">Noto Sans Bengali & Hind Siliguri (Active)</span>
            </div>
            <div class="flex justify-between py-2 border-b border-slate-800">
              <span class="text-slate-400">Database Storage:</span>
              <span class="text-emerald-400 font-medium">MongoDB (Vercel Integration)</span>
            </div>
            <div class="flex justify-between py-2">
              <span class="text-slate-400">Anti-Spam Jitter Delay:</span>
              <span class="text-slate-200 font-mono">30 - 60s per post</span>
            </div>
          </div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 class="text-base font-semibold text-slate-200 mb-4">Quick Architecture Flow</h3>
          <div class="space-y-3 text-xs sm:text-sm font-mono text-slate-400 bg-slate-950 p-4 rounded-lg border border-slate-800/80">
            <div class="text-sky-400">1. RSS Poll (Cron / Manual) ➔ Dedupe (GUID & Link)</div>
            <div class="text-purple-400">2. Persistent Queue (SQLite FIFO + Exponential Backoff)</div>
            <div class="text-amber-400">3. Playwright Headless Renderer (HTML ➔ 1080x1080 / 1200x630 PNG)</div>
            <div class="text-emerald-400">4. Facebook Graph API POST /{page-id}/photos (Caption without links)</div>
            <div class="text-indigo-400">5. Facebook Graph API POST /{post-id}/comments ("বিস্তারিত পড়ুন: <url>")</div>
            <div class="text-red-400">6. Final Failure ➔ Telegram Bot Alert</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. QUEUE & LOGS TAB -->
    <div id="tab-queue" class="tab-content hidden space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-semibold text-slate-100">Live Queue & Publishing History</h2>
        <div class="flex gap-2">
          <button onclick="loadQueue()" class="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300">Refresh</button>
        </div>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-300">
            <thead class="bg-slate-800/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">News Headline</th>
                <th class="px-4 py-3">Target Page</th>
                <th class="px-4 py-3">Attempts</th>
                <th class="px-4 py-3">Next Run / Time</th>
                <th class="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="queue-table-body" class="divide-y divide-slate-800/60">
              <tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">Loading queue...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <h3 class="text-base font-semibold text-slate-200 mt-8 mb-3">Recent Execution Logs</h3>
      <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-300">
            <thead class="bg-slate-800/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Article Title</th>
                <th class="px-4 py-3">FB Post ID</th>
                <th class="px-4 py-3">Duration</th>
                <th class="px-4 py-3">Logged At</th>
              </tr>
            </thead>
            <tbody id="logs-table-body" class="divide-y divide-slate-800/60">
              <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">Loading logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 3. RSS SOURCES TAB -->
    <div id="tab-sources" class="tab-content hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-slate-900 border border-slate-800 p-6 rounded-xl h-fit">
          <h3 class="text-base font-semibold text-slate-100 mb-4">Add RSS Feed Source</h3>
          <form id="add-source-form" onsubmit="handleAddSource(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Source Name</label>
              <input type="text" id="source-name" required placeholder="e.g. BBC Bangla / Prothom Alo" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">RSS Feed URL</label>
              <input type="url" id="source-url" required placeholder="https://example.com/rss.xml" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Destination Facebook Page</label>
              <select id="source-page" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500">
                <option value="">Select Connected Page</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Template</label>
              <select id="source-template" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500">
                <option value="template-square-breaking">Square Breaking News (1080x1080)</option>
                <option value="template-square-editorial">Square Editorial Modern (1080x1080)</option>
                <option value="template-landscape-standard">Landscape Social Share (1200x630)</option>
              </select>
            </div>
            <button type="submit" class="w-full py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition">Save Source</button>
          </form>
        </div>

        <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6">
          <h3 class="text-base font-semibold text-slate-100 mb-4">Configured RSS Sources</h3>
          <div id="sources-list" class="space-y-3">
            <div class="text-sm text-slate-500">Loading sources...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. FACEBOOK PAGES TAB -->
    <div id="tab-pages" class="tab-content hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-slate-900 border border-slate-800 p-6 rounded-xl h-fit">
          <h3 class="text-base font-semibold text-slate-100 mb-4">Connect Facebook Page</h3>
          <form id="add-page-form" onsubmit="handleAddPage(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Page ID</label>
              <input type="text" id="page-id" required placeholder="e.g. 10987654321" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Page Name / Label</label>
              <input type="text" id="page-name" required placeholder="e.g. News 24 Bangladesh" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Page Access Token</label>
              <textarea id="page-token" rows="3" required placeholder="EAA..." class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-red-500"></textarea>
            </div>
            <div class="flex gap-2">
              <button type="button" onclick="testPageToken()" class="w-1/2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300">Test Token</button>
              <button type="submit" class="w-1/2 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-medium text-white">Save Page</button>
            </div>
            <div id="token-test-result" class="text-xs p-3 rounded-lg bg-slate-950 border border-slate-800 hidden font-mono"></div>
          </form>
        </div>

        <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6">
          <h3 class="text-base font-semibold text-slate-100 mb-4">Connected Pages</h3>
          <div id="pages-list" class="space-y-3">
            <div class="text-sm text-slate-500">Loading pages...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. TEMPLATE PREVIEW TAB -->
    <div id="tab-preview" class="tab-content hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div class="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <h3 class="text-base font-semibold text-slate-100">Live Template & Bengali Text Preview</h3>
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">Select Template</label>
            <select id="preview-template" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500">
              <option value="template-square-breaking">Square Breaking News (1080x1080)</option>
              <option value="template-square-editorial">Square Editorial Modern (1080x1080)</option>
              <option value="template-landscape-standard">Landscape Social Share (1200x630)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">Category Badge</label>
            <input type="text" id="preview-category" value="ব্রেকিং নিউজ" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 bn">
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">Headline (Auto-fit Test)</label>
            <textarea id="preview-headline" rows="4" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 bn">রিপাবলিকানদের ঘাঁটি এলাকায় ডেমোক্র্যাটদের নাটকীয় জয়: হোয়াইট হাউসের রাজনীতিতে নতুন মেরুকরণ ও আলোড়ন</textarea>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">News Image URL (Optional)</label>
            <input type="url" id="preview-image" placeholder="https://... (Leave empty to test fallback placeholder)" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200">
          </div>
          <button onclick="renderPreview()" class="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/20">
            <span id="preview-spinner" class="hidden animate-spin">⚪</span>
            Render Live Preview
          </button>
        </div>

        <div class="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center min-h-[500px]">
          <div id="preview-container" class="w-full max-w-lg aspect-square bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden relative shadow-2xl">
            <div id="preview-placeholder" class="text-slate-500 text-sm text-center px-4">Click "Render Live Preview" to compile the HTML/CSS template and render with Playwright</div>
            <img id="preview-img" class="w-full h-full object-contain hidden" alt="Preview Result" />
          </div>
          <div id="preview-meta" class="mt-4 text-xs font-mono text-slate-400"></div>
        </div>
      </div>
    </div>

    <!-- 6. SETTINGS TAB -->
    <div id="tab-settings" class="tab-content hidden space-y-6">
      <div class="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-3xl">
        <h3 class="text-base font-semibold text-slate-100 mb-6">Automation Pipeline Settings</h3>
        <form id="settings-form" onsubmit="handleSaveSettings(event)" class="space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">RSS Poll Cron Schedule</label>
              <input type="text" id="setting-cron" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-200">
              <span class="text-[11px] text-slate-500">e.g. */10 * * * * (Every 10 min)</span>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Max Article Age (Hours)</label>
              <input type="number" id="setting-age" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Max Posts Per Hour Cap</label>
              <input type="number" id="setting-cap" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Anti-Spam Delay Range (Sec)</label>
              <div class="flex items-center gap-2">
                <input type="number" id="setting-min-delay" placeholder="Min (30)" class="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
                <input type="number" id="setting-max-delay" placeholder="Max (60)" class="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">Default Hashtags</label>
            <input type="text" id="setting-hashtags" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">Facebook Caption Format</label>
            <textarea id="setting-caption-format" rows="3" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-200"></textarea>
            <span class="text-[11px] text-slate-500">Variables: {headline}, {summary}, {hashtags} (Links forbidden in caption)</span>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">First Comment Format (News Link)</label>
            <input type="text" id="setting-comment-format" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-200">
            <span class="text-[11px] text-slate-500">Variables: {url}</span>
          </div>

          <div class="pt-4 border-t border-slate-800 flex justify-end">
            <button type="submit" class="py-2 px-6 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition">Save Settings</button>
          </div>
        </form>
      </div>
    </div>

  </main>

  <!-- Notification Toast -->
  <div id="toast" class="fixed bottom-6 right-6 px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm shadow-xl hidden transition-all duration-300"></div>

  <script>
    function showToast(msg, isError = false) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.className = 'fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-sm shadow-xl transition-all duration-300 ' +
        (isError ? 'bg-red-950 border border-red-700 text-red-200' : 'bg-emerald-950 border border-emerald-700 text-emerald-200');
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 4000);
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-red-500', 'bg-red-500/10');
        btn.classList.add('text-slate-400');
      });
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

      event.target.classList.add('text-red-500', 'bg-red-500/10');
      event.target.classList.remove('text-slate-400');
      document.getElementById('tab-' + tabId).classList.remove('hidden');

      if (tabId === 'overview') loadOverview();
      if (tabId === 'queue') loadQueue();
      if (tabId === 'sources') loadSources();
      if (tabId === 'pages') loadPages();
      if (tabId === 'settings') loadSettings();
    }

    async function loadOverview() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('stat-pending').innerText = data.queue.pending;
        document.getElementById('stat-published').innerText = data.successfulPosts;
        document.getElementById('stat-sources').innerText = data.sourcesCount;
        document.getElementById('stat-pages').innerText = data.pagesCount;

        const badge = document.getElementById('dry-run-badge');
        if (data.dryRun) {
          badge.innerText = '🛡️ DRY RUN ACTIVE';
          badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30';
        } else {
          badge.innerText = '🚀 LIVE MODE';
          badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function triggerPollNow() {
      try {
        showToast('Polling RSS feeds now...');
        const res = await fetch('/api/poll-now', { method: 'POST' });
        const data = await res.json();
        showToast('RSS polling complete! Queued new articles.');
        loadOverview();
      } catch (e) {
        showToast('Failed to poll RSS', true);
      }
    }

    async function loadQueue() {
      try {
        const [queueRes, logsRes] = await Promise.all([
          fetch('/api/queue'),
          fetch('/api/logs')
        ]);
        const jobs = await queueRes.json();
        const logs = await logsRes.json();

        const tbody = document.getElementById('queue-table-body');
        if (jobs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">Queue is currently empty.</td></tr>';
        } else {
          tbody.innerHTML = jobs.map(j => \`
            <tr class="hover:bg-slate-800/30">
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded text-xs font-semibold \${
                  j.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  j.status === 'failed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  j.status === 'processing' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }">\${j.status.toUpperCase()}</span>
              </td>
              <td class="px-4 py-3 font-medium text-slate-200 max-w-xs truncate bn" title="\${j.article_title || ''}">\${j.article_title || 'Pending Ingestion'}</td>
              <td class="px-4 py-3 text-slate-400">\${j.page_name || 'All'}</td>
              <td class="px-4 py-3 text-slate-400">\${j.attempts}/\${j.max_attempts}</td>
              <td class="px-4 py-3 text-xs text-slate-400 font-mono">\${new Date(j.run_at).toLocaleTimeString()}</td>
              <td class="px-4 py-3 text-right">
                \${j.status === 'failed' ? \`<button onclick="retryJob('\${j.id}')" class="px-2.5 py-1 text-xs rounded bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40">Retry</button>\` : ''}
              </td>
            </tr>
          \`).join('');
        }

        const logBody = document.getElementById('logs-table-body');
        if (logs.length === 0) {
          logBody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">No logs recorded yet.</td></tr>';
        } else {
          logBody.innerHTML = logs.map(l => \`
            <tr class="hover:bg-slate-800/30 text-xs">
              <td class="px-4 py-2.5">
                <span class="px-1.5 py-0.5 rounded font-semibold \${l.status === 'success' || l.status === 'dry_run' ? 'text-emerald-400 bg-emerald-950' : 'text-red-400 bg-red-950'}">\${l.status}</span>
              </td>
              <td class="px-4 py-2.5 text-slate-300 max-w-sm truncate bn">\${l.article_title || ''}</td>
              <td class="px-4 py-2.5 font-mono text-slate-400">\${l.fb_post_id || '-'}</td>
              <td class="px-4 py-2.5 text-slate-400">\${l.duration_ms ? l.duration_ms + 'ms' : '-'}</td>
              <td class="px-4 py-2.5 text-slate-500 font-mono">\${new Date(l.created_at).toLocaleString()}</td>
            </tr>
          \`).join('');
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function retryJob(id) {
      try {
        const res = await fetch('/api/queue/' + id + '/retry', { method: 'POST' });
        const d = await res.json();
        if (d.success) {
          showToast('Job marked for immediate retry!');
          loadQueue();
        } else {
          showToast(d.error || 'Retry failed', true);
        }
      } catch (e) {
        showToast('Error retrying job', true);
      }
    }

    async function loadSources() {
      const [sourcesRes, pagesRes] = await Promise.all([
        fetch('/api/sources'),
        fetch('/api/pages')
      ]);
      const sources = await sourcesRes.json();
      const pages = await pagesRes.json();

      const pageSelect = document.getElementById('source-page');
      pageSelect.innerHTML = '<option value="">Select Connected Page</option>' +
        pages.map(p => \`<option value="\${p.id}">\${p.name} (\${p.id})</option>\`).join('');

      const list = document.getElementById('sources-list');
      if (sources.length === 0) {
        list.innerHTML = '<div class="text-sm text-slate-500">No RSS sources added yet.</div>';
      } else {
        list.innerHTML = sources.map(s => \`
          <div class="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div>
              <div class="font-medium text-slate-200">\${s.name}</div>
              <div class="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-md">\${s.url}</div>
              <div class="text-xs text-slate-500 mt-1">Page: \${s.page_name || s.page_id} | Template: \${s.template_id}</div>
            </div>
            <button onclick="deleteSource('\${s.id}')" class="text-xs text-red-400 hover:text-red-300 px-3 py-1 bg-red-950/40 rounded border border-red-800/40">Delete</button>
          </div>
        \`).join('');
      }
    }

    async function handleAddSource(e) {
      e.preventDefault();
      const payload = {
        name: document.getElementById('source-name').value,
        url: document.getElementById('source-url').value,
        page_id: document.getElementById('source-page').value,
        template_id: document.getElementById('source-template').value,
      };

      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (d.success) {
        showToast('Source added successfully!');
        document.getElementById('add-source-form').reset();
        loadSources();
      } else {
        showToast(d.error || 'Failed to add source', true);
      }
    }

    async function deleteSource(id) {
      if (!confirm('Are you sure you want to delete this source?')) return;
      await fetch('/api/sources/' + id, { method: 'DELETE' });
      showToast('Source deleted');
      loadSources();
    }

    async function loadPages() {
      const res = await fetch('/api/pages');
      const pages = await res.json();
      const list = document.getElementById('pages-list');
      if (pages.length === 0) {
        list.innerHTML = '<div class="text-sm text-slate-500">No Facebook Pages connected yet.</div>';
      } else {
        list.innerHTML = pages.map(p => \`
          <div class="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div>
              <div class="font-medium text-slate-200">\${p.name}</div>
              <div class="text-xs text-slate-400 font-mono mt-0.5">Page ID: \${p.id}</div>
              <div class="text-xs text-slate-500 mt-1">Token: \${p.token_expires_at ? 'Expires ' + new Date(p.token_expires_at).toLocaleDateString() : 'Never expires (Long-Lived)'}</div>
            </div>
            <button onclick="deletePage('\${p.id}')" class="text-xs text-red-400 hover:text-red-300 px-3 py-1 bg-red-950/40 rounded border border-red-800/40">Delete</button>
          </div>
        \`).join('');
      }
    }

    async function testPageToken() {
      const token = document.getElementById('page-token').value;
      if (!token) return alert('Enter token first');
      const box = document.getElementById('token-test-result');
      box.innerText = 'Testing token via Facebook Graph API...';
      box.classList.remove('hidden');

      const res = await fetch('/api/pages/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
      });
      const d = await res.json();
      box.innerHTML = \`<pre class="overflow-x-auto text-emerald-400">\${JSON.stringify(d, null, 2)}</pre>\`;
    }

    async function handleAddPage(e) {
      e.preventDefault();
      const payload = {
        id: document.getElementById('page-id').value,
        name: document.getElementById('page-name').value,
        access_token: document.getElementById('page-token').value,
      };

      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (d.success) {
        showToast('Page connected successfully!');
        document.getElementById('add-page-form').reset();
        document.getElementById('token-test-result').classList.add('hidden');
        loadPages();
      } else {
        showToast(d.error || 'Failed to save page', true);
      }
    }

    async function deletePage(id) {
      if (!confirm('Are you sure you want to delete this page?')) return;
      await fetch('/api/pages/' + id, { method: 'DELETE' });
      showToast('Page removed');
      loadPages();
    }

    async function renderPreview() {
      const spinner = document.getElementById('preview-spinner');
      const img = document.getElementById('preview-img');
      const placeholder = document.getElementById('preview-placeholder');
      const meta = document.getElementById('preview-meta');

      spinner.classList.remove('hidden');
      meta.innerText = 'Compiling HTML/CSS and rendering with Playwright...';

      try {
        const payload = {
          templateId: document.getElementById('preview-template').value,
          category: document.getElementById('preview-category').value,
          headline: document.getElementById('preview-headline').value,
          imageUrl: document.getElementById('preview-image').value,
        };

        const res = await fetch('/api/preview/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          img.src = data.imageUri;
          img.classList.remove('hidden');
          placeholder.classList.add('hidden');
          meta.innerText = 'Render complete (' + Math.round(data.sizeBytes / 1024) + ' KB)';
        } else {
          meta.innerText = 'Render failed: ' + data.error;
          showToast(data.error || 'Preview failed', true);
        }
      } catch (e) {
        meta.innerText = 'Error: ' + e.message;
        showToast('Error rendering preview', true);
      } finally {
        spinner.classList.add('hidden');
      }
    }

    async function loadSettings() {
      const res = await fetch('/api/settings');
      const d = await res.json();
      document.getElementById('setting-cron').value = d.POLL_INTERVAL_CRON || '*/10 * * * *';
      document.getElementById('setting-age').value = d.MAX_ARTICLE_AGE_HOURS || 24;
      document.getElementById('setting-cap').value = d.MAX_POSTS_PER_HOUR || 10;
      document.getElementById('setting-min-delay').value = d.MIN_DELAY_SECONDS || 30;
      document.getElementById('setting-max-delay').value = d.MAX_DELAY_SECONDS || 60;
      document.getElementById('setting-hashtags').value = d.DEFAULT_HASHTAGS || '';
      document.getElementById('setting-caption-format').value = d.DEFAULT_CAPTION_FORMAT || '';
      document.getElementById('setting-comment-format').value = d.DEFAULT_COMMENT_FORMAT || '';
    }

    async function handleSaveSettings(e) {
      e.preventDefault();
      const payload = {
        POLL_INTERVAL_CRON: document.getElementById('setting-cron').value,
        MAX_ARTICLE_AGE_HOURS: document.getElementById('setting-age').value,
        MAX_POSTS_PER_HOUR: document.getElementById('setting-cap').value,
        MIN_DELAY_SECONDS: document.getElementById('setting-min-delay').value,
        MAX_DELAY_SECONDS: document.getElementById('setting-max-delay').value,
        DEFAULT_HASHTAGS: document.getElementById('setting-hashtags').value,
        DEFAULT_CAPTION_FORMAT: document.getElementById('setting-caption-format').value,
        DEFAULT_COMMENT_FORMAT: document.getElementById('setting-comment-format').value,
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (d.success) {
        showToast('Settings saved successfully!');
      } else {
        showToast(d.error || 'Failed to save settings', true);
      }
    }

    // Initial load
    loadOverview();
  </script>
</body>
</html>`;

  res.send(html);
});

