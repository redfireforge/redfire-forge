/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  LessonNotesProvider,
  useLessonNotesContext,
  useLessonNotesContextOptional,
  lessonNotesPanelOpenRef,
} from './LessonNotesContext';

function PanelProbe() {
  const ctx = useLessonNotesContext();
  return (
    <div>
      <span data-testid="panel-open">{String(ctx.panelOpen)}</span>
      <button type="button" onClick={() => ctx.openPanel({ lessonId: 'l1', lessonName: 'L1' })}>
        open
      </button>
      <button type="button" onClick={() => ctx.closePanel()}>close</button>
    </div>
  );
}

describe('LessonNotesContext — coverage gaps', () => {
  it('useLessonNotesContextOptional returns null outside provider', () => {
    function Probe() {
      const ctx = useLessonNotesContextOptional();
      return <span data-testid="opt">{ctx === null ? 'null' : 'set'}</span>;
    }
    render(<Probe />);
    expect(screen.getByTestId('opt').textContent).toBe('null');
  });

  it('openPanel and closePanel toggle panelOpen ref', () => {
    render(
      <LessonNotesProvider>
        <PanelProbe />
      </LessonNotesProvider>,
    );
    expect(screen.getByTestId('panel-open').textContent).toBe('false');
    act(() => {
      screen.getByText('open').click();
    });
    expect(screen.getByTestId('panel-open').textContent).toBe('true');
    expect(lessonNotesPanelOpenRef.current).toBe(true);
    act(() => {
      screen.getByText('close').click();
    });
    expect(lessonNotesPanelOpenRef.current).toBe(false);
  });

  it('useLessonNotesContext throws outside provider', () => {
    function Bad() {
      useLessonNotesContext();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/LessonNotesProvider/);
  });
});
