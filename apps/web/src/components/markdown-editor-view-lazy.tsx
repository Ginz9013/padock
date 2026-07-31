"use client";

import dynamic from "next/dynamic";

export type { MarkdownEditorApi } from "./markdown-editor-view";

// ssr: false is load-bearing — see markdown-editor-view.tsx's top comment.
const MarkdownEditorView = dynamic(() => import("./markdown-editor-view"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading…</p>,
});

export default MarkdownEditorView;
