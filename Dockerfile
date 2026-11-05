# ==============================================================================
# Multi-stage Dockerfile for News-to-Facebook Automation Platform
# Node.js 22 + Headless Chromium + Local Bengali typography engines
# ==============================================================================

# Stage 1: Build TypeScript source & compile native modules
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install build tools required for native C++ addons (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Remove development dependencies so node_modules is lightweight and production-ready
RUN npm prune --production

# Stage 2: Production runtime with headless Chromium dependencies
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV CHROMIUM_PATH=/usr/bin/chromium

# Install Chromium and required font rendering libraries
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

# Copy production node_modules from builder (no compilation needed in runner)
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY --from=builder /app/dist ./dist
COPY src/templates ./dist/templates
COPY src/db/migrations ./dist/db/migrations
COPY assets ./assets

# Create volume mount points for persistent database and rendered images
RUN mkdir -p /app/data/rendered

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
