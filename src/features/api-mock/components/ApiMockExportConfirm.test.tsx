/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockExportConfirm } from './ApiMockExportConfirm';
import type { ApiMockExportResult } from '../apiMockExportActions';

const result: ApiMockExportResult = {
  filename: 'api-mock-workspace-Store-API-2026-08-14.json',
  format: 'json',
  scope: 'workspace',
  text: '{\n  "keyPem": "***REDACTED***",\n  "apiToken": "[REDACTED]"\n}',
  nativeJson: '{"ok":true}',
  redacted: true,
  tlsKeyPem: '***REDACTED***',
  sensitiveValues: [{ key: 'apiToken', value: '[REDACTED]' }],
  lossNotes: [],
  cliCommand: 'redfireforge mock simulate api-mock-workspace-Store-API-2026-08-14.json',
  liveMessage: 'Workspace exported.',
};

describe('ApiMockExportConfirm', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn(async () => undefined) },
    });
  });

  it('shows redaction proof, TLS key, secret, CLI, and preview', () => {
    const onClose = vi.fn();
    render(<ApiMockExportConfirm result={result} onClose={onClose} />);
    const dialog = screen.getByTestId('api-mock-export-confirm');
    expect(dialog).toBeTruthy();
    expect(dialog.closest('.am-studio-modal-overlay')).toBeTruthy();
    expect(screen.getByTestId('api-mock-export-redaction').textContent).toMatch(/Secrets stayed in the workspace/);
    expect(screen.getByTestId('api-mock-export-redaction').textContent).toMatch(/TLS private keys/);
    expect(screen.getByTestId('api-mock-export-tls-key')).toHaveTextContent('***REDACTED***');
    expect(screen.getByTestId('api-mock-export-secret')).toHaveTextContent('[REDACTED]');
    expect(screen.getByTestId('api-mock-export-cli')).toHaveTextContent('redfireforge mock simulate');
    expect(screen.getByTestId('api-mock-export-cli-verify')).toHaveTextContent('redfireforge mock verify');
    expect(screen.getByTestId('api-mock-export-preview')).toHaveValue(result.text);
    expect(screen.getByTestId('api-mock-export-filename')).toHaveTextContent(result.filename);
    expect(screen.getByTestId('api-mock-export-save')).toHaveTextContent('Save to disk');
    expect(screen.getByTestId('api-mock-export-copy')).toHaveTextContent('Copy JSON');
    fireEvent.click(screen.getByTestId('api-mock-export-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('copies preview and CLI, and searches the preview', async () => {
    render(<ApiMockExportConfirm result={result} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-export-copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"ok":true}');
    await waitFor(() => expect(screen.getByTestId('api-mock-export-copy')).toHaveTextContent('Copied'));
    fireEvent.click(screen.getByTestId('api-mock-export-cli-copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(result.cliCommand);
    fireEvent.click(screen.getByTestId('api-mock-export-cli-verify-copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'redfireforge mock verify api-mock-workspace-Store-API-2026-08-14.json',
    );

    fireEvent.change(screen.getByTestId('api-mock-export-search'), { target: { value: 'REDACTED' } });
    expect(screen.getByTestId('api-mock-export-search-count')).toHaveTextContent('1/2');
    fireEvent.click(screen.getByTestId('api-mock-export-search-next'));
    expect(screen.getByTestId('api-mock-export-search-count')).toHaveTextContent('2/2');
    fireEvent.click(screen.getByTestId('api-mock-export-search-prev'));
    expect(screen.getByTestId('api-mock-export-search-count')).toHaveTextContent('1/2');
    fireEvent.keyDown(screen.getByTestId('api-mock-export-search'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('api-mock-export-search'), { key: 'Enter', shiftKey: true });
    fireEvent.change(screen.getByTestId('api-mock-export-search'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('api-mock-export-search-next'));
    fireEvent.click(screen.getByTestId('api-mock-export-search-prev'));
  });

  it('shows WireMock loss notes and HAR entry count', () => {
    render(
      <ApiMockExportConfirm
        result={{
          ...result,
          format: 'wiremock',
          mappingCount: 12,
          lossNotes: ['route-get-product: template helpers exported as literal text.'],
          tlsKeyPem: undefined,
          sensitiveValues: [],
          redacted: true,
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-export-mapping-count')).toHaveTextContent('12 mappings');
    expect(screen.getByTestId('api-mock-export-loss')).toHaveTextContent('template helpers');
  });

  it('shows HAR entry count', () => {
    render(
      <ApiMockExportConfirm
        result={{
          ...result,
          format: 'har',
          entryCount: 2,
          tlsKeyPem: undefined,
          sensitiveValues: [],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-export-har-count')).toHaveTextContent('2 entries');
    expect(screen.getByTestId('api-mock-export-copy')).toHaveTextContent('Copy HAR');
  });

  it('saves the preview to disk from the footer', () => {
    const click = vi.fn();
    const originalCreateElement = Document.prototype.createElement;
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === 'a') {
        const anchor = originalCreateElement.call(document, 'a', options) as HTMLAnchorElement;
        anchor.click = click;
        return anchor;
      }
      return originalCreateElement.call(document, tagName, options);
    }) as typeof document.createElement);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    render(<ApiMockExportConfirm result={result} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-export-save'));
    expect(click).toHaveBeenCalled();
    createObjectURL.mockRestore();
    revoke.mockRestore();
    vi.restoreAllMocks();
  });

  it('shows an empty TLS key as (empty)', () => {
    render(
      <ApiMockExportConfirm
        result={{ ...result, tlsKeyPem: '', sensitiveValues: [] }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-export-tls-key')).toHaveTextContent('(empty)');
  });

  it('titles YAML, server, routes, and singular mapping/entry counts', () => {
    const { rerender } = render(
      <ApiMockExportConfirm result={{ ...result, format: 'yaml' }} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Workspace YAML exported')).toBeTruthy();
    expect(screen.getByTestId('api-mock-export-copy')).toHaveTextContent('Copy YAML');
    rerender(<ApiMockExportConfirm result={{ ...result, format: 'json', scope: 'servers' }} onClose={vi.fn()} />);
    expect(screen.getByText('Server JSON exported')).toBeTruthy();
    rerender(<ApiMockExportConfirm result={{ ...result, format: 'json', scope: 'routes' }} onClose={vi.fn()} />);
    expect(screen.getByText('Routes exported')).toBeTruthy();
    rerender(
      <ApiMockExportConfirm
        result={{ ...result, format: 'wiremock', mappingCount: 1, tlsKeyPem: undefined, sensitiveValues: [] }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-export-mapping-count')).toHaveTextContent('1 mapping');
    rerender(
      <ApiMockExportConfirm
        result={{ ...result, format: 'har', entryCount: 1, tlsKeyPem: undefined, sensitiveValues: [] }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-export-har-count')).toHaveTextContent('1 entry');
    rerender(
      <ApiMockExportConfirm
        result={{
          ...result,
          format: 'har',
          entryCount: 2,
          lossNotes: ['cookies redacted'],
          tlsKeyPem: undefined,
          sensitiveValues: [],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-export-har-count')).toHaveTextContent('loss note');
  });

  it('swallows clipboard failures and focuses search on Cmd+F', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn(async () => { throw new Error('denied'); }) },
    });
    render(<ApiMockExportConfirm result={{ ...result, nativeJson: undefined }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-export-copy'));
    fireEvent.click(screen.getByTestId('api-mock-export-cli-copy'));
    await Promise.resolve();
    await Promise.resolve();
    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('api-mock-export-search'));
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'f' });
  });
});
