/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import type React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LessonPlayer from './LessonPlayer';
import { LessonNotesProvider } from './LessonNotesContext';
import type { DemoLesson } from './types';

function makeLesson(overrides: Partial<DemoLesson> = {}): DemoLesson {
  return {
    id: 'lesson-player-gap',
    domainId: 'protocols',
    name: 'Player Gap Lesson',
    description: 'desc',
    estimatedMinutes: 3,
    concept: { title: 'Concept', body: 'Body text' },
    steps: [
      { id: 's1', title: 'Step One', description: 'First step', diagram: '<svg></svg>' },
      { id: 's2', title: 'Step Two', description: 'Second step' },
    ],
    ...overrides,
  };
}

describe('LessonPlayer — coverage gaps', () => {
  const wrap = (ui: React.ReactNode) => render(<LessonNotesProvider>{ui}</LessonNotesProvider>);

  it('renders notes editor and saves through context', () => {
    wrap(<LessonPlayer lesson={makeLesson()} onStartDemo={vi.fn()} />);
    fireEvent.click(screen.getByTestId('demo-lesson-sidebar-notes'));
    const textarea = screen.getByTestId('demo-lesson-notes-textarea');
    fireEvent.change(textarea, { target: { value: 'my note' } });
    fireEvent.click(screen.getByTestId('demo-lesson-notes-save-btn'));
    expect(screen.getByTestId('demo-lesson-sidebar-notes')).toBeTruthy();
  });

  it('shows desktop-only gate and disables start for desktop-only lessons on web', async () => {
    const platform = await import('./utils/lessonPlatform');
    vi.spyOn(platform, 'isLessonDesktopOnlyBlocked').mockReturnValue(true);
    wrap(<LessonPlayer lesson={makeLesson({ desktopOnly: true })} onStartDemo={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Desktop app required/i })).toHaveProperty('disabled', true);
  });

  it('navigates step detail prev/next and shows diagram', () => {
    wrap(<LessonPlayer lesson={makeLesson()} onStartDemo={vi.fn()} />);
    fireEvent.click(screen.getByText('Step One'));
    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(document.querySelector('.demo-step-diagram')).toBeTruthy();
    fireEvent.click(screen.getByText('Next →'));
    expect(screen.getByText('Step 2')).toBeTruthy();
    fireEvent.click(screen.getByText('← Prev'));
    expect(screen.getByText('Step 1')).toBeTruthy();
  });

  it('shows docker waiting label until prerequisite gate clears', async () => {
    const platform = await import('./utils/lessonPlatform');
    vi.spyOn(platform, 'isLessonDesktopOnlyBlocked').mockReturnValue(false);
    wrap(
      <LessonPlayer
        lesson={makeLesson({ dockerEndpoint: 'http://localhost:4010/health' })}
        onStartDemo={vi.fn()}
      />,
    );
    expect(screen.getByText(/Waiting for Docker/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Waiting for Docker/i })).toHaveProperty('disabled', true);
  });
});
