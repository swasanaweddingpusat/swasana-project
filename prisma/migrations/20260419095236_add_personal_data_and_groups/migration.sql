-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('own', 'group', 'all');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "currentAddress" TEXT,
ADD COLUMN     "dataScope" "DataScope" NOT NULL DEFAULT 'own',
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRel" TEXT,
ADD COLUMN     "ktpAddress" TEXT,
ADD COLUMN     "lastEducation" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "motherName" TEXT,
ADD COLUMN     "nickName" TEXT,
ADD COLUMN     "numberOfChildren" INTEGER,
ADD COLUMN     "placeOfBirth" TEXT;

-- CreateTable
CREATE TABLE "user_data_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leaderId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_data_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data_group_members" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_data_group_members_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateIndex
CREATE INDEX "user_data_group_members_userId_idx" ON "user_data_group_members"("userId");

-- CreateIndex
CREATE INDEX "profiles_dataScope_idx" ON "profiles"("dataScope");

-- AddForeignKey
ALTER TABLE "user_data_groups" ADD CONSTRAINT "user_data_groups_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data_group_members" ADD CONSTRAINT "user_data_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "user_data_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data_group_members" ADD CONSTRAINT "user_data_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
