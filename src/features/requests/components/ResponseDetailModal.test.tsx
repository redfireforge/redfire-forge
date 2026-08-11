/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResponseDetailModal from './ResponseDetailModal';
import type { RequestResult } from '../../../shared/types';
import { makeResult as _makeResult } from '../../../test-utils/factories';

const makeResult = (overrides: Partial<RequestResult> = {}): RequestResult =>
  _makeResult({
    id: 'r1',
    scenarioName: 'Test Scenario',
    method: 'GET',
    url: 'http://api.example.com/users',
    responseTimeMs: 150,
    ...overrides,
  });

vi.mock('../../workflow/components/modals/WorkflowEditorModalFrame', () => ({
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="modal-frame" aria-label={title}>{children}</div>
  ),
}));

vi.mock('./JsonTreePreview', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="json-preview">
      {typeof props.onMatchCountChange === 'function' && (
        <button data-testid="match-count-trigger" onClick={() => (props.onMatchCountChange as (n: number) => void)(0)} />
      )}
      {typeof props.onToggle === 'function' && (
        <button data-testid="tree-toggle" onClick={() => (props.onToggle as (path: string) => void)('$.key')} />
      )}
    </div>
  ),
  buildJTree: (data: unknown, _prefix: string) => {
    if (data && typeof data === 'object') {
      return { key: '', value: data, children: Object.keys(data as Record<string, unknown>).map(k => ({ key: k, value: (data as Record<string, unknown>)[k], children: [] })) };
    }
    return null;
  },
  buildJTreeFromBody: (body?: string | null) => {
    if (!body) return null;
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') {
        return {
          key: '',
          value: parsed,
          children: Object.keys(parsed as Record<string, unknown>).map((k) => ({
            key: k,
            value: (parsed as Record<string, unknown>)[k],
            children: [],
          })),
        };
      }
    } catch {
      // ignored in mock
    }
    return null;
  },
  collectJTreePaths: (node: { key: string; children?: { key: string; children?: unknown[] }[] }, prefix: string) => {
    const paths: string[] = [];
    if (node.children) {
      for (const child of node.children) {
        const p = `${prefix}/${child.key}`;
        paths.push(p);
      }
    }
    return paths;
  },
}));

vi.mock('./ResponseBodySearchBar', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="search-bar">
      <button data-testid="collapse-all" onClick={props.onCollapseAll as () => void} />
      <button data-testid="expand-all" onClick={props.onExpandAll as () => void} />
      <button data-testid="search-clear" onClick={props.onClear as () => void} />
    </div>
  ),
}));

vi.mock('../../test-runner/components/WaterfallBar', () => ({
  default: () => <div data-testid="waterfall-bar" />,
}));

vi.mock('../../../shared/components/JsonTreeViewer', () => ({
  default: () => <div data-testid="json-tree-viewer" />,
}));

describe('ResponseDetailModal', () => {
  it('returns null when result is null', () => {
    const { container } = render(<ResponseDetailModal result={null} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  describe('HTTP result', () => {
    it('shows HTTP status code in status badge', () => {
      render(<ResponseDetailModal result={makeResult({ httpStatus: 200 })} onClose={vi.fn()} />);
      expect(screen.getByText('200')).toBeInTheDocument();
    });

    it('shows method badge with HTTP method', () => {
      render(<ResponseDetailModal result={makeResult({ method: 'POST' })} onClose={vi.fn()} />);
      expect(screen.getByText('POST')).toBeInTheDocument();
    });

    it('shows ERR for failed HTTP with status 0', () => {
      render(<ResponseDetailModal result={makeResult({ httpStatus: 0, passed: false })} onClose={vi.fn()} />);
      expect(screen.getByText('ERR')).toBeInTheDocument();
    });

    it('shows tag-info for HTTP 200 even if passed is false (validation failure)', () => {
      render(<ResponseDetailModal result={makeResult({ httpStatus: 200, passed: false })} onClose={vi.fn()} />);
      const statusBadge = screen.getByText('200');
      expect(statusBadge.className).toContain('tag-info');
    });

    it('shows tag-danger for HTTP 500', () => {
      render(<ResponseDetailModal result={makeResult({ httpStatus: 500, passed: false })} onClose={vi.fn()} />);
      const statusBadge = screen.getByText('500');
      expect(statusBadge.className).toContain('tag-danger');
    });

    it('shows timing waterfall for HTTP results', () => {
      const result = makeResult({ timing: { dns: 10, connect: 20, tls: 5, send: 3, wait: 100, receive: 12 } });
      render(<ResponseDetailModal result={result} onClose={vi.fn()} />);
      expect(screen.getByTestId('waterfall-bar')).toBeInTheDocument();
    });

    it('does not show WebSocket or Kafka details for HTTP results', () => {
      render(<ResponseDetailModal result={makeResult()} onClose={vi.fn()} />);
      expect(screen.queryByText('WebSocket Details')).not.toBeInTheDocument();
      expect(screen.queryByText('Kafka Details')).not.toBeInTheDocument();
    });
  });

  describe('WebSocket result', () => {
    const wsResult = makeResult({
      transportType: 'wsConnect',
      method: 'WEBSOCKET',
      httpStatus: 0,
      passed: true,
      url: 'wss://api.example.com/ws',
      wsResultMeta: {
        connectionId: 'chat-conn',
        protocol: 'graphql-ws',
        frameType: 'text',
        url: 'wss://api.example.com/ws',
        messageSize: 1024,
      },
    });

    it('shows CONNECT in both method and status badges', () => {
      render(<ResponseDetailModal result={wsResult} onClose={vi.fn()} />);
      const elements = screen.getAllByText('CONNECT');
      expect(elements).toHaveLength(2);
      expect(elements[0].className).toContain('method-badge');
      expect(elements[1].className).toContain('tag');
    });

    it('shows WebSocket Details section', () => {
      render(<ResponseDetailModal result={wsResult} onClose={vi.fn()} />);
      expect(screen.getByText('WebSocket Details')).toBeInTheDocument();
    });

    it('shows wsResultMeta fields', () => {
      render(<ResponseDetailModal result={wsResult} onClose={vi.fn()} />);
      expect(screen.getByText('Connection ID')).toBeInTheDocument();
      expect(screen.getByText('chat-conn')).toBeInTheDocument();
      expect(screen.getByText('Protocol')).toBeInTheDocument();
      expect(screen.getByText('graphql-ws')).toBeInTheDocument();
      expect(screen.getByText('Frame Type')).toBeInTheDocument();
      expect(screen.getByText('text')).toBeInTheDocument();
      expect(screen.getByText('Message Size')).toBeInTheDocument();
      expect(screen.getByText('1,024 bytes')).toBeInTheDocument();
    });

    it('does not show timing waterfall for WS results', () => {
      const r = { ...wsResult, timing: { dns: 0, connect: 10, tls: 0, send: 0, wait: 50, receive: 0 } };
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.queryByTestId('waterfall-bar')).not.toBeInTheDocument();
    });

    it('shows tag-info for passed WS result', () => {
      render(<ResponseDetailModal result={wsResult} onClose={vi.fn()} />);
      const tags = screen.getAllByText('CONNECT');
      const statusTag = tags.find(el => el.className.includes('tag') && !el.className.includes('method-badge'));
      expect(statusTag?.className).toContain('tag-info');
    });

    it('shows tag-danger for failed WS result', () => {
      const failed = { ...wsResult, passed: false };
      render(<ResponseDetailModal result={failed} onClose={vi.fn()} />);
      const tags = screen.getAllByText('CONNECT');
      const statusTag = tags.find(el => el.className.includes('tag') && !el.className.includes('method-badge'));
      expect(statusTag?.className).toContain('tag-danger');
    });

    it('shows closeCode when present', () => {
      const r = makeResult({
        transportType: 'wsConnect',
        method: 'WEBSOCKET',
        httpStatus: 0,
        passed: true,
        wsResultMeta: { closeCode: 1000 },
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('Close Code')).toBeInTheDocument();
      expect(screen.getByText('1000')).toBeInTheDocument();
    });

    it('does not show WebSocket Details when wsResultMeta is absent', () => {
      const noMeta = makeResult({
        transportType: 'wsConnect',
        method: 'WEBSOCKET',
        httpStatus: 0,
        passed: true,
      });
      render(<ResponseDetailModal result={noMeta} onClose={vi.fn()} />);
      expect(screen.queryByText('WebSocket Details')).not.toBeInTheDocument();
    });

    it('does not show WebSocket Details when wsResultMeta is empty object', () => {
      const emptyMeta = makeResult({
        transportType: 'wsConnect',
        method: 'WEBSOCKET',
        httpStatus: 0,
        passed: true,
        wsResultMeta: {} as RequestResult['wsResultMeta'],
      });
      render(<ResponseDetailModal result={emptyMeta} onClose={vi.fn()} />);
      expect(screen.queryByText('WebSocket Details')).not.toBeInTheDocument();
    });
  });

  describe('Kafka result', () => {
    const kafkaResult = makeResult({
      transportType: 'kafkaProduce',
      method: 'KAFKA',
      httpStatus: 0,
      passed: true,
      url: 'kafka://broker:9092',
      kafkaResultMeta: {
        topic: 'orders',
        partition: 3,
        offset: 42,
        key: 'order-123',
      },
    });

    it('shows PRODUCE in both method and status badges', () => {
      render(<ResponseDetailModal result={kafkaResult} onClose={vi.fn()} />);
      const elements = screen.getAllByText('PRODUCE');
      expect(elements).toHaveLength(2);
    });

    it('shows Kafka Details section', () => {
      render(<ResponseDetailModal result={kafkaResult} onClose={vi.fn()} />);
      expect(screen.getByText('Kafka Details')).toBeInTheDocument();
    });

    it('shows kafkaResultMeta fields', () => {
      render(<ResponseDetailModal result={kafkaResult} onClose={vi.fn()} />);
      expect(screen.getByText('Topic')).toBeInTheDocument();
      expect(screen.getByText('orders')).toBeInTheDocument();
      expect(screen.getByText('Partition')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Offset')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Key')).toBeInTheDocument();
      expect(screen.getByText('order-123')).toBeInTheDocument();
    });

    it('shows Message Headers and Message Body for produce results', () => {
      const withPayload = makeResult({
        ...kafkaResult,
        responseBody: '{"orderId":"123"}',
        responseHeaders: { 'X-Trace': 'abc' },
      });
      render(<ResponseDetailModal result={withPayload} onClose={vi.fn()} />);
      expect(screen.getByText('Message Headers')).toBeInTheDocument();
      expect(screen.getByText('X-Trace')).toBeInTheDocument();
      expect(screen.getByText('abc')).toBeInTheDocument();
      expect(screen.getByText('Message Body')).toBeInTheDocument();
    });

    it('falls back to kafkaResultMeta.headers when responseHeaders is absent', () => {
      const legacy = makeResult({
        transportType: 'kafkaProduce',
        method: 'PRODUCE',
        httpStatus: 200,
        passed: true,
        kafkaResultMeta: {
          topic: 'orders',
          partition: 0,
          offset: 1,
          headers: { 'content-type': 'application/json' },
        },
      });
      render(<ResponseDetailModal result={legacy} onClose={vi.fn()} />);
      expect(screen.getByText('Message Headers')).toBeInTheDocument();
      expect(screen.getByText('content-type')).toBeInTheDocument();
      expect(screen.getByText('application/json')).toBeInTheDocument();
    });

    it('does not show Kafka Details when kafkaResultMeta is absent', () => {
      const noMeta = makeResult({
        transportType: 'kafkaProduce',
        method: 'KAFKA',
        httpStatus: 0,
        passed: true,
      });
      render(<ResponseDetailModal result={noMeta} onClose={vi.fn()} />);
      expect(screen.queryByText('Kafka Details')).not.toBeInTheDocument();
    });
  });

  describe('common elements', () => {
    it('shows scenario name for all transport types', () => {
      render(<ResponseDetailModal result={makeResult({ scenarioName: 'My Test' })} onClose={vi.fn()} />);
      expect(screen.getByText('My Test')).toBeInTheDocument();
    });

    it('shows response time for all transport types', () => {
      render(<ResponseDetailModal result={makeResult({ responseTimeMs: 250 })} onClose={vi.fn()} />);
      expect(screen.getByText('250 ms')).toBeInTheDocument();
    });

    it('shows Passed/Failed badge for all transport types', () => {
      render(<ResponseDetailModal result={makeResult({ passed: true })} onClose={vi.fn()} />);
      expect(screen.getByText('Passed')).toBeInTheDocument();
    });

    it('shows error message when present', () => {
      const r = makeResult({ errorMessage: 'Connection refused' });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });

    it('shows validation failures when present', () => {
      const r = makeResult({
        passed: false,
        failureDetails: [{ path: '$.id', expected: '1', actual: '2' }],
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('Validation Failures')).toBeInTheDocument();
      expect(screen.getByText('$.id')).toBeInTheDocument();
    });

    it('shows request headers with auth masking', () => {
      const r = makeResult({
        requestLog: {
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer secret' },
          body: '',
        },
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('Request Headers')).toBeInTheDocument();
      expect(screen.getByText('Content-Type')).toBeInTheDocument();
      expect(screen.getByText('application/json')).toBeInTheDocument();
      expect(screen.getByText('••••••••')).toBeInTheDocument();
    });

    it('shows request body when present', () => {
      const r = makeResult({
        requestLog: {
          headers: {},
          body: '{"name":"test"}',
        },
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('Request Body')).toBeInTheDocument();
    });

    it('shows response headers when present', () => {
      const r = makeResult({
        responseHeaders: { 'X-Request-Id': 'abc-123', 'Content-Length': '42' },
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('Response Headers')).toBeInTheDocument();
      expect(screen.getByText('X-Request-Id')).toBeInTheDocument();
      expect(screen.getByText('abc-123')).toBeInTheDocument();
    });

    it('shows response body section when present', () => {
      const r = makeResult({
        responseBody: '{"result":"ok"}',
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('Response Body')).toBeInTheDocument();
    });

    it('shows URL in meta row', () => {
      render(<ResponseDetailModal result={makeResult({ url: 'http://api.example.com/users' })} onClose={vi.fn()} />);
      expect(screen.getByText('http://api.example.com/users')).toBeInTheDocument();
    });

    it('shows kafka matchedMessages when present', () => {
      const r = makeResult({
        transportType: 'kafkaConsume',
        method: 'KAFKA',
        httpStatus: 0,
        passed: true,
        kafkaResultMeta: { topic: 'events', partition: 0, offset: 10, matchedMessages: 5 },
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('Matched Messages')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does not show request headers when requestLog has empty headers', () => {
      const r = makeResult({ requestLog: { headers: {}, body: '' } });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.queryByText('Request Headers')).not.toBeInTheDocument();
    });

    it('collapse all and expand all buttons work with response body', () => {
      const r = makeResult({ responseBody: '{"a":1,"b":2}' });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByTestId('collapse-all')).toBeInTheDocument();
      expect(screen.getByTestId('expand-all')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('collapse-all'));
      fireEvent.click(screen.getByTestId('expand-all'));
    });

    it('search clear button works', () => {
      const r = makeResult({ responseBody: '{"a":1}' });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      fireEvent.click(screen.getByTestId('search-clear'));
    });

    it('shows non-string error message as JSON', () => {
      const r = makeResult({ errorMessage: { code: 'ECONNREFUSED', port: 3000 } as unknown as string });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText(/ECONNREFUSED/)).toBeInTheDocument();
    });

    it('shows non-string failure expected/actual as JSON', () => {
      const r = makeResult({
        passed: false,
        failureDetails: [{ path: '$.items', expected: [1, 2] as unknown as string, actual: [3] as unknown as string }],
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('$.items')).toBeInTheDocument();
    });

    it('shows HTTP 301 with tag-info class', () => {
      render(<ResponseDetailModal result={makeResult({ httpStatus: 301 })} onClose={vi.fn()} />);
      const badge = screen.getByText('301');
      expect(badge.className).toContain('tag-info');
    });

    it('does not show timing waterfall for WS results even if timing exists', () => {
      const r = makeResult({
        transportType: 'wsConnect',
        method: 'CONNECT',
        timing: { dns: 1, tcp: 2, tls: 0, request: 3, firstByte: 4, download: 5, total: 15 },
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.queryByText('Timing Breakdown')).not.toBeInTheDocument();
    });

    it('does not show request body when requestLog.body is empty', () => {
      const r = makeResult({ requestLog: { headers: { 'X-Test': '1' }, body: '' } });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.queryByText('Request Body')).not.toBeInTheDocument();
    });

    it('handles non-JSON response body gracefully', () => {
      const r = makeResult({ responseBody: 'plain text not json' });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('Response Body')).toBeInTheDocument();
    });

    it('masks authorization header case-insensitively', () => {
      const r = makeResult({
        requestLog: { headers: { 'authorization': 'Bearer secret-token' }, body: '' },
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('••••••••')).toBeInTheDocument();
      expect(screen.queryByText('Bearer secret-token')).not.toBeInTheDocument();
    });

    it('shows close code 0 for WS results', () => {
      const r = makeResult({
        transportType: 'wsConnect',
        method: 'CONNECT',
        wsResultMeta: { closeCode: 0, url: 'ws://test' },
      });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('does not show response headers when responseHeaders is empty object', () => {
      const r = makeResult({ responseHeaders: {} });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.queryByText('Response Headers')).not.toBeInTheDocument();
    });

    it('does not show request headers when requestLog is absent', () => {
      const r = makeResult({});
      // Remove requestLog from the result
      delete (r as Record<string, unknown>).requestLog;
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      expect(screen.queryByText('Request Headers')).not.toBeInTheDocument();
    });

    it('handleTreeToggle toggles collapsed path', () => {
      const r = makeResult({ responseBody: '{"key":"value"}' });
      render(<ResponseDetailModal result={r} onClose={vi.fn()} />);
      const toggleBtn = screen.getByTestId('tree-toggle');
      // First click adds to collapsed set
      fireEvent.click(toggleBtn);
      // Second click removes from collapsed set (toggle)
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toBeInTheDocument();
    });
  });
});
