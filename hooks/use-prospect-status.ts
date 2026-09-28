"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProspectStatusesResult } from "@/lib/queries/prospect-status";

async function fetchProspectStatuses(): Promise<ProspectStatusesResult> {
  const res = await fetch("/api/prospect-statuses");
  if (!res.ok) throw new Error("Gagal memuat status prospek");
  return res.json() as Promise<ProspectStatusesResult>;
}

/** Daftar status prospek untuk dropdown & filter guestbook. Jarang berubah,
 *  jadi di-cache lama supaya tidak menambah round-trip di tiap drawer. */
export function useProspectStatuses() {
  return useQuery({
    queryKey: ["prospect-statuses"],
    queryFn: fetchProspectStatuses,
    staleTime: 10 * 60 * 1000,
  });
}
