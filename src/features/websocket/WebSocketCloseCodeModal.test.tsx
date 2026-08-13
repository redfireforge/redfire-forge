/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { WebSocketCloseCodeModal } from './WebSocketCloseCodeModal';

function renderModal(overrides?: Partial<ComponentProps<typeof WebSocketCloseCodeModal>>) {
  const props: ComponentProps<typeof WebSocketCloseCodeModal> = {
    open: true,
    closeCode: 1000,
    setCloseCode: vi.fn(),
    closeReason: '',
    setCloseReason: vi.fn(),
    reasonBytes: 0,
    isCodeValid: true,
    isReasonValid: true,
    canCloseWithCode: true,
    codeDescription: 'Normal closure',
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<WebSocketCloseCodeModal {...props} />);
  return props;
}

describe('WebSocketCloseCodeModal', () => {
  it('renders nothing when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByTestId('close-code-dropdown')).toBeNull();
  });

  it('shows valid code description and allows confirm when code/reason are valid', () => {
    renderModal({ isCodeValid: true, isReasonValid: true, canCloseWithCode: true, codeDescription: 'Normal closure' });
    expect(screen.getByText('Normal closure')).toBeTruthy();
    expect((screen.getByTestId('close-with-code-btn') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/0\/123 bytes/)).toBeTruthy();
  });

  it('shows invalid code error and disables confirm when code is invalid', () => {
    renderModal({ isCodeValid: false, canCloseWithCode: false, closeCode: 999, codeDescription: '' });
    expect(screen.getByText('Must be 1000–4999')).toBeTruthy();
    expect((screen.getByTestId('close-with-code-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks reason counter over-limit class when reason is invalid', () => {
    renderModal({ isReasonValid: false, reasonBytes: 150, closeReason: 'x'.repeat(120) });
    const counter = screen.getByText(/150\/123 bytes/);
    expect(counter.className.includes('is-over')).toBe(true);
  });

  it('wires input handlers for code, reason, cancel, and confirm', () => {
    const props = renderModal();

    fireEvent.change(screen.getByTestId('close-code-input'), { target: { value: '1001' } });
    expect(props.setCloseCode).toHaveBeenCalledWith(1001);

    fireEvent.change(screen.getByTestId('close-reason-input'), { target: { value: 'bye' } });
    expect(props.setCloseReason).toHaveBeenCalledWith('bye');

    fireEvent.click(screen.getByTestId('close-code-cancel'));
    expect(props.onCancel).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('close-with-code-btn'));
    expect(props.onConfirm).toHaveBeenCalled();
  });

  it('applies selected close-code preset on click', () => {
    const props = renderModal();
    const preset = screen.getByText('Normal');
    fireEvent.click(preset);
    expect(props.setCloseCode).toHaveBeenCalledWith(1000);
  });
});
