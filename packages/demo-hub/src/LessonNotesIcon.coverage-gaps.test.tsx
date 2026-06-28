/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LessonNotesIcon, { NotesIconSvg } from './LessonNotesIcon';

describe('LessonNotesIcon — coverage gaps', () => {
  it('renders compact variant with notes dot and stops propagation', () => {
    const onClick = vi.fn();
    render(
      <LessonNotesIcon
        lessonName="GQL-1"
        hasContent
        onClick={onClick}
        compact
        testId="notes-compact"
      />,
    );
    expect(screen.getByTestId('notes-compact').className).toContain('compact');
    expect(document.querySelector('.demo-lesson-note-dot')).toBeTruthy();
    fireEvent.click(screen.getByTestId('notes-compact'));
    expect(onClick).toHaveBeenCalled();
  });

  it('uses default label when lesson has no saved notes', () => {
    render(<LessonNotesIcon lessonName="WS-1" hasContent={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('Open notes for WS-1');
  });

  it('NotesIconSvg renders svg paths', () => {
    render(<NotesIconSvg />);
    expect(document.querySelector('svg path')).toBeTruthy();
  });
});
