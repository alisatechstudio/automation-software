import { Router, Request, Response } from 'express';

export const dashboardRouter = Router();

dashboardRouter.get('/', (req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="bn" class="dark scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BD News 24/7 - Facebook Automation 3D Control Center</title>
  <link rel="icon" type="image/png" href="/assets/images/favicon.png">
  <link rel="shortcut icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/assets/images/favicon.png">
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
            bengali: ['"Hind Siliguri"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          },
          colors: {
            brand: {
              400: '#f87171',
              500: '#ef4444',
              600: '#dc2626',
              700: '#b91c1c',
              900: '#7f1d1d',
              950: '#450a0a',
            },
            cyber: {
              cyan: '#06b6d4',
              blue: '#3b82f6',
              purple: '#a855f7',
              emerald: '#10b981',
              amber: '#f59e0b',
            }
          },
          boxShadow: {
            'glow-red': '0 0 30px -5px rgba(239, 68, 68, 0.35)',
            'glow-cyan': '0 0 30px -5px rgba(6, 182, 212, 0.35)',
            'glow-emerald': '0 0 30px -5px rgba(16, 185, 129, 0.35)',
            'glow-purple': '0 0 30px -5px rgba(168, 85, 247, 0.35)',
            '3d-card': '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            '3d-elevate': '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 25px -5px rgba(239, 68, 68, 0.25)',
          },
          animation: {
            'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            'float-slow': 'float 6s ease-in-out infinite',
            'radar': 'radar 2s infinite linear',
          },
          keyframes: {
            float: {
              '0%, 100%': { transform: 'translateY(0px)' },
              '50%': { transform: 'translateY(-6px)' },
            },
            radar: {
              '0%': { transform: 'scale(0.8)', opacity: '0.8' },
              '100%': { transform: 'scale(2.2)', opacity: '0' },
            }
          }
        }
      }
    }
  </script>

  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #030712;
      overflow-x: hidden;
    }
    .bn { font-family: 'Hind Siliguri', sans-serif; }
    .mono { font-family: 'JetBrains Mono', monospace; }

    /* Custom Futuristic Scrollbar */
    ::-webkit-scrollbar { width: 7px; height: 7px; }
    ::-webkit-scrollbar-track { background: #030712; }
    ::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, #1f2937, #374151);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover { background: #dc2626; }

    /* 3D Glassmorphism Panel */
    .glass-panel {
      background: rgba(11, 17, 32, 0.75);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .glass-panel:hover {
      border-color: rgba(239, 68, 68, 0.25);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px -5px rgba(239, 68, 68, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }

    /* 3D Tilt Card Container */
    .tilt-card {
      transform-style: preserve-3d;
      perspective: 1000px;
      transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.25s cubic-bezier(0.2, 0, 0, 1);
    }
    .tilt-card-inner {
      transform: translateZ(25px);
    }

    /* Animated Ambient Nebula Background */
    .ambient-glow-1 {
      position: fixed;
      top: -150px;
      left: 15%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(220, 38, 38, 0.15) 0%, rgba(220, 38, 38, 0) 70%);
      filter: blur(80px);
      z-index: 0;
      pointer-events: none;
      animation: float 9s ease-in-out infinite alternate;
    }
    .ambient-glow-2 {
      position: fixed;
      bottom: -150px;
      right: 10%;
      width: 700px;
      height: 700px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(6, 182, 212, 0) 70%);
      filter: blur(90px);
      z-index: 0;
      pointer-events: none;
      animation: float 11s ease-in-out infinite alternate-reverse;
    }
    .ambient-glow-3 {
      position: fixed;
      top: 40%;
      right: 25%;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, rgba(168, 85, 247, 0) 70%);
      filter: blur(95px);
      z-index: 0;
      pointer-events: none;
    }

    /* Cyber Grid Matrix Background */
    .cyber-grid {
      position: fixed;
      inset: 0;
      background-size: 50px 50px;
      background-image: 
        linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, transparent 80%);
      -webkit-mask-image: radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, transparent 80%);
      z-index: 0;
      pointer-events: none;
    }

    /* Tab Switch Slide Animation */
    .tab-content {
      animation: tabFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes tabFadeIn {
      from { opacity: 0; transform: translateY(8px) scale(0.995); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  </style>
</head>
<body class="text-slate-100 min-h-screen flex flex-col relative selection:bg-red-500 selection:text-white">

  <!-- Ambient 3D Glow Orbs -->
  <div class="ambient-glow-1"></div>
  <div class="ambient-glow-2"></div>
  <div class="ambient-glow-3"></div>
  <div class="cyber-grid"></div>

  <!-- Interactive 3D Particle Canvas -->
  <canvas id="bg-canvas" class="fixed inset-0 pointer-events-none z-0 opacity-40"></canvas>

  <!-- Top Glassmorphic Navbar -->
  <header class="border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-2xl sticky top-0 z-50 transition-all duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
      
      <!-- Logo & Brand Header -->
      <div class="flex items-center space-x-3.5 group cursor-pointer" onclick="switchTab('overview')">
        <div class="relative">
          <div class="absolute -inset-1 bg-gradient-to-r from-red-600 to-amber-600 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-300"></div>
          <img src="/assets/images/favicon.png" alt="BD News 24/7" class="relative w-11 h-11 rounded-full object-cover border-2 border-red-500/80 shadow-glow-red transform group-hover:scale-105 transition-all duration-300" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">BD News 24/7</span>
            <span class="px-2 py-0.5 text-[10px] font-mono tracking-wider font-bold rounded-md bg-red-950/80 text-red-400 border border-red-800/60 shadow-sm uppercase">v2.0 Pro</span>
          </div>
          <p class="text-xs text-slate-400 font-medium hidden sm:block">Autonomous Meta Graph API & Visual Engine</p>
        </div>
      </div>

      <!-- Action Controls & Status Indicator -->
      <div class="flex items-center space-x-2.5 sm:space-x-3.5">
        <!-- Live / Sandbox Badge -->
        <div class="relative group">
          <div id="status-pulse-radar" class="absolute -inset-1 rounded-full bg-emerald-500 opacity-20 animate-ping hidden"></div>
          <span id="dry-run-badge" class="relative px-3.5 py-1.5 text-xs font-semibold rounded-full bg-slate-900 text-slate-300 border border-slate-700/80 shadow-md flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Checking Engine...</span>
          </span>
        </div>

        <!-- Poll RSS Button -->
        <button onclick="triggerPollNow()" class="group relative px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-cyan-500/50 flex items-center gap-2 transition-all duration-300 shadow-md hover:shadow-glow-cyan active:scale-95">
          <svg class="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span class="hidden sm:inline">Poll RSS</span>
        </button>

        <!-- Publish Next Article Button (Hero CTA) -->
        <button onclick="publishNextNow()" class="group relative px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 text-white flex items-center gap-2 transition-all duration-300 shadow-glow-red hover:shadow-3d-elevate transform active:scale-95 border border-red-400/30">
          <svg class="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          <span>Publish Now</span>
        </button>
      </div>

    </div>
  </header>

  <!-- Navigation Glass Tabs -->
  <div class="border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md sticky top-20 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 sm:space-x-4 overflow-x-auto py-2.5 no-scrollbar">
      <button onclick="switchTab('overview')" class="tab-btn active px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-red-400 bg-red-950/40 border border-red-800/50 shadow-inner flex items-center gap-2 transition-all">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        Overview
      </button>
      <button onclick="switchTab('queue')" class="tab-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent transition-all flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
        Queue & Logs
      </button>
      <button onclick="switchTab('sources')" class="tab-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent transition-all flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z"/></svg>
        RSS Sources
      </button>
      <button onclick="switchTab('pages')" class="tab-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent transition-all flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        Facebook Pages
      </button>
      <button onclick="switchTab('groups')" class="tab-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent transition-all flex items-center gap-2">
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        <span>Groups (গ্রুপ শেয়ার)</span>
      </button>
      <button onclick="switchTab('reels')" class="tab-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent transition-all flex items-center gap-2">
        <svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        <span>🎬 Reels (রিলস)</span>
      </button>
      <button onclick="switchTab('youtube')" class="tab-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent transition-all flex items-center gap-2">
        <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        <span>📺 YouTube (ইউটিউব শর্টস)</span>
      </button>
      <button onclick="switchTab('preview')" class="tab-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent transition-all flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        Template Preview
      </button>
      <button onclick="switchTab('settings')" class="tab-btn px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent transition-all flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        Settings
      </button>
    </div>
  </div>

  <!-- Main Content Stage -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full relative z-10">

    <!-- 1. OVERVIEW TAB -->
    <div id="tab-overview" class="tab-content space-y-8">
      
      <!-- 3D Holographic Stat Cards Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        <!-- Card 1: Pending Queue -->
        <div class="tilt-card glass-panel rounded-2xl p-6 relative overflow-hidden group cursor-pointer" onmousemove="handleTilt(event, this)" onmouseleave="resetTilt(this)">
          <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <div class="tilt-card-inner">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-amber-400/90 font-mono">Pending Jobs</span>
              <div class="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
                <svg class="w-5 h-5 animate-spin" style="animation-duration: 8s;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
            </div>
            <div id="stat-pending" class="text-3xl sm:text-4xl font-extrabold mt-3 text-white tracking-tight font-mono">0</div>
            <div class="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Awaiting automatic schedule
            </div>
          </div>
        </div>

        <!-- Card 2: Published Successfully -->
        <div class="tilt-card glass-panel rounded-2xl p-6 relative overflow-hidden group cursor-pointer" onmousemove="handleTilt(event, this)" onmouseleave="resetTilt(this)">
          <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div class="tilt-card-inner">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-400/90 font-mono">Published Live</span>
              <div class="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
            </div>
            <div id="stat-published" class="text-3xl sm:text-4xl font-extrabold mt-3 text-white tracking-tight font-mono">0</div>
            <div class="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live on Meta Facebook Page
            </div>
          </div>
        </div>

        <!-- Card 3: Active RSS Feeds -->
        <div class="tilt-card glass-panel rounded-2xl p-6 relative overflow-hidden group cursor-pointer" onmousemove="handleTilt(event, this)" onmouseleave="resetTilt(this)">
          <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
          <div class="tilt-card-inner">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-cyan-400/90 font-mono">Active Feeds</span>
              <div class="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
            </div>
            <div id="stat-sources" class="text-3xl sm:text-4xl font-extrabold mt-3 text-white tracking-tight font-mono">0</div>
            <div class="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              bdnews.site / News sources
            </div>
          </div>
        </div>

        <!-- Card 4: Connected Facebook Pages -->
        <div class="tilt-card glass-panel rounded-2xl p-6 relative overflow-hidden group cursor-pointer" onmousemove="handleTilt(event, this)" onmouseleave="resetTilt(this)">
          <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
          <div class="tilt-card-inner">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-purple-400/90 font-mono">Connected Pages</span>
              <div class="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-sm">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              </div>
            </div>
            <div id="stat-pages" class="text-3xl sm:text-4xl font-extrabold mt-3 text-white tracking-tight font-mono">0</div>
            <div class="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              BD News 24/7 Official
            </div>
          </div>
        </div>

      </div>

      <!-- Core Engine Status & Architecture Flow -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Engine Status -->
        <div class="glass-panel rounded-2xl p-6 relative overflow-hidden">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-base font-bold text-white flex items-center gap-2.5">
              <span class="relative flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Engine Specifications & Safeguards
            </h3>
            <span class="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">Operational</span>
          </div>

          <div class="space-y-3.5 text-xs sm:text-sm text-slate-300">
            <div class="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span class="text-slate-400">Headless Renderer:</span>
              <span class="font-mono text-xs text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/50">Playwright Chromium + Canva Replica</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span class="text-slate-400">Bangla Typography:</span>
              <span class="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                Noto Sans Bengali & Hind Siliguri (Active)
              </span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span class="text-slate-400">Database Engine:</span>
              <span class="text-purple-400 font-mono text-xs font-semibold">MongoDB Atlas (Vercel Serverless Pool)</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span class="text-slate-400">Anti-Spam Human Jitter:</span>
              <span class="text-amber-300 font-mono text-xs">Dynamic Jitter Enabled (Safe Post Delivery)</span>
            </div>
            <div class="flex justify-between items-center py-2">
              <span class="text-slate-400">Meta Privacy Policy:</span>
              <a href="/privacy" target="_blank" class="text-rose-400 hover:text-rose-300 font-mono text-xs underline flex items-center gap-1">
                /privacy (Live Compliant) ↗
              </a>
            </div>
          </div>
        </div>

        <!-- 3D Pipeline Blueprint Flow -->
        <div class="glass-panel rounded-2xl p-6 relative overflow-hidden">
          <h3 class="text-base font-bold text-white mb-5 flex items-center gap-2">
            <svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            Automated Pipeline Blueprint
          </h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div class="p-3 rounded-xl bg-slate-950/70 border border-cyan-900/40 hover:border-cyan-500/50 transition">
              <div class="text-cyan-400 font-bold mb-1">Step 1: RSS Ingestion</div>
              <div class="text-slate-400 text-[11px]">GUID dedupe, title extraction, and age filtering.</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-950/70 border border-purple-900/40 hover:border-purple-500/50 transition">
              <div class="text-purple-400 font-bold mb-1">Step 2: Queue Matrix</div>
              <div class="text-slate-400 text-[11px]">FIFO schedule with backoff retry safeguards.</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-950/70 border border-amber-900/40 hover:border-amber-500/50 transition">
              <div class="text-amber-400 font-bold mb-1">Step 3: 3D Canva Renderer</div>
              <div class="text-slate-400 text-[11px]">Auto-fit Bengali typography into high-res banner.</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-950/70 border border-emerald-900/40 hover:border-emerald-500/50 transition">
              <div class="text-emerald-400 font-bold mb-1">Step 4: Facebook Publishing</div>
              <div class="text-slate-400 text-[11px]">Direct photo upload & clean caption without links.</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-950/70 border border-blue-900/40 hover:border-blue-500/50 transition col-span-1 sm:col-span-2 flex items-center justify-between">
              <div>
                <div class="text-blue-400 font-bold mb-0.5">Step 5: First-Comment Engagement</div>
                <div class="text-slate-400 text-[11px]">Instant post comment containing clean verified article URL.</div>
              </div>
              <span class="text-lg">💬</span>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- 2. QUEUE & LOGS TAB -->
    <div id="tab-queue" class="tab-content hidden space-y-8">
      
      <!-- Queue Section -->
      <div>
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              Active Queue Execution Pipeline
            </h2>
            <p class="text-xs text-slate-400">Scheduled articles waiting for Facebook dispatch</p>
          </div>
          <button onclick="loadQueue()" class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 transition flex items-center gap-1.5 shadow-sm active:scale-95">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
        </div>

        <div class="glass-panel rounded-2xl overflow-hidden shadow-2xl">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-300">
              <thead class="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th class="px-5 py-3.5">Status</th>
                  <th class="px-5 py-3.5">News Headline</th>
                  <th class="px-5 py-3.5">Target Page</th>
                  <th class="px-5 py-3.5">Attempts</th>
                  <th class="px-5 py-3.5">Schedule Time</th>
                  <th class="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody id="queue-table-body" class="divide-y divide-slate-800/60 font-sans">
                <tr><td colspan="6" class="px-5 py-8 text-center text-slate-500 font-mono text-xs">Loading queue pipeline...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Execution Logs Section -->
      <div>
        <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Recent Execution Logs & Facebook Telemetry
            </h3>
            <p class="text-xs text-slate-400">Click on any FB Post ID to inspect directly on Facebook</p>
          </div>
          <button onclick="resetUnpostedArticles()" id="btn-reset-unposted" class="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-amber-600/20 text-slate-300 hover:text-amber-400 border border-slate-700/80 hover:border-amber-500/50 transition active:scale-95 flex items-center gap-1.5 self-start sm:self-auto" title="Fix and re-queue any articles whose publication had empty post IDs">
            <span>🔄</span>
            <span>Re-queue Unposted Articles</span>
          </button>
        </div>

        <div class="glass-panel rounded-2xl overflow-hidden shadow-2xl">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-300">
              <thead class="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th class="px-5 py-3.5">Status</th>
                  <th class="px-5 py-3.5">Article Title</th>
                  <th class="px-5 py-3.5">Facebook Post ID</th>
                  <th class="px-5 py-3.5">Execution Duration</th>
                  <th class="px-5 py-3.5">Published At</th>
                </tr>
              </thead>
              <tbody id="logs-table-body" class="divide-y divide-slate-800/60 font-sans">
                <tr><td colspan="5" class="px-5 py-8 text-center text-slate-500 font-mono text-xs">Loading publication history...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

    <!-- 3. RSS SOURCES TAB -->
    <div id="tab-sources" class="tab-content hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Add Source Form -->
        <div class="glass-panel p-6 rounded-2xl h-fit">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center font-bold">📡</div>
            <h3 class="text-base font-bold text-white">Add RSS Feed Source</h3>
          </div>
          
          <form id="add-source-form" onsubmit="handleAddSource(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Source Name</label>
              <input type="text" id="source-name" required placeholder="e.g. BD News 24/7" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">RSS Feed URL</label>
              <input type="url" id="source-url" required placeholder="https://bdnews.site/rss.php" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition font-mono text-xs">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Destination Facebook Page</label>
              <select id="source-page" required class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition">
                <option value="">Select Connected Page</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Design Template</label>
              <select id="source-template" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition">
                <option value="template-canva-bdnews" selected>BD News 24/7 Red (Canva Replica)</option>
                <option value="template-square-breaking">Square Breaking News (1080x1080)</option>
                <option value="template-square-editorial">Square Editorial Modern (1080x1080)</option>
                <option value="template-landscape-standard">Landscape Social Share (1200x630)</option>
              </select>
            </div>
            <button type="submit" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-glow-red transition active:scale-95">Save Source</button>
          </form>
        </div>

        <!-- Sources List -->
        <div class="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-white">Configured Feed Pipelines</h3>
            <span class="text-xs text-slate-500 font-mono">Continuous Auto-Ingest</span>
          </div>
          <div id="sources-list" class="space-y-3.5">
            <div class="text-sm text-slate-500 font-mono">Loading sources...</div>
          </div>
        </div>

      </div>
    </div>

    <!-- 4. FACEBOOK PAGES TAB -->
    <div id="tab-pages" class="tab-content hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Add Page Form -->
        <div class="glass-panel p-6 rounded-2xl h-fit">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">f</div>
            <h3 class="text-base font-bold text-white">Connect Facebook Page</h3>
          </div>
          
          <form id="add-page-form" onsubmit="handleAddPage(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Page ID</label>
              <input type="text" id="page-id" required placeholder="e.g. 1405135646008133" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono transition">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Page Name / Label</label>
              <input type="text" id="page-name" required placeholder="e.g. BD News 24/7" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Page Access Token</label>
              <textarea id="page-token" rows="3" required placeholder="EAA..." class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"></textarea>
            </div>
            <div class="flex gap-2.5">
              <button type="button" onclick="testPageToken()" class="w-1/2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700 transition active:scale-95">Test Token</button>
              <button type="submit" class="w-1/2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-xs font-bold text-white shadow-glow-red transition active:scale-95">Save Page</button>
            </div>
            <div id="token-test-result" class="text-xs p-3.5 rounded-xl bg-slate-950 border border-slate-800 hidden font-mono"></div>
          </form>
        </div>

        <!-- Pages List & Meta Live Mode Guidance -->
        <div class="lg:col-span-2 glass-panel rounded-2xl p-6 space-y-5">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              Connected Facebook Target Pages
            </h3>
            <a href="/privacy" target="_blank" class="text-xs text-rose-400 hover:text-rose-300 font-mono underline">View Privacy Policy ↗</a>
          </div>
          
          <!-- Live Visibility Tips Banner -->
          <div class="p-4 bg-slate-950/90 border border-slate-800/90 rounded-xl text-xs space-y-2 text-slate-300 shadow-inner">
            <div class="font-bold text-amber-400 flex items-center gap-2">
              <span class="text-base">💡</span> Meta Graph API Operational Tips:
            </div>
            <ul class="list-disc list-inside space-y-1 text-slate-400 pl-1 leading-relaxed">
              <li><strong class="text-slate-200">Live Mode Active:</strong> Your Meta App is now switched to <strong>Live mode</strong>. Published posts are instantly visible to the public!</li>
              <li><strong class="text-slate-200">Page Identity:</strong> Tokens are verified to publish natively as <strong>BD News 24/7</strong> on the public Page timeline.</li>
            </ul>
          </div>

          <div id="pages-list" class="space-y-3.5">
            <div class="text-sm text-slate-500 font-mono">Loading connected pages...</div>
          </div>
        </div>

      </div>
    </div>

    <!-- 4.5. FACEBOOK GROUPS AUTO-SHARE TAB -->
    <div id="tab-groups" class="tab-content hidden space-y-8">
      
      <!-- Header Banner & Action Button -->
      <div class="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-emerald-500/20 shadow-glow-emerald">
        <div class="space-y-2">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Smart Audience Targeting
          </div>
          <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Facebook Groups Auto-Sharing</span>
            <span class="text-sm font-normal text-emerald-400 font-bengali bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-800/40">গ্রুপ অটো-শেয়ার</span>
          </h2>
          <p class="text-sm text-slate-400 max-w-2xl leading-relaxed">
            স্বয়ংক্রিয়ভাবে আপনার পেজে প্রকাশিত সংবাদ পোস্ট ক্যাটাগরি ও কিওয়ার্ড মিলিয়ে প্রাসঙ্গিক ফেসবুক গ্রুপে শেয়ার করুন। প্রতি গ্রুপে অ্যান্টি-স্প্যাম নিরাপদ ডিলে নিশ্চিত করা হয়।
          </p>
        </div>

        <!-- Add Group Button -->
        <button onclick="openAddGroupModal()" class="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm flex items-center gap-2.5 shadow-lg shadow-emerald-950/60 transition-all duration-300 transform hover:scale-105 active:scale-95 border border-emerald-400/30 whitespace-nowrap">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span>Add Facebook Group (গ্রুপ যুক্ত করুন)</span>
        </button>
      </div>

      <!-- Quick Stats Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="glass-panel p-5 rounded-xl border border-slate-800">
          <div class="text-xs font-mono uppercase text-slate-400">Total Configured</div>
          <div id="stat-groups-total" class="text-2xl font-black text-white mt-1">0</div>
          <div class="text-[11px] text-slate-500 mt-1">Registered targets</div>
        </div>
        <div class="glass-panel p-5 rounded-xl border border-slate-800">
          <div class="text-xs font-mono uppercase text-emerald-400">Auto-Share Active</div>
          <div id="stat-groups-active" class="text-2xl font-black text-emerald-400 mt-1">0</div>
          <div class="text-[11px] text-slate-500 mt-1">Broadcasting live</div>
        </div>
        <div class="glass-panel p-5 rounded-xl border border-slate-800">
          <div class="text-xs font-mono uppercase text-cyan-400">Total Executed Shares</div>
          <div id="stat-groups-shares" class="text-2xl font-black text-cyan-400 mt-1">0</div>
          <div class="text-[11px] text-slate-500 mt-1">Posts shared to groups</div>
        </div>
        <div class="glass-panel p-5 rounded-xl border border-slate-800">
          <div class="text-xs font-mono uppercase text-amber-400">Anti-Spam Safeguard</div>
          <div class="text-2xl font-black text-amber-400 mt-1">5s Safe Jitter</div>
          <div class="text-[11px] text-slate-500 mt-1">Meta rate-limit protected</div>
        </div>
      </div>

      <!-- Configured Groups List / Grid -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-200 flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Active Facebook Group Targets
          </h3>
          <span class="text-xs font-mono text-slate-400">Auto-matches Category & Keywords</span>
        </div>

        <div id="groups-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div class="text-sm text-slate-500 font-mono col-span-full py-8 text-center glass-panel rounded-2xl">
            Loading configured Facebook groups...
          </div>
        </div>
      </div>

      <!-- Recent Group Share Logs Table -->
      <div class="glass-panel rounded-2xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span class="text-base">📋</span>
            <span>Recent Group Share Logs (সর্বশেষ গ্রুপ শেয়ার হিস্ট্রি)</span>
          </h3>
          <button onclick="loadGroupShares()" class="text-xs text-slate-400 hover:text-slate-200 font-mono flex items-center gap-1.5 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400">
                <th class="pb-3 font-semibold">Article Headline</th>
                <th class="pb-3 font-semibold">Target Group</th>
                <th class="pb-3 font-semibold">FB Post ID</th>
                <th class="pb-3 font-semibold">Duration</th>
                <th class="pb-3 font-semibold">Time</th>
                <th class="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody id="group-shares-table-body" class="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td colspan="6" class="py-6 text-center text-slate-500">Loading group share logs...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- 5. TEMPLATE PREVIEW TAB -->
    <div id="tab-preview" class="tab-content hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- Controls -->
        <div class="lg:col-span-5 glass-panel p-6 rounded-2xl space-y-4 h-fit">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center font-bold">🎨</div>
            <h3 class="text-base font-bold text-white">Live Canva & Bangla Preview</h3>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Template Style</label>
            <select id="preview-template" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition">
              <option value="template-canva-bdnews" selected>BD News 24/7 Red (Canva Replica)</option>
              <option value="template-square-breaking">Square Breaking News (1080x1080)</option>
              <option value="template-square-editorial">Square Editorial Modern (1080x1080)</option>
              <option value="template-landscape-standard">Landscape Social Share (1200x630)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Category Badge</label>
            <input type="text" id="preview-category" value="বিশেষ খবর" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 bn focus:outline-none focus:border-red-500 transition">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Headline (Bangla Auto-Fit Test)</label>
            <textarea id="preview-headline" rows="4" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 bn leading-relaxed focus:outline-none focus:border-red-500 transition">২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি</textarea>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">News Image URL (Optional)</label>
            <input type="url" id="preview-image" placeholder="https://... (Leave empty to test placeholder)" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-red-500 transition">
          </div>
          <button onclick="renderPreview()" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-glow-red transition active:scale-95">
            <span id="preview-spinner" class="hidden animate-spin">⚪</span>
            Render Live Preview
          </button>
        </div>

        <!-- 3D Preview Stage -->
        <div class="lg:col-span-7 glass-panel p-6 rounded-2xl flex flex-col items-center justify-center min-h-[540px]">
          <div class="relative group">
            <div class="absolute -inset-2 bg-gradient-to-r from-red-600/30 via-rose-600/20 to-amber-600/30 rounded-2xl blur-xl opacity-60 group-hover:opacity-90 transition duration-500"></div>
            
            <div id="preview-container" class="relative w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] aspect-square bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-center overflow-hidden shadow-2xl">
              <div id="preview-placeholder" class="text-slate-500 text-sm text-center px-6 leading-relaxed">
                <span class="text-3xl block mb-2">🖼️</span>
                Click <strong>"Render Live Preview"</strong> to view the Canva replica template with Bengali auto-fit
              </div>
              <iframe id="preview-frame" class="w-[1080px] h-[1080px] origin-top-left border-0 hidden" style="transform: scale(0.444);" sandbox="allow-scripts allow-same-origin"></iframe>
              <img id="preview-img" class="w-full h-full object-contain hidden" alt="Preview Result" />
            </div>
          </div>
          
          <div id="preview-meta" class="mt-4 text-xs font-mono text-slate-400">Ready for rendering</div>
        </div>

      </div>
    </div>

    <!-- 6. REELS TAB (1080x1080 MP4 News Reels Studio) -->
    <div id="tab-reels" class="tab-content hidden space-y-8">
      
      <!-- Top Banner & Quick Controls -->
      <div class="glass-panel p-6 sm:p-8 rounded-3xl border border-rose-500/20 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div class="space-y-1 relative z-10">
          <div class="flex items-center gap-2.5 flex-wrap">
            <span class="px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wider rounded-md bg-rose-950/80 text-rose-400 border border-rose-800/60 uppercase">15 SECONDS • 20 FPS • AAC BROADCAST AUDIO</span>
            <span class="px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wider rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 uppercase">🎬 REELS-ONLY ACTIVE (POSTER DISABLED)</span>
            <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          </div>
          <h2 class="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>🎬 BD News 24/7 Reels & Stories Studio</span>
            <span class="text-xs font-normal text-slate-400 font-mono hidden sm:inline">(রিলস ফিডে • পোস্টার স্টোরিজে)</span>
          </h2>
          <p class="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            ১৫ সেকেন্ডের ফুল মোশন ভিডিও রিল প্রকাশিত হবে সরাসরি <strong>পেজ ফিড ও রিলসে</strong>, আর প্রিমিয়াম জেপিজি নিউজ কার্ডটি পোস্ট হবে <strong>২৪ ঘণ্টার পেজ স্টোরিজে (ফিডে নয়)</strong>।
          </p>
        </div>

        <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-shrink-0">
          <!-- Poster to Stories Only Toggle Card -->
          <div class="w-full sm:w-auto bg-slate-950/80 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between sm:justify-start gap-4 shadow-xl">
            <div class="text-left">
              <div class="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Poster to Stories (Not Feed)</span>
                <span id="stories-poster-badge" class="px-1.5 py-0.2 text-[9px] font-mono rounded bg-purple-950 text-purple-400 border border-purple-800">ACTIVE</span>
              </div>
              <div class="text-[11px] text-slate-400">পোস্টার স্টোরিজে যাবে, ফিডে নয়</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="toggle-post-stories" checked onchange="handlePostStoriesToggle(this.checked)" class="sr-only peer">
              <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <!-- Auto-Post Reels Toggle Card -->
          <div class="w-full sm:w-auto bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between sm:justify-start gap-4 shadow-xl">
            <div class="text-left">
              <div class="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Auto-Publish Reels</span>
                <span id="reels-auto-badge" class="px-1.5 py-0.2 text-[9px] font-mono rounded bg-rose-950 text-rose-400 border border-rose-800">ACTIVE</span>
              </div>
              <div class="text-[11px] text-slate-400">প্রতিটি নিউজের সাথে রিল পোস্ট</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="toggle-auto-reels" checked onchange="handleAutoReelsToggle(this.checked)" class="sr-only peer">
              <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="glass-panel p-5 rounded-xl border border-slate-800">
          <div class="text-xs font-mono uppercase text-rose-400">Total Published Reels</div>
          <div id="stat-reels-count" class="text-2xl font-black text-white mt-1">0</div>
          <div class="text-[11px] text-slate-500 mt-1">Facebook Reels posted</div>
        </div>
        <div class="glass-panel p-5 rounded-xl border border-slate-800">
          <div class="text-xs font-mono uppercase text-cyan-400">Reel Duration</div>
          <div class="text-2xl font-black text-cyan-400 mt-1">18 Seconds</div>
          <div class="text-[11px] text-slate-500 mt-1">432 frames @ 24 FPS (15-20s)</div>
        </div>
        <div class="glass-panel p-5 rounded-xl border border-slate-800">
          <div class="text-xs font-mono uppercase text-amber-400">Audio Soundtrack</div>
          <div class="text-2xl font-black text-amber-400 mt-1">Studio AAC</div>
          <div class="text-[11px] text-slate-500 mt-1">13 Category Soundscapes (18s)</div>
        </div>
        <div class="glass-panel p-5 rounded-xl border border-slate-800">
          <div class="text-xs font-mono uppercase text-purple-400">Distribution Mode</div>
          <div class="text-lg font-black text-purple-400 mt-1">Reels ➜ Feed</div>
          <div class="text-[11px] text-slate-400 mt-1">JPG Poster ➜ Stories (Not Feed)</div>
        </div>
      </div>

      <!-- 3D Interactive Reel Studio Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <!-- Controls & Input Form -->
        <div class="lg:col-span-6 glass-panel p-6 sm:p-7 rounded-2xl space-y-5 border border-slate-800/80">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center font-bold">🎬</div>
              <h3 class="text-base font-bold text-white">Reel Generator & Publisher</h3>
            </div>
            <span class="text-xs font-mono text-slate-500">Live Meta Graph API</span>
          </div>

          <!-- Select Article from Database -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">Select From Recent Articles</label>
            <select id="reel-article-select" onchange="onReelArticleSelected()" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 transition">
              <option value="">-- Choose an article or type custom below --</option>
            </select>
          </div>

          <!-- Reel Visual Design Theme Selector -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono flex items-center justify-between">
              <span>Reel Visual Design (রিল ডিজাইন টেমপ্লেট)</span>
              <span id="reel-theme-badge" class="px-2 py-0.5 text-[10px] font-mono rounded bg-rose-950 text-rose-400 border border-rose-800">1:1 Square</span>
            </label>
            <select id="reel-theme-select" onchange="onReelThemeChanged()" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 transition font-semibold">
              <option value="auto-category" selected>⚡ Auto-Category (ক্যাটাগরি অনুযায়ী অটোমেটিক থিম ও সাউন্ড)</option>
              <option value="rolling">🔄 Rolling Rotation (সবগুলো ঘুরিয়ে ঘুরিয়ে)</option>
              <optgroup label="13 News Categories (ক্যাটাগরি ভিত্তিক টেমপ্লেট)">
                <option value="cat-bangladesh">🇧🇩 বাংলাদেশ (জাতীয় সংবাদ - গাঢ় সবুজ ও লাল)</option>
                <option value="cat-politics">🏛️ রাজনীতি (পলিটিক্স - রয়্যাল বার্গান্ডি ও গোল্ড)</option>
                <option value="cat-economy">📈 অর্থনীতি (ব্যবসা ও বাণিজ্য - মিডনাইট ব্লু ও টিল)</option>
                <option value="cat-international">🌐 আন্তর্জাতিক (বিশ্ব সংবাদ - সানসেট ভায়োলেট মেশ)</option>
                <option value="cat-sports">⚽ খেলাধুলা (স্পোর্টস - স্যাফায়ার ও অরেঞ্জ)</option>
                <option value="cat-technology">💻 তথ্যপ্রযুক্তি (টেকনোলজি - সাইবার সায়ান)</option>
                <option value="cat-entertainment">🎬 বিনোদন (শোবিজ - গ্ল্যামার ম্যাজেন্টা)</option>
                <option value="cat-opinion">✍️ মতামত (সম্পাদকীয় ও কলাম - স্লিক চারকোল)</option>
                <option value="cat-religion">🕌 ধর্ম (ইসলাম ও ধর্মীয় সংবাদ - গোল্ডেন এমারেল্ড)</option>
                <option value="cat-education">🎓 শিক্ষা (ক্যাম্পাস ও পড়াশোনা - স্কাই ব্লু)</option>
                <option value="cat-job">💼 চাকরি (নিয়োগ ও ক্যারিয়ার - সাকসেস টিল)</option>
                <option value="cat-lifestyle">🌿 জীবনযাপন (স্বাস্থ্য ও লাইফস্টাইল - কোরাল)</option>
                <option value="cat-todays-match">🔥 আজকের খেলা / বিশেষ সংবাদ (হাই এলার্ট)</option>
              </optgroup>
              <optgroup label="Studio Classic Themes (অন্যান্য টেমপ্লেট)">
                <option value="viral-gradient">🔥 Viral Social Mesh (ভাইরাল সোশ্যাল গ্র্যাডিয়েন্ট - 1080x1080)</option>
                <option value="studio-red">🔴 BD News 24/7 Red (Canva Replica Studio - 1080x1080)</option>
                <option value="breaking-bold">⚡ Breaking News TV Flash (ব্রেকিং নিউজ টিভি এলার্ট - 1080x1080)</option>
                <option value="dark-cinema">🌐 Cinematic Dark Cyber (বিবিসি / রয়টার্স স্টাইল - 1080x1080)</option>
                <option value="vertical-916">📱 Vertical Fullscreen Reel (9:16 মোবাইল ফুলস্ক্রিন - 1080x1920)</option>
              </optgroup>
            </select>
            <p id="reel-theme-desc" class="text-[11px] text-slate-400 mt-1">Smart AI Matching: Automatically detects bdnews.site category and applies tailored visual theme and audio profile</p>
          </div>

          <!-- Category Badge -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">Category Badge (ক্যাটেগরি)</label>
            <input type="text" id="reel-category-input" value="বিশেষ খবর" oninput="updateReelFramePreview()" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 bn focus:outline-none focus:border-rose-500 transition">
          </div>

          <!-- Bengali Headline -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">Bengali Headline (বাংলা শিরোনাম) <span class="text-rose-400">*</span></label>
            <textarea id="reel-headline-input" rows="3" oninput="updateReelFramePreviewDebounced()" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 bn leading-relaxed focus:outline-none focus:border-rose-500 transition" placeholder="বাংলা খবর লিখুন...">২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি</textarea>
          </div>

          <!-- Image URL -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">Article Image URL (Optional)</label>
            <input type="url" id="reel-image-input" onchange="updateReelFramePreview()" placeholder="https://... (Leave empty to use studio placeholder)" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-rose-500 transition">
          </div>

          <!-- News Article URL for First Comment -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono flex items-center justify-between">
              <span>News Article Link (প্রথম কমেন্টে খবরের লিংক)</span>
              <span class="text-[10px] font-mono text-emerald-400">First Comment URL</span>
            </label>
            <input type="url" id="reel-link-input" placeholder="https://bdnews.site/... (সংবাদের লিংক লিখুন)" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-700 focus:outline-none focus:border-rose-500 transition">
            <input type="hidden" id="reel-article-id-input" value="">
          </div>

          <!-- Target Facebook Page -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">Target Facebook Page</label>
            <select id="reel-page-select" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 transition">
              <option value="all">Active Default Page (BD News 24/7)</option>
            </select>
          </div>

          <!-- Reel Video Duration -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono flex items-center justify-between">
              <span>Reel Duration (ভিডিও দৈর্ঘ্য)</span>
              <span class="text-[10px] font-mono text-cyan-400">15-20s Sweet Spot</span>
            </label>
            <select id="reel-duration-select" onchange="onReelDurationChanged()" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition font-semibold">
              <option value="18" selected>⏱️ 18 Seconds (Recommended: 15-20s Broadcast)</option>
              <option value="15">⏱️ 15 Seconds (Standard Reel)</option>
              <option value="20">⏱️ 20 Seconds (Extended Reel)</option>
              <option value="16">⏱️ 16 Seconds</option>
            </select>
          </div>

          <!-- Viral Reels Hashtags (Algorithm Optimized) -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono flex items-center justify-between">
              <span>Viral Reels Hashtags (ভাইরাল হ্যাশট্যাগ)</span>
              <span class="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                <span>🔥 10-14 Meta Viral Tags</span>
                <button type="button" onclick="refreshViralHashtags()" class="text-rose-400 hover:text-rose-300 underline font-sans ml-1 text-xs">অটো রিফ্রেশ</button>
              </span>
            </label>
            <textarea id="reel-hashtags-input" rows="2" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-amber-300/90 leading-relaxed focus:outline-none focus:border-rose-500 transition" placeholder="#reels #fbreels #viralreels ...">#MedicalAdmission #MBBS #MedicalExam #Education #Campus #Admission #BreakingNews #BanglaNews #Bangladesh #reels #fbreels #viralreels</textarea>
            <p class="text-[10px] text-slate-500 mt-1">মেটা অ্যালগরিদম ও ট্রেন্ডিং টপিক অনুযায়ী স্বয়ংক্রিয়ভাবে সর্বোত্তম ১০-১৪টি ভাইরাল হ্যাশট্যাগ তৈরি হয়েছে।</p>
          </div>

          <!-- Actions -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
            <button onclick="renderReelPreview()" id="btn-preview-reel" class="py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 hover:border-rose-500/50 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md">
              <svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Preview Reel</span>
            </button>
            <button onclick="publishReelNow()" id="btn-publish-reel" class="py-3 px-3 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-glow-red transition active:scale-95">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
              <span>Publish Reel (Feed)</span>
            </button>
            <button onclick="publishStoryNow()" id="btn-publish-story" class="py-3 px-3 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/80 text-purple-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-lg">
              <span>📸 Post to Stories</span>
            </button>
          </div>

          <div id="reel-action-status" class="text-xs font-mono text-slate-400 text-center hidden"></div>
        </div>

        <!-- 3D Video Player Showcase -->
        <div class="lg:col-span-6 glass-panel p-6 sm:p-7 rounded-2xl flex flex-col items-center justify-center border border-slate-800/80">
          <div class="flex items-center justify-between w-full mb-4">
            <span class="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-rose-500"></span>
              Studio Video Player (1080x1080)
            </span>
            <span id="reel-duration-badge" class="text-[11px] font-mono text-slate-500">18s • 24fps • AAC</span>
          </div>

          <div id="reel-player-box" class="relative w-full max-w-[420px] aspect-square bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden group transition-all duration-300">
            
            <!-- Video Element -->
            <video id="reel-video-player" controls playsinline loop class="w-full h-full object-contain bg-black hidden"></video>

            <!-- Instant Static Frame Preview -->
            <img id="reel-frame-img" class="w-full h-full object-contain bg-black hidden cursor-pointer" onclick="renderReelPreview()" title="Click to render animated motion reel" alt="Reel Snapshot Preview" />

            <!-- Placeholder -->
            <div id="reel-player-placeholder" class="text-center p-6 space-y-3">
              <div class="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-3xl shadow-glow-red">
                🎬
              </div>
              <p class="text-sm font-semibold text-slate-200">No Reel Generated Yet</p>
              <p class="text-xs text-slate-500 max-w-xs">Click <strong>"Generate & Preview"</strong> to render an 18-second broadcast MP4 reel with Bengali typography and category sound.</p>
            </div>

            <!-- Spinner Overlay -->
            <div id="reel-player-spinner" class="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 hidden z-20">
              <div class="w-10 h-10 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
              <p class="text-xs font-mono text-slate-300" id="reel-spinner-text">Rendering 432 frames with Canvas & FFmpeg (18s)...</p>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between w-full max-w-[420px] text-xs font-mono text-slate-400">
            <span>Broadcast News Theme AAC</span>
            <a id="reel-download-link" href="#" target="_blank" class="text-rose-400 hover:text-rose-300 underline hidden">Direct MP4 Download</a>
          </div>
        </div>

      </div>

      <!-- Recent Reels History Table -->
      <div class="glass-panel rounded-2xl p-6 space-y-4 border border-slate-800/80">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span class="text-base">📋</span>
            <span>Recent Facebook Reels History (সর্বশেষ প্রকাশিত রিলস)</span>
          </h3>
          <button onclick="loadReelLogs()" class="text-xs text-slate-400 hover:text-slate-200 font-mono flex items-center gap-1.5 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh Logs
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400">
                <th class="pb-3 font-semibold">Article Headline</th>
                <th class="pb-3 font-semibold">Target Page</th>
                <th class="pb-3 font-semibold">Template</th>
                <th class="pb-3 font-semibold">FB Reel / Video ID</th>
                <th class="pb-3 font-semibold">Render Time</th>
                <th class="pb-3 font-semibold">Published At</th>
                <th class="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody id="reels-table-body" class="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td colspan="7" class="py-6 text-center text-slate-500">Loading reels history...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>


    <!-- 6.5. YOUTUBE SHORTS TAB -->
    <div id="tab-youtube" class="tab-content hidden space-y-8">
      
      <!-- Header Banner -->
      <div class="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden">
        <div class="absolute -right-12 -top-12 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-red-600/20 text-red-400 border border-red-600/40 uppercase tracking-wider">Multi-Platform Distribution</span>
              <span id="yt-connection-badge" class="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700">Checking...</span>
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <svg class="w-7 h-7 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              YouTube Shorts Automation Pipeline
            </h2>
            <p class="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              প্রতিটি সংবাদের ১৫-২০ সেকেন্ডের MP4 রিল ভিডিও স্বয়ংক্রিয়ভাবে আপনার ইউটিউব চ্যানেলে Shorts হিসেবে আপলোড হবে। সংবাদ লিংক স্বয়ংক্রিয়ভাবে ভিডিওর ডেসক্রিপশন এবং ১ম কমেন্টে যুক্ত হবে।
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button onclick="triggerYouTubeUploadNow()" id="yt-upload-btn" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs sm:text-sm shadow-glow-red flex items-center gap-2 transition active:scale-95 border border-red-400/40">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              <span>Upload Latest Short Now</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Channel Profile & Google OAuth Setup Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Left: Channel Profile Card -->
        <div class="glass-panel p-6 rounded-2xl relative flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Connected YouTube Channel</h3>
              <span id="yt-active-pill" class="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
            </div>

            <div id="yt-channel-info" class="space-y-4">
              <div class="flex items-center gap-3.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <img id="yt-avatar" src="/assets/images/favicon.png" alt="Avatar" class="w-12 h-12 rounded-full border border-red-500/50 object-cover" />
                <div class="overflow-hidden">
                  <div id="yt-channel-title" class="font-bold text-white text-sm truncate">Channel Not Connected</div>
                  <div id="yt-channel-handle" class="text-xs text-slate-400 truncate font-mono">@bdnews24</div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 text-center">
                <div class="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <div id="yt-sub-count" class="text-lg font-bold text-white font-mono">-</div>
                  <div class="text-[11px] text-slate-400">Subscribers</div>
                </div>
                <div class="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <div id="yt-video-count" class="text-lg font-bold text-white font-mono">-</div>
                  <div class="text-[11px] text-slate-400">Total Videos</div>
                </div>
              </div>

              <div class="text-[11px] text-slate-400 bg-red-950/20 p-3 rounded-xl border border-red-900/30 space-y-1">
                <div class="font-semibold text-red-300 flex items-center gap-1.5">
                  <span>✓</span> 15-20s MP4 Ready (Vertical 9:16)
                </div>
                <div class="font-semibold text-red-300 flex items-center gap-1.5">
                  <span>✓</span> Category: News & Politics (#Shorts)
                </div>
                <div class="font-semibold text-red-300 flex items-center gap-1.5">
                  <span>✓</span> First Comment News Link
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span class="text-slate-400">Auto-Upload on Publish:</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="yt-auto-toggle" class="sr-only peer" checked onchange="saveYouTubeSettings()" />
              <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
        </div>

        <!-- Right: OAuth Credentials Setup -->
        <div class="lg:col-span-2 glass-panel p-6 rounded-2xl relative space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <span>🔑</span> Google OAuth 2.0 Credentials (YouTube Data API v3)
            </h3>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">Token Refresh Active</span>
          </div>

          <div class="space-y-3.5 text-xs">
            <div>
              <label class="block font-semibold text-slate-300 mb-1">Google OAuth Client ID</label>
              <input type="text" id="yt-client-id" class="w-full bg-slate-950/80 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none transition" value="" placeholder="xxxxx.apps.googleusercontent.com" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-300 mb-1">Client Secret (Google Cloud)</label>
                <input type="password" id="yt-client-secret" class="w-full bg-slate-950/80 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none transition" value="" placeholder="Enter Client Secret" />
              </div>

              <div>
                <label class="block font-semibold text-slate-300 mb-1">OAuth Refresh Token</label>
                <input type="password" id="yt-refresh-token" class="w-full bg-slate-950/80 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none transition" placeholder="1//0gxxxxxxxxxxxxxxxxxxxx" />
              </div>
            </div>

            <!-- Helpful OAuth Instructions Accordion -->
            <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-300 space-y-2">
              <div class="font-bold text-amber-300 flex items-center gap-1.5">
                <span>⚡</span> Refresh Token পাওয়ার সহজ পদ্ধতি (২ মিনিট):
              </div>
              <ol class="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed pl-1">
                <li>গুগল ক্লাউড কনসোলে আপনার OAuth Client এ <code class="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">https://developers.google.com/oauthplayground</code> রিডাইরেক্ট URI হিসেবে যুক্ত করুন।</li>
                <li><a href="https://developers.google.com/oauthplayground" target="_blank" class="text-red-400 underline font-semibold">Google OAuth Playground ↗</a> ওপেন করে ডানপাশের সেটিংস গিয়ারে আপনার Client ID ও Secret বসান।</li>
                <li>বামের লিস্ট থেকে <code class="text-emerald-300">YouTube Data API v3</code> $\rightarrow$ <code class="text-emerald-300">https://www.googleapis.com/auth/youtube.upload</code> সিলেক্ট করে সাইন ইন করুন।</li>
                <li>"Exchange authorization code for tokens" বাটনে ক্লিক করে পাওয়া <code class="text-amber-300">Refresh token</code> কপি করে এখানে বসান।</li>
              </ol>
            </div>

            <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-300">
              <span class="truncate"><span class="text-slate-400">OAuth Redirect URI:</span> <span class="text-cyan-400" id="yt-redirect-uri-display">https://.../api/youtube/auth/callback</span></span>
              <button onclick="copyRedirectUri()" class="ml-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 text-[10px] font-sans flex items-center gap-1 active:scale-95 transition">📋 Copy</button>
            </div>

            <div class="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button onclick="startGoogleOAuth()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-glow-red transition active:scale-95 border border-red-400/40">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                <span>1-Click Google Sign-In</span>
              </button>

              <button onclick="saveYouTubeSettings()" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 hover:border-red-500/50 transition shadow-sm active:scale-95">
                Save & Authenticate
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- YouTube Shorts Upload History Table -->
      <div class="glass-panel rounded-2xl p-6 overflow-hidden">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <span>📊</span> Recent YouTube Shorts Upload History
            </h3>
            <p class="text-xs text-slate-400">Log of automated and manual uploads to your YouTube channel</p>
          </div>
          <button onclick="loadYouTubeLogs()" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider">
                <th class="pb-3 pr-4">Article Title</th>
                <th class="pb-3 pr-4">YouTube Video ID</th>
                <th class="pb-3 pr-4">Duration</th>
                <th class="pb-3 pr-4">Time</th>
                <th class="pb-3">Status</th>
              </tr>
            </thead>
            <tbody id="yt-table-body" class="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td colspan="5" class="py-6 text-center text-slate-500">Loading YouTube logs...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- 7. SETTINGS TAB -->
    <div id="tab-settings" class="tab-content hidden space-y-6">
      <div class="glass-panel p-6 sm:p-8 rounded-2xl max-w-3xl">
        <div class="flex items-center gap-2.5 mb-6">
          <div class="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold">⚙️</div>
          <div>
            <h3 class="text-base font-bold text-white">Automation Pipeline Control Engine</h3>
            <p class="text-xs text-slate-400">Fine-tune ingestion schedules, rate limits, and caption formatting</p>
          </div>
        </div>

        <form id="settings-form" onsubmit="handleSaveSettings(event)" class="space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">RSS Poll Cron Expression</label>
              <input type="text" id="setting-cron" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-red-500 transition">
              <span class="text-[11px] text-slate-500 mt-1 block">Standard cron syntax: */10 * * * * (Every 10 min)</span>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Max Article Age (Hours)</label>
              <input type="number" id="setting-age" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition">
              <span class="text-[11px] text-slate-500 mt-1 block">Ignore articles older than X hours</span>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Hourly Posting Rate Cap</label>
              <input type="number" id="setting-cap" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition">
              <span class="text-[11px] text-slate-500 mt-1 block">Maximum posts allowed per hour</span>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Anti-Spam Delay Range (Seconds)</label>
              <div class="flex items-center gap-2">
                <input type="number" id="setting-min-delay" placeholder="Min (30)" class="w-1/2 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition">
                <input type="number" id="setting-max-delay" placeholder="Max (60)" class="w-1/2 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition">
              </div>
              <span class="text-[11px] text-slate-500 mt-1 block">Natural delay between consecutive posts</span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Default Hashtags</label>
            <input type="text" id="setting-hashtags" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-red-500 transition">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Facebook Photo Caption Template</label>
            <textarea id="setting-caption-format" rows="3" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-red-500 transition"></textarea>
            <span class="text-[11px] text-slate-500 mt-1 block">Variables: {headline}, {summary}, {hashtags} (External links penalty avoided)</span>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">First Comment Format (News Link Target)</label>
            <input type="text" id="setting-comment-format" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-red-500 transition">
            <span class="text-[11px] text-slate-500 mt-1 block">Variables: {url}</span>
          </div>

          <div class="pt-5 border-t border-slate-800/80 flex justify-end">
            <button type="submit" class="py-2.5 px-6 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-glow-red transition active:scale-95">Save Pipeline Configuration</button>
          </div>
        </form>
      </div>
    </div>

  </main>

  <!-- Add Group Modal -->
  <div id="modal-add-group" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md hidden transition-all duration-300">
    <div class="glass-panel w-full max-w-xl p-6 sm:p-8 rounded-3xl border border-emerald-500/30 shadow-2xl relative space-y-6">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">👥</div>
          <div>
            <h3 class="text-lg font-bold text-white">Add Facebook Group</h3>
            <p class="text-xs text-slate-400">ফেসবুক গ্রুপে অটো শেয়ার কনফিগার করুন</p>
          </div>
        </div>
        <button onclick="closeAddGroupModal()" class="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">✕</button>
      </div>

      <form id="form-add-group" onsubmit="handleSaveGroup(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Facebook Group ID or URL <span class="text-rose-400">*</span></label>
          <input id="group-id-input" type="text" placeholder="e.g. 123456789012345 or https://facebook.com/groups/yourgroup" required class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition font-mono">
          <p class="text-[11px] text-slate-500 mt-1">You can paste the full group link or numeric Group ID.</p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Group Display Name <span class="text-rose-400">*</span></label>
          <input id="group-name-input" type="text" placeholder="e.g. বাংলাদেশ ব্রেকিং নিউজ গ্রুপ" required class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition">
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Relevant Categories / Keywords (প্রাসঙ্গিক বিষয়)</label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <button type="button" onclick="toggleCategoryTag(this, 'all')" class="cat-pill active px-2.5 py-1 text-xs rounded-lg border border-emerald-600 bg-emerald-950/60 text-emerald-300 font-semibold transition">সব (All Posts)</button>
            <button type="button" onclick="toggleCategoryTag(this, 'রাজনীতি')" class="cat-pill px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 transition">রাজনীতি</button>
            <button type="button" onclick="toggleCategoryTag(this, 'খেলাধুলা')" class="cat-pill px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 transition">খেলাধুলা</button>
            <button type="button" onclick="toggleCategoryTag(this, 'জাতীয়')" class="cat-pill px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 transition">জাতীয়</button>
            <button type="button" onclick="toggleCategoryTag(this, 'আন্তর্জাতিক')" class="cat-pill px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 transition">আন্তর্জাতিক</button>
            <button type="button" onclick="toggleCategoryTag(this, 'অর্থনীতি')" class="cat-pill px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 transition">অর্থনীতি</button>
            <button type="button" onclick="toggleCategoryTag(this, 'বিনোদন')" class="cat-pill px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 transition">বিনোদন</button>
            <button type="button" onclick="toggleCategoryTag(this, 'শিক্ষা')" class="cat-pill px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 transition">শিক্ষা</button>
            <button type="button" onclick="toggleCategoryTag(this, 'প্রযুক্তি')" class="cat-pill px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 transition">প্রযুক্তি</button>
          </div>
          <input id="group-categories-input" type="text" value="all" placeholder="e.g. all, রাজনীতি, ক্রিকেট (comma separated)" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition">
          <p class="text-[11px] text-slate-500 mt-1">If set to "all", this group will receive every news post. Otherwise, only articles matching these categories or keywords will be shared.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Target Facebook Page</label>
            <select id="group-page-select" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition">
              <option value="all">All Active Pages</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Stagger Delay (Seconds)</label>
            <input id="group-delay-input" type="number" min="1" max="60" value="5" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition">
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Optional Access Token Override</label>
          <input id="group-token-input" type="text" placeholder="Leave empty to automatically use Page Access Token" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition font-mono">
          <p class="text-[11px] text-slate-500 mt-1">By default, it uses the Page's Access Token. Provide a User Token if sharing as an admin user.</p>
        </div>

        <div class="flex items-center justify-between pt-4 border-t border-slate-800">
          <button type="button" onclick="closeAddGroupModal()" class="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition">Cancel</button>
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 transition transform hover:scale-105 active:scale-95">Save & Enable Auto-Share</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 3D Notification Floating Toast -->
  <div id="toast" class="fixed bottom-6 right-6 px-5 py-3.5 rounded-2xl text-sm font-medium shadow-2xl hidden transition-all duration-500 z-50 flex items-center gap-3 backdrop-blur-xl border"></div>

  <!-- Interactive Background Canvas Particles & 3D Script -->
  <script>
    // --- 3D PARTICLE CONSTELLATION CANVAS ---
    (function initBackgroundCanvas() {
      const canvas = document.getElementById('bg-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let w = canvas.width = window.innerWidth;
      let h = canvas.height = window.innerHeight;

      const particles = [];
      const particleCount = Math.min(Math.floor(w / 30), 45);

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 1.5 + 0.5,
          color: Math.random() > 0.6 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(6, 182, 212, 0.3)'
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
            if (dist < 120) {
              ctx.beginPath();
              ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.08 * (1 - dist / 120)) + ')';
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

    // --- 3D TILT EFFECT FOR CARDS ---
    function handleTilt(e, card) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -7;
      const rotateY = ((x - centerX) / centerX) * 7;

      card.style.transform = \`perspective(1000px) rotateX(\${rotateX}deg) rotateY(\${rotateY}deg) translateY(-4px) scale3d(1.02, 1.02, 1.02)\`;
    }

    function resetTilt(card) {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale3d(1, 1, 1)';
    }

    // --- TOAST NOTIFICATIONS ---
    function showToast(msg, isError = false) {
      const toast = document.getElementById('toast');
      const icon = isError ? '⚠️' : '✓';
      toast.innerHTML = \`<span class="text-base">\${icon}</span> <span>\${msg}</span>\`;
      toast.className = 'fixed bottom-6 right-6 px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-2xl transition-all duration-500 z-50 flex items-center gap-3 backdrop-blur-xl ' +
        (isError 
          ? 'bg-red-950/90 border border-red-700/80 text-red-200 shadow-glow-red translate-y-0 opacity-100' 
          : 'bg-emerald-950/90 border border-emerald-700/80 text-emerald-200 shadow-glow-emerald translate-y-0 opacity-100');
      toast.classList.remove('hidden');
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 4000);
    }

    // --- TAB SWITCHING ---
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-red-400', 'bg-red-950/40', 'border-red-800/50', 'shadow-inner');
        btn.classList.add('text-slate-400', 'border-transparent');
      });
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

      if (event && event.currentTarget) {
        event.currentTarget.classList.add('text-red-400', 'bg-red-950/40', 'border-red-800/50', 'shadow-inner');
        event.currentTarget.classList.remove('text-slate-400', 'border-transparent');
      }
      
      const targetTab = document.getElementById('tab-' + tabId);
      if (targetTab) {
        targetTab.classList.remove('hidden');
      }

      if (tabId === 'overview') loadOverview();
      if (tabId === 'queue') loadQueue();
      if (tabId === 'sources') loadSources();
      if (tabId === 'pages') loadPages();
      if (tabId === 'groups') loadGroups();
      if (tabId === 'reels') loadReels();
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
          return { ok: false, status: res.status, error: text || 'Non-JSON server response' };
        }
      } catch (err) {
        return { ok: false, status: 0, error: err.message };
      }
    }

    // --- OVERVIEW STATS COUNTER ---
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
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span>🛡️ DRY RUN ACTIVE</span>';
            badge.className = 'relative px-3.5 py-1.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/40 shadow-sm flex items-center gap-2';
            radar.classList.add('hidden');
          } else {
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>🚀 META LIVE MODE</span>';
            badge.className = 'relative px-3.5 py-1.5 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/50 shadow-glow-emerald flex items-center gap-2';
            radar.classList.remove('hidden');
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
      const duration = 600;
      let startTime = null;
      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        el.innerText = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.innerText = end;
        }
      }
      requestAnimationFrame(step);
    }

    // --- POLL RSS NOW ---
    async function triggerPollNow() {
      try {
        showToast('Polling RSS feeds from sources...');
        const res = await safeFetchJson('/api/poll-now', { method: 'POST' });
        if (res.ok) {
          showToast('✓ RSS polling complete! New articles queued.');
          loadOverview();
        } else {
          showToast('Poll response: ' + (res.data?.error || res.error || 'Server response'), true);
        }
      } catch (e) {
        showToast('Failed to poll RSS: ' + e.message, true);
      }
    }

    // --- PUBLISH NEXT NOW ---
    async function publishNextNow() {
      try {
        showToast('Publishing next article to Facebook...');
        const res = await safeFetchJson('/api/queue/publish-next', { method: 'POST' });
        if (res.ok && res.data.success) {
          const log = res.data.log;
          if (log && log.status === 'success' && log.fbPostId) {
            showToast('✓ Successfully published: ' + (res.data.articleTitle || '').substring(0, 30) + '...');
          } else if (log && log.errorMessage) {
            showToast('Facebook error: ' + log.errorMessage, true);
          } else {
            showToast('Published to Facebook!');
          }
          loadOverview();
          loadQueue();
        } else {
          showToast('Failed to publish: ' + (res.data?.error || res.error || 'Server error'), true);
        }
      } catch (e) {
        showToast('Error publishing: ' + e.message, true);
      }
    }

    // --- RE-QUEUE UNPOSTED ARTICLES ---
    async function resetUnpostedArticles() {
      if (!confirm('This will find any articles that were not posted to Facebook (missing Post IDs) and re-queue them as pending so they can be published live. Proceed?')) return;
      try {
        showToast('Re-queueing unposted articles...');
        const res = await safeFetchJson('/api/queue/reset-unposted', { method: 'POST' });
        if (res.ok && res.data.success) {
          showToast('✓ ' + (res.data.message || 'Articles re-queued successfully!'));
          loadOverview();
          loadQueue();
        } else {
          showToast(res.data?.error || 'Failed to re-queue articles', true);
        }
      } catch (e) {
        showToast('Error re-queueing articles: ' + e.message, true);
      }
    }

    // --- QUEUE & LOGS ---
    async function loadQueue() {
      try {
        const [qRes, lRes] = await Promise.all([
          safeFetchJson('/api/queue'),
          safeFetchJson('/api/logs')
        ]);
        const jobs = (qRes.ok && Array.isArray(qRes.data)) ? qRes.data : [];
        const logs = (lRes.ok && Array.isArray(lRes.data)) ? lRes.data : [];

        const tbody = document.getElementById('queue-table-body');
        if (jobs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-slate-500 font-mono text-xs">Queue is currently idle and ready.</td></tr>';
        } else {
          tbody.innerHTML = jobs.map(j => \`
            <tr class="hover:bg-slate-800/40 transition">
              <td class="px-5 py-3.5">
                <span class="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider \${
                  j.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                  j.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                  j.status === 'processing' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                  'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }">\${j.status}</span>
              </td>
              <td class="px-5 py-3.5 font-medium text-slate-200 max-w-sm truncate bn" title="\${j.article_title || ''}">\${j.article_title || 'Pending Ingestion'}</td>
              <td class="px-5 py-3.5 text-slate-400 font-mono text-xs">\${j.page_name || 'All'}</td>
              <td class="px-5 py-3.5 text-slate-400 font-mono text-xs">\${j.attempts}/\${j.max_attempts}</td>
              <td class="px-5 py-3.5 text-xs text-slate-400 font-mono">\${new Date(j.run_at).toLocaleTimeString()}</td>
              <td class="px-5 py-3.5 text-right">
                <button onclick="retryJob('\${j.id}')" class="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-800/90 hover:bg-red-600/30 text-slate-300 hover:text-red-300 border border-slate-700/80 transition active:scale-95">Run Now</button>
              </td>
            </tr>
          \`).join('');
        }

        const logBody = document.getElementById('logs-table-body');
        if (logs.length === 0) {
          logBody.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-slate-500 font-mono text-xs">No publication logs recorded yet.</td></tr>';
        } else {
          logBody.innerHTML = logs.map(l => {
            const isLiveSuccess = (l.status === 'success' || l.status === 'dry_run') && (l.status === 'dry_run' || !!l.fb_post_id);
            const badgeClass = isLiveSuccess
              ? (l.status === 'dry_run' ? 'text-blue-400 bg-blue-950/60 border border-blue-800/50' : 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/50')
              : 'text-red-400 bg-red-950/60 border border-red-800/50';
            const displayStatus = (!l.fb_post_id && l.status === 'success') ? 'FAILED' : l.status;

            return \`
            <tr class="hover:bg-slate-800/40 text-xs transition">
              <td class="px-5 py-3">
                <span class="px-2 py-0.5 rounded font-mono font-bold uppercase \${badgeClass}">\${displayStatus}</span>
                \${l.error_message ? \`<div class="text-[10px] text-red-400/90 font-mono mt-1 max-w-[220px] truncate cursor-pointer hover:underline" onclick="alert(this.getAttribute('data-full-error'))" data-full-error="\${(l.error_message || '').replace(/"/g, '&quot;')}" title="Click to view full error">\${l.error_message}</div>\` : ''}
              </td>
              <td class="px-5 py-3 text-slate-200 max-w-sm truncate bn font-medium">\${l.article_title || ''}</td>
              <td class="px-5 py-3 font-mono">
                \${l.fb_post_id ? \`
                  <a href="https://www.facebook.com/\${l.fb_photo_id || (l.fb_post_id.includes('_') ? l.fb_post_id.split('_')[1] : l.fb_post_id)}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1.5 font-bold" title="Click to view live post on Facebook">
                    <span>\${l.fb_post_id}</span>
                    <svg class="w-3.5 h-3.5 inline opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  </a>
                \` : '<span class="text-slate-500 font-semibold" title="No live post ID was recorded">-</span>'}
              </td>
              <td class="px-5 py-3 text-slate-400 font-mono">\${l.duration_ms ? l.duration_ms + 'ms' : '-'}</td>
              <td class="px-5 py-3 text-slate-500 font-mono">\${new Date(l.created_at).toLocaleString()}</td>
            </tr>
          \`;
          }).join('');
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function retryJob(id) {
      try {
        const res = await safeFetchJson('/api/queue/' + id + '/retry', { method: 'POST' });
        const d = res.data || {};
        if (d.success) {
          showToast('Job queued for immediate publishing!');
          loadQueue();
        } else {
          showToast(d.error || 'Retry failed', true);
        }
      } catch (e) {
        showToast('Error retrying job', true);
      }
    }

    // --- RSS SOURCES ---
    async function loadSources() {
      const [sRes, pRes] = await Promise.all([
        safeFetchJson('/api/sources'),
        safeFetchJson('/api/pages')
      ]);
      const sources = (sRes.ok && Array.isArray(sRes.data)) ? sRes.data : [];
      const pages = (pRes.ok && Array.isArray(pRes.data)) ? pRes.data : [];

      const pageSelect = document.getElementById('source-page');
      pageSelect.innerHTML = '<option value="">Select Connected Page</option>' +
        pages.map(p => \`<option value="\${p.id}">\${p.name} (\${p.id})</option>\`).join('');

      const list = document.getElementById('sources-list');
      if (sources.length === 0) {
        list.innerHTML = '<div class="text-sm text-slate-500 font-mono">No RSS sources added yet.</div>';
      } else {
        list.innerHTML = sources.map(s => \`
          <div class="flex items-center justify-between p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 hover:border-slate-700 transition">
            <div>
              <div class="font-bold text-slate-100 flex items-center gap-2">
                <span>\${s.name}</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-400 border border-cyan-800/50">Active</span>
              </div>
              <div class="text-xs text-slate-400 font-mono mt-1 truncate max-w-md">\${s.url}</div>
              <div class="text-xs text-slate-500 mt-1 font-mono">Page: \${s.page_name || s.page_id} | Template: \${s.template_id}</div>
            </div>
            <button onclick="deleteSource('\${s.id}')" class="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 rounded-lg border border-rose-800/50 transition">Delete</button>
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

      const res = await safeFetchJson('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = res.data || {};
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
      await safeFetchJson('/api/sources/' + id, { method: 'DELETE' });
      showToast('Source deleted');
      loadSources();
    }

    // --- FACEBOOK PAGES ---
    async function loadPages() {
      const res = await safeFetchJson('/api/pages');
      const pages = (res.ok && Array.isArray(res.data)) ? res.data : [];
      const list = document.getElementById('pages-list');
      if (pages.length === 0) {
        list.innerHTML = '<div class="text-sm text-slate-500 font-mono">No Facebook Pages connected yet.</div>';
      } else {
        list.innerHTML = pages.map(p => \`
          <div class="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 hover:border-slate-700 transition space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-bold text-slate-100 flex items-center gap-2">
                  <span>\${p.name}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">Connected</span>
                </div>
                <div class="text-xs text-slate-400 font-mono mt-1">Page ID: \${p.id}</div>
                <div class="text-xs text-slate-500 mt-0.5 font-mono">Token: \${p.token_expires_at ? 'Expires ' + new Date(p.token_expires_at).toLocaleDateString() : 'Permanent (Long-Lived)'}</div>
              </div>
              <div class="flex gap-2">
                <button onclick="diagnosePageToken('\${p.id}')" class="text-xs text-amber-400 hover:text-amber-300 px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 rounded-lg border border-amber-800/50 transition font-mono">🔍 Diagnose Token</button>
                <button onclick="deletePage('\${p.id}')" class="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 rounded-lg border border-rose-800/50 transition">Delete</button>
              </div>
            </div>
            <div id="diagnose-result-\${p.id}" class="hidden text-xs p-3 rounded-lg font-mono"></div>
          </div>
        \`).join('');
      }
    }

    async function diagnosePageToken(id) {
      const box = document.getElementById('diagnose-result-' + id);
      if (!box) return;
      box.classList.remove('hidden');
      box.className = 'text-xs p-3.5 rounded-lg font-mono bg-slate-900 border border-slate-800 text-slate-300';
      box.innerHTML = 'Analyzing token permissions and Facebook Page capabilities...';

      try {
        const res = await safeFetchJson('/api/pages/' + id + '/diagnose');
        if (!res.ok) {
          box.className = 'text-xs p-3.5 rounded-lg font-mono bg-rose-950/60 border border-rose-800 text-rose-300';
          box.innerHTML = 'Error querying diagnosis: ' + (res.data?.error || res.status);
          return;
        }
        const d = res.data || {};
        const isOk = d.canPost && d.isPageToken;
        box.className = isOk
          ? 'text-xs p-3.5 rounded-lg font-mono bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 space-y-1'
          : 'text-xs p-3.5 rounded-lg font-mono bg-amber-950/60 border border-amber-800/80 text-amber-300 space-y-1';

        box.innerHTML = \`
          <div class="font-bold text-sm mb-1">\${isOk ? '✓ Token Verified for Publishing' : '⚠️ Action Needed'}</div>
          <div><strong>Diagnosis:</strong> \${d.diagnosis}</div>
          <div><strong>Token Type:</strong> \${d.tokenType || 'Unknown'} \${d.isUserToken ? '<span class=\"text-red-400 font-bold\">(MUST BE PAGE TOKEN!)</span>' : ''}</div>
          <div><strong>Token Subject:</strong> \${d.tokenSubject || 'Unknown'}</div>
          <div><strong>Granted Permissions:</strong> \${(d.scopes || []).join(', ') || 'None'}</div>
          \${d.missingScopes && d.missingScopes.length > 0 ? \`<div class=\"text-red-400\"><strong>Missing Permissions:</strong> \${d.missingScopes.join(', ')}</div>\` : ''}
          \${d.tasks && d.tasks.length > 0 ? \`<div><strong>Page Tasks:</strong> \${d.tasks.join(', ')}</div>\` : ''}
        \`;
      } catch (err) {
        box.className = 'text-xs p-3.5 rounded-lg font-mono bg-rose-950/60 border border-rose-800 text-rose-300';
        box.innerHTML = 'Diagnosis failed: ' + err.message;
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

    // --- FACEBOOK GROUPS AUTO-SHARING ---
    let cachedGroups = [];

    async function loadGroups() {
      try {
        const [groupsRes, sharesRes, statsRes] = await Promise.all([
          safeFetchJson('/api/groups'),
          safeFetchJson('/api/groups/shares?limit=25'),
          safeFetchJson('/api/stats')
        ]);

        const groups = (groupsRes.ok && Array.isArray(groupsRes.data)) ? groupsRes.data : [];
        cachedGroups = groups;

        const totalCount = groups.length;
        const activeCount = groups.filter(g => g.autoShare).length;
        const totalShares = groups.reduce((acc, g) => acc + (g.totalShares || 0), 0);

        const elTotal = document.getElementById('stat-groups-total');
        const elActive = document.getElementById('stat-groups-active');
        const elShares = document.getElementById('stat-groups-shares');
        if (elTotal) elTotal.innerText = totalCount;
        if (elActive) elActive.innerText = activeCount;
        if (elShares) elShares.innerText = totalShares;

        const container = document.getElementById('groups-container');
        if (!container) return;

        if (groups.length === 0) {
          container.innerHTML = \`
            <div class="col-span-full py-12 px-6 text-center glass-panel rounded-2xl border border-dashed border-slate-800 space-y-3">
              <div class="w-12 h-12 mx-auto rounded-2xl bg-emerald-950/60 text-emerald-400 flex items-center justify-center text-xl border border-emerald-800/40">👥</div>
              <h4 class="text-base font-bold text-slate-200">No Facebook Groups configured yet</h4>
              <p class="text-xs text-slate-400 max-w-md mx-auto">
                Add target Facebook Groups to automatically broadcast your published news cards to relevant community feeds.
              </p>
              <button onclick="openAddGroupModal()" class="mt-2 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-950/60">
                + Add Your First Group
              </button>
            </div>
          \`;
        } else {
          container.innerHTML = groups.map(g => {
            const categories = Array.isArray(g.categories) ? g.categories : ['all'];
            const catPills = categories.map(c => {
              if (c.toLowerCase() === 'all') {
                return '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">All Posts (সকল)</span>';
              }
              return \`<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-300 border border-slate-700/80">\${c}</span>\`;
            }).join(' ');

            const lastSharedText = g.lastSharedAt ? new Date(g.lastSharedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Never';

            return \`
              <div class="tilt-card glass-panel rounded-2xl p-5 border \${g.autoShare ? 'border-emerald-500/30 shadow-glow-emerald/30' : 'border-slate-800'} relative overflow-hidden flex flex-col justify-between group" onmousemove="handleTilt(event, this)" onmouseleave="resetTilt(this)">
                <div class="space-y-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                      <div class="w-9 h-9 rounded-xl \${g.autoShare ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'} flex items-center justify-center font-bold text-sm">👥</div>
                      <div>
                        <h4 class="font-bold text-slate-100 text-sm group-hover:text-emerald-300 transition">\${g.name}</h4>
                        <div class="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>ID: \${g._id}</span>
                          <a href="https://facebook.com/groups/\${g._id}" target="_blank" class="text-cyan-400 hover:text-cyan-300 underline">↗</a>
                        </div>
                      </div>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider \${g.autoShare ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80' : 'bg-slate-900 text-slate-500 border border-slate-800'}">
                      \${g.autoShare ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  <div>
                    <div class="text-[10px] uppercase font-mono text-slate-400 mb-1 font-semibold">Matched Categories:</div>
                    <div class="flex flex-wrap gap-1">\${catPills}</div>
                  </div>

                  <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                    <div>Shares: <span class="text-slate-200 font-bold">\${g.totalShares || 0}</span></div>
                    <div class="truncate">Last: <span class="text-slate-200">\${lastSharedText}</span></div>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-800">
                  <button onclick="testShareGroup('\${g._id}', '\${g.name.replace(/'/g, \"\\\\'\")}')" class="px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95">
                    <span>🚀 Test Share</span>
                  </button>
                  <div class="flex items-center gap-1.5">
                    <button onclick="toggleGroupAutoShare('\${g._id}', \${g.autoShare})" class="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs transition" title="\${g.autoShare ? 'Pause Auto-Share' : 'Enable Auto-Share'}">
                      \${g.autoShare ? '⏸ Pause' : '▶ Enable'}
                    </button>
                    <button onclick="deleteGroup('\${g._id}')" class="px-2 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-400 text-xs transition" title="Delete Group">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            \`;
          }).join('');
        }

        renderGroupShareLogs((sharesRes.ok && Array.isArray(sharesRes.data)) ? sharesRes.data : []);
      } catch (err) {
        console.error('Error loading groups:', err);
      }
    }

    function renderGroupShareLogs(shares) {
      const tbody = document.getElementById('group-shares-table-body');
      if (!tbody) return;

      if (!shares || shares.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-500 font-mono">No group shares executed yet. Shares happen automatically when new news is published!</td></tr>';
        return;
      }

      tbody.innerHTML = shares.map(s => {
        const isSuccess = s.status === 'success' || s.status === 'dry_run';
        const statusBadge = isSuccess
          ? \`<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-bold">\${s.status === 'dry_run' ? 'DRY RUN' : 'SHARED'}</span>\`
          : \`<span class="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-400 border border-rose-800/60 font-bold" title="\${(s.errorMessage || '').replace(/"/g, '&quot;')}">FAILED</span>\`;

        const timeStr = s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '-';
        const postLink = s.fbPostId
          ? \`<a href="https://facebook.com/\${s.fbPostId}" target="_blank" class="text-cyan-400 hover:text-cyan-300 underline font-mono truncate block max-w-[130px]">\${s.fbPostId} ↗</a>\`
          : '-';

        return \`
          <tr class="hover:bg-slate-900/40 transition">
            <td class="py-3 pr-4 font-sans font-medium text-slate-200 max-w-xs truncate" title="\${s.articleTitle || ''}">\${s.articleTitle || '-'}</td>
            <td class="py-3 pr-4 text-emerald-300 font-sans">\${s.groupName || s.groupId}</td>
            <td class="py-3 pr-4">\${postLink}</td>
            <td class="py-3 pr-4 text-slate-400">\${s.durationMs ? s.durationMs + 'ms' : '-'}</td>
            <td class="py-3 pr-4 text-slate-400 whitespace-nowrap">\${timeStr}</td>
            <td class="py-3 pr-2">\${statusBadge}</td>
          </tr>
        \`;
      }).join('');
    }

    async function loadGroupShares() {
      const res = await safeFetchJson('/api/groups/shares?limit=25');
      if (res.ok && Array.isArray(res.data)) {
        renderGroupShareLogs(res.data);
        showToast('Group shares refreshed');
      }
    }

    async function openAddGroupModal() {
      const modal = document.getElementById('modal-add-group');
      if (!modal) return;
      modal.classList.remove('hidden');

      // Populate pages select
      try {
        const pagesRes = await safeFetchJson('/api/pages');
        const select = document.getElementById('group-page-select');
        if (select && pagesRes.ok && Array.isArray(pagesRes.data)) {
          select.innerHTML = '<option value="all">All Active Pages (ডিফল্ট)</option>' +
            pagesRes.data.map(p => \`<option value="\${p.id}">\${p.name} (\${p.id})</option>\`).join('');
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
        btn.classList.remove('border-slate-700', 'bg-slate-900', 'text-slate-300');
        return;
      }

      // If 'all' was in there, remove it
      currentCats = currentCats.filter(c => c.toLowerCase() !== 'all');

      const idx = currentCats.indexOf(cat);
      if (idx > -1) {
        currentCats.splice(idx, 1);
        btn.classList.remove('active', 'border-emerald-600', 'bg-emerald-950/60', 'text-emerald-300');
        btn.classList.add('border-slate-700', 'bg-slate-900', 'text-slate-300');
      } else {
        currentCats.push(cat);
        btn.classList.add('active', 'border-emerald-600', 'bg-emerald-950/60', 'text-emerald-300');
        btn.classList.remove('border-slate-700', 'bg-slate-900', 'text-slate-300');
      }

      input.value = currentCats.length > 0 ? currentCats.join(', ') : 'all';
    }

    async function handleSaveGroup(e) {
      e.preventDefault();
      const id = document.getElementById('group-id-input').value.trim();
      const name = document.getElementById('group-name-input').value.trim();
      const categories = document.getElementById('group-categories-input').value.trim();
      const pageId = document.getElementById('group-page-select').value;
      const delaySeconds = document.getElementById('group-delay-input').value;
      const accessToken = document.getElementById('group-token-input').value.trim();

      const payload = {
        id,
        name,
        categories,
        page_id: pageId,
        delay_seconds: parseInt(delaySeconds, 10) || 5,
        access_token: accessToken || null,
        auto_share: true,
      };

      const res = await safeFetchJson('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok && res.data && res.data.success) {
        showToast(\`Group "\${name}" added successfully!\`);
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
        showToast(\`Auto-share \${!currentStatus ? 'enabled' : 'paused'} for group\`);
        loadGroups();
      } else {
        showToast(res.error || 'Failed to update group', true);
      }
    }

    async function deleteGroup(id) {
      if (!confirm('Are you sure you want to remove this group from auto-share?')) return;
      const res = await safeFetchJson('/api/groups/' + id, { method: 'DELETE' });
      if (res.ok) {
        showToast('Group removed');
        loadGroups();
      } else {
        showToast(res.error || 'Failed to delete group', true);
      }
    }

    async function testShareGroup(id, groupName) {
      showToast(\`Initiating test share to "\${groupName}"...\`);
      const res = await safeFetchJson('/api/groups/' + id + '/test-share', { method: 'POST' });
      if (res.ok && res.data && res.data.success) {
        showToast(\`✓ Shared successfully to "\${groupName}"!\`);
        loadGroups();
      } else {
        showToast(res.data?.error || res.error || 'Test share failed', true);
      }
    }

    // --- TEMPLATE PREVIEW ---
    async function renderPreview() {
      const spinner = document.getElementById('preview-spinner');
      const frame = document.getElementById('preview-frame');
      const img = document.getElementById('preview-img');
      const placeholder = document.getElementById('preview-placeholder');
      const meta = document.getElementById('preview-meta');

      spinner.classList.remove('hidden');
      meta.innerText = 'Compiling Bengali layout in 3D frame...';

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

        if (res.ok && res.data && res.data.html) {
          frame.srcdoc = res.data.html;
          frame.classList.remove('hidden');
          img.classList.add('hidden');
          placeholder.classList.add('hidden');
          meta.innerText = '✓ Live Interactive Canva Template Ready (1080x1080 Rendered)';
        } else {
          meta.innerText = 'Preview notice: ' + (res.data?.error || res.error || 'Failed to compile template');
        }
      } catch (e) {
        meta.innerText = 'Error: ' + e.message;
        showToast('Error generating preview: ' + e.message, true);
      } finally {
        spinner.classList.add('hidden');
      }
    }

    // --- SETTINGS ---
    async function loadSettings() {
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

      const res = await safeFetchJson('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = res.data || {};
      if (d.success) {
        showToast('Pipeline configuration saved successfully!');
      } else {
        showToast(d.error || 'Failed to save settings', true);
      }
    }

    // --- 7. FACEBOOK REELS STUDIO ---
    let cachedReelArticles = [];
    const reelThemeDescriptions = {
      'auto-category': 'Smart AI Matching: Automatically detects bdnews.site category (13 categories) and applies tailored visual theme and audio profile',
      'rolling': 'Dynamic Round-Robin: Cycles through all templates automatically on every post',
      'cat-bangladesh': '1080x1080 Square: Patriotic emerald & crimson theme, live badge, framed photo, bold Bengali card',
      'cat-politics': '1080x1080 Square: Authoritative political breaking theme, golden alert badge, heavy bass broadcast fanfare',
      'cat-economy': '1080x1080 Square: Financial markets & business theme, emerald green badge, modern crisp pulse audio',
      'cat-international': '1080x1080 Square: Global world affairs theme, yellow badge, expansive world broadcast reverb sound',
      'cat-sports': '1080x1080 Square: High-octane stadium sports theme, orange badge, upbeat energetic sports fanfare',
      'cat-technology': '1080x1080 Square: Futuristic cyber innovation theme, electric cyan badge, electronic tech resonance sound',
      'cat-entertainment': '1080x1080 Square: Celebrity & cinema theme, neon fuchsia badge, lively upbeat pop showbiz shimmer sound',
      'cat-opinion': '1080x1080 Square: Thought-provoking editorial column theme, ochre gold badge, thoughtful orchestral sound',
      'cat-religion': '1080x1080 Square: Dignified spiritual serene theme, radiant gold badge, peaceful acoustic sound',
      'cat-education': '1080x1080 Square: Academic campus & students theme, cerulean badge, bright inspiring melodic audio',
      'cat-job': '1080x1080 Square: Career opportunities theme, mint green badge, confident forward-moving beat',
      'cat-lifestyle': '1080x1080 Square: Health & living theme, warm coral badge, light friendly lifestyle ambiance',
      'cat-todays-match': '1080x1080 Square: Pulse-pounding match day & urgent alert theme, fiery gold badge, maximum overdrive sound',
      'studio-red': '1080x1080 Square: Red gradient studio, framed photo, circular logo, white lower-third card',
      'breaking-bold': '1080x1080 Square: High urgency TV alert, animated breaking ticker, bold red & black straps with gold accent',
      'dark-cinema': '1080x1080 Square: Premium obsidian & neon cyan aesthetic, widescreen photo, glowing glassmorphic card',
      'viral-gradient': '1080x1080 Square: Modern sunset violet/rose mesh gradient, floating photo, high-contrast viral card',
      'vertical-916': '1080x1920 Fullscreen: Native smartphone vertical reel format, massive centered photo & bottom overlay headline',
    };

    let reelDebounceTimer = null;
    function updateReelFramePreviewDebounced() {
      clearTimeout(reelDebounceTimer);
      reelDebounceTimer = setTimeout(updateReelFramePreview, 350);
    }

    async function loadReels() {
      try {
        loadReelSettings();
        loadReelArticles();
        loadReelPages();
        loadReelLogs();
        onReelThemeChanged();
      } catch (e) {
        console.error('Error loading reels tab:', e);
      }
    }

    function onReelThemeChanged() {
      const select = document.getElementById('reel-theme-select');
      const theme = select ? select.value : 'auto-category';
      const durSelect = document.getElementById('reel-duration-select');
      const dur = durSelect ? durSelect.value : '18';
      const descEl = document.getElementById('reel-theme-desc');
      const badgeEl = document.getElementById('reel-theme-badge');
      const playerBox = document.getElementById('reel-player-box');
      const durBadge = document.getElementById('reel-duration-badge');

      if (descEl) descEl.innerText = reelThemeDescriptions[theme] || '';

      if (theme === 'auto-category') {
        if (badgeEl) {
          badgeEl.innerText = 'Smart AI Category';
          badgeEl.className = 'px-2 py-0.5 text-[10px] font-mono rounded bg-amber-950 text-amber-400 border border-amber-800';
        }
        if (playerBox) {
          playerBox.className = 'relative w-full max-w-[420px] aspect-square bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden group transition-all duration-300';
        }
        if (durBadge) durBadge.innerText = dur + 's • 24fps • Smart AI Matching';
      } else if (theme === 'rolling') {
        if (badgeEl) {
          badgeEl.innerText = 'Auto Rolling';
          badgeEl.className = 'px-2 py-0.5 text-[10px] font-mono rounded bg-purple-950 text-purple-400 border border-purple-800';
        }
        if (playerBox) {
          playerBox.className = 'relative w-full max-w-[420px] aspect-square bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden group transition-all duration-300';
        }
        if (durBadge) durBadge.innerText = dur + 's • 24fps • Rotating Templates';
      } else if (theme && theme.startsWith('cat-')) {
        if (badgeEl) {
          badgeEl.innerText = '1:1 Category';
          badgeEl.className = 'px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-950 text-cyan-400 border border-cyan-800';
        }
        if (playerBox) {
          playerBox.className = 'relative w-full max-w-[420px] aspect-square bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden group transition-all duration-300';
        }
        if (durBadge) durBadge.innerText = dur + 's • 24fps • 1080x1080';
      } else if (theme === 'vertical-916') {
        if (badgeEl) {
          badgeEl.innerText = '9:16 Vertical';
          badgeEl.className = 'px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950 text-emerald-400 border border-emerald-800';
        }
        if (playerBox) {
          playerBox.className = 'relative w-full max-w-[280px] aspect-[9/16] bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden group transition-all duration-300';
        }
        if (durBadge) durBadge.innerText = dur + 's • 24fps • 1080x1920';
      } else {
        if (badgeEl) {
          badgeEl.innerText = '1:1 Square';
          badgeEl.className = 'px-2 py-0.5 text-[10px] font-mono rounded bg-rose-950 text-rose-400 border border-rose-800';
        }
        if (playerBox) {
          playerBox.className = 'relative w-full max-w-[420px] aspect-square bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden group transition-all duration-300';
        }
        if (durBadge) durBadge.innerText = dur + 's • 24fps • 1080x1080';
      }

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
        headline: headline || '২০২৬-২৭ শিক্ষাবর্ষের মেডিক্যাল ভর্তি পরীক্ষা স্থগিত, চূড়ান্ত হয়নি নতুন সময়সূচি'
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
          if (res.ok && res.data && res.data.hashtags) {
            const el = document.getElementById('reel-hashtags-input');
            if (el) el.value = res.data.hashtags;
          }
        } catch (e) {
          console.error('Failed to generate viral hashtags:', e);
        }
      }, 300);
    }

    async function loadReelSettings() {
      try {
        const res = await safeFetchJson('/api/reels/settings');
        if (res.ok && res.data) {
          const auto = Boolean(res.data.autoPostReels);
          const toggle = document.getElementById('toggle-auto-reels');
          const badge = document.getElementById('reels-auto-badge');
          if (toggle) toggle.checked = auto;
          if (badge) {
            badge.innerText = auto ? 'ACTIVE' : 'OFF';
            badge.className = auto 
              ? 'px-1.5 py-0.2 text-[9px] font-mono rounded bg-rose-950 text-rose-400 border border-rose-800' 
              : 'px-1.5 py-0.2 text-[9px] font-mono rounded bg-slate-800 text-slate-400';
          }

          const disablePoster = Boolean(res.data.disablePoster);
          const togglePoster = document.getElementById('toggle-disable-poster');
          const posterBadge = document.getElementById('poster-disable-badge');
          if (togglePoster) togglePoster.checked = disablePoster;
          if (posterBadge) {
            posterBadge.innerText = disablePoster ? 'ACTIVE' : 'OFF';
            posterBadge.className = disablePoster 
              ? 'px-1.5 py-0.2 text-[9px] font-mono rounded bg-emerald-950 text-emerald-400 border border-emerald-800' 
              : 'px-1.5 py-0.2 text-[9px] font-mono rounded bg-slate-800 text-slate-400';
          }

          const postStories = res.data.postPosterToStories !== false;
          const toggleStories = document.getElementById('toggle-post-stories');
          const storiesBadge = document.getElementById('stories-poster-badge');
          if (toggleStories) toggleStories.checked = postStories;
          if (storiesBadge) {
            storiesBadge.innerText = postStories ? 'ACTIVE' : 'OFF';
            storiesBadge.className = postStories 
              ? 'px-1.5 py-0.2 text-[9px] font-mono rounded bg-purple-950 text-purple-400 border border-purple-800' 
              : 'px-1.5 py-0.2 text-[9px] font-mono rounded bg-slate-800 text-slate-400';
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function handleDisablePosterToggle(checked) {
      try {
        const res = await safeFetchJson('/api/reels/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disablePoster: checked })
        });
        if (res.ok) {
          showToast(checked ? '✓ Poster disabled! 15-20s Reels-Only mode active.' : 'Poster posting enabled');
          loadReelSettings();
        } else {
          showToast('Failed to update setting', true);
        }
      } catch (e) {
        showToast('Error: ' + e.message, true);
      }
    }

    async function handleAutoReelsToggle(checked) {
      try {
        const res = await safeFetchJson('/api/reels/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoPostReels: checked })
        });
        if (res.ok) {
          showToast(checked ? '✓ Auto-Reels enabled on new posts' : 'Auto-Reels disabled');
          loadReelSettings();
        } else {
          showToast('Failed to update Auto-Reels setting', true);
        }
      } catch (e) {
        showToast('Error: ' + e.message, true);
      }
    }

    async function handlePostStoriesToggle(checked) {
      try {
        const res = await safeFetchJson('/api/reels/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postPosterToStories: checked })
        });
        if (res.ok) {
          showToast(checked ? '✓ JPG poster will publish to Page Stories (Not Feed)' : 'Page Stories auto-post disabled');
          loadReelSettings();
        } else {
          showToast('Failed to update setting', true);
        }
      } catch (e) {
        showToast('Error: ' + e.message, true);
      }
    }

    async function loadReelArticles() {
      try {
        const res = await safeFetchJson('/api/queue');
        const select = document.getElementById('reel-article-select');
        if (!select) return;

        let items = [];
        if (res.ok && res.data) {
          items = (res.data.pendingJobs || []).concat(res.data.recentLogs || []);
        }

        cachedReelArticles = items;
        select.innerHTML = '<option value="">-- Choose an article or type custom below --</option>';

        items.slice(0, 30).forEach((item, idx) => {
          const title = item.articleTitle || item.payload?.articleTitle || item.title || ('Article #' + (idx + 1));
          const opt = document.createElement('option');
          opt.value = idx;
          opt.textContent = title.length > 70 ? title.substring(0, 70) + '...' : title;
          select.appendChild(opt);
        });
      } catch (e) {
        console.error(e);
      }
    }

    function onReelArticleSelected() {
      const select = document.getElementById('reel-article-select');
      const idx = select.value;
      if (idx === '' || !cachedReelArticles[idx]) return;

      const item = cachedReelArticles[idx];
      const title = item.articleTitle || item.payload?.articleTitle || item.title || '';
      const category = item.category || item.payload?.category || 'বিশেষ খবর';
      const img = item.imageUrl || item.payload?.imageUrl || '';
      const link = item.link || item.payload?.link || item.articleLink || '';
      const articleId = item._id || item.articleId || item.payload?.articleId || '';

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
          opt.value = p._id;
          opt.textContent = p.name + ' (' + p._id + ')';
          select.appendChild(opt);
        });
      } catch (e) {
        console.error(e);
      }
    }

    async function renderReelPreview() {
      const headline = document.getElementById('reel-headline-input').value.trim();
      const category = document.getElementById('reel-category-input').value.trim() || 'বিশেষ খবর';
      const imageUrl = document.getElementById('reel-image-input').value.trim();
      const theme = document.getElementById('reel-theme-select').value || 'studio-red';

      if (!headline) {
        showToast('Please enter a Bengali headline', true);
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
      statusEl.innerText = 'Rendering ' + dur + 's MP4 news reel (' + theme + ')... This takes ~15-20 seconds.';

      const params = new URLSearchParams({
        headline: headline,
        category: category,
        theme: theme,
        duration: dur
      });
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
          statusEl.innerText = '✓ ' + dur + 's Reel rendered successfully! Playing in studio player.';
          showToast('✓ ' + dur + 's MP4 Reel (' + theme + ') rendered successfully!');
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

      if (!headline) {
        showToast('Please enter a Bengali headline', true);
        return;
      }

      const statusEl = document.getElementById('reel-action-status');
      const spinner = document.getElementById('reel-player-spinner');
      const btn = document.getElementById('btn-publish-reel');

      btn.disabled = true;
      btn.classList.add('opacity-50');
      spinner.classList.remove('hidden');
      document.getElementById('reel-spinner-text').innerText = 'Generating ' + dur + 's MP4 & publishing to Facebook Reels...';
      statusEl.classList.remove('hidden');
      statusEl.innerText = 'Rendering ' + dur + 's MP4 (' + theme + ') and uploading to Facebook Graph API...';

      try {
        const res = await safeFetchJson('/api/reels/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headline,
            category,
            imageUrl,
            link,
            articleId,
            pageId,
            theme,
            duration: dur,
            hashtags
          })
        });

        if (res.ok && res.data && res.data.success) {
          showToast('✓ Successfully published ' + dur + 's Reel with first comment to ' + (res.data.pageName || 'Facebook') + '!');
          statusEl.innerText = '✓ Published! Facebook Video ID: ' + (res.data.videoId || 'N/A');
          loadReelLogs();
        } else {
          showToast('Publish failed: ' + (res.data?.error || res.error || 'Server error'), true);
          statusEl.innerText = 'Error: ' + (res.data?.error || res.error);
        }
      } catch (e) {
        showToast('Error publishing reel: ' + e.message, true);
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

      if (!headline) {
        showToast('Please enter a Bengali headline', true);
        return;
      }

      const statusEl = document.getElementById('reel-action-status');
      const btn = document.getElementById('btn-publish-story');

      btn.disabled = true;
      btn.classList.add('opacity-50');
      statusEl.classList.remove('hidden');
      statusEl.innerText = 'Rendering 1080x1080 JPG card and publishing to Facebook Stories (NOT feed)...';

      try {
        const res = await safeFetchJson('/api/stories/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headline, category, imageUrl, pageId })
        });

        if (res.ok && res.data && res.data.success) {
          showToast('✓ Successfully posted JPG poster to ' + (res.data.pageName || 'Facebook') + ' Stories!');
          statusEl.innerText = '✓ Published to Stories! Photo ID: ' + res.data.photoId + ', Story ID: ' + res.data.storyId;
        } else {
          showToast('Story publish failed: ' + (res.data?.error || res.error || 'Server error'), true);
          statusEl.innerText = 'Error: ' + (res.data?.error || res.error);
        }
      } catch (e) {
        showToast('Error publishing story: ' + e.message, true);
      } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50');
      }
    }

    async function loadReelLogs() {
      try {
        const res = await safeFetchJson('/api/reels/logs?limit=25');
        const tbody = document.getElementById('reels-table-body');
        const statCount = document.getElementById('stat-reels-count');
        if (!tbody) return;

        if (!res.ok || !res.data || res.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500">No reels published yet. Click "Publish Reel Now" to create one!</td></tr>';
          if (statCount) statCount.innerText = '0';
          return;
        }

        if (statCount) statCount.innerText = res.data.length;

        const themeLabels = {
          'studio-red': '<span class="px-2 py-0.5 text-[10px] font-mono rounded bg-rose-950 text-rose-300 border border-rose-800">Studio Red</span>',
          'breaking-bold': '<span class="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-950 text-amber-300 border border-amber-800">Breaking Flash</span>',
          'dark-cinema': '<span class="px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-950 text-cyan-300 border border-cyan-800">Dark Cyber</span>',
          'viral-gradient': '<span class="px-2 py-0.5 text-[10px] font-mono rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800">Viral Mesh</span>',
          'vertical-916': '<span class="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950 text-emerald-300 border border-emerald-800">9:16 Vertical</span>',
        };

        tbody.innerHTML = res.data.map(log => {
          const dateStr = log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
          const isSuccess = log.status === 'success';
          const isDryRun = log.status === 'dry_run';
          const statusBadge = isSuccess
            ? '<span class="px-2 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PUBLISHED</span>'
            : (isDryRun 
                ? '<span class="px-2 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">DRY RUN</span>'
                : '<span class="px-2 py-0.5 text-[10px] rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">FAILED</span>' +
                  (log.errorMessage ? '<div class="text-[10px] text-red-400 font-mono mt-0.5 truncate max-w-xs" title="' + log.errorMessage + '">' + log.errorMessage + '</div>' : ''));

          const videoLink = log.fbVideoId && !log.fbVideoId.startsWith('dryrun')
            ? '<a href="https://facebook.com/' + log.fbVideoId + '" target="_blank" class="text-rose-400 hover:underline">' + log.fbVideoId + ' ↗</a>'
            : (log.fbVideoId || 'N/A');

          const themeBadge = log.theme && themeLabels[log.theme] ? themeLabels[log.theme] : '<span class="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-400">Standard</span>';

          return '<tr class="hover:bg-slate-900/40 transition">' +
            '<td class="py-3 pr-4 font-bengali text-slate-200 max-w-xs truncate" title="' + (log.articleTitle || '') + '">' + (log.articleTitle || 'Untitled') + '</td>' +
            '<td class="py-3 pr-4 text-slate-400">' + (log.pageName || 'BD News 24/7') + '</td>' +
            '<td class="py-3 pr-4">' + themeBadge + '</td>' +
            '<td class="py-3 pr-4">' + videoLink + '</td>' +
            '<td class="py-3 pr-4 text-slate-400">' + (log.durationMs ? (log.durationMs / 1000).toFixed(1) + 's' : 'N/A') + '</td>' +
            '<td class="py-3 pr-4 text-slate-400">' + dateStr + '</td>' +
            '<td class="py-3">' + statusBadge + '</td>' +
            '</tr>';
        }).join('');
      } catch (e) {
        console.error('Error loading reel logs:', e);
      }
    }


    // --- YOUTUBE SHORTS AUTOMATION ---
    async function loadYouTube() {
      try {
        const res = await safeFetchJson('/api/youtube/status');
        const badge = document.getElementById('yt-connection-badge');
        const pill = document.getElementById('yt-active-pill');
        const titleEl = document.getElementById('yt-channel-title');
        const handleEl = document.getElementById('yt-channel-handle');
        const subEl = document.getElementById('yt-sub-count');
        const vidEl = document.getElementById('yt-video-count');
        const avatarEl = document.getElementById('yt-avatar');
        const autoToggle = document.getElementById('yt-auto-toggle');
        const clientIdInput = document.getElementById('yt-client-id');
        const clientSecInput = document.getElementById('yt-client-secret');
        const refreshInput = document.getElementById('yt-refresh-token');

        if (res.ok && res.data) {
          const d = res.data;
          if (clientIdInput && d.clientId) clientIdInput.value = d.clientId;
          if (autoToggle) autoToggle.checked = d.autoPost !== false;

          if (d.hasClientSecret && clientSecInput && !clientSecInput.value) {
            clientSecInput.placeholder = '•••••••••••••••• (Saved)';
          }
          if (d.hasRefreshToken && refreshInput && !refreshInput.value) {
            refreshInput.placeholder = '•••••••••••••••• (Saved)';
          }

          if (d.isConfigured && d.channel) {
            badge.innerText = 'Connected: ' + d.channel.title;
            badge.className = 'px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-600/40';
            pill.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-glow-emerald';

            if (titleEl) titleEl.innerText = d.channel.title;
            if (handleEl) handleEl.innerText = d.channel.customUrl || '@' + d.channel.id;
            if (subEl) subEl.innerText = Number(d.channel.subscriberCount || 0).toLocaleString();
            if (vidEl) vidEl.innerText = Number(d.channel.videoCount || 0).toLocaleString();
            if (avatarEl && d.channel.thumbnailUrl) avatarEl.src = d.channel.thumbnailUrl;
          } else if (d.error) {
            badge.innerText = 'OAuth Error';
            badge.className = 'px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-rose-600/20 text-rose-400 border border-rose-600/40';
            pill.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
            if (titleEl) titleEl.innerText = 'Auth Failed: ' + d.error;
          } else {
            badge.innerText = 'Not Connected';
            badge.className = 'px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-600/20 text-amber-400 border border-amber-600/40';
            pill.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
          }
        }
        loadYouTubeLogs();
      } catch (e) {
        console.error('Error loading YouTube status:', e);
      }
    }

    async function saveYouTubeSettings() {
      try {
        const clientId = document.getElementById('yt-client-id')?.value.trim();
        const clientSecret = document.getElementById('yt-client-secret')?.value.trim();
        const refreshToken = document.getElementById('yt-refresh-token')?.value.trim();
        const autoPost = document.getElementById('yt-auto-toggle')?.checked;

        const payload = { autoPost };
        if (clientId) payload.clientId = clientId;
        if (clientSecret) payload.clientSecret = clientSecret;
        if (refreshToken) payload.refreshToken = refreshToken;

        showToast('Saving YouTube settings & verifying credentials...');
        const res = await safeFetchJson('/api/youtube/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok && res.data) {
          if (res.data.channel) {
            showToast('✓ YouTube Connected: ' + res.data.channel.title);
          } else if (res.data.verifyError) {
            showToast('Saved, but token verify note: ' + res.data.verifyError, true);
          } else {
            showToast('✓ YouTube settings saved successfully.');
          }
          loadYouTube();
        } else {
          showToast('Failed to save: ' + (res.data?.error || res.error || 'Server error'), true);
        }
      } catch (e) {
        showToast('Error saving YouTube settings: ' + e.message, true);
      }
    }

    async function triggerYouTubeUploadNow() {
      const btn = document.getElementById('yt-upload-btn');
      if (btn) btn.disabled = true;
      try {
        showToast('Rendering 18s MP4 reel & uploading to YouTube Shorts...');
        const res = await safeFetchJson('/api/youtube/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (res.ok && res.data) {
          showToast('✓ YouTube Short Uploaded! URL: ' + res.data.videoUrl);
          loadYouTubeLogs();
        } else {
          showToast('YouTube upload failed: ' + (res.data?.error || res.error || 'Check credentials'), true);
        }
      } catch (e) {
        showToast('Upload error: ' + e.message, true);
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async function loadYouTubeLogs() {
      try {
        const tbody = document.getElementById('yt-table-body');
        if (!tbody) return;
        const res = await safeFetchJson('/api/youtube/logs?limit=30');
        if (!res.ok || !res.data || !res.data.logs || res.data.logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-500">No YouTube Shorts uploads yet.</td></tr>';
          return;
        }

        tbody.innerHTML = res.data.logs.map(log => {
          const dateStr = log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
          const isSuccess = log.status === 'success';
          const isDryRun = log.status === 'dry_run';
          const statusBadge = isSuccess
            ? '<span class="px-2 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PUBLISHED</span>'
            : (isDryRun 
                ? '<span class="px-2 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">DRY RUN</span>'
                : '<span class="px-2 py-0.5 text-[10px] rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">FAILED</span>' +
                  (log.errorMessage ? '<div class="text-[10px] text-red-400 font-mono mt-0.5 truncate max-w-xs" title="' + log.errorMessage + '">' + log.errorMessage + '</div>' : ''));

          const videoLink = log.ytVideoId && !log.ytVideoId.startsWith('dryrun')
            ? '<a href="https://youtube.com/shorts/' + log.ytVideoId + '" target="_blank" class="text-red-400 hover:underline flex items-center gap-1 font-mono">' + log.ytVideoId + ' ↗</a>'
            : (log.ytVideoId || 'N/A');

          return '<tr class="hover:bg-slate-900/40 transition">' +
            '<td class="py-3 pr-4 font-bengali text-slate-200 max-w-xs truncate" title="' + (log.articleTitle || '') + '">' + (log.articleTitle || 'Untitled') + '</td>' +
            '<td class="py-3 pr-4">' + videoLink + '</td>' +
            '<td class="py-3 pr-4 text-slate-400">' + (log.durationMs ? (log.durationMs / 1000).toFixed(1) + 's' : 'N/A') + '</td>' +
            '<td class="py-3 pr-4 text-slate-400">' + dateStr + '</td>' +
            '<td class="py-3">' + statusBadge + '</td>' +
            '</tr>';
        }).join('');
      } catch (e) {
        console.error('Error loading YouTube logs:', e);
      }
    }

    async function startGoogleOAuth() {
      try {
        showToast('Generating Google sign-in session...');
        const res = await safeFetchJson('/api/youtube/auth/url');
        if (res.ok && res.data && res.data.authUrl) {
          window.location.href = res.data.authUrl;
        } else {
          showToast('Could not start OAuth: ' + (res.data?.error || 'Unknown error'), true);
        }
      } catch (e) {
        showToast('OAuth Error: ' + e.message, true);
      }
    }

    function copyRedirectUri() {
      const uri = window.location.origin + '/api/youtube/auth/callback';
      navigator.clipboard.writeText(uri).then(() => {
        showToast('✓ Redirect URI copied to clipboard: ' + uri);
      }).catch(() => {
        showToast(uri);
      });
    }

    // Update redirect URI display dynamically
    setTimeout(() => {
      const disp = document.getElementById('yt-redirect-uri-display');
      if (disp) disp.innerText = window.location.origin + '/api/youtube/auth/callback';
    }, 200);

    // Initial load & Tab URL check
    loadOverview();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'youtube') {
      switchTab('youtube');
      if (urlParams.get('auth') === 'success') {
        setTimeout(() => showToast('🎉 YouTube Channel Successfully Connected!'), 500);
      }
      if (urlParams.get('auth_error')) {
        setTimeout(() => showToast('Google Auth Note: ' + decodeURIComponent(urlParams.get('auth_error')), true), 500);
      }
    }
  </script>
</body>
</html>`;

  res.send(html);
});

