export type MentionToken = { type: "user" | "task" | "doc"; id: string };

const TOKEN_RE = /(@|#)\[(user|task|doc):([^\]\s]+)\]/g;

// Extracts and dedupes {type,id} tokens from ChatMessage.content
// (CONTEXT.md §5.1.20's @[user:id]/#[task:id]/#[doc:id] grammar).
// Rejects a trigger/type mismatch (e.g. a hand-crafted "#[user:x]") —
// content is untrusted input, not just our own composer's output.
export function parseMentions(content: string): MentionToken[] {
  const seen = new Set<string>();
  const tokens: MentionToken[] = [];
  for (const [, trigger, type, id] of content.matchAll(TOKEN_RE)) {
    if (!trigger || !type || !id) continue; // regex always captures all three when matched; guards noUncheckedIndexedAccess
    if ((trigger === "@") !== (type === "user")) continue;
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push({ type: type as MentionToken["type"], id });
  }
  return tokens;
}
