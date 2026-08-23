/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TrashUndoToast from './TrashUndoToast';
import { makeTrashItem } from '@test-utils/factories';

describe('TrashUndoToast', () => {
  let onUndo: ReturnType<typeof vi.fn>;
  let onDismiss: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onUndo = vi.fn();
    onDismiss = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders entity name in message', () => {
    render(<TrashUndoToast item={makeTrashItem({ entityName: 'My Scenario' })} onUndo={onUndo} onDismiss={onDismiss} />);
    expect(screen.getByText('My Scenario')).toBeInTheDocument();
    expect(screen.getByText('moved to Trash')).toBeInTheDocument();
  });

  it('renders Undo and dismiss buttons', () => {
    render(<TrashUndoToast item={makeTrashItem()} onUndo={onUndo} onDismiss={onDismiss} />);
    expect(screen.getByRole('button', { name: /undo delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('auto-dismisses after 5 seconds', () => {
    render(<TrashUndoToast item={makeTrashItem()} onUndo={onUndo} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(5000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onUndo and clears timer when Undo is clicked', () => {
    render(<TrashUndoToast item={makeTrashItem()} onUndo={onUndo} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /undo delete/i }));

    expect(onUndo).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(6000); });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss and clears timer when dismiss button is clicked', () => {
    render(<TrashUndoToast item={makeTrashItem()} onUndo={onUndo} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(6000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has role="alert" for accessibility', () => {
    render(<TrashUndoToast item={makeTrashItem()} onUndo={onUndo} onDismiss={onDismiss} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders progress bar with correct animation duration', () => {
    render(<TrashUndoToast item={makeTrashItem()} onUndo={onUndo} onDismiss={onDismiss} />);
    const progress = document.querySelector('.trash-toast-progress') as HTMLElement;
    expect(progress).not.toBeNull();
    expect(progress.style.animationDuration).toBe('5000ms');
  });

  it('renders in a portal (attached to document.body)', () => {
    const { container } = render(<TrashUndoToast item={makeTrashItem()} onUndo={onUndo} onDismiss={onDismiss} />);
    const toastInContainer = container.querySelector('.trash-toast-container');
    expect(toastInContainer).toBeNull();

    const toastInBody = document.body.querySelector('.trash-toast-container');
    expect(toastInBody).not.toBeNull();
  });

  it('displays correct entity name for different entity types', () => {
    render(
      <TrashUndoToast
        item={makeTrashItem({ entityName: 'Login Feature Group', entityType: 'featureGroup' })}
        onUndo={onUndo}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByText('Login Feature Group')).toBeInTheDocument();
  });

  it('cleans up timer on unmount', () => {
    const { unmount } = render(<TrashUndoToast item={makeTrashItem()} onUndo={onUndo} onDismiss={onDismiss} />);
    unmount();

    act(() => { vi.advanceTimersByTime(6000); });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('resets timer when item changes', () => {
    const itemA = makeTrashItem({ id: 'a', entityName: 'Item A' });
    const itemB = makeTrashItem({ id: 'b', entityName: 'Item B' });

    const { rerender } = render(
      <TrashUndoToast item={itemA} onUndo={onUndo} onDismiss={onDismiss} />
    );

    act(() => { vi.advanceTimersByTime(3000); });
    expect(onDismiss).not.toHaveBeenCalled();

    rerender(<TrashUndoToast item={itemB} onUndo={onUndo} onDismiss={onDismiss} />);

    act(() => { vi.advanceTimersByTime(4000); });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
