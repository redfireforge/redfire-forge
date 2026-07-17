/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LiveDemo from './LiveDemo';
import LessonNotesPanel from './LessonNotesPanel';
import { LessonNotesProvider } from './LessonNotesContext';
import type { DemoLesson } from './types';

function makeLesson(): DemoLesson {
  return {
    id: 'live-demo-gap',
    domainId: 'protocols',
    name: 'Live Demo Gap',
    description: 'desc',
    estimatedMinutes: 3,
    concept: { title: 'T', body: 'B' },
    steps: [{ id: 's1', title: 'Step', description: 'Do the thing' }],
  };
}

describe('LiveDemo — coverage gaps', () => {
  it('toggles notes panel from header icon', () => {
    render(
      <LessonNotesProvider>
        <LiveDemo
          lesson={makeLesson()}
          stepIndex={0}
          isPlaying={false}
          stepPhase="done"
          onNext={vi.fn()}
          onTogglePlay={vi.fn()}
          onSkipReading={vi.fn()}
          onRestart={vi.fn()}
          onExit={vi.fn()}
          onComplete={vi.fn()}
        />
        <LessonNotesPanel />
      </LessonNotesProvider>,
    );
    fireEvent.click(screen.getByTestId('demo-live-notes-btn'));
    expect(screen.getByTestId('demo-lesson-notes-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('demo-live-notes-btn'));
    expect(screen.queryByTestId('demo-lesson-notes-panel')).toBeNull();
  });

  it('lesson name mousedown stops propagation so header drag does not start', () => {
    const stopPropagation = vi.spyOn(Event.prototype, 'stopPropagation');
    render(
      <LiveDemo
        lesson={makeLesson()}
        stepIndex={0}
        isPlaying={false}
        stepPhase="done"
        onNext={vi.fn()}
        onTogglePlay={vi.fn()}
        onSkipReading={vi.fn()}
        onRestart={vi.fn()}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );
    fireEvent.mouseDown(screen.getByText('Live Demo Gap'));
    expect(stopPropagation).toHaveBeenCalled();
    stopPropagation.mockRestore();
  });
});
