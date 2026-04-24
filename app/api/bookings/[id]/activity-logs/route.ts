import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Fields that contain IDs needing resolution
const ID_FIELDS = new Set(["venueId", "packageId", "customerId", "salesId", "managerId", "paymentMethodId", "sourceOfInformationId"]);

async function resolveIds(changes: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ids = new Set<string>();
  for (const [key, val] of Object.entries(changes)) {
    if (!ID_FIELDS.has(key)) continue;
    if (typeof val === "string" && val) ids.add(val);
    if (val && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (typeof obj.from === "string" && obj.from) ids.add(obj.from);
      if (typeof obj.to === "string" && obj.to) ids.add(obj.to);
    }
  }
  if (ids.size === 0) return changes;

  const idArr = [...ids];
  const [venues, packages, profiles, paymentMethods, sources, customers] = await Promise.all([
    db.venue.findMany({ where: { id: { in: idArr } }, select: { id: true, name: true } }),
    db.package.findMany({ where: { id: { in: idArr } }, select: { id: true, packageName: true } }),
    db.profile.findMany({ where: { id: { in: idArr } }, select: { id: true, fullName: true } }),
    db.paymentMethod.findMany({ where: { id: { in: idArr } }, select: { id: true, bankName: true, bankAccountNumber: true } }),
    db.sourceOfInformation.findMany({ where: { id: { in: idArr } }, select: { id: true, name: true } }),
    db.customer.findMany({ where: { id: { in: idArr } }, select: { id: true, name: true } }),
  ]);

  const nameMap = new Map<string, string>();
  for (const v of venues) nameMap.set(v.id, v.name ?? v.id);
  for (const p of packages) nameMap.set(p.id, p.packageName);
  for (const p of profiles) nameMap.set(p.id, p.fullName ?? p.id);
  for (const pm of paymentMethods) nameMap.set(pm.id, `${pm.bankName} - ${pm.bankAccountNumber}`);
  for (const s of sources) nameMap.set(s.id, s.name ?? s.id);
  for (const c of customers) nameMap.set(c.id, c.name ?? c.id);

  const resolved = { ...changes };
  for (const [key, val] of Object.entries(resolved)) {
    if (!ID_FIELDS.has(key)) continue;
    if (typeof val === "string" && nameMap.has(val)) {
      resolved[key] = nameMap.get(val);
    } else if (val && typeof val === "object") {
      const obj = { ...(val as Record<string, unknown>) };
      if (typeof obj.from === "string" && nameMap.has(obj.from)) obj.from = nameMap.get(obj.from);
      if (typeof obj.to === "string" && nameMap.has(obj.to)) obj.to = nameMap.get(obj.to);
      resolved[key] = obj;
    }
  }
  return resolved;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const logs = await db.activityLog.findMany({
    where: { entityType: "booking", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      userId: true,
      action: true,
      result: true,
      entityType: true,
      entityId: true,
      changes: true,
      description: true,
      createdAt: true,
      profile: { select: { fullName: true, role: { select: { name: true } } } },
    },
  });

  const resolved = await Promise.all(
    logs.map(async (log) => ({
      ...log,
      changes: log.changes ? await resolveIds(log.changes as Record<string, unknown>) : log.changes,
    }))
  );

  return NextResponse.json(resolved);
}
