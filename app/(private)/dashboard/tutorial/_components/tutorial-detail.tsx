"use client";

import { useMemo } from "react";
import Image from "next/image";
import {
  Book,
  Gallery,
  AltArrowLeft,
  AltArrowRight,
  ClockCircle,
  ListCheck,
} from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TutorialLesson, TutorialCategory } from "./tutorial-types";

interface TutorialDetailProps {
  categories: TutorialCategory[];
  selectedLessonId: string | null;
  onNavigate: (lessonId: string) => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

interface ResolvedLesson {
  lesson: TutorialLesson;
  category: TutorialCategory;
  prevLessonId: string | null;
  nextLessonId: string | null;
}

function resolveLesson(lessonId: string | null, categories: TutorialCategory[]): ResolvedLesson | null {
  if (!lessonId) return null;

  const allLessons: Array<{ lesson: TutorialLesson; category: TutorialCategory }> = [];
  for (const cat of categories) {
    for (const les of cat.lessons) {
      allLessons.push({ lesson: les, category: cat });
    }
  }

  const idx = allLessons.findIndex((x) => x.lesson.id === lessonId);
  if (idx === -1) return null;

  return {
    lesson: allLessons[idx].lesson,
    category: allLessons[idx].category,
    prevLessonId: idx > 0 ? allLessons[idx - 1].lesson.id : null,
    nextLessonId: idx < allLessons.length - 1 ? allLessons[idx + 1].lesson.id : null,
  };
}

export function TutorialDetail({
  categories,
  selectedLessonId,
  onNavigate,
  onBack,
  showBackButton = false,
}: TutorialDetailProps) {
  const resolved = useMemo(
    () => resolveLesson(selectedLessonId, categories),
    [selectedLessonId, categories]
  );

  if (!resolved) {
    return <EmptyState />;
  }

  const { lesson, category, prevLessonId, nextLessonId } = resolved;

  return (
    <div className="flex h-full flex-col">
      {/* Back button — mobile only */}
      {showBackButton && onBack && (
        <div className="shrink-0 border-b px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 -ml-1 cursor-pointer"
          >
            <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
            Kembali ke Daftar
          </Button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <p className="mb-2 text-xs text-muted-foreground">
              {category.name} &rsaquo; {lesson.title}
            </p>
            <h1 className="font-display text-2xl font-bold leading-tight text-foreground italic">
              {lesson.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClockCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                {lesson.duration}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ListCheck weight="BoldDuotone" className="h-3.5 w-3.5" />
                {lesson.steps.length} langkah
              </span>
              <Badge variant="secondary" className="text-xs">
                {category.name}
              </Badge>
            </div>
          </div>

          {/* Steps */}
          <ol className="space-y-8">
            {lesson.steps.map((step, index) => (
              <StepCard
                key={index}
                stepNumber={index + 1}
                title={step.title}
                caption={step.caption}
                image={step.image ?? undefined}
              />
            ))}
          </ol>
        </div>
      </div>

      {/* Footer nav */}
      <div className="shrink-0 border-t bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevLessonId}
            onClick={() => {
              if (prevLessonId) onNavigate(prevLessonId);
            }}
            className="gap-1.5 cursor-pointer"
          >
            <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </Button>

          <span className="text-xs text-muted-foreground">
            Langkah {lesson.steps.length} dari {lesson.steps.length}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={!nextLessonId}
            onClick={() => {
              if (nextLessonId) onNavigate(nextLessonId);
            }}
            className="gap-1.5 cursor-pointer"
          >
            <span className="hidden sm:inline">Selanjutnya</span>
            <AltArrowRight weight="BoldDuotone" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface StepCardProps {
  stepNumber: number;
  title: string;
  caption: string;
  image?: string;
}

function StepCard({ stepNumber, title, caption, image }: StepCardProps) {
  return (
    <li className="rounded-2xl border bg-card p-5 shadow-sm">
      {/* Step number + title */}
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {stepNumber}
        </span>
        <h3 className="text-sm font-semibold text-foreground leading-snug">{title}</h3>
      </div>

      {/* Screenshot — real image kalau ada, placeholder kalau belum */}
      {image ? (
        <Image
          src={image}
          alt={title}
          width={1440}
          height={900}
          className="mb-4 w-full h-auto rounded-xl border bg-muted"
          unoptimized
        />
      ) : (
        <div
          className={cn(
            "mb-4 flex aspect-video w-full flex-col items-center justify-center gap-2",
            "rounded-xl bg-muted border border-dashed border-border"
          )}
        >
          <Gallery weight="BoldDuotone" className="h-8 w-8 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground/60">Screenshot menyusul</span>
        </div>
      )}

      {/* Caption */}
      <p className="text-sm text-muted-foreground leading-relaxed">{caption}</p>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Book weight="BoldDuotone" className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <div className="max-w-xs">
        <p className="font-semibold text-foreground">Pilih tutorial untuk memulai</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pilih kategori dan lesson di panel kiri untuk melihat panduan langkah demi langkah.
        </p>
      </div>
    </div>
  );
}
