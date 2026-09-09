import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixCall, getBitrixCrmMeta, labelFromSourceId } from "@/lib/bitrix";

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "guestbook", action: "create" });
  if (response) return response;
  if (!apiLimiter.check(`guestbook-bitrix-source:${session.user.id}`)) return rateLimitResponse();

  const contactId = new URL(request.url).searchParams.get("contactId") ?? "";
  if (!contactId) return Response.json({ sourceInfo: null });

  try {
    const { result } = await bitrixCall<{ ID?: string; SOURCE_ID?: string }>(
      "crm.contact.get",
      { id: contactId },
    );

    if (!result?.SOURCE_ID) return Response.json({ sourceInfo: null });

    const meta = await getBitrixCrmMeta();
    const label = meta.sources[result.SOURCE_ID] ?? labelFromSourceId(result.SOURCE_ID);

    return Response.json({ sourceInfo: label });
  } catch (e) {
    console.error("[api/guestbook/bitrix-source]", e);
    return Response.json({ sourceInfo: null, error: "Gagal mengambil sumber Bitrix." }, { status: 500 });
  }
}
