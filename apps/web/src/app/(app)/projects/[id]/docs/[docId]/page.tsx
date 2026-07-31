"use client";

import dynamic from "next/dynamic";

// ssr: false is load-bearing here — see doc-editor.tsx's top comment.
const DocEditor = dynamic(() => import("./doc-editor"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading…</p>,
});

export default function DocDetailPage() {
  return <DocEditor />;
}
