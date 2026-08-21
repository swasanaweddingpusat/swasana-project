import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type BookingLogCategory = "WEDDINGS" | "MICE";

export interface BookingActivityLogItem {
  id: string;
  createdAt: string;
  action: string;
  result: string;
  description: string | null;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  bookingId: string;
  bookingCode: string | null;
  category: BookingLogCategory | null;
  customerName: string | null;
}

export interface BookingActivityLogFilters {
  page: number;
  pageSize: number;
  search?: string;
  category?: BookingLogCategory;
  dateFrom?: string;
  dateTo?: string;
}

export interface BookingActivityLogResult {
  data: BookingActivityLogItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface RawLogRow {
  id: string;
  createdAt: Date;
  action: string;
  result: string;
  description: string | null;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  bookingId: string;
  bookingCode: string | null;
  category: string | null;
  customerName: string | null;
}

/**
 * Monitoring read for the Settings "Booking Activity Log" hub — gabungan log
 * booking Wedding + MICE dalam satu tempat (Settings > Booking Log).
 *
 * ActivityLog.entityId adalah polymorphic string (bukan relasi Prisma formal ke
 * Booking), jadi join dilakukan via $queryRaw (pattern sama seperti
 * lib/queries/booking-comments.ts getUnreadCommentCounts). Kolom Prisma
 * camelCase TANPA @map tetap camelCase di Postgres → wajib double-quote;
 * hanya nama TABEL yang snake_case (via @@map).
 */
export async function getBookingActivityLogs(
  filters: BookingActivityLogFilters,
): Promise<BookingActivityLogResult> {
  const page = Math.max(1, filters.page);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize));
  const skip = (page - 1) * pageSize;

  const conditions: Prisma.Sql[] = [Prisma.sql`al."entityType" = 'booking'`];

  if (filters.category) {
    conditions.push(Prisma.sql`b.category = ${filters.category}::"EventCategory"`);
  }
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    if (!Number.isNaN(from.getTime())) conditions.push(Prisma.sql`al."createdAt" >= ${from}`);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    if (!Number.isNaN(to.getTime())) conditions.push(Prisma.sql`al."createdAt" <= ${to}`);
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(Prisma.sql`(
      c.name ILIKE ${q} OR
      b."poNumber" ILIKE ${q} OR
      p."fullName" ILIKE ${q} OR
      al.description ILIKE ${q} OR
      al.action ILIKE ${q}
    )`);
  }

  const whereClause = Prisma.join(conditions, " AND ");

  const [rows, countRows] = await Promise.all([
    db.$queryRaw<RawLogRow[]>(Prisma.sql`
      SELECT
        al.id, al."createdAt", al.action, al.result, al.description, al."userId",
        p."fullName" AS "userName", r.name AS "userRole",
        al."entityId" AS "bookingId", b."poNumber" AS "bookingCode",
        b.category::text AS category, c.name AS "customerName"
      FROM activity_logs al
      LEFT JOIN bookings b ON b.id = al."entityId"
      LEFT JOIN customers c ON c.id = b."customerId"
      LEFT JOIN profiles p ON p.id = al."userId"
      LEFT JOIN roles r ON r.id = p."roleId"
      WHERE ${whereClause}
      ORDER BY al."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${skip}
    `),
    db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM activity_logs al
      LEFT JOIN bookings b ON b.id = al."entityId"
      LEFT JOIN customers c ON c.id = b."customerId"
      LEFT JOIN profiles p ON p.id = al."userId"
      WHERE ${whereClause}
    `),
  ]);

  const total = Number(countRows[0]?.count ?? 0);

  const data: BookingActivityLogItem[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    action: r.action,
    result: r.result,
    description: r.description,
    userId: r.userId,
    userName: r.userName,
    userRole: r.userRole,
    bookingId: r.bookingId,
    bookingCode: r.bookingCode,
    category: r.category === "WEDDINGS" || r.category === "MICE" ? r.category : null,
    customerName: r.customerName,
  }));

  return { data, total, page, pageSize };
}
