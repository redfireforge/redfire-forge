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

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="Lesson One"
        savedText=""
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId('demo-lesson-notes-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears pending save-feedback timer on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { unmount } = render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="Lesson One"
        savedText=""
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('demo-lesson-notes-textarea'), { target: { value: 'draft' } });
    fireEvent.click(screen.getByTestId('demo-lesson-notes-save-btn'));
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('resets save feedback when lesson changes', () => {
    const { rerender } = render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="Lesson One"
        savedText=""
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('demo-lesson-notes-textarea'), { target: { value: 'draft' } });
    fireEvent.click(screen.getByTestId('demo-lesson-notes-save-btn'));
    expect(screen.getByTestId('demo-lesson-notes-status').textContent).toContain('Saved locally');

    rerender(
      <LessonNotesEditor
        lessonId="l2"
        lessonName="Lesson Two"
        savedText=""
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('demo-lesson-notes-status').textContent).toBe('');
  });

  it('handles Home/End key behavior inside textarea (plain and shift selection)', () => {
    render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="Lesson One"
        savedText=""
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const textarea = screen.getByTestId('demo-lesson-notes-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'alpha\nbeta\ngamma' } });

    textarea.focus();
    textarea.setSelectionRange(8, 8);

    fireEvent.keyDown(textarea, { key: 'Home' });
    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(6);

    fireEvent.keyDown(textarea, { key: 'End' });
    expect(textarea.selectionStart).toBe(10);
    expect(textarea.selectionEnd).toBe(10);

    textarea.setSelectionRange(6, 10, 'backward');
    fireEvent.keyDown(textarea, { key: 'Home', shiftKey: true });
    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(10);
  });

  it('clears prior save-feedback timer when save is clicked repeatedly', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="Lesson One"
        savedText=""
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('demo-lesson-notes-textarea'), { target: { value: 'draft 1' } });
    fireEvent.click(screen.getByTestId('demo-lesson-notes-save-btn'));
    fireEvent.change(screen.getByTestId('demo-lesson-notes-textarea'), { target: { value: 'draft 2' } });
    fireEvent.click(screen.getByTestId('demo-lesson-notes-save-btn'));

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('ignores Home/End override when modifier keys are pressed', () => {
    render(
      <LessonNotesEditor
        lessonId="l1"
        lessonName="Lesson One"
        savedText=""
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const textarea = screen.getByTestId('demo-lesson-notes-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'alpha\nbeta' } });
    textarea.focus();
    textarea.setSelectionRange(7, 7);

    fireEvent.keyDown(textarea, { key: 'Home', metaKey: true });
    expect(textarea.selectionStart).toBe(7);
    expect(textarea.selectionEnd).toBe(7);
  });
});
