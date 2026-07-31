import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ProjectLabel } from "./task-types";

// Shared render for a label everywhere it shows up (Board card, Table row,
// List row, Detail modal, Overview settings) — a colored dot plus name,
// since the color itself is the only per-label styling.
export function LabelBadge({ label, onRemove }: { label: ProjectLabel; onRemove?: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1.5 pr-1">
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
      {label.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label.name}`}
          className="rounded-full hover:bg-muted-foreground/20"
        >
          <X className="size-3" />
        </button>
      )}
    </Badge>
  );
}
