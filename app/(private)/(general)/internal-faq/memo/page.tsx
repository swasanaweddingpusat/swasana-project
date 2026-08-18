import type { Metadata } from "next";
import { MemoClient } from "./_components/MemoClient";

export const metadata: Metadata = { title: "Memo — Internal FAQ" };

export default function Page() {
  return <MemoClient />;
}
