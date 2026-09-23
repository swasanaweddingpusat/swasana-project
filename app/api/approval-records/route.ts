import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import {
  getApprovalRecord,
  getApprovalRecordsByModule,
  getApprovalRecordsByEntityIds,
} from "@/lib/queries/packages";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const moduleName = searchParams.get("module");
  if (!moduleName) return Response.json({ error: "Missing module param" }, { status: 400 });

  const permModule =
    moduleName === "booking" || moduleName === "booking-mice"
      ? "booking"
      : moduleName === "quotations"
        ? "quotations"
        : "package";
  const { session, response } = await requirePermissionForRoute({ module: permModule, action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`approval-records:${session.user.id}`)) return rateLimitResponse();

  const entityId = searchParams.get("entityId");
  const entityIdsParam = searchParams.get("entityIds");

  try {
    if (entityId) {
      const record = await getApprovalRecord(moduleName, entityId);
      return Response.json(record);
    }
    // Scoped fetch: only the requested entity IDs (e.g. the bookings on one page
    // of a sales table). Far cheaper than the module-wide fallback below.
    if (entityIdsParam) {
      const ids = entityIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 200);
      const records = await getApprovalRecordsByEntityIds(moduleName, ids);
      return Response.json(records);
    }
    const records = await getApprovalRecordsByModule(moduleName, 1, 500);
    return Response.json(records);
  } catch {
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
