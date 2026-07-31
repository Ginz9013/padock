"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type LogEntry = { id: string; path: string; createdAt: string; actorName: string };

// Keyed by AuditLog.path (packages/api/src/router/auditLog.ts) — task.create
// never appears here (its input has no id to match back against, same gap
// as doc.create), so only these six ever show up in practice.
const VERB_BY_PATH: Record<string, string> = {
  "task.update": "編輯了任務",
  "task.updateState": "變更了狀態",
  "task.updatePriority": "變更了優先度",
  "task.updateDates": "變更了日期",
  "task.updateAssignees": "變更了指派對象",
  "task.updateLabels": "變更了標籤",
};

export function TaskAuditLog({ taskId }: { taskId: string }) {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);

  useEffect(() => {
    trpc.auditLog.forTask.query({ taskId }).then(setLogs);
  }, [taskId]);

  if (!logs || logs.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-4">
      <p className="text-xs font-medium text-muted-foreground">異動紀錄</p>
      <ul className="flex flex-col gap-1.5">
        {logs.map((log) => (
          <li key={log.id} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{log.actorName}</span>{" "}
            {VERB_BY_PATH[log.path] ?? log.path}
            {" · "}
            {new Date(log.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
