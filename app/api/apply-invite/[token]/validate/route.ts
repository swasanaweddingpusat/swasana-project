import { db } from "@/lib/db";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { validateCandidateInviteSchema } from "@/lib/validations/candidate";

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// ─── POST /api/apply-invite/[token]/validate ───────────────────────────────────
// Checks the access code for a candidate's personal invite link. No auth required.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const ip = getIp(req);
  if (!apiLimiter.check(`invite-validate:${ip}`)) return rateLimitResponse();

  const { token } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Format request tidak valid." }, { status: 400 });
  }

  const parsed = validateCandidateInviteSchema.safeParse({
    token,
    accessCode: (body as { accessCode?: unknown })?.accessCode,
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const invite = await db.candidateInvite.findUnique({
    where: { token },
    include: {
      candidate: {
        include: { jobPosting: { select: { title: true, companyName: true } } },
      },
    },
  });

  if (!invite) {
    return Response.json({ error: "Link tidak valid." }, { status: 404 });
  }

  // Checked BEFORE the access code so a completed link stays locked forever,
  // even if the correct code is supplied again.
  if (invite.status === "Completed") {
    return Response.json({ locked: true }, { status: 200 });
  }

  if (invite.accessCode !== parsed.data.accessCode.trim().toUpperCase()) {
    return Response.json({ error: "Kode akses salah." }, { status: 401 });
  }

  if (invite.status === "Pending") {
    await db.candidateInvite.update({
      where: { token },
      data: { status: "Viewed", viewedAt: new Date() },
    });
  }

  const { candidate } = invite;
  return Response.json({
    locked: false,
    candidate: {
      fullName: candidate.fullName,
      email: candidate.email,
      phoneNumber: candidate.phoneNumber,
      religion: candidate.religion,
      expectedSalary: candidate.expectedSalary?.toString() ?? null,
    },
    jobPosting: {
      title: candidate.jobPosting.title,
      companyName: candidate.jobPosting.companyName,
    },
  });
}
