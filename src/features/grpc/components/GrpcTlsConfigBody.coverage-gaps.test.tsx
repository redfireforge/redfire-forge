/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcTlsConfigBody } from './GrpcTlsConfigBody';

const VALID_CERT = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
-----END CERTIFICATE-----`;

describe('GrpcTlsConfigBody coverage gaps', () => {
  const baseProps = {
    tlsMode: 'tls' as const,
    tlsConfig: undefined,
    issues: [] as Array<{ field: string; code: string; message: string }>,
    onTlsModeChange: vi.fn(),
    onTlsConfigChange: vi.fn(),
  };

  it('shows server CA field error when issue targets serverCaPem', () => {
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="tls"
        issues={[{ field: 'tlsConfig.serverCaPem', code: 'GRPC_INVALID_REQUEST', message: 'Bad CA PEM' }]}
      />,
    );
    expect(screen.getAllByText('Bad CA PEM').length).toBeGreaterThan(0);
  });

  it('omits test and reset actions when callbacks are not provided', () => {
    render(<GrpcTlsConfigBody {...baseProps} tlsMode="disabled" />);
    expect(screen.queryByTestId('grpc-tls-test')).toBeNull();
    expect(screen.queryByTestId('grpc-tls-reset')).toBeNull();
  });

  it('clears server CA PEM when textarea is emptied', () => {
    const onTlsConfigChange = vi.fn();
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="tls"
        tlsConfig={{ serverCaPem: VALID_CERT }}
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-tls-server-ca'), { target: { value: '' } });
    expect(onTlsConfigChange).toHaveBeenCalledWith({ serverCaPem: undefined });
  });

  it('does not invoke optional unmask/clear when callbacks are absent', () => {
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="tls"
        tlsConfig={{ serverCaPem: 'stored' }}
        maskedSecretFields={{ serverCaPem: true }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-tls-server-ca-clear'));
    fireEvent.change(screen.getByTestId('grpc-tls-server-ca'), { target: { value: 'x' } });
    expect(screen.getByTestId('grpc-tls-server-ca')).toBeTruthy();
  });

  it('renders mTLS fields, errors, and invokes secret callbacks', () => {
    const onTlsConfigChange = vi.fn();
    const onUnmaskSecretField = vi.fn();
    const onClearSecretField = vi.fn();
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="mtls"
        tlsConfig={{ clientCertPem: 'cert', clientKeyPem: 'key' }}
        issues={[
          { field: 'tlsConfig.clientCertPem', code: 'GRPC_INVALID_REQUEST', message: 'Bad cert' },
          { field: 'tlsConfig.clientKeyPem', code: 'GRPC_INVALID_REQUEST', message: 'Bad key' },
        ]}
        maskedSecretFields={{ clientCertPem: true, clientKeyPem: true }}
        onTlsConfigChange={onTlsConfigChange}
        onUnmaskSecretField={onUnmaskSecretField}
        onClearSecretField={onClearSecretField}
      />,
    );
    expect(screen.getAllByText('Bad cert').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bad key').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByTestId('grpc-tls-client-cert'), { target: { value: 'new-cert' } });
    expect(onTlsConfigChange).toHaveBeenCalledWith({ clientCertPem: 'new-cert' });
    fireEvent.click(screen.getByTestId('grpc-tls-client-key-clear'));
    expect(onClearSecretField).toHaveBeenCalledWith('clientKeyPem');
    fireEvent.change(screen.getByTestId('grpc-tls-client-key'), { target: { value: 'next' } });
    expect(onUnmaskSecretField).toHaveBeenCalledWith('clientKeyPem');
  });

  it('shows test result, issues list, and action buttons when callbacks provided', () => {
    const onTestConnection = vi.fn();
    const onResetDefaults = vi.fn();
    const onTlsModeChange = vi.fn();
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="tls"
        issues={[{ field: 'tlsConfig', code: 'GRPC_INVALID_REQUEST', message: 'TLS issue' }]}
        testResult="TLS configuration passed local validation."
        onTlsModeChange={onTlsModeChange}
        onTestConnection={onTestConnection}
        onResetDefaults={onResetDefaults}
      />,
    );
    expect(screen.getByTestId('grpc-tls-test-result').textContent).toMatch(/passed local validation/i);
    expect(screen.getByTestId('grpc-tls-issues').textContent).toMatch(/TLS issue/);
    fireEvent.click(screen.getByTestId('grpc-tls-test'));
    fireEvent.click(screen.getByTestId('grpc-tls-reset'));
    fireEvent.click(screen.getByTestId('grpc-tls-mode-mtls'));
    expect(onTestConnection).toHaveBeenCalled();
    expect(onResetDefaults).toHaveBeenCalled();
    expect(onTlsModeChange).toHaveBeenCalledWith('mtls');
  });

  it('updates server name override and respects disabled state', () => {
    const onTlsConfigChange = vi.fn();
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="tls"
        tlsConfig={{ serverNameOverride: 'old.local' }}
        disabled
        onTlsConfigChange={onTlsConfigChange}
        onTestConnection={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-tls-server-name'), { target: { value: 'new.local' } });
    expect(onTlsConfigChange).toHaveBeenCalledWith({ serverNameOverride: 'new.local' });
    expect((screen.getByTestId('grpc-tls-test') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-tls-mode-disabled') as HTMLButtonElement).disabled).toBe(true);
  });
});
