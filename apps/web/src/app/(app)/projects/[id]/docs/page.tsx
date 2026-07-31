"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";

import { trpc, unwrapWrite } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Doc = { id: string; title: string; updatedAt: string };

// Flat list for now, nesting is a named future direction, not Phase 8
// scope (CONTEXT.md §5.1.11) — matches Doc's current schema exactly.
export default function ProjectDocsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);

  async function refresh() {
    setDocs(await trpc.doc.list.query({ projectId }));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [projectId]);

  // No title dialog (CONTEXT.md §5.1.17) — create a real "Untitled" doc
  // immediately and go straight into the editor, matching how Notion/
  // Google Docs/Confluence all handle "new document".
  async function createDoc() {
    const doc = unwrapWrite(await trpc.doc.create.mutate({ projectId, title: "Untitled", content: "" }));
    router.push(`/projects/${projectId}/docs/${doc.id}`);
  }

  async function removeDoc(doc: Doc) {
    await trpc.doc.delete.mutate({ id: doc.id, expectedUpdatedAt: doc.updatedAt });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Docs</h2>
        <Button size="sm" onClick={() => void createDoc()}>
          <Plus className="size-3.5" />
          New doc
        </Button>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No docs yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {docs.map((doc) => (
            <li key={doc.id} className="group flex cursor-pointer gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
              <Link href={`/projects/${projectId}/docs/${doc.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{doc.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {new Date(doc.updatedAt).toLocaleDateString()}
                </span>
              </Link>
              <ConfirmDialog
                trigger={
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 shrink-0 self-center opacity-0 group-hover:opacity-100"
                    aria-label={`Delete ${doc.title}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                }
                title={`Delete "${doc.title}"?`}
                description="This can't be undone."
                onConfirm={() => removeDoc(doc)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
