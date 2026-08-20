/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import DemoTerminal from './DemoTerminal';

describe('DemoTerminal', () => {
  it('renders nothing when neither command nor output is provided', () => {
    const { container } = render(<DemoTerminal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the command with a prompt', () => {
    render(<DemoTerminal command="npx tsx cli/index.ts --version" />);
    expect(screen.getByText('npx tsx cli/index.ts --version')).toBeTruthy();
    expect(screen.getByText('$')).toBeTruthy();
  });

  it('renders each output line', () => {
    render(<DemoTerminal output={'line one\nline two\nline three'} />);
    expect(screen.getByText('line one')).toBeTruthy();
    expect(screen.getByText('line two')).toBeTruthy();
    expect(screen.getByText('line three')).toBeTruthy();
  });

  it('applies the highlight class only to lines within the 1-based inclusive range', () => {
    render(<DemoTerminal output={'a\nb\nc\nd'} highlightLines={[[2, 3]]} />);
    const lineB = screen.getByText('b');
    const lineC = screen.getByText('c');
    const lineA = screen.getByText('a');
    const lineD = screen.getByText('d');
    expect(lineB.className).toContain('demo-terminal-line--highlight');
    expect(lineC.className).toContain('demo-terminal-line--highlight');
    expect(lineA.className).not.toContain('demo-terminal-line--highlight');
    expect(lineD.className).not.toContain('demo-terminal-line--highlight');
  });

  it('cycles between multiple highlight ranges over time', () => {
    vi.useFakeTimers();
    try {
      render(<DemoTerminal output={'a\nb\nc\nd'} highlightLines={[[1, 1], [4, 4]]} />);
      expect(screen.getByText('a').className).toContain('demo-terminal-line--highlight');
      expect(screen.getByText('d').className).not.toContain('demo-terminal-line--highlight');

      act(() => { vi.advanceTimersByTime(2600); });

      expect(screen.getByText('a').className).not.toContain('demo-terminal-line--highlight');
      expect(screen.getByText('d').className).toContain('demo-terminal-line--highlight');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders without a command when only output is provided', () => {
    render(<DemoTerminal output="just output" />);
    expect(screen.queryByText('$')).toBeNull();
    expect(screen.getByText('just output')).toBeTruthy();
  });
});
