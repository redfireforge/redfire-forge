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
});
