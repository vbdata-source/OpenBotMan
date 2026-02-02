# OpenBotMan - Multi-Agent Orchestration Platform
# Production Dockerfile

# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/knowledge-base/package.json ./packages/knowledge-base/
COPY packages/orchestrator/package.json ./packages/orchestrator/
COPY packages/channels/teams/package.json ./packages/channels/teams/
COPY packages/channels/telegram/package.json ./packages/channels/telegram/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build all packages
RUN pnpm build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    curl \
    && rm -rf /var/cache/apk/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

# Create non-root user
RUN addgroup -g 1001 openbotman && \
    adduser -u 1001 -G openbotman -s /bin/sh -D openbotman

# Copy built files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Copy config templates
COPY --from=builder /app/config.example.yaml ./config.example.yaml

# Create data directories
RUN mkdir -p /data/knowledge /data/logs /data/sessions && \
    chown -R openbotman:openbotman /data /app

# Switch to non-root user
USER openbotman

# Environment
ENV NODE_ENV=production
ENV DATA_PATH=/data
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose ports
EXPOSE 8080 3978

# Default command
CMD ["node", "packages/orchestrator/dist/index.js"]
