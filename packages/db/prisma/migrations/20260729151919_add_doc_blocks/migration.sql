-- AlterTable
ALTER TABLE "doc" ADD COLUMN     "blocks" JSONB,
ADD COLUMN     "searchText" TEXT,
ALTER COLUMN "content" DROP NOT NULL;
