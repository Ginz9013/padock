export type TaskState = { id: string; name: string; group: string; position: number; isDefault: boolean };

export type TaskPriority = "urgent" | "high" | "medium" | "low" | "none";

export type ProjectMemberSummary = {
  id: string;
  userId: string;
  role: "admin" | "member";
  user: { id: string; name: string; email: string };
};

export type TaskAssignee = {
  id: string;
  projectMemberId: string;
  projectMember: ProjectMemberSummary;
};

export type ProjectLabel = { id: string; name: string; color: string };

export type TaskLabel = {
  id: string;
  labelId: string;
  label: ProjectLabel;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  stateId: string;
  priority: TaskPriority;
  startDate: string | null;
  endDate: string | null;
  assignees: TaskAssignee[];
  labels: TaskLabel[];
};

// A small fixed swatch palette (Plane/Linear-style tag colors) instead of
// a free-form color picker — keeps every label visually distinct without
// needing a full color-picker component for what's a low-stakes choice.
export const LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
] as const;

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
];

export const PRIORITY_LABEL: Record<TaskPriority, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.label]),
) as Record<TaskPriority, string>;
