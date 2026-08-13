/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockServerSettingsModal } from './ApiMockServerSettingsModal';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(): ApiMockServerDefinitionV1 {
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
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('ApiMockServerSettingsModal', () => {
  it('renders initial values and saves edited settings', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByTestId('api-mock-settings-name'), { target: { value: 'Users API' } });
    fireEvent.change(screen.getByTestId('api-mock-settings-port'), { target: { value: '4611' } });
    fireEvent.change(screen.getByTestId('api-mock-settings-basepath'), { target: { value: '/api' } });

    const host = screen.getByTestId('api-mock-settings-host');
    fireEvent.click(host.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="localhost"]') as HTMLElement);

    fireEvent.click(screen.getByTestId('api-mock-settings-save'));

    expect(onSave).toHaveBeenCalledWith({
      name: 'Users API',
      host: 'localhost',
      port: 4611,
      basePath: '/api',
      settings: expect.objectContaining({
        selection: expect.objectContaining({
          multipleMatchPolicy: 'highest_priority',
          equalPriorityPolicy: 'reject',
        }),
      }),
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('disables save for invalid port and shows the validation hint', () => {
    const onSave = vi.fn();
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={onSave} onClose={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-settings-port'), { target: { value: '80' } });
    expect(screen.getByTestId('api-mock-settings-save')).toBeDisabled();
    expect(screen.getByText('Port must be 1024–65535.')).toBeTruthy();

    fireEvent.click(screen.getByTestId('api-mock-settings-save'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('disables save for blank names', () => {
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-settings-name'), { target: { value: '   ' } });
    expect(screen.getByTestId('api-mock-settings-save')).toBeDisabled();
  });

  it('shows the LAN warning when binding to 0.0.0.0', () => {
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={vi.fn()} onClose={vi.fn()} />);

    const host = screen.getByTestId('api-mock-settings-host');
    fireEvent.click(host.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="0.0.0.0"]') as HTMLElement);

    expect(screen.getByText(/exposes this mock server to your local network/i)).toBeTruthy();
  });

  it('cancels without saving', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('api-mock-settings-cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  describe('TLS certificate sharing', () => {
    function renderWithCert() {
      const server = makeServer();
      server.name = 'Users API';
      server.settings.tls = {
        enabled: true,
        certPem: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
        keyPem: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----',
      };
      render(<ApiMockServerSettingsModal server={server} onSave={vi.fn()} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('TLS'));
    }

    it('copies the certificate — never the key', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
      renderWithCert();

      fireEvent.click(screen.getByTestId('api-mock-settings-tls-copy-cert'));
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('BEGIN CERTIFICATE'));
      expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('PRIVATE KEY'));
      vi.unstubAllGlobals();
    });

    it('downloads the certificate as a server-named .pem', () => {
      const createObjectURL = vi.fn(() => 'blob:cert');
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      renderWithCert();

      fireEvent.click(screen.getByTestId('api-mock-settings-tls-download-cert'));
      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:cert');

      click.mockRestore();
      vi.unstubAllGlobals();
    });

    it('disables both actions when no certificate is present', () => {
      render(<ApiMockServerSettingsModal server={makeServer()} onSave={vi.fn()} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('TLS'));

      expect(screen.getByTestId('api-mock-settings-tls-copy-cert')).toBeDisabled();
      expect(screen.getByTestId('api-mock-settings-tls-download-cert')).toBeDisabled();
    });
  });
});
