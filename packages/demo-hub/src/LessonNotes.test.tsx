/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LessonNotesProvider } from './LessonNotesContext';
import LessonList from './LessonList';
import LessonNotesPanel from './LessonNotesPanel';
import LessonNotesEditor from './LessonNotesEditor';
import LessonPlayer from './LessonPlayer';
import type { DemoDomain, DemoLesson, DemoProgress } from './types';
import { LESSON_NOTES_STORAGE_KEY } from './lessonNotesStorage';

function makeLesson(overrides: Partial<DemoLesson> = {}): DemoLesson {
  return {
    id: 'l1',
    domainId: 'protocols',
    name: 'Lesson 1',
    description: 'Test lesson',
    estimatedMinutes: 5,
    concept: { title: 'Concept', body: 'Body' },
    steps: [{ id: 's1', title: 'Step 1', description: 'Do it' }],
    ...overrides,
  };
}

function makeDomain(lessons: DemoLesson[] = [makeLesson()]): DemoDomain {
  return {
    id: 'protocols',
    name: 'Protocols',
    icon: '🔌',
    description: 'Test',
    available: true,
    lessons,
  };
}

const baseProgress: DemoProgress = { completedLessons: [], lessonSteps: {}, speed: 1 };

function renderWithNotes(ui: ReactElement) {
  return render(<LessonNotesProvider>{ui}</LessonNotesProvider>);
}

describe('LessonNotes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows note indicator when saved content exists', () => {
    localStorage.setItem(LESSON_NOTES_STORAGE_KEY, JSON.stringify({ l1: 'My note' }));
    renderWithNotes(
      <>
        <LessonList
          domain={makeDomain()}
          progress={baseProgress}
          onSelect={vi.fn()}
          onBack={vi.fn()}
          onResetLesson={vi.fn()}
          onResetAll={vi.fn()}
        />
        <LessonNotesPanel />
      </>,
    );
    expect(screen.getByLabelText('Open notes for Lesson 1 (has saved notes)')).toBeTruthy();
  });

  it('opens panel with Save and Close at bottom (no header close)', () => {
    renderWithNotes(
      <>
        <LessonList
          domain={makeDomain()}
          progress={baseProgress}
          onSelect={vi.fn()}
          onBack={vi.fn()}
          onResetLesson={vi.fn()}
          onResetAll={vi.fn()}
        />
        <LessonNotesPanel />
      </>,
    );
    fireEvent.click(screen.getByLabelText('Open notes for Lesson 1'));
    expect(screen.getByTestId('demo-lesson-notes-panel')).toBeTruthy();
    expect(screen.getByTestId('demo-lesson-notes-save-btn')).toBeTruthy();
    expect(screen.getByTestId('demo-lesson-notes-close-btn')).toBeTruthy();
  });

  it('Save persists and dismisses panel', () => {
    renderWithNotes(
      <>
        <LessonList
          domain={makeDomain()}
          progress={baseProgress}
          onSelect={vi.fn()}
          onBack={vi.fn()}
          onResetLesson={vi.fn()}
          onResetAll={vi.fn()}
        />
        <LessonNotesPanel />
      </>,
    );
    fireEvent.click(screen.getByLabelText('Open notes for Lesson 1'));
    fireEvent.change(screen.getByTestId('demo-lesson-notes-textarea'), { target: { value: 'Remember this' } });
    fireEvent.click(screen.getByTestId('demo-lesson-notes-save-btn'));
    expect(screen.queryByTestId('demo-lesson-notes-panel')).toBeNull();
    expect(JSON.parse(localStorage.getItem(LESSON_NOTES_STORAGE_KEY)!).l1).toBe('Remember this');
  });

  it('Close dismisses panel without saving', () => {
    renderWithNotes(
      <>
        <LessonList
          domain={makeDomain()}
          progress={baseProgress}
          onSelect={vi.fn()}
          onBack={vi.fn()}
          onResetLesson={vi.fn()}
          onResetAll={vi.fn()}
        />
        <LessonNotesPanel />
      </>,
    );
    fireEvent.click(screen.getByLabelText('Open notes for Lesson 1'));
    fireEvent.change(screen.getByTestId('demo-lesson-notes-textarea'), { target: { value: 'Discard me' } });
    fireEvent.click(screen.getByTestId('demo-lesson-notes-close-btn'));
    expect(screen.queryByTestId('demo-lesson-notes-panel')).toBeNull();
    expect(localStorage.getItem(LESSON_NOTES_STORAGE_KEY)).toBeNull();
  });

  it('panel header is draggable', () => {
    renderWithNotes(
      <>
        <LessonList
          domain={makeDomain()}
          progress={baseProgress}
          onSelect={vi.fn()}
          onBack={vi.fn()}
          onResetLesson={vi.fn()}
          onResetAll={vi.fn()}
        />
        <LessonNotesPanel />
      </>,
    );
    fireEvent.click(screen.getByLabelText('Open notes for Lesson 1'));
    expect(document.querySelector('.demo-lesson-notes-panel-header--draggable')).toBeTruthy();
    expect(document.querySelector('.demo-lesson-notes-drag-handle')).toBeTruthy();
  });

  it('note button does not trigger lesson select', () => {
    const onSelect = vi.fn();
    renderWithNotes(
      <LessonList
        domain={makeDomain()}
        progress={baseProgress}
        onSelect={onSelect}
        onBack={vi.fn()}
        onResetLesson={vi.fn()}
        onResetAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Open notes for Lesson 1'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('LessonNotesEditor calls onSave with draft text', () => {
    const onSave = vi.fn();
    render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="Lesson 1"
        savedText=""
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('demo-lesson-notes-textarea'), { target: { value: 'draft' } });
    fireEvent.click(screen.getByTestId('demo-lesson-notes-save-btn'));
    expect(onSave).toHaveBeenCalledWith('draft');
  });

  it('Escape closes the floating panel', () => {
    renderWithNotes(
      <>
        <LessonList
          domain={makeDomain()}
          progress={baseProgress}
          onSelect={vi.fn()}
          onBack={vi.fn()}
          onResetLesson={vi.fn()}
          onResetAll={vi.fn()}
        />
        <LessonNotesPanel />
      </>,
    );
    fireEvent.click(screen.getByLabelText('Open notes for Lesson 1'));
    expect(screen.getByTestId('demo-lesson-notes-panel')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('demo-lesson-notes-panel')).toBeNull();
  });

  it('clears unsaved hint after save when draft had trailing spaces', () => {
    render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="Lesson 1"
        savedText=""
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('demo-lesson-notes-textarea'), { target: { value: 'hello   ' } });
    expect(screen.getByTestId('demo-lesson-notes-textarea')).toBeTruthy();
    expect(document.querySelector('.demo-lesson-notes-hint')?.textContent).toContain('Unsaved changes');
    fireEvent.click(screen.getByTestId('demo-lesson-notes-save-btn'));
    expect(document.querySelector('.demo-lesson-notes-hint')?.textContent).not.toContain('Unsaved changes');
    expect((screen.getByTestId('demo-lesson-notes-textarea') as HTMLTextAreaElement).value).toBe('hello');
  });

  it('shows has-notes indicator in list after save and close', () => {
    renderWithNotes(
      <>
        <LessonList
          domain={makeDomain()}
          progress={baseProgress}
          onSelect={vi.fn()}
          onBack={vi.fn()}
          onResetLesson={vi.fn()}
          onResetAll={vi.fn()}
        />
        <LessonNotesPanel />
      </>,
    );
    fireEvent.click(screen.getByLabelText('Open notes for Lesson 1'));
    fireEvent.change(screen.getByTestId('demo-lesson-notes-textarea'), { target: { value: 'Takeaway' } });
    fireEvent.click(screen.getByTestId('demo-lesson-notes-save-btn'));
    expect(screen.getByLabelText('Open notes for Lesson 1 (has saved notes)')).toBeTruthy();
  });

  it('LessonPlayer Notes tab renders inline editor', () => {
    renderWithNotes(
      <LessonPlayer lesson={makeLesson()} onStartDemo={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('demo-lesson-sidebar-notes'));
    expect(screen.getByTestId('demo-lesson-notes-textarea')).toBeTruthy();
    expect(screen.queryByText('Start Demo →')).toBeNull();
  });

  it('notes button stays visible while reset confirm is open', () => {
    const progress: DemoProgress = { ...baseProgress, completedLessons: ['l1'] };
    renderWithNotes(
      <LessonList
        domain={makeDomain()}
        progress={progress}
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onResetLesson={vi.fn()}
        onResetAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('reset-lesson-l1'));
    expect(screen.getByTestId('reset-confirm-l1')).toBeTruthy();
    expect(screen.getByLabelText('Open notes for Lesson 1')).toBeTruthy();
  });
});
