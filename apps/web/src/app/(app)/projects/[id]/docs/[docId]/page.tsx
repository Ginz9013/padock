"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TRPCClientError } from "@trpc/client";

import { trpc, unwrapWrite } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import MarkdownEditorView, { type MarkdownEditorApi } from "@/components/markdown-editor-view-lazy";
import { AutosaveStatus, type AutosaveState } from "@/components/autosave-status";

type Doc = { id: string; title: string; content: string; updatedAt: string };

const AUTOSAVE_DELAY_MS = 1500;

// CONTEXT.md §5.1.16: BlockNote is a view/edit layer only — Doc storage
// stays plain Markdown (§5.1.7). Title and content are bundled into one
// debounced save sharing one optimistic-lock ref, so an in-between title
// edit can never make the content editor's next autosave spuriously
// conflict against itself.
export default function DocDetailPage() {
  const { id: projectId, docId } = useParams<{ id: string; docId: string }>();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<AutosaveState>("idle");
  const editorApi = useRef<MarkdownEditorApi | null>(null);
  const knownUpdatedAt = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void trpc.doc.get.query({ id: docId }).then((d) => {
      setDoc(d);
      setTitle(d.title);
      knownUpdatedAt.current = d.updatedAt;
    });
  }, [docId]);

  async function save(force = false) {
    if (!editorApi.current) return;
    setStatus("saving");
    try {
      const content = await editorApi.current.getMarkdown();
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
    await editorApi.current?.replaceMarkdown(fresh.content);
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

      <AutosaveStatus status={status} onReloadLatest={() => void reloadLatest()} onForceSave={() => void save(true)} />

      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave();
        }}
        className="font-heading text-lg font-semibold"
      />

      <MarkdownEditorView
        initialContent={doc.content}
        onChange={scheduleSave}
        onReady={(api) => {
          editorApi.current = api;
        }}
        className="min-h-[60vh]"
      />
    </div>
  );
}
