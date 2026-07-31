"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, X } from "lucide-react";

import { trpc, unwrapWrite } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DocAttributeDefinition, DocAttributeType } from "./doc-attribute-types";

export type DocAttributeValueRow = {
  id: string;
  definitionId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueBoolean: boolean | null;
  selectOptionId: string | null;
};

type CellValue = string | number | boolean | null;

// `valueDate` is date-only (CONTEXT.md §5.1.18), stored/transmitted as a
// "YYYY-MM-DD" string. Calendar hands back a local-midnight Date on
// select — converting through toISOString()/`new Date(isoString)` would
// shift by the viewer's UTC offset, so these read/write the date's local
// y/m/d components directly instead of going through UTC at any point.
function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function extractValue(type: DocAttributeType, row: DocAttributeValueRow | undefined): CellValue {
  if (!row) return null;
  switch (type) {
    case "text":
      return row.valueText;
    case "number":
      return row.valueNumber;
    case "date":
      return row.valueDate;
    case "checkbox":
      return row.valueBoolean;
    case "select":
      return row.selectOptionId;
  }
}

// Property panel for a doc's custom attributes (CONTEXT.md §5.1.18) — a
// row per project-defined DocAttributeDefinition, rendered with a
// type-appropriate control. Each edit saves immediately on commit (blur
// for text/number, on-change for select/date/checkbox), deliberately not
// funneled into the title/content editor's debounced save()/
// knownUpdatedAt lock (§5.1.16): setAttributeValue never touches
// Doc.updatedAt, so mixing the two locks would only create false
// conflicts. The parent page remounts this component (via `key={docId}`)
// on doc navigation instead of it tracking docId changes itself.
export function DocAttributePanel({
  projectId,
  docId,
  initialValues,
}: {
  projectId: string;
  docId: string;
  initialValues: DocAttributeValueRow[];
}) {
  const [definitions, setDefinitions] = useState<DocAttributeDefinition[]>([]);
  const [values, setValues] = useState<Record<string, CellValue>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    trpc.docAttribute.list.query({ projectId }).then((defs) => {
      const list = defs as DocAttributeDefinition[];
      setDefinitions(list);
      const map: Record<string, CellValue> = {};
      for (const def of list) {
        map[def.id] = extractValue(def.type, initialValues.find((r) => r.definitionId === def.id));
      }
      setValues(map);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function save(definitionId: string, value: CellValue) {
    setValues((prev) => ({ ...prev, [definitionId]: value }));
    unwrapWrite(await trpc.doc.setAttributeValue.mutate({ docId, definitionId, value }));
  }

  if (!loaded || definitions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4">
      {definitions.map((def) => (
        <div key={def.id} className="grid grid-cols-[8rem_1fr] items-center gap-3">
          <span className="truncate text-xs text-muted-foreground">{def.name}</span>
          <AttributeControl definition={def} value={values[def.id] ?? null} onSave={(v) => void save(def.id, v)} />
        </div>
      ))}
    </div>
  );
}

function AttributeControl({
  definition,
  value,
  onSave,
}: {
  definition: DocAttributeDefinition;
  value: CellValue;
  onSave: (value: CellValue) => void;
}) {
  switch (definition.type) {
    case "text":
      return (
        <Input
          defaultValue={(value as string | null) ?? ""}
          onBlur={(e) => onSave(e.target.value.trim() === "" ? null : e.target.value)}
          className="h-7"
        />
      );
    case "number":
      return (
        <Input
          type="number"
          defaultValue={value === null ? "" : String(value)}
          onBlur={(e) => onSave(e.target.value === "" ? null : Number(e.target.value))}
          className="h-7"
        />
      );
    case "date": {
      const dateValue = value as string | null;
      const selected = dateValue ? parseDateOnly(dateValue) : undefined;
      return (
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-40 justify-start font-normal">
                <CalendarIcon className="size-3.5 text-muted-foreground" />
                {selected ? selected.toLocaleDateString() : <span className="text-muted-foreground">—</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selected}
                onSelect={(date) => onSave(date ? formatDateOnly(date) : null)}
              />
            </PopoverContent>
          </Popover>
          {selected && (
            <Button size="icon-sm" variant="ghost" onClick={() => onSave(null)} aria-label="Clear">
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      );
    }
    case "checkbox":
      return (
        <Checkbox checked={value === true} onCheckedChange={(checked) => onSave(checked === true)} />
      );
    case "select":
      return (
        <div className="flex items-center gap-1">
          <Select value={(value as string | null) ?? undefined} onValueChange={(v) => onSave(v)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {definition.options.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />
                    {opt.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {value !== null && (
            <Button size="icon-sm" variant="ghost" onClick={() => onSave(null)} aria-label="Clear">
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      );
  }
}
