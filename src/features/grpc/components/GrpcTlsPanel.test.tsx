/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps, ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrpcTlsPanel } from './GrpcTlsPanel';

type PanelProps = ComponentProps<typeof GrpcTlsPanel>;

function openTlsModal(props: PanelProps) {
  const { rerender } = render(<GrpcTlsPanel {...props} openRequest={0} />);
  rerender(<GrpcTlsPanel {...props} openRequest={1} />);
  return { rerender: (next: PanelProps) => rerender(<GrpcTlsPanel {...next} openRequest={1} />) };
}

function rerenderOpenTlsModal(
  rerender: (ui: ReactElement) => void,
  props: PanelProps,
  openRequest = 1,
) {
  rerender(<GrpcTlsPanel {...props} openRequest={openRequest} />);
}

describe('GrpcTlsPanel (Phase 4J-B modal)', () => {
  const defaultProps: PanelProps = {
    tlsMode: 'tls',
    issues: [],
    onTlsModeChange: vi.fn(),
    onTlsConfigChange: vi.fn(),
  };

  it('opens modal when openRequest increments', () => {
    const { rerender } = render(<GrpcTlsPanel {...defaultProps} openRequest={0} />);
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
    rerender(<GrpcTlsPanel {...defaultProps} openRequest={1} />);
    expect(screen.getByTestId('grpc-tls-body')).toBeTruthy();
    expect(screen.getByTestId('grpc-tls-mode-tls')).toBeTruthy();
  });

  it('calls onTlsModeChange when mode is selected in modal', async () => {
    const user = userEvent.setup();
    const onTlsModeChange = vi.fn();
    openTlsModal({
      ...defaultProps,
      tlsMode: 'disabled',
      onTlsModeChange,
    });
    await user.click(screen.getByTestId('grpc-tls-mode-mtls'));
    expect(onTlsModeChange).toHaveBeenCalledWith('mtls');
  });

  it('lists validation issues in modal', () => {
    openTlsModal({
      ...defaultProps,
      tlsMode: 'disabled',
      tlsConfig: { serverCaPem: 'bad' },
      issues: [{ field: 'tlsConfig', code: 'GRPC_INVALID_REQUEST', message: 'TLS configuration requires tls or mtls mode' }],
    });
    expect(screen.getByTestId('grpc-tls-issues').textContent).toMatch(/requires tls or mtls/i);
  });

  it('shows masked secret stored hint and clear action in modal', () => {
    openTlsModal({
      ...defaultProps,
      tlsConfig: { serverCaPem: 'stored-pem' },
      maskedSecretFields: { serverCaPem: true },
      onUnmaskSecretField: vi.fn(),
      onClearSecretField: vi.fn(),
    });
    expect(screen.getByTestId('grpc-tls-server-ca-stored-hint')).toBeTruthy();
    expect(screen.getByTestId('grpc-tls-server-ca-clear')).toBeTruthy();
  });

  it('cancel restores snapshot via onTlsStateRestore', () => {
    const onTlsStateRestore = vi.fn();
    const { rerender } = render(
      <GrpcTlsPanel {...defaultProps} tlsMode="disabled" openRequest={0} onTlsStateRestore={onTlsStateRestore} />,
    );
    rerender(
      <GrpcTlsPanel {...defaultProps} tlsMode="disabled" openRequest={1} onTlsStateRestore={onTlsStateRestore} />,
    );
    fireEvent.click(screen.getByTestId('grpc-tls-mode-tls'));
    rerenderOpenTlsModal(rerender, {
      ...defaultProps,
      tlsMode: 'tls',
      onTlsStateRestore,
    });
    fireEvent.click(screen.getByTestId('grpc-tls-cancel'));
    expect(onTlsStateRestore).toHaveBeenCalledWith({
      tlsMode: 'disabled',
      tlsConfig: undefined,
    });
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
  });

  it('save closes modal and keeps current values', () => {
    openTlsModal({ ...defaultProps });
    const saveBtn = screen.getByTestId('grpc-tls-save') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('grpc-tls-mode-mtls'));
    expect(saveBtn.disabled).toBe(false);
    fireEvent.click(saveBtn);
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
  });

  it('test TLS connection shows local validation result', () => {
    openTlsModal({
      ...defaultProps,
      tlsMode: 'mtls',
      tlsConfig: {},
    });
    fireEvent.click(screen.getByTestId('grpc-tls-test'));
    expect(screen.getByTestId('grpc-tls-test-result').textContent).toMatch(/clientCertPem/i);
  });

  it('reset to defaults sets plaintext mode', () => {
    const onTlsModeChange = vi.fn();
    openTlsModal({
      ...defaultProps,
      tlsMode: 'mtls',
      onTlsModeChange,
    });
    fireEvent.click(screen.getByTestId('grpc-tls-reset'));
    expect(onTlsModeChange).toHaveBeenCalledWith('disabled');
  });

  it('does not re-snapshot when openRequest increments while modal is already open', () => {
    const onTlsStateRestore = vi.fn();
    const { rerender } = render(
      <GrpcTlsPanel {...defaultProps} tlsMode="disabled" openRequest={0} onTlsStateRestore={onTlsStateRestore} />,
    );
    rerender(
      <GrpcTlsPanel {...defaultProps} tlsMode="disabled" openRequest={1} onTlsStateRestore={onTlsStateRestore} />,
    );
    fireEvent.click(screen.getByTestId('grpc-tls-mode-tls'));
    rerender(
      <GrpcTlsPanel {...defaultProps} tlsMode="tls" openRequest={2} onTlsStateRestore={onTlsStateRestore} />,
    );
    fireEvent.click(screen.getByTestId('grpc-tls-cancel'));
    expect(onTlsStateRestore).toHaveBeenCalledWith({
      tlsMode: 'disabled',
      tlsConfig: undefined,
    });
  });

  it('does not auto-open when remounted with stale openRequest counter (tab switch)', () => {
    render(<GrpcTlsPanel {...defaultProps} openRequest={3} />);
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
  });

  it('close without cancel keeps live edits', () => {
    const onTlsModeChange = vi.fn();
    const { rerender } = render(
      <GrpcTlsPanel {...defaultProps} tlsMode="disabled" openRequest={0} onTlsModeChange={onTlsModeChange} />,
    );
    rerender(
      <GrpcTlsPanel {...defaultProps} tlsMode="disabled" openRequest={1} onTlsModeChange={onTlsModeChange} />,
    );
    fireEvent.click(screen.getByTestId('grpc-tls-mode-tls'));
    rerenderOpenTlsModal(rerender, {
      ...defaultProps,
      tlsMode: 'tls',
      onTlsModeChange,
    });
    fireEvent.click(screen.getByTestId('grpc-tls-close'));
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
    expect(onTlsModeChange).toHaveBeenCalledWith('tls');
  });

  it('overlay click closes modal without revert (GQL parity)', () => {
    const onTlsStateRestore = vi.fn();
    openTlsModal({
      ...defaultProps,
      tlsMode: 'disabled',
      onTlsStateRestore,
    });
    fireEvent.click(screen.getByTestId('grpc-tls-mode-tls'));
    fireEvent.click(document.querySelector('.ws-tls-overlay')!);
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
    expect(onTlsStateRestore).not.toHaveBeenCalled();
  });

  it('closeRequest dismisses modal without revert (Phase 4J-C)', () => {
    const onTlsStateRestore = vi.fn();
    const { rerender } = render(
      <GrpcTlsPanel {...defaultProps} tlsMode="disabled" openRequest={0} closeRequest={0} onTlsStateRestore={onTlsStateRestore} />,
    );
    rerender(
      <GrpcTlsPanel {...defaultProps} tlsMode="disabled" openRequest={1} closeRequest={0} onTlsStateRestore={onTlsStateRestore} />,
    );
    expect(screen.getByTestId('grpc-tls-body')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-tls-mode-tls'));
    rerender(
      <GrpcTlsPanel {...defaultProps} tlsMode="tls" openRequest={1} closeRequest={1} onTlsStateRestore={onTlsStateRestore} />,
    );
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
    expect(onTlsStateRestore).not.toHaveBeenCalled();
  });
});
