"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { AddCircle, TrashBinTrash, PenNewSquare, Book, AltArrowDown } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createTutorialCategory,
  updateTutorialCategory,
  deleteTutorialCategory,
  createTutorialLesson,
  updateTutorialLesson,
  deleteTutorialLesson,
  createTutorialStep,
  updateTutorialStep,
  deleteTutorialStep,
  createTutorialStepDocument,
  deleteTutorialStepDocument,
} from "@/actions/tutorial";
import type { TutorialCategory, TutorialLesson, TutorialStep, TutorialStepDocument } from "@/app/(private)/dashboard/tutorial/_components/tutorial-types";

interface Props {
  initialCategories: TutorialCategory[];
}

export function TutorialManager({ initialCategories }: Props) {
  const [categories, setCategories] = useState<TutorialCategory[]>(initialCategories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(categories[0]?.lessons?.[0]?.id ?? null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? categories[0] ?? null,
    [categories, selectedCategoryId]
  );

  const selectedLesson = useMemo(
    () => selectedCategory?.lessons.find((l) => l.id === selectedLessonId) ?? selectedCategory?.lessons?.[0] ?? null,
    [selectedCategory, selectedLessonId]
  );

  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (selectedCategory && selectedLessonId && !selectedCategory.lessons.some((l) => l.id === selectedLessonId)) {
      setSelectedLessonId(selectedCategory.lessons[0]?.id ?? null);
    }
  }, [selectedCategory, selectedLessonId]);

  useEffect(() => {
    if (!selectedLessonId && selectedCategory?.lessons.length) {
      setSelectedLessonId(selectedCategory.lessons[0].id);
    }
  }, [selectedCategory, selectedLessonId]);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<TutorialCategory | null>(null);

  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDuration, setLessonDuration] = useState("");
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [editingLesson, setEditingLesson] = useState<TutorialLesson | null>(null);

  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [stepCaption, setStepCaption] = useState("");
  const [stepImage, setStepImage] = useState("");
  const [editingStep, setEditingStep] = useState<TutorialStep | null>(null);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [stepVideoUrl, setStepVideoUrl] = useState("");
  const [stepVideoType, setStepVideoType] = useState<"youtube" | "mp4" | "minio" | "none">("none");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const [uploadingDocStepId, setUploadingDocStepId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<TutorialCategory | null>(null);
  const [deleteLessonTarget, setDeleteLessonTarget] = useState<TutorialLesson | null>(null);
  const [deleteStepTarget, setDeleteStepTarget] = useState<TutorialStep | null>(null);

  const [isPending, setIsPending] = useState(false);

  const openNewCategoryDialog = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: TutorialCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDialogOpen(true);
  };

  const openNewLessonDialog = () => {
    if (!selectedCategory) return;
    setEditingLesson(null);
    setLessonTitle("");
    setLessonDuration("");
    setLessonCompleted(false);
    setLessonDialogOpen(true);
  };

  const openEditLessonDialog = (lesson: TutorialLesson) => {
    setEditingLesson(lesson);
    setLessonTitle(lesson.title);
    setLessonDuration(lesson.duration ?? "");
    setLessonCompleted(lesson.completed ?? false);
    setLessonDialogOpen(true);
  };

  const openNewStepDialog = () => {
    if (!selectedLesson) return;
    setEditingStep(null);
    setStepTitle("");
    setStepCaption("");
    setStepImage("");
    setStepVideoUrl("");
    setStepVideoType("none");
    setStepDialogOpen(true);
  };

  const openEditStepDialog = (step: TutorialStep) => {
    setEditingStep(step);
    setStepTitle(step.title);
    setStepCaption(step.caption);
    setStepImage(step.image ?? "");
    setStepVideoUrl(step.videoUrl ?? "");
    setStepVideoType((step.videoType as "youtube" | "mp4" | "minio") ?? "none");
    setStepDialogOpen(true);
  };

  async function handleSaveCategory() {
    if (isPending) return;
    const name = categoryName.trim();
    if (!name) {
      toast.error("Nama kategori tidak boleh kosong.");
      return;
    }

    setIsPending(true);
    try {
      if (editingCategory) {
        const result = await updateTutorialCategory(editingCategory.id, name);
        if (!result.success) {
          toast.error(result.error ?? "Gagal memperbarui kategori.");
          return;
        }
        setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? { ...c, name } : c)));
        toast.success("Kategori berhasil diperbarui.");
      } else {
        const result = await createTutorialCategory(name);
        if (!result.success) {
          toast.error(result.error ?? "Gagal membuat kategori.");
          return;
        }
        const { id, name: catName } = result.category as { id: string; name: string };
        setCategories((prev) => [...prev, { id, name: catName, lessons: [] }]);
        toast.success("Kategori berhasil ditambahkan.");
      }
      setCategoryDialogOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  async function handleSaveLesson() {
    if (isPending) return;
    if (!selectedCategory) {
      toast.error("Pilih kategori terlebih dahulu.");
      return;
    }

    const title = lessonTitle.trim();
    const duration = lessonDuration.trim();
    if (!title) {
      toast.error("Judul lesson tidak boleh kosong.");
      return;
    }

    setIsPending(true);
    try {
      if (editingLesson) {
        const result = await updateTutorialLesson(editingLesson.id, title, duration, lessonCompleted);
        if (!result.success) {
          toast.error(result.error ?? "Gagal memperbarui lesson.");
          return;
        }
        setCategories((prev) =>
          prev.map((c) =>
            c.id !== selectedCategory.id
              ? c
              : {
                  ...c,
                  lessons: c.lessons.map((l) =>
                    l.id === editingLesson.id ? { ...l, title, duration, completed: lessonCompleted } : l
                  ),
                }
          )
        );
        toast.success("Lesson berhasil diperbarui.");
      } else {
        const result = await createTutorialLesson(selectedCategory.id, title, duration, lessonCompleted);
        if (!result.success) {
          toast.error(result.error ?? "Gagal membuat lesson.");
          return;
        }
        const raw = result.lesson as { id: string; title: string; duration: string; completed: boolean; sortOrder: number };
        const newLesson: TutorialLesson = { id: raw.id, title: raw.title, duration: raw.duration, completed: raw.completed, sortOrder: raw.sortOrder, steps: [] };
        setCategories((prev) =>
          prev.map((c) =>
            c.id === selectedCategory.id ? { ...c, lessons: [...c.lessons, newLesson] } : c
          )
        );
        toast.success("Lesson berhasil ditambahkan.");
        setSelectedLessonId(newLesson.id);
      }
      setLessonDialogOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  async function handleSaveStep() {
    if (isPending) return;
    if (!selectedLesson) {
      toast.error("Pilih lesson terlebih dahulu.");
      return;
    }

    const title = stepTitle.trim();
    const caption = stepCaption.trim();
    const image = stepImage.trim() || undefined;
    const videoUrl = stepVideoUrl.trim() || undefined;
    const videoType = stepVideoType === "none" ? undefined : stepVideoType;
    if (!title || !caption) {
      toast.error("Judul dan keterangan step wajib diisi.");
      return;
    }

    setIsPending(true);
    try {
      if (editingStep) {
        const result = await updateTutorialStep(editingStep.id, title, caption, image, videoUrl, videoType);
        if (!result.success) {
          toast.error(result.error ?? "Gagal memperbarui step.");
          return;
        }
        setCategories((prev) =>
          prev.map((c) =>
            c.id !== selectedCategory?.id
              ? c
              : {
                  ...c,
                  lessons: c.lessons.map((l) =>
                    l.id !== selectedLesson.id
                      ? l
                      : {
                          ...l,
                          steps: l.steps.map((s) =>
                            s.id === editingStep.id
                              ? { ...s, title, caption, image: image ?? null, videoUrl: videoUrl ?? null, videoType: videoType ?? null }
                              : s
                          ),
                        }
                  ),
                }
          )
        );
        toast.success("Step berhasil diperbarui.");
      } else {
        const result = await createTutorialStep(selectedLesson.id, title, caption, image, videoUrl, videoType);
        if (!result.success) {
          toast.error(result.error ?? "Gagal membuat step.");
          return;
        }
        const raw = result.step as { id: string; title: string; caption: string; image?: string | null; videoUrl?: string | null; videoType?: string | null; sortOrder: number };
        const newStep: TutorialStep = { ...raw, documents: [] };
        setCategories((prev) =>
          prev.map((c) =>
            c.id !== selectedCategory?.id
              ? c
              : {
                  ...c,
                  lessons: c.lessons.map((l) =>
                    l.id === selectedLesson.id ? { ...l, steps: [...l.steps, newStep] } : l
                  ),
                }
          )
        );
        toast.success("Step berhasil ditambahkan.");
      }
      setStepDialogOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeleteCategory() {
    if (!deleteCategoryTarget || isPending) return;
    setIsPending(true);
    try {
      const result = await deleteTutorialCategory(deleteCategoryTarget.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus kategori.");
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== deleteCategoryTarget.id));
      setDeleteCategoryTarget(null);
      toast.success("Kategori berhasil dihapus.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeleteLesson() {
    if (!deleteLessonTarget || !selectedCategory || isPending) return;
    setIsPending(true);
    try {
      const result = await deleteTutorialLesson(deleteLessonTarget.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus lesson.");
        return;
      }
      const remainingLessons = selectedCategory.lessons.filter((l) => l.id !== deleteLessonTarget.id);
      setCategories((prev) =>
        prev.map((c) =>
          c.id !== selectedCategory.id ? c : { ...c, lessons: remainingLessons }
        )
      );
      if (selectedLessonId === deleteLessonTarget.id) {
        setSelectedLessonId(remainingLessons[0]?.id ?? null);
      }
      setDeleteLessonTarget(null);
      toast.success("Lesson berhasil dihapus.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeleteStep() {
    if (!deleteStepTarget || !selectedCategory || !selectedLesson || isPending) return;
    setIsPending(true);
    try {
      const result = await deleteTutorialStep(deleteStepTarget.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus step.");
        return;
      }
      setCategories((prev) =>
        prev.map((c) =>
          c.id !== selectedCategory.id
            ? c
            : {
                ...c,
                lessons: c.lessons.map((l) =>
                  l.id !== selectedLesson.id
                    ? l
                    : { ...l, steps: l.steps.filter((s) => s.id !== deleteStepTarget.id) }
                ),
              }
        )
      );
      setDeleteStepTarget(null);
      toast.success("Step berhasil dihapus.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleAddDocument(stepId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingDocStepId(stepId);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "document");
        const res = await fetch("/api/upload/tutorial-media", { method: "POST", body: fd });
        const data = await res.json() as { url?: string; name?: string; mimeType?: string; fileSize?: number; error?: string };
        if (!res.ok || data.error) {
          toast.error(data.error ?? "Gagal upload dokumen.");
          return;
        }
        const result = await createTutorialStepDocument(stepId, data.name ?? file.name, data.url!, data.mimeType, data.fileSize);
        if (!result.success) {
          toast.error(result.error ?? "Gagal menyimpan dokumen.");
          return;
        }
        const newDoc = result.document as TutorialStepDocument;
        setCategories((prev) =>
          prev.map((c) => ({
            ...c,
            lessons: c.lessons.map((l) => ({
              ...l,
              steps: l.steps.map((s) =>
                s.id === stepId ? { ...s, documents: [...s.documents, newDoc] } : s
              ),
            })),
          }))
        );
        toast.success("Dokumen berhasil ditambahkan.");
      } finally {
        setUploadingDocStepId(null);
      }
    };
    input.click();
  }

  async function handleDeleteDocument(stepId: string, docId: string) {
    setDeletingDocId(docId);
    try {
      const result = await deleteTutorialStepDocument(docId);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus dokumen.");
        return;
      }
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          lessons: c.lessons.map((l) => ({
            ...l,
            steps: l.steps.map((s) =>
              s.id === stepId ? { ...s, documents: s.documents.filter((d) => d.id !== docId) } : s
            ),
          })),
        }))
      );
      toast.success("Dokumen berhasil dihapus.");
    } finally {
      setDeletingDocId(null);
    }
  }

  return (
    <div className="px-2 sm:px-6 pb-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tutorial CMS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola konten tutorial aplikasi secara terstruktur.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openNewCategoryDialog} className="cursor-pointer">
            <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-2" /> Tambah Kategori
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardHeader className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Kategori</CardTitle>
              <CardDescription>Tata urutan kategori tutorial.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 p-0">
            {categories.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Belum ada kategori. Tambahkan kategori untuk memulai.</div>
            ) : (
              <div className="space-y-2 p-4">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      setSelectedLessonId(category.lessons[0]?.id ?? null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCategoryId(category.id);
                        setSelectedLessonId(category.lessons[0]?.id ?? null);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition cursor-pointer",
                      selectedCategoryId === category.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Book weight="BoldDuotone" className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{category.name}</p>
                        <p className="text-xs text-muted-foreground">{category.lessons.length} lesson</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEditCategoryDialog(category); }}
                        className="p-1 rounded-md text-muted-foreground hover:bg-muted"
                      >
                        <PenNewSquare weight="BoldDuotone" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteCategoryTarget(category); }}
                        className="p-1 rounded-md text-destructive hover:bg-destructive/10"
                      >
                        <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Lesson</CardTitle>
                <CardDescription>
                  {selectedCategory ? `Kelola lesson untuk kategori ${selectedCategory.name}.` : "Pilih kategori terlebih dahulu."}
                </CardDescription>
              </div>
              <Button onClick={openNewLessonDialog} disabled={!selectedCategory} className="cursor-pointer">
                <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-2" /> Tambah Lesson
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {!selectedCategory ? (
                <p className="text-sm text-muted-foreground">Pilih kategori untuk melihat lesson.</p>
              ) : selectedCategory.lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada lesson di kategori ini.</p>
              ) : (
                <div className="space-y-2">
                  {selectedCategory.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedLessonId(lesson.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedLessonId(lesson.id);
                        }
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition cursor-pointer",
                        selectedLessonId === lesson.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/50"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{lesson.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{lesson.duration || "Durasi belum diatur"}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEditLessonDialog(lesson); }}
                          className="p-1 rounded-md text-muted-foreground hover:bg-muted"
                        >
                          <PenNewSquare weight="BoldDuotone" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteLessonTarget(lesson); }}
                          className="p-1 rounded-md text-destructive hover:bg-destructive/10"
                        >
                          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Step</CardTitle>
                <CardDescription>
                  {selectedLesson ? `Step untuk lesson ${selectedLesson.title}.` : "Pilih lesson untuk melihat step."}
                </CardDescription>
              </div>
              <Button onClick={openNewStepDialog} disabled={!selectedLesson} className="cursor-pointer">
                <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-2" /> Tambah Step
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {!selectedLesson ? (
                <p className="text-sm text-muted-foreground">Pilih lesson untuk melihat step.</p>
              ) : selectedLesson.steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada step dalam lesson ini.</p>
              ) : (
                <div className="space-y-2">
                  {selectedLesson.steps.map((step, index) => {
                    const isExpanded = expandedSteps.has(step.id);
                    return (
                      <div key={step.id} className="rounded-2xl border border-border bg-background">
                        <div
                          className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none"
                          onClick={() =>
                            setExpandedSteps((prev) => {
                              const next = new Set(prev);
                              if (next.has(step.id)) { next.delete(step.id); } else { next.add(step.id); }
                              return next;
                            })
                          }
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AltArrowDown
                              weight="BoldDuotone"
                              className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", !isExpanded && "-rotate-90")}
                            />
                            <p className="font-medium text-foreground truncate">{index + 1}. {step.title}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEditStepDialog(step); }}
                              className="p-1 rounded-md text-muted-foreground hover:bg-muted"
                            >
                              <PenNewSquare weight="BoldDuotone" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDeleteStepTarget(step); }}
                              className="p-1 rounded-md text-destructive hover:bg-destructive/10"
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-0 space-y-2">
                            <p className="text-sm text-muted-foreground">{step.caption}</p>
                            {step.image ? <p className="text-xs text-muted-foreground">Gambar: {step.image}</p> : null}
                            {step.videoType ? (
                              <p className="text-xs text-muted-foreground">
                                Video ({step.videoType}): {step.videoUrl}
                              </p>
                            ) : null}
                            <div className="border-t pt-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Dokumen terlampir</p>
                              {step.documents.map((doc) => (
                                <div key={doc.id} className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-foreground truncate flex-1">{doc.name}</span>
                                  <button
                                    type="button"
                                    disabled={deletingDocId === doc.id}
                                    onClick={() => handleDeleteDocument(step.id, doc.id)}
                                    className="p-0.5 rounded text-destructive hover:bg-destructive/10"
                                  >
                                    <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                disabled={uploadingDocStepId === step.id}
                                onClick={() => handleAddDocument(step.id)}
                                className="mt-1 text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {uploadingDocStepId === step.id ? "Mengunggah..." : "+ Tambah Dokumen"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>{editingCategory ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Nama Kategori</Label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Contoh: Booking & Order"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)} className="flex-1 cursor-pointer">
                Batal
              </Button>
              <Button onClick={handleSaveCategory} disabled={isPending} className="flex-1 cursor-pointer">
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>{editingLesson ? "Edit Lesson" : "Tambah Lesson"}</DialogTitle>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="lesson-title">Judul Lesson</Label>
              <Input
                id="lesson-title"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="Contoh: Cara Membuat Booking Baru"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lesson-duration">Durasi</Label>
              <Input
                id="lesson-duration"
                value={lessonDuration}
                onChange={(e) => setLessonDuration(e.target.value)}
                placeholder="Contoh: 5 menit"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="lesson-completed"
                checked={lessonCompleted}
                onCheckedChange={(value) => setLessonCompleted(value === true)}
              />
              <Label htmlFor="lesson-completed">Tandai sudah selesai</Label>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setLessonDialogOpen(false)} className="flex-1 cursor-pointer">
                Batal
              </Button>
              <Button onClick={handleSaveLesson} disabled={isPending} className="flex-1 cursor-pointer">
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>{editingStep ? "Edit Step" : "Tambah Step"}</DialogTitle>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="step-title">Judul Step</Label>
              <Input
                id="step-title"
                value={stepTitle}
                onChange={(e) => setStepTitle(e.target.value)}
                placeholder="Contoh: Buka Halaman Booking"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="step-caption">Keterangan</Label>
              <Textarea
                id="step-caption"
                value={stepCaption}
                onChange={(e) => setStepCaption(e.target.value)}
                placeholder="Jelaskan langkah secara ringkas..."
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gambar (opsional)</Label>
              <div className="flex items-center gap-2">
                {stepImage ? (
                  <>
                    <span className="flex-1 truncate text-sm text-muted-foreground">{stepImage.split("/").pop()}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setStepImage("")}
                    >
                      Hapus
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingImage}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/png,image/jpeg,image/webp,image/gif";
                      input.onchange = async () => {
                        const file = input.files?.[0];
                        if (!file) return;
                        setIsUploadingImage(true);
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          fd.append("type", "image");
                          const res = await fetch("/api/upload/tutorial-media", { method: "POST", body: fd });
                          const data = await res.json() as { url?: string; error?: string };
                          if (!res.ok || data.error) {
                            toast.error(data.error ?? "Gagal upload gambar.");
                            return;
                          }
                          setStepImage(data.url!);
                        } finally {
                          setIsUploadingImage(false);
                        }
                      };
                      input.click();
                    }}
                  >
                    {isUploadingImage ? "Mengunggah..." : "Pilih File Gambar"}
                  </Button>
                )}
              </div>
              {stepImage && (
                <Image
                  src={stepImage}
                  alt="Preview"
                  width={320}
                  height={160}
                  className="mt-2 max-h-40 w-auto rounded-xl border border-border object-contain"
                  unoptimized
                />
              )}
            </div>
            {/* Video section */}
            <div className="space-y-2">
              <Label>Video (opsional)</Label>
              <Select
                value={stepVideoType}
                onValueChange={(v) => {
                  setStepVideoType(v as typeof stepVideoType);
                  setStepVideoUrl("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tidak ada video" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada video</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="mp4">URL Video (MP4)</SelectItem>
                  <SelectItem value="minio">Upload ke MinIO</SelectItem>
                </SelectContent>
              </Select>
              {(stepVideoType === "youtube" || stepVideoType === "mp4") && (
                <Input
                  value={stepVideoUrl}
                  onChange={(e) => setStepVideoUrl(e.target.value)}
                  placeholder={
                    stepVideoType === "youtube"
                      ? "https://youtube.com/watch?v=..."
                      : "https://cdn.example.com/video.mp4"
                  }
                />
              )}
              {stepVideoType === "minio" && (
                <div className="flex items-center gap-2">
                  {stepVideoUrl ? (
                    <>
                      <span className="flex-1 truncate text-sm text-muted-foreground">{stepVideoUrl}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setStepVideoUrl("")}
                      >
                        Hapus
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingVideo}
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "video/mp4,video/webm,video/ogg,video/quicktime";
                        input.onchange = async () => {
                          const file = input.files?.[0];
                          if (!file) return;
                          setIsUploadingVideo(true);
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            fd.append("type", "video");
                            const res = await fetch("/api/upload/tutorial-media", { method: "POST", body: fd });
                            const data = await res.json() as { url?: string; error?: string };
                            if (!res.ok || data.error) {
                              toast.error(data.error ?? "Gagal upload video.");
                              return;
                            }
                            setStepVideoUrl(data.url!);
                          } finally {
                            setIsUploadingVideo(false);
                          }
                        };
                        input.click();
                      }}
                    >
                      {isUploadingVideo ? "Mengunggah..." : "Pilih File Video"}
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStepDialogOpen(false)} className="flex-1 cursor-pointer">
                Batal
              </Button>
              <Button onClick={handleSaveStep} disabled={isPending} className="flex-1 cursor-pointer">
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCategoryTarget} onOpenChange={(open) => { if (!open) setDeleteCategoryTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus kategori <strong>{deleteCategoryTarget?.name}</strong> beserta semua lesson dan step yang terkait.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteLessonTarget} onOpenChange={(open) => { if (!open) setDeleteLessonTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Lesson</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus lesson <strong>{deleteLessonTarget?.title}</strong> beserta semua step yang terkait.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLesson}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteStepTarget} onOpenChange={(open) => { if (!open) setDeleteStepTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Step</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus step <strong>{deleteStepTarget?.title}</strong> dari lesson ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStep}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
