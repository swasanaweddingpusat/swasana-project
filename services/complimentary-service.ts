export interface ComplimentaryOption {
  id: string;
  name: string;
  price: number;
  description: string | null;
  isShowPrice: boolean;
  isActive: boolean;
}

export interface ComplimentaryListResult {
  items: ComplimentaryOption[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchComplimentaries(
  params: { search?: string; activeOnly?: boolean; page?: number; pageSize?: number } = {}
): Promise<ComplimentaryListResult> {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.activeOnly === false) sp.set("activeOnly", "false");
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));

  const res = await fetch(`/api/complimentaries?${sp.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch complimentaries (${res.status})`);
  return res.json() as Promise<ComplimentaryListResult>;
}
