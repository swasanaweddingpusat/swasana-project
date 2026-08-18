import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getBookingsForExport, type BookingExportFilters } from "@/lib/queries/bookings";
import { bitrixList } from "@/lib/bitrix";
import type { DataScope } from "@/types/user";

const STATUS_LABEL: Record<string, string> = {
  Pending: "Pending",
  Confirmed: "Confirmed",
  Uploaded: "Uploaded",
  Rejected: "Rejected",
  Canceled: "Canceled",
  Lost: "Lost",
};

// Custom (UF_CRM_*) field carrying the ad source URL on a Bitrix deal. Portal-
// specific id — mirror of the const used in /api/bitrix/deals.
const UF_ADS_URL = "UF_CRM_1770698079121";

interface AdsDeal {
  ID: string;
  [key: string]: string | null | undefined;
}

/** Format a Date as dd/MM/yyyy in WIB (UTC+7) for the report cell. */
function fmtDate(value: Date | null): string {
  if (!value) return "";
  const wib = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  const dd = String(wib.getUTCDate()).padStart(2, "0");
  const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = wib.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Format a Date as dd/MM/yyyy HH:mm in WIB (UTC+7) — for Created/Update cells. */
function fmtDateTime(value: Date | null): string {
  if (!value) return "";
  const wib = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const min = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${fmtDate(value)} ${hh}:${min}`;
}

/**
 * Resolve `bitrixId` (deal id) → ad source URL for the given deal ids.
 * Batches the ids in chunks of 50 (one Bitrix `crm.deal.list` page each) and
 * runs the chunks concurrently. Bitrix failures degrade gracefully to an empty
 * map so the export never fails because Bitrix is unreachable.
 */
async function fetchAdsUrlMap(dealIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(dealIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 50) chunks.push(unique.slice(i, i + 50));

  try {
    const results = await Promise.all(
      chunks.map((ids) =>
        bitrixList<AdsDeal>("crm.deal.list", {
          filter: { "@ID": ids },
          select: ["ID", UF_ADS_URL],
        }),
      ),
    );
    for (const { items } of results) {
      for (const d of items) {
        const url = d[UF_ADS_URL]?.trim();
        if (url) map.set(String(d.ID), url);
      }
    }
  } catch (err) {
    console.error("[BOOKING] Bitrix adsUrl lookup failed:", err);
  }
  return map;
}

// ─── GET /api/booking/export — Excel export of wedding bookings ───────────────

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`booking-export:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const filters: BookingExportFilters = {
    dealingFrom: searchParams.get("dealingFrom") ?? undefined,
    dealingTo: searchParams.get("dealingTo") ?? undefined,
  };

  try {
    const profileId = session.user.profileId ?? undefined;
    let dataScope: DataScope = "own";
    if (profileId) {
      const profile = await db.profile.findUnique({
        where: { id: profileId },
        select: { dataScope: true },
      });
      if (profile) dataScope = profile.dataScope as DataScope;
    }

    const rows = await getBookingsForExport(profileId, dataScope, filters);

    // Enrich each row's Bitrix deal id with its ad source URL (batched).
    const adsUrlMap = await fetchAdsUrlMap(
      rows.map((r) => r.bitrixId).filter((v): v is string => !!v),
    );

    const headers = [
      "NAMA CLIENT",
      "TANGGAL DEALING",
      "TANGGAL EVENT",
      "NAMA MARKETING",
      "SUMBER DEALING",
      "STATUS",
      "PHONE",
      "URL ADS BITRIX",
      "BRAND",
      "PACKAGE",
      "CREATED",
      "UPDATE",
    ];

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Booking Wedding");

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4159" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle" };
    });

    rows.forEach((r) => {
      sheet.addRow([
        r.clientName,
        fmtDate(r.dealingDate),
        fmtDate(r.eventDate),
        r.marketingName,
        r.dealingSource,
        STATUS_LABEL[r.status] ?? r.status,
        r.phone,
        r.bitrixId ? (adsUrlMap.get(r.bitrixId) ?? "") : "",
        r.brand,
        r.packageName,
        fmtDateTime(r.createdAt),
        fmtDateTime(r.updatedAt),
      ]);
    });

    sheet.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? "").length;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 2, 40);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const arrayBuffer =
      buffer instanceof ArrayBuffer
        ? buffer
        : (buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ) as ArrayBuffer);

    const stamp = new Date().toISOString().split("T")[0];
    return new Response(arrayBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="booking-wedding-${stamp}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[BOOKING] Failed to export Excel:", err);
    return Response.json({ error: "Gagal mengekspor data booking." }, { status: 500 });
  }
}
