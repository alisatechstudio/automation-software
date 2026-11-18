# Multi-stage production Dockerfile for SportsClipBot
FROM node:20-bookworm-slim AS base

# Install system dependencies: FFmpeg, Chromaprint (fpcalc), system fonts & build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libchromaprint-tools \
    fonts-dejavu-core \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Enable Corepack and pnpm
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code and config
COPY tsconfig.json config.yaml ./
COPY src/ ./src/

# Build TypeScript
RUN pnpm build

# Ensure runtime directories
RUN mkdir -p /app/data/inbox /app/data/music /app/data/output /app/data/temp

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/status').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
