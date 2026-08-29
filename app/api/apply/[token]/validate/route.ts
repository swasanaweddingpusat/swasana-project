import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { validateJobPostingAccessSchema } from "@/lib/validations/candidate";

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// ─── POST /api/apply/[token]/validate ──────────────────────────────────────────
// Gate in front of the public application form. Checks the shared 6-char
// publicAccessCode (shown to HR in the "Link Pendaftaran" popup alongside the
// link) before revealing job posting details, then mints the one-time
// formToken (previously minted by the now-removed GET handler) used to guard
// against duplicate/replayed submissions.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const ip = getIp(req);
  if (!apiLimiter.check(`apply-validate:${ip}`)) return rateLimitResponse();

  const { token } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Format request tidak valid." }, { status: 400 });
  }

  const parsed = validateJobPostingAccessSchema.safeParse({
    token,
    code: (body as { code?: unknown })?.code,
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const posting = await db.jobPosting.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      title: true,
      companyName: true,
      location: true,
      interviewDate: true,
      quota: true,
      status: true,
      deletedAt: true,
      publicAccessCode: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
  });

  if (!posting || posting.status !== "open" || posting.deletedAt !== null) {
    return Response.json({ error: "Lowongan tidak tersedia atau sudah ditutup." }, { status: 404 });
  }

  if (!posting.publicAccessCode || posting.publicAccessCode !== parsed.data.code.trim().toUpperCase()) {
    return Response.json({ error: "Kode akses salah." }, { status: 401 });
  }

  // One-time form-session token — separate from the long-lived publicToken
  // above (which many different applicants share). Minted fresh on every
  // successful code check and claimed exactly once on submit to reject
  // duplicate/replay submissions from the same validated session.
  const formToken = randomBytes(32).toString("hex");
  await db.jobApplicationToken.create({
    data: {
      jobPostingId: posting.id,
      token: formToken,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });

  return Response.json({
    title: posting.title,
    companyName: posting.companyName,
    location: posting.location,
    interviewDate: posting.interviewDate,
    quota: posting.quota,
    department: posting.department?.name ?? null,
    position: posting.position?.name ?? null,
    formToken,
  });
}
