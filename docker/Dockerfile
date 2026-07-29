# Multi-role image for Padock's modular monolith (CONTEXT.md §5.1): one
# codebase, one image, different CMD per process role (app/realtime/
# worker). Not optimized for image size yet (no standalone Next.js
# output, no turbo-prune trimming) — Phase 0 goal is a working
# docker-compose stack; trim this once it's a real bottleneck.

FROM node:22-bookworm-slim AS base
# Prisma's engine needs libssl to detect the right OpenSSL build;
# bookworm-slim doesn't ship it by default.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @padock/db exec prisma generate
RUN pnpm --filter @padock/web build

FROM build AS app
ENV NODE_ENV=production
EXPOSE 3000
# db push (not migrate — no migration history yet, see CONTEXT.md §7)
# runs on every boot; fine for Phase 0's single-instance self-host.
CMD ["sh", "-c", "pnpm --filter @padock/db exec prisma db push --accept-data-loss && pnpm --filter @padock/web start"]

FROM build AS realtime
ENV NODE_ENV=production
EXPOSE 3001
CMD ["pnpm", "--filter", "@padock/realtime", "start"]

FROM build AS worker
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@padock/worker", "start"]
