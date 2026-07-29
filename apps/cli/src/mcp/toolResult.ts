import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Mirrors client.ts's run() (the CLI's own try/catch), but returns a
// CallToolResult instead of printing/exiting — a failed call has to
// come back as `isError: true`, not throw and kill the whole
// long-running MCP server process.
export async function toolResult(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    // err instanceof Error covers TRPCClientError and plain Error
    // (e.g. actions/chat.ts's validation throw) — .message avoids a
    // doubled "Error: Error: ..." prefix (Error#toString() already
    // includes one).
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
}
