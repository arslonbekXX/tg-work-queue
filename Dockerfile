FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
# tsconfig.json ships too: Bun resolves its path aliases at runtime.
COPY package.json tsconfig.json ./
COPY src ./src

# A long-polling bot exposes nothing to probe, so the heartbeat file the API
# transformer touches after every successful getUpdates stands in for one.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD bun run src/app/healthcheck.ts

CMD ["bun", "run", "src/main.ts"]
