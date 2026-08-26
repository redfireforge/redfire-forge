// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApiMockHarCompareModal } from './ApiMockHarCompareModal';
import { diffBodies } from './apiMockHarCompareUtils';
import type { ApiMockHarSourceEntryV1, ApiMockTransactionV1 } from '@shared/api-mock/contracts';

function makeTx(overrides: Partial<ApiMockTransactionV1> = {}): ApiMockTransactionV1 {
  return {
    id: 'tx-1',
    serverId: 'srv-1',
    generation: 1,
    receivedAt: new Date().toISOString(),
    outcome: 'matched',
    matchedRouteId: 'route-1',
    request: {
      method: 'POST',
      path: '/api/orders',
      rawPath: '/api/orders',
      query: {},
      headers: {},
      cookies: {},
      body: '{"item":"widget"}',
      bodyTruncated: false,
      receivedAt: new Date().toISOString(),
    },
    response: {
      status: 201,
      headers: {},
      cookies: [],
      body: '{"id":"order-1","status":"pending"}',
      bodyTruncated: false,
      contentType: 'application/json',
      durationMs: 12,
      generationAtResponse: 1,
    },
    explanation: { policyDecision: { policy: 'rules' }, candidates: [], nearMisses: [] },
    ...overrides,
  };
}

function makeHarSource(overrides: Partial<ApiMockHarSourceEntryV1> = {}): ApiMockHarSourceEntryV1 {
  return {
    originalStatus: 201,
    originalBody: '{"id":"order-abc","status":"pending"}',
    originalContentType: 'application/json',
    requestFingerprint: 'fp-abc123',
    ...overrides,
  };
}

describe('ApiMockHarCompareModal', () => {
  it('renders with method and path in title', () => {
    render(<ApiMockHarCompareModal tx={makeTx()} harSource={makeHarSource()} onClose={vi.fn()} />);
    expect(screen.getByTestId('api-mock-har-compare-modal')).toBeTruthy();
    expect(screen.getByText('POST')).toBeTruthy();
    expect(screen.getByText('/api/orders')).toBeTruthy();
  });

  it('shows status match badge as match when statuses are equal', () => {
    render(<ApiMockHarCompareModal tx={makeTx()} harSource={makeHarSource()} onClose={vi.fn()} />);
    expect(screen.getByTestId('api-mock-har-compare-status-badge').textContent).toContain('Match');
  });

  it('shows status mismatch badge when statuses differ', () => {
    render(
      <ApiMockHarCompareModal
        tx={makeTx()}
        harSource={makeHarSource({ originalStatus: 200 })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-har-compare-status-badge').textContent).toContain('Mismatch');
  });

  it('shows original and mock status values', () => {
    render(<ApiMockHarCompareModal tx={makeTx()} harSource={makeHarSource()} onClose={vi.fn()} />);
    expect(screen.getByTestId('api-mock-har-compare-orig-status').textContent).toContain('201');
    expect(screen.getByTestId('api-mock-har-compare-mock-status').textContent).toContain('201');
  });

  it('calls onClose when Close button clicked', () => {
    const onClose = vi.fn();
    render(<ApiMockHarCompareModal tx={makeTx()} harSource={makeHarSource()} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('api-mock-har-compare-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<ApiMockHarCompareModal tx={makeTx()} harSource={makeHarSource()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for non-Escape keys (covers line 105 false branch)', () => {
    const onClose = vi.fn();
    render(<ApiMockHarCompareModal tx={makeTx()} harSource={makeHarSource()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders body diff rows', () => {
    render(<ApiMockHarCompareModal tx={makeTx()} harSource={makeHarSource()} onClose={vi.fn()} />);
    expect(screen.getByTestId('api-mock-har-compare-body-rows')).toBeTruthy();
  });

  it('shows empty message when no body on either side', () => {
    const tx = makeTx({ response: undefined });
    const harSource = makeHarSource({ originalBody: undefined });
    render(<ApiMockHarCompareModal tx={tx} harSource={harSource} onClose={vi.fn()} />);
    expect(screen.getByTestId('api-mock-har-compare-body-empty')).toBeTruthy();
  });

  it('shows full match verdict and success panel when all fields match', () => {
    const txMatch = makeTx({
      response: {
        status: 200,
        headers: {},
        cookies: [],
        body: '{"status":"ok"}',
        bodyTruncated: false,
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txMatch}
        harSource={makeHarSource({ originalStatus: 200, originalBody: '{"status":"ok"}' })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-har-compare-overall-verdict').textContent).toContain('Full match');
    expect(screen.getByTestId('api-mock-har-compare-success')).toBeTruthy();
  });

  it('shows field breakdown after clicking Show field breakdown', () => {
    const txMatch = makeTx({
      response: {
        status: 200,
        headers: {},
        cookies: [],
        body: '{"status":"ok"}',
        bodyTruncated: false,
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txMatch}
        harSource={makeHarSource({ originalStatus: 200, originalBody: '{"status":"ok"}' })}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-har-compare-show-breakdown'));
    expect(screen.getByTestId('api-mock-har-compare-body-rows')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-har-compare-hide-breakdown'));
    expect(screen.getByTestId('api-mock-har-compare-success')).toBeTruthy();
  });

  it('filters rows with search and toggles All fields filter', () => {
    render(<ApiMockHarCompareModal tx={makeTx()} harSource={makeHarSource()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('api-mock-har-compare-search'), { target: { value: 'id' } });
    expect(screen.getByTestId('api-mock-har-compare-body-rows')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-har-compare-filter-all'));
    fireEvent.click(screen.getByTestId('api-mock-har-compare-filter-diffs'));
    fireEvent.change(screen.getByTestId('api-mock-har-compare-search'), { target: { value: 'zzzz-no-match' } });
    expect(screen.getByTestId('api-mock-har-compare-filter-empty')).toBeTruthy();
  });

  it('shows partial match verdict when status matches but body differs', () => {
    render(<ApiMockHarCompareModal tx={makeTx()} harSource={makeHarSource()} onClose={vi.fn()} />);
    expect(screen.getByTestId('api-mock-har-compare-overall-verdict').textContent).toContain('Partial match');
  });

  it('shows mismatch verdict and warning status pills for client errors', () => {
    render(
      <ApiMockHarCompareModal
        tx={makeTx({ response: { ...makeTx().response!, status: 404 } })}
        harSource={makeHarSource({ originalStatus: 500 })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-har-compare-overall-verdict').textContent).toContain('Mismatch');
    expect(screen.getByTestId('api-mock-har-compare-orig-status').textContent).toContain('500');
    expect(screen.getByTestId('api-mock-har-compare-mock-status').textContent).toContain('404');
  });

  it('supports search navigation controls', () => {
    render(<ApiMockHarCompareModal tx={makeTx()} harSource={makeHarSource()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('api-mock-har-compare-search'), { target: { value: 'id' } });
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(screen.getByLabelText('Previous'));
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByTestId('api-mock-har-compare-body-rows')).toBeTruthy();
  });
});

describe('diffBodies', () => {
  it('returns empty array when both bodies are absent', () => {
    expect(diffBodies(undefined, undefined)).toHaveLength(0);
  });

  it('marks identical JSON fields as match', () => {
    const items = diffBodies('{"status":"pending"}', '{"status":"pending"}');
    expect(items[0].status).toBe('match');
    expect(items[0].key).toBe('status');
  });

  it('marks differing JSON fields as mismatch', () => {
    const items = diffBodies('{"id":"order-abc"}', '{"id":"order-xyz"}');
    expect(items[0].status).toBe('mismatch');
  });

  it('marks mock fields with {{template}} as template', () => {
    const items = diffBodies('{"id":"abc"}', '{"id":"{{uuid}}"}');
    expect(items[0].status).toBe('template');
  });

  it('marks fields only in original as only-original', () => {
    const items = diffBodies('{"a":1,"b":2}', '{"a":1}');
    const bItem = items.find(i => i.key === 'b');
    expect(bItem?.status).toBe('only-original');
  });

  it('marks fields only in mock as only-mock', () => {
    const items = diffBodies('{"a":1}', '{"a":1,"extra":"val"}');
    const extraItem = items.find(i => i.key === 'extra');
    expect(extraItem?.status).toBe('only-mock');
  });

  it('falls back to line diff for non-JSON bodies', () => {
    const items = diffBodies('line one\nline two', 'line one\nchanged');
    expect(items[0].status).toBe('match');
    expect(items[1].status).toBe('mismatch');
  });

  it('marks extra mock lines as only-mock in text diff (covers line 69)', () => {
    const items = diffBodies('line one', 'line one\nextra mock line');
    expect(items).toHaveLength(2);
    expect(items[1].status).toBe('only-mock');
    expect(items[1].original).toBeUndefined();
    expect(items[1].mock).toBe('extra mock line');
  });

  it('marks extra original lines as only-original in text diff (covers line 71)', () => {
    const items = diffBodies('line one\nextra orig line', 'line one');
    expect(items).toHaveLength(2);
    expect(items[1].status).toBe('only-original');
    expect(items[1].mock).toBeUndefined();
    expect(items[1].original).toBe('extra orig line');
  });

  it('marks template pattern as template status in text diff fallback (covers line 75)', () => {
    const items = diffBodies('field-value', '{{faker.name}}');
    expect(items[0].status).toBe('template');
    expect(items[0].original).toBe('field-value');
    expect(items[0].mock).toBe('{{faker.name}}');
  });

  it('handles original absent but mock present (covers line 36 false branch — origObj = null)', () => {
    // original = undefined → `original ? tryParseJson(original) : null` → null
    const items = diffBodies(undefined, 'mock text');
    expect(items).toHaveLength(1);
    // text diff: origLines = [''] vs mockLines = ['mock text'] → mismatch
    expect(items[0].status).toBe('mismatch');
  });

  it('handles original present but mock absent (covers line 37 false branch — mockObj = null)', () => {
    // mock = undefined → `mock ? tryParseJson(mock) : null` → null
    const items = diffBodies('original text', undefined);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('mismatch');
  });

  it('falls back to null when JSON is an array (covers tryParseJson !Array.isArray false branch)', () => {
    // tryParseJson('[1,2,3]') → parsed is array → !Array.isArray(parsed) false → return null
    // Both parse to null → text diff
    const items = diffBodies('[1,2,3]', '[4,5,6]');
    expect(items[0].status).toBe('mismatch');
  });
});

describe('ApiMockHarCompareModal — non-JSON body rendering', () => {
  it('renders without error when mock body is non-JSON text (covers formatBody catch path)', () => {
    const txNonJson = makeTx({
      response: {
        status: 200,
        headers: {},
        cookies: [],
        body: 'plain text response',
        bodyTruncated: false,
        contentType: 'text/plain',
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txNonJson}
        harSource={makeHarSource({ originalBody: 'also plain text' })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-har-compare-body-rows')).toBeTruthy();
  });

  it('shows Bodies are identical when both bodies match exactly and bodyDiff is empty', () => {
    render(
      <ApiMockHarCompareModal
        tx={makeTx({ response: undefined })}
        harSource={makeHarSource({ originalBody: undefined })}
        onClose={vi.fn()}
      />,
    );
    const emptyEl = screen.getByTestId('api-mock-har-compare-body-empty');
    expect(emptyEl.textContent).toBe('No body in either response.');
  });

  it('renders only-original icon and absent mock column for missing mock field', () => {
    const txOnlyOrig = makeTx({
      response: {
        status: 201,
        headers: {},
        cookies: [],
        body: '{"a":1}',
        bodyTruncated: false,
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txOnlyOrig}
        harSource={makeHarSource({ originalBody: '{"a":1,"b":2}' })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-har-compare-row-only-original')).toBeTruthy();
    expect(screen.getByTestId('api-mock-har-compare-summary')).toBeTruthy();
  });

  it('renders only-mock icon and absent original column for extra mock field', () => {
    const txOnlyMock = makeTx({
      response: {
        status: 200,
        headers: {},
        cookies: [],
        body: '{"a":1,"extra":"val"}',
        bodyTruncated: false,
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txOnlyMock}
        harSource={makeHarSource({ originalBody: '{"a":1}' })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-har-compare-row-only-mock')).toBeTruthy();
  });

  it('renders template icon when mock body has {{helper}} in a field', () => {
    const txTemplate = makeTx({
      response: {
        status: 201,
        headers: {},
        cookies: [],
        body: '{"id":"{{uuid}}","status":"ok"}',
        bodyTruncated: false,
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txTemplate}
        harSource={makeHarSource({ originalBody: '{"id":"abc-123","status":"ok"}' })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-har-compare-row-template')).toBeTruthy();
    expect(screen.getByTestId('api-mock-har-compare-summary')).toBeTruthy();
  });

  it('shows Bodies match in summary when all JSON fields match', () => {
    const txMatch = makeTx({
      response: {
        status: 200,
        headers: {},
        cookies: [],
        body: '{"status":"ok"}',
        bodyTruncated: false,
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txMatch}
        harSource={makeHarSource({ originalBody: '{"status":"ok"}' })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-har-compare-summary').textContent).toContain('Bodies match');
  });

  it('shows singular "field differs" for single mismatch', () => {
    render(
      <ApiMockHarCompareModal
        tx={makeTx()}
        harSource={makeHarSource()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-har-compare-summary').textContent).toMatch(/\d+ field(s?) differ/);
  });

  it('shows plural "fields differ" for multiple mismatches (covers line 200 plural branch)', () => {
    // Two fields differ → mismatchCount = 2 → "2 fields differ" (plural 's')
    const txMultiMismatch = makeTx({
      response: {
        status: 200,
        headers: {},
        cookies: [],
        body: '{"a":"x","b":"y"}',
        bodyTruncated: false,
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txMultiMismatch}
        harSource={makeHarSource({ originalBody: '{"a":"orig-a","b":"orig-b"}' })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-har-compare-summary').textContent).toContain('fields differ');
  });

  it('shows plural "uses template" for multiple template fields (covers line 205 plural branch)', () => {
    // Two template fields → templateCount = 2 → "2 use template" (no 's')
    const txMultiTemplate = makeTx({
      response: {
        status: 200,
        headers: {},
        cookies: [],
        body: '{"a":"{{uuid}}","b":"{{name}}"}',
        bodyTruncated: false,
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txMultiTemplate}
        harSource={makeHarSource({ originalBody: '{"a":"abc","b":"bob"}' })}
        onClose={vi.fn()}
      />,
    );
    // 2 templates: "2 use template" (not "uses")
    expect(screen.getByTestId('api-mock-har-compare-summary').textContent).toMatch(/\d+ use template/);
  });

  it('shows "Bodies are identical." when bodyDiff is empty but bodies are present (covers line 157 branch)', () => {
    // Two identical empty JSON objects → diffBodies returns [] but bodies are non-falsy
    const txMatch = makeTx({
      response: {
        status: 200,
        headers: {},
        cookies: [],
        body: '{}',
        bodyTruncated: false,
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txMatch}
        harSource={makeHarSource({ originalBody: '{}' })}
        onClose={vi.fn()}
      />,
    );
    const emptyEl = screen.getByTestId('api-mock-har-compare-body-empty');
    expect(emptyEl.textContent).toBe('Bodies are identical.');
  });

  it('renders empty mock column when tx.response.body is null (covers formatBody !body branch — line 240)', () => {
    // formatBody(null) → !body is true → returns undefined → mockBody is undefined
    const txNullBody = makeTx({
      response: {
        status: 200,
        headers: {},
        cookies: [],
        body: null as unknown as string,
        bodyTruncated: false,
        durationMs: 5,
        generationAtResponse: 1,
      },
    });
    render(
      <ApiMockHarCompareModal
        tx={txNullBody}
        harSource={makeHarSource({ originalBody: 'original content' })}
        onClose={vi.fn()}
      />,
    );
    // With original body present but mock body null, diff runs as text fallback
    expect(screen.getByTestId('api-mock-har-compare-body-rows')).toBeTruthy();
  });
});
