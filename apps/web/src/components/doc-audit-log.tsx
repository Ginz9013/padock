"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type LogEntry = { id: string; path: string; createdAt: string; actorName: string };

// Keyed by AuditLog.path (packages/api/src/router/auditLog.ts) — doc.create
// never appears here (its input has no id to match back against, see that
// router's comment), so only these three ever show up in practice.
const VERB_BY_PATH: Record<string, string> = {
  "doc.update": "編輯了文件",
  "doc.delete": "刪除了文件",
  "doc.setAttributeValue": "更新了屬性",
};

export function DocAuditLog({ docId }: { docId: string }) {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);

  useEffect(() => {
    trpc.auditLog.forDoc.query({ docId }).then(setLogs);
  }, [docId]);

  if (!logs || logs.length === 0) return null;

  return (
    <div className="mt-8 flex flex-col gap-2 border-t pt-4">
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
