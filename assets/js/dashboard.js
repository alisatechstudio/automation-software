// --- PARTICLE BACKGROUND ---
    (function initBackgroundCanvas() {
      const canvas = document.getElementById('bg-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let w = canvas.width = window.innerWidth;
      let h = canvas.height = window.innerHeight;

      const particles = [];
      const particleCount = Math.min(Math.floor(w / 35), 35);

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.5 + 0.5,
          color: Math.random() > 0.6 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(6, 182, 212, 0.25)'
        });
      }

      function animate() {
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();

          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
            if (dist < 100) {
              ctx.beginPath();
              ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.05 * (1 - dist / 100)) + ')';
              ctx.lineWidth = 0.5;
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }
        requestAnimationFrame(animate);
      }
      animate();

      window.addEventListener('resize', () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
      });
    })();

    // --- TOAST NOTIFICATIONS ---
    function showToast(msg, isError = false) {
      const toast = document.getElementById('toast');
      if (!toast) return;
      const icon = isError ? '⚠️' : '✓';
      toast.innerHTML = '<span>' + icon + '</span> <span>' + msg + '</span>';
      toast.className = 'fixed bottom-5 right-5 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl transition-all duration-300 z-50 flex items-center gap-2 backdrop-blur-xl border ' +
        (isError 
          ? 'bg-red-950/90 border-red-700/80 text-red-200 shadow-glow-red' 
          : 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200 shadow-glow-emerald');
      toast.classList.remove('hidden');
      setTimeout(() => { toast.classList.add('hidden'); }, 3500);
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // --- CRON-JOB.ORG URL HELPERS ---
    function copyCronUrl(path, btnElement) {
      const fullUrl = window.location.origin + path;
      navigator.clipboard.writeText(fullUrl).then(() => {
        showToast('✓ Copied Webhook URL!');
        if (btnElement) {
          const originalText = btnElement.innerText;
          btnElement.innerText = '✓ Copied!';
          btnElement.classList.add('bg-emerald-600', 'text-white');
          setTimeout(() => {
            btnElement.innerText = originalText;
            btnElement.classList.remove('bg-emerald-600', 'text-white');
          }, 2000);
        }
      }).catch(() => {
        prompt('Copy Webhook URL:', fullUrl);
      });
    }

    async function testCronJob(path, resultElId, btnElement) {
      const resultEl = document.getElementById(resultElId);
      if (btnElement) {
        btnElement.disabled = true;
        btnElement.classList.add('opacity-50');
      }
      if (resultEl) {
        resultEl.classList.remove('hidden');
        resultEl.innerHTML = '<span class="text-slate-400 animate-pulse">Running test trigger...</span>';
      }

      const startTime = performance.now();
      try {
        const res = await safeFetchJson(path);
        const duration = Math.round(performance.now() - startTime);
        if (resultEl) {
          if (res.ok && res.data?.success) {
            const extra = res.data.message || (res.data.job ? 'Job: ' + res.data.job : '') || 'OK';
            resultEl.innerHTML = '<span class="text-emerald-400 font-semibold">✓ 200 OK (' + duration + 'ms)</span>: <span class="text-slate-300">' + escapeHtml(String(extra)) + '</span>';
            showToast('✓ Test passed (' + duration + 'ms)');
          } else {
            const err = res.data?.error || res.error || 'Failed';
            resultEl.innerHTML = '<span class="text-red-400 font-semibold">✕ Failed (' + duration + 'ms)</span>: <span class="text-red-300">' + escapeHtml(String(err)) + '</span>';
            showToast('Test failed: ' + err, true);
          }
        }
      } catch (e) {
        const duration = Math.round(performance.now() - startTime);
        if (resultEl) {
          resultEl.innerHTML = '<span class="text-red-400 font-semibold">✕ Error (' + duration + 'ms)</span>: <span class="text-red-300">' + escapeHtml(e.message) + '</span>';
        }
      } finally {
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.classList.remove('opacity-50');
        }
      }
    }

    async function initCronPills() {
      document.querySelectorAll('[data-cron-path]').forEach(el => {
        const path = el.getAttribute('data-cron-path');
        if (path) {
          const fullUrl = window.location.origin + path;
          if (el.tagName === 'INPUT') {
            el.value = fullUrl;
          } else {
            el.innerText = fullUrl;
          }
        }
      });

      // Update auth status badge
      try {
        const res = await safeFetchJson('/api/cron');
        const badge = document.getElementById('cron-auth-badge');
        if (badge && res.ok && res.data) {
          if (res.data.cronSecretConfigured) {
            badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span class="text-emerald-300 font-semibold">CRON_SECRET Active (Protected)</span>';
          } else {
            badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span><span class="text-cyan-300">Open Access (No Secret Required)</span>';
          }
        }
      } catch (e) {}
    }

    // --- TAB SWITCHING ---
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-red-400', 'bg-red-950/40', 'border-red-800/50', 'shadow-inner');
        btn.classList.add('text-slate-400', 'border-transparent');
      });
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

      const allBtns = Array.from(document.querySelectorAll('.tab-btn'));
      const matchedBtn = (typeof event !== 'undefined' && event && event.currentTarget && event.currentTarget.classList) 
        ? event.currentTarget 
        : allBtns.find(b => (b.getAttribute('onclick') || '').includes(tabId));
      if (matchedBtn) {
        matchedBtn.classList.add('text-red-400', 'bg-red-950/40', 'border-red-800/50', 'shadow-inner');
        matchedBtn.classList.remove('text-slate-400', 'border-transparent');
      }
      
      const targetTab = document.getElementById('tab-' + tabId);
      if (targetTab) targetTab.classList.remove('hidden');

      if (tabId === 'overview') loadOverview();
      if (tabId === 'queue') loadQueue();
      if (tabId === 'sources') loadSources();
      if (tabId === 'pages') loadPages();
      if (tabId === 'groups') loadGroups();
      if (tabId === 'reels') loadReels();
      if (tabId === 'gdrive-reels') loadGDriveReels();
      if (tabId === 'youtube') loadYouTube();
      if (tabId === 'settings') loadSettings();
    }

    // --- SAFE JSON FETCHER ---
    async function safeFetchJson(url, options) {
      try {
        const res = await fetch(url, options);
        const text = await res.text();
        try {
          return { ok: res.ok, status: res.status, data: JSON.parse(text) };
        } catch {
          return { ok: false, status: res.status, error: text || 'Non-JSON response' };
        }
      } catch (err) {
        return { ok: false, status: 0, error: err.message };
      }
    }

    // --- UNIVERSAL SLEEK PAGINATION COMPONENT ---
    function renderPagination(containerId, currentPage, totalPages, totalItems, onPageChangeFnName, pageSize) {
      const el = document.getElementById(containerId);
      if (!el) return;
      if (!totalItems || totalItems === 0) {
        el.innerHTML = '';
        return;
      }
      const size = pageSize || 10;
      const startItem = (currentPage - 1) * size + 1;
      const endItem = Math.min(currentPage * size, totalItems);

      if (totalPages <= 1) {
        el.innerHTML = 
          '<div class="flex items-center justify-between px-3.5 py-2 text-[10px] font-mono text-slate-400 bg-slate-950/70 border-t border-slate-800/80">' +
            '<div>Showing <span class="text-slate-200 font-semibold">' + startItem + '-' + endItem + '</span> of <span class="text-slate-200 font-semibold">' + totalItems + '</span></div>' +
            '<div class="text-slate-500">Page 1 of 1</div>' +
          '</div>';
        return;
      }

      const prevDisabled = currentPage <= 1;
      const nextDisabled = currentPage >= totalPages;

      let pagesHtml = '';
      const maxButtons = 5;
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, startPage + maxButtons - 1);
      if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
      }

      for (let p = startPage; p <= endPage; p++) {
        if (p === currentPage) {
          pagesHtml += '<span class="px-2 py-0.5 text-xs font-bold rounded bg-red-600 text-white shadow-sm">' + p + '</span>';
        } else {
          pagesHtml += '<button onclick="' + onPageChangeFnName + '(' + p + ')" class="px-2 py-0.5 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition">' + p + '</button>';
        }
      }

      el.innerHTML =
        '<div class="flex flex-col sm:flex-row items-center justify-between gap-1.5 px-3.5 py-2 text-[10px] font-mono text-slate-400 bg-slate-950/80 border-t border-slate-800/80">' +
          '<div>Showing <span class="text-slate-200 font-semibold">' + startItem + '-' + endItem + '</span> of <span class="text-slate-200 font-semibold">' + totalItems + '</span></div>' +
          '<div class="flex items-center gap-1">' +
            '<button ' + (prevDisabled ? 'disabled class="opacity-30 cursor-not-allowed px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-500 text-xs"' : 'onclick="' + onPageChangeFnName + '(' + (currentPage - 1) + ')" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded text-xs transition cursor-pointer active:scale-95"') + '>&laquo; Prev</button>' +
            '<div class="flex items-center gap-1 mx-0.5">' + pagesHtml + '</div>' +
            '<button ' + (nextDisabled ? 'disabled class="opacity-30 cursor-not-allowed px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-500 text-xs"' : 'onclick="' + onPageChangeFnName + '(' + (currentPage + 1) + ')" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded text-xs transition cursor-pointer active:scale-95"') + '>Next &raquo;</button>' +
          '</div>' +
        '</div>';
    }

    // --- OVERVIEW STATS ---
    async function loadOverview() {
      try {
        const res = await safeFetchJson('/api/stats');
        if (res.ok && res.data) {
          const data = res.data;
          animateValue('stat-pending', data.queue?.pending || 0);
          animateValue('stat-published', data.successfulPosts || 0);
          animateValue('stat-sources', data.sourcesCount || 0);
          animateValue('stat-pages', data.pagesCount || 0);

          const badge = document.getElementById('dry-run-badge');
          const radar = document.getElementById('status-pulse-radar');
          if (data.dryRun) {
            badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span><span>DRY RUN</span>';
            badge.className = 'relative px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/40 flex items-center gap-1.5';
            if (radar) radar.classList.add('hidden');
          } else {
            badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span><span>META LIVE</span>';
            badge.className = 'relative px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/50 shadow-glow-emerald flex items-center gap-1.5';
            if (radar) radar.classList.remove('hidden');
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    function animateValue(id, end) {
      const el = document.getElementById(id);
      if (!el) return;
      const start = parseInt(el.innerText) || 0;
      if (start === end) { el.innerText = end; return; }
      const duration = 500;
      let startTime = null;
      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        el.innerText = Math.floor(progress * (end - start) + start);
        if (progress < 1) requestAnimationFrame(step);
        else el.innerText = end;
      }
      requestAnimationFrame(step);
    }

    // --- ACTIONS ---
    async function triggerInputCronNow() {
      showToast('📥 Starting Input Cron: Fetching RSS ➔ Creating Reels ➔ Saving to Drive Folder...');
      const res = await safeFetchJson('/api/pipeline/run-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      if (res.ok && res.data?.success) {
        showToast('✓ Input Cron Complete: Created ' + (res.data.totalReelsCreated || 0) + ' reels & saved to Drive!');
        loadOverview();
        if (typeof loadSources === 'function') loadSources();
      } else {
        showToast(res.data?.error || res.error || 'Input Cron failed', true);
      }
    }

    async function triggerOutputCronNow() {
      showToast('📤 Starting Output Cron: Getting oldest videos from Drive ➔ Broadcasting to FB, YouTube, TikTok...');
      const res = await safeFetchJson('/api/pipeline/run-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      if (res.ok && res.data?.success) {
        showToast('✓ Output Cron Complete! Broadcasted oldest reels to linked social networks.');
        loadOverview();
        if (typeof refreshGDriveChannels === 'function') refreshGDriveChannels();
      } else {
        showToast(res.data?.error || res.error || 'Output Cron failed', true);
      }
    }

    async function triggerPollNow() {
      showToast('Polling RSS feeds...');
      const res = await safeFetchJson('/api/poll-now', { method: 'POST' });
      if (res.ok) {
        showToast('✓ RSS polling complete!');
        loadOverview();
      } else {
        showToast(res.data?.error || res.error || 'Poll failed', true);
      }
    }

    async function publishNextNow() {
      showToast('Publishing next article...');
      const res = await safeFetchJson('/api/queue/publish-next', { method: 'POST' });
      if (res.ok && res.data.success) {
        showToast('✓ Article published to Facebook!');
        loadOverview();
        loadQueue();
      } else {
        showToast(res.data?.error || res.error || 'Publish failed', true);
      }
    }

    async function resetUnpostedArticles() {
      if (!confirm('Re-queue all articles with missing post IDs?')) return;
      showToast('Re-queueing unposted articles...');
      const res = await safeFetchJson('/api/queue/reset-unposted', { method: 'POST' });
      if (res.ok && res.data.success) {
        showToast('✓ ' + (res.data.message || 'Articles re-queued!'));
        loadOverview();
        loadQueue();
      } else {
        showToast(res.data?.error || 'Re-queue failed', true);
      }
    }

    // --- QUEUE & LOGS (PAGINATED) ---
    let queueJobsData = [];
    let queuePage = 1;
    const QUEUE_PAGE_SIZE = 10;
    let queuePageFilter = 'all';

    function filterQueuePage(pageId, btn) {
      queuePageFilter = pageId;
      document.querySelectorAll('.queue-filter-btn').forEach(b => {
        b.className = 'queue-filter-btn px-2.5 py-1 rounded-md bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200 transition text-[11px]';
      });
      if (btn) {
        btn.className = 'queue-filter-btn px-2.5 py-1 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold transition text-[11px]';
      }
      queuePage = 1;
      renderQueuePage(1);
    }

    let logsData = [];
    let logsPage = 1;
    const LOGS_PAGE_SIZE = 10;

    function changeQueuePage(page) {
      queuePage = page;
      renderQueuePage(queuePage);
    }

    function renderQueuePage(page) {
      const tbody = document.getElementById('queue-table-body');
      if (!tbody) return;

      const tnwCount = queueJobsData.filter(j => j.pageId === '1526917347161119' || j.page_id === '1526917347161119' || (j.page_name && j.page_name.includes('Trending'))).length;
      const bdCount = queueJobsData.filter(j => j.pageId === '1405135646008133' || j.page_id === '1405135646008133' || (j.page_name && j.page_name.includes('BD News'))).length;
      const elAll = document.getElementById('q-count-all');
      const elTnw = document.getElementById('q-count-tnw');
      const elBd = document.getElementById('q-count-bd');
      if (elAll) elAll.innerText = queueJobsData.length;
      if (elTnw) elTnw.innerText = tnwCount;
      if (elBd) elBd.innerText = bdCount;

      let filteredJobs = queueJobsData;
      if (queuePageFilter !== 'all') {
        filteredJobs = filteredJobs.filter(j =>
          j.pageId === queuePageFilter ||
          j.page_id === queuePageFilter ||
          (j.page_name && j.page_name.toLowerCase().includes(queuePageFilter.toLowerCase()))
        );
      }

      const total = filteredJobs.length;
      const totalPages = Math.ceil(total / QUEUE_PAGE_SIZE);
      const start = (page - 1) * QUEUE_PAGE_SIZE;
      const pageJobs = filteredJobs.slice(start, start + QUEUE_PAGE_SIZE);

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500 font-mono text-xs">Queue is currently empty for this selection.</td></tr>';
        renderPagination('queue-pagination', 1, 0, 0, 'changeQueuePage', QUEUE_PAGE_SIZE);
        return;
      }

      tbody.innerHTML = pageJobs.map(j => 
        '<tr class="hover:bg-slate-800/40 transition">' +
          '<td class="px-3.5 py-2">' +
            '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ' +
              (j.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
               j.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
               j.status === 'processing' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
               'bg-amber-500/10 text-amber-400 border border-amber-500/30') +
            '">' + j.status + '</span>' +
          '</td>' +
          '<td class="px-3.5 py-2 font-medium text-slate-200 max-w-[240px] truncate bn" title="' + (j.article_title || '') + '">' + (j.article_title || 'Pending Ingestion') + '</td>' +
          '<td class="px-3.5 py-2 text-slate-400 font-mono text-[11px] truncate max-w-[110px]">' + (j.page_name || 'All') + '</td>' +
          '<td class="px-3.5 py-2 text-slate-400 font-mono text-[11px]">' + j.attempts + '/' + j.max_attempts + '</td>' +
          '<td class="px-3.5 py-2 text-slate-400 font-mono text-[11px] whitespace-nowrap">' + new Date(j.run_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + '</td>' +
          '<td class="px-3.5 py-2 text-right">' +
            '<button data-id="' + j.id + '" onclick="retryJob(this.dataset.id)" class="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-red-600/30 text-slate-300 hover:text-red-300 border border-slate-700 transition active:scale-95">Run</button>' +
          '</td>' +
        '</tr>'
      ).join('');

      renderPagination('queue-pagination', page, totalPages, total, 'changeQueuePage', QUEUE_PAGE_SIZE);
    }

    function changeLogsPage(page) {
      logsPage = page;
      renderLogsPage(logsPage);
    }

    function renderLogsPage(page) {
      const tbody = document.getElementById('logs-table-body');
      if (!tbody) return;
      const total = logsData.length;
      const totalPages = Math.ceil(total / LOGS_PAGE_SIZE);
      const start = (page - 1) * LOGS_PAGE_SIZE;
      const pageLogs = logsData.slice(start, start + LOGS_PAGE_SIZE);

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500 font-mono text-xs">No publication history recorded yet.</td></tr>';
        renderPagination('logs-pagination', 1, 0, 0, 'changeLogsPage', LOGS_PAGE_SIZE);
        return;
      }

      tbody.innerHTML = pageLogs.map(l => {
        const isLiveSuccess = (l.status === 'success' || l.status === 'dry_run') && (l.status === 'dry_run' || !!l.fb_post_id);
        const badgeClass = isLiveSuccess
          ? (l.status === 'dry_run' ? 'text-blue-400 bg-blue-950/60 border border-blue-800/50' : 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/50')
          : 'text-red-400 bg-red-950/60 border border-red-800/50';
        const displayStatus = (!l.fb_post_id && l.status === 'success') ? 'FAILED' : l.status;

        const postLink = l.fb_post_id ? (
          '<a href="https://www.facebook.com/' + (l.fb_photo_id || (l.fb_post_id.includes('_') ? l.fb_post_id.split('_')[1] : l.fb_post_id)) + '" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 underline font-bold" title="View live on FB">' +
            l.fb_post_id + ' ↗' +
          '</a>'
        ) : '<span class="text-slate-500">-</span>';

        return '<tr class="hover:bg-slate-800/40 text-xs transition">' +
          '<td class="px-3.5 py-2">' +
            '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ' + badgeClass + '">' + displayStatus + '</span>' +
            (l.error_message ? '<div class="text-[10px] text-red-400 font-mono mt-0.5 max-w-[200px] truncate" title="' + l.error_message.replace(/"/g, '&quot;') + '">' + l.error_message + '</div>' : '') +
          '</td>' +
          '<td class="px-3.5 py-2 text-slate-200 max-w-[240px] truncate bn font-medium" title="' + (l.article_title || '') + '">' + (l.article_title || '') + '</td>' +
          '<td class="px-3.5 py-2 font-mono text-[11px]">' + postLink + '</td>' +
          '<td class="px-3.5 py-2 text-slate-400 font-mono text-[11px]">' + (l.duration_ms ? l.duration_ms + 'ms' : '-') + '</td>' +
          '<td class="px-3.5 py-2 text-slate-500 font-mono text-[11px] whitespace-nowrap">' + new Date(l.created_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) + '</td>' +
        '</tr>';
      }).join('');

      renderPagination('logs-pagination', page, totalPages, total, 'changeLogsPage', LOGS_PAGE_SIZE);
    }

    async function loadQueue() {
      try {
        const [qRes, lRes] = await Promise.all([
          safeFetchJson('/api/queue'),
          safeFetchJson('/api/logs')
        ]);
        queueJobsData = (qRes.ok && Array.isArray(qRes.data)) ? qRes.data : [];
        logsData = (lRes.ok && Array.isArray(lRes.data)) ? lRes.data : [];

        queuePage = 1;
        logsPage = 1;
        renderQueuePage(1);
        renderLogsPage(1);
      } catch (e) {
        console.error(e);
      }
    }

    async function retryJob(id) {
      try {
        const res = await safeFetchJson('/api/queue/' + id + '/retry', { method: 'POST' });
        if (res.data?.success) {
          showToast('Job queued for immediate publishing!');
          loadQueue();
        } else {
          showToast(res.data?.error || 'Retry failed', true);
        }
      } catch (e) {
        showToast('Error retrying job', true);
      }
    }

    // --- RSS SOURCES (PAGINATED) ---
    let sourcesData = [];
    let sourcesPage = 1;
    const SOURCES_PAGE_SIZE = 5;

    function changeSourcesPage(page) {
      sourcesPage = page;
      renderSourcesPage(sourcesPage);
    }

    function renderSourcesPage(page) {
      const list = document.getElementById('sources-list');
      if (!list) return;
      const total = sourcesData.length;
      const totalPages = Math.ceil(total / SOURCES_PAGE_SIZE);
      const start = (page - 1) * SOURCES_PAGE_SIZE;
      const pageSources = sourcesData.slice(start, start + SOURCES_PAGE_SIZE);

      if (total === 0) {
        list.innerHTML = '<div class="text-xs text-slate-500 font-mono py-4">No RSS sources added yet.</div>';
        renderPagination('sources-pagination', 1, 0, 0, 'changeSourcesPage', SOURCES_PAGE_SIZE);
        return;
      }

      list.innerHTML = pageSources.map(s => {
        const driveLabel = s.gdrive_folder_url
          ? '📁 Drive: ' + (s.gdrive_folder_id || s.gdrive_folder_url.slice(0, 20))
          : '📁 Drive: Page Default';
        const themeLabel = s.reel_theme || 'auto-category';
        return '<div class="flex items-center justify-between p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 hover:border-slate-700 transition">' +
          '<div class="min-w-0 flex-1 pr-3">' +
            '<div class="font-bold text-xs text-slate-100 flex items-center gap-1.5 truncate">' +
              '<span>' + s.name + '</span>' +
              '<span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-950/60 text-cyan-400 border border-cyan-800/50">Active</span>' +
              '<span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">' + driveLabel + '</span>' +
            '</div>' +
            '<div class="text-[11px] text-slate-400 font-mono truncate mt-0.5">' + s.url + '</div>' +
            '<div class="text-[10px] text-slate-500 font-mono mt-0.5 truncate">Page: ' + (s.page_name || s.page_id) + ' | Theme: ' + themeLabel + ' | Template: ' + s.template_id + '</div>' +
          '</div>' +
          '<button onclick="deleteSource(\\\'' + s.id + '\\\')" class="text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1 bg-rose-950/40 rounded border border-rose-800/50 transition">Delete</button>' +
        '</div>';
      }).join('');

      renderPagination('sources-pagination', page, totalPages, total, 'changeSourcesPage', SOURCES_PAGE_SIZE);
    }

    async function loadSources() {
      const [sRes, pRes] = await Promise.all([
        safeFetchJson('/api/sources'),
        safeFetchJson('/api/pages')
      ]);
      sourcesData = (sRes.ok && Array.isArray(sRes.data)) ? sRes.data : [];
      const pages = (pRes.ok && Array.isArray(pRes.data)) ? pRes.data : [];

      const pageSelect = document.getElementById('source-page');
      if (pageSelect) {
        pageSelect.innerHTML = '<option value="">Select Connected Page</option>' +
          pages.map(p => '<option value="' + p.id + '">' + p.name + ' (' + p.id + ')</option>').join('');
      }

      sourcesPage = 1;
      renderSourcesPage(1);
    }

    async function handleAddSource(e) {
      e.preventDefault();
      const payload = {
        name: document.getElementById('source-name').value,
        url: document.getElementById('source-url').value,
        page_id: document.getElementById('source-page').value,
        template_id: document.getElementById('source-template').value,
        gdrive_folder_url: document.getElementById('source-gdrive-folder') ? document.getElementById('source-gdrive-folder').value : '',
        reel_theme: document.getElementById('source-reel-theme') ? document.getElementById('source-reel-theme').value : 'auto-category',
      };

      const res = await safeFetchJson('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.data?.success) {
        showToast('Source added successfully with linked Drive folder!');
        document.getElementById('add-source-form').reset();
        loadSources();
      } else {
        showToast(res.data?.error || 'Failed to add source', true);
      }
    }

    async function deleteSource(id) {
      if (!confirm('Delete this source?')) return;
      await safeFetchJson('/api/sources/' + id, { method: 'DELETE' });
      showToast('Source deleted');
      loadSources();
    }

    // --- FACEBOOK PAGES (PAGINATED) ---
    let pagesData = [];
    let pagesPage = 1;
    const PAGES_PAGE_SIZE = 5;

    function changePagesPage(page) {
      pagesPage = page;
      renderPagesPage(pagesPage);
    }

    function renderPagesPage(page) {
      const list = document.getElementById('pages-list');
      if (!list) return;
      const total = pagesData.length;
      const totalPages = Math.ceil(total / PAGES_PAGE_SIZE);
      const start = (page - 1) * PAGES_PAGE_SIZE;
      const pagePages = pagesData.slice(start, start + PAGES_PAGE_SIZE);

      if (total === 0) {
        list.innerHTML = '<div class="text-xs text-slate-500 font-mono py-4">No Facebook Pages connected yet.</div>';
        renderPagination('pages-pagination', 1, 0, 0, 'changePagesPage', PAGES_PAGE_SIZE);
        return;
      }

      list.innerHTML = pagePages.map(p => 
        '<div class="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 hover:border-slate-700 transition space-y-2">' +
          '<div class="flex items-center justify-between">' +
            '<div>' +
              '<div class="font-bold text-xs text-slate-100 flex items-center gap-1.5">' +
                '<span>' + p.name + '</span>' +
                '<span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">Connected</span>' +
              '</div>' +
              '<div class="text-[11px] text-slate-400 font-mono mt-0.5">ID: ' + p.id + '</div>' +
              '<div class="text-[10px] text-slate-500 font-mono">' + (p.token_expires_at ? 'Expires ' + new Date(p.token_expires_at).toLocaleDateString() : 'Permanent Token') + '</div>' +
            '</div>' +
            '<div class="flex gap-1.5">' +
              '<button onclick="diagnosePageToken(\\\'' + p.id + '\\\')" class="text-[11px] text-amber-400 hover:text-amber-300 px-2.5 py-1 bg-amber-950/40 rounded border border-amber-800/50 transition font-mono">Diagnose</button>' +
              '<button onclick="deletePage(\\\'' + p.id + '\\\')" class="text-[11px] text-rose-400 hover:text-rose-300 px-2.5 py-1 bg-rose-950/40 rounded border border-rose-800/50 transition">Delete</button>' +
            '</div>' +
          '</div>' +
          '<div class="pt-2 border-t border-slate-900 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">' +
            '<div class="bg-slate-900/60 p-2 rounded border border-slate-800/60 space-y-1">' +
              '<div class="flex items-center justify-between">' +
                '<span class="text-cyan-400 font-bold">📰 RSS / Post Cron</span>' +
                '<button data-path="/api/cron/publish?pageId=' + p.id + '" onclick="copyCronUrl(this.dataset.path, this)" class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition">Copy</button>' +
              '</div>' +
              '<div class="text-[9px] text-slate-400 truncate">/api/cron/publish?pageId=' + p.id + '</div>' +
            '</div>' +
            '<div class="bg-slate-900/60 p-2 rounded border border-slate-800/60 space-y-1">' +
              '<div class="flex items-center justify-between">' +
                '<span class="text-emerald-400 font-bold">🎬 GDrive Reels Cron</span>' +
                '<button data-path="/api/cron/gdrive-reels?pageId=' + p.id + '" onclick="copyCronUrl(this.dataset.path, this)" class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition">Copy</button>' +
              '</div>' +
              '<div class="text-[9px] text-slate-400 truncate">/api/cron/gdrive-reels?pageId=' + p.id + '</div>' +
            '</div>' +
          '</div>' +
          '<div id="diagnose-result-' + p.id + '" class="hidden text-xs p-2.5 rounded font-mono"></div>' +
        '</div>'
      ).join('');

      renderPagination('pages-pagination', page, totalPages, total, 'changePagesPage', PAGES_PAGE_SIZE);
    }

    async function loadPages() {
      const res = await safeFetchJson('/api/pages');
      pagesData = (res.ok && Array.isArray(res.data)) ? res.data : [];
      pagesPage = 1;
      renderPagesPage(1);
    }

    async function diagnosePageToken(id) {
      const box = document.getElementById('diagnose-result-' + id);
      if (!box) return;
      box.classList.remove('hidden');
      box.className = 'text-xs p-3 rounded font-mono bg-slate-900 border border-slate-800 text-slate-300';
      box.innerHTML = 'Diagnosing token permissions...';

      try {
        const res = await safeFetchJson('/api/pages/' + id + '/diagnose');
        if (!res.ok) {
          box.className = 'text-xs p-3 rounded font-mono bg-rose-950/60 border border-rose-800 text-rose-300';
          box.innerHTML = 'Error: ' + (res.data?.error || res.status);
          return;
        }
        const d = res.data || {};
        const isOk = d.canPost && d.isPageToken;
        box.className = isOk
          ? 'text-xs p-3 rounded font-mono bg-emerald-950/60 border border-emerald-800 text-emerald-300 space-y-1'
          : 'text-xs p-3 rounded font-mono bg-amber-950/60 border border-amber-800 text-amber-300 space-y-1';

        box.innerHTML = 
          '<div class="font-bold text-xs mb-1">' + (isOk ? '✓ Token Verified' : '⚠️ Attention') + '</div>' +
          '<div>' + d.diagnosis + '</div>' +
          '<div>Type: ' + (d.tokenType || 'Unknown') + '</div>' +
          '<div>Scopes: ' + ((d.scopes || []).join(', ') || 'None') + '</div>';
      } catch (err) {
        box.className = 'text-xs p-3 rounded font-mono bg-rose-950/60 border border-rose-800 text-rose-300';
        box.innerHTML = 'Diagnosis failed: ' + err.message;
      }
    }

    async function testPageToken() {
      const token = document.getElementById('page-token').value;
      if (!token) return alert('Enter token first');
      const box = document.getElementById('token-test-result');
      box.innerText = 'Testing token...';
      box.classList.remove('hidden');

      const res = await fetch('/api/pages/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
      });
      const d = await res.json();
      box.innerHTML = '<pre class="overflow-x-auto text-emerald-400 text-[10px]">' + JSON.stringify(d, null, 2) + '</pre>';
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
      if (!confirm('Delete this page?')) return;
      await fetch('/api/pages/' + id, { method: 'DELETE' });
      showToast('Page removed');
      loadPages();
    }

    // --- FACEBOOK GROUPS (PAGINATED) ---
    let groupsData = [];
    let groupsPage = 1;
    const GROUPS_PAGE_SIZE = 6;

    let groupSharesData = [];
    let groupSharesPage = 1;
    const GROUP_SHARES_PAGE_SIZE = 10;

    function changeGroupsPage(page) {
      groupsPage = page;
      renderGroupsPage(groupsPage);
    }

    function renderGroupsPage(page) {
      const container = document.getElementById('groups-container');
      if (!container) return;
      const total = groupsData.length;
      const totalPages = Math.ceil(total / GROUPS_PAGE_SIZE);
      const start = (page - 1) * GROUPS_PAGE_SIZE;
      const pageGroups = groupsData.slice(start, start + GROUPS_PAGE_SIZE);

      if (total === 0) {
        container.innerHTML = 
          '<div class="col-span-full py-8 px-4 text-center glass-panel rounded-xl border border-dashed border-slate-800 space-y-2">' +
            '<div class="w-10 h-10 mx-auto rounded-xl bg-emerald-950/60 text-emerald-400 flex items-center justify-center text-lg">👥</div>' +
            '<h4 class="text-sm font-bold text-slate-200">No Facebook Groups configured</h4>' +
            '<button onclick="openAddGroupModal()" class="mt-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition">+ Add Group</button>' +
          '</div>';
        renderPagination('groups-pagination', 1, 0, 0, 'changeGroupsPage', GROUPS_PAGE_SIZE);
        return;
      }

      container.innerHTML = pageGroups.map(g => {
        const categories = Array.isArray(g.categories) ? g.categories : ['all'];
        const catPills = categories.map(c => 
          c.toLowerCase() === 'all'
            ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">সকল</span>'
            : '<span class="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-900 text-slate-300 border border-slate-700">' + c + '</span>'
        ).join(' ');

        return '<div class="glass-panel rounded-xl p-3.5 border ' + (g.autoShare ? 'border-emerald-500/30' : 'border-slate-800') + ' flex flex-col justify-between space-y-2.5">' +
          '<div class="space-y-2">' +
            '<div class="flex items-start justify-between gap-2">' +
              '<div class="min-w-0 flex-1">' +
                '<h4 class="font-bold text-xs text-slate-100 truncate">' + g.name + '</h4>' +
                '<div class="text-[10px] text-slate-400 font-mono mt-0.5">ID: ' + g._id + '</div>' +
              '</div>' +
              '<span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ' + (g.autoShare ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-slate-900 text-slate-500 border border-slate-800') + '">' +
                (g.autoShare ? 'Active' : 'Paused') +
              '</span>' +
            '</div>' +
            '<div>' +
              '<div class="text-[9px] uppercase font-mono text-slate-400 mb-0.5">Categories:</div>' +
              '<div class="flex flex-wrap gap-1">' + catPills + '</div>' +
            '</div>' +
            '<div class="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80 flex justify-between">' +
              '<span>Shares: <strong class="text-slate-200">' + (g.totalShares || 0) + '</strong></span>' +
              '<span>' + (g.lastSharedAt ? new Date(g.lastSharedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Never') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800">' +
            '<button onclick="testShareGroup(\\\'' + g._id + '\\\')" class="px-2.5 py-1 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-[11px] font-semibold transition active:scale-95">🚀 Test</button>' +
            '<div class="flex items-center gap-1">' +
              '<button onclick="toggleGroupAutoShare(\\\'' + g._id + '\\\', ' + g.autoShare + ')" class="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] transition">' + (g.autoShare ? 'Pause' : 'Enable') + '</button>' +
              '<button onclick="deleteGroup(\\\'' + g._id + '\\\')" class="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-400 text-[11px] transition">🗑️</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      renderPagination('groups-pagination', page, totalPages, total, 'changeGroupsPage', GROUPS_PAGE_SIZE);
    }

    function changeGroupSharesPage(page) {
      groupSharesPage = page;
      renderGroupSharesPage(groupSharesPage);
    }

    function renderGroupSharesPage(page) {
      const tbody = document.getElementById('group-shares-table-body');
      if (!tbody) return;
      const total = groupSharesData.length;
      const totalPages = Math.ceil(total / GROUP_SHARES_PAGE_SIZE);
      const start = (page - 1) * GROUP_SHARES_PAGE_SIZE;
      const pageShares = groupSharesData.slice(start, start + GROUP_SHARES_PAGE_SIZE);

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-500 font-mono text-xs">No group shares recorded yet.</td></tr>';
        renderPagination('group-shares-pagination', 1, 0, 0, 'changeGroupSharesPage', GROUP_SHARES_PAGE_SIZE);
        return;
      }

      tbody.innerHTML = pageShares.map(s => {
        const isSuccess = s.status === 'success' || s.status === 'dry_run';
        const statusBadge = isSuccess
          ? '<span class="px-1.5 py-0.2 rounded text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-bold">' + (s.status === 'dry_run' ? 'DRY' : 'SHARED') + '</span>'
          : '<span class="px-1.5 py-0.2 rounded text-[9px] bg-rose-950 text-rose-400 border border-rose-800/60 font-bold" title="' + (s.errorMessage || '').replace(/"/g, '&quot;') + '">FAIL</span>';

        const postLink = s.fbPostId
          ? '<a href="https://facebook.com/' + s.fbPostId + '" target="_blank" class="text-cyan-400 hover:text-cyan-300 underline font-mono truncate block max-w-[110px]">' + s.fbPostId + ' ↗</a>'
          : '-';

        return '<tr class="hover:bg-slate-900/40 text-xs transition">' +
          '<td class="py-2 pr-3 font-sans font-medium text-slate-200 max-w-[180px] truncate" title="' + (s.articleTitle || '') + '">' + (s.articleTitle || '-') + '</td>' +
          '<td class="py-2 pr-3 text-emerald-300 font-sans max-w-[120px] truncate">' + (s.groupName || s.groupId) + '</td>' +
          '<td class="py-2 pr-3">' + postLink + '</td>' +
          '<td class="py-2 pr-3 text-slate-400">' + (s.durationMs ? s.durationMs + 'ms' : '-') + '</td>' +
          '<td class="py-2 pr-3 text-slate-400 whitespace-nowrap">' + (s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-') + '</td>' +
          '<td class="py-2">' + statusBadge + '</td>' +
        '</tr>';
      }).join('');

      renderPagination('group-shares-pagination', page, totalPages, total, 'changeGroupSharesPage', GROUP_SHARES_PAGE_SIZE);
    }

    async function loadGroups() {
      try {
        const [groupsRes, sharesRes] = await Promise.all([
          safeFetchJson('/api/groups'),
          safeFetchJson('/api/groups/shares?limit=50')
        ]);

        groupsData = (groupsRes.ok && Array.isArray(groupsRes.data)) ? groupsRes.data : [];
        groupSharesData = (sharesRes.ok && Array.isArray(sharesRes.data)) ? sharesRes.data : [];

        const totalCount = groupsData.length;
        const activeCount = groupsData.filter(g => g.autoShare).length;
        const totalShares = groupsData.reduce((acc, g) => acc + (g.totalShares || 0), 0);

        if (document.getElementById('stat-groups-total')) document.getElementById('stat-groups-total').innerText = totalCount;
        if (document.getElementById('stat-groups-active')) document.getElementById('stat-groups-active').innerText = activeCount;
        if (document.getElementById('stat-groups-shares')) document.getElementById('stat-groups-shares').innerText = totalShares;

        groupsPage = 1;
        groupSharesPage = 1;
        renderGroupsPage(1);
        renderGroupSharesPage(1);
      } catch (err) {
        console.error('Error loading groups:', err);
      }
    }

    async function loadGroupShares() {
      const res = await safeFetchJson('/api/groups/shares?limit=50');
      if (res.ok && Array.isArray(res.data)) {
        groupSharesData = res.data;
        groupSharesPage = 1;
        renderGroupSharesPage(1);
        showToast('Group shares refreshed');
      }
    }

    async function openAddGroupModal() {
      const modal = document.getElementById('modal-add-group');
      if (!modal) return;
      modal.classList.remove('hidden');

      try {
        const pagesRes = await safeFetchJson('/api/pages');
        const select = document.getElementById('group-page-select');
        if (select && pagesRes.ok && Array.isArray(pagesRes.data)) {
          select.innerHTML = '<option value="all">All Active Pages</option>' +
            pagesRes.data.map(p => '<option value="' + p.id + '">' + p.name + ' (' + p.id + ')</option>').join('');
        }
      } catch (e) {}
    }

    function closeAddGroupModal() {
      const modal = document.getElementById('modal-add-group');
      if (modal) modal.classList.add('hidden');
    }

    function toggleCategoryTag(btn, cat) {
      const input = document.getElementById('group-categories-input');
      if (!input) return;
      let currentCats = input.value.split(',').map(c => c.trim()).filter(Boolean);

      if (cat === 'all') {
        input.value = 'all';
        document.querySelectorAll('.cat-pill').forEach(b => {
          b.classList.remove('active', 'border-emerald-600', 'bg-emerald-950/60', 'text-emerald-300');
          b.classList.add('border-slate-700', 'bg-slate-900', 'text-slate-300');
        });
        btn.classList.add('active', 'border-emerald-600', 'bg-emerald-950/60', 'text-emerald-300');
        return;
      }

      currentCats = currentCats.filter(c => c.toLowerCase() !== 'all');
      const idx = currentCats.indexOf(cat);
      if (idx > -1) {
        currentCats.splice(idx, 1);
        btn.classList.remove('active', 'border-emerald-600', 'bg-emerald-950/60', 'text-emerald-300');
        btn.classList.add('border-slate-700', 'bg-slate-900', 'text-slate-300');
      } else {
        currentCats.push(cat);
        btn.classList.add('active', 'border-emerald-600', 'bg-emerald-950/60', 'text-emerald-300');
      }
      input.value = currentCats.length > 0 ? currentCats.join(', ') : 'all';
    }

    async function handleSaveGroup(e) {
      e.preventDefault();
      const payload = {
        id: document.getElementById('group-id-input').value.trim(),
        name: document.getElementById('group-name-input').value.trim(),
        categories: document.getElementById('group-categories-input').value.trim(),
        page_id: document.getElementById('group-page-select').value,
        delay_seconds: parseInt(document.getElementById('group-delay-input').value, 10) || 5,
        access_token: document.getElementById('group-token-input').value.trim() || null,
        auto_share: true,
      };

      const res = await safeFetchJson('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok && res.data?.success) {
        showToast('Group added successfully!');
        closeAddGroupModal();
        document.getElementById('form-add-group').reset();
        loadGroups();
      } else {
        showToast(res.error || res.data?.error || 'Failed to save group', true);
      }
    }

    async function toggleGroupAutoShare(id, currentStatus) {
      const res = await safeFetchJson('/api/groups/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_share: !currentStatus })
      });
      if (res.ok) {
        showToast('Auto-share ' + (!currentStatus ? 'enabled' : 'paused'));
        loadGroups();
      } else {
        showToast(res.error || 'Failed to update group', true);
      }
    }

    async function deleteGroup(id) {
      if (!confirm('Remove this group from auto-share?')) return;
      const res = await safeFetchJson('/api/groups/' + id, { method: 'DELETE' });
      if (res.ok) {
        showToast('Group removed');
        loadGroups();
      } else {
        showToast(res.error || 'Failed to delete group', true);
      }
    }

    async function testShareGroup(id, groupName) {
      const g = (cachedGroupsData || []).find(x => x._id === id);
      const name = groupName || (g ? g.name : 'group');
      showToast('Sharing to "' + name + '"...');
      const res = await safeFetchJson('/api/groups/' + id + '/test-share', { method: 'POST' });
      if (res.ok && res.data?.success) {
        showToast('✓ Shared to "' + name + '"!');
        loadGroups();
      } else {
        showToast(res.data?.error || res.error || 'Test share failed', true);
      }
    }

    // --- TEMPLATE PREVIEW ---
    function setPreviewPreset(preset) {
      const templateSel = document.getElementById('preview-template');
      const catInput = document.getElementById('preview-category');
      const headlineInput = document.getElementById('preview-headline');

      if (preset === 'trendingnews') {
        templateSel.value = 'template-trendingnews-breaking';
        catInput.value = 'US POLITICS';
        headlineInput.value = 'White House Unveils Major Economic Overhaul as Senate Prepares for High-Stakes Vote';
      } else {
        templateSel.value = 'template-canva-bdnews';
        catInput.value = 'বিশেষ খবর';
        headlineInput.value = '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি';
      }
      renderPreview();
    }

    function onTemplateStyleChange() {
      const val = document.getElementById('preview-template').value;
      const isTrending = val.includes('trendingnews');
      const curHeadline = document.getElementById('preview-headline').value;
      const isBangla = /[\u0980-\u09FF]/.test(curHeadline);

      if (isTrending && isBangla) {
        document.getElementById('preview-category').value = 'US POLITICS';
        document.getElementById('preview-headline').value = 'White House Unveils Major Economic Overhaul as Senate Prepares for High-Stakes Vote';
      } else if (!isTrending && !isBangla) {
        document.getElementById('preview-category').value = 'বিশেষ খবর';
        document.getElementById('preview-headline').value = '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি';
      }
      renderPreview();
    }

    async function renderPreview() {
      const spinner = document.getElementById('preview-spinner');
      const frame = document.getElementById('preview-frame');
      const placeholder = document.getElementById('preview-placeholder');
      const meta = document.getElementById('preview-meta');

      if (spinner) spinner.classList.remove('hidden');
      if (meta) meta.innerText = 'Compiling layout...';

      const payload = {
        templateId: document.getElementById('preview-template').value,
        category: document.getElementById('preview-category').value,
        headline: document.getElementById('preview-headline').value,
        imageUrl: document.getElementById('preview-image').value,
      };

      try {
        const res = await safeFetchJson('/api/preview/html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok && res.data?.html) {
          const isLandscape = payload.templateId.includes('landscape');
          if (isLandscape) {
            frame.style.width = '1200px';
            frame.style.height = '630px';
            frame.style.transform = 'scale(0.35)';
          } else {
            frame.style.width = '1080px';
            frame.style.height = '1080px';
            frame.style.transform = 'scale(0.388)';
          }

          frame.srcdoc = res.data.html;
          frame.classList.remove('hidden');
          placeholder.classList.add('hidden');
          meta.innerText = '✓ Live ' + (payload.templateId.includes('trendingnews') ? 'Trending News World' : 'BD News') + ' Template (' + (isLandscape ? '1200x630' : '1080x1080') + ')';
        } else {
          meta.innerText = res.data?.error || 'Failed to compile template';
        }
      } catch (e) {
        meta.innerText = 'Error: ' + e.message;
      } finally {
        if (spinner) spinner.classList.add('hidden');
      }
    }

    // --- SETTINGS ---
    async function testTikTokConnection() {
      showToast('Checking TikTok status...');
      const res = await safeFetchJson('/api/tiktok/status');
      if (res.ok && res.data?.configured) {
        showToast('✓ TikTok is configured and ready for video posting!');
      } else {
        showToast('TikTok access token not set; running in safe simulated dry-run mode.');
      }
    }

    async function loadSettings() {
      initCronPills();
      loadCronJobs();
      loadDistinctWebhooks();
      const res = await safeFetchJson('/api/settings');
      const d = res.data || {};
      document.getElementById('setting-cron').value = d.POLL_INTERVAL_CRON || '*/10 * * * *';
      document.getElementById('setting-age').value = d.MAX_ARTICLE_AGE_HOURS || 24;
      document.getElementById('setting-cap').value = d.MAX_POSTS_PER_HOUR || 10;
      document.getElementById('setting-min-delay').value = d.MIN_DELAY_SECONDS || 30;
      document.getElementById('setting-max-delay').value = d.MAX_DELAY_SECONDS || 60;
      document.getElementById('setting-hashtags').value = d.DEFAULT_HASHTAGS || '';
      document.getElementById('setting-caption-format').value = d.DEFAULT_CAPTION_FORMAT || '';
      document.getElementById('setting-comment-format').value = d.DEFAULT_COMMENT_FORMAT || '';
      if (document.getElementById('setting-cronjob-api-key')) {
        document.getElementById('setting-cronjob-api-key').value = d.CRONJOB_API_KEY || '';
      }
      try {
        const tikRes = await safeFetchJson('/api/tiktok/status');
        if (tikRes.ok && document.getElementById('setting-tiktok-badge')) {
          const badge = document.getElementById('setting-tiktok-badge');
          badge.innerText = tikRes.data?.configured ? 'Active (Live API)' : 'Safe Simulated Mode';
          badge.className = 'px-1.5 py-0.2 rounded text-[9px] font-mono ' + (tikRes.data?.configured ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'bg-slate-800 text-slate-400');
        }
      } catch {}
    }

    function setHashtagPreset(type) {
      const el = document.getElementById('setting-hashtags');
      if (!el) return;
      if (type === 'usa') {
        el.value = '#TrendingNewsWorld #USNews #BreakingNews #WorldNews #TrendingNews #NewsUpdate #USA #Headlines';
      } else {
        el.value = '#BreakingNews #BanglaNews #ViralNews #Bangladesh #NewsUpdate';
      }
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
        CRONJOB_API_KEY: document.getElementById('setting-cronjob-api-key')?.value || '',
      };

      const res = await safeFetchJson('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const tikTokToken = document.getElementById('setting-tiktok-token')?.value;
      const tikTokKey = document.getElementById('setting-tiktok-key')?.value;
      if (tikTokToken || tikTokKey) {
        await safeFetchJson('/api/tiktok/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: tikTokToken, clientKey: tikTokKey })
        });
      }

      if (res.data?.success) {
        showToast('Pipeline configuration saved!');
        loadCronJobs();
        loadSettings();
      } else {
        showToast(res.data?.error || 'Failed to save settings', true);
      }
    }

    // --- CRON-JOB.ORG FULL CRUD & LIVE MANAGER ---
    let allCronJobs = [];
    let cronActiveFilter = 'all';
    let cronSearchTerm = '';

    function toggleApiKeyVisibility(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.type = el.type === 'password' ? 'text' : 'password';
    }

    function toggleDistinctCronDetails() {
      const content = document.getElementById('cron-details-content');
      const arrow = document.getElementById('cron-details-arrow');
      if (!content) return;
      const isHidden = content.classList.contains('hidden');
      if (isHidden) {
        content.classList.remove('hidden');
        if (arrow) arrow.innerText = '▲ Hide Endpoints';
        loadDistinctWebhooks();
      } else {
        content.classList.add('hidden');
        if (arrow) arrow.innerText = '▼ Show Endpoints';
      }
    }

    let cachedDistinctWebhooks = null;
    async function loadDistinctWebhooks(force = false) {
      const container = document.getElementById('dynamic-cron-webhooks-container');
      if (!container) return;
      if (cachedDistinctWebhooks && !force) {
        renderDistinctWebhooks(cachedDistinctWebhooks);
        return;
      }
      try {
        const origin = window.location.origin;
        const res = await safeFetchJson('/api/cron-jobs/system-webhooks?baseUrl=' + encodeURIComponent(origin));
        if (res.data?.success && Array.isArray(res.data.webhooks)) {
          cachedDistinctWebhooks = res.data.webhooks;
          renderDistinctWebhooks(cachedDistinctWebhooks);
        }
      } catch (e) {
        console.error('Failed to load distinct webhooks', e);
      }
    }

    function renderDistinctWebhooks(webhooks) {
      const container = document.getElementById('dynamic-cron-webhooks-container');
      if (!container) return;
      if (!webhooks || webhooks.length === 0) return;

      const origin = window.location.origin;
      container.innerHTML = webhooks.map((def, idx) => {
        const badgeColors = {
          rss: 'bg-cyan-600/20 text-cyan-400 border-cyan-600/40',
          gdrive: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40',
          stories: 'bg-purple-600/20 text-purple-400 border-purple-600/40',
          youtube: 'bg-rose-600/20 text-rose-400 border-rose-600/40',
          cleanup: 'bg-amber-600/20 text-amber-400 border-amber-600/40'
        };
        const color = badgeColors[def.type] || 'bg-slate-700/40 text-slate-300 border-slate-600/40';
        const testResId = 'cron-res-dyn-' + idx;
        const pathUrl = def.fullUrl || (origin + def.path);

        return '<div class="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 transition">' +
          '<div class="flex items-center justify-between">' +
            '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ' + color + '">' + (def.type ? def.type.toUpperCase() : 'CRON') + (def.pageId ? ' [PAGE]' : '') + '</span>' +
            '<span class="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">' + (def.preset || '15m') + '</span>' +
          '</div>' +
          '<div>' +
            '<div class="text-xs font-bold text-white truncate">' + escapeHtml(def.title) + '</div>' +
            '<p class="text-[11px] text-slate-400 leading-tight mt-0.5">' + escapeHtml(def.desc || '') + '</p>' +
          '</div>' +
          '<div class="flex items-center gap-1.5">' +
            '<input type="text" readonly value="' + escapeHtml(pathUrl) + '" class="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-cyan-300 select-all focus:outline-none" onclick="this.select()">' +
            '<button data-path="' + escapeHtml(def.path) + '" onclick="copyCronUrl(this.dataset.path, this)" class="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shrink-0 transition">Copy</button>' +
            '<button data-path="' + escapeHtml(def.path) + '" data-target="' + testResId + '" onclick="testCronJob(this.dataset.path, this.dataset.target, this)" class="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 shrink-0 transition">Test</button>' +
          '</div>' +
          '<div id="' + testResId + '" class="text-[10px] font-mono p-1.5 rounded bg-slate-900/90 border border-slate-800/60 hidden"></div>' +
        '</div>';
      }).join('');
    }

    async function quickSaveCronKey() {
      const input = document.getElementById('cron-quick-key-input');
      const key = input ? input.value.trim() : '';
      if (!key) {
        showToast('Please enter an API Key', true);
        return;
      }
      const res = await safeFetchJson('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ CRONJOB_API_KEY: key })
      });
      if (res.data?.success) {
        showToast('cron-job.org API Key saved successfully!');
        if (document.getElementById('setting-cronjob-api-key')) {
          document.getElementById('setting-cronjob-api-key').value = key;
        }
        loadCronJobs();
      } else {
        showToast(res.data?.error || 'Failed to save API key', true);
      }
    }

    function formatCronScheduleString(schedule) {
      if (!schedule) return 'Custom';
      const { hours, minutes } = schedule;
      if (!hours || !minutes) return 'Custom';
      if (hours.length === 1 && hours[0] === -1) {
        if (minutes.length === 12) return 'Every 5 min';
        if (minutes.length === 6) return 'Every 10 min';
        if (minutes.length === 4) return 'Every 15 min';
        if (minutes.length === 2) return 'Every 30 min';
        if (minutes.length === 1) return 'Hourly at :' + String(minutes[0]).padStart(2, '0');
        return 'Hourly (' + minutes.length + 'x/hr)';
      }
      if (hours.length === 12) return 'Every 2 hrs';
      if (hours.length === 4) return 'Every 6 hrs (:' + String(minutes[0] || 0).padStart(2, '0') + ')';
      if (hours.length === 2) return 'Every 12 hrs';
      if (hours.length === 1 && hours[0] !== -1) return 'Daily at ' + String(hours[0]).padStart(2, '0') + ':' + String(minutes[0] || 0).padStart(2, '0');
      return 'Custom';
    }

    function formatRelativeTime(unixSec) {
      if (!unixSec || unixSec <= 0) return '—';
      const now = Math.floor(Date.now() / 1000);
      const diff = now - unixSec;
      if (diff < 60) return Math.max(1, diff) + 's ago';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    }

    function formatFutureTime(unixSec) {
      if (!unixSec || unixSec <= 0) return '—';
      const now = Math.floor(Date.now() / 1000);
      const diff = unixSec - now;
      if (diff <= 0) return 'due now';
      if (diff < 60) return 'in ' + diff + 's';
      if (diff < 3600) return 'in ' + Math.floor(diff / 60) + 'm';
      if (diff < 86400) return 'in ' + Math.floor(diff / 3600) + 'h';
      return 'in ' + Math.floor(diff / 86400) + 'd';
    }

    async function loadCronJobs() {
      const tableEl = document.getElementById('cron-jobs-table-container');
      const badge = document.getElementById('cron-connection-badge');
      const alertEl = document.getElementById('cron-api-key-alert');

      if (tableEl && allCronJobs.length === 0) {
        tableEl.innerHTML = '<div class="p-8 text-center text-slate-500 text-xs animate-pulse">Loading cron jobs from cron-job.org...</div>';
      }

      const res = await safeFetchJson('/api/cron-jobs');
      if (!res.ok || !res.data?.success) {
        if (badge) {
          badge.className = 'px-2 py-0.5 text-[10px] font-mono rounded bg-amber-950 text-amber-300 border border-amber-800/60 font-semibold';
          badge.innerText = 'API Key Missing';
        }
        if (alertEl) alertEl.classList.remove('hidden');
        if (tableEl) {
          tableEl.innerHTML = '<div class="p-8 text-center bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">' +
            '<div class="text-2xl">🔑</div>' +
            '<div class="text-sm font-bold text-slate-200">cron-job.org API Key Required</div>' +
            '<p class="text-xs text-slate-400 max-w-md mx-auto">' +
              'Please enter your API Key in the box above to manage your scheduled webhooks, view execution history, and test jobs live.' +
            '</p>' +
          '</div>';
        }
        return;
      }

      if (alertEl) alertEl.classList.add('hidden');
      allCronJobs = res.data.jobs || [];

      const activeCount = allCronJobs.filter(j => j.enabled).length;
      if (badge) {
        badge.className = 'px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold flex items-center gap-1.5';
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span><span>Connected (' + activeCount + '/' + allCronJobs.length + ' Active)</span>';
      }

      renderCronJobsTable();
    }

    function filterCronJobs(type, btn) {
      cronActiveFilter = type;
      document.querySelectorAll('.cron-tab-btn').forEach(b => {
        b.className = 'cron-tab-btn px-2.5 py-1 rounded-md bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200 transition';
      });
      if (btn) {
        btn.className = 'cron-tab-btn px-2.5 py-1 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold transition';
      }
      renderCronJobsTable();
    }

    function searchCronJobs(val) {
      cronSearchTerm = (val || '').toLowerCase().trim();
      renderCronJobsTable();
    }

    function renderCronJobsTable() {
      const container = document.getElementById('cron-jobs-table-container');
      if (!container) return;

      const countAll = allCronJobs.length;
      const countActive = allCronJobs.filter(j => j.enabled).length;
      const countPaused = allCronJobs.filter(j => !j.enabled).length;
      const countWebhooks = allCronJobs.filter(j => (j.url && j.url.includes('/api/cron')) || (j.title && /rss|publisher|publish|gdrive|stories|story|youtube|shorts|cleanup|healing/i.test(j.title))).length;

      const elAll = document.getElementById('cron-count-all');
      const elAct = document.getElementById('cron-count-active');
      const elPau = document.getElementById('cron-count-paused');
      const elWeb = document.getElementById('cron-count-webhooks');
      if (elAll) elAll.innerText = countAll;
      if (elAct) elAct.innerText = countActive;
      if (elPau) elPau.innerText = countPaused;
      if (elWeb) elWeb.innerText = countWebhooks;

      let filtered = allCronJobs;
      if (cronActiveFilter === 'active') {
        filtered = filtered.filter(j => j.enabled);
      } else if (cronActiveFilter === 'paused') {
        filtered = filtered.filter(j => !j.enabled);
      } else if (cronActiveFilter === 'webhooks') {
        filtered = filtered.filter(j => (j.url && j.url.includes('/api/cron')) || (j.title && /rss|publisher|publish|gdrive|stories|story|youtube|shorts|cleanup|healing/i.test(j.title)));
      }

      if (cronSearchTerm) {
        filtered = filtered.filter(j =>
          (j.title && j.title.toLowerCase().includes(cronSearchTerm)) ||
          (j.url && j.url.toLowerCase().includes(cronSearchTerm)) ||
          String(j.jobId).includes(cronSearchTerm)
        );
      }

      if (filtered.length === 0) {
        container.innerHTML = '<div class="p-8 text-center bg-slate-950/40 border border-slate-800/60 rounded-xl space-y-2">' +
          '<div class="text-xl">🔍</div>' +
          '<div class="text-xs font-semibold text-slate-300">No cron jobs matching the filter</div>' +
          '<p class="text-[11px] text-slate-500">Try changing your search keywords or create a new cron job.</p>' +
          '<div class="pt-2">' +
            '<button onclick="openAddCronJobModal()" class="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition">+ Add Cron Job</button>' +
          '</div>' +
        '</div>';
        return;
      }

      let html = '<div class="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/70">' +
        '<table class="w-full text-left text-xs">' +
          '<thead class="bg-slate-900/80 text-[10px] font-mono uppercase text-slate-400 border-b border-slate-800">' +
            '<tr>' +
              '<th class="py-2.5 px-3 w-12 text-center">Status</th>' +
              '<th class="py-2.5 px-3 min-w-[200px]">Job Name & Webhook URL</th>' +
              '<th class="py-2.5 px-3 w-32">Schedule</th>' +
              '<th class="py-2.5 px-3 w-36">Last Run</th>' +
              '<th class="py-2.5 px-3 w-28">Next Run</th>' +
              '<th class="py-2.5 px-3 w-44 text-right">Actions</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody class="divide-y divide-slate-800/60 text-slate-300">';

      for (const job of filtered) {
        const isWebhook = (job.url && job.url.includes('/api/cron'));
        const scheduleStr = formatCronScheduleString(job.schedule);
        const tz = job.schedule?.timezone || 'Asia/Dhaka';

        let statusBadge = '<span class="px-1.5 py-0.5 text-[10px] rounded bg-slate-900 text-slate-500 border border-slate-800">Never</span>';
        if (job.lastStatus === 1) {
          statusBadge = '<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-950 text-emerald-400 border border-emerald-800">✓ 200 OK (' + (job.lastDuration || 0) + 'ms)</span>';
        } else if (job.lastStatus === 2) {
          statusBadge = '<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-950 text-rose-400 border border-rose-800">✕ Error (' + (job.lastDuration || 0) + 'ms)</span>';
        }

        const methodBadge = job.requestMethod === 1
          ? '<span class="px-1.5 py-0.2 text-[9px] font-mono rounded bg-amber-950 text-amber-300 border border-amber-800">POST</span>'
          : '<span class="px-1.5 py-0.2 text-[9px] font-mono rounded bg-cyan-950 text-cyan-300 border border-cyan-800">GET</span>';

        const webhookBadge = isWebhook
          ? '<span class="px-1.5 py-0.2 text-[9px] font-semibold rounded bg-purple-950 text-purple-300 border border-purple-800">Serverless</span>'
          : '';

        const safeTitle = escapeHtml(job.title);
        const safeUrl = escapeHtml(job.url);

        html += '<tr class="hover:bg-slate-900/40 transition group">' +
          '<td class="py-3 px-3 text-center align-top">' +
            '<button type="button" onclick="toggleCronJob(' + job.jobId + ', ' + (!job.enabled) + ', this)" ' +
              'class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ' + (job.enabled ? 'bg-emerald-600' : 'bg-slate-800') + '" ' +
              'title="' + (job.enabled ? 'Click to Disable / Pause' : 'Click to Enable') + '">' +
              '<span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ' + (job.enabled ? 'translate-x-4' : 'translate-x-0') + '"></span>' +
            '</button>' +
          '</td>' +
          '<td class="py-3 px-3 align-top">' +
            '<div class="flex items-center gap-1.5 flex-wrap">' +
              '<span class="font-bold text-white text-xs">' + safeTitle + '</span> ' +
              methodBadge + ' ' +
              webhookBadge +
              '<span class="text-[9px] font-mono text-slate-500">#' + job.jobId + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-1.5 mt-1 text-[11px] font-mono text-slate-400">' +
              '<span class="truncate max-w-xs sm:max-w-sm text-cyan-400/90" title="' + safeUrl + '">' + safeUrl + '</span>' +
              '<button type="button" onclick="copyCronJobUrl(' + job.jobId + ', this)" class="text-slate-500 hover:text-slate-200 p-0.5 rounded transition shrink-0" title="Copy URL">📋</button>' +
              '<a href="' + safeUrl + '" target="_blank" class="text-slate-500 hover:text-slate-200 p-0.5 rounded transition shrink-0" title="Open in new tab">↗</a>' +
            '</div>' +
          '</td>' +
          '<td class="py-3 px-3 align-top">' +
            '<div class="font-medium text-slate-200 text-xs">' + scheduleStr + '</div>' +
            '<div class="text-[10px] text-slate-500 font-mono mt-0.5">' + escapeHtml(tz) + '</div>' +
          '</td>' +
          '<td class="py-3 px-3 align-top">' +
            '<div>' + statusBadge + '</div>' +
            '<div class="text-[10px] text-slate-500 font-mono mt-1">' + formatRelativeTime(job.lastExecution) + '</div>' +
          '</td>' +
          '<td class="py-3 px-3 align-top">' +
            '<div class="text-[11px] font-mono text-slate-300">' + (job.enabled ? formatFutureTime(job.nextExecution) : '<span class="text-slate-600">Paused</span>') + '</div>' +
          '</td>' +
          '<td class="py-3 px-3 align-top text-right">' +
            '<div class="flex items-center justify-end gap-1.5">' +
              '<button type="button" onclick="runCronJob(' + job.jobId + ', this)" class="px-2 py-1 text-[10px] font-semibold rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 transition active:scale-95" title="Trigger webhook right now">⚡ Run</button>' +
              '<button type="button" onclick="viewCronJobHistory(' + job.jobId + ')" class="px-2 py-1 text-[10px] font-semibold rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition" title="View execution logs">Logs</button>' +
              '<button type="button" onclick="openEditCronJobModal(' + job.jobId + ')" class="px-2 py-1 text-[10px] font-semibold rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition" title="Edit Job">Edit</button>' +
              '<button type="button" onclick="deleteCronJob(' + job.jobId + ')" class="px-2 py-1 text-[10px] font-semibold rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition" title="Delete Job">✕</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }

      html += '</tbody></table></div>';
      container.innerHTML = html;
    }

    function copyCronJobUrl(jobId, btn) {
      const job = allCronJobs.find(j => String(j.jobId) === String(jobId));
      const text = job ? job.url : '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast('URL copied to clipboard!');
          if (btn) {
            const original = btn.innerText;
            btn.innerText = '✓';
            setTimeout(() => { btn.innerText = original; }, 1500);
          }
        });
      } else {
        prompt('Copy Webhook URL:', text);
      }
    }

    function openAddCronJobModal() {
      document.getElementById('cron-modal-id').value = '';
      document.getElementById('cron-modal-header-title').innerText = 'Create New Cron Job';
      document.getElementById('cron-modal-title').value = '';
      document.getElementById('cron-modal-url').value = window.location.origin + '/api/cron/rss';
      document.getElementById('cron-modal-preset').value = '10m';
      document.getElementById('cron-modal-timezone').value = 'Asia/Dhaka';
      document.getElementById('cron-modal-method').value = '0';
      document.getElementById('cron-modal-enabled').checked = true;
      document.getElementById('cron-modal-save-responses').checked = true;

      const modal = document.getElementById('modal-cron-job-form');
      if (modal) modal.classList.remove('hidden');
    }

    function openEditCronJobModal(jobId) {
      const job = allCronJobs.find(j => String(j.jobId) === String(jobId));
      if (!job) {
        showToast('Job details not found', true);
        return;
      }

      document.getElementById('cron-modal-id').value = job.jobId;
      document.getElementById('cron-modal-header-title').innerText = 'Edit Cron Job (#' + job.jobId + ')';
      document.getElementById('cron-modal-title').value = job.title || '';
      document.getElementById('cron-modal-url').value = job.url || '';
      document.getElementById('cron-modal-timezone').value = job.schedule?.timezone || 'Asia/Dhaka';
      document.getElementById('cron-modal-method').value = String(job.requestMethod || 0);
      document.getElementById('cron-modal-enabled').checked = Boolean(job.enabled);
      document.getElementById('cron-modal-save-responses').checked = job.saveResponses !== false;

      const presetSelect = document.getElementById('cron-modal-preset');
      const minCount = job.schedule?.minutes?.length || 0;
      const hoursCount = job.schedule?.hours?.length || 0;
      if (minCount === 12) presetSelect.value = '5m';
      else if (minCount === 6) presetSelect.value = '10m';
      else if (minCount === 4) presetSelect.value = '15m';
      else if (minCount === 2) presetSelect.value = '30m';
      else if (hoursCount === 4) presetSelect.value = '6h';
      else if (hoursCount === 12) presetSelect.value = '2h';
      else if (hoursCount === 2) presetSelect.value = '12h';
      else if (hoursCount === 1 && job.schedule?.hours[0] !== -1) presetSelect.value = '24h';
      else if (minCount === 1 && job.schedule?.minutes[0] === 15) presetSelect.value = '1h_15';
      else presetSelect.value = '1h';

      const modal = document.getElementById('modal-cron-job-form');
      if (modal) modal.classList.remove('hidden');
    }

    function closeCronJobModal() {
      const modal = document.getElementById('modal-cron-job-form');
      if (modal) modal.classList.add('hidden');
    }

    function setCronModalUrl(path) {
      const input = document.getElementById('cron-modal-url');
      if (input) {
        input.value = window.location.origin + path;
      }
    }

    async function handleSaveCronJobModal(e) {
      e.preventDefault();
      const jobId = document.getElementById('cron-modal-id').value;
      const submitBtn = document.getElementById('cron-modal-submit-btn');

      const payload = {
        title: document.getElementById('cron-modal-title').value.trim(),
        url: document.getElementById('cron-modal-url').value.trim(),
        preset: document.getElementById('cron-modal-preset').value,
        timezone: document.getElementById('cron-modal-timezone').value,
        requestMethod: parseInt(document.getElementById('cron-modal-method').value, 10),
        enabled: document.getElementById('cron-modal-enabled').checked,
        saveResponses: document.getElementById('cron-modal-save-responses').checked,
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Saving...';
      }

      try {
        const url = jobId ? '/api/cron-jobs/' + jobId : '/api/cron-jobs';
        const method = jobId ? 'PATCH' : 'POST';
        const res = await safeFetchJson(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.data?.success) {
          showToast(jobId ? 'Cron job updated successfully!' : 'Cron job created successfully!');
          closeCronJobModal();
          loadCronJobs();
        } else {
          showToast(res.data?.error || 'Failed to save cron job', true);
        }
      } catch (err) {
        showToast('Error: ' + err.message, true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Save Cron Job';
        }
      }
    }

    async function toggleCronJob(jobId, newStatus, btn) {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-50');
      }
      try {
        const res = await safeFetchJson('/api/cron-jobs/' + jobId + '/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: newStatus })
        });
        if (res.data?.success) {
          showToast('Cron job ' + (newStatus ? 'enabled' : 'paused') + '!');
          const target = allCronJobs.find(j => String(j.jobId) === String(jobId));
          if (target) target.enabled = newStatus;
          renderCronJobsTable();
        } else {
          showToast(res.data?.error || 'Failed to toggle status', true);
        }
      } catch (err) {
        showToast('Error: ' + err.message, true);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('opacity-50');
        }
      }
    }

    async function deleteCronJob(jobId) {
      const job = allCronJobs.find(j => String(j.jobId) === String(jobId));
      const title = job ? (job.title || '#' + jobId) : ('#' + jobId);
      if (!confirm('Are you sure you want to delete cron job "' + title + '"?\\nThis action cannot be undone.')) {
        return;
      }
      try {
        const res = await safeFetchJson('/api/cron-jobs/' + jobId, {
          method: 'DELETE'
        });
        if (res.data?.success) {
          showToast('Cron job "' + title + '" deleted!');
          allCronJobs = allCronJobs.filter(j => String(j.jobId) !== String(jobId));
          renderCronJobsTable();
        } else {
          showToast(res.data?.error || 'Failed to delete job', true);
        }
      } catch (err) {
        showToast('Error: ' + err.message, true);
      }
    }

    async function runCronJob(jobId, btn) {
      const job = allCronJobs.find(j => String(j.jobId) === String(jobId));
      const url = job?.url;
      const method = job?.requestMethod || 0;
      if (btn) {
        btn.disabled = true;
        btn.innerText = '⏳';
        btn.classList.add('opacity-75');
      }
      try {
        const res = await safeFetchJson('/api/cron-jobs/' + jobId + '/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, method })
        });
        if (res.data?.success) {
          showToast('✓ HTTP ' + res.data.httpStatus + ' (' + res.data.durationMs + 'ms)');
          if (job) {
            job.lastStatus = 1;
            job.lastDuration = res.data.durationMs;
            job.lastExecution = Math.floor(Date.now() / 1000);
          }
          renderCronJobsTable();
        } else {
          const status = res.data?.httpStatus ? 'HTTP ' + res.data.httpStatus : 'Failed';
          showToast('✕ ' + status + ' (' + (res.data?.durationMs || 0) + 'ms): ' + (res.data?.error || res.data?.statusText || 'Error'), true);
          if (job) {
            job.lastStatus = 2;
            job.lastDuration = res.data?.durationMs || 0;
            job.lastExecution = Math.floor(Date.now() / 1000);
          }
          renderCronJobsTable();
        }
      } catch (err) {
        showToast('Trigger failed: ' + err.message, true);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerText = '⚡ Run';
          btn.classList.remove('opacity-75');
        }
      }
    }

    async function viewCronJobHistory(jobId) {
      const job = allCronJobs.find(j => String(j.jobId) === String(jobId));
      const title = job ? (job.title || '#' + jobId) : ('#' + jobId);
      const url = job ? (job.url || '') : '';
      const modal = document.getElementById('modal-cron-history');
      const titleEl = document.getElementById('cron-history-modal-title');
      const subtitleEl = document.getElementById('cron-history-modal-subtitle');
      const contentEl = document.getElementById('cron-history-content');

      if (titleEl) titleEl.innerText = 'Execution Logs: ' + title;
      if (subtitleEl) subtitleEl.innerText = url;
      if (contentEl) {
        contentEl.innerHTML = '<div class="p-8 text-center text-slate-500 text-xs animate-pulse">Loading execution history...</div>';
      }
      if (modal) modal.classList.remove('hidden');

      try {
        const res = await safeFetchJson('/api/cron-jobs/' + jobId + '/history');
        if (!res.data?.success || !res.data.history || res.data.history.length === 0) {
          contentEl.innerHTML = '<div class="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">' +
            '<div class="text-base text-slate-400">📜 No Execution Logs Found</div>' +
            '<p class="text-[11px] text-slate-500">This job may have been recently created or has not run yet.</p>' +
          '</div>';
          return;
        }

        let html = '<div class="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70">' +
          '<table class="w-full text-left text-xs">' +
            '<thead class="bg-slate-900/80 text-[10px] font-mono uppercase text-slate-400 border-b border-slate-800">' +
              '<tr>' +
                '<th class="py-2 px-3">Date & Time</th>' +
                '<th class="py-2 px-3">Status</th>' +
                '<th class="py-2 px-3">HTTP Code</th>' +
                '<th class="py-2 px-3">Duration</th>' +
                '<th class="py-2 px-3">Network (DNS / Connect / Transfer)</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody class="divide-y divide-slate-800/60 font-mono text-[11px]">';

        for (const log of res.data.history) {
          const dateStr = log.date ? new Date(log.date * 1000).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }) : '—';
          const isOk = log.status === 1 || log.httpStatus === 200;
          const statusBadge = isOk
            ? '<span class="text-emerald-400 font-bold">✓ OK</span>'
            : '<span class="text-rose-400 font-bold">✕ ' + escapeHtml(log.statusText || 'Failed') + '</span>';
          const stats = log.stats || {};
          const dns = stats.nameLookup ? Math.round(stats.nameLookup / 1000) + 'ms' : '—';
          const conn = stats.connect ? Math.round(stats.connect / 1000) + 'ms' : '—';
          const trans = stats.total ? Math.round(stats.total / 1000) + 'ms' : '—';

          html += '<tr class="hover:bg-slate-900/30">' +
            '<td class="py-2 px-3 text-slate-300">' + dateStr + '</td>' +
            '<td class="py-2 px-3">' + statusBadge + '</td>' +
            '<td class="py-2 px-3 text-slate-200">' + (log.httpStatus || '—') + '</td>' +
            '<td class="py-2 px-3 text-cyan-300 font-semibold">' + (log.duration || 0) + 'ms</td>' +
            '<td class="py-2 px-3 text-slate-400 text-[10px]">' + dns + ' / ' + conn + ' / ' + trans + '</td>' +
          '</tr>';
        }

        html += '</tbody></table></div>';
        contentEl.innerHTML = html;
      } catch (err) {
        contentEl.innerHTML = '<div class="p-4 text-center text-rose-400 text-xs">Failed to load logs: ' + escapeHtml(err.message) + '</div>';
      }
    }

    function closeCronHistoryModal() {
      const modal = document.getElementById('modal-cron-history');
      if (modal) modal.classList.add('hidden');
    }

    async function syncAllCronJobs() {
      const origin = window.location.origin;
      if (!confirm('Synchronize and configure all distinct automation webhooks (including per-page RSS and per-page Google Drive webhooks) on cron-job.org pointing to:\\n' + origin + '\\n\\nExisting jobs will be updated with this domain and missing jobs will be created. Proceed?')) {
        return;
      }
      showToast('Synchronizing distinct webhooks on cron-job.org...');
      try {
        const res = await safeFetchJson('/api/cron-jobs/sync-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl: origin })
        });
        if (res.data?.success) {
          showToast('✓ Synchronized ' + (res.data.results?.length || 6) + ' webhooks successfully!');
          loadCronJobs();
          loadDistinctWebhooks(true);
        } else {
          showToast(res.data?.error || 'Failed to sync webhooks', true);
        }
      } catch (err) {
        showToast('Sync error: ' + err.message, true);
      }
    }

    // --- REELS STUDIO (PAGINATED) ---
    let cachedReelArticles = [];
    let reelLogsData = [];
    let reelLogsPage = 1;
    const REEL_LOGS_PAGE_SIZE = 10;

    let reelDebounceTimer = null;
    function updateReelFramePreviewDebounced() {
      clearTimeout(reelDebounceTimer);
      reelDebounceTimer = setTimeout(updateReelFramePreview, 350);
    }

    function onReelThemeChanged() {
      const select = document.getElementById('reel-theme-select');
      const theme = select ? select.value : 'auto-category';
      const dur = document.getElementById('reel-duration-select')?.value || '18';
      const badgeEl = document.getElementById('reel-theme-badge');
      const durBadge = document.getElementById('reel-duration-badge');

      if (badgeEl) {
        if (theme === 'auto-category') {
          badgeEl.innerText = 'Smart Category';
          badgeEl.className = 'px-1.5 py-0.2 text-[9px] font-mono rounded bg-amber-950 text-amber-400 border border-amber-800';
        } else if (theme === 'vertical-916') {
          badgeEl.innerText = '9:16 Vertical';
          badgeEl.className = 'px-1.5 py-0.2 text-[9px] font-mono rounded bg-emerald-950 text-emerald-400 border border-emerald-800';
        } else {
          badgeEl.innerText = '1:1 Square';
          badgeEl.className = 'px-1.5 py-0.2 text-[9px] font-mono rounded bg-rose-950 text-rose-400 border border-rose-800';
        }
      }

      if (durBadge) durBadge.innerText = dur + 's • 24fps • AAC';
      updateReelFramePreview();
    }

    function onReelDurationChanged() {
      onReelThemeChanged();
    }

    function updateReelFramePreview() {
      const headline = document.getElementById('reel-headline-input')?.value.trim();
      const category = document.getElementById('reel-category-input')?.value.trim() || 'বিশেষ খবর';
      const imageUrl = document.getElementById('reel-image-input')?.value.trim();
      const theme = document.getElementById('reel-theme-select')?.value || 'rolling';

      const frameImg = document.getElementById('reel-frame-img');
      const placeholder = document.getElementById('reel-player-placeholder');
      const video = document.getElementById('reel-video-player');

      if (!frameImg) return;

      const previewTheme = theme === 'rolling' ? 'studio-red' : theme;
      const params = new URLSearchParams({
        theme: previewTheme,
        category: category,
        headline: headline || '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত'
      });
      if (imageUrl) params.append('imageUrl', imageUrl);

      frameImg.src = '/api/reels/preview-frame.jpg?' + params.toString();
      frameImg.onload = () => {
        frameImg.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
        if (video) video.classList.add('hidden');
      };
      refreshViralHashtags();
    }

    let viralHashtagTimer = null;
    async function refreshViralHashtags() {
      if (viralHashtagTimer) clearTimeout(viralHashtagTimer);
      viralHashtagTimer = setTimeout(async () => {
        const headline = document.getElementById('reel-headline-input')?.value.trim() || '';
        const category = document.getElementById('reel-category-input')?.value.trim() || 'বিশেষ খবর';
        if (!headline) return;

        try {
          const res = await safeFetchJson('/api/reels/generate-hashtags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ headline, category })
          });
          if (res.ok && res.data?.hashtags) {
            const el = document.getElementById('reel-hashtags-input');
            if (el) el.value = res.data.hashtags;
          }
        } catch (e) {}
      }, 300);
    }

    async function loadReels() {
      loadReelSettings();
      loadReelArticles();
      loadReelPages();
      loadReelLogs();
      onReelThemeChanged();
    }

    async function loadReelSettings() {
      try {
        const res = await safeFetchJson('/api/reels/settings');
        if (res.ok && res.data) {
          const auto = Boolean(res.data.autoPostReels);
          const toggle = document.getElementById('toggle-auto-reels');
          if (toggle) toggle.checked = auto;

          const postStories = res.data.postPosterToStories !== false;
          const toggleStories = document.getElementById('toggle-post-stories');
          if (toggleStories) toggleStories.checked = postStories;
        }
      } catch (e) {}
    }

    async function handleAutoReelsToggle(checked) {
      await safeFetchJson('/api/reels/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoPostReels: checked })
      });
      showToast(checked ? '✓ Auto-Reels enabled' : 'Auto-Reels disabled');
    }

    async function handlePostStoriesToggle(checked) {
      await safeFetchJson('/api/reels/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postPosterToStories: checked })
      });
      showToast(checked ? '✓ Stories posting enabled' : 'Stories posting disabled');
    }

    async function loadReelArticles() {
      try {
        const res = await safeFetchJson('/api/queue');
        const select = document.getElementById('reel-article-select');
        if (!select) return;

        let items = [];
        if (res.ok && res.data) {
          items = Array.isArray(res.data) ? res.data : (res.data.pendingJobs || []).concat(res.data.recentLogs || []);
        }

        cachedReelArticles = items;
        select.innerHTML = '<option value="">-- Choose an article or type custom below --</option>';

        items.slice(0, 30).forEach((item, idx) => {
          const title = item.article_title || item.articleTitle || item.payload?.articleTitle || item.title || ('Article #' + (idx + 1));
          const opt = document.createElement('option');
          opt.value = idx;
          opt.textContent = title.length > 60 ? title.substring(0, 60) + '...' : title;
          select.appendChild(opt);
        });
      } catch (e) {}
    }

    function onReelArticleSelected() {
      const select = document.getElementById('reel-article-select');
      const idx = select.value;
      if (idx === '' || !cachedReelArticles[idx]) return;

      const item = cachedReelArticles[idx];
      const title = item.article_title || item.articleTitle || item.payload?.articleTitle || item.title || '';
      const category = item.category || item.payload?.category || 'বিশেষ খবর';
      const img = item.imageUrl || item.payload?.imageUrl || '';
      const link = item.article_link || item.link || item.payload?.link || '';
      const articleId = item.id || item._id || item.articleId || '';

      if (title) document.getElementById('reel-headline-input').value = title;
      if (category) document.getElementById('reel-category-input').value = category;
      if (img) document.getElementById('reel-image-input').value = img;
      if (document.getElementById('reel-link-input')) document.getElementById('reel-link-input').value = link;
      if (document.getElementById('reel-article-id-input')) document.getElementById('reel-article-id-input').value = articleId;
      updateReelFramePreview();
    }

    async function loadReelPages() {
      try {
        const res = await safeFetchJson('/api/pages');
        const select = document.getElementById('reel-page-select');
        if (!select || !res.ok || !res.data) return;

        select.innerHTML = '<option value="all">Active Default Page (BD News 24/7)</option>';
        res.data.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p._id || p.id;
          opt.textContent = p.name + ' (' + (p._id || p.id) + ')';
          select.appendChild(opt);
        });
      } catch (e) {}
    }

    async function renderReelPreview() {
      const headline = document.getElementById('reel-headline-input').value.trim();
      const category = document.getElementById('reel-category-input').value.trim() || 'বিশেষ খবর';
      const imageUrl = document.getElementById('reel-image-input').value.trim();
      const theme = document.getElementById('reel-theme-select').value || 'studio-red';

      if (!headline) {
        showToast('Please enter a headline', true);
        return;
      }

      const video = document.getElementById('reel-video-player');
      const frameImg = document.getElementById('reel-frame-img');
      const placeholder = document.getElementById('reel-player-placeholder');
      const spinner = document.getElementById('reel-player-spinner');
      const downloadLink = document.getElementById('reel-download-link');
      const statusEl = document.getElementById('reel-action-status');
      const dur = document.getElementById('reel-duration-select')?.value || '18';

      spinner.classList.remove('hidden');
      statusEl.classList.remove('hidden');
      statusEl.innerText = 'Rendering ' + dur + 's MP4 news reel...';

      const params = new URLSearchParams({ headline, category, theme, duration: dur });
      if (imageUrl) params.append('imageUrl', imageUrl);

      const streamUrl = '/api/reels/preview.mp4?' + params.toString();

      try {
        video.src = streamUrl;
        video.load();
        video.onloadeddata = () => {
          spinner.classList.add('hidden');
          placeholder.classList.add('hidden');
          if (frameImg) frameImg.classList.add('hidden');
          video.classList.remove('hidden');
          video.play().catch(() => {});
          downloadLink.href = streamUrl;
          downloadLink.classList.remove('hidden');
          statusEl.innerText = '✓ ' + dur + 's Reel ready!';
          showToast('✓ ' + dur + 's MP4 Reel rendered successfully!');
        };
        video.onerror = () => {
          spinner.classList.add('hidden');
          statusEl.innerText = 'Failed to load video stream.';
          showToast('Failed to load video stream', true);
        };
      } catch (e) {
        spinner.classList.add('hidden');
        showToast('Error: ' + e.message, true);
      }
    }

    async function publishReelNow() {
      const headline = document.getElementById('reel-headline-input').value.trim();
      const category = document.getElementById('reel-category-input').value.trim() || 'বিশেষ খবর';
      const imageUrl = document.getElementById('reel-image-input').value.trim();
      const link = document.getElementById('reel-link-input')?.value.trim() || '';
      const articleId = document.getElementById('reel-article-id-input')?.value.trim() || '';
      const pageId = document.getElementById('reel-page-select').value;
      const theme = document.getElementById('reel-theme-select').value || 'auto-category';
      const dur = parseInt(document.getElementById('reel-duration-select')?.value || '18', 10) || 18;
      const hashtags = document.getElementById('reel-hashtags-input')?.value.trim() || '';

      if (!headline) return showToast('Please enter a headline', true);

      const statusEl = document.getElementById('reel-action-status');
      const spinner = document.getElementById('reel-player-spinner');
      const btn = document.getElementById('btn-publish-reel');

      btn.disabled = true;
      btn.classList.add('opacity-50');
      spinner.classList.remove('hidden');
      document.getElementById('reel-spinner-text').innerText = 'Publishing to Facebook Reels...';
      statusEl.classList.remove('hidden');
      statusEl.innerText = 'Publishing reel...';

      try {
        const res = await safeFetchJson('/api/reels/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headline, category, imageUrl, link, articleId, pageId, theme, duration: dur, hashtags })
        });

        if (res.ok && res.data?.success) {
          showToast('✓ Reel published to ' + (res.data.pageName || 'Facebook') + '!');
          statusEl.innerText = '✓ Published! Video ID: ' + (res.data.videoId || 'N/A');
          loadReelLogs();
        } else {
          showToast('Publish failed: ' + (res.data?.error || res.error || 'Server error'), true);
          statusEl.innerText = 'Error: ' + (res.data?.error || res.error);
        }
      } catch (e) {
        showToast('Error: ' + e.message, true);
      } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50');
        spinner.classList.add('hidden');
      }
    }

    async function publishStoryNow() {
      const headline = document.getElementById('reel-headline-input').value.trim();
      const category = document.getElementById('reel-category-input').value.trim() || 'বিশেষ খবর';
      const imageUrl = document.getElementById('reel-image-input').value.trim();
      const pageId = document.getElementById('reel-page-select').value;

      if (!headline) return showToast('Please enter a headline', true);

      const statusEl = document.getElementById('reel-action-status');
      const btn = document.getElementById('btn-publish-story');

      btn.disabled = true;
      btn.classList.add('opacity-50');
      statusEl.classList.remove('hidden');
      statusEl.innerText = 'Publishing JPG card to Stories...';

      try {
        const res = await safeFetchJson('/api/stories/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headline, category, imageUrl, pageId })
        });

        if (res.ok && res.data?.success) {
          showToast('✓ Posted to Stories!');
          statusEl.innerText = '✓ Published to Stories! ID: ' + res.data.storyId;
        } else {
          showToast('Story publish failed', true);
          statusEl.innerText = 'Error: ' + (res.data?.error || res.error);
        }
      } catch (e) {
        showToast('Error: ' + e.message, true);
      } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50');
      }
    }

    function changeReelsPage(newPage) {
      reelLogsPage = newPage;
      renderReelLogsPage(reelLogsPage);
    }

    function renderReelLogsPage(page) {
      const tbody = document.getElementById('reels-table-body');
      const statCount = document.getElementById('stat-reels-count');
      if (!tbody) return;

      const total = reelLogsData.length;
      if (statCount) statCount.innerText = total;

      const totalPages = Math.ceil(total / REEL_LOGS_PAGE_SIZE);
      const start = (page - 1) * REEL_LOGS_PAGE_SIZE;
      const pageLogs = reelLogsData.slice(start, start + REEL_LOGS_PAGE_SIZE);

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500 font-mono text-xs">No reels published yet.</td></tr>';
        renderPagination('reels-pagination', 1, 0, 0, 'changeReelsPage', REEL_LOGS_PAGE_SIZE);
        return;
      }

      tbody.innerHTML = pageLogs.map(log => {
        const isSuccess = log.status === 'success';
        const isDryRun = log.status === 'dry_run';
        const statusBadge = isSuccess
          ? '<span class="px-1.5 py-0.2 text-[9px] rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PUB</span>'
          : (isDryRun 
              ? '<span class="px-1.5 py-0.2 text-[9px] rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">DRY</span>'
              : '<span class="px-1.5 py-0.2 text-[9px] rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">FAIL</span>');

        const videoLink = log.fbVideoId && !log.fbVideoId.startsWith('dryrun')
          ? '<a href="https://facebook.com/' + log.fbVideoId + '" target="_blank" class="text-rose-400 hover:underline">' + log.fbVideoId + ' ↗</a>'
          : (log.fbVideoId || '-');

        return '<tr class="hover:bg-slate-900/40 text-xs transition">' +
          '<td class="py-2 pr-3 font-bengali text-slate-200 max-w-[200px] truncate" title="' + (log.articleTitle || '') + '">' + (log.articleTitle || 'Untitled') + '</td>' +
          '<td class="py-2 pr-3 text-slate-400 truncate max-w-[100px]">' + (log.pageName || 'BD News 24/7') + '</td>' +
          '<td class="py-2 pr-3 text-[10px] font-mono text-slate-400">' + (log.theme || 'Standard') + '</td>' +
          '<td class="py-2 pr-3 font-mono text-[11px]">' + videoLink + '</td>' +
          '<td class="py-2 pr-3 text-slate-400 font-mono text-[11px]">' + (log.durationMs ? (log.durationMs / 1000).toFixed(1) + 's' : '-') + '</td>' +
          '<td class="py-2 pr-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">' + (log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-') + '</td>' +
          '<td class="py-2">' + statusBadge + '</td>' +
        '</tr>';
      }).join('');

      renderPagination('reels-pagination', page, totalPages, total, 'changeReelsPage', REEL_LOGS_PAGE_SIZE);
    }

    async function loadReelLogs() {
      try {
        const res = await safeFetchJson('/api/reels/logs?limit=50');
        reelLogsData = (res.ok && Array.isArray(res.data)) ? res.data : [];
        reelLogsPage = 1;
        renderReelLogsPage(1);
      } catch (e) {}
    }

    // --- GOOGLE DRIVE CLOUD REELS (PAGINATED) ---
    let cachedGDriveChannels = [];
    let activeGDriveChannelId = null;
    let cachedGDriveVideos = [];

    let gdriveChannelsPage = 1;
    const GDRIVE_CHANNELS_PAGE_SIZE = 5;

    let gdriveVideoPage = 1;
    const GDRIVE_PAGE_SIZE = 10;

    async function loadGDriveReels() {
      await loadGDrivePageOptions();
      await refreshGDriveChannels();
    }

    async function loadGDrivePageOptions() {
      try {
        const res = await safeFetchJson('/api/pages');
        const select = document.getElementById('gdrive-form-page-select');
        if (!select || !res.ok || !res.data) return;

        select.innerHTML = '<option value="">-- Select Target Facebook Page --</option>';
        res.data.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p._id || p.id;
          opt.textContent = p.name + ' (' + (p._id || p.id) + ')';
          select.appendChild(opt);
        });
      } catch (e) {}
    }

    async function refreshGDriveChannels() {
      const badge = document.getElementById('gdrive-global-status-badge');
      if (badge) badge.innerText = 'Syncing...';

      try {
        const res = await safeFetchJson('/api/gdrive-reels/channels');
        if (!res.ok || !res.data) return;

        cachedGDriveChannels = res.data.channels || [];
        const globalApiKey = res.data.globalApiKey || '';

        const keyInput = document.getElementById('gdrive-global-api-key');
        const keyPill = document.getElementById('gdrive-api-key-status-pill');
        if (keyInput) keyInput.value = globalApiKey;
        if (keyPill) {
          keyPill.innerText = globalApiKey ? '✓ Active' : '⚠️ Missing';
          keyPill.className = 'text-[9px] font-mono px-2 py-0.5 rounded-full ' + (globalApiKey ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400');
        }

        const totalChannels = cachedGDriveChannels.length;
        const activeChannels = cachedGDriveChannels.filter(c => c.isActive).length;
        let totalPosted = 0;
        cachedGDriveChannels.forEach(c => { totalPosted += (c.postedVideoIds ? c.postedVideoIds.length : 0); });

        if (document.getElementById('stat-gdrive-total-channels')) document.getElementById('stat-gdrive-total-channels').innerText = totalChannels;
        if (document.getElementById('stat-gdrive-active-channels')) document.getElementById('stat-gdrive-active-channels').innerText = activeChannels;
        if (document.getElementById('stat-gdrive-posted-videos')) document.getElementById('stat-gdrive-posted-videos').innerText = totalPosted;

        if (badge) {
          badge.innerText = activeChannels > 0 ? '🟢 ' + activeChannels + ' Active' : 'Standby';
          badge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full ' + (activeChannels > 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400');
        }

        // Check Google OAuth status for Drive auto-delete
        try {
          const authRes = await safeFetchJson('/api/gdrive-reels/auth/status');
          const oauthPill = document.getElementById('gdrive-oauth-status-pill');
          const connectBtn = document.getElementById('btn-connect-gdrive-oauth');
          if (authRes.ok && authRes.data) {
            if (authRes.data.hasOAuth) {
              if (oauthPill) {
                oauthPill.innerText = '✓ Google Sign-In (Auto-Delete Ready)';
                oauthPill.className = 'text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800';
              }
              if (connectBtn) connectBtn.classList.add('hidden');
            } else {
              if (oauthPill) {
                oauthPill.innerText = '⚠️ Connect Account for Auto-Delete';
                oauthPill.className = 'text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800';
              }
              if (connectBtn) connectBtn.classList.remove('hidden');
            }
          }
        } catch (e) {}

        gdriveChannelsPage = 1;
        renderGDriveChannelsPage(1);

        if (!activeGDriveChannelId && cachedGDriveChannels.length > 0) {
          selectGDriveChannel(cachedGDriveChannels[0]._id);
        } else if (activeGDriveChannelId) {
          const exists = cachedGDriveChannels.some(c => c._id === activeGDriveChannelId);
          if (exists) selectGDriveChannel(activeGDriveChannelId);
          else if (cachedGDriveChannels.length > 0) selectGDriveChannel(cachedGDriveChannels[0]._id);
        }
      } catch (e) {}
    }

    function changeGDriveChannelsPage(page) {
      gdriveChannelsPage = page;
      renderGDriveChannelsPage(gdriveChannelsPage);
    }

    function renderGDriveChannelsPage(page) {
      const container = document.getElementById('gdrive-channels-container');
      if (!container) return;

      const total = cachedGDriveChannels.length;
      const totalPages = Math.ceil(total / GDRIVE_CHANNELS_PAGE_SIZE);
      const start = (page - 1) * GDRIVE_CHANNELS_PAGE_SIZE;
      const pageChannels = cachedGDriveChannels.slice(start, start + GDRIVE_CHANNELS_PAGE_SIZE);

      if (total === 0) {
        container.innerHTML = '<div class="glass-panel p-4 text-center text-slate-500 font-mono text-xs rounded-xl">No channels configured. Click "+ Add Channel" to link a folder.</div>';
        renderPagination('gdrive-channels-pagination', 1, 0, 0, 'changeGDriveChannelsPage', GDRIVE_CHANNELS_PAGE_SIZE);
        return;
      }

      container.innerHTML = pageChannels.map(c => {
        const isSelected = c._id === activeGDriveChannelId;
        const postedCount = c.postedVideoIds ? c.postedVideoIds.length : 0;
        const autoDeleteBadge = (c.deleteAfterPosting !== false)
          ? '<span class="text-rose-400 font-medium">🗑️ Auto-Delete</span>'
          : '<span class="text-slate-500">Keep Files</span>';

        const catMap = {
          sports: '⚽ Sports',
          comedy: '🎭 Comedy',
          technology: '💻 Tech',
          lifestyle: '🌿 Lifestyle',
          islamic: '🕌 Islamic',
          food: '🍳 Food',
          gaming: '🎮 Gaming',
          travel: '✈️ Travel',
          entertainment: '🎬 Entertainment',
          news: '📰 News',
          viral: '🔥 Viral',
          auto: '🌟 Auto'
        };
        const catBadge = '<span class="text-slate-400 ml-1.5 px-1.5 py-0.2 rounded bg-slate-800 text-[9px] font-mono">' + (catMap[c.category] || '🌟 Auto') + '</span>';

        const cronPath = '/api/cron/gdrive-reels?channelId=' + c._id + (c.pageId ? '&pageId=' + c.pageId : '');

        return '<div class="glass-panel p-3 rounded-lg border transition ' + (isSelected ? 'border-emerald-500/80 bg-slate-900/90' : 'border-slate-800/80 bg-slate-950/60') + '">' +
          '<div class="flex items-start justify-between gap-2 mb-1.5">' +
            '<div class="min-w-0 flex-1">' +
              '<div class="flex items-center gap-1.5">' +
                '<h4 class="text-xs font-bold text-white truncate cursor-pointer hover:text-emerald-400" onclick="selectGDriveChannel(\\\'' + c._id + '\\\')">' + (c.name || 'Channel') + '</h4>' +
                '<span class="px-1.5 py-0.2 text-[9px] font-bold rounded-full ' + (c.isActive ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400') + '">' + (c.isActive ? 'Active' : 'Paused') + '</span>' +
              '</div>' +
              '<div class="text-[10px] text-slate-400 truncate flex items-center"><span>Page: ' + (c.pageName || c.pageId || 'None') + '</span>' + catBadge + '</div>' +
            '</div>' +
            '<div class="flex items-center gap-1">' +
              '<button onclick="editGDriveChannel(\\\'' + c._id + '\\\')" class="p-1 rounded bg-slate-900 text-slate-400 hover:text-white" title="Edit">✎</button>' +
              '<button onclick="deleteGDriveChannel(\\\'' + c._id + '\\\')" class="p-1 rounded bg-slate-900 text-rose-400 hover:text-rose-300" title="Delete">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="text-[10px] font-mono text-slate-400 py-1 border-y border-slate-900 flex justify-between">' +
            '<span>⏱️ Every ' + (c.scheduleIntervalHours || 2) + 'h</span>' +
            autoDeleteBadge +
            '<span class="text-purple-400">✓ ' + postedCount + ' Posted</span>' +
          '</div>' +
          '<div class="flex items-center gap-1.5 pt-1.5">' +
            '<button onclick="selectGDriveChannel(\\\'' + c._id + '\\\')" class="flex-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-semibold border border-slate-800 transition">View Videos</button>' +
            '<button onclick="publishNextForGDriveChannel(\\\'' + c._id + '\\\')" class="py-1 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[10px] transition active:scale-95">Post Now</button>' +
          '</div>' +
          '<div class="mt-2 pt-2 border-t border-slate-900 flex flex-col gap-1">' +
            '<div class="flex items-center justify-between text-[9px] text-slate-400">' +
              '<span class="font-mono text-emerald-400 font-semibold">⚡ Distinct Cron Webhook:</span>' +
              '<button data-path="' + escapeHtml(cronPath) + '" onclick="copyCronUrl(this.dataset.path, this)" class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/50 transition">Copy URL</button>' +
            '</div>' +
            '<input type="text" readonly value="' + (window.location.origin + cronPath) + '" class="w-full bg-slate-900/90 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] font-mono text-cyan-300 select-all focus:outline-none" onclick="this.select()">' +
          '</div>' +
        '</div>';
      }).join('');

      renderPagination('gdrive-channels-pagination', page, totalPages, total, 'changeGDriveChannelsPage', GDRIVE_CHANNELS_PAGE_SIZE);
    }

    async function selectGDriveChannel(id) {
      activeGDriveChannelId = id;
      renderGDriveChannelsPage(gdriveChannelsPage);

      const titleEl = document.getElementById('gdrive-explorer-title');
      const badgeEl = document.getElementById('gdrive-explorer-page-badge');
      const descEl = document.getElementById('gdrive-explorer-desc');
      const tbody = document.getElementById('gdrive-channel-videos-table-body');

      if (titleEl) titleEl.innerText = 'Scanning...';
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500 font-mono text-xs">Scanning Drive files...</td></tr>';

      try {
        const res = await safeFetchJson('/api/gdrive-reels/channels/' + id);
        if (!res.ok || !res.data) return;

        const channel = res.data.channel;
        const scan = res.data.scan || {};
        cachedGDriveVideos = scan.videos || [];

        if (titleEl) titleEl.innerText = channel.name || 'Channel Videos';
        if (badgeEl) badgeEl.innerText = 'Page: ' + (channel.pageName || channel.pageId || 'Default');
        if (descEl) descEl.innerText = '✓ ' + scan.totalVideos + ' videos (' + scan.pendingCount + ' ready, ' + scan.postedCount + ' posted)';

        if (document.getElementById('stat-gdrive-pending-videos')) {
          document.getElementById('stat-gdrive-pending-videos').innerText = scan.pendingCount || 0;
        }

        gdriveVideoPage = 1;
        renderGDriveVideoPage(1);
      } catch (e) {}
    }

    function changeGDriveVideoPage(newPage) {
      gdriveVideoPage = newPage;
      renderGDriveVideoPage(gdriveVideoPage);
    }

    function renderGDriveVideoPage(page) {
      const tbody = document.getElementById('gdrive-channel-videos-table-body');
      if (!tbody) return;

      const total = cachedGDriveVideos.length;
      const totalPages = Math.ceil(total / GDRIVE_PAGE_SIZE);
      const start = (page - 1) * GDRIVE_PAGE_SIZE;
      const pageVideos = cachedGDriveVideos.slice(start, start + GDRIVE_PAGE_SIZE);

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500 font-mono text-xs">No video files (.mp4 / .mov) found in folder.</td></tr>';
        renderPagination('gdrive-videos-pagination', 1, 0, 0, 'changeGDriveVideoPage', GDRIVE_PAGE_SIZE);
        return;
      }

      tbody.innerHTML = pageVideos.map((v, pageIdx) => {
        const globalIdx = start + pageIdx;
        const statusBadge = v.isPosted
          ? '<span class="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-purple-950 text-purple-400 border border-purple-800">✓ Posted</span>'
          : '<span class="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">Ready</span>';

        const publishBtn = v.isPosted
          ? '<button onclick="onGDriveVideoActionClick(' + globalIdx + ')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold">Re-Post</button>'
          : '<button onclick="onGDriveVideoActionClick(' + globalIdx + ')" class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[10px] font-black shadow">Post</button>';

        const deleteBtn = '<button onclick="onGDriveVideoDeleteClick(' + globalIdx + ')" class="p-1 rounded bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 transition ml-1" title="Delete / Trash from Drive">🗑️</button>';

        return '<tr class="hover:bg-slate-900/60 transition">' +
          '<td class="py-2 px-3 max-w-[200px] truncate">' +
            '<div class="font-bold text-slate-200 text-xs truncate" title="' + v.cleanTitle + '">' + v.cleanTitle + '</div>' +
            '<div class="text-[9px] font-mono text-slate-500 truncate">' + v.name + '</div>' +
          '</td>' +
          '<td class="py-2 px-2 font-mono text-slate-400 text-xs">' + v.sizeMb + ' MB</td>' +
          '<td class="py-2 px-2">' + statusBadge + '</td>' +
          '<td class="py-2 px-3 text-right whitespace-nowrap">' + publishBtn + deleteBtn + '</td>' +
        '</tr>';
      }).join('');

      renderPagination('gdrive-videos-pagination', page, totalPages, total, 'changeGDriveVideoPage', GDRIVE_PAGE_SIZE);
    }

    async function onGDriveVideoDeleteClick(idx) {
      if (!cachedGDriveVideos[idx]) return;
      const file = cachedGDriveVideos[idx];

      if (!confirm('Move "' + (file.cleanTitle || file.name) + '" to Google Drive Trash?')) return;

      showToast('Moving file to Google Drive Trash...');

      try {
        const url = '/api/gdrive-reels/files/' + encodeURIComponent(file.id) + (activeGDriveChannelId ? '?channelId=' + encodeURIComponent(activeGDriveChannelId) : '');
        const res = await safeFetchJson(url, { method: 'DELETE' });
        if (res.ok && res.data?.success) {
          showToast('✓ File moved to Google Drive Trash');
          if (activeGDriveChannelId) {
            await selectGDriveChannel(activeGDriveChannelId);
          }
        } else {
          showToast(res.data?.error || res.error || 'Failed to delete file from Drive', true);
        }
      } catch (e) {
        showToast('Error: ' + e.message, true);
      }
    }

    async function onGDriveVideoActionClick(idx) {
      if (!cachedGDriveVideos[idx] || !activeGDriveChannelId) return;
      const file = cachedGDriveVideos[idx];

      if (!confirm('Publish "' + file.cleanTitle + '" to Facebook now?')) return;
      showToast('Downloading & uploading Reel to Facebook...');

      try {
        const res = await safeFetchJson('/api/gdrive-reels/channels/' + activeGDriveChannelId + '/publish-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: file.id })
        });
        if (res.ok && res.data?.success) {
          showToast('✓ Reel "' + res.data.cleanTitle + '" published!');
          await selectGDriveChannel(activeGDriveChannelId);
          await refreshGDriveChannels();
        } else {
          showToast(res.data?.error || res.error || 'Publish failed', true);
        }
      } catch (e) {
        showToast('Error: ' + e.message, true);
      }
    }

    async function publishNextForSelectedChannel() {
      if (activeGDriveChannelId) await publishNextForGDriveChannel(activeGDriveChannelId);
    }

    async function rescanSelectedChannel() {
      if (!activeGDriveChannelId) return;
      showToast('Scanning folder...');
      await selectGDriveChannel(activeGDriveChannelId);
      showToast('✓ Folder scan completed');
    }

    async function publishNextForGDriveChannel(channelId) {
      showToast('Publishing next pending Reel from Drive...');
      try {
        const res = await safeFetchJson('/api/gdrive-reels/channels/' + channelId + '/publish-next', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok && res.data?.success) {
          showToast('✓ Reel "' + res.data.cleanTitle + '" published!');
          if (activeGDriveChannelId === channelId) await selectGDriveChannel(channelId);
          await refreshGDriveChannels();
        } else {
          showToast(res.data?.error || res.error || 'Publish failed', true);
        }
      } catch (e) {
        showToast('Error: ' + e.message, true);
      }
    }

    function showAddChannelForm() {
      document.getElementById('gdrive-form-channel-id').value = '';
      document.getElementById('gdrive-form-channel-name').value = '';
      document.getElementById('gdrive-form-folder-input').value = '';
      document.getElementById('gdrive-form-first-comment').value = '';
      document.getElementById('gdrive-form-custom-caption').value = '';
      document.getElementById('gdrive-form-interval-select').value = '2';
      document.getElementById('gdrive-form-order-select').value = 'oldest_first';
      document.getElementById('gdrive-form-category-select').value = 'auto';
      document.getElementById('gdrive-form-custom-hashtags').value = '';
      document.getElementById('gdrive-form-active-toggle').checked = true;
      document.getElementById('gdrive-form-delete-toggle').checked = true;
      if (document.getElementById('gdrive-form-yt-toggle')) document.getElementById('gdrive-form-yt-toggle').checked = true;
      if (document.getElementById('gdrive-form-tiktok-toggle')) document.getElementById('gdrive-form-tiktok-toggle').checked = true;
      if (document.getElementById('gdrive-form-story-toggle')) document.getElementById('gdrive-form-story-toggle').checked = true;
      if (document.getElementById('gdrive-form-groups-toggle')) document.getElementById('gdrive-form-groups-toggle').checked = false;
      document.getElementById('gdrive-form-mode-viral').checked = true;
      toggleFormCaptionBox();

      const card = document.getElementById('gdrive-channel-form-card');
      if (card) {
        card.classList.remove('hidden');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function editGDriveChannel(id) {
      const channel = cachedGDriveChannels.find(c => c._id === id);
      if (!channel) return;

      document.getElementById('gdrive-form-channel-id').value = channel._id;
      document.getElementById('gdrive-form-channel-name').value = channel.name || '';
      document.getElementById('gdrive-form-folder-input').value = channel.folderUrlOrId || '';
      document.getElementById('gdrive-form-page-select').value = channel.pageId || '';
      document.getElementById('gdrive-form-interval-select').value = String(channel.scheduleIntervalHours || 2);
      document.getElementById('gdrive-form-order-select').value = channel.orderStrategy || 'oldest_first';
      document.getElementById('gdrive-form-category-select').value = channel.category || 'auto';
      document.getElementById('gdrive-form-custom-hashtags').value = channel.customHashtags || '';
      document.getElementById('gdrive-form-first-comment').value = channel.firstCommentText || '';
      document.getElementById('gdrive-form-custom-caption').value = channel.customCaption || '';
      document.getElementById('gdrive-form-active-toggle').checked = Boolean(channel.isActive);
      document.getElementById('gdrive-form-delete-toggle').checked = channel.deleteAfterPosting !== false;
      if (document.getElementById('gdrive-form-yt-toggle')) document.getElementById('gdrive-form-yt-toggle').checked = channel.autoPostYouTube !== false;
      if (document.getElementById('gdrive-form-tiktok-toggle')) document.getElementById('gdrive-form-tiktok-toggle').checked = channel.autoPostTikTok !== false;
      if (document.getElementById('gdrive-form-story-toggle')) document.getElementById('gdrive-form-story-toggle').checked = channel.postStory !== false;
      if (document.getElementById('gdrive-form-groups-toggle')) document.getElementById('gdrive-form-groups-toggle').checked = Boolean(channel.shareToGroups);

      if (channel.captionStrategy === 'custom') {
        document.getElementById('gdrive-form-mode-custom').checked = true;
      } else {
        document.getElementById('gdrive-form-mode-viral').checked = true;
      }
      toggleFormCaptionBox();

      const card = document.getElementById('gdrive-channel-form-card');
      if (card) {
        card.classList.remove('hidden');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function hideChannelForm() {
      const card = document.getElementById('gdrive-channel-form-card');
      if (card) card.classList.add('hidden');
    }

    function toggleFormCaptionBox() {
      const isCustom = document.getElementById('gdrive-form-mode-custom')?.checked;
      const box = document.getElementById('gdrive-form-custom-caption-box');
      if (box) box.classList.toggle('hidden', !isCustom);
    }

    async function handleSaveGDriveChannel(e) {
      if (e) e.preventDefault();
      const channelId = document.getElementById('gdrive-form-channel-id')?.value;
      const payload = {
        name: document.getElementById('gdrive-form-channel-name')?.value.trim(),
        folderUrlOrId: document.getElementById('gdrive-form-folder-input')?.value.trim(),
        pageId: document.getElementById('gdrive-form-page-select')?.value,
        scheduleIntervalHours: parseInt(document.getElementById('gdrive-form-interval-select')?.value || '2', 10) || 2,
        orderStrategy: document.getElementById('gdrive-form-order-select')?.value || 'oldest_first',
        category: document.getElementById('gdrive-form-category-select')?.value || 'auto',
        customHashtags: document.getElementById('gdrive-form-custom-hashtags')?.value.trim() || '',
        isActive: document.getElementById('gdrive-form-active-toggle')?.checked || false,
        deleteAfterPosting: document.getElementById('gdrive-form-delete-toggle')?.checked ?? true,
        deleteAction: 'trash',
        autoPostYouTube: document.getElementById('gdrive-form-yt-toggle')?.checked ?? true,
        autoPostTikTok: document.getElementById('gdrive-form-tiktok-toggle')?.checked ?? true,
        postStory: document.getElementById('gdrive-form-story-toggle')?.checked ?? true,
        shareToGroups: document.getElementById('gdrive-form-groups-toggle')?.checked ?? false,
        captionStrategy: document.getElementById('gdrive-form-mode-custom')?.checked ? 'custom' : 'viral_hashtags',
        customCaption: document.getElementById('gdrive-form-custom-caption')?.value || '',
        firstCommentText: document.getElementById('gdrive-form-first-comment')?.value.trim() || ''
      };
      if (channelId) payload._id = channelId;

      const res = await safeFetchJson('/api/gdrive-reels/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok && res.data?.channel) {
        showToast('✓ Channel saved!');
        hideChannelForm();
        activeGDriveChannelId = res.data.channel._id;
        await refreshGDriveChannels();
      } else {
        showToast(res.data?.error || res.error || 'Failed to save channel', true);
      }
    }

    async function deleteGDriveChannel(id) {
      if (!confirm('Delete this channel?')) return;
      const res = await safeFetchJson('/api/gdrive-reels/channels/' + id, { method: 'DELETE' });
      if (res.ok) {
        showToast('✓ Channel deleted');
        if (activeGDriveChannelId === id) activeGDriveChannelId = null;
        await refreshGDriveChannels();
      } else {
        showToast('Failed to delete channel', true);
      }
    }

    async function saveGlobalGDriveApiKey() {
      const apiKey = document.getElementById('gdrive-global-api-key')?.value.trim();
      if (!apiKey) return showToast('Enter API Key first', true);

      const res = await safeFetchJson('/api/gdrive-reels/global-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      if (res.ok) {
        showToast('✓ Global Drive API Key saved!');
        await refreshGDriveChannels();
      } else {
        showToast('Failed to save API key', true);
      }
    }

    async function testScanFormFolder() {
      const folderUrlOrId = document.getElementById('gdrive-form-folder-input')?.value.trim();
      if (!folderUrlOrId) return showToast('Paste folder link first', true);

      showToast('Scanning folder...');
      const res = await safeFetchJson('/api/gdrive-reels/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderUrlOrId })
      });
      if (res.ok && res.data?.scan) {
        showToast('✓ Found ' + res.data.scan.totalVideos + ' video files');
      } else {
        showToast(res.error || 'Scan failed', true);
      }
    }

    async function runAllDueChannelsNow() {
      showToast('Executing scheduled posts for all due channels...');
      const res = await safeFetchJson('/api/gdrive-reels/publish-all-due', { method: 'POST' });
      if (res.ok && res.data?.summary) {
        const pubCount = (res.data.summary.processed || []).filter(p => p.status === 'published').length;
        showToast('✓ ' + pubCount + ' Reels published across channels');
        await refreshGDriveChannels();
      } else {
        showToast(res.error || 'No channels due', true);
      }
    }

    // --- YOUTUBE SHORTS MULTI-CHANNEL AUTOMATION ---
    let ytLogsData = [];
    let ytLogsPage = 1;
    let ytChannelsData = [];
    let ytAvailablePages = [];
    const YT_LOGS_PAGE_SIZE = 10;

    function changeYouTubeLogsPage(page) {
      ytLogsPage = page;
      renderYouTubeLogsPage(ytLogsPage);
    }

    function renderYouTubeLogsPage(page) {
      const tbody = document.getElementById('yt-table-body');
      if (!tbody) return;

      const total = ytLogsData.length;
      const totalPages = Math.ceil(total / YT_LOGS_PAGE_SIZE);
      const start = (page - 1) * YT_LOGS_PAGE_SIZE;
      const pageLogs = ytLogsData.slice(start, start + YT_LOGS_PAGE_SIZE);

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-500 font-mono text-xs">No YouTube Shorts uploads yet.</td></tr>';
        renderPagination('yt-pagination', 1, 0, 0, 'changeYouTubeLogsPage', YT_LOGS_PAGE_SIZE);
        return;
      }

      tbody.innerHTML = pageLogs.map(log => {
        const isSuccess = log.status === 'success';
        const isDryRun = log.status === 'dry_run';
        const statusBadge = isSuccess
          ? '<span class="px-1.5 py-0.2 text-[9px] rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PUB</span>'
          : (isDryRun 
              ? '<span class="px-1.5 py-0.2 text-[9px] rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">DRY</span>'
              : '<span class="px-1.5 py-0.2 text-[9px] rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">FAIL</span>');

        const videoLink = log.ytVideoId && !log.ytVideoId.startsWith('dryrun')
          ? '<a href="https://youtube.com/shorts/' + log.ytVideoId + '" target="_blank" class="text-red-400 hover:underline font-mono">' + log.ytVideoId + ' ↗</a>'
          : (log.ytVideoId || '-');

        return '<tr class="hover:bg-slate-900/40 text-xs transition">' +
          '<td class="py-2 pr-3 font-bengali text-slate-200 max-w-[200px] truncate" title="' + (log.articleTitle || '') + '">' + (log.articleTitle || 'Untitled') + '</td>' +
          '<td class="py-2 pr-3 text-red-300 font-semibold truncate max-w-[120px]">' + (log.channelTitle || 'YouTube Channel') + '</td>' +
          '<td class="py-2 pr-3">' + videoLink + '</td>' +
          '<td class="py-2 pr-3 text-slate-400 font-mono text-[11px]">' + (log.durationMs ? (log.durationMs / 1000).toFixed(1) + 's' : '-') + '</td>' +
          '<td class="py-2 pr-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">' + (log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-') + '</td>' +
          '<td class="py-2">' + statusBadge + '</td>' +
        '</tr>';
      }).join('');

      renderPagination('yt-pagination', page, totalPages, total, 'changeYouTubeLogsPage', YT_LOGS_PAGE_SIZE);
    }

    async function loadYouTube() {
      try {
        const [channelsRes, statusRes, pagesRes] = await Promise.all([
          safeFetchJson('/api/youtube/channels'),
          safeFetchJson('/api/youtube/status'),
          safeFetchJson('/api/pages')
        ]);

        if (pagesRes.ok && Array.isArray(pagesRes.data)) {
          ytAvailablePages = pagesRes.data;
          populateChannelPageDropdowns(ytAvailablePages);
        }

        const badge = document.getElementById('yt-channel-count-badge');
        const countDisplay = document.getElementById('yt-channel-count-display');
        const clientIdInput = document.getElementById('yt-client-id');
        const clientSecInput = document.getElementById('yt-client-secret');

        if (statusRes.ok && statusRes.data) {
          const d = statusRes.data;
          if (clientIdInput && d.clientId) clientIdInput.value = d.clientId;
          if (d.hasClientSecret && clientSecInput && !clientSecInput.value) {
            clientSecInput.placeholder = '•••••••• (Saved)';
          }
        }

        ytChannelsData = (channelsRes.ok && Array.isArray(channelsRes.data?.channels)) ? channelsRes.data.channels : [];

        if (badge) {
          const activeCount = ytChannelsData.filter(c => c.isActive).length;
          badge.innerText = activeCount > 0 ? (activeCount + ' Active Channels') : 'No Channels Active';
          badge.className = activeCount > 0
            ? 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-600/40'
            : 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-600/20 text-amber-400 border border-amber-600/40';
        }
        if (countDisplay) {
          countDisplay.innerText = ytChannelsData.length;
        }

        renderYouTubeChannelsGrid(ytChannelsData);
        loadYouTubeLogs();
      } catch (e) {
        console.warn('loadYouTube error:', e);
      }
    }

    function populateChannelPageDropdowns(pages) {
      const connectSelect = document.getElementById('yt-connect-page-select');
      const editSelect = document.getElementById('yt-edit-page-select');
      if (!pages || !Array.isArray(pages)) return;

      const optionsHtml = pages.map(p => 
        '<option value="' + p._id + '">' + p.name + ' (' + p._id + ')</option>'
      ).join('') + '<option value="all">All Pages (Global Channel)</option>';

      if (connectSelect) connectSelect.innerHTML = optionsHtml;
      if (editSelect) editSelect.innerHTML = optionsHtml;
    }

    function renderYouTubeChannelsGrid(channels) {
      const container = document.getElementById('yt-channels-grid');
      if (!container) return;

      if (!channels || channels.length === 0) {
        container.innerHTML = '<div class="glass-panel p-8 rounded-xl text-center space-y-3 col-span-full border border-dashed border-slate-800">' +
          '<div class="w-12 h-12 rounded-full bg-red-600/10 text-red-400 flex items-center justify-center mx-auto text-xl border border-red-500/20">📺</div>' +
          '<div class="font-bold text-white text-sm">No YouTube Channels Connected Yet</div>' +
          '<p class="text-xs text-slate-400 max-w-md mx-auto">Connect your BD News, Trending News World, or other YouTube channels to automatically publish 15s video reels as Shorts.</p>' +
          '<button onclick="openConnectChannelModal()" class="px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 text-white font-bold text-xs shadow-glow-red transition active:scale-95 inline-flex items-center gap-1.5">' +
            '<span>+ Connect Your First Channel</span>' +
          '</button>' +
        '</div>';
        return;
      }

      container.innerHTML = channels.map(ch => {
        const pageName = ch.targetPageName || (ch.targetPageId === 'all' ? 'All Pages' : (ch.targetPageId || 'Unmapped'));
        const isEnglish = ch.language === 'en';
        const langBadge = isEnglish
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800/50">English</span>'
          : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">বাংলা</span>';

        const avatarSrc = ch.thumbnailUrl || '/assets/images/favicon.png';
        const handle = ch.customUrl || ('@' + ch._id.slice(0, 10));
        const subCount = Number(ch.subscriberCount || 0).toLocaleString();
        const vidCount = Number(ch.videoCount || 0).toLocaleString();

        return '<div class="glass-panel p-4 rounded-xl flex flex-col justify-between space-y-3 border border-slate-800 hover:border-red-900/40 transition relative group">' +
          '<div>' +
            '<div class="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2.5">' +
              '<div class="flex items-center gap-1.5">' +
                '<span class="w-2 h-2 rounded-full ' + (ch.isActive ? 'bg-emerald-400 shadow-glow-emerald' : 'bg-slate-600') + '"></span>' +
                '<span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">' + (ch.isActive ? 'Active Channel' : 'Inactive') + '</span>' +
              '</div>' +
              '<div class="flex items-center gap-1">' +
                langBadge +
                '<button data-id="' + ch._id + '" onclick="openEditYouTubeChannel(this.dataset.id)" title="Edit Settings" class="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition text-[11px]">' +
                  '⚙️' +
                '</button>' +
              '</div>' +
            '</div>' +

            '<div class="flex items-center gap-3 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 mb-2.5">' +
              '<img src="' + avatarSrc + '" alt="Avatar" class="w-10 h-10 rounded-full border border-red-500/40 object-cover shrink-0" onerror="this.src=&quot;/assets/images/favicon.png&quot;" />' +
              '<div class="overflow-hidden min-w-0 flex-1">' +
                '<div class="font-bold text-white text-xs truncate" title="' + ch.title + '">' + ch.title + '</div>' +
                '<div class="text-[11px] text-slate-400 truncate font-mono">' + handle + '</div>' +
              '</div>' +
            '</div>' +

            '<div class="p-2 rounded-lg bg-red-950/20 border border-red-900/30 text-[11px] space-y-1 mb-2.5">' +
              '<div class="flex items-center justify-between">' +
                '<span class="text-slate-400 text-[10px]">Linked Facebook Page:</span>' +
                '<span class="text-red-300 font-bold truncate max-w-[150px]">' + pageName + '</span>' +
              '</div>' +
              '<div class="flex items-center justify-between">' +
                '<span class="text-slate-400 text-[10px]">Channel ID:</span>' +
                '<span class="text-slate-400 font-mono text-[9px] truncate max-w-[150px]">' + ch._id + '</span>' +
              '</div>' +
            '</div>' +

            '<div class="grid grid-cols-2 gap-2 text-center text-xs mb-1">' +
              '<div class="p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">' +
                '<div class="font-bold text-white font-mono text-sm">' + subCount + '</div>' +
                '<div class="text-[10px] text-slate-400">Subscribers</div>' +
              '</div>' +
              '<div class="p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">' +
                '<div class="font-bold text-white font-mono text-sm">' + vidCount + '</div>' +
                '<div class="text-[10px] text-slate-400">Total Videos</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="pt-2 border-t border-slate-800 space-y-2">' +
            '<div class="flex items-center justify-between text-xs">' +
              '<span class="text-slate-400 text-[11px]">Auto-Upload:</span>' +
              '<label class="relative inline-flex items-center cursor-pointer">' +
                '<input type="checkbox" ' + (ch.autoUpload ? 'checked' : '') + ' data-id="' + ch._id + '" onchange="toggleChannelAutoUpload(this.dataset.id, this.checked)" class="sr-only peer" />' +
                '<div class="w-7 h-3.5 bg-slate-800 rounded-full p-0.5 relative transition-colors peer-checked:bg-red-600 flex items-center">' +
                  '<div class="w-2.5 h-2.5 bg-white rounded-full transition-transform ' + (ch.autoUpload ? 'translate-x-3 bg-white' : 'translate-x-0 bg-slate-400') + '"></div>' +
                '</div>' +
              '</label>' +
            '</div>' +

            '<div class="grid grid-cols-3 gap-1.5 pt-1">' +
              '<button data-id="' + ch._id + '" onclick="syncYouTubeChannel(this.dataset.id)" class="py-1 px-1.5 text-[10px] font-semibold rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition flex items-center justify-center gap-1">' +
                '<span>🔄 Sync</span>' +
              '</button>' +
              '<button data-id="' + ch._id + '" onclick="triggerYouTubeUploadNow(this.dataset.id)" class="py-1 px-1.5 text-[10px] font-semibold rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition flex items-center justify-center gap-1">' +
                '<span>⚡ Upload</span>' +
              '</button>' +
              '<button data-id="' + ch._id + '" onclick="deleteYouTubeChannel(this.dataset.id)" class="py-1 px-1.5 text-[10px] font-semibold rounded bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-800 transition flex items-center justify-center gap-1">' +
                '<span>🗑️ Remove</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function openConnectChannelModal() {
      const modal = document.getElementById('modal-connect-yt-channel');
      if (modal) modal.classList.remove('hidden');
    }

    function closeConnectChannelModal() {
      const modal = document.getElementById('modal-connect-yt-channel');
      if (modal) modal.classList.add('hidden');
    }

    function switchConnectTab(tab) {
      const btnOauth = document.getElementById('btn-connect-tab-oauth');
      const btnManual = document.getElementById('btn-connect-tab-manual');
      const paneOauth = document.getElementById('connect-pane-oauth');
      const paneManual = document.getElementById('connect-pane-manual');

      if (tab === 'oauth') {
        if (btnOauth) btnOauth.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg bg-red-600/20 text-red-300 border border-red-500/40 transition';
        if (btnManual) btnManual.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-white transition';
        if (paneOauth) paneOauth.classList.remove('hidden');
        if (paneManual) paneManual.classList.add('hidden');
      } else {
        if (btnManual) btnManual.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg bg-red-600/20 text-red-300 border border-red-500/40 transition';
        if (btnOauth) btnOauth.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-white transition';
        if (paneManual) paneManual.classList.remove('hidden');
        if (paneOauth) paneOauth.classList.add('hidden');
      }
    }

    async function startGoogleOAuthForChannel() {
      const pageSelect = document.getElementById('yt-connect-page-select');
      const langSelect = document.getElementById('yt-connect-language-select');
      const targetPageId = pageSelect?.value || 'all';
      const targetPageName = pageSelect?.options[pageSelect.selectedIndex]?.text || '';
      const language = langSelect?.value || 'bn';

      showToast('Starting Google Sign-In for channel...');
      const query = new URLSearchParams({
        origin: 'youtube',
        targetPageId,
        targetPageName,
        language
      });

      const res = await safeFetchJson('/api/youtube/auth/url?' + query.toString());
      if (res.ok && res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        showToast('Failed to start Google OAuth: ' + (res.error || 'Check Client ID'), true);
      }
    }

    async function submitManualChannel() {
      const title = document.getElementById('yt-manual-title')?.value.trim();
      const token = document.getElementById('yt-manual-token')?.value.trim();
      const pageSelect = document.getElementById('yt-connect-page-select');
      const langSelect = document.getElementById('yt-connect-language-select');
      const clientId = document.getElementById('yt-manual-client-id')?.value.trim();
      const clientSecret = document.getElementById('yt-manual-client-secret')?.value.trim();
      const btn = document.getElementById('btn-save-manual-channel');

      if (!token) {
        showToast('Please paste the OAuth Refresh Token', true);
        return;
      }

      const payload = {
        title,
        refreshToken: token,
        targetPageId: pageSelect?.value || 'all',
        targetPageName: pageSelect?.options[pageSelect.selectedIndex]?.text || 'All Pages',
        language: langSelect?.value || 'bn',
        autoUpload: true,
      };
      if (clientId) payload.clientId = clientId;
      if (clientSecret) payload.clientSecret = clientSecret;

      if (btn) btn.disabled = true;
      showToast('Verifying channel with YouTube API...');

      try {
        const res = await safeFetchJson('/api/youtube/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok && res.data?.channel) {
          showToast('✓ Channel connected successfully!');
          closeConnectChannelModal();
          loadYouTube();
        } else {
          showToast('Failed: ' + (res.data?.error || res.error || 'Verification failed'), true);
        }
      } catch (e) {
        showToast('Error: ' + e.message, true);
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async function syncYouTubeChannel(id) {
      showToast('Syncing channel statistics...');
      const res = await safeFetchJson('/api/youtube/channels/' + id + '/sync', { method: 'POST' });
      if (res.ok) {
        showToast('✓ Statistics refreshed');
        loadYouTube();
      } else {
        showToast('Sync failed: ' + (res.data?.error || res.error), true);
      }
    }

    async function deleteYouTubeChannel(id) {
      if (!confirm('Are you sure you want to disconnect this YouTube channel?')) return;
      showToast('Disconnecting channel...');
      const res = await safeFetchJson('/api/youtube/channels/' + id, { method: 'DELETE' });
      if (res.ok) {
        showToast('✓ Channel disconnected');
        loadYouTube();
      } else {
        showToast('Failed to disconnect: ' + (res.data?.error || res.error), true);
      }
    }

    async function toggleChannelAutoUpload(id, autoUpload) {
      await safeFetchJson('/api/youtube/channels/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoUpload })
      });
      showToast(autoUpload ? 'Auto-upload enabled' : 'Auto-upload paused');
    }

    function openEditYouTubeChannel(id) {
      const ch = ytChannelsData.find(c => c._id === id);
      if (!ch) return;

      document.getElementById('yt-edit-channel-id').value = ch._id;
      document.getElementById('yt-edit-title').value = ch.title || '';
      document.getElementById('yt-edit-page-select').value = ch.targetPageId || 'all';
      document.getElementById('yt-edit-language-select').value = ch.language || 'bn';
      document.getElementById('yt-edit-auto-toggle').checked = ch.autoUpload !== false;

      const modal = document.getElementById('modal-edit-yt-channel');
      if (modal) modal.classList.remove('hidden');
    }

    function closeEditYouTubeChannelModal() {
      const modal = document.getElementById('modal-edit-yt-channel');
      if (modal) modal.classList.add('hidden');
    }

    async function saveEditYouTubeChannel() {
      const id = document.getElementById('yt-edit-channel-id').value;
      const title = document.getElementById('yt-edit-title').value.trim();
      const pageSelect = document.getElementById('yt-edit-page-select');
      const langSelect = document.getElementById('yt-edit-language-select');
      const autoUpload = document.getElementById('yt-edit-auto-toggle').checked;

      const payload = {
        title,
        targetPageId: pageSelect?.value || 'all',
        targetPageName: pageSelect?.options[pageSelect.selectedIndex]?.text || 'All Pages',
        language: langSelect?.value || 'bn',
        autoUpload,
      };

      showToast('Saving channel settings...');
      const res = await safeFetchJson('/api/youtube/channels/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('✓ Settings updated');
        closeEditYouTubeChannelModal();
        loadYouTube();
      } else {
        showToast('Update failed: ' + (res.data?.error || res.error), true);
      }
    }

    async function saveYouTubeSettings() {
      const clientId = document.getElementById('yt-client-id')?.value.trim();
      const clientSecret = document.getElementById('yt-client-secret')?.value.trim();

      const payload = {};
      if (clientId) payload.clientId = clientId;
      if (clientSecret) payload.clientSecret = clientSecret;

      showToast('Saving global Google OAuth credentials...');
      const res = await safeFetchJson('/api/youtube/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('✓ Google OAuth credentials saved');
        loadYouTube();
      } else {
        showToast('Save failed', true);
      }
    }

    async function triggerYouTubeUploadNow(channelId) {
      const btn = document.getElementById('yt-upload-btn');
      if (btn) btn.disabled = true;
      showToast('Uploading latest short...');
      try {
        const payload = {};
        if (channelId && typeof channelId === 'string') payload.channelId = channelId;

        const res = await safeFetchJson('/api/youtube/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok && res.data) {
          showToast('✓ Uploaded Short: ' + (res.data.channelTitle || 'YouTube'));
          loadYouTubeLogs();
        } else {
          showToast('Upload failed: ' + (res.data?.error || res.error || 'Check OAuth'), true);
        }
      } catch (e) {
        showToast('Error: ' + e.message, true);
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async function loadYouTubeLogs() {
      const res = await safeFetchJson('/api/youtube/logs?limit=50');
      ytLogsData = (res.ok && res.data?.logs && Array.isArray(res.data.logs)) ? res.data.logs : [];
      ytLogsPage = 1;
      renderYouTubeLogsPage(1);
    }

    async function startGoogleOAuth() {
      openConnectChannelModal();
    }

    async function connectGDriveOAuth() {
      showToast('Starting Google Sign-In for Drive Auto-Delete...');
      const res = await safeFetchJson('/api/gdrive-reels/auth/url?origin=gdrive');
      if (res.ok && res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        showToast('Google Sign-In failed to start', true);
      }
    }

    function copyRedirectUri() {
      const uri = window.location.origin + '/api/youtube/auth/callback';
      navigator.clipboard.writeText(uri).then(() => {
        showToast('✓ Redirect URI copied');
      });
    }

    setTimeout(() => {
      const disp = document.getElementById('yt-redirect-uri-display');
      if (disp) disp.innerText = window.location.origin + '/api/youtube/auth/callback';
    }, 200);

    // Initial load & Tab URL check
    loadOverview();
    initCronPills();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'youtube') {
      switchTab('youtube');
      if (urlParams.get('auth') === 'success') {
        const titleParam = urlParams.get('title');
        const msg = titleParam ? ('🎉 YouTube Channel "' + decodeURIComponent(titleParam) + '" Connected!') : '🎉 YouTube Channel Connected!';
        setTimeout(() => showToast(msg), 500);
      }
    } else if (urlParams.get('tab') === 'gdrive-reels') {
      switchTab('gdrive-reels');
      if (urlParams.get('auth') === 'success') {
        setTimeout(() => showToast('🎉 Google Drive Connected (Auto-Delete Ready)!'), 500);
      }
    }
