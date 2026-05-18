/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useConfirmDialog } from './useConfirmDialog';

/**
 * Keeps hook state in renderHook while mirroring confirmDialogElement in a DOM tree so
 * interactions exercise the real confirm/cancel/onConfirm closures.
 */
function renderConfirmDialogHarness() {
  const hook = renderHook(() => useConfirmDialog());

  const ui = render(
    <div data-testid="confirm-dialog-mount">{hook.result.current.confirmDialogElement}</div>,
  );

  const syncMount = () => {
    ui.rerender(<div data-testid="confirm-dialog-mount">{hook.result.current.confirmDialogElement}</div>);
  };

  return { hook, ui, syncMount };
}

afterEach(() => {
  cleanup();
});

describe('useConfirmDialog', () => {
  it('starts with confirmAction=null and falsy dialog element', () => {
    const { result } = renderHook(() => useConfirmDialog());

    expect(result.current.confirmAction).toBeNull();
    expect(result.current.confirmDialogElement).toBeFalsy();
  });

  describe('confirm()', () => {
    it('sets final stage immediately when detail is omitted', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();
      const onConfirm = vi.fn();

      act(() => {
        hook.result.current.confirm('Remove this folder?', onConfirm);
      });

      expect(hook.result.current.confirmAction).toEqual({
        message: 'Remove this folder?',
        onConfirm,
        detail: undefined,
        stage: 'final',
      });

      syncMount();

      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
      expect(screen.queryByText('Warning')).not.toBeInTheDocument();
      expect(screen.queryByText('Continue')).not.toBeInTheDocument();
      expect(screen.getByText('Delete Permanently')).toBeInTheDocument();
      expect(screen.getByText('Remove this folder?')).toBeInTheDocument();
      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();

      expect(document.querySelector('.confirm-icon-danger')).not.toBeNull();
    });

    it('enters warning stage when detail is provided, then progresses to final on Continue', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();
      const onConfirm = vi.fn();

      act(() => {
        hook.result.current.confirm('Delete tenant?', onConfirm, 'All requests and workflows will be removed.');
      });

      expect(hook.result.current.confirmAction?.stage).toBe('warning');
      syncMount();

      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Delete tenant?')).toBeInTheDocument();
      expect(screen.getByText('All requests and workflows will be removed.')).toBeInTheDocument();

      expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete Permanently')).not.toBeInTheDocument();

      const continueBtn = screen.getByRole('button', { name: /continue/i });
      act(() => {
        continueBtn.click();
      });

      expect(hook.result.current.confirmAction?.stage).toBe('final');
      syncMount();

      expect(screen.queryByText('Warning')).not.toBeInTheDocument();
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
      expect(screen.getByText('Delete Permanently')).toBeInTheDocument();
    });

    it('does not downgrade to warning when explicit detail argument is omitted (final stage)', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const onConfirm = vi.fn();

      act(() => {
        result.current.confirm('Bare message', onConfirm);
      });

      expect(result.current.confirmAction?.detail).toBeUndefined();
      expect(result.current.confirmAction?.stage).toBe('final');
    });

    it('uses final stage when detail is an empty string (falsy)', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const onConfirm = vi.fn();

      act(() => {
        result.current.confirm('Empty detail', onConfirm, '');
      });

      expect(result.current.confirmAction?.detail).toBe('');
      expect(result.current.confirmAction?.stage).toBe('final');
    });
  });

  describe('confirmDialogElement rendering', () => {
    it('shows warning branch structure when stage is warning', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();

      act(() => {
        hook.result.current.confirm('-msg-', vi.fn(), '-detail-');
      });
      syncMount();

      expect(document.querySelector('.confirm-overlay')).not.toBeNull();
      expect(document.querySelector('.confirm-dialog')).not.toBeNull();
      expect(document.querySelector('.confirm-icon-warn')).not.toBeNull();

      expect(document.querySelector('.confirm-title')).toHaveTextContent('Warning');

      expect(document.querySelector('.confirm-detail')).toHaveTextContent('-detail-');
    });

    it('shows danger branch icon and titles on final stage', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();

      act(() => {
        hook.result.current.confirm('Remove item?', vi.fn());
      });
      syncMount();

      expect(document.querySelector('.confirm-icon-danger')).not.toBeNull();

      expect(document.querySelector('.confirm-title')).toHaveTextContent('Confirm Deletion');
      expect(document.querySelector('.confirm-final-note')).not.toBeNull();
      expect(document.querySelector('.confirm-final-note')).toHaveTextContent('This action cannot be undone.');
    });

    it('returns null-compatible element when cleared via setConfirmAction(null)', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();

      act(() => {
        hook.result.current.confirm('x', vi.fn());
      });
      syncMount();

      expect(document.querySelector('.confirm-message')).toHaveTextContent('x');

      act(() => {
        hook.result.current.setConfirmAction(null);
      });
      syncMount();

      expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
      expect(hook.result.current.confirmDialogElement).toBeFalsy();
    });

    it('allows opening dialog via setConfirmAction with custom stage wiring', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();
      const onConfirm = vi.fn();

      act(() => {
        hook.result.current.setConfirmAction({
          message: 'Forced message',
          onConfirm,
          detail: 'Custom',
          stage: 'warning',
        });
      });

      syncMount();
      expect(screen.getByText('Forced message')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();

      expect(document.querySelector('.confirm-icon-warn')).not.toBeNull();
    });
  });

  describe('onConfirm and Cancel', () => {
    it('invokes onConfirm once and clears dialog when confirming final stage without detail shortcut', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();
      const onConfirm = vi.fn();

      act(() => {
        hook.result.current.confirm('Direct finalize', onConfirm);
      });
      syncMount();

      expect(onConfirm).not.toHaveBeenCalled();

      act(() => {
        screen.getByRole('button', { name: /delete permanently/i }).click();
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(hook.result.current.confirmAction).toBeNull();
      syncMount();
      expect(hook.result.current.confirmDialogElement).toBeFalsy();
    });

    it('invokes onConfirm after warning → Continue → Delete permanently', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();
      const onConfirm = vi.fn();

      act(() => {
        hook.result.current.confirm('Two step', onConfirm, 'Extra context');
      });
      syncMount();

      act(() => {
        screen.getByRole('button', { name: /continue/i }).click();
      });
      syncMount();

      act(() => {
        screen.getByRole('button', { name: /delete permanently/i }).click();
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(hook.result.current.confirmAction).toBeNull();
    });

    it('closes without invoking onConfirm when Cancel is clicked on warning stage', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();
      const onConfirm = vi.fn();

      act(() => {
        hook.result.current.confirm('Abort?', onConfirm, 'detail line');
      });
      syncMount();

      act(() => {
        screen.getAllByRole('button', { name: /cancel/i })[0]!.click();
      });

      expect(onConfirm).not.toHaveBeenCalled();
      expect(hook.result.current.confirmAction).toBeNull();
      syncMount();
      expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    });

    it('closes without invoking onConfirm when Cancel is clicked on final stage', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();
      const onConfirm = vi.fn();

      act(() => {
        hook.result.current.confirm('Stop here', onConfirm);
      });
      syncMount();

      act(() => {
        screen.getByRole('button', { name: /cancel/i }).click();
      });

      expect(onConfirm).not.toHaveBeenCalled();
      expect(hook.result.current.confirmAction).toBeNull();
    });

    it('closes from final stage with Cancel after Continue without calling onConfirm', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();
      const onConfirm = vi.fn();

      act(() => {
        hook.result.current.confirm('Path', onConfirm, 'Detail');
      });
      syncMount();
      act(() => {
        screen.getByRole('button', { name: /continue/i }).click();
      });
      syncMount();

      act(() => {
        screen.getByRole('button', { name: /cancel/i }).click();
      });

      expect(onConfirm).not.toHaveBeenCalled();
      expect(hook.result.current.confirmAction).toBeNull();
    });
  });

  describe('Escape key behavior', () => {
    it('does not close the dialog on Escape — hook has no key listener (warning)', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();

      act(() => {
        hook.result.current.confirm('Pinned', vi.fn(), 'shown');
      });
      syncMount();

      const overlay = document.querySelector('.confirm-overlay');
      expect(overlay).not.toBeNull();

      overlay!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
      );

      syncMount();

      expect(hook.result.current.confirmAction).not.toBeNull();
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('does not dismiss on Escape for final-stage dialog opened without detail', () => {
      const { hook, syncMount } = renderConfirmDialogHarness();

      act(() => {
        hook.result.current.confirm('Final pinned', vi.fn());
      });
      syncMount();

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
      );

      syncMount();

      expect(hook.result.current.confirmAction).not.toBeNull();
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    });
  });
});
