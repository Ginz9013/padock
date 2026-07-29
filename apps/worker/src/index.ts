import { Worker, type ConnectionOptions } from "bullmq";
import { prisma } from "@padock/db";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const url = new URL(REDIS_URL);

// BullMQ requires this when given its own Redis connection options.
const connection: ConnectionOptions = {
  host: url.hostname,
  port: Number(url.port || 6379),
  maxRetriesPerRequest: null,
};

// No real jobs yet (Phase 1+) — this just proves the worker process
// role boots, connects to Redis, and can reach the shared Postgres via
// @padock/db, per CONTEXT.md §9 Phase 0.
const worker = new Worker(
  "padock",
  async (job) => {
    if (job.name === "health-check") {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    }
  },
  { connection },
);

worker.on("ready", () => {
  console.log("[worker] ready, listening on queue 'padock'");
});

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} (${job.name}) completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed`, err);
});
