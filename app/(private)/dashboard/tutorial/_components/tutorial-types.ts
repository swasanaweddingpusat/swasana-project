export interface TutorialStep {
  id: string;
  title: string;
  caption: string;
  image?: string | null;
  sortOrder: number;
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
