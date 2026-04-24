-- CreateTable
CREATE TABLE "booking_comments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentions" TEXT[],
    "replyToId" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_comment_reads" (
    "profileId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_comment_reads_pkey" PRIMARY KEY ("profileId","bookingId")
);

-- CreateIndex
CREATE INDEX "booking_comments_bookingId_idx" ON "booking_comments"("bookingId");

-- CreateIndex
CREATE INDEX "booking_comments_authorId_idx" ON "booking_comments"("authorId");

-- AddForeignKey
ALTER TABLE "booking_comments" ADD CONSTRAINT "booking_comments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_comments" ADD CONSTRAINT "booking_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_comments" ADD CONSTRAINT "booking_comments_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "booking_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_comment_reads" ADD CONSTRAINT "booking_comment_reads_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_comment_reads" ADD CONSTRAINT "booking_comment_reads_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
