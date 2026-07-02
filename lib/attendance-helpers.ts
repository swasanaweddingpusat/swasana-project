import { db } from "@/lib/db";

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function determineStatus(
  clockInAt: Date,
  startTime: string,
  lateToleranceMinutes: number,
  isOvernight: boolean,
): "on_time" | "late" {
  const [h, m] = startTime.split(":").map(Number);
  const deadline = new Date(clockInAt);
  if (isOvernight) {
    deadline.setHours(h, m + lateToleranceMinutes, 0, 0);
    if (deadline < clockInAt && clockInAt.getHours() < 12) {
      deadline.setDate(deadline.getDate() - 1);
    }
  } else {
    deadline.setHours(h, m + lateToleranceMinutes, 0, 0);
  }
  return clockInAt <= deadline ? "on_time" : "late";
}

interface ResolvedShift {
  workShiftId: string;
  workShift: { id: string; name: string; startTime: string; endTime: string; lateToleranceMinutes: number; isOvernight: boolean };
  workLocationId: string | null;
  source: "override" | "assignment";
}

export async function resolveEmployeeShift(profileId: string, date: Date): Promise<ResolvedShift | null> {
  const override = await db.shiftOverride.findUnique({
    where: { profileId_date: { profileId, date } },
    include: { workShift: true },
  });

  if (override) {
    return {
      workShiftId: override.workShiftId,
      workShift: override.workShift,
      workLocationId: override.workLocationId,
      source: "override",
    };
  }

  const assignment = await db.employeeWorkAssignment.findFirst({
    where: {
      profileId,
      isDefault: true,
      effectiveDate: { lte: date },
      OR: [
        { endDate: null },
        { endDate: { gte: date } },
      ],
    },
    include: { workShift: true, workLocation: true },
  });

  if (assignment) {
    return {
      workShiftId: assignment.workShiftId,
      workShift: assignment.workShift,
      workLocationId: assignment.workLocationId,
      source: "assignment",
    };
  }

  return null;
}

interface LocationValidationResult {
  valid: boolean;
  nearestLocationId: string | null;
  nearestLocationName: string | null;
  distance: number;
}

export async function validateGpsAgainstLocations(
  profileId: string,
  lat: number,
  lng: number,
  date: Date,
  overrideLocationId: string | null,
): Promise<LocationValidationResult> {
  let locations: Array<{ id: string; name: string; latitude: number; longitude: number; radiusMeters: number }>;

  if (overrideLocationId) {
    const loc = await db.workLocation.findUnique({
      where: { id: overrideLocationId },
      select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true },
    });
    locations = loc ? [loc] : [];
  } else {
    const assignments = await db.employeeWorkAssignment.findMany({
      where: {
        profileId,
        effectiveDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      include: {
        workLocation: { select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true, isActive: true } },
      },
    });
    locations = assignments
      .map((a) => a.workLocation)
      .filter((l) => l.isActive);
  }

  if (locations.length === 0) {
    return { valid: false, nearestLocationId: null, nearestLocationName: null, distance: Infinity };
  }

  let nearest = locations[0];
  let minDist = haversineDistance(lat, lng, nearest.latitude, nearest.longitude);

  for (let i = 1; i < locations.length; i++) {
    const d = haversineDistance(lat, lng, locations[i].latitude, locations[i].longitude);
    if (d < minDist) {
      minDist = d;
      nearest = locations[i];
    }
  }

  return {
    valid: minDist <= nearest.radiusMeters,
    nearestLocationId: nearest.id,
    nearestLocationName: nearest.name,
    distance: minDist,
  };
}
