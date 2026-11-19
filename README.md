# ⚡ Input Automation
> **Stage 1 Microservice: Source -> Reel Video -> Google Drive Staging**

---

## 🎯 Purpose & Responsibilities
This is a standalone Node.js application dedicated exclusively to **Input Automation**:
1. **Sources**: Ingests breaking news & articles from RSS feeds (e.g. BD News, Trending News World) or clip sources.
2. **Reel Generation Engine**:
   - Neural Text-to-Speech (Microsoft Edge TTS for Bengali & English).
   - High-contrast television studio news cards via `@napi-rs/canvas`.
   - FFmpeg 9:16 vertical video composition (1080x1920) with audio normalization (EBU R128), waveform, animated tickers, and captions.
3. **Google Drive Staging**: Uploads generated `.mp4` videos directly to the assigned Google Drive folder via Google Drive API v3 (resumable) with automatic local folder fallback.
4. **State Tracking**: Saves ingestion & upload records in MongoDB to ensure deduplication.

---

## 🚀 Quick Start

### 1. Installation
```bash
cd input-automation
pnpm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in credentials:
```bash
cp .env.example .env
```
Key settings:
- `MONGODB_URI`: Shared MongoDB instance for state synchronization
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`: Google Cloud OAuth credentials for Google Drive
- `GDRIVE_FOLDER_ID`: Target Google Drive folder ID
- `PORT`: Server port (default: 3001)

### 3. Running

```bash
# Development (with hot-reload)
pnpm dev

# Build TypeScript
pnpm build

# Production Start
pnpm start

# Run a single cycle directly from CLI
pnpm run-now
```

---

## 🌐 API & Webhook Endpoints
- `GET /health` or `GET /`: Healthcheck & configuration status
- `POST /api/cron/input` (or `GET /api/cron/input`): Executes the input cycle. Compatible with **cron-job.org** or Vercel cron.
- `GET /api/status`: MongoDB stats (total articles, reels uploaded to Drive)
- `GET /api/sources`: Lists configured RSS/content sources
