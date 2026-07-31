import { Button } from "@/components/ui/button";

export type AutosaveState = "idle" | "saving" | "saved" | "conflict" | "deleted";

// Small inline light for the common-path states — lives next to the
// title/controls. Lights up green with a ripple only while a save is
// in flight, and disappears entirely once it succeeds; failure states
// (conflict/deleted) are surfaced separately by AutosaveStatus below
// since they need explanatory text and action buttons, not a dot.
export function AutosaveIndicator({ status }: { status: AutosaveState }) {
  if (status !== "saving") return null;
  return (
    <span className="relative flex size-2" title="Saving…">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
  );
}

// Shared by every entity using the debounce-autosave + optimistic-lock
// pattern (CONTEXT.md §5.1.16 — Doc, and now Task's description). On
// conflict, neither side's edits are ever discarded without the user
// explicitly choosing reload-vs-overwrite.
export function AutosaveStatus({
  status,
  onReloadLatest,
  onForceSave,
}: {
  status: AutosaveState;
  onReloadLatest: () => void;
  onForceSave: () => void;
}) {
  if (status === "conflict") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
        <span>這份內容已被其他來源更新。</span>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={onReloadLatest}>
            重新載入最新版本
          </Button>
          <Button size="sm" variant="destructive" onClick={onForceSave}>
            強制覆蓋
          </Button>
        </div>
      </div>
    );
  }
  // Distinct from "conflict" (CONTEXT.md §5.1.17) — there's nothing left
  // to reload once the row is actually gone, so no reload/overwrite
  // choice is offered, just the fact that further edits won't be saved.
  if (status === "deleted") {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
        此內容已被刪除，你的變更未儲存。
      </div>
    );
  }
  return null;
}
