/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WorkflowToastProvider, { ToastContext } from './WorkflowToastProvider';
import { useContext } from 'react';

function TestConsumer() {
  const api = useContext(ToastContext);
  return (
    <div>
      <button onClick={() => api?.show('success', 'Saved', 'Details')}>Show</button>
      <button onClick={() => api?.show('error', 'Failed')}>Error</button>
      <button onClick={() => api?.show('info', 'Note', undefined, 0)}>Persistent</button>
      <button onClick={() => api?.show('warning', 'Caution', 'Look out')}>Warn</button>
      <button onClick={() => api?.show('info', 'FYI', 'More info')}>InfoToast</button>
      <button onClick={() => api?.show('success', 'NoAuto', undefined, -1)}>NonPositiveDuration</button>
      <button onClick={() => api?.show('success', 'Nullish', undefined, null as unknown as number)}>NullDuration</button>
      <button onClick={() => api?.dismiss('toast-nonexistent')}>DismissUnknown</button>
      <span data-testid="has-api">{api ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('WorkflowToastProvider', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('provides ToastApi to children', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    expect(screen.getByTestId('has-api').textContent).toBe('yes');
  });

  it('shows a toast with title and subtitle', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Details')).toBeTruthy();
  });

  it('renders correct icon for success toast', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('renders correct icon for error toast', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Error'));
    expect(screen.getByText('✗')).toBeTruthy();
  });

  it('auto-dismisses toast after durationMs', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByText('Saved')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('does not auto-dismiss when durationMs is 0', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Persistent'));
    expect(screen.getByText('Note')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByText('Note')).toBeTruthy();
  });

  it('dismiss button removes toast immediately', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Persistent'));
    expect(screen.getByText('Note')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('Note')).toBeNull();
  });

  it('multiple toasts can be shown simultaneously', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Show'));
    fireEvent.click(screen.getByText('Error'));
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
  });

  it('renders progress bar for timed toasts', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Show'));
    const progress = document.querySelector('.wf-toast-progress');
    expect(progress).toBeTruthy();
    expect((progress as HTMLElement).style.animationDuration).toBe('4000ms');
  });

  it('does not render progress bar for persistent toasts', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Persistent'));
    const progressBars = document.querySelectorAll('.wf-toast-progress');
    expect(progressBars.length).toBe(0);
  });

  it('renders toast with correct CSS class for type', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Error'));
    const toast = document.querySelector('.wf-toast-error');
    expect(toast).toBeTruthy();
  });

  it('toast stack has role="status" for accessibility', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    const stack = document.querySelector('.wf-toast-stack');
    expect(stack?.getAttribute('role')).toBe('status');
  });

  it('renders warning icon and subtitle', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Warn'));
    expect(screen.getByText('⚠')).toBeTruthy();
    expect(screen.getByText('Look out')).toBeTruthy();
    expect(document.querySelector('.wf-toast-warning')).toBeTruthy();
  });

  it('renders info timed toast with icon and progress', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('InfoToast'));
    expect(screen.getByText('ℹ')).toBeTruthy();
    expect(screen.getByText('More info')).toBeTruthy();
    expect(document.querySelector('.wf-toast-progress-info')).toBeTruthy();
  });

  it('omits auto-dismiss timer and progress when duration is not positive', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('NonPositiveDuration'));
    expect(screen.getByText('NoAuto')).toBeTruthy();
    expect(document.querySelector('.wf-toast-progress')).toBeNull();
  });

  it('dismiss with unknown id leaves toasts unchanged', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByText('Saved')).toBeTruthy();
    fireEvent.click(screen.getByText('DismissUnknown'));
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('uses nullish duration for progress visibility coalescing', () => {
    render(
      <WorkflowToastProvider>
        <TestConsumer />
      </WorkflowToastProvider>,
    );
    fireEvent.click(screen.getByText('NullDuration'));
    expect(screen.getByText('Nullish')).toBeTruthy();
    expect(document.querySelector('.wf-toast-progress')).toBeNull();
  });
});
