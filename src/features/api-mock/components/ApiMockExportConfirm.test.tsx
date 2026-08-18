/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockExportConfirm } from './ApiMockExportConfirm';
import type { ApiMockExportResult } from '../apiMockExportActions';
import { stubScrollIntoView } from '../../../test-utils/domMocks';

// The inline Preview now renders the JSON tree (JsonPreview), which scrolls the
// active search match into view — jsdom has no scrollIntoView.
beforeAll(() => {
  stubScrollIntoView();
});

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
    // JSON exports render the interactive tree inline (not a raw textarea).
    const tree = screen.getByTestId('api-mock-export-preview-tree');
    expect(tree).toBeInTheDocument();
    expect(tree).toHaveTextContent('keyPem');
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
    // The inline tree reports its match count via effect — wait for it to settle.
    await waitFor(() => expect(screen.getByTestId('api-mock-export-search-count')).toHaveTextContent('1/2'));
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
    // YAML exports render the structured tree (from the JSON envelope), not a raw textarea.
    expect(screen.getByTestId('api-mock-export-preview-tree')).toBeInTheDocument();
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

  it('falls back to the text preview when a YAML export has no parseable structure', () => {
    render(
      <ApiMockExportConfirm
        result={{ ...result, format: 'yaml', text: 'just: [unbalanced', nativeJson: undefined }}
        onClose={vi.fn()}
      />,
    );
    // No structured source → the raw text preview (textarea), not the tree.
    expect(screen.queryByTestId('api-mock-export-preview-tree')).toBeNull();
    expect(screen.getByTestId('api-mock-export-preview')).toHaveValue('just: [unbalanced');
    // Maximizing opens the text-expand modal (not the JSON-tree popup).
    fireEvent.click(screen.getByTestId('api-mock-export-preview-expand'));
    expect(screen.getByTestId('api-mock-text-expand-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('api-mock-export-preview-json-modal')).toBeNull();
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

  it('highlights and scrolls raw text matches, then opens the text preview modal', async () => {
    const rawResult = {
      ...result,
      format: 'yaml' as const,
      text: 'alpha\nneedle value\nneedle again',
      nativeJson: undefined,
      redacted: false,
      tlsKeyPem: undefined,
      sensitiveValues: [],
    };
    render(<ApiMockExportConfirm result={rawResult} onClose={vi.fn()} />);
    const preview = screen.getByTestId('api-mock-export-preview') as HTMLTextAreaElement;
    const backdrop = document.querySelector('.am-export-preview-backdrop') as HTMLElement;
    preview.scrollTop = 12;
    preview.scrollLeft = 4;
    fireEvent.scroll(preview);
    expect(backdrop.scrollTop).toBe(12);
    expect(backdrop.scrollLeft).toBe(4);

    fireEvent.change(screen.getByTestId('api-mock-export-search'), { target: { value: 'needle' } });
    expect(document.querySelectorAll('.am-export-preview-match')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('api-mock-export-search-next'));
    fireEvent.click(screen.getByTestId('api-mock-export-search-prev'));
    fireEvent.click(screen.getByTestId('api-mock-export-preview-expand'));
    expect(screen.getByTestId('api-mock-text-expand-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('api-mock-text-expand-close'));
    expect(screen.queryByTestId('api-mock-text-expand-modal')).toBeNull();
  });

  it('opens the JSON preview popup and exercises its search and tree controls', async () => {
    render(<ApiMockExportConfirm result={result} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-export-preview-expand'));
    expect(screen.getByTestId('api-mock-export-preview-json-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('api-mock-export-preview-json-expand-all'));
    fireEvent.click(screen.getByTestId('api-mock-export-preview-json-collapse-all'));
    const search = screen.getByTestId('api-mock-export-preview-json-search');
    fireEvent.change(search, { target: { value: 'keyPem' } });
    await waitFor(() => expect(document.querySelector('.am-export-preview-json-search-count')).toHaveTextContent('1/1'));
    fireEvent.click(screen.getByTitle('Next match (Enter)'));
    fireEvent.click(screen.getByTitle('Previous match (Shift+Enter)'));
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.keyDown(search, { key: 'Enter', shiftKey: true });
    fireEvent.click(screen.getByTestId('api-mock-export-preview-json-copy'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    fireEvent.click(screen.getByTestId('api-mock-export-preview-json-close'));
    expect(screen.queryByTestId('api-mock-export-preview-json-modal')).toBeNull();
  });

  it('handles an empty unparseable export without redaction sections', () => {
    render(
      <ApiMockExportConfirm
        result={{
          ...result,
          format: 'json',
          text: '',
          nativeJson: undefined,
          redacted: false,
          tlsKeyPem: undefined,
          sensitiveValues: [],
          lossNotes: ['nothing to export'],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('api-mock-export-redaction')).toBeNull();
    expect(screen.queryByTestId('api-mock-export-tls-key')).toBeNull();
    expect(screen.getByTestId('api-mock-export-loss')).toHaveTextContent('nothing to export');
    expect(screen.getByTestId('api-mock-export-preview')).toHaveValue('');
  });
});
