-- Adds project-level membership/access-control (Project.members). Hand
-- edited, not left as the raw `prisma migrate diff` output, because a
-- project with zero ProjectMember rows would become invisible/inaccessible
-- to everyone once the API layer starts filtering by membership — this
-- migration backfills every existing Project with every existing User as
-- an admin ProjectMember, so turning that filtering on doesn't lock
-- anyone out of data that was previously visible to the whole org
-- (same "preserve real dogfood data" discipline as the Channel/Topic
-- collapse migration, CONTEXT.md §5.1.6).

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('admin', 'member');

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "project_member" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_member_projectId_idx" ON "project_member"("projectId");

-- CreateIndex
CREATE INDEX "project_member_userId_idx" ON "project_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_member_projectId_userId_key" ON "project_member"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing User becomes an `admin` ProjectMember of
-- every existing Project, preserving the current de-facto behavior
-- (every org member could already see/act on every project). Going
-- forward, `project.create` only adds the creator as `admin` — this
-- blanket backfill is a one-time transition step, not the new default.
INSERT INTO "project_member" ("id", "projectId", "userId", "role", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || p."id" || u."id"), p."id", u."id", 'admin', CURRENT_TIMESTAMP
FROM "project" p
CROSS JOIN "user" u;
