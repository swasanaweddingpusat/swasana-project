"use client";

import { useState, useMemo } from "react";
import { Magnifer, AltArrowDown, AltArrowRight, CheckCircle, Book } from "@solar-icons/react";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { TutorialCategory, TutorialLesson } from "./tutorial-types";

interface TutorialMasterProps {
  categories: TutorialCategory[];
  selectedLessonId: string | null;
  onSelectLesson: (lessonId: string) => void;
}

export function TutorialMaster({ categories, selectedLessonId, onSelectLesson }: TutorialMasterProps) {
  const [search, setSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.id))
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return categories;
    return categories
      .map((cat) => ({
      ...cat,
      lessons: cat.lessons.filter((l) => l.title.toLowerCase().includes(q)),
    })).filter((cat) => cat.lessons.length > 0);
  }, [categories, search]);

  function toggleCategory(id: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="shrink-0 border-b p-3">
        <div className="relative">
          <Magnifer
            weight="BoldDuotone"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          />
          <Input
            placeholder="Cari tutorial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Tidak ada tutorial ditemukan.
          </p>
        )}

        {filtered.map((category) => {
          const isOpen = openCategories.has(category.id);

          return (
            <Collapsible
              key={category.id}
              open={isOpen}
              onOpenChange={() => toggleCategory(category.id)}
            >
              <CollapsibleTrigger className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors rounded-lg mx-1 group/cat">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Book weight="BoldDuotone" className="h-4 w-4 text-primary" />
                </span>
                <span className="flex-1 text-sm font-semibold text-foreground truncate">
                  {category.name}
                </span>
                <span className="text-muted-foreground">
                  {isOpen ? (
                    <AltArrowDown weight="BoldDuotone" className="h-4 w-4" />
                  ) : (
                    <AltArrowRight weight="BoldDuotone" className="h-4 w-4" />
                  )}
                </span>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <ul className="pb-1">
                  {category.lessons.map((lesson: TutorialLesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      isActive={selectedLessonId === lesson.id}
                      onSelect={() => onSelectLesson(lesson.id)}
                    />
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

interface LessonRowProps {
  lesson: TutorialLesson;
  isActive: boolean;
  onSelect: () => void;
}

function LessonRow({ lesson, isActive, onSelect }: LessonRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full flex items-start gap-2.5 pl-8 pr-3 py-2 text-left rounded-lg mx-1 transition-colors",
          "hover:bg-accent/60",
          isActive && "bg-accent border-l-2 border-[var(--brand-gold)] pl-7"
        )}
      >
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm truncate leading-snug",
              isActive ? "font-semibold text-foreground" : "text-foreground/80"
            )}
          >
            {lesson.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{lesson.duration}</p>
        </div>
        {lesson.completed && (
          <CheckCircle
            weight="BoldDuotone"
            className="h-4 w-4 shrink-0 mt-0.5 text-[var(--brand-gold)]"
          />
        )}
      </button>
    </li>
  );
}
