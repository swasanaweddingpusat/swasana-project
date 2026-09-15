import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGuestbookEntries, type GuestbookCategoryFilter } from "@/lib/queries/guestbookEntries";
import type { DataScope } from "@/types/user";
import type { GuestInteractionType } from "@prisma/client";

const ALLOWED_CATEGORY = new Set<GuestbookCategoryFilter>(["WEDDINGS", "MICE", "no_package"]);
const ALLOWED_INTERACTION = new Set<GuestInteractionType>(["client_visit", "online_meeting", "jemput_bola"]);

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "guestbook",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`guestbook-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 50));

  const search = searchParams.get("search")?.trim() || undefined;
  const venueId = searchParams.get("venueId")?.trim() || undefined;
  const hostId = searchParams.get("hostId")?.trim() || undefined;
  const dateFrom = searchParams.get("dateFrom")?.trim() || undefined;
  const dateTo = searchParams.get("dateTo")?.trim() || undefined;

  const rawCategory = searchParams.get("category");
  const category: GuestbookCategoryFilter | undefined =
    rawCategory && ALLOWED_CATEGORY.has(rawCategory as GuestbookCategoryFilter)
      ? (rawCategory as GuestbookCategoryFilter)
      : undefined;

  const rawInteractionType = searchParams.get("interactionType");
  const interactionType: GuestInteractionType | undefined =
    rawInteractionType && ALLOWED_INTERACTION.has(rawInteractionType as GuestInteractionType)
      ? (rawInteractionType as GuestInteractionType)
      : undefined;

  const profileId = session.user.profileId ?? undefined;
  // dataScope is already carried on the JWT/session (refreshed from DB every 10
  // min in lib/auth.ts), so read it straight from the session instead of an extra
  // per-request DB round-trip. Falls back to "own" defensively.
  const dataScope: DataScope = session.user.dataScope ?? "own";

  try {
    const result = await getGuestbookEntries(profileId, dataScope, {
      page,
      pageSize,
      search,
      venueId,
      hostId,
      dateFrom,
      dateTo,
      category,
      interactionType,
    });
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/guestbook]", error);
    return Response.json({ error: "Failed to fetch guestbook entries" }, { status: 500 });
  }
}
