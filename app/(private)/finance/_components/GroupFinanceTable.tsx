"use client";

import type { GroupFinanceRow } from "@/lib/queries/finance";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

// ─── Mini progress bar ────────────────────────────────────────────────────────

function AchievementBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-1.5 w-16 rounded-full bg-amber-100 overflow-hidden shrink-0">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs tabular-nums font-semibold text-amber-800 shrink-0">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  groups: GroupFinanceRow[];
}

export function GroupFinanceTable({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border shadow-sm p-6 text-center text-sm text-muted-foreground">
        Belum ada data group.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Breakdown per Group</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Finance summary tiap sales group (company-wide)
        </p>
      </div>

      {/* Scrollable on mobile */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Group
              </th>
              <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Kas Diterima
              </th>
              <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Piutang
              </th>
              <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Nilai Kontrak
              </th>
              <th className="px-4 sm:px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Achievement
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.map((g) => (
              <tr key={g.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 sm:px-5 py-3.5 font-medium text-foreground whitespace-nowrap">
                  {g.name}
                </td>
                <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums font-semibold text-foreground whitespace-nowrap">
                  {formatRp(g.kasDiterima)}
                </td>
                <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums text-foreground whitespace-nowrap">
                  {g.piutang > 0 ? (
                    <span className="font-medium text-orange-700">{formatRp(g.piutang)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 sm:px-5 py-3.5 text-right tabular-nums text-foreground whitespace-nowrap">
                  {formatRp(g.nilaiKontrak)}
                </td>
                <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                  <AchievementBar pct={g.achievementPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
