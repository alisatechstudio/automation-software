# ==============================================================================
# Multi-stage Dockerfile for News-to-Facebook Automation Platform
# Bundles Node.js, Playwright Chromium, and local Bengali typography engines
# ==============================================================================

# Stage 1: Build TypeScript source
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Stage 2: Production runtime with headless Chromium dependencies
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install system dependencies required for headless Chromium & font rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-core \
    libnss3 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    ca-certificates \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Copy production dependencies & built assets
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY src/templates ./dist/templates
COPY src/db/migrations ./dist/db/migrations
COPY assets ./assets

# Create volume mount points for persistent database and rendered images
RUN mkdir -p /app/data/rendered

EXPOSE 3000

# Use dumb-init to properly handle PID 1 signals
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]

