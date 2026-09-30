import type {
  PaginatedGuestbookEntries,
  GuestbookFilterOptions,
  GuestVisitHistoryItem,
  GuestbookFunnelReportResult,
  GuestbookFunnelDrilldownKey,
  GuestbookFunnelBucketEntry,
} from "@/lib/queries/guestbookEntries";

export async function fetchGuestbookEntries(
  params?: GuestbookFilterOptions & { page?: number; pageSize?: number }
): Promise<PaginatedGuestbookEntries> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.venueIds?.length) searchParams.set("venueIds", params.venueIds.join(","));
  if (params?.hostId) searchParams.set("hostId", params.hostId);
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.categories?.length) searchParams.set("categories", params.categories.join(","));
  if (params?.statusIds?.length) searchParams.set("statusIds", params.statusIds.join(","));
  if (params?.sourceOfInformationIds?.length) searchParams.set("sourceOfInformationIds", params.sourceOfInformationIds.join(","));
  if (params?.festivalIds?.length) searchParams.set("festivalIds", params.festivalIds.join(","));
  if (params?.dateField) searchParams.set("dateField", params.dateField);
  const qs = searchParams.toString();

  const res = await fetch(`/api/guestbook${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch guestbook entries");
  return res.json() as Promise<PaginatedGuestbookEntries>;
}

export async function fetchGuestVisitHistory(entryId: string): Promise<GuestVisitHistoryItem[]> {
  const res = await fetch(`/api/guestbook/${entryId}/visit-history`);
  if (!res.ok) throw new Error("Failed to fetch guest visit history");
  const { history } = (await res.json()) as { history: GuestVisitHistoryItem[] };
  return history;
}

export async function fetchGuestbookFunnelReport(
  params?: GuestbookFilterOptions
): Promise<GuestbookFunnelReportResult> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.venueIds?.length) searchParams.set("venueIds", params.venueIds.join(","));
  if (params?.hostId) searchParams.set("hostId", params.hostId);
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.categories?.length) searchParams.set("categories", params.categories.join(","));
  if (params?.statusIds?.length) searchParams.set("statusIds", params.statusIds.join(","));
  if (params?.sourceOfInformationIds?.length) searchParams.set("sourceOfInformationIds", params.sourceOfInformationIds.join(","));
  if (params?.festivalIds?.length) searchParams.set("festivalIds", params.festivalIds.join(","));
  const qs = searchParams.toString();

  const res = await fetch(`/api/guestbook/funnel-report${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch guestbook funnel report");
  return res.json() as Promise<GuestbookFunnelReportResult>;
}

export async function fetchGuestbookFunnelBucketEntries(
  bucket: GuestbookFunnelDrilldownKey,
  params?: Pick<GuestbookFilterOptions, "venueIds" | "hostId" | "dateFrom" | "dateTo">
): Promise<GuestbookFunnelBucketEntry[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("bucket", bucket);
  if (params?.venueIds?.length) searchParams.set("venueIds", params.venueIds.join(","));
  if (params?.hostId) searchParams.set("hostId", params.hostId);
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);

  const res = await fetch(`/api/guestbook/funnel-bucket?${searchParams.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch guestbook funnel bucket entries");
  return res.json() as Promise<GuestbookFunnelBucketEntry[]>;
}
