-- AlterTable
ALTER TABLE "announcement_comments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "announcement_readers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "announcements" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "banners" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "memo_comments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "memo_readers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "memos" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wedding_indicators" ALTER COLUMN "questionnaireData" SET DEFAULT '{}'::jsonb;

-- RenameIndex
ALTER INDEX "bookings_record_status_created_at_idx" RENAME TO "bookings_recordStatus_createdAt_idx";

-- RenameIndex
ALTER INDEX "bookings_record_status_event_date_idx" RENAME TO "bookings_recordStatus_eventDate_idx";

-- RenameIndex
ALTER INDEX "bookings_record_status_sales_id_idx" RENAME TO "bookings_recordStatus_salesId_idx";

-- RenameIndex
ALTER INDEX "leads_assigned_to_id_created_at_idx" RENAME TO "leads_assignedToId_createdAt_idx";

-- RenameIndex
ALTER INDEX "leads_created_at_idx" RENAME TO "leads_createdAt_idx";

-- RenameIndex
ALTER INDEX "leads_event_type_id_idx" RENAME TO "leads_eventTypeId_idx";

-- RenameIndex
ALTER INDEX "ledgers_direction_ack_status_voided_at_occurred_at_idx" RENAME TO "ledgers_direction_ackStatus_voidedAt_occurredAt_idx";

-- RenameIndex
ALTER INDEX "quotations_category_status_created_at_idx" RENAME TO "quotations_category_status_createdAt_idx";
