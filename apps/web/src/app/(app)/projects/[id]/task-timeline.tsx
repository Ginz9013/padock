"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PRIORITY_LABEL } from "./task-types";
import type { Task, TaskPriority } from "./task-types";

const MS_PER_DAY = 86_400_000;
const DAY_WIDTH = 32;
const SIDEBAR_WIDTH = 192;

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgent: "bg-destructive",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  none: "bg-muted-foreground/40",
};

function shortDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

// Gantt-style layout (Plane's Timeline is the reference) — view-only this
// round, no drag/resize. Only tasks with *both* startDate and endDate get
// a bar; anything missing a date range simply doesn't appear here (same
// call as Calendar's "no due date, no cell").
export function TaskTimeline({ tasks }: { tasks: Task[] }) {
  const scheduled = tasks.filter((t) => t.startDate && t.endDate);

  if (scheduled.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-md border">
        <p className="text-xs text-muted-foreground">No tasks have both a start and end date yet.</p>
      </div>
    );
  }

  const starts = scheduled.map((t) => new Date(t.startDate!).getTime());
  const ends = scheduled.map((t) => new Date(t.endDate!).getTime());
  const rangeStartMs = Math.min(...starts);
  const rangeEndMs = Math.max(...ends);
  const totalDays = Math.round((rangeEndMs - rangeStartMs) / MS_PER_DAY) + 1;
  const days = Array.from({ length: totalDays }, (_, i) => new Date(rangeStartMs + i * MS_PER_DAY));

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <p className="shrink-0 px-1 text-sm font-medium">
          {shortDate(new Date(rangeStartMs))} – {shortDate(new Date(rangeEndMs))}
        </p>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          <div style={{ width: SIDEBAR_WIDTH + totalDays * DAY_WIDTH }}>
            <div className="flex">
              <div
                className="sticky left-0 top-0 z-20 h-8 shrink-0 border-r border-b bg-background"
                style={{ width: SIDEBAR_WIDTH }}
              />
              {days.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    "sticky top-0 z-10 flex h-8 shrink-0 items-center justify-center border-b bg-background text-[10px] text-muted-foreground",
                    day.getUTCDate() === 1 && "border-l-2 border-l-foreground/20",
                  )}
                  style={{ width: DAY_WIDTH }}
                >
                  {day.getUTCDate()}
                </div>
              ))}
            </div>

            {scheduled.map((task) => {
              const startOffset = Math.round((new Date(task.startDate!).getTime() - rangeStartMs) / MS_PER_DAY);
              const endOffset = Math.round((new Date(task.endDate!).getTime() - rangeStartMs) / MS_PER_DAY);
              return (
                <div key={task.id} className="flex">
                  <div
                    className="sticky left-0 z-10 flex h-9 shrink-0 items-center border-r border-b bg-background px-2"
                    style={{ width: SIDEBAR_WIDTH }}
                  >
                    <p className="truncate text-xs">{task.title}</p>
                  </div>
                  <div className="relative h-9 border-b" style={{ width: totalDays * DAY_WIDTH }}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn("absolute top-1.5 h-6 rounded-sm", PRIORITY_COLOR[task.priority])}
                          style={{
                            left: startOffset * DAY_WIDTH,
                            width: (endOffset - startOffset + 1) * DAY_WIDTH - 4,
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {task.title} · {PRIORITY_LABEL[task.priority]} · {shortDate(new Date(task.startDate!))}–
                        {shortDate(new Date(task.endDate!))}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
