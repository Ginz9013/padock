-- ADR-0001 (docs/adr/0001-collapse-topic-into-channel.md): collapse the
-- two-level Channel->Topic structure into a single Channel level. Hand
-- written, not `prisma migrate diff`-generated, because it preserves real
-- dogfood data rather than just reshaping columns (§5.1.6 discipline).

-- 1. Add the new Channel columns.
ALTER TABLE "channel" ADD COLUMN "title" TEXT;
ALTER TABLE "channel" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill title from the old `name`. An existing project-scoped
-- channel becomes that project's "project channel" (isDefault) — it
-- already played that role before issue channels existed as a concept.
UPDATE "channel" SET "title" = "name";
UPDATE "channel" SET "isDefault" = true WHERE "projectId" IS NOT NULL;

-- 3. Every Topic becomes its own Channel row ("issue channel"),
-- inheriting project scope from its old parent channel. Reuses the
-- topic's own id so chat_message.topicId values can be reinterpreted
-- directly as channelId in step 4. `name` is still NOT NULL at this
-- point (dropped in step 6) so it needs a throwaway value too.
INSERT INTO "channel" ("id", "name", "title", "projectId", "isDefault", "createdById", "createdAt")
SELECT t."id", t."title", t."title", c."projectId", false, t."createdById", t."createdAt"
FROM "topic" t
JOIN "channel" c ON c."id" = t."channelId";

-- 4. Repoint channel messages from the (channelId, topicId) pair onto
-- the single surviving channelId.
ALTER TABLE "chat_message" DROP CONSTRAINT "chat_message_topicId_fkey";
UPDATE "chat_message" SET "channelId" = "topicId" WHERE "topicId" IS NOT NULL;
ALTER TABLE "chat_message" DROP COLUMN "topicId";

-- 5. Drop the now-fully-migrated Topic table.
ALTER TABLE "topic" DROP CONSTRAINT "topic_channelId_fkey";
ALTER TABLE "topic" DROP CONSTRAINT "topic_createdById_fkey";
DROP TABLE "topic";

-- 6. Finish the Channel column changes. `name`'s old @@unique became a
-- plain unique index (not a named constraint) when 0_init baselined
-- the live database, so dropping the column cascades the index away —
-- no separate DROP CONSTRAINT/INDEX needed.
ALTER TABLE "channel" DROP COLUMN "name";
ALTER TABLE "channel" ALTER COLUMN "title" SET NOT NULL;
