import type { Command } from "commander";
import { startMcpServer } from "../mcp/server.ts";

export function registerMcpCommand(program: Command): void {
  const mcp = program.command("mcp");

  mcp
    .command("serve")
    .description("Start an MCP server (stdio) exposing the padock command grammar as tools.")
    .action(async () => {
      await startMcpServer();
    });
}
