"use client";

import { useState } from "react";
import { TutorialMaster } from "./tutorial-master";
import { TutorialDetail } from "./tutorial-detail";
import { cn } from "@/lib/utils";

type MobileView = "master" | "detail";

export function TutorialClient() {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("master");

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
      {/* ─── Master panel ─────────────────────────────────────────────── */}
      {/* Desktop + Tablet: always visible, fixed width */}
      {/* Mobile: only visible when mobileView === 'master' */}
      <aside
        className={cn(
          // Base: hidden on mobile, shown on md+
          "border-r bg-background flex-col overflow-hidden",
          // Desktop / tablet widths
          "hidden md:flex md:w-64 lg:w-80 shrink-0",
          // Mobile override
          "max-md:flex max-md:w-full",
          mobileView === "master" ? "max-md:flex" : "max-md:hidden"
        )}
      >
        <TutorialMaster
          selectedLessonId={selectedLessonId}
          onSelectLesson={handleSelectLesson}
        />
      </aside>

      {/* ─── Detail panel ─────────────────────────────────────────────── */}
      {/* Desktop + Tablet: always visible, flex-1 */}
      {/* Mobile: only visible when mobileView === 'detail' */}
      <main
        className={cn(
          "flex flex-col overflow-hidden bg-background",
          // Desktop / tablet: flex-1
          "hidden md:flex md:flex-1",
          // Mobile override
          "max-md:flex max-md:w-full",
          mobileView === "detail" ? "max-md:flex" : "max-md:hidden"
        )}
      >
        <TutorialDetail
          selectedLessonId={selectedLessonId}
          onNavigate={handleNavigate}
          onBack={handleBack}
          showBackButton={mobileView === "detail"}
        />
      </main>
    </div>
  );
}
