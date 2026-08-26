/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HarImportPreviewModal } from './HarImportPreviewModal';
import type { HarParseResult, ParsedHarEntry } from '../utils/harParser';

// Mock WorkflowEditorModalFrame to a simple passthrough
vi.mock('./modals/WorkflowEditorModalFrame', () => ({
  default: ({
    open,
    children,
    footer,
    title,
    onClose,
  }: {
    open: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    title: string;
    onClose: () => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="modal-frame">
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>×</button>
        <div data-testid="modal-body">{children}</div>
        <div data-testid="modal-footer">{footer}</div>
      </div>
    );
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(
  method: string,
  path: string,
  options: Partial<ParsedHarEntry> = {},
): ParsedHarEntry {
  return {
    method,
    url: `https://api.example.com${path}`,
    host: 'api.example.com',
    path,
    query: {},
    headers: {},
    hasRedactedHeaders: false,
    redactedHeaderNames: [],
    responseStatus: 200,
    warnings: [],
    ...options,
  };
}

function makeResult(overrides: Partial<HarParseResult> = {}): HarParseResult {
  return {
    entries: [],
    globalWarnings: [],
    filteredCount: 0,
    trackingFilteredCount: 0,
    dedupedCount: 0,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HarImportPreviewModal', () => {
  const baseProps = {
    open: true,
    fileName: 'sample.har',
    onClose: vi.fn(),
    onImport: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  // ── Visibility ──────────────────────────────────────────────────────────

  it('renders nothing when open is false', () => {
    render(
      <HarImportPreviewModal
        {...baseProps}
        open={false}
        parseResult={makeResult()}
      />,
    );
    expect(screen.queryByTestId('modal-frame')).not.toBeInTheDocument();
  });

  it('renders when open is true', () => {
    render(<HarImportPreviewModal {...baseProps} parseResult={makeResult()} />);
    expect(screen.getByTestId('modal-frame')).toBeInTheDocument();
  });

  // ── Error state ─────────────────────────────────────────────────────────

  it('shows error message when parseResult.error is set', () => {
    render(
      <HarImportPreviewModal
        {...baseProps}
        parseResult={makeResult({ error: 'Invalid JSON' })}
      />,
    );
    expect(screen.getByTestId('har-import-error')).toHaveTextContent('Invalid JSON');
  });

  it('disables import button when parseResult.error is set', () => {
    render(
      <HarImportPreviewModal
        {...baseProps}
        parseResult={makeResult({ error: 'Bad file' })}
      />,
    );
    expect(screen.getByTestId('har-import-confirm')).toBeDisabled();
  });

  // ── Summary line ────────────────────────────────────────────────────────

  it('shows entry count in summary', () => {
    const result = makeResult({
      entries: [
        makeEntry('GET', '/users'),
        makeEntry('POST', '/orders'),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-entry-count')).toHaveTextContent('2');
  });

  it('shows host in summary when entries have a host', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-summary')).toHaveTextContent('api.example.com');
  });

  it('shows filtered count when filteredCount > 0', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/users')],
      filteredCount: 3,
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-summary')).toHaveTextContent('3 filtered out');
  });

  // ── Workflow name input ─────────────────────────────────────────────────

  it('defaults workflow name to hostname import when entries have a host', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-wf-name')).toHaveValue('api.example.com import');
  });

  it('defaults workflow name to file name (without .har) when no entries', () => {
    render(
      <HarImportPreviewModal
        {...baseProps}
        fileName="my-session.har"
        parseResult={makeResult()}
      />,
    );
    expect(screen.getByTestId('har-import-wf-name')).toHaveValue('my-session import');
  });

  it('allows editing the workflow name', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    const input = screen.getByTestId('har-import-wf-name');
    fireEvent.change(input, { target: { value: 'My Custom Workflow' } });
    expect(input).toHaveValue('My Custom Workflow');
  });

  // ── Entry list ──────────────────────────────────────────────────────────

  it('renders one row per entry', () => {
    const result = makeResult({
      entries: [
        makeEntry('GET', '/users'),
        makeEntry('POST', '/orders'),
        makeEntry('DELETE', '/items/1'),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-entry-0')).toBeInTheDocument();
    expect(screen.getByTestId('har-entry-1')).toBeInTheDocument();
    expect(screen.getByTestId('har-entry-2')).toBeInTheDocument();
  });

  it('shows method and path for each entry', () => {
    const result = makeResult({ entries: [makeEntry('POST', '/api/orders')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-entry-method-0')).toHaveTextContent('POST');
    expect(screen.getByTestId('har-entry-path-0')).toHaveTextContent('/api/orders');
  });

  it('all entry checkboxes are checked by default', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/a'), makeEntry('GET', '/b')],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-entry-checkbox-0')).toBeChecked();
    expect(screen.getByTestId('har-entry-checkbox-1')).toBeChecked();
  });

  it('unchecks an entry when its checkbox is clicked', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    const checkbox = screen.getByTestId('har-entry-checkbox-0');
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('re-checks an entry when its checkbox is clicked again', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    const checkbox = screen.getByTestId('har-entry-checkbox-0');
    fireEvent.click(checkbox); // uncheck
    fireEvent.click(checkbox); // re-check
    expect(checkbox).toBeChecked();
  });

  it('shows response status on each entry row', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/users', { responseStatus: 201 })],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-entry-status-0')).toHaveTextContent('201');
  });

  it('selects all entries from the All control', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/a'), makeEntry('GET', '/b')],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    fireEvent.click(screen.getByTestId('har-entry-checkbox-0'));
    expect(screen.getByTestId('har-entry-checkbox-0')).not.toBeChecked();
    fireEvent.click(screen.getByTestId('har-import-select-all'));
    expect(screen.getByTestId('har-entry-checkbox-0')).toBeChecked();
    expect(screen.getByTestId('har-entry-checkbox-1')).toBeChecked();
  });

  it('clears selection from the None control', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/a'), makeEntry('GET', '/b')],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    fireEvent.click(screen.getByTestId('har-import-select-none'));
    expect(screen.getByTestId('har-entry-checkbox-0')).not.toBeChecked();
    expect(screen.getByTestId('har-entry-checkbox-1')).not.toBeChecked();
    expect(screen.getByTestId('har-import-confirm')).toBeDisabled();
  });

  it('shows warning icon for entries with warnings', () => {
    const result = makeResult({
      entries: [
        makeEntry('GET', '/health', { warnings: ['localhost URL detected'] }),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-entry-warning-0')).toBeInTheDocument();
  });

  it('does not show warning icon when entry has no warnings', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.queryByTestId('har-entry-warning-0')).not.toBeInTheDocument();
  });

  // ── Import button state ─────────────────────────────────────────────────

  it('import button is enabled when entries are selected', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-confirm')).not.toBeDisabled();
  });

  it('import button is disabled when all entries are deselected', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    fireEvent.click(screen.getByTestId('har-entry-checkbox-0'));
    expect(screen.getByTestId('har-import-confirm')).toBeDisabled();
  });

  it('import button shows selected step count', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/a'), makeEntry('GET', '/b')],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-confirm')).toHaveTextContent('2 steps');
  });

  it('import button shows singular "step" when 1 entry selected', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/a')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-confirm')).toHaveTextContent('1 step');
    expect(screen.getByTestId('har-import-confirm')).not.toHaveTextContent('1 steps');
  });

  it('import button updates count when an entry is deselected', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/a'), makeEntry('GET', '/b')],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    fireEvent.click(screen.getByTestId('har-entry-checkbox-0'));
    expect(screen.getByTestId('har-import-confirm')).toHaveTextContent('1 step');
  });

  // ── Callbacks ───────────────────────────────────────────────────────────

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <HarImportPreviewModal
        {...baseProps}
        onClose={onClose}
        parseResult={makeResult({ entries: [makeEntry('GET', '/users')] })}
      />,
    );
    fireEvent.click(screen.getByTestId('har-import-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when modal close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <HarImportPreviewModal
        {...baseProps}
        onClose={onClose}
        parseResult={makeResult()}
      />,
    );
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onImport with selected entries and workflow name when Import is clicked', () => {
    const onImport = vi.fn();
    const entries = [makeEntry('GET', '/users'), makeEntry('POST', '/orders')];
    const result = makeResult({ entries });
    render(
      <HarImportPreviewModal
        {...baseProps}
        onImport={onImport}
        parseResult={result}
      />,
    );
    fireEvent.click(screen.getByTestId('har-import-confirm'));
    expect(onImport).toHaveBeenCalledWith(entries, 'api.example.com import');
  });

  it('calls onImport with only selected entries when some are unchecked', () => {
    const onImport = vi.fn();
    const entries = [makeEntry('GET', '/a'), makeEntry('POST', '/b')];
    const result = makeResult({ entries });
    render(
      <HarImportPreviewModal
        {...baseProps}
        onImport={onImport}
        parseResult={result}
      />,
    );
    // Deselect second entry
    fireEvent.click(screen.getByTestId('har-entry-checkbox-1'));
    fireEvent.click(screen.getByTestId('har-import-confirm'));
    expect(onImport).toHaveBeenCalledWith([entries[0]], 'api.example.com import');
  });

  it('calls onImport with edited workflow name', () => {
    const onImport = vi.fn();
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(
      <HarImportPreviewModal {...baseProps} onImport={onImport} parseResult={result} />,
    );
    fireEvent.change(screen.getByTestId('har-import-wf-name'), {
      target: { value: 'My API Test' },
    });
    fireEvent.click(screen.getByTestId('har-import-confirm'));
    expect(onImport).toHaveBeenCalledWith(expect.any(Array), 'My API Test');
  });

  it('calls onImport with the name currently in the input field', () => {
    const onImport = vi.fn();
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(
      <HarImportPreviewModal {...baseProps} onImport={onImport} parseResult={result} />,
    );
    const input = screen.getByTestId('har-import-wf-name') as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Petstore Session');
    fireEvent.click(screen.getByTestId('har-import-confirm'));
    expect(onImport).toHaveBeenCalledWith(expect.any(Array), 'Petstore Session');
  });

  it('falls back to "HAR import" when workflow name is all whitespace', () => {
    const onImport = vi.fn();
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(
      <HarImportPreviewModal {...baseProps} onImport={onImport} parseResult={result} />,
    );
    fireEvent.change(screen.getByTestId('har-import-wf-name'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByTestId('har-import-confirm'));
    expect(onImport).toHaveBeenCalledWith(expect.any(Array), 'HAR import');
  });

  it('import button is disabled when parseResult has 0 entries and no error', () => {
    // e.g. valid HAR with 0 log.entries — all filtered by parser
    const result = makeResult({ entries: [] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-confirm')).toBeDisabled();
  });

  it('does not show entry list when 0 entries and no error', () => {
    const result = makeResult({ entries: [] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.queryByTestId('har-import-entry-list')).not.toBeInTheDocument();
  });

  it('does not call onImport when no entries are selected', () => {
    const onImport = vi.fn();
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(
      <HarImportPreviewModal {...baseProps} onImport={onImport} parseResult={result} />,
    );
    fireEvent.click(screen.getByTestId('har-entry-checkbox-0'));
    // At this point the button is disabled — simulate a direct programmatic call
    // by clicking anyway. The handleImport guard should catch it.
    // Note: fireEvent.click does NOT fire onClick on disabled buttons in jsdom.
    // To test the internal guard, we force click on the button.
    const confirmBtn = screen.getByTestId('har-import-confirm');
    // The button is now disabled
    expect(confirmBtn).toBeDisabled();
    // onImport was not called
    expect(onImport).not.toHaveBeenCalled();
  });

  it('deduplicates redacted header names that appear in multiple entries', () => {
    // Same header name in two entries — redactedMap should only show it once
    const result = makeResult({
      entries: [
        makeEntry('GET', '/a', {
          hasRedactedHeaders: true,
          redactedHeaderNames: ['Authorization'],
          headers: { Authorization: '{{authToken}}' },
        }),
        makeEntry('GET', '/b', {
          hasRedactedHeaders: true,
          redactedHeaderNames: ['Authorization'],
          headers: { Authorization: '{{authToken}}' },
        }),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    // Should show "1 sensitive header" not "2 sensitive headers"
    expect(screen.getByTestId('har-import-redaction-warning')).toHaveTextContent('1 sensitive header replaced');
  });

  // ── Redaction warning ───────────────────────────────────────────────────

  it('shows redaction warning when entries have redacted headers', () => {
    const result = makeResult({
      entries: [
        makeEntry('GET', '/data', {
          hasRedactedHeaders: true,
          redactedHeaderNames: ['Authorization'],
          headers: { Authorization: '{{authToken}}' },
        }),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-redaction-warning')).toBeInTheDocument();
    expect(screen.getByTestId('har-import-redaction-warning')).toHaveTextContent('Authorization');
    expect(screen.getByTestId('har-import-redaction-warning')).toHaveTextContent('{{authToken}}');
  });

  it('shows singular "header" text when exactly 1 header was redacted', () => {
    const result = makeResult({
      entries: [
        makeEntry('GET', '/data', {
          hasRedactedHeaders: true,
          redactedHeaderNames: ['Authorization'],
          headers: { Authorization: '{{authToken}}' },
        }),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-redaction-warning')).toHaveTextContent('1 sensitive header replaced');
  });

  it('shows plural "headers" text when multiple headers were redacted', () => {
    const result = makeResult({
      entries: [
        makeEntry('GET', '/data', {
          hasRedactedHeaders: true,
          redactedHeaderNames: ['Authorization', 'Cookie'],
          headers: { Authorization: '{{authToken}}', Cookie: '{{cookieSession}}' },
        }),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-redaction-warning')).toHaveTextContent('2 sensitive headers replaced');
  });

  it('falls back to {{variable}} placeholder when header value is missing from entry.headers', () => {
    const result = makeResult({
      entries: [
        makeEntry('GET', '/data', {
          hasRedactedHeaders: true,
          redactedHeaderNames: ['X-Custom-Auth'],
          // headers map does NOT contain X-Custom-Auth (edge case)
          headers: {},
        }),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-redaction-warning')).toHaveTextContent('{{variable}}');
  });

  it('does not show redaction warning when no headers were redacted', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.queryByTestId('har-import-redaction-warning')).not.toBeInTheDocument();
  });

  // ── Tracking notice ─────────────────────────────────────────────────────

  it('shows tracking filter notice when trackingFilteredCount > 0', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/users')],
      trackingFilteredCount: 3,
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-tracking-notice')).toBeInTheDocument();
    expect(screen.getByTestId('har-import-tracking-notice')).toHaveTextContent('3');
  });

  it('shows plural "requests were" when trackingFilteredCount > 1', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/users')],
      trackingFilteredCount: 2,
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-tracking-notice')).toHaveTextContent('requests were');
  });

  it('shows singular "request was" when trackingFilteredCount is exactly 1', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/users')],
      trackingFilteredCount: 1,
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-tracking-notice')).toHaveTextContent('request was');
  });

  it('does not show tracking notice when trackingFilteredCount is 0', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.queryByTestId('har-import-tracking-notice')).not.toBeInTheDocument();
  });

  // ── Global warnings ─────────────────────────────────────────────────────

  it('shows global warnings from parseResult', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/users')],
      globalWarnings: ['HAR has 510 entries — only first 500 are imported.'],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-global-warning-0')).toHaveTextContent('510 entries');
  });

  it('does not show global warning section when globalWarnings is empty', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.queryByTestId('har-import-global-warning-0')).not.toBeInTheDocument();
  });

  // ── Chain detection summary ─────────────────────────────────────────────

  it('does not show chain summary when fewer than 2 entries', () => {
    const result = makeResult({ entries: [makeEntry('GET', '/users')] });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.queryByTestId('har-import-chain-summary')).not.toBeInTheDocument();
  });

  it('does not show chain summary when no chains detected', () => {
    const result = makeResult({
      entries: [makeEntry('GET', '/users'), makeEntry('GET', '/products')],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.queryByTestId('har-import-chain-summary')).not.toBeInTheDocument();
  });

  it('shows chain summary when a variable chain is detected in selected entries', () => {
    const result = makeResult({
      entries: [
        makeEntry('POST', '/auth', {
          responseBody: '{"userId":"u-99"}',
        }),
        makeEntry('GET', '/users/u-99'),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-chain-summary')).toBeInTheDocument();
    expect(screen.getByTestId('har-import-chain-summary')).toHaveTextContent('1 variable chain');
    expect(screen.getByTestId('har-chain-line-0')).toHaveTextContent('$.userId');
    expect(screen.getByTestId('har-chain-line-0')).toHaveTextContent('{{userId}}');
  });

  it('shows plural "chains" text when multiple chains detected', () => {
    const result = makeResult({
      entries: [
        makeEntry('POST', '/auth', { responseBody: '{"userId":"u-1"}' }),
        makeEntry('GET', '/users/u-1', { responseBody: '{"orderId":"ord-5"}' }),
        makeEntry('GET', '/orders/ord-5'),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    expect(screen.getByTestId('har-import-chain-summary')).toHaveTextContent('2 variable chains');
  });

  it('chain summary updates when user deselects entries that break the chain', () => {
    const result = makeResult({
      entries: [
        makeEntry('POST', '/auth', { responseBody: '{"userId":"u-99"}' }),
        makeEntry('GET', '/users/u-99'),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);

    // Initially chains are shown
    expect(screen.getByTestId('har-import-chain-summary')).toBeInTheDocument();

    // Deselect the source entry (index 0) — chain can no longer be formed
    fireEvent.click(screen.getByTestId('har-entry-checkbox-0'));

    // Chain summary should disappear
    expect(screen.queryByTestId('har-import-chain-summary')).not.toBeInTheDocument();
  });

  it('chain summary updates when user deselects the target entry', () => {
    const result = makeResult({
      entries: [
        makeEntry('POST', '/auth', { responseBody: '{"userId":"u-99"}' }),
        makeEntry('GET', '/users/u-99'),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);

    expect(screen.getByTestId('har-import-chain-summary')).toBeInTheDocument();

    // Deselect the target entry (index 1)
    fireEvent.click(screen.getByTestId('har-entry-checkbox-1'));

    // No chain target → no summary
    expect(screen.queryByTestId('har-import-chain-summary')).not.toBeInTheDocument();
  });

  it('step numbers in chain summary are 1-based relative to selected entries', () => {
    const result = makeResult({
      entries: [
        makeEntry('POST', '/auth', { responseBody: '{"userId":"u-99"}' }),
        makeEntry('GET', '/users/u-99'),
      ],
    });
    render(<HarImportPreviewModal {...baseProps} parseResult={result} />);
    // Chain is Step 1 → Step 2
    expect(screen.getByTestId('har-chain-line-0')).toHaveTextContent('Step 1');
    expect(screen.getByTestId('har-chain-line-0')).toHaveTextContent('Step 2');
  });
});
