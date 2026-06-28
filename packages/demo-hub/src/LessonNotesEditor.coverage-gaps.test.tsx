/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LessonNotesEditor from './LessonNotesEditor';

describe('LessonNotesEditor — coverage gaps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows save feedback then clears after timeout', () => {
    const onSave = vi.fn();
    render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="Lesson One"
        savedText=""
        onSave={onSave}
        onClose={vi.fn()}
        showHeader
      />,
    );
    const textarea = screen.getByTestId('demo-lesson-notes-textarea');
    fireEvent.change(textarea, { target: { value: 'draft' } });
    act(() => {
      screen.getByTestId('demo-lesson-notes-save-btn').click();
    });
    expect(onSave).toHaveBeenCalled();
    expect(screen.getByTestId('demo-lesson-notes-status').textContent).toContain('Saved locally');
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByTestId('demo-lesson-notes-status').textContent).toBe('');
  });

  it('shows unsaved hint when draft differs from saved text', () => {
    render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="Lesson One"
        savedText="saved"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const textarea = screen.getByTestId('demo-lesson-notes-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'changed' } });
    expect(document.querySelector('.demo-lesson-notes-hint')?.textContent).toContain('Unsaved changes');
  });

  it('resets draft when lessonId changes', () => {
    const { rerender } = render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="One"
        savedText="a"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    rerender(
      <LessonNotesEditor
        lessonId="l2"
        lessonName="Two"
        savedText="b"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect((screen.getByTestId('demo-lesson-notes-textarea') as HTMLTextAreaElement).value).toBe('b');
  });
});
