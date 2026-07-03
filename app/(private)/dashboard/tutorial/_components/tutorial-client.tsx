"use client";

import { useState } from "react";
import { TutorialMaster } from "./tutorial-master";
import { TutorialDetail } from "./tutorial-detail";
import type { TutorialCategory } from "./tutorial-types";

type MobileView = "master" | "detail";

interface TutorialClientProps {
  initialCategories: TutorialCategory[];
}

export function TutorialClient({ initialCategories }: TutorialClientProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialCategories[0]?.lessons?.[0]?.id ?? null
  );
  const [mobileView, setMobileView] = useState<MobileView>("master");
  const [categories] = useState(initialCategories);

  function handleSelectLesson(lessonId: string) {
    setSelectedLessonId(lessonId);
    setMobileView("detail");
  }

  function handleNavigate(lessonId: string) {
    setSelectedLessonId(lessonId);
  }

  function handleBack() {
    setMobileView("master");
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      <TutorialMaster
        categories={categories}
        selectedLessonId={selectedLessonId}
        onSelectLesson={handleSelectLesson}
      />
      <TutorialDetail
        categories={categories}
        selectedLessonId={selectedLessonId}
        onNavigate={handleNavigate}
        onBack={handleBack}
        showBackButton={mobileView === "detail"}
      />
    </div>
  );
}
