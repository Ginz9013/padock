import { defineConfig } from "prisma/config";

// DATABASE_URL is expected to already be present in process.env — the root
// `pnpm dev`/`pnpm db:*` scripts load repo-root `.env` via `dotenv-cli`
// before invoking this package, so Prisma and every app share one source.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
