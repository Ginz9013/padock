export type TaskState = { id: string; name: string; group: string; position: number; isDefault: boolean };

export type TaskPriority = "urgent" | "high" | "medium" | "low" | "none";

export type TaskAssignee = {
  id: string;
  projectMemberId: string;
  projectMember: {
    id: string;
    userId: string;
    role: "admin" | "member";
    user: { id: string; name: string; email: string };
  };
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
};

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
