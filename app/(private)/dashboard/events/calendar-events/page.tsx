import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";
import { getCalendarEvents } from "@/lib/queries/calendar-events";
import { CalendarEventView } from "./_components/calendar-event-view";

export const metadata: Metadata = {
  title: "Calendar Event",
  description: "Lihat jadwal event di kalender",
};

export default async function CalendarEventsPage() {
  const session = await auth();
  const profileId = session?.user?.profileId ?? undefined;
  let dataScope: DataScope = "own";
  if (profileId) {
    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { dataScope: true } });
    if (profile) dataScope = profile.dataScope as DataScope;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const events = await getCalendarEvents(year, month, profileId, dataScope);

  return (
    <div className="flex flex-col mb-6 px-2">
      <CalendarEventView initialData={events} initialYear={year} initialMonth={month} />
    </div>
  );
}
