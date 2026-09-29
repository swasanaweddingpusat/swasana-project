// Shared aggregation for the "Detail Status Database per Sales" breakdown —
// used by both the Bitrix24 Overview UI (accordion) and the PDF/Excel export,
// so the numbers rendered on screen always match what gets exported.

export interface SalesStatusRow {
  label: string;
  count: number;
}

export interface SalesStatusGroup {
  key: string;
  label: string;
  total: number;
  statuses: SalesStatusRow[];
}

interface DealLike {
  salesId: string;
  salesName: string;
  stageLabel: string;
}

export interface StatusClientRow {
  key: string;
  label: string;
  count: number;
}

interface NotDatabaseDealLike {
  salesId: string;
  salesName: string;
  hasVenue: boolean;
  issueLabel: string;
}

// Aggregates ALL deals by stage label (client status), regardless of sales —
// sorted by count descending. Powers the "Status Client" bar chart on the
// Bitrix24 Overview page.
export function buildStatusClientBreakdown(deals: { stageLabel: string }[]): StatusClientRow[] {
  const counts = new Map<string, number>();

  for (const deal of deals) {
    const label = deal.stageLabel || "Tanpa Status";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count);
}

// Groups deals by sales, then by stage label within each sales. Sales are
// sorted by total descending; stages within a sales are sorted by count
// descending (stable — ties keep the deals' original order).
export function buildSalesStatusBreakdown(deals: DealLike[]): SalesStatusGroup[] {
  const groups = new Map<string, { label: string; statusCounts: Map<string, number> }>();

  for (const deal of deals) {
    const key = deal.salesId || "UNKNOWN";
    const group = groups.get(key) ?? { label: deal.salesName || "Tidak ditetapkan", statusCounts: new Map() };
    const stage = deal.stageLabel || "Tanpa Status";
    group.statusCounts.set(stage, (group.statusCounts.get(stage) ?? 0) + 1);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, { label, statusCounts }]) => {
      const statuses = [...statusCounts.entries()]
        .map(([statusLabel, count]) => ({ label: statusLabel, count }))
        .sort((a, b) => b.count - a.count);
      const total = statuses.reduce((sum, s) => sum + s.count, 0);
      return { key, label, total, statuses };
    })
    .sort((a, b) => b.total - a.total);
}

// Groups deals that did NOT become a database entry (!hasVenue) by sales,
// then by issue label within each sales — mirrors buildSalesStatusBreakdown
// so the "Detail Data Tidak Jadi Database per Sales" card/export uses the
// same shape as "Detail Status Database per Sales". Blank issue labels are
// shown as "(blank)" to match the reference report.
export function buildNotDatabaseBreakdown(deals: NotDatabaseDealLike[]): SalesStatusGroup[] {
  const groups = new Map<string, { label: string; issueCounts: Map<string, number> }>();

  for (const deal of deals) {
    if (deal.hasVenue) continue;
    const key = deal.salesId || "UNKNOWN";
    const group = groups.get(key) ?? { label: deal.salesName || "Tidak ditetapkan", issueCounts: new Map() };
    const issue = deal.issueLabel || "(blank)";
    group.issueCounts.set(issue, (group.issueCounts.get(issue) ?? 0) + 1);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, { label, issueCounts }]) => {
      const statuses = [...issueCounts.entries()]
        .map(([issueLabel, count]) => ({ label: issueLabel, count }))
        .sort((a, b) => b.count - a.count);
      const total = statuses.reduce((sum, s) => sum + s.count, 0);
      return { key, label, total, statuses };
    })
    .sort((a, b) => b.total - a.total);
}
