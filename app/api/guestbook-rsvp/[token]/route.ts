import { db } from "@/lib/db";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { confirmGuestbookGuestCountSchema } from "@/lib/validations/guestbook";
import { logAudit } from "@/lib/audit";

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function invalidLinkResponse(): Response {
  return Response.json({ error: "Link tidak valid." }, { status: 404 });
}

// ─── GET /api/guestbook-rsvp/[token] ────────────────────────────────────────
// Genuinely public endpoint — client opens this link from a WhatsApp share to
// see their visit details and confirm guest count. No session, no access code
// (token-only by product decision). Returns the minimum safe display fields.

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const ip = getIp(req);
  if (!apiLimiter.check(`guestbook-rsvp-get:${ip}`)) return rateLimitResponse();

  const { token } = await params;

  try {
    const entry = await db.guestbookEntry.findUnique({
      where: { rsvpToken: token },
      select: {
        id: true,
        visitorName: true,
        companyName: true,
        checkInAt: true,
        confirmedGuestCount: true,
        confirmedGuestCountAt: true,
      },
    });

    if (!entry) return invalidLinkResponse();

    return Response.json({
      visitorName: entry.visitorName,
      companyName: entry.companyName,
      checkInAt: entry.checkInAt.toISOString(),
      confirmedGuestCount: entry.confirmedGuestCount,
      confirmedGuestCountAt: entry.confirmedGuestCountAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error("[guestbook-rsvp]", e);
    return Response.json({ error: "Terjadi kesalahan. Silakan coba lagi nanti." }, { status: 500 });
  }
}

// ─── POST /api/guestbook-rsvp/[token] ───────────────────────────────────────
// Submits (or overwrites) the client's guest count confirmation. Re-submission
// is intentionally allowed — no one-time-use lock — the client can change
// their mind and confirm again any time before the event.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const ip = getIp(req);
  if (!mutationLimiter.check(`guestbook-rsvp-post:${ip}`)) return rateLimitResponse();

  const { token } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Format request tidak valid." }, { status: 400 });
  }

  const parsed = confirmGuestbookGuestCountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const entry = await db.guestbookEntry.findUnique({
      where: { rsvpToken: token },
      select: { id: true, visitorName: true },
    });

    if (!entry) return invalidLinkResponse();

    await db.guestbookEntry.update({
      where: { id: entry.id },
      data: {
        confirmedGuestCount: parsed.data.guestCount,
        confirmedGuestCountAt: new Date(),
      },
    });

    await logAudit({
      action: "guestbook_entry.confirm_guest_count",
      entityType: "GuestbookEntry",
      entityId: entry.id,
      description: `Client mengonfirmasi jumlah tamu (${parsed.data.guestCount}) via link RSVP publik`,
    });

    return Response.json({ success: true, confirmedGuestCount: parsed.data.guestCount });
  } catch (e) {
    console.error("[guestbook-rsvp]", e);
    return Response.json({ error: "Terjadi kesalahan. Silakan coba lagi nanti." }, { status: 500 });
  }
}
