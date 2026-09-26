import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixCall } from "@/lib/bitrix";
import { UF_ADS_URL } from "@/app/api/bitrix/deals/route";

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "guestbook", action: "create" });
  if (response) return response;
  if (!apiLimiter.check(`guestbook-bitrix-ads-url:${session.user.id}`)) return rateLimitResponse();

  const dealId = new URL(request.url).searchParams.get("dealId") ?? "";
  if (!dealId) return Response.json({ adsUrl: null });

  try {
    const { result } = await bitrixCall<{ ID?: string; [key: string]: string | null | undefined }>(
      "crm.deal.get",
      { id: dealId },
    );

    const adsUrl = result?.[UF_ADS_URL]?.trim() || null;

    return Response.json({ adsUrl });
  } catch (e) {
    console.error("[api/guestbook/bitrix-ads-url]", e);
    return Response.json({ adsUrl: null, error: "Gagal mengambil URL iklan Bitrix." }, { status: 500 });
  }
}
