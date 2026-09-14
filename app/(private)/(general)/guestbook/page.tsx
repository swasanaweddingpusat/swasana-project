import { Metadata } from "next";
import { GuestbookClient } from "./_components/GuestbookClient";

export const metadata: Metadata = { title: "Guestbook" };

export default function Page() {
  return <GuestbookClient />;
}
