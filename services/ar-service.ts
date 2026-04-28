import { fetchARBookings } from "@/actions/finance";
import type { ARBookingsResult } from "@/lib/queries/ar";

export async function getARBookingsClient(): Promise<ARBookingsResult> {
  const res = await fetchARBookings();
  if (!res.success) throw new Error(res.error);
  return res.data;
}
