import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import {
  getGuestbookFunnelBucketEntries,
  type GuestbookFunnelBucketKey,
  type GuestbookFunnelDrilldownKey,
} from "@/lib/queries/guestbookEntries";
import type { DataScope } from "@/types/user";

const ALLOWED_BUCKET = new Set<GuestbookFunnelBucketKey>([
  "database",
  "onlineMeeting",
  "belumVisit",
  "visitVenue",
  "tidakJadiVisitLost",
  "deal",
  "noDealLost",
  "cold",
  "warm",
  "hot",
  "noResponse",
  "totalAds",
]);

function parseListParam(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "guestbook",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`guestbook-funnel-bucket:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket") as GuestbookFunnelDrilldownKey | null;
  // Kartu "Database dari Ads" mengirim `adsStatus:<statusId>` yang statusId-nya
  // dinamis (dikelola admin), jadi divalidasi lewat prefix, bukan allowlist.
  const isValidBucket =
    !!bucket &&
    (ALLOWED_BUCKET.has(bucket as GuestbookFunnelBucketKey) || bucket.startsWith("adsStatus:"));
  if (!isValidBucket) {
    return Response.json({ error: "Invalid bucket" }, { status: 400 });
  }

  const venueIds = parseListParam(searchParams.get("venueIds"));
  const hostId = searchParams.get("hostId")?.trim() || undefined;
  const dateFrom = searchParams.get("dateFrom")?.trim() || undefined;
  const dateTo = searchParams.get("dateTo")?.trim() || undefined;

  const profileId = session.user.profileId ?? undefined;
  const dataScope: DataScope = session.user.dataScope ?? "own";

  try {
    const result = await getGuestbookFunnelBucketEntries(
      profileId,
      dataScope,
      { venueIds, hostId, dateFrom, dateTo },
      bucket as GuestbookFunnelDrilldownKey
    );
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/guestbook/funnel-bucket]", error);
    return Response.json({ error: "Failed to fetch guestbook funnel bucket entries" }, { status: 500 });
  }
}
