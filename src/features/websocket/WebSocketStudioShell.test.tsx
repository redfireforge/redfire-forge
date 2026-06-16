/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WebSocketStudioShell, type WebSocketStudioShellProps } from './WebSocketStudioShell';

function makeProps(overrides?: Partial<WebSocketStudioShellProps>): WebSocketStudioShellProps {
  return {
    mode: 'client',
    onModeChange: vi.fn(),
    leftTab: 'connect',
    onLeftTabChange: vi.fn(),
    rightTab: 'events',
    onRightTabChange: vi.fn(),
    children: <div data-testid="shell-child">child content</div>,
    ...overrides,
  };
}

describe('WebSocketStudioShell', () => {
  // The shell persists its pane width; clear it so each test starts from the
  // default and the async load never restores a value from a sibling test.
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the mode switch and children', () => {
    render(<WebSocketStudioShell {...makeProps()} />);
    expect(screen.getByTestId('ws-studio-shell')).toBeInTheDocument();
    expect(screen.getByTestId('mode-client')).toBeInTheDocument();
    expect(screen.getByTestId('mode-mock')).toBeInTheDocument();
    expect(screen.getByTestId('mode-saved')).toBeInTheDocument();
    expect(screen.getByTestId('shell-child')).toHaveTextContent('child content');
  });

  it('marks the active mode with aria-selected', () => {
    render(<WebSocketStudioShell {...makeProps({ mode: 'mock' })} />);
    expect(screen.getByTestId('mode-mock')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('mode-client')).toHaveAttribute('aria-selected', 'false');
  });

  it('fires onModeChange when a mode button is clicked', () => {
    const onModeChange = vi.fn();
    render(<WebSocketStudioShell {...makeProps({ onModeChange })} />);
    fireEvent.click(screen.getByTestId('mode-saved'));
    expect(onModeChange).toHaveBeenCalledWith('saved');
  });

  it('renders the split chrome (divider + right pane) only in client mode', () => {
    const { rerender } = render(<WebSocketStudioShell {...makeProps({ mode: 'client' })} />);
    expect(screen.getByTestId('ws-studio-split')).toBeInTheDocument();
    expect(screen.getByTestId('ws-studio-divider')).toBeInTheDocument();
    expect(screen.getByTestId('left-tab-send')).toBeInTheDocument();
    expect(screen.getByTestId('right-tab-events')).toBeInTheDocument();

    rerender(<WebSocketStudioShell {...makeProps({ mode: 'mock' })} />);
    // The split container persists (so children stay mounted) but the divider,
    // left-tab strip, and right pane are gone in non-client modes.
    expect(screen.getByTestId('ws-studio-split')).toBeInTheDocument();
    expect(screen.queryByTestId('ws-studio-divider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('left-tab-send')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-tab-events')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell-child')).toBeInTheDocument();

    rerender(<WebSocketStudioShell {...makeProps({ mode: 'saved' })} />);
    expect(screen.queryByTestId('ws-studio-divider')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell-child')).toBeInTheDocument();
  });

  it('keeps the same child DOM node mounted across mode switches', () => {
    const { rerender } = render(<WebSocketStudioShell {...makeProps({ mode: 'client' })} />);
    const childBefore = screen.getByTestId('shell-child');
    rerender(<WebSocketStudioShell {...makeProps({ mode: 'mock' })} />);
    const childAfterMock = screen.getByTestId('shell-child');
    rerender(<WebSocketStudioShell {...makeProps({ mode: 'client' })} />);
    const childAfterClient = screen.getByTestId('shell-child');
    // Same DOM node reference ⇒ React preserved the subtree (no remount),
    // so a live WebSocket connection inside the child survives mode switches.
    expect(childAfterMock).toBe(childBefore);
    expect(childAfterClient).toBe(childBefore);
  });

  it('fires onLeftTabChange and onRightTabChange in client mode', () => {
    const onLeftTabChange = vi.fn();
    const onRightTabChange = vi.fn();
    render(<WebSocketStudioShell {...makeProps({ onLeftTabChange, onRightTabChange })} />);
    fireEvent.click(screen.getByTestId('left-tab-auth'));
    expect(onLeftTabChange).toHaveBeenCalledWith('auth');
    fireEvent.click(screen.getByTestId('right-tab-stats'));
    expect(onRightTabChange).toHaveBeenCalledWith('stats');
  });

  it('renders the running badge for mock mode and the profile count for saved mode', () => {
    render(<WebSocketStudioShell {...makeProps({ mockRunning: true, profileCount: 3 })} />);
    expect(screen.getByLabelText('Mock server running')).toBeInTheDocument();
    expect(screen.getByTestId('mode-saved')).toHaveTextContent('3');
  });

  it('shows the message-count badge on the compose left tab', () => {
    render(<WebSocketStudioShell {...makeProps({ messageCount: 7 })} />);
    expect(screen.getByTestId('left-tab-send')).toHaveTextContent('7');
  });

  it('updates the left width when dragging the divider', () => {
    render(<WebSocketStudioShell {...makeProps()} />);
    const left = screen.getByTestId('ws-studio-split').firstChild as HTMLElement;
    const initialWidth = left.style.width;
    fireEvent.mouseDown(screen.getByTestId('ws-studio-divider'), { clientX: 560 });
    fireEvent.mouseMove(window, { clientX: 700 });
    fireEvent.mouseUp(window);
    expect(left.style.width).not.toBe(initialWidth);
  });

  it('renders the topBar slot above the split when provided', () => {
    render(
      <WebSocketStudioShell
        {...makeProps({
          mode: 'mock',
          topBar: <div data-testid="shell-topbar-content">bar</div>,
        })}
      />,
    );
    expect(screen.getByTestId('ws-studio-topbar')).toBeInTheDocument();
    expect(screen.getByTestId('shell-topbar-content')).toHaveTextContent('bar');
  });

  it('does not render the topBar wrapper when no topBar is provided', () => {
    render(<WebSocketStudioShell {...makeProps()} />);
    expect(screen.queryByTestId('ws-studio-topbar')).not.toBeInTheDocument();
  });

  it('opts a non-client mode into the split when a rightPane is provided', () => {
    render(
      <WebSocketStudioShell
        {...makeProps({
          mode: 'saved',
          rightPane: <div data-testid="shell-right">detail</div>,
        })}
      />,
    );
    // Divider + right pane render for saved when a rightPane is supplied…
    expect(screen.getByTestId('ws-studio-divider')).toBeInTheDocument();
    expect(screen.getByTestId('shell-right')).toHaveTextContent('detail');
    // …but the shell tab strips stay client-only.
    expect(screen.queryByTestId('left-tab-send')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-tab-events')).not.toBeInTheDocument();
  });

  it('exposes WAI-ARIA separator semantics on the divider', () => {
    render(<WebSocketStudioShell {...makeProps()} />);
    const divider = screen.getByTestId('ws-studio-divider');
    expect(divider).toHaveAttribute('role', 'separator');
    expect(divider).toHaveAttribute('aria-orientation', 'vertical');
    expect(divider).toHaveAttribute('aria-label', 'Resize left and right panes');
    expect(divider).toHaveAttribute('tabindex', '0');
    expect(divider).toHaveAttribute('aria-valuenow');
    expect(divider).toHaveAttribute('aria-valuemin', '440');
    expect(divider).toHaveAttribute('aria-valuemax');
  });

  it('applies roving tabindex and aria-controls to the mode strip', () => {
    render(<WebSocketStudioShell {...makeProps({ mode: 'mock' })} />);
    expect(screen.getByTestId('mode-mock')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('mode-client')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('mode-saved')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('mode-mock')).toHaveAttribute('aria-controls', 'ws-studio-split');
  });

  it('links the left/right tab strips to their panels via roving tabindex', () => {
    render(<WebSocketStudioShell {...makeProps({ leftTab: 'auth', rightTab: 'stats' })} />);
    expect(screen.getByTestId('left-tab-auth')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('left-tab-send')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('left-tab-auth')).toHaveAttribute('aria-controls', 'ws-studio-left-panel');
    expect(screen.getByTestId('right-tab-stats')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('right-tab-events')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('right-tab-stats')).toHaveAttribute('aria-controls', 'ws-studio-right-panel');

    const leftPanel = document.getElementById('ws-studio-left-panel');
    expect(leftPanel).toHaveAttribute('role', 'tabpanel');
    expect(leftPanel).toHaveAttribute('aria-labelledby', 'ws-left-tab-auth');
    const rightPanel = document.getElementById('ws-studio-right-panel');
    expect(rightPanel).toHaveAttribute('role', 'tabpanel');
    expect(rightPanel).toHaveAttribute('aria-labelledby', 'ws-right-tab-stats');
  });

  it('navigates the mode strip with arrow keys (automatic activation)', () => {
    const onModeChange = vi.fn();
    render(<WebSocketStudioShell {...makeProps({ onModeChange })} />);
    const tablist = screen.getByRole('tablist', { name: 'Studio mode' });
    screen.getByTestId('mode-client').focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onModeChange).toHaveBeenCalledWith('mock');
  });

  it('navigates the left tab strip with arrow keys', () => {
    const onLeftTabChange = vi.fn();
    render(<WebSocketStudioShell {...makeProps({ leftTab: 'connect', onLeftTabChange })} />);
    const tablist = screen.getByRole('tablist', { name: 'Left pane' });
    screen.getByTestId('left-tab-connect').focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onLeftTabChange).toHaveBeenCalledWith('params');
  });

  it('wraps the right tab strip from the last tab to the first on arrow keys', () => {
    const onRightTabChange = vi.fn();
    render(<WebSocketStudioShell {...makeProps({ rightTab: 'schema', onRightTabChange })} />);
    const tablist = screen.getByRole('tablist', { name: 'Right pane' });
    screen.getByTestId('right-tab-schema').focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onRightTabChange).toHaveBeenCalledWith('events');
  });
});
