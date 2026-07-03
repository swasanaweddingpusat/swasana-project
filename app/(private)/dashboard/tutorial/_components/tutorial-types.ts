export interface TutorialStepDocument {
  id: string;
  name: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  sortOrder: number;
}

export interface TutorialStep {
  id: string;
  title: string;
  caption: string;
  image?: string | null;
  videoUrl?: string | null;
  videoType?: string | null;
  sortOrder: number;
  documents: TutorialStepDocument[];
}

export interface TutorialLesson {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
  sortOrder: number;
  steps: TutorialStep[];
}

export interface TutorialCategory {
  id: string;
  name: string;
  lessons: TutorialLesson[];
}
