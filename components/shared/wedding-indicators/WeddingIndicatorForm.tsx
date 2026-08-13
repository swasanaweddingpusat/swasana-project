"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RatingSection } from "./RatingSection";
import { ProjectManagerSection } from "./ProjectManagerSection";
import { NpsSlider } from "./NpsSlider";
import { PostWeddingWishes } from "./PostWeddingWishes";
import { AllowanceSummary } from "./AllowanceSummary";
import {
  SignatureCaptureSection,
  type SignaturesData,
} from "./SignatureCaptureSection";
import { useCreateWeddingIndicator, useUpdateWeddingIndicator } from "@/hooks/useWeddingIndicators";
import { toast } from "sonner";

interface ProjectManager {
  name: string;
  rating: number | null;
  notes: string;
}

interface PostWeddingWishesData {
  logamMulia: boolean;
  mobil: boolean;
  rumah: boolean;
  honeymoon: boolean;
  romanticDinner: boolean;
  umroh: boolean;
  custom1: string;
  custom2: string;
}

export interface QuestionnaireData {
  projectManagers?: ProjectManager[];
  postWeddingWishes?: PostWeddingWishesData;
  signatures?: Record<string, string | null>;
  signatureNames?: Record<string, string>;
  signatureDate?: string;
  eventManagerNotes?: string;
  woNotes?: string;
  ballroomFacilitiesNotes?: string;
  ballroomCleanlinessNotes?: string;
  vendorsNotes?: string;
  salesNotes?: string;
  notes?: string;
}

interface VenueOption {
  id: string;
  name: string;
}

interface WeddingIndicatorFormProps {
  mode: "create" | "edit" | "public";
  venues: VenueOption[];
  initialData?: {
    id: string;
    coupleName: string;
    eventDate: string;
    venueId: string;
    eventManagerName: string;
    eventManagerRating: number | null;
    eventManagerNotes: string;
    woName: string | null;
    woRating: number | null;
    woNotes: string;
    ballroomFacilitiesRating: number | null;
    ballroomFacilitiesNotes: string;
    ballroomCleanlinessRating: number | null;
    ballroomCleanlinessNotes: string;
    vendorsRating: number | null;
    vendorsNotes: string;
    salesRating: number | null;
    salesNotes: string;
    recommendationScore: number;
    questionnaireData: QuestionnaireData | null;
    notes: string;
    satisfactionScore: number | null;
    allowancePercentage: number | null;
    allowanceNominal: number | null;
  };
  shareToken?: string;
  shareAccessCode?: string;
  venueName?: string;
  onPublicSaveSuccess?: () => void;
}

export function WeddingIndicatorForm({
  mode,
  venues,
  initialData,
  shareToken,
  shareAccessCode,
  venueName,
  onPublicSaveSuccess,
}: WeddingIndicatorFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const createMutation = useCreateWeddingIndicator();
  const updateMutation = useUpdateWeddingIndicator();

  // Basic Info
  const [coupleName, setCoupleName] = useState(initialData?.coupleName || "");
  const [eventDate, setEventDate] = useState(
    initialData?.eventDate
      ? new Date(initialData.eventDate).toISOString().split("T")[0]
      : ""
  );
  const [venueId, setVenueId] = useState(initialData?.venueId || "");

  // Event Manager
  const [eventManagerName, setEventManagerName] = useState(
    initialData?.eventManagerName || ""
  );
  const [eventManagerRating, setEventManagerRating] = useState(
    initialData?.eventManagerRating || null
  );
  const [eventManagerNotes, setEventManagerNotes] = useState(
    initialData?.eventManagerNotes || ""
  );

  // Project Managers
  const [projectManagers, setProjectManagers] = useState<ProjectManager[]>(
    initialData?.questionnaireData?.projectManagers || []
  );

  // Wedding Organizer
  const [woName, setWoName] = useState(initialData?.woName || "");
  const [woRating, setWoRating] = useState(initialData?.woRating || null);
  const [woNotes, setWoNotes] = useState(initialData?.woNotes || "");

  // Ballroom
  const [ballroomFacilitiesRating, setBallroomFacilitiesRating] = useState(
    initialData?.ballroomFacilitiesRating || null
  );
  const [ballroomFacilitiesNotes, setBallroomFacilitiesNotes] = useState(
    initialData?.ballroomFacilitiesNotes || ""
  );

  const [ballroomCleanlinessRating, setBallroomCleanlinessRating] = useState(
    initialData?.ballroomCleanlinessRating || null
  );
  const [ballroomCleanlinessNotes, setBallroomCleanlinessNotes] = useState(
    initialData?.ballroomCleanlinessNotes || ""
  );

  // Vendors & Sales
  const [vendorsRating, setVendorsRating] = useState(
    initialData?.vendorsRating || null
  );
  const [vendorsNotes, setVendorsNotes] = useState(
    initialData?.vendorsNotes || ""
  );

  const [salesRating, setSalesRating] = useState(
    initialData?.salesRating || null
  );
  const [salesNotes, setSalesNotes] = useState(initialData?.salesNotes || "");

  // NPS & Wishes
  const [recommendationScore, setRecommendationScore] = useState(
    initialData?.recommendationScore || 5
  );
  const [postWeddingWishes, setPostWeddingWishes] =
    useState<PostWeddingWishesData>(
      initialData?.questionnaireData?.postWeddingWishes || {
        logamMulia: false,
        mobil: false,
        rumah: false,
        honeymoon: false,
        romanticDinner: false,
        umroh: false,
        custom1: "",
        custom2: "",
      }
    );

  const [notes, setNotes] = useState(initialData?.notes || "");

  // Signatures
  const [signaturesData, setSignaturesData] = useState<SignaturesData>(() => {
    const qd = initialData?.questionnaireData;
    const existingSigs = qd?.signatures;
    const existingNames = qd?.signatureNames;
    const existingDate = qd?.signatureDate;

    const slots: Record<string, { name: string; signature: string | null }> = {};
    const keys = [
      "pasangan",
      "manager_event",
      "manager_pm",
      "general_manager",
      "director_finance",
      "operational_director",
    ];
    for (const key of keys) {
      const sig = existingSigs?.[key];
      slots[key] = {
        name: existingNames?.[key] || "",
        signature: typeof sig === "string" ? sig : null,
      };
    }

    return {
      signatureDate: existingDate || "",
      slots,
    };
  });

  // Calculate satisfaction score
  const [satisfactionScore, setSatisfactionScore] = useState<number | null>(
    initialData?.satisfactionScore || null
  );
  const [allowancePercentage, setAllowancePercentage] = useState<
    number | null
  >(initialData?.allowancePercentage || null);
  const [allowanceNominal, setAllowanceNominal] = useState<number | null>(
    initialData?.allowanceNominal || null
  );

  useEffect(() => {
    // Calculate when ratings change
    const ratings = [];
    if (eventManagerRating) ratings.push(eventManagerRating);
    if (woRating) ratings.push(woRating);
    if (ballroomFacilitiesRating) ratings.push(ballroomFacilitiesRating);
    if (ballroomCleanlinessRating) ratings.push(ballroomCleanlinessRating);
    if (vendorsRating) ratings.push(vendorsRating);
    if (salesRating) ratings.push(salesRating);
    projectManagers.forEach((pm) => {
      if (pm.rating) ratings.push(pm.rating);
    });

    if (ratings.length === 0) {
      setSatisfactionScore(null);
      setAllowancePercentage(null);
      setAllowanceNominal(null);
      return;
    }

    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    setSatisfactionScore(avg);

    if (avg >= 3.6) {
      setAllowancePercentage(100);
      setAllowanceNominal(1000000);
    } else if (avg >= 3.1) {
      setAllowancePercentage(80);
      setAllowanceNominal(800000);
    } else if (avg >= 2.1) {
      setAllowancePercentage(60);
      setAllowanceNominal(600000);
    } else if (avg >= 1.1) {
      setAllowancePercentage(30);
      setAllowanceNominal(300000);
    } else {
      setAllowancePercentage(0);
      setAllowanceNominal(0);
    }
  }, [
    eventManagerRating,
    woRating,
    ballroomFacilitiesRating,
    ballroomCleanlinessRating,
    vendorsRating,
    salesRating,
    projectManagers,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const signatures: Record<string, string | null> = {};
      const signatureNamesMap: Record<string, string> = {};
      for (const [key, slot] of Object.entries(signaturesData.slots)) {
        signatures[key] = slot.signature;
        signatureNamesMap[key] = slot.name;
      }

      if (mode === "public") {
        const payload = {
          token: shareToken,
          accessCode: shareAccessCode,
          coupleName,
          eventDate,
          venueId,
          eventManagerName,
          eventManagerRating,
          eventManagerNotes,
          projectManagers,
          woName,
          woRating,
          woNotes,
          ballroomFacilitiesRating,
          ballroomFacilitiesNotes,
          ballroomCleanlinessRating,
          ballroomCleanlinessNotes,
          vendorsRating,
          vendorsNotes,
          salesRating,
          salesNotes,
          recommendationScore,
          postWeddingWishes,
          notes,
          signatures,
          signatureNames: signatureNamesMap,
          signatureDate: signaturesData.signatureDate,
        };

        const res = await fetch("/api/wedding-indicator-share/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await res.json();
        if (res.ok && result.success) {
          onPublicSaveSuccess?.();
        } else {
          toast.error(result.error || "Gagal menyimpan kuesioner");
        }
      } else {
        const formData = new FormData();
        formData.set("coupleName", coupleName);
        formData.set("eventDate", eventDate);
        formData.set("venueId", venueId);
        formData.set("eventManagerName", eventManagerName);
        formData.set("eventManagerRating", String(eventManagerRating || ""));
        formData.set("eventManagerNotes", eventManagerNotes);
        formData.set("projectManagers", JSON.stringify(projectManagers));
        formData.set("woName", woName);
        formData.set("woRating", String(woRating || ""));
        formData.set("woNotes", woNotes);
        formData.set("ballroomFacilitiesRating", String(ballroomFacilitiesRating || ""));
        formData.set("ballroomFacilitiesNotes", ballroomFacilitiesNotes);
        formData.set("ballroomCleanlinessRating", String(ballroomCleanlinessRating || ""));
        formData.set("ballroomCleanlinessNotes", ballroomCleanlinessNotes);
        formData.set("vendorsRating", String(vendorsRating || ""));
        formData.set("vendorsNotes", vendorsNotes);
        formData.set("salesRating", String(salesRating || ""));
        formData.set("salesNotes", salesNotes);
        formData.set("recommendationScore", String(recommendationScore));
        formData.set("postWeddingWishes", JSON.stringify(postWeddingWishes));
        formData.set("notes", notes);
        formData.set("signatures", JSON.stringify(signatures));
        formData.set("signatureNames", JSON.stringify(signatureNamesMap));
        formData.set("signatureDate", signaturesData.signatureDate);

        let result;
        if (mode === "create") {
          result = await createMutation.mutateAsync(formData);
        } else {
          result = await updateMutation.mutateAsync({ id: initialData!.id, formData });
        }

        if (result.success) {
          router.push(`/wedding-indicators/${result.id}`);
        } else {
          toast.error(result.error || "Gagal menyimpan");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan kuesioner");
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info Dasar */}
      <div className="space-y-4 rounded-2xl bg-card p-5 border">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Info Dasar
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="coupleName" className="text-sm">
              Nama Pasangan
            </Label>
            <Input
              id="coupleName"
              type="text"
              value={coupleName}
              onChange={(e) => setCoupleName(e.target.value)}
              placeholder="Nama pasangan"
              required
              disabled={loading}
              className="mt-2"
            />
          </div>

          {mode === "public" ? (
            <div>
              <Label className="text-sm">Venue</Label>
              <Input
                value={venueName || ""}
                readOnly
                disabled
                className="mt-2"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="venueId" className="text-sm">
                Venue
              </Label>
              <Select value={venueId || undefined} onValueChange={setVenueId} disabled={loading}>
                <SelectTrigger id="venueId" className="mt-2">
                  <SelectValue placeholder="Pilih venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="md:col-span-2">
            <Label htmlFor="eventDate" className="text-sm">
              Tanggal Acara
            </Label>
            <Input
              id="eventDate"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
              disabled={loading}
              className="mt-2"
            />
          </div>
        </div>
      </div>

      {/* Rating Sections */}
      <RatingSection
        title="Event Manager"
        personName={eventManagerName}
        onPersonNameChange={setEventManagerName}
        rating={eventManagerRating}
        onRatingChange={setEventManagerRating}
        notes={eventManagerNotes}
        onNotesChange={setEventManagerNotes}
        disabled={loading}
      />

      <ProjectManagerSection
        projectManagers={projectManagers}
        onChange={setProjectManagers}
        disabled={loading}
      />

      <RatingSection
        title="Wedding Organizer"
        personName={woName}
        onPersonNameChange={setWoName}
        rating={woRating}
        onRatingChange={setWoRating}
        notes={woNotes}
        onNotesChange={setWoNotes}
        disabled={loading}
      />

      <RatingSection
        title="Fasilitas Ballroom"
        rating={ballroomFacilitiesRating}
        onRatingChange={setBallroomFacilitiesRating}
        notes={ballroomFacilitiesNotes}
        onNotesChange={setBallroomFacilitiesNotes}
        disabled={loading}
      />

      <RatingSection
        title="Kebersihan Ballroom"
        rating={ballroomCleanlinessRating}
        onRatingChange={setBallroomCleanlinessRating}
        notes={ballroomCleanlinessNotes}
        onNotesChange={setBallroomCleanlinessNotes}
        disabled={loading}
      />

      <RatingSection
        title="Vendor Partisipan"
        rating={vendorsRating}
        onRatingChange={setVendorsRating}
        notes={vendorsNotes}
        onNotesChange={setVendorsNotes}
        disabled={loading}
      />

      <RatingSection
        title="Sales"
        rating={salesRating}
        onRatingChange={setSalesRating}
        notes={salesNotes}
        onNotesChange={setSalesNotes}
        disabled={loading}
      />

      <NpsSlider
        value={recommendationScore}
        onChange={setRecommendationScore}
        disabled={loading}
      />

      <PostWeddingWishes
        data={postWeddingWishes}
        onChange={setPostWeddingWishes}
        disabled={loading}
      />

      {/* Additional Notes */}
      <div className="space-y-4 rounded-2xl bg-card p-5 border">
        <Label htmlFor="notes" className="text-base font-semibold">
          Catatan Tambahan
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan tambahan tentang pernikahan..."
          disabled={loading}
          className="min-h-24"
        />
      </div>

      {/* Signatures */}
      <SignatureCaptureSection
        data={signaturesData}
        onChange={setSignaturesData}
        disabled={loading}
      />

      {/* Allowance Summary */}
      <AllowanceSummary
        satisfactionScore={satisfactionScore}
        allowancePercentage={allowancePercentage}
        allowanceNominal={allowanceNominal}
      />

      {/* Actions */}
      <div className="flex gap-2 print:hidden">
        <Button
          type="submit"
          disabled={loading}
          size="lg"
        >
          {loading
            ? "Menyimpan..."
            : mode === "create"
              ? "Buat Kuesioner"
              : mode === "public"
                ? "Simpan Kuesioner"
                : "Simpan Perubahan"}
        </Button>
        {mode === "edit" && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handlePrint}
            disabled={loading}
          >
            Print
          </Button>
        )}
        {mode !== "public" && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => router.back()}
            disabled={loading}
          >
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}
