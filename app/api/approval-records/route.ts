import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getApprovalRecord, getApprovalRecordsByModule } from "@/lib/queries/packages";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "package", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`approval-records:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const module = searchParams.get("module");
  const entityId = searchParams.get("entityId");

  if (!module) return Response.json({ error: "Missing module param" }, { status: 400 });

  try {
    if (entityId) {
      const record = await getApprovalRecord(module, entityId);
      return Response.json(record);
    }
    const records = await getApprovalRecordsByModule(module);
    return Response.json(records);
  } catch {
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
