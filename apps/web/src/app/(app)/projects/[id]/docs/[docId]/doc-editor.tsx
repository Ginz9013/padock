"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TRPCClientError } from "@trpc/client";

import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";

import { trpc, unwrapWrite } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Doc = { id: string; title: string; content: string; updatedAt: string };

const AUTOSAVE_DELAY_MS = 1500;

// CONTEXT.md §5.1.16: BlockNote is a view/edit layer only — Doc storage
// stays plain Markdown (§5.1.7). Markdown<->blocks conversion happens
// once on load and once per debounced autosave here, never per
// keystroke and never in the API, which still only ever sees `content`.
//
// Rendered via next/dynamic({ ssr: false }) from page.tsx — BlockNote
// (ProseMirror underneath) touches `window`/`document` on init, which
// crashes Next's server-render pass even though this is already a
// "use client" component (App Router still SSRs the initial HTML for
// client components unless SSR is explicitly disabled for them).
export default function DocEditor() {
  const { id: projectId, docId } = useParams<{ id: string; docId: string }>();
  const editor = useCreateBlockNote();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "conflict">("idle");
  // The `updatedAt` this tab last saw — sent back as the optimistic-lock
  // token so a concurrent write (another tab, or an agent via CLI/MCP)
  // can't be silently overwritten.
  const knownUpdatedAt = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void trpc.doc.get.query({ id: docId }).then(async (d) => {
      setDoc(d);
      setTitle(d.title);
      knownUpdatedAt.current = d.updatedAt;
      const blocks = await editor.tryParseMarkdownToBlocks(d.content);
      editor.replaceBlocks(editor.document, blocks);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  async function save(force = false) {
    setStatus("saving");
    try {
      const content = await editor.blocksToMarkdownLossy();
      const updated = unwrapWrite(
        await trpc.doc.update.mutate({
          id: docId,
          title,
          content,
          expectedUpdatedAt: force ? undefined : (knownUpdatedAt.current ?? undefined),
        }),
      );
      knownUpdatedAt.current = updated.updatedAt;
      setStatus("saved");
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === "CONFLICT") {
        setStatus("conflict");
        return;
      }
      setStatus("idle");
      throw err;
    }
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  }

  async function reloadLatest() {
    const fresh = await trpc.doc.get.query({ id: docId });
    setDoc(fresh);
    setTitle(fresh.title);
    knownUpdatedAt.current = fresh.updatedAt;
    const blocks = await editor.tryParseMarkdownToBlocks(fresh.content);
    editor.replaceBlocks(editor.document, blocks);
    setStatus("idle");
  }

  if (!doc) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href={`/projects/${projectId}/docs`}
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Docs
      </Link>

      {status === "conflict" && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <span>這份文件已被其他來源更新。</span>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => void reloadLatest()}>
              重新載入最新版本
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void save(true)}>
              強制覆蓋
            </Button>
          </div>
        </div>
      )}

      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave();
        }}
        className="font-heading text-lg font-semibold"
      />

      <BlockNoteView editor={editor} onChange={scheduleSave} className="min-h-[60vh]" />

      <div className="text-xs text-muted-foreground">
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved"}
      </div>
    </div>
  );
}
