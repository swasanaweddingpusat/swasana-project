import type { MemoItem } from "@/lib/queries/memos";

export async function fetchMemos(): Promise<MemoItem[]> {
  const res = await fetch("/api/memos");
  if (!res.ok) throw new Error("Failed to fetch memos");
  return res.json() as Promise<MemoItem[]>;
}
