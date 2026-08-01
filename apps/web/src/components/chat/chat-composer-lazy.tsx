"use client";

import dynamic from "next/dynamic";

export type { ChatComposerProps } from "./chat-composer";

// ssr: false is load-bearing — tiptap (ProseMirror underneath) touches
// window/document on init, same crash risk under Next's SSR pass as
// BlockNote (markdown-editor-view-lazy.tsx's own comment).
const ChatComposer = dynamic(() => import("./chat-composer"), {
  ssr: false,
  loading: () => <div className="h-[52px] border-t bg-muted/40" />,
});

export default ChatComposer;
