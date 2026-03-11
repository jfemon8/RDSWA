# =============================================================================
# RDSWA Server — Multi-stage production build
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Builder
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./

# Copy workspace package.json files (needed for npm ci --workspaces)
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install ALL dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY shared/ shared/
COPY server/ server/

# Build shared first (server depends on it), then server
RUN npm run build --workspace=shared && npm run build --workspace=server

# Prune dev dependencies for a leaner production image
RUN npm prune --production

# ---------------------------------------------------------------------------
# Stage 2: Runner
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only what is needed to run the server
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/server/dist/ ./server/dist/
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/server/node_modules/ ./server/node_modules/
COPY --from=builder /app/shared/dist/ ./shared/dist/
COPY --from=builder /app/shared/package.json ./shared/

# Switch to non-root user
USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "server/dist/app.js"]
