export type MentionToken = { type: "user" | "task" | "doc"; id: string };
export type ContentSegment = { kind: "text"; text: string } | { kind: "mention"; token: MentionToken };

const TOKEN_RE = /(@|#)\[(user|task|doc):([^\]\s]+)\]/g;

// Mirrors packages/api/src/mentions.ts's @[user:id]/#[task:id]/#[doc:id]
// grammar (kept manually in sync, not imported — packages/api pulls in
// server-only deps that shouldn't reach the client bundle). Splits raw
// ChatMessage.content into renderable text/mention segments.
export function segmentContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(TOKEN_RE)) {
    const [full, trigger, type, id] = match;
    if (!trigger || !type || !id || match.index === undefined) continue;
    if ((trigger === "@") !== (type === "user")) continue;
    if (match.index > lastIndex) {
      segments.push({ kind: "text", text: content.slice(lastIndex, match.index) });
    }
    segments.push({ kind: "mention", token: { type: type as MentionToken["type"], id } });
    lastIndex = match.index + full.length;
  }
  if (lastIndex < content.length) {
    segments.push({ kind: "text", text: content.slice(lastIndex) });
  }
  return segments;
}

// Cheap pre-check so the realtime per-message resolve call (chat-thread.tsx)
// only fires for messages that could plausibly contain a mention, instead
// of on every single incoming chat message in a busy channel.
export function mightContainMention(content: string): boolean {
  return content.includes("@[") || content.includes("#[");
}
