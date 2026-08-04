"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ConversationContext } from "@padock/api";
import {
  MentionSuggestionList,
  type MentionItem,
  type MentionSuggestionListRef,
} from "./mention-suggestion-list";

// One tiptap Node type per trigger (§5.1.20's "@" for people, "#" for
// tasks+docs) — kept as two separate extended Mention nodes rather than
// one node with a multi-trigger `suggestions` array, so each has its
// own attrs/serialization without a runtime char check.
const UserMention = Mention.extend({ name: "userMention" }).configure({
  renderText: ({ node }) => `@[user:${node.attrs.id as string}]`,
  renderHTML: ({ node }) => [
    "span",
    { class: "rounded bg-primary/10 px-1 py-0.5 text-primary" },
    `@${(node.attrs.label as string) ?? node.attrs.id}`,
  ],
});

const RefMention = Mention.extend({
  name: "refMention",
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: {
        default: "task",
        parseHTML: (el) => el.getAttribute("data-kind"),
        renderHTML: (attrs) => ({ "data-kind": attrs.kind as string }),
      },
    };
  },
}).configure({
  renderText: ({ node }) => `#[${node.attrs.kind as string}:${node.attrs.id as string}]`,
  renderHTML: ({ node }) => [
    "span",
    { class: "rounded bg-muted px-1 py-0.5 text-foreground/80", "data-kind": node.attrs.kind as string },
    `#${(node.attrs.label as string) ?? node.attrs.id}`,
  ],
});

// Shared suggestion.render() lifecycle for both triggers — mounts
// MentionSuggestionList via ReactRenderer and hands positioning off to
// @tiptap/suggestion's own managed `mount()` (Floating UI under the
// hood), so no manual computePosition/autoUpdate wiring is needed here.
// `getCrossProject` reads a ref the "#" items() closure updates once its
// search response resolves — the picker's project-name badge needs that
// flag, but SuggestionProps carries only `items`, so it travels
// alongside via the ref instead of being smuggled onto the items array.
function makeSuggestionRender(getCrossProject?: () => boolean): SuggestionOptions["render"] {
  return () => {
    let component: ReactRenderer<
      MentionSuggestionListRef,
      { items: MentionItem[]; command: (item: MentionItem) => void; crossProject?: boolean }
    >;
    let unmount: (() => void) | undefined;

    return {
      onStart: (props: SuggestionProps<MentionItem>) => {
        component = new ReactRenderer(MentionSuggestionList, {
          props: { items: props.items, command: props.command, crossProject: getCrossProject?.() },
          editor: props.editor,
        });
        unmount = props.mount(component.element);
      },
      onUpdate: (props: SuggestionProps<MentionItem>) => {
        component.updateProps({ items: props.items, command: props.command, crossProject: getCrossProject?.() });
      },
      onKeyDown: (props: SuggestionKeyDownProps) => component.ref?.onKeyDown(props) ?? false,
      onExit: () => {
        unmount?.();
        component.destroy();
      },
    };
  };
}

// A message picked via the message list's "Quote" hover action (§5.1.23)
// — the composer only ever displays this, it doesn't fetch/resolve it.
export type QuotedMessagePreview = { id: string; senderName: string; content: string };

export type ChatComposerProps = {
  context: ConversationContext;
  onSend: (content: string, quotedMessageId?: string) => Promise<void>;
  onFocus?: () => void;
  placeholder?: string;
  quotedMessage?: QuotedMessagePreview | null;
  onCancelQuote?: () => void;
};

export default function ChatComposer({
  context,
  onSend,
  onFocus,
  placeholder,
  quotedMessage,
  onCancelQuote,
}: ChatComposerProps) {
  const [sending, setSending] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [sendShortcutLabel, setSendShortcutLabel] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSendShortcutLabel("⌘");
    }
  }, []);

  // Search/candidate queries need the current conversation context —
  // kept in a ref so the suggestion items()/command closures (captured
  // once at editor creation) always read the latest value without
  // forcing the editor itself to be recreated on every context change.
  // Written in an effect, not during render, since these closures only
  // ever read `.current` later, from tiptap's own async/event-driven
  // suggestion callbacks — never synchronously during this render.
  const contextRef = useRef(context);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);
  const crossProjectRef = useRef(false);
  const sendRef = useRef<() => void>(() => {});

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      // contextRef.current is only ever read inside items()/command,
      // invoked later by tiptap's suggestion plugin in response to
      // typing/selection, never synchronously while this useMemo
      // factory itself runs.
      // eslint-disable-next-line react-hooks/refs
      UserMention.configure({
        suggestion: {
          char: "@",
          items: async ({ query }) => {
            const candidates = await trpc.mention.userCandidates.query({ context: contextRef.current });
            const q = query.trim().toLowerCase();
            const filtered = q
              ? candidates.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
              : candidates;
            return filtered
              .slice(0, 8)
              .map((c): MentionItem => ({ kind: "user", id: c.id, name: c.name, email: c.email, image: c.image }));
          },
          command: ({ editor, range, props }) => {
            const item = props as Extract<MentionItem, { kind: "user" }>;
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: "userMention", attrs: { id: item.id, label: item.name } },
                { type: "text", text: " " },
              ])
              .run();
          },
          render: makeSuggestionRender(),
        } satisfies Partial<SuggestionOptions<MentionItem>>,
      }),
      // Same as UserMention above; contextRef/crossProjectRef are only
      // read from tiptap's own async/event-driven callbacks, not during
      // this render.
      // eslint-disable-next-line react-hooks/refs
      RefMention.configure({
        suggestion: {
          char: "#",
          items: async ({ query }) => {
            if (!query.trim()) return [];
            const result = await trpc.mention.search.query({ context: contextRef.current, query });
            crossProjectRef.current = result.crossProject;
            return [
              ...result.tasks.map(
                (t): MentionItem => ({
                  kind: "task",
                  id: t.id,
                  title: t.title,
                  projectId: t.projectId,
                  projectName: t.projectName,
                }),
              ),
              ...result.docs.map(
                (d): MentionItem => ({
                  kind: "doc",
                  id: d.id,
                  title: d.title,
                  projectId: d.projectId,
                  projectName: d.projectName,
                }),
              ),
            ];
          },
          command: ({ editor, range, props }) => {
            const item = props as Extract<MentionItem, { kind: "task" | "doc" }>;
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: "refMention", attrs: { id: item.id, label: item.title, kind: item.kind } },
                { type: "text", text: " " },
              ])
              .run();
          },
          // crossProjectRef is read inside the render() lifecycle's
          // onStart/onUpdate, which tiptap invokes when the popup
          // opens/updates, not during this render.
          // eslint-disable-next-line react-hooks/refs
          render: makeSuggestionRender(() => crossProjectRef.current),
        } satisfies Partial<SuggestionOptions<MentionItem>>,
      }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "min-h-9 py-2 px-2.5 text-sm focus:outline-none whitespace-pre-wrap" },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          sendRef.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => setIsEmpty(e.isEmpty),
    onFocus: () => onFocus?.(),
  });

  async function handleSend() {
    if (!editor || sending) return;
    const content = editor.getText({ blockSeparator: "\n" }).trim();
    if (!content) return;
    setSending(true);
    try {
      await onSend(content, quotedMessage?.id);
      editor.commands.clearContent();
      setIsEmpty(true);
      onCancelQuote?.();
    } finally {
      setSending(false);
    }
  }
  // Written in an effect for the same reason as contextRef above —
  // handleKeyDown only ever calls sendRef.current() from a real keydown
  // event, never during render.
  useEffect(() => {
    sendRef.current = handleSend;
  });

  return (
    <div className="border-t">
      {quotedMessage && (
        <div className="flex items-start gap-2 border-b bg-muted/40 px-3 py-2">
          <div className="min-w-0 flex-1 border-l-2 pl-2 text-xs">
            <p className="font-medium">{quotedMessage.senderName}</p>
            <p className="truncate text-muted-foreground">{quotedMessage.content}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCancelQuote}
            aria-label="Cancel quote"
            className="shrink-0"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2 px-3 pt-3 pb-2">
        <div className="relative min-h-9 flex-1 rounded-lg bg-muted">
          {isEmpty && (
            <p className="pointer-events-none absolute top-2 left-2.5 text-sm text-muted-foreground">
              {placeholder ?? `Write a message… (${sendShortcutLabel}+Enter to send)`}
            </p>
          )}
          <EditorContent editor={editor} className={cn("[&_.tiptap]:min-h-9")} />
        </div>
        <Button onClick={handleSend} disabled={sending || isEmpty}>
          Send
        </Button>
      </div>
    </div>
  );
}
