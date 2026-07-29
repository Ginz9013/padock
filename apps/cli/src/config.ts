import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface PadockConfig {
  serverUrl: string;
  apiKey: string;
}

const CONFIG_DIR = join(homedir(), ".config", "padock");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function readConfig(): PadockConfig {
  if (!existsSync(CONFIG_PATH)) {
    console.error("Not logged in. Run `padock login --token=<key>` first.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

export function writeConfig(config: PadockConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
