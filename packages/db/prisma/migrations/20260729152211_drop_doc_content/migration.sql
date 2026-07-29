-- AlterTable
ALTER TABLE "doc" DROP COLUMN "content",
ALTER COLUMN "blocks" SET NOT NULL,
ALTER COLUMN "searchText" SET NOT NULL;

