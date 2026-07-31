"use client";

import { useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

export type MarkdownEditorApi = {
  getMarkdown: () => Promise<string>;
  replaceMarkdown: (markdown: string) => Promise<void>;
};

// CONTEXT.md §5.1.16: BlockNote is a view/edit layer only — the caller's
// `content` stays plain Markdown before and after this component. This
// is a pure controlled view: it owns no debounce/save/conflict state
// (that's caller-specific — e.g. the Doc page bundles title+content into
// one save, the Task modal bundles title+description into another), it
// just hands the caller a `getMarkdown`/`replaceMarkdown` API via
// `onReady` once the editor has parsed its initial content.
//
// Always import this via markdown-editor-view-lazy.tsx, never directly —
// BlockNote (ProseMirror underneath) touches window/document on init,
// which crashes Next's server-render pass even for a "use client"
// component (App Router still SSRs the initial HTML for client
// components unless SSR is explicitly disabled for them).
export default function MarkdownEditorView({
  initialContent,
  onChange,
  onReady,
  className,
}: {
  initialContent: string;
  onChange: () => void;
  onReady: (api: MarkdownEditorApi) => void;
  className?: string;
}) {
  const editor = useCreateBlockNote();

  useEffect(() => {
    // tryParseMarkdownToBlocks/blocksToMarkdownLossy are synchronous in
    // the installed @blocknote/core version — wrapped in Promises here
    // anyway so the public api (and any future async version) stays the
    // same shape for callers.
    editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(initialContent));
    onReady({
      getMarkdown: () => Promise.resolve(editor.blocksToMarkdownLossy()),
      replaceMarkdown: (markdown) => {
        editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(markdown));
        return Promise.resolve();
      },
    });
    // Load the caller's initial value once — after that the editor owns
    // its own in-memory state until a save/reload replaces it via the api.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <BlockNoteView editor={editor} onChange={onChange} className={className} />;
}
