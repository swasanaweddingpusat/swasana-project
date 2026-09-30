"use client";

import { Crown } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { SalesPerformanceItem } from "@/lib/queries/dashboard";

interface ManagerItem {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: { name: string } | null;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function PersonAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }): React.ReactElement {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-semibold text-primary-foreground">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}

export function TopPeopleSection({
  sales,
  managers,
}: {
  sales: SalesPerformanceItem[];
  managers: ManagerItem[];
}): React.ReactElement {
  const topSales = sales.slice(0, 3);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Crown weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h2 className="text-base font-semibold text-foreground">Foto Top Sales &amp; Manager</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-foreground">Top Sales</p>
          <div className="flex flex-wrap gap-5">
            {topSales.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada data sales.</p>
            ) : (
              topSales.map((person, index) => (
                <div key={person.profileId} className="flex min-w-20 flex-col items-center gap-2 text-center">
                  <div className="relative">
                    <PersonAvatar name={person.name} avatarUrl={person.avatarUrl} />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-gold)] text-[10px] font-bold text-foreground">
                      {index + 1}
                    </span>
                  </div>
                  <span className="max-w-24 truncate text-xs font-medium text-foreground">{person.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-foreground">Manager</p>
          <div className="flex flex-wrap gap-5">
            {managers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada data manager.</p>
            ) : (
              managers.map((manager) => {
                const name = manager.fullName ?? "Manager";
                return (
                  <div key={manager.id} className="flex min-w-20 flex-col items-center gap-2 text-center">
                    <PersonAvatar name={name} avatarUrl={manager.avatarUrl} />
                    <span className={cn("max-w-24 truncate text-xs font-medium text-foreground")}>{name}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
