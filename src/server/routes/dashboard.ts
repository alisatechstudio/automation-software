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
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        Auto-Share Groups
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
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
        
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

        <!-- Card 5: Auto-Share Groups -->
        <div class="tilt-card glass-panel rounded-2xl p-6 relative overflow-hidden group cursor-pointer col-span-2 sm:col-span-1" onmousemove="handleTilt(event, this)" onmouseleave="resetTilt(this)">
          <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div class="tilt-card-inner">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-blue-400/90 font-mono">Auto Groups</span>
              <div class="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
              </div>
            </div>
            <div id="stat-groups" class="text-3xl sm:text-4xl font-extrabold mt-3 text-white tracking-tight font-mono">0</div>
            <div class="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              Auto-Share Targets
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
        <div class="mb-4">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Recent Execution Logs & Facebook Telemetry
          </h3>
          <p class="text-xs text-slate-400">Click on any FB Post ID to inspect directly on Facebook</p>
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

    <!-- 4b. FACEBOOK GROUPS & AUTO-SHARING TAB -->
    <div id="tab-groups" class="tab-content hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Add Facebook Group Form -->
        <div class="glass-panel p-6 rounded-2xl h-fit space-y-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
              </div>
              <h3 class="text-base font-bold text-white">Add Auto-Share Group</h3>
            </div>
            <button type="button" onclick="discoverPageGroups()" class="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800/50 transition flex items-center gap-1 active:scale-95">
              <span>🔍</span> Discover
            </button>
          </div>
          
          <form id="add-group-form" onsubmit="handleAddGroup(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Facebook Group ID</label>
              <input type="text" id="group-id" required placeholder="e.g. 123456789012345" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono transition">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Group Name / Community Label</label>
              <input type="text" id="group-name" required placeholder="e.g. বাংলাদেশ সংবাদ ও পাঠক ফোরাম" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono flex items-center justify-between">
                <span>Relevant Categories / Keywords</span>
                <span class="text-[10px] text-blue-400 normal-case">* for all</span>
              </label>
              <input type="text" id="group-categories" placeholder="e.g. রাজনীতি, জাতীয়, বিশেষ খবর, খেলাধুলা" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition">
              <div class="mt-1 text-[11px] text-slate-500 leading-tight">Separate categories or keywords with commas. Articles with matching category or keywords will automatically be shared to this group. Enter <code>*</code> to share all articles.</div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-mono">Custom Access Token (Optional)</label>
              <textarea id="group-token" rows="2" placeholder="Leave empty to automatically use active Page Access Token" class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"></textarea>
            </div>
            <div class="flex items-center justify-between py-1 px-1">
              <label class="text-xs text-slate-300 font-medium cursor-pointer" for="group-auto-share">
                Auto-Share on Publication
              </label>
              <input type="checkbox" id="group-auto-share" checked class="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500 focus:ring-offset-slate-950">
            </div>
            <button type="submit" class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              Save Facebook Group
            </button>
            <div id="discover-results-box" class="text-xs p-3.5 rounded-xl bg-slate-950 border border-slate-800 hidden font-mono space-y-2"></div>
          </form>
        </div>

        <!-- Groups List & Auto-Share Activity -->
        <div class="lg:col-span-2 space-y-6">
          <div class="glass-panel rounded-2xl p-6 space-y-5">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                Connected Facebook Groups
              </h3>
              <span id="groups-count-badge" class="px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-950/60 text-blue-400 border border-blue-800/50">0 Groups</span>
            </div>

            <!-- Operational Notice -->
            <div class="p-4 bg-slate-950/90 border border-slate-800/90 rounded-xl text-xs space-y-2 text-slate-300 shadow-inner">
              <div class="font-bold text-blue-400 flex items-center gap-2">
                <span class="text-base">🚀</span> Intelligent Group Auto-Sharing:
              </div>
              <ul class="list-disc list-inside space-y-1 text-slate-400 pl-1 leading-relaxed">
                <li><strong class="text-slate-200">Relevance Matcher:</strong> The queue automatically analyzes each news article's title, summary, and category against group tags before sharing.</li>
                <li><strong class="text-slate-200">Anti-Spam Safeguards:</strong> A staggered delay (2-4s) is inserted between group shares to comply with Meta community standards and avoid rate limits.</li>
                <li><strong class="text-slate-200">Page Identity:</strong> Shares are posted directly via your Page token. Ensure your Facebook Page is an admin or linked to the target group.</li>
              </ul>
            </div>

            <div id="groups-list" class="space-y-3.5">
              <div class="text-sm text-slate-500 font-mono">Loading connected groups...</div>
            </div>
          </div>

          <!-- Recent Group Share Logs -->
          <div class="glass-panel rounded-2xl p-6 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                Recent Group Auto-Share Executions
              </h3>
              <button onclick="loadGroupShares()" class="text-xs text-slate-400 hover:text-slate-200 font-mono flex items-center gap-1">
                <span>🔄</span> Refresh
              </button>
            </div>

            <div class="overflow-x-auto rounded-xl border border-slate-800/80">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-950/90 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th class="px-4 py-3">Status</th>
                    <th class="px-4 py-3">Article Title</th>
                    <th class="px-4 py-3">Target Group</th>
                    <th class="px-4 py-3">Time</th>
                    <th class="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody id="group-shares-table-body" class="divide-y divide-slate-800/60 bg-slate-950/40">
                  <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500 font-mono">No group shares recorded yet.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
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

    <!-- 6. SETTINGS TAB -->
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
      if (tabId === 'groups') { loadGroups(); loadGroupShares(); }
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
          animateValue('stat-groups', data.groupsCount || 0);

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
          if (log && log.status === 'success') {
            showToast('✓ Successfully published: ' + (res.data.articleTitle || '').substring(0, 30) + '...');
          } else if (log && log.errorMessage) {
            showToast('Facebook note: ' + log.errorMessage, true);
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

    // --- QUEUE & LOGS ---
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
          logBody.innerHTML = logs.map(l => \`
            <tr class="hover:bg-slate-800/40 text-xs transition">
              <td class="px-5 py-3">
                <span class="px-2 py-0.5 rounded font-mono font-bold uppercase \${l.status === 'success' || l.status === 'dry_run' ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/50' : 'text-red-400 bg-red-950/60 border border-red-800/50'}">\${l.status}</span>
              </td>
              <td class="px-5 py-3 text-slate-200 max-w-sm truncate bn font-medium">\${l.article_title || ''}</td>
              <td class="px-5 py-3 font-mono">
                \${l.fb_post_id ? \`
                  <a href="https://www.facebook.com/\${l.fb_photo_id || (l.fb_post_id.includes('_') ? l.fb_post_id.split('_')[1] : l.fb_post_id)}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1.5 font-bold" title="Click to view live post on Facebook">
                    <span>\${l.fb_post_id}</span>
                    <svg class="w-3.5 h-3.5 inline opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  </a>
                \` : '<span class="text-slate-500">-</span>'}
              </td>
              <td class="px-5 py-3 text-slate-400 font-mono">\${l.duration_ms ? l.duration_ms + 'ms' : '-'}</td>
              <td class="px-5 py-3 text-slate-500 font-mono">\${new Date(l.created_at).toLocaleString()}</td>
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

    // --- FACEBOOK PAGES ---
    async function loadPages() {
      const res = await fetch('/api/pages');
      const pages = await res.json();
      const list = document.getElementById('pages-list');
      if (pages.length === 0) {
        list.innerHTML = '<div class="text-sm text-slate-500 font-mono">No Facebook Pages connected yet.</div>';
      } else {
        list.innerHTML = pages.map(p => \`
          <div class="flex items-center justify-between p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 hover:border-slate-700 transition">
            <div>
              <div class="font-bold text-slate-100 flex items-center gap-2">
                <span>\${p.name}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">Verified</span>
              </div>
              <div class="text-xs text-slate-400 font-mono mt-1">Page ID: \${p.id}</div>
              <div class="text-xs text-slate-500 mt-1 font-mono">Token: \${p.token_expires_at ? 'Expires ' + new Date(p.token_expires_at).toLocaleDateString() : 'Permanent (Long-Lived)'}</div>
            </div>
            <button onclick="deletePage('\${p.id}')" class="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 rounded-lg border border-rose-800/50 transition">Delete</button>
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

    // --- FACEBOOK AUTO-SHARE GROUPS ---
    async function loadGroups() {
      try {
        const res = await safeFetchJson('/api/groups');
        const groups = (res.ok && res.data) ? res.data : [];
        const list = document.getElementById('groups-list');
        const badge = document.getElementById('groups-count-badge');
        if (badge) badge.innerText = groups.length + ' Groups';

        if (groups.length === 0) {
          list.innerHTML = '<div class="text-sm text-slate-500 font-mono py-4 text-center">No Facebook groups configured yet. Use the form on the left or click "Discover" to link a group.</div>';
          return;
        }

        list.innerHTML = groups.map(g => {
          const categoryBadges = (g.categories || []).map(cat => 
            \`<span class="px-2 py-0.5 rounded-md text-[10px] font-mono \${cat === '*' ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50' : 'bg-slate-900 text-slate-300 border border-slate-800'}">\${cat === '*' ? '★ All News' : cat}</span>\`
          ).join('');

          return \`
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 hover:border-slate-700 transition gap-4">
              <div class="space-y-1.5 flex-1">
                <div class="font-bold text-slate-100 flex items-center gap-2">
                  <span>\${g.name}</span>
                  \${g.auto_share 
                    ? '<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Auto-Share On</span>'
                    : '<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">Disabled</span>'
                  }
                </div>
                <div class="text-xs text-slate-400 font-mono">Group ID: <span class="text-slate-300">\${g.id}</span></div>
                <div class="flex flex-wrap items-center gap-1.5 pt-1">
                  <span class="text-[10px] text-slate-500 font-mono">Filters:</span>
                  \${categoryBadges || '<span class="text-[10px] text-slate-500">None</span>'}
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button onclick="testShareGroup('\${g.id}')" class="text-xs text-blue-400 hover:text-blue-300 px-3 py-1.5 bg-blue-950/40 hover:bg-blue-900/60 rounded-lg border border-blue-800/50 transition flex items-center gap-1 active:scale-95">
                  <span>⚡</span> Test Share
                </button>
                <button onclick="deleteGroup('\${g.id}')" class="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 rounded-lg border border-rose-800/50 transition active:scale-95">
                  Delete
                </button>
              </div>
            </div>
          \`;
        }).join('');
      } catch (err) {
        console.error('Error loading groups:', err);
      }
    }

    async function handleAddGroup(e) {
      e.preventDefault();
      const rawCategories = document.getElementById('group-categories').value;
      const payload = {
        id: document.getElementById('group-id').value.trim(),
        name: document.getElementById('group-name').value.trim(),
        categories: rawCategories ? rawCategories.split(',').map(s => s.trim()).filter(Boolean) : ['*'],
        access_token: document.getElementById('group-token').value.trim() || null,
        auto_share: document.getElementById('group-auto-share').checked,
      };

      try {
        const res = await safeFetchJson('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok && res.data && res.data.success) {
          showToast('Facebook group saved successfully!');
          document.getElementById('add-group-form').reset();
          document.getElementById('group-auto-share').checked = true;
          loadGroups();
          loadOverview();
        } else {
          showToast(res.data?.error || 'Failed to save group', true);
        }
      } catch (err) {
        showToast(err.message || 'Network error saving group', true);
      }
    }

    async function deleteGroup(id) {
      if (!confirm('Are you sure you want to remove this group from auto-sharing?')) return;
      try {
        await fetch('/api/groups/' + id, { method: 'DELETE' });
        showToast('Group removed from auto-sharing');
        loadGroups();
        loadOverview();
      } catch (err) {
        showToast(err.message, true);
      }
    }

    async function testShareGroup(id) {
      showToast('Sharing latest published news post to group ' + id + '...');
      try {
        const res = await safeFetchJson('/api/groups/' + id + '/test-share', {
          method: 'POST'
        });

        if (res.ok && res.data && res.data.success) {
          showToast('✓ Successfully shared to group! Share ID: ' + (res.data.result?.fbSharePostId || 'OK'));
          loadGroupShares();
        } else {
          showToast('⚠️ Group Share failed: ' + (res.data?.result?.errorMessage || res.data?.error || 'Error'), true);
          loadGroupShares();
        }
      } catch (err) {
        showToast('Network error during test share: ' + err.message, true);
      }
    }

    async function discoverPageGroups() {
      const box = document.getElementById('discover-results-box');
      box.classList.remove('hidden');
      box.innerHTML = '<div class="text-cyan-400 animate-pulse flex items-center gap-2"><span>🔄</span> Scanning Facebook Page for linked groups...</div>';

      try {
        const res = await safeFetchJson('/api/groups/discover', { method: 'POST' });
        if (res.ok && res.data && res.data.groups) {
          const groups = res.data.groups;
          if (groups.length === 0) {
            box.innerHTML = '<div class="text-amber-400">No linked groups discovered directly from Page. You can manually enter your Group ID and Group Name in the form above!</div>';
            return;
          }

          box.innerHTML = '<div class="text-xs font-bold text-slate-200 mb-2">Discovered Groups:</div>' +
            groups.map(g => \`
              <div class="flex items-center justify-between p-2 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px]">
                <div>
                  <div class="font-bold text-slate-200">\${g.name}</div>
                  <div class="text-slate-400 font-mono">ID: \${g.id} (\${g.privacy || 'Group'})</div>
                </div>
                <button type="button" onclick="selectDiscoveredGroup('\${g.id}', '\${g.name.replace(/'/g, "\\\\'")}')" class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] active:scale-95">Use This</button>
              </div>
            \`).join('');
        } else {
          box.innerHTML = '<div class="text-rose-400">Failed to discover: ' + (res.data?.error || 'Unknown error') + '</div>';
        }
      } catch (err) {
        box.innerHTML = '<div class="text-rose-400">Network error scanning groups: ' + err.message + '</div>';
      }
    }

    function selectDiscoveredGroup(id, name) {
      document.getElementById('group-id').value = id;
      document.getElementById('group-name').value = name;
      showToast('Selected group ' + name);
    }

    async function loadGroupShares() {
      try {
        const res = await safeFetchJson('/api/groups/shares?limit=20');
        const logs = (res.ok && res.data) ? res.data : [];
        const tbody = document.getElementById('group-shares-table-body');
        if (!tbody) return;

        if (logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500 font-mono">No group shares recorded yet. Auto-shares run when new articles are published.</td></tr>';
          return;
        }

        tbody.innerHTML = logs.map(l => {
          const isSuccess = l.status === 'success';
          const statusBadge = isSuccess
            ? '<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">Success</span>'
            : '<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/60 text-rose-400 border border-rose-800/50" title="' + (l.errorMessage || '') + '">Failed</span>';

          const timeStr = l.createdAt ? new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
          const postUrl = l.postUrl || '#';

          return \`
            <tr class="hover:bg-slate-900/40 transition font-mono">
              <td class="px-4 py-2.5">\${statusBadge}</td>
              <td class="px-4 py-2.5 font-sans font-medium text-slate-200 truncate max-w-[200px]" title="\${l.articleTitle || ''}">\${l.articleTitle || 'News Article'}</td>
              <td class="px-4 py-2.5 text-slate-300 truncate max-w-[150px]">\${l.groupName || l.groupId}</td>
              <td class="px-4 py-2.5 text-slate-400 text-[11px]">\${timeStr}</td>
              <td class="px-4 py-2.5 text-right font-sans">
                \${isSuccess && l.fbSharePostId 
                  ? \`<a href="https://www.facebook.com/\${l.fbSharePostId}" target="_blank" class="text-blue-400 hover:text-blue-300 text-xs underline font-mono">View Share ↗</a>\`
                  : \`<span class="text-slate-500 text-[11px]">\${l.errorMessage ? l.errorMessage.substring(0, 30) + '...' : '-'}</span>\`
                }
              </td>
            </tr>
          \`;
        }).join('');
      } catch (err) {
        console.error('Error loading group shares:', err);
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
        showToast('Pipeline configuration saved successfully!');
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

