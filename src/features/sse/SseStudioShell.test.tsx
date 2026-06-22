/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SseStudioShell, type SseStudioShellProps } from './SseStudioShell';

function makeProps(overrides?: Partial<SseStudioShellProps>): SseStudioShellProps {
  return {
    topBar: <div data-testid="shell-topbar">topbar</div>,
    left: <div data-testid="shell-left">left content</div>,
    right: <div data-testid="shell-right">right content</div>,
    ...overrides,
  };
}

describe('SseStudioShell', () => {
  // The shell persists its pane width; clear it so each test starts from the
  // default and the async load never restores a value from a sibling test.
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the top bar and both panes', () => {
    render(<SseStudioShell {...makeProps()} />);
    expect(screen.getByTestId('sse-studio-shell')).toBeInTheDocument();
    expect(screen.getByTestId('sse-studio-topbar')).toHaveTextContent('topbar');
    expect(screen.getByTestId('shell-left')).toHaveTextContent('left content');
    expect(screen.getByTestId('shell-right')).toHaveTextContent('right content');
  });

  it('renders the resizable divider', () => {
    render(<SseStudioShell {...makeProps()} />);
    const divider = screen.getByTestId('sse-studio-divider');
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveAttribute('role', 'separator');
    expect(divider).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('renders default pane titles', () => {
    render(<SseStudioShell {...makeProps()} />);
    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('renders custom pane titles', () => {
    render(<SseStudioShell {...makeProps({ leftTitle: 'Config', rightTitle: 'Stream' })} />);
    expect(screen.getByText('Config')).toBeInTheDocument();
    expect(screen.getByText('Stream')).toBeInTheDocument();
  });

  it('omits the status strip when none is provided', () => {
    render(<SseStudioShell {...makeProps()} />);
    expect(screen.queryByTestId('sse-studio-status-strip')).not.toBeInTheDocument();
  });

  it('renders the status strip when provided', () => {
    render(
      <SseStudioShell
        {...makeProps({ statusStrip: <span data-testid="strip">status</span> })}
      />,
    );
    expect(screen.getByTestId('sse-studio-status-strip')).toBeInTheDocument();
    expect(screen.getByTestId('strip')).toHaveTextContent('status');
  });

  it('adjusts the left pane width on divider drag', () => {
    render(<SseStudioShell {...makeProps()} />);
    const split = screen.getByTestId('sse-studio-split');
    Object.defineProperty(split, 'clientWidth', { value: 1200, configurable: true });
    fireEvent(window, new Event('resize'));
    const divider = screen.getByTestId('sse-studio-divider');
    const left = screen.getByText('Connection').closest('.sse-studio-left') as HTMLElement;
    expect(left.style.width).toBe('360px');

    fireEvent.mouseDown(divider, { clientX: 500 });
    fireEvent.mouseMove(window, { clientX: 200 });
    fireEvent.mouseUp(window);
    expect(left.style.width).toBe('280px');
  });

  it('exposes WAI-ARIA separator semantics on the divider', () => {
    render(<SseStudioShell {...makeProps()} />);
    const divider = screen.getByTestId('sse-studio-divider');
    expect(divider).toHaveAttribute('role', 'separator');
    expect(divider).toHaveAttribute('aria-orientation', 'vertical');
    expect(divider).toHaveAttribute('aria-label', 'Resize connection and events panes');
    expect(divider).toHaveAttribute('tabindex', '0');
    expect(divider).toHaveAttribute('aria-valuenow');
    expect(divider).toHaveAttribute('aria-valuemin', '280');
    expect(divider).toHaveAttribute('aria-valuemax');
  });

  it('links the left tab strip to its panel via roving tabindex', () => {
    render(<SseStudioShell {...makeProps({ leftTab: 'auth', onLeftTabChange: () => {} })} />);
    expect(screen.getByTestId('sse-left-tab-auth')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('sse-left-tab-connect')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('sse-left-tab-auth')).toHaveAttribute('aria-controls', 'sse-studio-left-panel');
    const leftPanel = document.getElementById('sse-studio-left-panel');
    expect(leftPanel).toHaveAttribute('role', 'tabpanel');
    expect(leftPanel).toHaveAttribute('aria-labelledby', 'sse-left-tab-auth');
  });

  it('links the right tab strip to its panel via roving tabindex', () => {
    render(<SseStudioShell {...makeProps({ rightTab: 'console', onRightTabChange: () => {} })} />);
    expect(screen.getByTestId('sse-right-tab-console')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('sse-right-tab-events')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('sse-right-tab-console')).toHaveAttribute('aria-controls', 'sse-studio-right-panel');
    const rightPanel = document.getElementById('sse-studio-right-panel');
    expect(rightPanel).toHaveAttribute('role', 'tabpanel');
    expect(rightPanel).toHaveAttribute('aria-labelledby', 'sse-right-tab-console');
  });

  it('navigates the left tab strip with arrow keys (automatic activation)', () => {
    const onLeftTabChange = vi.fn();
    render(<SseStudioShell {...makeProps({ leftTab: 'connect', onLeftTabChange })} />);
    const tablist = screen.getByRole('tablist', { name: 'Left pane' });
    screen.getByTestId('sse-left-tab-connect').focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onLeftTabChange).toHaveBeenCalledWith('auth');
  });

  it('navigates the right tab strip with arrow keys', () => {
    const onRightTabChange = vi.fn();
    render(<SseStudioShell {...makeProps({ rightTab: 'events', onRightTabChange })} />);
    const tablist = screen.getByRole('tablist', { name: 'Right pane' });
    screen.getByTestId('sse-right-tab-events').focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onRightTabChange).toHaveBeenCalledWith('console');
  });
});
