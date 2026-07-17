import { render, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LessonNotesProvider } from './LessonNotesContext';
import type { DemoDomain, DemoLesson, DemoProgress } from './types';

export const baseProgress: DemoProgress = {
  completedLessons: [],
  lessonSteps: {},
  speed: 1,
};

export function makeLesson(overrides: Partial<DemoLesson> = {}): DemoLesson {
  return {
    id: 'l1',
    domainId: 'protocols',
    name: 'Lesson 1',
    description: 'Test lesson',
    estimatedMinutes: 5,
    concept: { title: 'Concept Title', body: 'Concept body text.' },
    steps: [
      { id: 's1', title: 'Step 1', description: 'Do step 1' },
      { id: 's2', title: 'Step 2', description: 'Do step 2' },
    ],
    ...overrides,
  };
}

export function makeDomain(overrides: Partial<DemoDomain> = {}): DemoDomain {
  return {
    id: 'protocols',
    name: 'Protocols',
    icon: '🔌',
    description: 'WebSocket & SSE',
    available: true,
    lessons: [makeLesson()],
    ...overrides,
  };
}

export function renderWithLessonNotes(ui: ReactElement) {
  return render(<LessonNotesProvider>{ui}</LessonNotesProvider>);
}

/** Click step N in LessonPlayer sidebar (0 = first step). Ignores Concept/Notes items. */
export function clickLessonPlayerStep(stepIndex: number) {
  const stepNum = document.querySelectorAll('.demo-sidebar-step-num')[stepIndex];
  const btn = stepNum?.closest('.demo-sidebar-nav-item');
  if (!btn) throw new Error(`LessonPlayer step nav index ${stepIndex} not found`);
  fireEvent.click(btn);
}
