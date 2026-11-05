# 📰 Self-Hosted News-to-Facebook Automation Platform

A resilient, production-ready, self-hosted automation platform that continuously monitors news portal RSS feeds, deduplicates incoming articles, dynamically renders branded news cards with localized Bengali typography via headless Playwright, publishes high-resolution photo posts to Facebook Pages using the official Facebook Graph API, and automatically appends the news URL as the first comment.

Zero third-party SaaS dependencies (no n8n, Make, or Zapier). Built with **Node.js + TypeScript**, **SQLite with automated migrations**, **Playwright (headless Chromium)**, and **Docker**.

---

## 🏗️ Architecture & Pipeline Flow

```
┌─────────────────┐       ┌────────────────────┐       ┌──────────────────────┐
│  RSS Feed(s)    │ ────> │ Deduplication &    │ ────> │ Persistent Queue     │
│  (Every N mins) │       │ Age Window Filter  │       │ (SQLite FIFO + Locks)│
└─────────────────┘       └────────────────────┘       └──────────┬───────────┘
                                                                  │
                                                          Rate Cap & Jitter
                                                            (30-60s delay)
                                                                  │
┌─────────────────────────┐                                       ▼
│ Local Bangla Fonts      │                            ┌──────────────────────┐
│ - Noto Sans Bengali     │ ─────────────────────────> │ Playwright Renderer  │
│ - Hind Siliguri         │                            │ (HTML/CSS to PNG)    │
└─────────────────────────┘                            └──────────┬───────────┘
                                                                  │
                                                           PNG Image Buffer
                                                                  │
                                                                  ▼
┌─────────────────────────┐                            ┌──────────────────────┐
│ Telegram Failure Alert  │ <─── 3 Retries Exhausted ──│ Graph API Publisher  │
│ (@BotFather Alert Bot)  │                            │ POST /{page}/photos  │
└─────────────────────────┘                            └──────────┬───────────┘
                                                                  │
                                                             fb_post_id
                                                                  │
                                                                  ▼
                                                       ┌──────────────────────┐
                                                       │ First Comment Poster │
                                                       │ "বিস্তারিত পড়ুন: url" │
                                                       └──────────────────────┘
```

---

## 📁 Repository Structure

```
.
├── assets/
│   ├── fonts/                          # Bundled local Bengali typography
│   │   ├── HindSiliguri-Bold.ttf
│   │   ├── HindSiliguri-Regular.ttf
│   │   └── NotoSansBengali-Regular.ttf
│   └── images/                         # Branded vector assets
│       ├── fallback.svg                # Fallback news placeholder
│       └── logo.svg                    # Brand logo overlay
├── data/                               # Persistent SQLite DB & rendered PNGs (Docker volume)
│   ├── news_automation.db
│   └── rendered/
├── src/
│   ├── config/
│   │   ├── constants.ts                # Template dimensions, aspect ratios, defaults
│   │   └── env.ts                      # Strongly typed environment configuration
│   ├── db/
│   │   ├── index.ts                    # SQLite WAL connection pool (PostgreSQL upgradeable)
│   │   ├── migrator.ts                 # Atomic SQL migration runner
│   │   ├── schema.ts                   # TypeScript model interfaces
│   │   └── migrations/
│   │       └── 001_initial.sql         # Base database schema & indexes
│   ├── server/
│   │   ├── app.ts                      # Express web server & health endpoint
│   │   ├── middleware/
│   │   │   ├── auth.ts                 # Basic Auth password protection
│   │   │   └── logging.ts              # HTTP request timing & logging
│   │   └── routes/
│   │       ├── api.ts                  # REST API for sources, pages, queue, and settings
│   │       └── dashboard.ts            # Responsive Web UI Dashboard
│   ├── services/
│   │   ├── alert/
│   │   │   └── telegram.ts             # Telegram Bot failure alerting
│   │   ├── facebook/
│   │   │   ├── client.ts               # Facebook Graph API v21.0 client
│   │   │   └── token.ts                # Token inspection and expiry verification
│   │   ├── pipeline/
│   │   │   └── coordinator.ts          # Scheduler + Queue orchestration
│   │   ├── queue/
│   │   │   ├── queue.ts                # Persistent SQLite job queue with backoff
│   │   │   └── worker.ts               # Worker with anti-spam jitter & rate caps
│   │   ├── renderer/
│   │   │   ├── playwright.ts           # Playwright headless Chromium renderer
│   │   │   └── types.ts                # ImageRenderer interface
│   │   └── rss/
│   │       ├── dedupe.ts               # Deduplication and FIFO ordering
│   │       └── parser.ts               # RSS ingestion & og:image scraper fallback
│   ├── templates/                      # Swappable news graphic templates
│   │   ├── template-landscape-standard.html  # 1200x630 (1.91:1 Social Share)
│   │   ├── template-square-breaking.html     # 1080x1080 Breaking News
│   │   └── template-square-editorial.html    # 1080x1080 Modern Editorial
│   └── index.ts                        # Main application bootstrap
├── test/                               # Comprehensive verification suite
│   ├── test-rss.ts                     # Phase 1 test
│   ├── test-renderer.ts                # Phase 2 test
│   ├── test-facebook.ts                # Phase 3 test
│   ├── test-queue.ts                   # Phase 4 test
│   └── test-end-to-end.ts              # Full pipeline dry-run test
├── Dockerfile                          # Multi-stage production container
├── docker-compose.yml                  # Production orchestration
├── .env.example                        # Environment template
├── tsconfig.json
└── package.json
```

---

## 🗄️ Database Schema

The database uses SQLite in WAL (`Write-Ahead Logging`) mode for maximum concurrency. All queries adhere to standard ANSI SQL, making it direct and simple to migrate to PostgreSQL by updating `src/db/index.ts`.

### Core Tables
1. **`news_articles`**:
   - `id` (TEXT PK): Unique hash or UUID.
   - `guid`, `link`: Indexed uniqueness constraints for strict deduplication.
   - `title`, `description`, `category`, `pub_date`, `image_url`.
   - `status`: `ingested` | `queued` | `published` | `failed`.
2. **`jobs`**:
   - `id` (TEXT PK): UUID.
   - `type`: `process_article`.
   - `article_id`, `page_id`: Foreign keys with cascade rules.
   - `status`: `pending` | `processing` | `completed` | `failed`.
   - `attempts`: Retry counter (0 to 3).
   - `run_at`: Timestamp for exponential backoff scheduling.
3. **`facebook_pages`**:
   - `id` (TEXT PK): Facebook Page ID.
   - `name`: Human-readable label.
   - `access_token`: Page Access Token.
   - `token_expires_at`: Expiration date (NULL for never-expiring).
4. **`rss_sources`**:
   - `id` (TEXT PK): Source UUID.
   - `url`: Unique RSS URL.
   - `page_id`: Target Facebook Page.
   - `template_id`: Preferred template (`template-square-breaking`, etc.).
5. **`post_logs`**:
   - Records `fb_photo_id`, `fb_post_id`, `fb_comment_id`, `duration_ms`, `caption`, `comment`, and `rendered_image_path`.
6. **`settings`**:
   - Dynamic key-value overrides for cron interval, caps, and delays.

---

## 🔑 Meta Developer App & Page Access Token Guide

To publish images and comments to a Facebook Page, you need a **never-expiring Page Access Token**. Follow this official procedure:

### Step 1: Create a Meta Developer App
1. Go to [developers.facebook.com](https://developers.facebook.com/) and log in with the Facebook account that manages your Page.
2. Click **My Apps** ➔ **Create App**.
3. Select **Other** as the use case ➔ Click **Next**.
4. Select **Business** as the App Type ➔ Enter an App Name (e.g., `News Automation Engine`) ➔ Click **Create App**.

### Step 2: Grant Permissions in Graph API Explorer
1. Navigate to **Tools** ➔ **Graph API Explorer** ([developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)).
2. In the top right:
   - Select your **Meta App**.
   - Under **User or Page**, select **User Token**.
3. Under **Add a permission**, add these three mandatory permissions:
   - `pages_manage_posts` (allows posting photos and captions)
   - `pages_manage_engagement` (allows creating the first comment)
   - `pages_read_engagement` (allows reading post and comment status)
4. Click **Generate Access Token**. Approve the Facebook popup dialog giving access to your Page.

### Step 3: Convert to a 60-Day Long-Lived User Token
Run this HTTP request in your terminal or browser (replace placeholders with values from your App Settings ➔ Basic):
```bash
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id=YOUR_APP_ID&\
client_secret=YOUR_APP_SECRET&\
fb_exchange_token=SHORT_LIVED_USER_TOKEN"
```
The response returns a long-lived User Access Token valid for 60 days:
```json
{
  "access_token": "LONG_LIVED_USER_ACCESS_TOKEN",
  "token_type": "bearer"
}
```

### Step 4: Extract the Never-Expiring Page Access Token
Using the `LONG_LIVED_USER_ACCESS_TOKEN` from Step 3, query the `/me/accounts` endpoint:
```bash
curl -X GET "https://graph.facebook.com/v21.0/me/accounts?access_token=LONG_LIVED_USER_ACCESS_TOKEN"
```
Response:
```json
{
  "data": [
    {
      "name": "My News Portal",
      "id": "109876543210987",
      "access_token": "EAAB...NEVER_EXPIRING_PAGE_ACCESS_TOKEN..."
    }
  ]
}
```
> [!IMPORTANT]
> Because this Page Access Token was derived from a 60-day Long-Lived User Token, **it will NEVER expire** unless your Facebook password is changed or permissions are revoked. You can verify this by pasting the token into the **Access Token Debugger** (`developers.facebook.com/tools/debug/accesstoken`) where `Expires` will state `Never`.

---

## 🚀 Quickstart & Local Verification

### 1. Install Dependencies & Build
```bash
# Clone the repository
cd "d:/WEBSITES/Vercel/FB Automation"

# Install packages
npm install

# Build TypeScript to dist/
npm run build
```

### 2. Run Verification Tests Step-by-Step
Run the dedicated test suite for each phase:

```bash
# Phase 1: RSS Ingestion & Deduplication
npm run test:rss

# Phase 2: Playwright Image Renderer with Bangla Fonts
npm run test:renderer

# Phase 3: Facebook Graph API Client & Formatting
npm run test:facebook

# Phase 4: Persistent SQLite Queue & Backoff
npm run test:queue

# Phase 5 / Complete End-to-End Pipeline Dry-Run
npm run test:pipeline
```

### 3. Launch Platform in Dry-Run Mode
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Verify `DRY_RUN=true` in `.env`.
3. Start the application:
   ```bash
   npm run dev
   ```
4. Open the Web Dashboard in your browser:
   - URL: `http://localhost:3000`
   - User: `admin` (or any username)
   - Password: Value from `ADMIN_PASSWORD` in `.env` (Default: `SetYourStrongPasswordHere_12345!`)

---

## 🚢 Production Deployment on VPS (Docker)

### 1. Prerequisites on VPS
- Ubuntu 22.04 / 24.04 LTS or Debian 12
- Docker & Docker Compose (`apt install docker.io docker-compose-v2`)

### 2. Deployment Steps
```bash
# 1. Clone repository to VPS
git clone <your-repo-url> /opt/fb-automation
cd /opt/fb-automation

# 2. Configure production .env
cp .env.example .env
nano .env
# Set ADMIN_PASSWORD, DRY_RUN=false, TELEGRAM_BOT_TOKEN, etc.

# 3. Build and launch container in background
docker compose up -d --build

# 4. View real-time logs
docker compose logs -f news-automation
```

### 3. Caddy Reverse Proxy (Recommended for Free Auto-SSL)
Install Caddy on your VPS and place this in `/etc/caddy/Caddyfile`:
```caddy
news-bot.yourdomain.com {
    reverse_proxy localhost:3000
}
```
Reload Caddy:
```bash
sudo systemctl reload caddy
```
Your dashboard is now live and secured with HTTPS at `https://news-bot.yourdomain.com`.

---

## 🧪 Testing Plan & Safe Production Cutover

### Stage 1: Safe Dry-Run Validation
1. Keep `DRY_RUN=true` in `.env`.
2. Connect your Facebook Page ID and Page Access Token via the **Facebook Pages** tab.
3. Add your target RSS feed URL in the **RSS Sources** tab.
4. Click **Poll RSS Now**.
5. Observe the **Queue & Logs** tab:
   - Articles are ingested and ordered oldest first.
   - The Playwright renderer compiles the HTML template and renders a 1080x1080 PNG into `data/rendered/`.
   - Simulated Facebook publish and comment actions are logged with zero risk to live followers.

### Stage 2: Single-Item Live Test
1. Set `DRY_RUN=false` in `.env` (or via the **Settings** tab in the dashboard).
2. Set `MAX_POSTS_PER_HOUR=1` temporarily to ensure only 1 item can publish.
3. Trigger **Poll RSS Now**.
4. Check your Facebook Page:
   - The branded image is posted with the clean headline and hashtags.
   - Confirm **no links are present in the caption**.
   - Confirm the first comment appears within seconds: `"বিস্তারিত পড়ুন: <url>"`.
5. Once verified, adjust `MAX_POSTS_PER_HOUR=10` (or your preferred schedule).

---

## 🛡️ Reliability & Security Specifications

- **Rate Limit Safeguards**: Enforces configurable hourly caps (`MAX_POSTS_PER_HOUR`) per page.
- **Anti-Spam Jitter**: Inserts a randomized 30-60 second pause before publishing to prevent algorithmic throttling.
- **Graceful Image Fallback**: If Playwright template rendering fails, the worker seamlessly downloads the original article's image directly and publishes it, ensuring zero missed breaking news items.
- **Local Typography Isolation**: Bengali fonts are loaded directly from local TTF assets (`assets/fonts/`), guaranteeing that conjuncts (যুক্তবর্ণ) and modifiers render accurately with zero network lag or layout shifting.
- **Health Check Endpoint**: `/health` is exposed unauthenticated for container monitoring, Docker healthchecks, and uptime monitors.

