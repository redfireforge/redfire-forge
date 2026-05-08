/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfirmModal from './ConfirmModal';

vi.mock('./PopupModal', () => ({
  default: function MockPopupModal({
    title,
    onClose,
    footer,
    children,
  }: {
    title: ReactNode;
    onClose: () => void;
    footer: ReactNode;
    children: ReactNode;
  }) {
    return (
      <div data-testid="popup-mock">
        <div data-testid="popup-title">{title}</div>
        <button type="button" data-testid="popup-backdrop-close" onClick={onClose}>
          overlay-close
        </button>
        <div data-testid="popup-footer">{footer}</div>
        <div data-testid="popup-body">{children}</div>
      </div>
    );
  },
}));

describe('ConfirmModal', () => {
  it('uses default title, labels, and default variant (primary confirm button)', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmModal message="Proceed?" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(screen.getByTestId('popup-title').textContent).toBe('Confirm');
    expect(screen.getByText('Proceed?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('OK'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    const primary = screen.getByText('OK').closest('button');
    expect(primary?.className).toContain('btn-primary');
    expect(primary?.className).not.toContain('btn-danger');
  });

  it('applies danger variant to confirm button', () => {
    render(
      <ConfirmModal
        message="Delete?"
        variant="danger"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dangerBtn = screen.getByText('OK').closest('button');
    expect(dangerBtn?.className).toContain('btn-danger');
  });

  it('passes custom title, confirm label, and cancel label', () => {
    render(
      <ConfirmModal
        title="Custom title"
        message="Body"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('popup-title').textContent).toBe('Custom title');
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('wires PopupModal onClose to onCancel', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal message="x" onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByTestId('popup-backdrop-close'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
