/*
  Warnings:

  - You are about to drop the `user_data_group_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_data_groups` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_data_group_members" DROP CONSTRAINT "user_data_group_members_groupId_fkey";

-- DropForeignKey
ALTER TABLE "user_data_group_members" DROP CONSTRAINT "user_data_group_members_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_data_groups" DROP CONSTRAINT "user_data_groups_leaderId_fkey";

-- DropTable
DROP TABLE "user_data_group_members";

-- DropTable
DROP TABLE "user_data_groups";

-- CreateTable
CREATE TABLE "user_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leaderId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_members" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_members_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateIndex
CREATE INDEX "user_group_members_userId_idx" ON "user_group_members"("userId");

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
