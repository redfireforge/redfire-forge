/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockServerSettingsModal } from './ApiMockServerSettingsModal';
import { DEFAULT_SETTINGS, HARD_CEILINGS } from '../../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';

const generateSelfSignedTls = vi.fn();
vi.mock('../apiMockControlClient', () => ({
  apiMockControlClient: {
    generateSelfSignedTls: (...args: unknown[]) => generateSelfSignedTls(...args),
    generateClientCredentials: vi.fn(),
  },
}));

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(overrides: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Mock Server 1',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: {
      ...DEFAULT_SETTINGS,
      fallback: {
        ...DEFAULT_SETTINGS.fallback,
        unmatchedResponse: {
          ...DEFAULT_SETTINGS.fallback.unmatchedResponse,
          contentType: undefined,
        },
      },
      proxy: {
        ...DEFAULT_SETTINGS.proxy!,
        enabled: true,
        allowlist: ['https://api.example.com'],
        forwardAuth: true,
        recordAsDrafts: true,
        timeoutMs: 5000,
      },
      callbacks: {
        ...DEFAULT_SETTINGS.callbacks!,
        allowlist: ['https://hooks.example.com/a'],
      },
    },
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function selectOption(testId: string, value: string) {
  const select = screen.getByTestId(testId);
  fireEvent.click(select.querySelector('.cs-trigger') as HTMLElement);
  fireEvent.click(document.querySelector(`[role="option"][data-value="${value}"]`) as HTMLElement);
}

describe('ApiMockServerSettingsModal coverage gaps', () => {
  beforeEach(() => {
    generateSelfSignedTls.mockReset();
  });

  it('updates policy selects, applies Running status styling, and saves selected policies', () => {
    const onSave = vi.fn();
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={onSave} onClose={vi.fn()} statusLabel="Running" />);

    expect(screen.getByText('Running').className).toContain('running');

    fireEvent.click(screen.getByTestId('api-mock-settings-tab-selection'));
    selectOption('api-mock-settings-multiple-match', 'reject_multiple');
    selectOption('api-mock-settings-equal-priority', 'specificity_then_id');
    selectOption('api-mock-settings-fallback-mode', 'closest_match_debug');

    expect(screen.getByText('application/json')).toBeTruthy();

    fireEvent.change(screen.getByTestId('api-mock-settings-ambiguity-body'), {
      target: { value: '{"error":"catalog_ambiguous","competingRules":{{competingRuleCount}}}' },
    });

    fireEvent.click(screen.getByTestId('api-mock-settings-save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        selection: expect.objectContaining({
          multipleMatchPolicy: 'reject_multiple',
          equalPriorityPolicy: 'specificity_then_id',
          ambiguityResponse: expect.objectContaining({
            body: '{"error":"catalog_ambiguous","competingRules":{{competingRuleCount}}}',
          }),
        }),
        fallback: expect.objectContaining({ mode: 'closest_match_debug' }),
      }),
    }));
  });

  it('shows non-running status and normalizes listen URL preview', () => {
    render(
      <ApiMockServerSettingsModal
        server={makeServer({ basePath: 'api/v1', port: 4700 })}
        onSave={vi.fn()}
        onClose={vi.fn()}
        statusLabel="Stopped"
      />,
    );

    expect(screen.getByTestId('am-stg-status')).not.toHaveClass('running');
    expect(screen.getByTitle('http://127.0.0.1:4700/api/v1')).toBeTruthy();

    fireEvent.click(screen.getByTestId('api-mock-settings-tab-tls'));
    fireEvent.click(screen.getByTestId('api-mock-settings-tls-enabled'));
    expect(screen.getByTitle('https://127.0.0.1:4700/api/v1')).toBeTruthy();
  });

  it('saves network, journal, proxy, and callback settings from their tabs', () => {
    const onSave = vi.fn();
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={onSave} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-settings-tab-network'));
    fireEvent.click(screen.getByTestId('api-mock-settings-cors'));
    fireEvent.change(screen.getByTestId('api-mock-settings-cors-origins'), {
      target: { value: 'https://app.example.com, https://local.test' },
    });
    fireEvent.change(screen.getByTestId('api-mock-settings-max-inbound'), { target: { value: '2048' } });
    fireEvent.change(screen.getByTestId('api-mock-settings-max-conn'), { target: { value: '50' } });
    fireEvent.change(screen.getByTestId('api-mock-settings-timeout-hold-max'), { target: { value: '8000' } });

    fireEvent.click(screen.getByTestId('api-mock-settings-tab-journal'));
    fireEvent.click(screen.getByTestId('api-mock-settings-journal'));
    fireEvent.change(screen.getByTestId('api-mock-settings-journal-max'), { target: { value: '120' } });
    fireEvent.change(screen.getByTestId('api-mock-settings-redaction'), {
      target: { value: 'Authorization, X-Secret' },
    });

    fireEvent.click(screen.getByTestId('api-mock-settings-tab-proxy'));
    expect(screen.getByTestId('api-mock-proxy-cred-badge')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-settings-proxy-enabled'));
    fireEvent.change(screen.getByTestId('api-mock-settings-proxy-allowlist'), {
      target: { value: 'https://upstream.example.com\nhttps://staging.example.com' },
    });
    fireEvent.click(screen.getByTestId('api-mock-settings-proxy-forward-auth'));
    fireEvent.change(screen.getByTestId('api-mock-settings-proxy-timeout'), { target: { value: '9000' } });
    fireEvent.click(screen.getByTestId('api-mock-settings-proxy-record'));
    fireEvent.change(screen.getByTestId('api-mock-settings-callback-allowlist'), {
      target: { value: 'https://hooks.example.com/b\n\n' },
    });

    fireEvent.click(screen.getByTestId('api-mock-settings-save'));
    const saved = onSave.mock.calls[0][0];
    expect(saved.settings.cors).toMatchObject({
      enabled: true,
      allowOrigins: ['https://app.example.com', 'https://local.test'],
    });
    expect(saved.settings.limits).toMatchObject({
      maxInboundBodyBytes: 2048,
      maxConcurrentConnections: 50,
      longRunningMaxMs: 8000,
    });
    expect(saved.settings.journal).toMatchObject({ enabled: false, maxEntries: 120 });
    expect(saved.settings.redaction.headerNames).toEqual(['authorization', 'x-secret']);
    expect(saved.settings.proxy).toMatchObject({
      enabled: false,
      allowlist: ['https://upstream.example.com', 'https://staging.example.com'],
      forwardAuth: false,
      forwardCredentialHeaders: [],
      timeoutMs: 9000,
      recordAsDrafts: false,
    });
    expect(saved.settings.callbacks.allowlist).toEqual(['https://hooks.example.com/b']);
  });

  it('generates self-signed TLS credentials and surfaces failures', async () => {
    generateSelfSignedTls.mockResolvedValue({
      ok: true,
      data: {
        certPem: '-----BEGIN CERTIFICATE-----\nGEN\n-----END CERTIFICATE-----',
        keyPem: '-----BEGIN PRIVATE KEY-----\nGEN\n-----END PRIVATE KEY-----',
      },
    });

    render(<ApiMockServerSettingsModal server={makeServer()} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-settings-tab-tls'));
    fireEvent.click(screen.getByTestId('api-mock-settings-tls-enabled'));
    fireEvent.click(screen.getByTestId('api-mock-settings-tls-generate'));

    await waitFor(() => expect(generateSelfSignedTls).toHaveBeenCalled());
    await waitFor(() => {
      expect((screen.getByTestId('api-mock-settings-tls-cert') as HTMLTextAreaElement).value).toContain('BEGIN CERTIFICATE');
    });
    expect(generateSelfSignedTls).toHaveBeenCalledWith(['127.0.0.1', 'localhost']);
    expect(screen.getByText(/Self-signed certificates are not trusted by default/)).toBeTruthy();

    generateSelfSignedTls.mockResolvedValueOnce({ ok: false, error: { message: 'openssl unavailable' } });
    fireEvent.click(screen.getByTestId('api-mock-settings-tls-generate'));
    await waitFor(() => {
      expect(screen.getByTestId('api-mock-settings-tls-error')).toHaveTextContent('openssl unavailable');
    });
  });

  it('disables save when TLS or mTLS material is incomplete', () => {
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-settings-tab-tls'));
    fireEvent.click(screen.getByTestId('api-mock-settings-tls-enabled'));
    expect(screen.getByTestId('api-mock-settings-save')).toBeDisabled();

    fireEvent.change(screen.getByTestId('api-mock-settings-tls-cert'), {
      target: { value: '-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----' },
    });
    expect(screen.getByTestId('api-mock-settings-save')).toBeDisabled();

    fireEvent.change(screen.getByTestId('api-mock-settings-tls-key'), {
      target: { value: '-----BEGIN PRIVATE KEY-----\nY\n-----END PRIVATE KEY-----' },
    });
    expect(screen.getByTestId('api-mock-settings-save')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('api-mock-settings-mtls-enabled'));
    expect(screen.getByTestId('api-mock-settings-save')).toBeDisabled();
  });

  it('shows copy failure and copied state for TLS certificate sharing', async () => {
    const writeText = vi.fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValueOnce(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    const server = makeServer();
    server.settings.tls = {
      enabled: true,
      certPem: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
      keyPem: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----',
      mtls: { enabled: false, clientCaPem: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----' },
    };
    render(<ApiMockServerSettingsModal server={server} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-settings-tab-tls'));

    fireEvent.click(screen.getByTestId('api-mock-settings-tls-copy-cert'));
    await waitFor(() => {
      expect(screen.getByTestId('api-mock-settings-tls-error')).toHaveTextContent('Could not copy');
    });

    fireEvent.click(screen.getByTestId('api-mock-settings-tls-copy-cert'));
    await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy());

    fireEvent.change(screen.getByTestId('api-mock-settings-tls-passphrase'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByTestId('api-mock-settings-mtls-enabled'));
    fireEvent.change(screen.getByTestId('api-mock-settings-mtls-cn'), { target: { value: 'partner-a' } });

    vi.unstubAllGlobals();
  });

  it('falls back to server defaults when numeric fields are invalid on save', () => {
    const onSave = vi.fn();
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={onSave} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-settings-tab-network'));
    fireEvent.change(screen.getByTestId('api-mock-settings-max-inbound'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByTestId('api-mock-settings-max-conn'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('api-mock-settings-timeout-hold-max'), { target: { value: '0' } });

    fireEvent.click(screen.getByTestId('api-mock-settings-tab-journal'));
    fireEvent.change(screen.getByTestId('api-mock-settings-journal-max'), { target: { value: 'xyz' } });

    fireEvent.click(screen.getByTestId('api-mock-settings-tab-proxy'));
    fireEvent.change(screen.getByTestId('api-mock-settings-proxy-timeout'), { target: { value: 'bad' } });

    fireEvent.click(screen.getByTestId('api-mock-settings-save'));
    expect(onSave.mock.calls[0][0].settings.limits.maxInboundBodyBytes).toBe(DEFAULT_SETTINGS.limits.maxInboundBodyBytes);
    expect(onSave.mock.calls[0][0].settings.limits.maxConcurrentConnections).toBe(DEFAULT_SETTINGS.limits.maxConcurrentConnections);
    expect(onSave.mock.calls[0][0].settings.limits.longRunningMaxMs).toBe(DEFAULT_SETTINGS.limits.longRunningMaxMs);
    expect(onSave.mock.calls[0][0].settings.journal.maxEntries).toBe(DEFAULT_SETTINGS.journal.maxEntries);
    expect(onSave.mock.calls[0][0].settings.proxy!.timeoutMs).toBe(DEFAULT_SETTINGS.proxy!.timeoutMs);
  });

  it('clamps timeout hold max to the hard ceiling on save', () => {
    const onSave = vi.fn();
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-settings-tab-network'));
    fireEvent.change(screen.getByTestId('api-mock-settings-timeout-hold-max'), {
      target: { value: String(HARD_CEILINGS.maxLongRunningMs + 5_000) },
    });
    fireEvent.click(screen.getByTestId('api-mock-settings-save'));
    expect(onSave.mock.calls[0][0].settings.limits.longRunningMaxMs).toBe(HARD_CEILINGS.maxLongRunningMs);
  });

  it('shows default-deny and loop-guard notes and persists the private-network fence', () => {
    const onSave = vi.fn();
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={onSave} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-settings-tab-proxy'));
    expect(screen.getByTestId('api-mock-settings-proxy-deny').textContent).toMatch(/Default-deny/);
    expect(screen.getByTestId('api-mock-settings-proxy-loop').textContent).toMatch(/508/);
    expect(screen.getByTestId('api-mock-settings-proxy-private')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByTestId('api-mock-settings-proxy-private'));
    fireEvent.click(screen.getByTestId('api-mock-settings-save'));
    expect(onSave.mock.calls[0][0].settings.proxy).toMatchObject({
      blockPrivateNetworks: false,
    });
  });

  it('uses server slug fallback for unnamed servers when exporting certificates', () => {
    const server = makeServer({ name: '   ' });
    server.settings.tls = {
      enabled: true,
      certPem: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
      keyPem: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----',
    };
    render(<ApiMockServerSettingsModal server={server} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-settings-tab-tls'));
    expect(screen.getByTestId('api-mock-settings-panel-tls').textContent).toMatch(/api-mock-cert\.pem/);
  });
});
