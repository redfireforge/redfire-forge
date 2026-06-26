/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GraphqlTlsPanel } from './GraphqlTlsPanel';

const platformMocks = vi.hoisted(() => ({ isTauri: false }));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => platformMocks.isTauri,
}));

function openModal() {
  fireEvent.click(screen.getByTestId('gql-tls-configure'));
}

describe('GraphqlTlsPanel', () => {
  beforeEach(() => {
    platformMocks.isTauri = false;
  });

  it('opens modal and emits CA cert changes', () => {
    const onTlsChange = vi.fn();
    render(
      <GraphqlTlsPanel
        skipTlsVerify={false}
        onTlsChange={onTlsChange}
      />,
    );
    openModal();
    expect(screen.getByTestId('gql-tls-body')).toBeTruthy();
    fireEvent.change(screen.getByTestId('gql-tls-ca-cert'), { target: { value: 'pem-data' } });
    expect(onTlsChange).toHaveBeenCalledWith({ caCert: 'pem-data' });
  });

  it('shows mTLS badge when client cert is set', () => {
    render(
      <GraphqlTlsPanel
        skipTlsVerify={false}
        clientCert="-----BEGIN CERTIFICATE-----"
        clientKey="-----BEGIN PRIVATE KEY-----"
        onTlsChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-tls-indicator').textContent).toBe('mTLS');
  });

  it('shows Skip Verify badge when skipTlsVerify is true', () => {
    render(
      <GraphqlTlsPanel skipTlsVerify onTlsChange={vi.fn()} />,
    );
    expect(screen.getByTestId('gql-tls-indicator').textContent).toBe('Skip Verify');
  });

  it('shows Custom CA badge when CA cert is set without mTLS', () => {
    render(
      <GraphqlTlsPanel
        skipTlsVerify={false}
        caCert="-----BEGIN CERTIFICATE-----"
        onTlsChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-tls-indicator').textContent).toBe('Custom CA');
  });

  it('shows Skip Verify badge when skip-cert is on even if CA cert is pasted', () => {
    render(
      <GraphqlTlsPanel
        skipTlsVerify
        caCert="-----BEGIN CERTIFICATE-----"
        onTlsChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-tls-indicator').textContent).toBe('Skip Verify');
  });

  it('marks configure button active when TLS content is configured', () => {
    render(
      <GraphqlTlsPanel skipTlsVerify={false} onTlsChange={vi.fn()} />,
    );
    expect(screen.getByTestId('gql-tls-configure')).not.toHaveClass('gql-tls-configure-btn--active');
    render(
      <GraphqlTlsPanel skipTlsVerify caCert="pem" onTlsChange={vi.fn()} />,
    );
    expect(screen.getAllByTestId('gql-tls-configure')[1]).toHaveClass('gql-tls-configure-btn--active');
  });

  it('disables configure button when disabled prop is true', () => {
    render(
      <GraphqlTlsPanel skipTlsVerify={false} disabled onTlsChange={vi.fn()} />,
    );
    expect(screen.getByTestId('gql-tls-configure')).toBeDisabled();
  });

  it('cancel restores snapshot taken at open', () => {
    const onTlsChange = vi.fn();
    const { rerender } = render(
      <GraphqlTlsPanel
        skipTlsVerify={false}
        caCert="original-ca"
        onTlsChange={onTlsChange}
      />,
    );
    openModal();
    fireEvent.change(screen.getByTestId('gql-tls-ca-cert'), { target: { value: 'edited-ca' } });
    onTlsChange.mockClear();
    rerender(
      <GraphqlTlsPanel
        skipTlsVerify={false}
        caCert="edited-ca"
        onTlsChange={onTlsChange}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-tls-cancel'));
    expect(onTlsChange).toHaveBeenCalledWith({
      skipTlsVerify: false,
      caCert: 'original-ca',
      clientCert: undefined,
      clientKey: undefined,
    });
    expect(screen.queryByTestId('gql-tls-body')).toBeNull();
  });

  it('save closes modal and keeps current values', () => {
    const onTlsChange = vi.fn();
    render(
      <GraphqlTlsPanel skipTlsVerify={false} onTlsChange={onTlsChange} />,
    );
    openModal();
    const saveBtn = screen.getByTestId('gql-tls-save');
    expect(saveBtn).toBeDisabled();
    fireEvent.click(screen.getByTestId('gql-tls-skip-cert').querySelector('input')!);
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    expect(screen.queryByTestId('gql-tls-body')).toBeNull();
  });

  it('close without dirty changes closes modal without reverting', () => {
    const onTlsChange = vi.fn();
    render(
      <GraphqlTlsPanel skipTlsVerify={false} caCert="keep-me" onTlsChange={onTlsChange} />,
    );
    openModal();
    onTlsChange.mockClear();
    fireEvent.click(screen.getByTestId('gql-tls-close'));
    expect(onTlsChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('gql-tls-body')).toBeNull();
  });

  it('handleClose via overlay click closes modal without reverting', () => {
    const onTlsChange = vi.fn();
    render(
      <GraphqlTlsPanel skipTlsVerify={false} onTlsChange={onTlsChange} />,
    );
    openModal();
    onTlsChange.mockClear();
    fireEvent.click(document.querySelector('.ws-tls-overlay')!);
    expect(onTlsChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('gql-tls-body')).toBeNull();
  });

  it('emits client key changes', () => {
    const onTlsChange = vi.fn();
    render(
      <GraphqlTlsPanel skipTlsVerify={false} onTlsChange={onTlsChange} />,
    );
    openModal();
    fireEvent.change(screen.getByTestId('gql-tls-client-key'), { target: { value: 'key-pem' } });
    expect(onTlsChange).toHaveBeenCalledWith({ clientKey: 'key-pem' });
  });

  it('emits client cert changes and clears empty CA to undefined', () => {
    const onTlsChange = vi.fn();
    render(
      <GraphqlTlsPanel skipTlsVerify={false} caCert="old" onTlsChange={onTlsChange} />,
    );
    openModal();
    fireEvent.change(screen.getByTestId('gql-tls-ca-cert'), { target: { value: '' } });
    expect(onTlsChange).toHaveBeenCalledWith({ caCert: undefined });
    fireEvent.change(screen.getByTestId('gql-tls-client-cert'), { target: { value: 'cert-pem' } });
    expect(onTlsChange).toHaveBeenCalledWith({ clientCert: 'cert-pem' });
  });

  it('shows mTLS badge when only client key is set', () => {
    render(
      <GraphqlTlsPanel skipTlsVerify={false} clientKey="-----BEGIN PRIVATE KEY-----" onTlsChange={vi.fn()} />,
    );
    expect(screen.getByTestId('gql-tls-indicator').textContent).toBe('mTLS');
  });

  it('shows web proxy notice when not on Tauri', () => {
    platformMocks.isTauri = false;
    render(<GraphqlTlsPanel skipTlsVerify={false} onTlsChange={vi.fn()} />);
    openModal();
    expect(screen.getByTestId('gql-tls-proxy-notice')).toBeTruthy();
  });

  it('shows native rustls notice on Tauri', () => {
    platformMocks.isTauri = true;
    render(<GraphqlTlsPanel skipTlsVerify={false} onTlsChange={vi.fn()} />);
    openModal();
    expect(screen.getByTestId('gql-tls-proxy-notice').textContent).toContain('rustls');
  });

  it('shows warning badge inside modal when skipTlsVerify is enabled', () => {
    render(<GraphqlTlsPanel skipTlsVerify onTlsChange={vi.fn()} />);
    openModal();
    expect(screen.getByLabelText('Warning: insecure')).toBeTruthy();
  });

  it('shows Set badges for populated PEM fields in the modal', () => {
    render(
      <GraphqlTlsPanel
        skipTlsVerify={false}
        caCert="ca-pem"
        clientCert="cert-pem"
        clientKey="key-pem"
        onTlsChange={vi.fn()}
      />,
    );
    openModal();
    expect(screen.getAllByText('Set')).toHaveLength(3);
  });

  it('disables modal inputs when disabled prop is true', () => {
    const onTlsChange = vi.fn();
    const { rerender } = render(
      <GraphqlTlsPanel skipTlsVerify={false} onTlsChange={onTlsChange} />,
    );
    openModal();
    rerender(<GraphqlTlsPanel skipTlsVerify={false} disabled onTlsChange={onTlsChange} />);
    expect(screen.getByTestId('gql-tls-skip-cert').querySelector('input')).toBeDisabled();
    expect(screen.getByTestId('gql-tls-ca-cert')).toBeDisabled();
    expect(screen.getByTestId('gql-tls-client-cert')).toBeDisabled();
    expect(screen.getByTestId('gql-tls-client-key')).toBeDisabled();
  });

  it('clears client key to undefined when textarea is emptied', () => {
    const onTlsChange = vi.fn();
    render(
      <GraphqlTlsPanel skipTlsVerify={false} clientKey="key-pem" onTlsChange={onTlsChange} />,
    );
    openModal();
    fireEvent.change(screen.getByTestId('gql-tls-client-key'), { target: { value: '' } });
    expect(onTlsChange).toHaveBeenCalledWith({ clientKey: undefined });
  });

  it('does not show mode badge when TLS settings are empty', () => {
    render(<GraphqlTlsPanel skipTlsVerify={false} onTlsChange={vi.fn()} />);
    expect(screen.queryByTestId('gql-tls-indicator')).toBeNull();
  });
});
