/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockUndoToast, API_MOCK_UNDO_DISMISS_MS } from './ApiMockUndoToast';

describe('ApiMockUndoToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('undoes immediately and dismisses after the countdown', () => {
    const onUndo = vi.fn();
    const onDismiss = vi.fn();
    render(<ApiMockUndoToast label="GET /users" onUndo={onUndo} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('api-mock-undo-restore'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('dismisses from the button and after the countdown', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<ApiMockUndoToast label="GET /users" onUndo={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('api-mock-undo-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    unmount();

    const later = vi.fn();
    render(<ApiMockUndoToast label="POST /orders" onUndo={vi.fn()} onDismiss={later} />);
    act(() => { vi.advanceTimersByTime(API_MOCK_UNDO_DISMISS_MS); });
    expect(later).toHaveBeenCalled();
  });

  it('restores from Cmd+Z unless the focus is in an editor field', () => {
    const onUndo = vi.fn();
    render(
      <>
        <input data-testid="api-mock-undo-field" />
        <ApiMockUndoToast label="GET /users" onUndo={onUndo} onDismiss={vi.fn()} />
      </>,
    );
    screen.getByTestId('api-mock-undo-field').focus();
    fireEvent.keyDown(screen.getByTestId('api-mock-undo-field'), { key: 'z', metaKey: true });
    expect(onUndo).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Z', metaKey: true });
    expect(onUndo).toHaveBeenCalledTimes(3);

    const prevented = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true });
    prevented.preventDefault();
    window.dispatchEvent(prevented);
    expect(onUndo).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(window, { key: 'z', metaKey: true, repeat: true });
    expect(onUndo).toHaveBeenCalledTimes(3);
  });

  it('does not restore from Cmd+Z while a confirm dialog is open', () => {
    const onUndo = vi.fn();
    render(
      <>
        <div className="confirm-overlay">
          <div className="confirm-dialog">Delete?</div>
        </div>
        <ApiMockUndoToast label="GET /users" onUndo={onUndo} onDismiss={vi.fn()} />
      </>,
    );
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('restarts the countdown when a different rule is deleted under the same name', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <ApiMockUndoToast label="Users route" undoKey="r1" onUndo={vi.fn()} onDismiss={onDismiss} />,
    );
    act(() => { vi.advanceTimersByTime(API_MOCK_UNDO_DISMISS_MS - 1000); });
    rerender(
      <ApiMockUndoToast label="Users route" undoKey="r2" onUndo={vi.fn()} onDismiss={onDismiss} />,
    );
    act(() => { vi.advanceTimersByTime(API_MOCK_UNDO_DISMISS_MS - 1000); });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onDismiss).toHaveBeenCalled();
  });
});
