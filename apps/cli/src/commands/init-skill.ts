import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import type { Command } from "commander";

const currentDir = dirname(fileURLToPath(import.meta.url));
const SKILL_SOURCE = join(currentDir, "..", "..", "skill", "SKILL.md");

// CONTEXT.md §5.3: Agent Skills is a cross-vendor open standard — one
// file, written unmodified to each tool's discovery path, instead of
// a per-agent adapter. `.agents/skills/` is scanned directly by Codex
// CLI and aliased by Gemini CLI; `~/.claude/skills/` is Claude Code's
// own convention and isn't aliased to the other two.
function destinations(): string[] {
  return [
    join(process.cwd(), ".agents", "skills", "padock", "SKILL.md"),
    join(homedir(), ".agents", "skills", "padock", "SKILL.md"),
    join(homedir(), ".claude", "skills", "padock", "SKILL.md"),
  ];
}

export function registerInitSkillCommand(program: Command): void {
  program.command("init-skill").action(() => {
    const content = readFileSync(SKILL_SOURCE, "utf-8");
    for (const dest of destinations()) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, content);
      console.log(`Wrote ${dest}`);
    }
  });
}
