import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { findBitrixContactsByPhone, BitrixApiError } from "@/lib/bitrix";
import { normalizePhoneId } from "@/lib/phone";

/**
 * GET /api/guestbook/bitrix-lookup?phone=<raw>
 *
 * Contact-by-phone lookup for the guestbook create form. Gated on
 * guestbook:create — front-desk fills this form and may lack bitrix:view, so we
 * deliberately do NOT reuse /api/bitrix/contacts (which requires bitrix:view).
 * Always returns { phone, contacts } (contacts may be empty). Bitrix down /
 * unconfigured degrades to an error envelope the form treats as "manual entry".
 */
export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "guestbook", action: "create" });
  if (response) return response;
  if (!apiLimiter.check(`guestbook-bitrix:${session.user.id}`)) return rateLimitResponse();

  const raw = new URL(request.url).searchParams.get("phone") ?? "";
  const phone = normalizePhoneId(raw);
  if (!phone) return Response.json({ phone: null, contacts: [] });

  try {
    const contacts = await findBitrixContactsByPhone(phone);
    return Response.json({ phone, contacts });
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code, phone, contacts: [] }, { status });
    }
    console.error("[api/guestbook/bitrix-lookup]", e);
    return Response.json({ error: "Gagal mencari kontak Bitrix.", phone, contacts: [] }, { status: 500 });
  }
}
