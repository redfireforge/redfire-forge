/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockServerSettingsModal } from './ApiMockServerSettingsModal';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';

const generateClientCredentials = vi.fn();
vi.mock('../apiMockControlClient', () => ({
  apiMockControlClient: {
    generateClientCredentials: (cn: string) => generateClientCredentials(cn),
    generateSelfSignedTls: vi.fn(),
  },
}));

const ts = '2026-08-12T00:00:00.000Z';
const CA = '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----';
const CLIENT_CERT = '-----BEGIN CERTIFICATE-----\nCLIENT\n-----END CERTIFICATE-----';
const CLIENT_KEY = '-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----';

function makeServer(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1', name: 'Users API', enabled: true, host: '127.0.0.1', port: 4600,
    basePath: '', folders: [], routes: [], samples: [], variables: [],
    settings: {
      ...DEFAULT_SETTINGS,
      tls: {
        enabled: true,
        certPem: '-----BEGIN CERTIFICATE-----\nSRV\n-----END CERTIFICATE-----',
        keyPem: '-----BEGIN PRIVATE KEY-----\nSRV\n-----END PRIVATE KEY-----',
      },
    },
    createdAt: ts, updatedAt: ts,
  };
}

function openTlsPanel(onSave = vi.fn()) {
  render(<ApiMockServerSettingsModal server={makeServer()} onSave={onSave} onClose={vi.fn()} />);
  fireEvent.click(screen.getByText('TLS'));
  return onSave;
}

describe('ApiMockServerSettingsModal — client certificates (mTLS)', () => {
  beforeEach(() => generateClientCredentials.mockReset());

  it('issues client credentials and enables mTLS', async () => {
    generateClientCredentials.mockResolvedValue({
      ok: true,
      data: { caCertPem: CA, clientCertPem: CLIENT_CERT, clientKeyPem: CLIENT_KEY, commonName: 'acme' },
    });
    openTlsPanel();

    fireEvent.change(screen.getByTestId('api-mock-settings-mtls-cn'), { target: { value: 'acme' } });
    fireEvent.click(screen.getByTestId('api-mock-settings-mtls-generate'));

    await waitFor(() => expect(screen.getByTestId('api-mock-settings-mtls-issued')).toBeTruthy());
    expect(generateClientCredentials).toHaveBeenCalledWith('acme');
    expect(screen.getByTestId('api-mock-settings-mtls-enabled')).toHaveAttribute('aria-checked', 'true');
  });

  it('persists the CA and issued pair on save', async () => {
    generateClientCredentials.mockResolvedValue({
      ok: true,
      data: { caCertPem: CA, clientCertPem: CLIENT_CERT, clientKeyPem: CLIENT_KEY, commonName: 'acme' },
    });
    const onSave = openTlsPanel();

    fireEvent.click(screen.getByTestId('api-mock-settings-mtls-generate'));
    await waitFor(() => expect(screen.getByTestId('api-mock-settings-mtls-issued')).toBeTruthy());
    fireEvent.click(screen.getByTestId('api-mock-settings-save'));

    const mtls = onSave.mock.calls.at(-1)?.[0].settings.tls.mtls;
    expect(mtls).toMatchObject({
      enabled: true, clientCaPem: CA, clientCertPem: CLIENT_CERT, clientKeyPem: CLIENT_KEY, clientCommonName: 'acme',
    });
  });

  it('surfaces generation failures', async () => {
    generateClientCredentials.mockResolvedValue({ ok: false, error: { message: 'openssl missing' } });
    openTlsPanel();

    fireEvent.click(screen.getByTestId('api-mock-settings-mtls-generate'));
    await waitFor(() => expect(screen.getByTestId('api-mock-settings-tls-error')).toHaveTextContent('openssl missing'));
    expect(screen.queryByTestId('api-mock-settings-mtls-issued')).toBeNull();
  });

  it('offers downloads only after credentials exist', async () => {
    openTlsPanel();
    expect(screen.queryByTestId('api-mock-settings-mtls-download-cert')).toBeNull();

    generateClientCredentials.mockResolvedValue({
      ok: true,
      data: { caCertPem: CA, clientCertPem: CLIENT_CERT, clientKeyPem: CLIENT_KEY, commonName: 'acme' },
    });
    fireEvent.click(screen.getByTestId('api-mock-settings-mtls-generate'));
    await waitFor(() => expect(screen.getByTestId('api-mock-settings-mtls-issued')).toBeTruthy());

    const createObjectURL = vi.fn(() => 'blob:pem');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByTestId('api-mock-settings-mtls-download-cert'));
    fireEvent.click(screen.getByTestId('api-mock-settings-mtls-download-key'));
    fireEvent.click(screen.getByTestId('api-mock-settings-mtls-download-ca'));
    expect(click).toHaveBeenCalledTimes(3);

    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('turns the client-cert requirement off when HTTPS is disabled', async () => {
    generateClientCredentials.mockResolvedValue({
      ok: true,
      data: { caCertPem: CA, clientCertPem: CLIENT_CERT, clientKeyPem: CLIENT_KEY, commonName: 'acme' },
    });
    const onSave = openTlsPanel();

    fireEvent.click(screen.getByTestId('api-mock-settings-mtls-generate'));
    await waitFor(() =>
      expect(screen.getByTestId('api-mock-settings-mtls-enabled')).toHaveAttribute('aria-checked', 'true'));

    fireEvent.click(screen.getByTestId('api-mock-settings-tls-enabled'));
    expect(screen.getByTestId('api-mock-settings-tls-enabled')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('api-mock-settings-mtls-enabled')).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByTestId('api-mock-settings-save'));
    const tls = onSave.mock.calls.at(-1)?.[0].settings.tls;
    expect(tls.enabled).toBe(false);
    expect(tls.mtls.enabled).toBe(false);
    // The issued material is kept so re-enabling HTTPS does not lose it.
    expect(tls.mtls.clientCaPem).toBe(CA);
  });

  it('does not silently re-enable mTLS when HTTPS is switched back on', () => {
    openTlsPanel();
    fireEvent.click(screen.getByTestId('api-mock-settings-tls-enabled'));
    fireEvent.click(screen.getByTestId('api-mock-settings-tls-enabled'));

    expect(screen.getByTestId('api-mock-settings-tls-enabled')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('api-mock-settings-mtls-enabled')).toHaveAttribute('aria-checked', 'false');
  });
});
