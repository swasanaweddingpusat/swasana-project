"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChartSquare,
  ClipboardText,
  Pen,
  TrashBinTrash,
  AddCircle,
  Star,
  GraphUp,
  Buildings,
} from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useEmployees } from "@/hooks/use-employees";
import {
  usePerformanceReviews,
  useCreatePerformanceReview,
  useUpdatePerformanceReview,
  useDeletePerformanceReview,
  useKpis,
  useCreateKpi,
  useUpdateKpi,
  useDeleteKpi,
} from "@/hooks/use-hr-performance";
import type { PerformanceReviewItem, KpiItem } from "@/lib/queries/hrPerformance";

// ─── Constants ────────────────────────────────────────────────────────────────

const REVIEW_STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu",
  IN_PROGRESS: "Berlangsung",
  COMPLETED: "Selesai",
  REJECTED: "Ditolak",
};

const REVIEW_STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"] as const;

// ─── Form Types ───────────────────────────────────────────────────────────────

type ReviewForm = {
  profileId: string;
  periodStartDate: string;
  periodEndDate: string;
  rating: string;
  strengths: string;
  comments: string;
  status: string;
};

type KpiForm = {
  name: string;
  description: string;
  department: string;
  targetValue: string;
  achievedValue: string;
  unit: string;
  periodStartDate: string;
  periodEndDate: string;
  progressPercentage: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toNumber(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function reviewStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "COMPLETED") return "default";
  if (status === "REJECTED") return "destructive";
  if (status === "IN_PROGRESS") return "secondary";
  return "outline";
}

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          weight="BoldDuotone"
          className={`h-3.5 w-3.5 ${i < full ? "text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{clamped.toFixed(0)}%</span>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-heading font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const EMPTY_REVIEW_FORM: ReviewForm = {
  profileId: "",
  periodStartDate: "",
  periodEndDate: "",
  rating: "3",
  strengths: "",
  comments: "",
  status: "PENDING",
};

const EMPTY_KPI_FORM: KpiForm = {
  name: "",
  description: "",
  department: "",
  targetValue: "",
  achievedValue: "0",
  unit: "",
  periodStartDate: "",
  periodEndDate: "",
  progressPercentage: "0",
};

export function ManajemenKinerjaClient() {
  const { data: reviews = [] } = usePerformanceReviews();
  const { data: kpis = [] } = useKpis();
  const { data: employeesResult } = useEmployees({ page: 1, limit: 200, status: "active" });

  const createReviewMutation = useCreatePerformanceReview();
  const updateReviewMutation = useUpdatePerformanceReview();
  const deleteReviewMutation = useDeletePerformanceReview();
  const createKpiMutation = useCreateKpi();
  const updateKpiMutation = useUpdateKpi();
  const deleteKpiMutation = useDeleteKpi();

  const employees = useMemo(() => employeesResult?.data ?? [], [employeesResult?.data]);

  const [reviewForm, setReviewForm] = useState<ReviewForm>(EMPTY_REVIEW_FORM);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);

  const [kpiForm, setKpiForm] = useState<KpiForm>(EMPTY_KPI_FORM);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [kpiDrawerOpen, setKpiDrawerOpen] = useState(false);

  // Set default employee when employees load
  useEffect(() => {
    if (!reviewForm.profileId && employees[0]?.id) {
      setReviewForm((current) => ({ ...current, profileId: employees[0].id }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees.length]);

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    totalReviews: reviews.length,
    completedReviews: reviews.filter((r) => r.status === "COMPLETED").length,
    avgRating:
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0,
    totalKpis: kpis.length,
  }), [reviews, kpis]);

  // ─── Review Handlers ────────────────────────────────────────────────────────

  function handleEditReview(review: PerformanceReviewItem) {
    setEditingReviewId(review.id);
    setReviewForm({
      profileId: review.profileId,
      periodStartDate: toDateInputValue(review.periodStartDate),
      periodEndDate: toDateInputValue(review.periodEndDate),
      rating: String(review.rating),
      strengths: review.strengths ?? "",
      comments: review.comments ?? "",
      status: review.status,
    });
    setReviewDrawerOpen(true);
  }

  function handleCancelEditReview() {
    setEditingReviewId(null);
    setReviewForm(EMPTY_REVIEW_FORM);
    setReviewDrawerOpen(false);
  }

  async function handleSubmitReview() {
    if (!reviewForm.profileId) {
      toast.error("Karyawan wajib dipilih");
      return;
    }
    if (!reviewForm.periodStartDate || !reviewForm.periodEndDate) {
      toast.error("Periode review wajib diisi");
      return;
    }

    const payload = {
      profileId: reviewForm.profileId,
      periodStartDate: new Date(reviewForm.periodStartDate),
      periodEndDate: new Date(reviewForm.periodEndDate),
      rating: toNumber(reviewForm.rating),
      strengths: reviewForm.strengths.trim() || undefined,
      comments: reviewForm.comments.trim() || undefined,
      status: reviewForm.status as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED",
    };

    if (editingReviewId) {
      const result = await updateReviewMutation.mutateAsync({
        id: editingReviewId,
        data: payload,
      });
      if (result.success) {
        toast.success("Review kinerja diperbarui");
        handleCancelEditReview();
        return;
      }
      toast.error(result.error ?? "Gagal memperbarui review kinerja");
      return;
    }

    const result = await createReviewMutation.mutateAsync(payload);
    if (result.success) {
      toast.success("Review kinerja dibuat");
      setReviewForm((current) => ({
        ...EMPTY_REVIEW_FORM,
        profileId: current.profileId,
      }));
      setReviewDrawerOpen(false);
      return;
    }
    toast.error(result.error ?? "Gagal membuat review kinerja");
  }

  async function handleDeleteReview(id: string) {
    const result = await deleteReviewMutation.mutateAsync(id);
    if (result.success) {
      toast.success("Review kinerja dihapus");
      return;
    }
    toast.error(result.error ?? "Gagal menghapus review kinerja");
  }

  // ─── KPI Handlers ───────────────────────────────────────────────────────────

  function handleEditKpi(kpi: KpiItem) {
    setEditingKpiId(kpi.id);
    setKpiForm({
      name: kpi.name,
      description: kpi.description ?? "",
      department: kpi.department ?? "",
      targetValue: String(kpi.targetValue),
      achievedValue: String(kpi.achievedValue),
      unit: kpi.unit,
      periodStartDate: toDateInputValue(kpi.periodStartDate),
      periodEndDate: toDateInputValue(kpi.periodEndDate),
      progressPercentage: String(kpi.progressPercentage),
    });
    setKpiDrawerOpen(true);
  }

  function handleCancelEditKpi() {
    setEditingKpiId(null);
    setKpiForm(EMPTY_KPI_FORM);
    setKpiDrawerOpen(false);
  }

  async function handleSubmitKpi() {
    if (!kpiForm.name.trim()) {
      toast.error("Nama KPI wajib diisi");
      return;
    }
    if (!kpiForm.unit.trim()) {
      toast.error("Satuan wajib diisi");
      return;
    }
    if (!kpiForm.periodStartDate || !kpiForm.periodEndDate) {
      toast.error("Periode KPI wajib diisi");
      return;
    }

    const payload = {
      name: kpiForm.name.trim(),
      description: kpiForm.description.trim() || undefined,
      department: kpiForm.department.trim() || undefined,
      targetValue: toNumber(kpiForm.targetValue),
      achievedValue: toNumber(kpiForm.achievedValue),
      unit: kpiForm.unit.trim(),
      periodStartDate: new Date(kpiForm.periodStartDate),
      periodEndDate: new Date(kpiForm.periodEndDate),
      progressPercentage: toNumber(kpiForm.progressPercentage),
    };

    if (editingKpiId) {
      const result = await updateKpiMutation.mutateAsync({
        id: editingKpiId,
        data: payload,
      });
      if (result.success) {
        toast.success("KPI diperbarui");
        handleCancelEditKpi();
        return;
      }
      toast.error(result.error ?? "Gagal memperbarui KPI");
      return;
    }

    const result = await createKpiMutation.mutateAsync(payload);
    if (result.success) {
      toast.success("KPI dibuat");
      setKpiForm(EMPTY_KPI_FORM);
      setKpiDrawerOpen(false);
      return;
    }
    toast.error(result.error ?? "Gagal membuat KPI");
  }

  async function handleDeleteKpi(id: string) {
    const result = await deleteKpiMutation.mutateAsync(id);
    if (result.success) {
      toast.success("KPI dihapus");
      return;
    }
    toast.error(result.error ?? "Gagal menghapus KPI");
  }

  const isReviewPending =
    createReviewMutation.isPending || updateReviewMutation.isPending;
  const isKpiPending =
    createKpiMutation.isPending || updateKpiMutation.isPending;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-heading font-semibold text-foreground">Manajemen Kinerja</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Kelola review kinerja karyawan dan indikator KPI dari satu halaman.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {stats.totalReviews} review
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {stats.completedReviews} selesai
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {stats.totalKpis} KPI
          </Badge>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="rounded-full bg-muted p-3 text-foreground">
              <ClipboardText weight="BoldDuotone" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total review</p>
              <p className="text-2xl font-heading font-semibold">{stats.totalReviews}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="rounded-full bg-muted p-3 text-foreground">
              <Star weight="BoldDuotone" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rata-rata rating</p>
              <p className="text-2xl font-heading font-semibold">
                {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "-"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="rounded-full bg-muted p-3 text-foreground">
              <ChartSquare weight="BoldDuotone" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Review selesai</p>
              <p className="text-2xl font-heading font-semibold">{stats.completedReviews}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="rounded-full bg-muted p-3 text-foreground">
              <GraphUp weight="BoldDuotone" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total KPI</p>
              <p className="text-2xl font-heading font-semibold">{stats.totalKpis}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="review" className="w-full">
        <TabsList className="flex h-auto w-full flex-col gap-1 rounded-2xl p-1 sm:grid sm:grid-cols-2 sm:gap-0">
          <TabsTrigger value="review" className="rounded-xl gap-2">
            <ClipboardText weight="BoldDuotone" className="h-4 w-4" />
            Review Kinerja
          </TabsTrigger>
          <TabsTrigger value="kpi" className="rounded-xl gap-2">
            <GraphUp weight="BoldDuotone" className="h-4 w-4" />
            KPI
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Review Kinerja ─────────────────────────────────────────────── */}
        <TabsContent value="review" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Sheet open={reviewDrawerOpen} onOpenChange={setReviewDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  className="rounded-full gap-2"
                  onClick={() => {
                    setEditingReviewId(null);
                    setReviewForm(EMPTY_REVIEW_FORM);
                    setReviewDrawerOpen(true);
                  }}
                >
                  <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                  Tambah Review
                </Button>
              </DrawerTrigger>
              <SheetContent side="right" className="w-full max-w-xl overflow-y-auto sm:max-w-xl">
                <SheetHeader className="space-y-2 px-1 pt-2">
                  <SheetTitle className="text-xl font-heading">
                    {editingReviewId ? "Edit review kinerja" : "Tambah review kinerja"}
                  </SheetTitle>
                  <SheetDescription>
                    {editingReviewId
                      ? "Perbarui data review kinerja karyawan."
                      : "Isi form untuk menambahkan review kinerja karyawan."}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4 px-1 pb-6">
                  <div className="space-y-2">
                    <Label htmlFor="review-employee">Karyawan</Label>
                    <select
                      id="review-employee"
                      value={reviewForm.profileId}
                      onChange={(e) =>
                        setReviewForm((current) => ({ ...current, profileId: e.target.value }))
                      }
                      disabled={!!editingReviewId}
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none disabled:opacity-50"
                    >
                      <option value="">Pilih karyawan</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName}
                          {emp.employeeNumber ? ` (#${emp.employeeNumber})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="review-start">Periode mulai</Label>
                      <Input
                        id="review-start"
                        type="date"
                        value={reviewForm.periodStartDate}
                        onChange={(e) =>
                          setReviewForm((current) => ({
                            ...current,
                            periodStartDate: e.target.value,
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="review-end">Periode selesai</Label>
                      <Input
                        id="review-end"
                        type="date"
                        value={reviewForm.periodEndDate}
                        onChange={(e) =>
                          setReviewForm((current) => ({
                            ...current,
                            periodEndDate: e.target.value,
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="review-rating">Rating (0–5)</Label>
                    <Input
                      id="review-rating"
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={reviewForm.rating}
                      onChange={(e) =>
                        setReviewForm((current) => ({ ...current, rating: e.target.value }))
                      }
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="review-status">Status</Label>
                    <select
                      id="review-status"
                      value={reviewForm.status}
                      onChange={(e) =>
                        setReviewForm((current) => ({ ...current, status: e.target.value }))
                      }
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
                    >
                      {REVIEW_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {REVIEW_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="review-strengths">Kekuatan</Label>
                    <Textarea
                      id="review-strengths"
                      rows={3}
                      value={reviewForm.strengths}
                      onChange={(e) =>
                        setReviewForm((current) => ({ ...current, strengths: e.target.value }))
                      }
                      placeholder="Contoh: komunikasi baik, inisiatif tinggi"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="review-comments">Komentar</Label>
                    <Textarea
                      id="review-comments"
                      rows={3}
                      value={reviewForm.comments}
                      onChange={(e) =>
                        setReviewForm((current) => ({ ...current, comments: e.target.value }))
                      }
                      placeholder="Catatan tambahan untuk karyawan"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 rounded-full gap-2"
                      onClick={handleSubmitReview}
                      disabled={isReviewPending}
                    >
                      <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                      {editingReviewId ? "Simpan perubahan" : "Tambah review"}
                    </Button>
                    {editingReviewId && (
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={handleCancelEditReview}
                      >
                        Batal
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="grid gap-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="space-y-2">
                <SectionTitle
                  title="Daftar review kinerja"
                  description="Riwayat review kinerja semua karyawan."
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Kekuatan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviews.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-10 text-center text-sm text-muted-foreground"
                          >
                            Belum ada review kinerja.
                          </TableCell>
                        </TableRow>
                      ) : (
                        reviews.map((review: PerformanceReviewItem) => (
                          <TableRow key={review.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                                  {getInitials(review.profile.fullName ?? "?")}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-foreground">
                                    {review.profile.fullName}
                                  </span>
                                  {review.profile.employeeNumber && (
                                    <span className="text-xs text-muted-foreground">
                                      #{review.profile.employeeNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                <span>{formatDate(review.periodStartDate)}</span>
                                <span>s/d {formatDate(review.periodEndDate)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <RatingStars rating={review.rating} />
                            </TableCell>
                            <TableCell>
                              <span className="line-clamp-2 max-w-[180px] text-sm">
                                {review.strengths ?? "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={reviewStatusVariant(review.status)}
                                className="rounded-full"
                              >
                                {REVIEW_STATUS_LABELS[review.status] ?? review.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full gap-1.5"
                                  onClick={() => handleEditReview(review)}
                                >
                                  <Pen weight="BoldDuotone" className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="rounded-full gap-1.5"
                                  onClick={() => handleDeleteReview(review.id)}
                                  disabled={deleteReviewMutation.isPending}
                                >
                                  <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: KPI ────────────────────────────────────────────────────────── */}
        <TabsContent value="kpi" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Sheet open={kpiDrawerOpen} onOpenChange={setKpiDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  className="rounded-full gap-2"
                  onClick={() => {
                    setEditingKpiId(null);
                    setKpiForm(EMPTY_KPI_FORM);
                    setKpiDrawerOpen(true);
                  }}
                >
                  <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                  Tambah KPI
                </Button>
              </DrawerTrigger>
              <SheetContent side="right" className="w-full max-w-xl overflow-y-auto sm:max-w-xl">
                <SheetHeader className="space-y-2 px-1 pt-2">
                  <SheetTitle className="text-xl font-heading">
                    {editingKpiId ? "Edit KPI" : "Tambah KPI"}
                  </SheetTitle>
                  <SheetDescription>
                    {editingKpiId
                      ? "Perbarui data indikator KPI."
                      : "Isi form untuk menambahkan KPI baru."}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4 px-1 pb-6">
                  <div className="space-y-2">
                    <Label htmlFor="kpi-name">Nama KPI</Label>
                    <Input
                      id="kpi-name"
                      value={kpiForm.name}
                      onChange={(e) =>
                        setKpiForm((current) => ({ ...current, name: e.target.value }))
                      }
                      placeholder="Contoh: Tingkat kepuasan pelanggan"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kpi-department">Departemen</Label>
                    <div className="flex items-center gap-2">
                      <Buildings weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="kpi-department"
                        value={kpiForm.department}
                        onChange={(e) =>
                          setKpiForm((current) => ({ ...current, department: e.target.value }))
                        }
                        placeholder="Contoh: Sales, Operations"
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="kpi-target">Target</Label>
                      <Input
                        id="kpi-target"
                        type="number"
                        min={0}
                        value={kpiForm.targetValue}
                        onChange={(e) =>
                          setKpiForm((current) => ({ ...current, targetValue: e.target.value }))
                        }
                        placeholder="100"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kpi-achieved">Capaian</Label>
                      <Input
                        id="kpi-achieved"
                        type="number"
                        min={0}
                        value={kpiForm.achievedValue}
                        onChange={(e) =>
                          setKpiForm((current) => ({
                            ...current,
                            achievedValue: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kpi-unit">Satuan</Label>
                    <Input
                      id="kpi-unit"
                      value={kpiForm.unit}
                      onChange={(e) =>
                        setKpiForm((current) => ({ ...current, unit: e.target.value }))
                      }
                      placeholder="Contoh: %, transaksi, unit"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kpi-progress">Progres (%)</Label>
                    <Input
                      id="kpi-progress"
                      type="number"
                      min={0}
                      max={100}
                      value={kpiForm.progressPercentage}
                      onChange={(e) =>
                        setKpiForm((current) => ({
                          ...current,
                          progressPercentage: e.target.value,
                        }))
                      }
                      placeholder="0"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="kpi-start">Periode mulai</Label>
                      <Input
                        id="kpi-start"
                        type="date"
                        value={kpiForm.periodStartDate}
                        onChange={(e) =>
                          setKpiForm((current) => ({
                            ...current,
                            periodStartDate: e.target.value,
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kpi-end">Periode selesai</Label>
                      <Input
                        id="kpi-end"
                        type="date"
                        value={kpiForm.periodEndDate}
                        onChange={(e) =>
                          setKpiForm((current) => ({
                            ...current,
                            periodEndDate: e.target.value,
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kpi-description">Deskripsi</Label>
                    <Textarea
                      id="kpi-description"
                      rows={3}
                      value={kpiForm.description}
                      onChange={(e) =>
                        setKpiForm((current) => ({ ...current, description: e.target.value }))
                      }
                      placeholder="Konteks dan tujuan KPI ini"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 rounded-full gap-2"
                      onClick={handleSubmitKpi}
                      disabled={isKpiPending}
                    >
                      <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                      {editingKpiId ? "Simpan perubahan" : "Tambah KPI"}
                    </Button>
                    {editingKpiId && (
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={handleCancelEditKpi}
                      >
                        Batal
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="grid gap-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="space-y-2">
                <SectionTitle
                  title="Daftar KPI"
                  description="Indikator kinerja utama per departemen dan periode."
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama KPI</TableHead>
                        <TableHead>Departemen</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Capaian</TableHead>
                        <TableHead>Satuan</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead>Progres</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kpis.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="py-10 text-center text-sm text-muted-foreground"
                          >
                            Belum ada KPI.
                          </TableCell>
                        </TableRow>
                      ) : (
                        kpis.map((kpi: KpiItem) => (
                          <TableRow key={kpi.id}>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-foreground">{kpi.name}</span>
                                {kpi.description && (
                                  <span className="line-clamp-1 max-w-[180px] text-xs text-muted-foreground">
                                    {kpi.description}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {kpi.department ? (
                                <Badge variant="secondary" className="rounded-full">
                                  {kpi.department}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{kpi.targetValue}</TableCell>
                            <TableCell className="font-medium">{kpi.achievedValue}</TableCell>
                            <TableCell className="text-muted-foreground">{kpi.unit}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                <span>{formatDate(kpi.periodStartDate)}</span>
                                <span>s/d {formatDate(kpi.periodEndDate)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <ProgressBar value={kpi.progressPercentage} />
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full gap-1.5"
                                  onClick={() => handleEditKpi(kpi)}
                                >
                                  <Pen weight="BoldDuotone" className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="rounded-full gap-1.5"
                                  onClick={() => handleDeleteKpi(kpi.id)}
                                  disabled={deleteKpiMutation.isPending}
                                >
                                  <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
