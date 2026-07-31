"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { TRPCClientError } from "@trpc/client";

import { trpc, unwrapWrite } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  const router = useRouter();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<AutosaveState>("idle");
  const editorApi = useRef<MarkdownEditorApi | null>(null);
  const knownUpdatedAt = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    trpc.doc.get
      .query({ id: docId })
      .then((d) => {
        setDoc(d);
        setTitle(d.title);
        knownUpdatedAt.current = d.updatedAt;
      })
      .catch((err) => {
        if (err instanceof TRPCClientError && err.data?.code === "NOT_FOUND") {
          setNotFound(true);
          return;
        }
        throw err;
      });
  }, [docId]);

  async function save(force = false) {
    if (!editorApi.current || status === "deleted") return;
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
      // Deleted out from under this open editor (CONTEXT.md §5.1.17) —
      // distinct from CONFLICT: there's nothing left to reload, so no
      // reload/overwrite choice, just stop autosaving from here on.
      if (err instanceof TRPCClientError && err.data?.code === "NOT_FOUND") {
        setStatus("deleted");
        return;
      }
      setStatus("idle");
      throw err;
    }
  }

  function scheduleSave() {
    if (status === "deleted") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  }

  async function removeDoc() {
    await trpc.doc.delete.mutate({ id: docId, expectedUpdatedAt: knownUpdatedAt.current ?? undefined });
    router.push(`/projects/${projectId}/docs`);
  }

  async function reloadLatest() {
    const fresh = await trpc.doc.get.query({ id: docId });
    setDoc(fresh);
    setTitle(fresh.title);
    knownUpdatedAt.current = fresh.updatedAt;
    await editorApi.current?.replaceMarkdown(fresh.content);
    setStatus("idle");
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">此文件不存在或已被刪除。</p>
        <Link href={`/projects/${projectId}/docs`} className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />
          Docs
        </Link>
      </div>
    );
  }

  if (!doc) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-3 px-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/projects/${projectId}/docs`}
          className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Docs
        </Link>
        <ConfirmDialog
          trigger={
            <Button size="icon" variant="ghost" className="size-6" aria-label="Delete doc">
              <Trash2 className="size-3.5" />
            </Button>
          }
          title={`Delete "${title || doc.title}"?`}
          description="This can't be undone."
          onConfirm={removeDoc}
        />
      </div>

      <AutosaveStatus status={status} onReloadLatest={() => void reloadLatest()} onForceSave={() => void save(true)} />

      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave();
        }}
        placeholder="Untitled"
        className="h-auto border-none bg-transparent py-0 pl-6 pr-0 font-heading text-4xl font-semibold focus-visible:ring-0 md:text-4xl"
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
