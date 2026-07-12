import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getLedgerActivities } from "@/lib/queries/ledger";

/** Riwayat satu transaksi (created/ack/reject/void) — di-fetch pas modal dibuka. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ledgerId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!apiLimiter.check(`ledger-activities:${session.user.id}`)) return rateLimitResponse();

  const { ledgerId } = await params;
  const activities = await getLedgerActivities(ledgerId);
  return Response.json(activities);
}
