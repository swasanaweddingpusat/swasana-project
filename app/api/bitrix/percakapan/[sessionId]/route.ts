import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixSessionHistory, BitrixApiError } from "@/lib/bitrix";
import { parseResponseSamples, avgSeconds } from "@/lib/bitrix-response";

interface DetailMessage {
  id: string;
  date: string;
  senderid: string;
  isSystem: boolean;
  isCustomer: boolean;
  isAgent: boolean;
  text: string;
}

/**
 * GET /api/bitrix/percakapan/[sessionId]
 *
 * Returns the structured detail of a single Open Lines session: client info,
 * assignment/transfer events, response-time samples per involved agent, and the
 * full ordered message timeline. This powers the right-hand drawer on the
 * Percakapan list.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-percakapan-detail:${session.user.id}`)) return rateLimitResponse();

  try {
    const history = await bitrixSessionHistory(sessionId);

    const customerEntries = Object.values(history.users ?? {}).filter((u) => u.connector === true);
    const customer = customerEntries[0] ?? null;

    const messages: DetailMessage[] = Object.values(history.message ?? {})
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      .map((m) => ({
        id: m.id,
        date: m.date,
        senderid: m.senderid,
        isSystem: m.senderid === "0",
        isCustomer: customer?.id === m.senderid,
        isAgent: m.senderid !== "0" && customer?.id !== m.senderid,
        // Raw message text (BBCode). The client renders [b], [URL], and newlines.
        text: m.text,
      }));

    const { samples, events } = parseResponseSamples(history);

    const samplesByUser = new Map<string, { userId: string; seconds: number }[]>();
    for (const s of samples) {
      const arr = samplesByUser.get(s.userId) ?? [];
      arr.push({ userId: s.userId, seconds: s.seconds });
      samplesByUser.set(s.userId, arr);
    }

    const responseByAgent = [...samplesByUser.entries()].map(([userId, list]) => {
      const name = history.users?.[userId]?.name ?? `#${userId}`;
      return { userId, name, samples: list.length, avgSeconds: avgSeconds(list) };
    });

    const chat = Object.values(history.chat ?? {})[0] ?? null;

    return Response.json({
      session: {
        sessionId: history.sessionId,
        chatId: history.chatId,
        messageCount: chat?.messageCount ?? messages.length,
        dateCreate: chat?.dateCreate ?? null,
        entityId: chat?.entityId ?? null,
        entityData1: chat?.entityData1 ?? null,
        entityData2: chat?.entityData2 ?? null,
      },
      client: customer ? { id: customer.id, name: customer.name } : null,
      events,
      responseByAgent,
      messages,
    });
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix/percakapan/detail]", e);
    return Response.json({ error: "Gagal mengambil detail percakapan." }, { status: 500 });
  }
}
