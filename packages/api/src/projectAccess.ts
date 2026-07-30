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
