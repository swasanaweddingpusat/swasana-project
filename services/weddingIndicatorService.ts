import { WeddingIndicatorFilters } from "@/lib/validations/weddingIndicator";

export interface WeddingIndicatorListItem {
  id: string;
  coupleName: string;
  eventDate: string;
  venue: { id: string; name: string };
  satisfactionScore: number | null;
  allowancePercentage: number | null;
  allowanceNominal: number | null;
  createdAt: string;
}

export interface WeddingIndicatorsResponse {
  data: WeddingIndicatorListItem[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export interface WeddingIndicatorDetailResponse {
  id: string;
  coupleName: string;
  eventDate: string;
  venueId: string;
  createdById: string;
  eventManagerName: string;
  eventManagerRating: number | null;
  woName: string | null;
  woRating: number | null;
  ballroomFacilitiesRating: number | null;
  ballroomCleanlinessRating: number | null;
  vendorsRating: number | null;
  salesRating: number | null;
  recommendationScore: number;
  satisfactionScore: number | null;
  allowancePercentage: number | null;
  allowanceNominal: number | null;
  questionnaireData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  venue: { id: string; name: string };
  createdBy: { id: string; fullName: string } | null;
}

export interface ShareStatusData {
  token: string;
  accessCode: string;
  status: string;
  viewedAt: string | null;
  lastEditedAt: string | null;
}

export interface ShareStatusResponse {
  share: ShareStatusData | null;
}

export async function fetchWeddingIndicators(
  filters: WeddingIndicatorFilters
): Promise<WeddingIndicatorsResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", filters.page.toString());
  if (filters.limit) params.set("limit", filters.limit.toString());
  if (filters.search) params.set("search", filters.search);
  if (filters.venueId) params.set("venueId", filters.venueId);
  if (filters.dateFrom)
    params.set("dateFrom", filters.dateFrom.toISOString());
  if (filters.dateTo) params.set("dateTo", filters.dateTo.toISOString());

  const res = await fetch(`/api/wedding-indicators?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch wedding indicators");
  return res.json() as Promise<WeddingIndicatorsResponse>;
}

export async function fetchWeddingIndicatorById(
  id: string
): Promise<WeddingIndicatorDetailResponse> {
  const res = await fetch(`/api/wedding-indicators/${id}`);
  if (!res.ok) throw new Error("Failed to fetch wedding indicator");
  return res.json() as Promise<WeddingIndicatorDetailResponse>;
}

export async function fetchShareStatus(
  indicatorId: string
): Promise<ShareStatusResponse> {
  const res = await fetch(
    `/api/wedding-indicator-share/status?indicatorId=${encodeURIComponent(indicatorId)}`
  );
  if (!res.ok) throw new Error("Failed to fetch share status");
  return res.json() as Promise<ShareStatusResponse>;
}
