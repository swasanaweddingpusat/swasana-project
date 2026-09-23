import { Metadata } from "next";
import { GuestbookClient } from "./_components/GuestbookClient";

export const metadata: Metadata = { title: "Guest Book" };

export default function Page() {
  return <GuestbookClient />;
}
