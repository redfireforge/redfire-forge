/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import ResponseDetailModal from './ResponseDetailModal';
import { RequestResult } from '../../../shared/types';

let capturedOnMatchCountChange: ((count: number) => void) | undefined;
let capturedOnToggle: ((path: string) => void) | undefined;

vi.mock('./JsonTreePreview', () => ({
  default: (props: {
    body: string;
    search: string;
    collapsedSet: Set<string>;
    onToggle: (path: string) => void;
    prebuiltTree: unknown;
    currentMatchIdx: number;
    onMatchCountChange: (count: number) => void;
  }) => {
    capturedOnMatchCountChange = props.onMatchCountChange;
    capturedOnToggle = props.onToggle;
    return (
      <div
        data-testid="json-preview"
        data-search={props.search}
        data-current-match-idx={props.currentMatchIdx}
        data-collapsed-size={props.collapsedSet.size}
        data-collapsed={Array.from(props.collapsedSet).sort().join('|')}
      />
    );
  },
  buildJTree: (data: unknown) => ({
    key: 'root',
    type: 'object',
    value: data,
    children: [
      {
        key: 'nested',
        type: 'object',
        value: {},
        children: [{ key: 'leaf', type: 'boolean', value: true, children: [] as [] }],
      },
    ],
  }),
}));

vi.mock('../../../shared/components/JsonTreeViewer', () => ({
  default: () => <div data-testid="json-tree-viewer" />,
}));

vi.mock('../../test-runner/components/WaterfallBar', () => ({
  default: () => <div data-testid="waterfall-bar" />,
}));

function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: 'r1',
    scenarioId: 's1',
    scenarioName: 'Test Request',
    url: 'https://api.example.com/users',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 42,
    responseBody: '{"ok":true}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    ...overrides,
  };
}

beforeEach(() => {
  capturedOnMatchCountChange = undefined;
  capturedOnToggle = undefined;
});

describe('ResponseDetailModal', () => {
  it('renders nothing when result is null', () => {
    const { container } = render(<ResponseDetailModal result={null} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders meta info', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    expect(screen.getByText('GET')).toBeTruthy();
    expect(screen.getByText('Test Request')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('42 ms')).toBeTruthy();
  });

  it('renders response headers section', () => {
    const result = makeResult({
      responseHeaders: {
        'content-type': 'application/json',
        'x-request-id': 'abc-123',
      },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Response Headers')).toBeTruthy();
    expect(screen.getByText('content-type')).toBeTruthy();
    expect(screen.getByText('application/json')).toBeTruthy();
    expect(screen.getByText('x-request-id')).toBeTruthy();
    expect(screen.getByText('abc-123')).toBeTruthy();
  });

  it('hides response headers section when empty', () => {
    render(<ResponseDetailModal result={makeResult({ responseHeaders: {} })} onClose={vi.fn()} />);
    expect(screen.queryByText('Response Headers')).toBeNull();
  });

  it('hides response headers section when undefined', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    expect(screen.queryByText('Response Headers')).toBeNull();
  });

  it('renders request headers section', () => {
    const result = makeResult({
      requestLog: {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: '{"name":"test"}',
      },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Request Headers')).toBeTruthy();
    expect(screen.getByText('Content-Type')).toBeTruthy();
    expect(screen.getByText('Accept')).toBeTruthy();
  });

  it('masks Authorization header value', () => {
    const result = makeResult({
      requestLog: {
        headers: { 'Authorization': 'Bearer secret-token', 'Accept': '*/*' },
      },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Authorization')).toBeTruthy();
    expect(screen.getByText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')).toBeTruthy();
    expect(screen.queryByText('Bearer secret-token')).toBeNull();
  });

  it('renders request body section', () => {
    const result = makeResult({
      requestLog: {
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"test"}',
      },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Request Body')).toBeTruthy();
  });

  it('hides request body when not provided', () => {
    const result = makeResult({
      requestLog: { headers: { 'Accept': '*/*' } },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.queryByText('Request Body')).toBeNull();
  });

  it('hides request headers when requestLog is undefined', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    expect(screen.queryByText('Request Headers')).toBeNull();
    expect(screen.queryByText('Request Body')).toBeNull();
  });

  it('renders validation failure table rows', () => {
    const result = makeResult({
      passed: false,
      failureDetails: [
        { path: '$.id', expected: '1', actual: '2' },
      ],
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Validation Failures (1)')).toBeTruthy();
    expect(screen.getByText('$.id')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('stringifies non-string failure expected/actual values', () => {
    const result = makeResult({
      passed: false,
      failureDetails: [
        { path: 'x', expected: { a: 1 } as unknown as string, actual: [9] as unknown as string },
      ],
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('{"a":1}')).toBeTruthy();
    expect(screen.getByText('[9]')).toBeTruthy();
  });

  it('renders timing breakdown when present', () => {
    const result = makeResult({
      timing: {
        dnsLookup: 1,
        tcpConnect: 2,
        tlsHandshake: 3,
        ttfb: 4,
        download: 5,
        total: 15,
      },
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Timing Breakdown')).toBeTruthy();
    expect(screen.getByTestId('waterfall-bar')).toBeTruthy();
  });

  it('renders error message as JSON when not a string', () => {
    const result = makeResult({
      passed: false,
      httpStatus: 0,
      errorMessage: { code: 'ECONNRESET' } as unknown as string,
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('Error Message')).toBeTruthy();
    expect(screen.getByText('{"code":"ECONNRESET"}')).toBeTruthy();
  });

  it('uses ERR tag styling when httpStatus is 0', () => {
    const result = makeResult({ httpStatus: 0, passed: false });
    const { container } = render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(container.querySelector('.tag-danger')?.textContent).toContain('ERR');
  });

  it('uses danger tag styling for http status 4xx', () => {
    const { container } = render(
      <ResponseDetailModal result={makeResult({ httpStatus: 404, passed: false })} onClose={vi.fn()} />,
    );
    const tags = [...container.querySelectorAll('.response-meta-row .tag')];
    expect(tags.some((el) => el.classList.contains('tag-danger') && el.textContent === '404')).toBe(true);
  });

  it('renders string error message without JSON.stringify', () => {
    const result = makeResult({
      passed: false,
      httpStatus: 500,
      errorMessage: 'upstream timeout',
    });
    render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
    expect(screen.getByText('upstream timeout')).toBeTruthy();
    expect(screen.queryByText('"upstream timeout"')).toBeNull();
  });

  it('renders RESPONSE BODY with search input when responseBody is set', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'RESPONSE BODY' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Search response...')).toBeTruthy();
  });

  it('updates search input and shows match counter', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Search response...');
    fireEvent.change(input, { target: { value: 'ok' } });
    expect(screen.getByText('No match')).toBeTruthy();
    expect(screen.getByTestId('json-preview')).toHaveAttribute('data-search', 'ok');

    act(() => {
      capturedOnMatchCountChange?.(2);
    });
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('navigates search matches with Previous and Next', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Search response...'), { target: { value: 'x' } });
    act(() => {
      capturedOnMatchCountChange?.(3);
    });
    const preview = screen.getByTestId('json-preview');
    expect(preview).toHaveAttribute('data-current-match-idx', '0');

    fireEvent.click(screen.getByTitle('Next'));
    expect(preview).toHaveAttribute('data-current-match-idx', '1');

    fireEvent.click(screen.getByTitle('Next'));
    expect(preview).toHaveAttribute('data-current-match-idx', '2');

    fireEvent.click(screen.getByTitle('Next'));
    expect(preview).toHaveAttribute('data-current-match-idx', '0');

    fireEvent.click(screen.getByTitle('Previous'));
    expect(preview).toHaveAttribute('data-current-match-idx', '2');

    fireEvent.click(screen.getByTitle('Previous'));
    expect(preview).toHaveAttribute('data-current-match-idx', '1');
  });

  it('clears search via × button', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Search response...'), { target: { value: 'q' } });
    act(() => {
      capturedOnMatchCountChange?.(1);
    });
    expect(screen.getByText('1/1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByPlaceholderText('Search response...')).toHaveValue('');
    expect(screen.queryByText('1/1')).toBeNull();
    expect(screen.getByTestId('json-preview')).toHaveAttribute('data-search', '');
  });

  it('Expand All and Collapse All update collapsed state passed to JsonPreview', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    const preview = screen.getByTestId('json-preview');
    expect(preview).toHaveAttribute('data-collapsed-size', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse All' }));
    expect(preview).toHaveAttribute('data-collapsed-size', '2');
    expect(preview.getAttribute('data-collapsed')).toBe('|/nested');

    fireEvent.click(screen.getByRole('button', { name: 'Expand All' }));
    expect(preview).toHaveAttribute('data-collapsed-size', '0');
  });

  it('handleMatchCountChange clamps index when count shrinks below current index', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Search response...'), { target: { value: 'z' } });
    act(() => {
      capturedOnMatchCountChange?.(5);
    });
    const preview = screen.getByTestId('json-preview');

    fireEvent.click(screen.getByTitle('Next'));
    fireEvent.click(screen.getByTitle('Next'));
    fireEvent.click(screen.getByTitle('Next'));
    expect(preview).toHaveAttribute('data-current-match-idx', '3');

    act(() => {
      capturedOnMatchCountChange?.(3);
    });
    expect(preview).toHaveAttribute('data-current-match-idx', '2');
  });

  it('handleMatchCountChange resets index when count becomes zero', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Search response...'), { target: { value: 'z' } });
    act(() => {
      capturedOnMatchCountChange?.(2);
    });
    fireEvent.click(screen.getByTitle('Next'));
    expect(screen.getByTestId('json-preview')).toHaveAttribute('data-current-match-idx', '1');

    act(() => {
      capturedOnMatchCountChange?.(0);
    });
    expect(screen.getByTestId('json-preview')).toHaveAttribute('data-current-match-idx', '0');
  });

  it('handleTreeToggle adds and removes paths in collapsedSet', () => {
    render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
    const preview = screen.getByTestId('json-preview');

    act(() => {
      capturedOnToggle?.('p1');
    });
    expect(preview.getAttribute('data-collapsed')).toBe('p1');

    act(() => {
      capturedOnToggle?.('p1');
    });
    expect(preview).toHaveAttribute('data-collapsed', '');
  });

  it('renders RESPONSE BODY when responseBody is invalid JSON (tree is null)', () => {
    render(<ResponseDetailModal result={makeResult({ responseBody: 'not-json' })} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'RESPONSE BODY' })).toBeTruthy();
    expect(screen.getByTestId('json-preview')).toBeTruthy();
  });
});
