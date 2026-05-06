import { Suspense } from "react";
import { getEventTypes } from "@/lib/queries/event-types";
import { EventTypeManager } from "./_components/event-type-manager";
import { EventTypeLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function EventTypesSettingsPage() {
  await requirePagePermission("settings-event-types");
  return (
    <Suspense fallback={<EventTypeLoading />}>
      <EventTypesContent />
    </Suspense>
  );
}

async function EventTypesContent() {
  const data = await getEventTypes();
  return <EventTypeManager initialData={data} />;
}
