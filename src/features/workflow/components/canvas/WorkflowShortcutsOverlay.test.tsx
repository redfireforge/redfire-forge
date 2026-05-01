/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowShortcutsOverlay, { SHORTCUTS } from './WorkflowShortcutsOverlay';

describe('WorkflowShortcutsOverlay', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <WorkflowShortcutsOverlay open={false} onClose={vi.fn()} />,
    );
    expect(container.querySelector('.wf-shortcuts-overlay')).toBeNull();
  });

  it('renders overlay when open is true', () => {
    render(<WorkflowShortcutsOverlay open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
  });

  it('renders all shortcut categories', () => {
    render(<WorkflowShortcutsOverlay open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Canvas')).toBeTruthy();
    expect(screen.getByText('Editing')).toBeTruthy();
    expect(screen.getByText('Workflow')).toBeTruthy();
  });

  it('renders all defined shortcuts', () => {
    render(<WorkflowShortcutsOverlay open={true} onClose={vi.fn()} />);
    for (const shortcut of SHORTCUTS) {
      expect(screen.getByText(shortcut.label)).toBeTruthy();
    }
  });

  it('calls onClose when ESC button is clicked', () => {
    const onClose = vi.fn();
    render(<WorkflowShortcutsOverlay open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('ESC'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape keydown', () => {
    const onClose = vi.fn();
    render(<WorkflowShortcutsOverlay open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <WorkflowShortcutsOverlay open={true} onClose={onClose} />,
    );
    const backdrop = container.querySelector('.wf-shortcuts-backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders keyboard key badges', () => {
    const { container } = render(
      <WorkflowShortcutsOverlay open={true} onClose={vi.fn()} />,
    );
    const kbdKeys = container.querySelectorAll('.wf-kbd-key');
    expect(kbdKeys.length).toBeGreaterThan(0);
  });

  it('does not attach keydown listener when closed', () => {
    const onClose = vi.fn();
    render(<WorkflowShortcutsOverlay open={false} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('SHORTCUTS array has expected number of entries', () => {
    expect(SHORTCUTS.length).toBeGreaterThanOrEqual(15);
  });

  it('each shortcut has required fields', () => {
    for (const s of SHORTCUTS) {
      expect(s.key).toBeTruthy();
      expect(s.category).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.display).toBeTruthy();
    }
  });
});
