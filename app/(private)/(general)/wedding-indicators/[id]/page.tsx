import { requirePermission, hasPermission } from "@/lib/permissions";
import { getWeddingIndicatorById } from "@/lib/queries/weddingIndicators";
import { getVenues } from "@/lib/queries/venues";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { WeddingIndicatorForm } from "@/components/shared/wedding-indicators/WeddingIndicatorForm";
import { SignaturesSection } from "@/components/shared/wedding-indicators/SignaturesSection";
import { ShareButton } from "./_components/ShareButton";

export default async function WeddingIndicatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, error } = await requirePermission({
    module: "vendor-specialist",
    action: "view",
  });

  if (error || !session) {
    redirect("/forbidden");
  }

  const { id } = await params;

  // Get the indicator
  const indicator = await getWeddingIndicatorById(id);
  if (!indicator) {
    notFound();
  }

  const isAdmin = session.user.isSuperAdmin;
  const canEditPermission = await hasPermission(session.user.roleId, "vendor-specialist", "edit");
  const canEdit = isAdmin || canEditPermission || session.user.id === indicator.createdById;

  // Get venue and venues list
  const [venue, allVenues] = await Promise.all([
    db.venue.findUnique({
      where: { id: indicator.venueId },
      select: { id: true, name: true },
    }),
    getVenues(),
  ]);

  const venues = allVenues.map((v) => ({ id: v.id, name: v.name }));

  // Prepare initial data
  const questionnaireData = (indicator.questionnaireData as {
    eventManagerNotes?: string;
    woNotes?: string;
    ballroomFacilitiesNotes?: string;
    ballroomCleanlinessNotes?: string;
    vendorsNotes?: string;
    salesNotes?: string;
    notes?: string;
    signatures?: Record<string, string | Record<string, unknown> | null>;
    signatureNames?: Record<string, string>;
    signatureDate?: string;
  } | null) ?? {};

  const initialData = {
    ...indicator,
    questionnaireData: questionnaireData as {
      projectManagers?: Array<{ name: string; rating: number | null; notes: string }>;
      postWeddingWishes?: {
        logamMulia: boolean;
        mobil: boolean;
        rumah: boolean;
        honeymoon: boolean;
        romanticDinner: boolean;
        umroh: boolean;
        custom1: string;
        custom2: string;
      };
      signatures?: Record<string, string | null>;
      signatureNames?: Record<string, string>;
      signatureDate?: string;
    } | null,
    eventDate: indicator.eventDate.toISOString().split("T")[0],
    eventManagerNotes: questionnaireData.eventManagerNotes || "",
    woNotes: questionnaireData.woNotes || "",
    ballroomFacilitiesNotes: questionnaireData.ballroomFacilitiesNotes || "",
    ballroomCleanlinessNotes: questionnaireData.ballroomCleanlinessNotes || "",
    vendorsNotes: questionnaireData.vendorsNotes || "",
    salesNotes: questionnaireData.salesNotes || "",
    notes: questionnaireData.notes || "",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            {indicator.coupleName}
          </h1>
          <p className="text-muted-foreground mt-2">
            {new Date(indicator.eventDate).toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })} • {venue?.name || indicator.venueId}
          </p>
        </div>
        {canEdit && (
          <ShareButton
            indicatorId={indicator.id}
            coupleName={indicator.coupleName}
          />
        )}
      </div>

      {canEdit ? (
        <WeddingIndicatorForm
          mode="edit"
          venues={venues}
          initialData={initialData}
        />
      ) : (
        <>
          <SignaturesSection
            signatures={questionnaireData.signatures || null}
            signatureNames={questionnaireData.signatureNames || null}
            signatureDate={questionnaireData.signatureDate || null}
          />
          <div className="rounded-lg bg-muted/50 p-4 border">
            <p className="text-sm text-muted-foreground">
              Anda tidak memiliki akses untuk mengedit kuesioner ini.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
