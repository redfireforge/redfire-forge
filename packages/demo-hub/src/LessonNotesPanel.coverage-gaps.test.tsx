/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LessonNotesPanel from './LessonNotesPanel';
import { LessonNotesProvider, useLessonNotesContext } from './LessonNotesContext';

function PanelOpener() {
  const ctx = useLessonNotesContext();
  return (
    <button type="button" onClick={() => ctx.openPanel({ lessonId: 'l1', lessonName: 'L1' })}>
      open-panel
    </button>
  );
}

describe('LessonNotesPanel — coverage gaps', () => {
  it('closes on Escape key when panel is open', () => {
    render(
      <LessonNotesProvider>
        <PanelOpener />
        <LessonNotesPanel />
      </LessonNotesProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText('open-panel'));
    });
    expect(screen.getByTestId('demo-lesson-notes-panel')).toBeTruthy();
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByTestId('demo-lesson-notes-panel')).toBeNull();
  });

  it('saves note and closes when editor submits', () => {
    render(
      <LessonNotesProvider>
        <PanelOpener />
        <LessonNotesPanel />
      </LessonNotesProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText('open-panel'));
    });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'My lesson note' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.queryByTestId('demo-lesson-notes-panel')).toBeNull();
  });

  it('ignores non-Escape keys when panel is open', () => {
    render(
      <LessonNotesProvider>
        <PanelOpener />
        <LessonNotesPanel />
      </LessonNotesProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText('open-panel'));
    });
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(screen.getByTestId('demo-lesson-notes-panel')).toBeTruthy();
  });
});
