import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@padock/db";

// Shared membership gate for every project-scoped router (project itself,
// task, and — not yet done — doc/channel/chat, CONTEXT.md §7). A project's
// data is only visible/writable to its own ProjectMembers; `role` decides
// admin-only actions like managing membership, not general read/write.
export async function assertProjectMember(db: PrismaClient, projectId: string, userId: string) {
  const membership = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this project" });
  }
  return membership;
}

export async function assertProjectAdmin(db: PrismaClient, projectId: string, userId: string) {
  const membership = await assertProjectMember(db, projectId, userId);
  if (membership.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Requires project admin role" });
  }
  return membership;
}

// Shared by removeMember (deleting an admin) and addMember (demoting one
// via role change) — both would otherwise leave a project with zero
// admins and nobody able to manage its membership ever again.
export async function assertKeepsAnAdmin(db: PrismaClient, projectId: string) {
  const adminCount = await db.projectMember.count({ where: { projectId, role: "admin" } });
  if (adminCount <= 1) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Can't remove the project's last admin" });
  }
}

// "Which projects can this user see" as a reusable primitive (§5.1.20)
// — previously only inlined once, in project.list's own where-clause.
// Used by mention.search's no-project-anchor fallback and
// mention.resolve's read-time permission filtering.
export async function listMemberProjectIds(db: PrismaClient, userId: string): Promise<string[]> {
  const rows = await db.projectMember.findMany({ where: { userId }, select: { projectId: true } });
  return rows.map((r) => r.projectId);
}
