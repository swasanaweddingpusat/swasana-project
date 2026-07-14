import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getTermsForBooking } from "@/lib/queries/ledger";

/** Jadwal termin satu booking buat multi-select link di drawer catat-transaksi. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!apiLimiter.check(`terms:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;
  const terms = await getTermsForBooking(id);
  return Response.json(terms);
}
