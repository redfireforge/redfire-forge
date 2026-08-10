/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LessonList from './LessonList';
import { LessonNotesProvider } from './LessonNotesContext';
import type { DemoDomain, DemoLesson, DemoProgress } from './types';

function makeLesson(id: string, category = 'graphql'): DemoLesson {
  return {
    id,
    domainId: 'protocols',
    category,
    name: `Lesson ${id}`,
    description: 'desc',
    estimatedMinutes: 3,
    concept: { title: 'T', body: 'B' },
    steps: [{ id: 's1', title: 'S1', description: 'D1' }],
  };
}

function makeDomain(): DemoDomain {
  return {
    id: 'protocols',
    name: 'Protocols',
    icon: '🔌',
    description: 'Protocols domain',
    available: true,
    categories: [
      { id: 'graphql', label: 'GraphQL', icon: 'G' },
      { id: 'websocket', label: 'WebSocket', icon: 'W' },
    ],
    lessons: [
      makeLesson('gql-1', 'graphql'),
      makeLesson('ws-1', 'websocket'),
    ],
  };
}

const baseProgress: DemoProgress = {
  completedLessons: ['gql-1'],
  lessonSteps: { 'ws-1': 2 },
  speed: 1,
};

describe('LessonList — coverage gaps', () => {
  it('switches category tabs and calls onCategoryChange', () => {
    const onCategoryChange = vi.fn();
    render(
      <LessonNotesProvider>
        <LessonList
          domain={makeDomain()}
          progress={baseProgress}
          onSelect={vi.fn()}
          onBack={vi.fn()}
          onResetLesson={vi.fn()}
          onResetAll={vi.fn()}
          initialCategory="graphql"
          onCategoryChange={onCategoryChange}
        />
      </LessonNotesProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /WebSocket/i }));
    expect(onCategoryChange).toHaveBeenCalledWith('websocket');
    expect(screen.getByText('Lesson ws-1')).toBeTruthy();
  });

  it('opens lesson on Enter key and ignores clicks with active text selection', () => {
    const onSelect = vi.fn();
    render(
      <LessonNotesProvider>
        <LessonList
          domain={makeDomain()}
          progress={baseProgress}
          onSelect={onSelect}
          onBack={vi.fn()}
          onResetLesson={vi.fn()}
          onResetAll={vi.fn()}
          initialCategory="graphql"
        />
      </LessonNotesProvider>,
    );
    const row = screen.getByText('Lesson gql-1').closest('[role="button"]')!;
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalled();

    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'selected text',
    } as Selection);
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('confirms reset-all and per-lesson reset flows', () => {
    const onResetLesson = vi.fn();
    const onResetAll = vi.fn();
    render(
      <LessonNotesProvider>
        <LessonList
          domain={makeDomain()}
          progress={baseProgress}
          onSelect={vi.fn()}
          onBack={vi.fn()}
          onResetLesson={onResetLesson}
          onResetAll={onResetAll}
          initialCategory="graphql"
        />
      </LessonNotesProvider>,
    );
    fireEvent.click(screen.getByTestId('reset-all-btn'));
    fireEvent.click(screen.getByTestId('reset-all-yes'));
    expect(onResetAll).toHaveBeenCalledWith(['gql-1']);

    fireEvent.click(screen.getByTestId('reset-lesson-gql-1'));
    fireEvent.click(screen.getByTestId('reset-confirm-gql-1').querySelector('.demo-lesson-reset-yes')!);
    expect(onResetLesson).toHaveBeenCalledWith('gql-1');
  });
});
