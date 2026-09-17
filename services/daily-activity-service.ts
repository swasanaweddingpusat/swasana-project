import type { DailyActivitiesResult } from "@/lib/queries/daily-activity";
import type { DailyActivityFilterInput } from "@/lib/validations/daily-activity";

export type FetchDailyActivitiesParams = Partial<
  Pick<
    DailyActivityFilterInput,
    | "search"
    | "progressStatus"
    | "segmentId"
    | "salesId"
    | "activityDateFrom"
    | "activityDateTo"
    | "siteVisitFrom"
    | "siteVisitTo"
    | "page"
    | "pageSize"
  >
>;

export async function fetchDailyActivities(
  params: FetchDailyActivitiesParams = {},
): Promise<DailyActivitiesResult> {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.progressStatus) sp.set("progressStatus", params.progressStatus);
  if (params.segmentId) sp.set("segmentId", params.segmentId);
  if (params.salesId) sp.set("salesId", params.salesId);
  if (params.activityDateFrom) sp.set("activityDateFrom", params.activityDateFrom);
  if (params.activityDateTo) sp.set("activityDateTo", params.activityDateTo);
  if (params.siteVisitFrom) sp.set("siteVisitFrom", params.siteVisitFrom);
  if (params.siteVisitTo) sp.set("siteVisitTo", params.siteVisitTo);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));

  const res = await fetch(`/api/daily-activities?${sp.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch daily activities (${res.status})`);
  return res.json() as Promise<DailyActivitiesResult>;
}
