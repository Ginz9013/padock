"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

export type UserMentionItem = { kind: "user"; id: string; name: string; email: string; image: string | null };
export type RefMentionItem = { kind: "task" | "doc"; id: string; title: string; projectId: string; projectName: string };
export type MentionItem = UserMentionItem | RefMentionItem;

export type MentionSuggestionListRef = { onKeyDown: (props: { event: KeyboardEvent }) => boolean };

// Shared dropdown for both the "@" (flat user list) and "#" (grouped
// Tasks/Docs list) mention pickers (CONTEXT.md §5.1.20) — mounted
// imperatively by chat-composer.tsx's tiptap suggestion.render()
// lifecycle via ReactRenderer, not as a normal React child, so
// keyboard handling is exposed through a ref instead of props.
export const MentionSuggestionList = forwardRef<
  MentionSuggestionListRef,
  { items: MentionItem[]; command: (item: MentionItem) => void; crossProject?: boolean }
>(function MentionSuggestionList({ items, command, crossProject }, ref) {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (items.length === 0) return event.key === "Escape";
      if (event.key === "ArrowDown") {
        setSelected((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selected];
        if (item) command(item);
        return true;
      }
      if (event.key === "Escape") return true;
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md">No matches</div>
    );
  }

  const groups =
    items[0]?.kind === "user"
      ? [{ label: null as string | null, items }]
      : [
          { label: "Tasks", items: items.filter((i) => i.kind === "task") },
          { label: "Docs", items: items.filter((i) => i.kind === "doc") },
        ].filter((g) => g.items.length > 0);

  let index = -1;
  return (
    <div className="max-h-72 w-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
      {groups.map((group) => (
        <div key={group.label ?? "flat"}>
          {group.label && (
            <div className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground uppercase">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            index += 1;
            const active = index === selected;
            return (
              <button
                key={`${item.kind}:${item.id}`}
                onClick={() => command(item)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  active && "bg-accent",
                )}
              >
                {item.kind === "user" ? (
                  <>
                    <Avatar userId={item.id} name={item.name} image={item.image} size={6} />
                    <span className="truncate">{item.name}</span>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    {crossProject && (
                      <span className="shrink-0 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {item.projectName}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
