import type {
  ProcurementListResult,
  ProcurementItem,
  ProcurementSummaryResult,
  SummaryByVenueResult,
  AnnouncementListResult,
  AnnouncementItem,
  VenueBudgetListResult,
  VenueBudgetItem,
} from "@/lib/queries/procurement";
import type {
  CreateProcurementInput,
  UpdateProcurementInput,
  ApproveProcurementInput,
  ProcurementFilterInput,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  CreateVenueBudgetInput,
  UpdateVenueBudgetInput,
} from "@/lib/validations/procurement";

// ─── Procurement Items ────────────────────────────────────────────────────────

export async function fetchProcurementList(
  params: Partial<ProcurementFilterInput> = {}
): Promise<ProcurementListResult> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.venueId) query.set("venueId", params.venueId);
  if (params.division) query.set("division", params.division);
  if (params.status) query.set("status", params.status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const res = await fetch(`/api/procurement?${query}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal memuat data pengadaan");
  }
  return res.json();
}

export async function fetchProcurementById(id: string): Promise<ProcurementItem> {
  const res = await fetch(`/api/procurement/${id}`);
  if (!res.ok) throw new Error("Gagal memuat detail pengadaan");
  return res.json();
}

export async function createProcurement(data: CreateProcurementInput): Promise<ProcurementItem> {
  const res = await fetch("/api/procurement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal membuat pengadaan");
  }
  return res.json();
}

export async function updateProcurement(
  id: string,
  data: UpdateProcurementInput
): Promise<ProcurementItem> {
  const res = await fetch(`/api/procurement/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal memperbarui pengadaan");
  }
  return res.json();
}

export async function deleteProcurement(id: string): Promise<void> {
  const res = await fetch(`/api/procurement/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus pengadaan");
  }
}

export async function approveProcurement(
  id: string,
  data: ApproveProcurementInput
): Promise<ProcurementItem> {
  const res = await fetch(`/api/procurement/${id}/approve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal memproses approval");
  }
  return res.json();
}

export async function approveProcurements(ids: string[]): Promise<void> {
  const res = await fetch(`/api/procurement/approve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal memproses approval massal");
  }
}

export async function fetchAllPendingIds(
  params: Partial<Omit<ProcurementFilterInput, "page" | "limit">> = {}
): Promise<string[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.venueId) query.set("venueId", params.venueId);
  if (params.division) query.set("division", params.division);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);

  const res = await fetch(`/api/procurement/pending-ids?${query}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal mengambil ID pengajuan");
  }
  const data = (await res.json()) as { ids: string[] };
  return data.ids;
}

export async function fetchProcurementSummary(venueId?: string): Promise<ProcurementSummaryResult> {
  const query = venueId ? `?venueId=${venueId}` : "";
  const res = await fetch(`/api/procurement/summary${query}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal memuat ringkasan pengadaan");
  }
  return res.json();
}

export async function exportProcurement(
  params: Partial<ProcurementFilterInput> & { format: "csv" | "excel" | "pdf" }
): Promise<Blob> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.venueId) query.set("venueId", params.venueId);
  if (params.division) query.set("division", params.division);
  if (params.status) query.set("status", params.status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  query.set("format", params.format);

  const res = await fetch(`/api/procurement/export?${query}`);
  if (!res.ok) throw new Error("Gagal mengekspor data pengadaan");
  return res.blob();
}

// ─── Announcements ────────────────────────────────────────────────────────────

export async function fetchAnnouncementList(
  page = 1,
  limit = 20
): Promise<AnnouncementListResult> {
  const res = await fetch(`/api/procurement/announcements?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error("Gagal memuat pengumuman");
  return res.json();
}

export async function createAnnouncement(
  data: CreateAnnouncementInput
): Promise<AnnouncementItem> {
  const res = await fetch("/api/procurement/announcements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal membuat pengumuman");
  }
  return res.json();
}

export async function updateAnnouncement(
  id: string,
  data: UpdateAnnouncementInput
): Promise<AnnouncementItem> {
  const res = await fetch(`/api/procurement/announcements/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal memperbarui pengumuman");
  }
  return res.json();
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const res = await fetch(`/api/procurement/announcements/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus pengumuman");
  }
}

// ─── Summary by Venue ────────────────────────────────────────────────────────

export async function fetchSummaryByVenue(
  period?: string
): Promise<SummaryByVenueResult> {
  const query = period ? `?period=${period}` : "";
  const res = await fetch(`/api/procurement/summary/by-venue${query}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal memuat ringkasan per venue");
  }
  return res.json();
}

// ─── Venue Budgets ───────────────────────────────────────────────────────────

export async function fetchVenueBudgetList(
  period?: string,
  page = 1,
  limit = 20
): Promise<VenueBudgetListResult> {
  const query = new URLSearchParams();
  if (period) query.set("period", period);
  query.set("page", String(page));
  query.set("limit", String(limit));
  const res = await fetch(`/api/procurement/venue-budgets?${query}`);
  if (!res.ok) throw new Error("Gagal memuat data saldo venue");
  return res.json();
}

export async function createVenueBudget(
  data: CreateVenueBudgetInput
): Promise<VenueBudgetItem> {
  const res = await fetch("/api/procurement/venue-budgets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal membuat saldo venue");
  }
  return res.json();
}

export async function updateVenueBudget(
  id: string,
  data: UpdateVenueBudgetInput
): Promise<VenueBudgetItem> {
  const res = await fetch(`/api/procurement/venue-budgets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal mengupdate saldo venue");
  }
  return res.json();
}

export async function deleteVenueBudget(id: string): Promise<void> {
  const res = await fetch(`/api/procurement/venue-budgets/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus saldo venue");
  }
}
