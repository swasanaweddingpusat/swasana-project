import type { Metadata } from "next";
import { MemoDetailClient } from "./_components/MemoDetailClient";

export const metadata: Metadata = { title: "Detail Memo — Internal FAQ" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemoDetailClient memoId={id} />;
}
