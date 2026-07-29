#!/usr/bin/env node
// Runs src/index.ts directly via tsx — no build step, same approach
// apps/realtime/apps/worker use for their "dev" scripts, just wired up
// as an actual executable here instead of an npm script.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const tsxCli = require.resolve("tsx/cli");
const entry = path.join(__dirname, "..", "src", "index.ts");

const result = spawnSync(process.execPath, [tsxCli, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
