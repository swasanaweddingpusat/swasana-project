-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "booking_comment_reactions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "booking_comment_reactions_commentId_idx" ON "booking_comment_reactions"("commentId");

-- CreateUniqueIndex (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_comment_reactions_commentId_profileId_emoji_key'
  ) THEN
    ALTER TABLE "booking_comment_reactions"
      ADD CONSTRAINT "booking_comment_reactions_commentId_profileId_emoji_key"
      UNIQUE ("commentId", "profileId", "emoji");
  END IF;
END $$;

-- AddForeignKey: comment → booking_comments (cascade delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_comment_reactions_commentId_fkey'
  ) THEN
    ALTER TABLE "booking_comment_reactions"
      ADD CONSTRAINT "booking_comment_reactions_commentId_fkey"
      FOREIGN KEY ("commentId") REFERENCES "booking_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: profile → profiles (cascade delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_comment_reactions_profileId_fkey'
  ) THEN
    ALTER TABLE "booking_comment_reactions"
      ADD CONSTRAINT "booking_comment_reactions_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
