/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TlsConfigModal, type TlsValues } from './TlsConfigModal';

const defaultValues: TlsValues = {
  rejectUnauthorized: true,
  caCert: '',
  clientCert: '',
  clientKey: '',
};

function renderModal(overrides: Partial<Parameters<typeof TlsConfigModal>[0]> = {}) {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const onClose = vi.fn();
  render(
    <TlsConfigModal
      open
      values={defaultValues}
      onChange={onChange}
      onSave={onSave}
      onCancel={onCancel}
      onClose={onClose}
      dirty
      {...overrides}
    />,
  );
  return { onChange, onSave, onCancel, onClose };
}

describe('TlsConfigModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <TlsConfigModal
        open={false}
        values={defaultValues}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClose={vi.fn()}
        dirty={false}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders default body with test id prefix', () => {
    renderModal({ testIdPrefix: 'tls' });
    expect(screen.getByTestId('tls-body')).toBeInTheDocument();
    expect(screen.getByTestId('tls-save')).toBeEnabled();
  });

  it('uses bodySlot without default body test id', () => {
    renderModal({
      bodySlot: <div data-testid="custom-tls-body">custom</div>,
      testIdPrefix: 'grpc-tls',
    });
    expect(screen.getByTestId('custom-tls-body')).toBeInTheDocument();
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
  });

  it('invokes optional footer actions', () => {
    const onTestConnection = vi.fn();
    const onResetDefaults = vi.fn();
    renderModal({ onTestConnection, onResetDefaults, testIdPrefix: 'grpc-tls' });

    fireEvent.click(screen.getByTestId('grpc-tls-test'));
    fireEvent.click(screen.getByTestId('grpc-tls-reset'));

    expect(onTestConnection).toHaveBeenCalledTimes(1);
    expect(onResetDefaults).toHaveBeenCalledTimes(1);
  });

  it('wires save, cancel, and close actions', () => {
    const { onSave, onCancel, onClose } = renderModal({ dirty: true });

    fireEvent.click(screen.getByTestId('tls-cancel'));
    fireEvent.click(screen.getByTestId('tls-close'));
    fireEvent.click(screen.getByTestId('tls-save'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('disables save when not dirty', () => {
    renderModal({ dirty: false });
    expect(screen.getByTestId('tls-save')).toBeDisabled();
  });

  it('renders resize handles and gRPC size class', () => {
    renderModal({
      testIdPrefix: 'grpc-tls',
      bodySlot: <div data-testid="grpc-tls-slot">body</div>,
    });
    // Portal-rendered into document.body
    const dialog = document.querySelector('.ws-tls-modal.grpc-tls-config-modal');
    expect(dialog).toBeTruthy();
    expect(document.querySelector('.modal-resize-edge-right')).toBeTruthy();
    expect(document.querySelector('.modal-resize-corner')).toBeTruthy();
    expect(document.querySelector('.modal-resize-edge-bottom')).toBeTruthy();
  });
});
