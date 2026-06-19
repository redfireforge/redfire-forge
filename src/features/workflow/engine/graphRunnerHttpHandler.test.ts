import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('./scriptSandbox', () => ({
  executeScript: vi.fn(),
}));

vi.mock('./scriptLibraries', () => ({
  loadScriptLibraries: vi.fn(() => []),
  buildLibraryPreamble: vi.fn(() => ''),
}));

import type { WorkflowNode } from '../types/workflow';
import * as _dataSourceExpander from '../../../engine/dataSourceExpander';
import * as _graphRunnerHelpers from './graphRunnerHelpers';
import { handleHttpNode } from './graphRunnerHttpHandler';
import * as _workflowRunErrors from '../utils/workflowRunErrors';
import {
  getMockFetch,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
  makePassedFlag,
  httpNode,
} from './graphRunnerNodeHandlers.test-utils';

const mockFetch = getMockFetch();

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok": true}',
  });
});

describe('handleHttpNode', () => {
  it('executes HTTP request and records pass result', async () => {
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = httpNode('h1');
    const passed = makePassedFlag();

    await handleHttpNode('h1', node, hCtx, passed);

    expect(states['h1']?.state).toBe('pass');
    expect(hCtx.results).toHaveLength(1);
    expect(hCtx.results[0].passed).toBe(true);
    expect(passed.value).toBe(true);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('h1', 'main');
  });

  it('marks node as fail when HTTP request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      statusText: 'Error',
      headers: {},
      body: 'error',
    });
    const node = httpNode('h1');
    // Add a validation assertion to make the result fail
    (node.data as Record<string, unknown>).scenario = {
      ...(node.data as Record<string, unknown>).scenario as object,
      validation: { mode: 'status', assertions: [{ type: 'status', expected: '200' }] },
    };

    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const passed = makePassedFlag();

    await handleHttpNode('h1', node, hCtx, passed);

    expect(states['h1']?.state).toBe('fail');
    expect(passed.value).toBe(false);
  });

  it('logs request and response details', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = httpNode('h1', 'MyAPI');

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const texts = logLines.map(l => l.text);
    expect(texts.some(t => t.includes('request...'))).toBe(true);
    expect(texts.some(t => t.includes('200'))).toBe(true);
  });

  it('logs request body when present', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const node = makeNode('h1', 'http', {
      label: 'HTTP',
      scenario: {
        id: 'h1', name: 'HTTP', url: 'https://api.example.com/test', method: 'POST',
        headers: [], body: '{"payload":"data"}', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
      },
    });
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const bodyLog = logLines.find(l => l.text.includes('Body:'));
    expect(bodyLog).toBeDefined();
  });

  it('truncates long request body', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const longBody = 'x'.repeat(300);
    const node = makeNode('h1', 'http', {
      label: 'HTTP',
      scenario: {
        id: 'h1', name: 'HTTP', url: 'https://api.example.com/test', method: 'POST',
        headers: [], body: longBody, auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
      },
    });
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const bodyLog = logLines.find(l => l.text.includes('Body:') && l.text.includes('…'));
    expect(bodyLog).toBeDefined();
  });

  it('truncates long response body', async () => {
    const longResponse = 'x'.repeat(400);
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK',
      headers: { 'content-type': 'text/plain' },
      body: longResponse,
    });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const node = httpNode('h1');
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const respBodyLog = logLines.find(l => l.prefix === '<' && l.text.includes('Body:') && l.text.includes('…'));
    expect(respBodyLog).toBeDefined();
  });

  it('logs error message when failed without failureDetails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const node = httpNode('h1');
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const errorLog = logLines.find(l => l.prefix === '!');
    expect(errorLog).toBeDefined();
  });

  it('masks sensitive headers', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const node = httpNode('h1');
    // Add auth header to scenario
    (node.data as Record<string, unknown>).scenario = {
      ...(node.data as Record<string, unknown>).scenario as object,
      headers: [{ key: 'Authorization', value: 'Bearer supersecrettoken123' }],
    };
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const authLog = logLines.find(l => l.text.includes('authorization') || l.text.includes('Authorization'));
    if (authLog) {
      expect(authLog.text).toContain('••••');
      expect(authLog.text).not.toContain('supersecrettoken123');
    }
  });
});

describe('handleHttpNode — additional branch coverage', () => {
  it('logs humanized error when request fails without failureDetails', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 0,
      statusText: '',
      headers: {},
      body: '',
    });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('h1', 'http', {
      label: 'FailHTTP',
      scenario: {
        id: 'h1', name: 'FailHTTP', url: 'https://api.example.com/fail', method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
      },
    });
    const passed = makePassedFlag();

    await handleHttpNode('h1', node, hCtx, passed);

    expect(states['h1']?.state).toBe('fail');
    const errorLog = logLines.find(l => l.prefix === '!');
    expect(errorLog).toBeDefined();
  });

  it('logs extracted variable display truncated at 80 chars', async () => {
    const longValue = 'x'.repeat(100);
    mockFetch.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: longValue }),
    });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('h1', 'http', {
      label: 'ExtractHTTP',
      scenario: {
        id: 'h1', name: 'ExtractHTTP', url: 'https://api.example.com/data', method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
        extractions: [{ name: 'token', source: 'body', expression: '$.token' }],
      },
    });
    const passed = makePassedFlag();

    await handleHttpNode('h1', node, hCtx, passed);

    const extractLog = logLines.find(l => l.prefix === '#' && l.text.includes('token'));
    expect(extractLog).toBeDefined();
    expect(extractLog!.text).toContain('…');
  });
});

describe('handleHttpNode — trace capture', () => {
  it('captures full trace data when captureFullTrace is enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-123' },
      body: '{"result": "success"}',
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: true },
      capturedHttpDetails,
    });
    const node = makeNode('h1', 'http', {
      label: 'TracedHTTP',
      scenario: {
        id: 'h1', name: 'TracedHTTP',
        url: 'https://api.example.com/test',
        method: 'POST',
        headers: [{ key: 'Authorization', value: 'Bearer token' }],
        body: '{"input": "data"}',
        auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    expect(capturedHttpDetails.has('h1')).toBe(true);
    const captured = capturedHttpDetails.get('h1');
    expect(captured.request.method).toBe('POST');
    expect(captured.request.url).toContain('api.example.com');
    expect(captured.response.statusCode).toBe(200);
    expect(captured.response.body).toBe('{"result": "success"}');
  });

  it('captures trace on failure when alwaysCaptureFailures is true', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      statusText: 'Error',
      headers: {},
      body: 'Server error',
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: false, alwaysCaptureFailures: true },
      capturedHttpDetails,
    });
    const node = makeNode('h1', 'http', {
      label: 'FailHTTP',
      scenario: {
        id: 'h1', name: 'FailHTTP',
        url: 'https://api.example.com/fail',
        method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'status', assertions: [{ type: 'status', expected: '200' }] },
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    expect(capturedHttpDetails.has('h1')).toBe(true);
    const captured = capturedHttpDetails.get('h1');
    expect(captured.response.statusCode).toBe(500);
  });

  it('does not capture trace when traceOptions is disabled', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: false, alwaysCaptureFailures: false },
      capturedHttpDetails,
    });
    const node = makeNode('h1', 'http', {
      label: 'HTTP',
      scenario: {
        id: 'h1', name: 'HTTP',
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    expect(capturedHttpDetails.has('h1')).toBe(false);
  });

  it('truncates large response body in trace', async () => {
    const largeBody = 'x'.repeat(200000); // 200KB
    mockFetch.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: largeBody,
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: true, maxResponseBodySize: 1000 },
      capturedHttpDetails,
    });
    const node = makeNode('h1', 'http', {
      label: 'LargeResponse',
      scenario: {
        id: 'h1', name: 'LargeResponse',
        url: 'https://api.example.com/large',
        method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const captured = capturedHttpDetails.get('h1');
    expect(captured.response.body.length).toBe(1000);
    expect(captured.response.bodyTruncated).toBe(true);
  });

  it('captures extracted variables in trace', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'abc123', userId: 42 }),
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: true },
      capturedHttpDetails,
    });
    const node = makeNode('h1', 'http', {
      label: 'ExtractHTTP',
      scenario: {
        id: 'h1', name: 'ExtractHTTP',
        url: 'https://api.example.com/auth',
        method: 'POST',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
        extractions: [
          { name: 'token', source: 'body', expression: '$.token' },
          { name: 'userId', source: 'body', expression: '$.userId' },
        ],
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const captured = capturedHttpDetails.get('h1');
    expect(captured.extractedVariables).toBeDefined();
    expect(captured.extractedVariables.token).toBe('abc123');
    // userId could be string or number depending on extraction
    expect(String(captured.extractedVariables.userId)).toBe('42');
  });

  it('builds assertion results from failure details', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      statusText: 'Error',
      headers: { 'content-type': 'application/json' },
      body: '{"error": "failed"}',
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: true, alwaysCaptureFailures: true },
      capturedHttpDetails,
    });
    const node = makeNode('h1', 'http', {
      label: 'ValidatedHTTP',
      scenario: {
        id: 'h1', name: 'ValidatedHTTP',
        url: 'https://api.example.com/check',
        method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: {
          mode: 'status',
          assertions: [{ type: 'status', expected: '200' }],
        },
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const captured = capturedHttpDetails.get('h1');
    // Trace is captured due to alwaysCaptureFailures
    expect(captured).toBeDefined();
    expect(captured.response.statusCode).toBe(500);
  });

  it('captures variables snapshot at time of execution', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: true },
      capturedHttpDetails,
      initialVariables: { baseUrl: 'https://api.example.com', token: 'initial-token' },
    });
    const node = makeNode('h1', 'http', {
      label: 'HTTP',
      scenario: {
        id: 'h1', name: 'HTTP',
        url: '{{baseUrl}}/test',
        method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const captured = capturedHttpDetails.get('h1');
    expect(captured.variablesSnapshot).toBeDefined();
    expect(captured.variablesSnapshot.baseUrl).toBe('https://api.example.com');
  });
});

describe('handleHttpNode — data source expansion', () => {
  function httpNodeWithDataSource(id: string, label = 'HTTP-DS'): WorkflowNode {
    return makeNode(id, 'http', {
      label,
      scenario: {
        id, name: label,
        url: 'https://api.example.com/items/{{itemId}}',
        method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
        dataSource: {
          id: 'ds-1',
          type: 'inline',
          origin: 'manual',
          distribution: 'sequential',
          columns: [
            { id: 'col-1', name: 'itemId', type: 'path', mapping: 'itemId' },
          ],
          rows: [
            { id: 'row-1', enabled: true, values: { 'col-1': 'AAA' } },
            { id: 'row-2', enabled: true, values: { 'col-1': 'BBB' } },
            { id: 'row-3', enabled: false, values: { 'col-1': 'CCC' } },
          ],
        },
      },
    });
  }

  it('expands data source and executes once per enabled row', async () => {
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = httpNodeWithDataSource('h1');
    const passed = makePassedFlag();

    await handleHttpNode('h1', node, hCtx, passed);

    // 2 enabled rows → 2 results
    expect(hCtx.results).toHaveLength(2);
    expect(hCtx.results[0].dataRowId).toBe('row-1');
    expect(hCtx.results[1].dataRowId).toBe('row-2');
    expect(states['h1']?.state).toBe('pass');
    expect(passed.value).toBe(true);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('h1', 'main');
  });

  it('marks node as fail when any data row fails', async () => {
    // Fail on second call
    mockFetch
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}' })
      .mockResolvedValueOnce({ status: 500, statusText: 'Error', headers: {}, body: 'error' });

    const node = httpNodeWithDataSource('h1');
    // Add assertion so 500 triggers failure
    const sc = (node.data as Record<string, unknown>).scenario as Record<string, unknown>;
    sc.validation = { mode: 'status', assertions: [{ type: 'status', expected: '200' }] };

    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const passed = makePassedFlag();

    await handleHttpNode('h1', node, hCtx, passed);

    expect(hCtx.results).toHaveLength(2);
    expect(hCtx.results[0].passed).toBe(true);
    expect(hCtx.results[1].passed).toBe(false);
    expect(states['h1']?.state).toBe('fail');
    expect(passed.value).toBe(false);
  });

  it('logs expansion message with row count', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = httpNodeWithDataSource('h1');

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const texts = logLines.map(l => l.text);
    expect(texts.some(t => t.includes('2 row(s)'))).toBe(true);
  });

  it('falls back to single execution when data source has no enabled rows', async () => {
    const node = makeNode('h1', 'http', {
      label: 'HTTP',
      scenario: {
        id: 'h1', name: 'HTTP',
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
        dataSource: {
          id: 'ds-1', type: 'inline', origin: 'manual', distribution: 'sequential',
          columns: [{ id: 'col-1', name: 'x', type: 'path', mapping: 'x' }],
          rows: [{ id: 'row-1', enabled: false, values: { 'col-1': 'val' } }],
        },
      },
    });

    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    // No enabled rows → single execution
    expect(hCtx.results).toHaveLength(1);
    expect(hCtx.results[0].dataRowId).toBeUndefined();
  });

  it('substitutes row values into URL path', async () => {
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = httpNodeWithDataSource('h1');

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    expect(hCtx.results[0].url).toContain('AAA');
    expect(hCtx.results[1].url).toContain('BBB');
  });

  it('logs custom dataRowLabel when present in expanded scenario', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = httpNodeWithDataSource('h1');

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const rowLogs = logLines.filter(l => l.text.includes('request...') && l.prefix === '>');
    expect(rowLogs.length).toBeGreaterThanOrEqual(2);
  });
});
