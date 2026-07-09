/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrpcTlsConfigBody } from './GrpcTlsConfigBody';

const VALID_CERT = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
-----END CERTIFICATE-----`;

const VALID_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC
-----END PRIVATE KEY-----`;

describe('GrpcTlsConfigBody (Phase 4J-C)', () => {
  const baseProps = {
    tlsMode: 'tls' as const,
    tlsConfig: undefined,
    issues: [] as Array<{ field: string; code: string; message: string }>,
    onTlsModeChange: vi.fn(),
    onTlsConfigChange: vi.fn(),
  };

  it('renders all TLS mode options and highlights active mode', () => {
    render(<GrpcTlsConfigBody {...baseProps} tlsMode="disabled" />);
    expect(screen.getByTestId('grpc-tls-mode-disabled')).toBeTruthy();
    expect(screen.getByTestId('grpc-tls-mode-tls')).toBeTruthy();
    expect(screen.getByTestId('grpc-tls-mode-mtls')).toBeTruthy();
    expect(screen.getByTestId('grpc-tls-mode-disabled').className).toContain('active');
    expect(screen.queryByTestId('grpc-tls-server-ca')).toBeNull();
  });

  it('hides mode picker cards when hideModePicker is set', () => {
    render(<GrpcTlsConfigBody {...baseProps} tlsMode="mtls" hideModePicker />);
    expect(screen.queryByTestId('grpc-tls-mode-mtls')).toBeNull();
    expect(screen.getByTestId('grpc-tls-server-ca')).toBeTruthy();
  });

  it('calls onTlsModeChange when a mode button is clicked', async () => {
    const user = userEvent.setup();
    const onTlsModeChange = vi.fn();
    render(
      <GrpcTlsConfigBody {...baseProps} tlsMode="disabled" onTlsModeChange={onTlsModeChange} />,
    );
    await user.click(screen.getByTestId('grpc-tls-mode-mtls'));
    expect(onTlsModeChange).toHaveBeenCalledWith('mtls');
  });

  it('shows TLS fields for tls mode and patches server CA and server name', async () => {
    const user = userEvent.setup();
    const onTlsConfigChange = vi.fn();
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="tls"
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    expect(screen.getByTestId('grpc-tls-server-ca')).toBeTruthy();
    expect(screen.queryByTestId('grpc-tls-client-cert')).toBeNull();

    await user.type(screen.getByTestId('grpc-tls-server-ca'), VALID_CERT);
    expect(onTlsConfigChange).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('grpc-tls-server-name'), {
      target: { value: 'grpc.example.com' },
    });
    expect(onTlsConfigChange).toHaveBeenCalledWith({ serverNameOverride: 'grpc.example.com' });
  });

  it('shows mTLS client cert and key fields with field-specific issues', () => {
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="mtls"
        tlsConfig={{ clientCertPem: 'bad', clientKeyPem: 'bad' }}
        issues={[
          { field: 'tlsConfig.clientCertPem', code: 'GRPC_INVALID_REQUEST', message: 'Invalid client cert' },
          { field: 'tlsConfig.clientKeyPem', code: 'GRPC_INVALID_REQUEST', message: 'Invalid client key' },
          { field: 'tlsConfig.serverCaPem', code: 'GRPC_INVALID_REQUEST', message: 'Invalid server CA' },
        ]}
      />,
    );
    expect(screen.getByTestId('grpc-tls-client-cert')).toBeTruthy();
    expect(screen.getByTestId('grpc-tls-client-key')).toBeTruthy();
    const fieldErrors = document.querySelectorAll('.grpc-tls-field-error');
    expect(fieldErrors.length).toBe(3);
    expect(Array.from(fieldErrors).map((el) => el.textContent)).toEqual([
      'Invalid server CA',
      'Invalid client cert',
      'Invalid client key',
    ]);
    expect(screen.getByTestId('grpc-tls-issues').textContent).toMatch(/Invalid client cert/);
  });

  it('patches mTLS cert and key via onTlsConfigChange', async () => {
    const user = userEvent.setup();
    const onTlsConfigChange = vi.fn();
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="mtls"
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    await user.type(screen.getByTestId('grpc-tls-client-cert'), VALID_CERT);
    await user.type(screen.getByTestId('grpc-tls-client-key'), VALID_KEY);
    expect(onTlsConfigChange).toHaveBeenCalled();
  });

  it('shows masked secret hints and invokes unmask/clear callbacks', async () => {
    const user = userEvent.setup();
    const onUnmaskSecretField = vi.fn();
    const onClearSecretField = vi.fn();
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="mtls"
        tlsConfig={{ serverCaPem: 'stored', clientCertPem: 'stored', clientKeyPem: 'stored' }}
        maskedSecretFields={{
          serverCaPem: true,
          clientCertPem: true,
          clientKeyPem: true,
        }}
        onUnmaskSecretField={onUnmaskSecretField}
        onClearSecretField={onClearSecretField}
      />,
    );
    expect(screen.getByTestId('grpc-tls-server-ca-stored-hint')).toBeTruthy();
    expect(screen.getByTestId('grpc-tls-client-cert-stored-hint')).toBeTruthy();
    expect(screen.getByTestId('grpc-tls-client-key-stored-hint')).toBeTruthy();

    await user.click(screen.getByTestId('grpc-tls-server-ca-clear'));
    expect(onClearSecretField).toHaveBeenCalledWith('serverCaPem');

    await user.type(screen.getByTestId('grpc-tls-server-ca'), 'x');
    expect(onUnmaskSecretField).toHaveBeenCalledWith('serverCaPem');
  });

  it('lists general validation issues and shows test result', () => {
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="disabled"
        issues={[
          { field: 'tlsConfig', code: 'GRPC_INVALID_REQUEST', message: 'TLS configuration requires tls or mtls mode' },
        ]}
        testResult={{ ok: true, message: 'TLS validation passed locally' }}
      />,
    );
    expect(screen.getByTestId('grpc-tls-issues').textContent).toMatch(/requires tls or mtls/i);
    expect(screen.getByTestId('grpc-tls-test-result').className).toMatch(/grpc-tls-test-result--ok/);
    expect(screen.getByTestId('grpc-tls-test-result').textContent).toMatch(/passed locally/i);
  });

  it('renders test and reset actions and invokes callbacks', async () => {
    const user = userEvent.setup();
    const onTestConnection = vi.fn();
    const onResetDefaults = vi.fn();
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        onTestConnection={onTestConnection}
        onResetDefaults={onResetDefaults}
      />,
    );
    await user.click(screen.getByTestId('grpc-tls-test'));
    await user.click(screen.getByTestId('grpc-tls-reset'));
    expect(onTestConnection).toHaveBeenCalled();
    expect(onResetDefaults).toHaveBeenCalled();
  });

  it('disables mode buttons, fields, and actions when disabled', () => {
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="mtls"
        disabled
        onTestConnection={vi.fn()}
        onResetDefaults={vi.fn()}
      />,
    );
    expect((screen.getByTestId('grpc-tls-mode-tls') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-tls-server-ca') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-tls-client-cert') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-tls-server-name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-tls-test') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-tls-reset') as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears optional fields when emptied', () => {
    const onTlsConfigChange = vi.fn();
    render(
      <GrpcTlsConfigBody
        {...baseProps}
        tlsMode="tls"
        tlsConfig={{ serverNameOverride: 'host.local' }}
        onTlsConfigChange={onTlsConfigChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-tls-server-name'), { target: { value: '' } });
    expect(onTlsConfigChange).toHaveBeenCalledWith({ serverNameOverride: undefined });
  });
});
