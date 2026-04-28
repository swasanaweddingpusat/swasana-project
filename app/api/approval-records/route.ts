import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getApprovalRecord, getApprovalRecordsByModule } from "@/lib/queries/packages";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const moduleName = searchParams.get("module");
  if (!moduleName) return Response.json({ error: "Missing module param" }, { status: 400 });

  const permModule = moduleName === "booking" ? "booking" : "package";
  const { session, response } = await requirePermissionForRoute({ module: permModule, action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`approval-records:${session.user.id}`)) return rateLimitResponse();

  const entityId = searchParams.get("entityId");

  try {
    if (entityId) {
      const record = await getApprovalRecord(moduleName, entityId);
      return Response.json(record);
    }
    const records = await getApprovalRecordsByModule(moduleName);
    return Response.json(records);
  } catch {
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
