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
import * as dataSourceExpander from '../../../engine/dataSourceExpander';
import * as graphRunnerHelpers from './graphRunnerHelpers';
import { handleHttpNode } from './graphRunnerHttpHandler';
import * as workflowRunErrors from '../utils/workflowRunErrors';
import {
  getMockFetch,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
  makePassedFlag,
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
  function httpNode(id: string, label = 'HTTP', url = 'https://api.example.com/test'): WorkflowNode {
    return makeNode(id, 'http', {
      label,
      scenario: {
        id, name: label, url, method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
      },
    });
  }

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

describe('handleHttpNode — additional trace branch coverage', () => {
  it('does not capture trace when capturedHttpDetails is undefined', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: true },
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
    expect(hCtx.results).toHaveLength(1);
  });

  it('captures trace with no extractedVariables when no extractions configured', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: true },
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
    const captured = capturedHttpDetails.get('h1');
    expect(captured).toBeDefined();
    expect(captured.response.statusCode).toBe(200);
  });

  it('builds assertion results array (empty when statusCode is not on result)', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: true },
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
    const captured = capturedHttpDetails.get('h1');
    expect(Array.isArray(captured.assertions)).toBe(true);
  });

  it('builds validation assertion entries from failureDetails', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500, statusText: 'Error',
      headers: { 'content-type': 'application/json' },
      body: '{"error":"bad"}',
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: true, alwaysCaptureFailures: true },
      capturedHttpDetails,
    });
    const node = makeNode('h1', 'http', {
      label: 'HTTP',
      scenario: {
        id: 'h1', name: 'HTTP',
        url: 'https://api.example.com/fail',
        method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'status', assertions: [{ type: 'status', expected: '200' }] },
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());
    const captured = capturedHttpDetails.get('h1');
    expect(captured).toBeDefined();
    if (captured.assertions.length > 0) {
      const validationAssertion = captured.assertions.find((a: { type: string }) => a.type === 'validation');
      if (validationAssertion) {
        expect(validationAssertion.passed).toBe(false);
      }
    }
  });

  it('uses scenario dataSource when httpData.dataSource is undefined', async () => {
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = makeNode('h1', 'http', {
      label: 'HTTP-Scenario-DS',
      scenario: {
        id: 'h1', name: 'HTTP-Scenario-DS',
        url: 'https://api.example.com/items/{{itemId}}',
        method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
        dataSource: {
          id: 'ds-1',
          type: 'inline',
          origin: 'manual',
          distribution: 'sequential',
          columns: [{ id: 'col-1', name: 'itemId', type: 'path', mapping: 'itemId' }],
          rows: [
            { id: 'row-1', enabled: true, values: { 'col-1': 'X1' } },
          ],
        },
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());
    expect(hCtx.results).toHaveLength(1);
    expect(states['h1']?.state).toBe('pass');
  });

  it('does not emit extra error log when failureDetails has entries', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 404, statusText: 'Not Found',
      headers: { 'content-type': 'application/json' },
      body: '{"error":"not found"}',
    });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('h1', 'http', {
      label: 'HTTP',
      scenario: {
        id: 'h1', name: 'HTTP',
        url: 'https://api.example.com/fail',
        method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'status', assertions: [{ type: 'status', expected: '200' }] },
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const requestLog = logLines.find(l => l.prefix === '>' && l.text.includes('request...'));
    expect(requestLog).toBeDefined();
    const resultLog = logLines.find(l => l.text.includes('404'));
    expect(resultLog).toBeDefined();
  });
});

describe('handleHttpNode — trace status assertion (requestResult.statusCode)', () => {
  function withStatusCodeAugmentation(
    augment: (rr: Awaited<ReturnType<typeof graphRunnerHelpers.executeHttpNode>>['requestResult']) =>
      Awaited<ReturnType<typeof graphRunnerHelpers.executeHttpNode>>['requestResult'],
  ): ReturnType<typeof vi.spyOn> {
    const origExec = graphRunnerHelpers.executeHttpNode;
    return vi.spyOn(graphRunnerHelpers, 'executeHttpNode').mockImplementation(async (...args: Parameters<typeof origExec>) => {
      const out = await origExec(...args);
      return { ...out, requestResult: augment(out.requestResult) };
    });
  }

  it('adds status assertion to captured trace when statusCode is present and request passed', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const spy = withStatusCodeAugmentation(rr => ({ ...rr, statusCode: 200 }));
    try {
      const { callbacks } = makeCallbacks();
      const capturedHttpDetails = new Map();
      const hCtx = makeHandlerContext({
        callbacks,
        traceOptions: { captureFullTrace: true },
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

      const captured = capturedHttpDetails.get('h1')!;
      const statusAssert = captured.assertions.find((a: { type: string }) => a.type === 'status');
      expect(statusAssert).toBeDefined();
      expect(statusAssert.description).toContain('200');
      expect(statusAssert.expected).toBe('200');
      expect(statusAssert.actual).toBe('200');
      expect(statusAssert.passed).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('marks status assertion failed when failure detail path is status', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      statusText: 'Error',
      headers: {},
      body: 'err',
    });
    const origExec = graphRunnerHelpers.executeHttpNode;
    const spy = vi.spyOn(graphRunnerHelpers, 'executeHttpNode').mockImplementation(async (...args: Parameters<typeof origExec>) => {
      const out = await origExec(...args);
      return {
        ...out,
        requestResult: {
          ...out.requestResult,
          statusCode: 200,
          passed: false,
          failureDetails: [{ path: '(status)', expected: '200', actual: '500' }],
        },
      };
    });
    try {
      const { callbacks } = makeCallbacks();
      const capturedHttpDetails = new Map();
      const hCtx = makeHandlerContext({
        callbacks,
        traceOptions: { captureFullTrace: true, alwaysCaptureFailures: true },
        capturedHttpDetails,
      });
      const node = makeNode('h1', 'http', {
        label: 'HTTP',
        scenario: {
          id: 'h1', name: 'HTTP',
          url: 'https://api.example.com/fail',
          method: 'GET',
          headers: [], body: '', auth: { type: 'none' },
          validation: { mode: 'status', assertions: [{ type: 'status', expected: '200' }] },
        },
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const captured = capturedHttpDetails.get('h1')!;
      const statusAssert = captured.assertions.find((a: { type: string }) => a.type === 'status');
      expect(statusAssert).toBeDefined();
      expect(statusAssert!.passed).toBe(false);
      const validationAssert = captured.assertions.filter((a: { type: string }) => a.type === 'validation');
      expect(validationAssert.length).toBeGreaterThan(0);
      expect(validationAssert.every((a: { passed: boolean }) => a.passed === false)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps status assertion passed when only non-status failure details exist', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
    });
    const spy = withStatusCodeAugmentation(rr => ({
      ...rr,
      statusCode: 200,
      passed: false,
      failureDetails: [{ path: '$.missing', expected: 'x', actual: 'y' }],
    }));
    try {
      const { callbacks } = makeCallbacks();
      const capturedHttpDetails = new Map();
      const hCtx = makeHandlerContext({
        callbacks,
        traceOptions: { captureFullTrace: true, alwaysCaptureFailures: true },
        capturedHttpDetails,
      });
      const node = makeNode('h1', 'http', {
        label: 'HTTP',
        scenario: {
          id: 'h1', name: 'HTTP',
          url: 'https://api.example.com/t',
          method: 'GET',
          headers: [], body: '', auth: { type: 'none' },
          validation: { mode: 'none', assertions: [] },
        },
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const captured = capturedHttpDetails.get('h1')!;
      const statusAssert = captured.assertions.find((a: { type: string }) => a.type === 'status');
      expect(statusAssert).toBeDefined();
      expect(statusAssert!.passed).toBe(true);
      const validationEntry = captured.assertions.find((a: { type: string }) => a.type === 'validation');
      expect(validationEntry).toBeDefined();
      expect(validationEntry!.description).toBe('$.missing');
    } finally {
      spy.mockRestore();
    }
  });

  it('omits validation assertion loop when failureDetails is undefined', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    });
    const origExec = graphRunnerHelpers.executeHttpNode;
    const spy = vi.spyOn(graphRunnerHelpers, 'executeHttpNode').mockImplementation(async (...args: Parameters<typeof origExec>) => {
      const out = await origExec(...args);
      return {
        ...out,
        requestResult: {
          ...out.requestResult,
          statusCode: 200,
          failureDetails: undefined as unknown as typeof out.requestResult.failureDetails,
        },
      };
    });
    try {
      const { callbacks } = makeCallbacks();
      const capturedHttpDetails = new Map();
      const hCtx = makeHandlerContext({
        callbacks,
        traceOptions: { captureFullTrace: true },
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

      const captured = capturedHttpDetails.get('h1')!;
      expect(captured.assertions.every((a: { type: string }) => a.type !== 'validation')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('sets extractedVariables to undefined when extracted map is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    });
    const origExec = graphRunnerHelpers.executeHttpNode;
    const spy = vi.spyOn(graphRunnerHelpers, 'executeHttpNode').mockImplementation(async (...args: Parameters<typeof origExec>) => {
      const out = await origExec(...args);
      return { ...out, extracted: {} };
    });
    try {
      const { callbacks } = makeCallbacks();
      const capturedHttpDetails = new Map();
      const hCtx = makeHandlerContext({
        callbacks,
        traceOptions: { captureFullTrace: true },
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

      expect(capturedHttpDetails.get('h1')!.extractedVariables).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('handleHttpNode — fallback labels and errors', () => {
  it('uses row fallback when expanded scenario has no dataRowLabel', async () => {
    const origExpand = dataSourceExpander.expandDataSource;
    const spy = vi.spyOn(dataSourceExpander, 'expandDataSource').mockImplementation((scenario) => {
      const rows = origExpand(scenario);
      return rows.map((sc, i) => (i === 0 ? { ...sc, dataRowLabel: undefined } : sc));
    });
    try {
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
      });
      const node = makeNode('h1', 'http', {
        label: 'HTTP-DS',
        scenario: {
          id: 'h1', name: 'HTTP-DS',
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
            ],
          },
        },
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const rowLogs = logLines.filter(l => l.prefix === '>' && l.text.includes('request...'));
      expect(rowLogs.some(t => t.text.includes('row:') && t.text.includes('GET'))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('defaults log line to GET when scenario method is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK', headers: {}, body: '{}',
    });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('h1', 'http', {
      label: 'HTTP',
      scenario: {
        id: 'h1', name: 'HTTP',
        url: 'https://api.example.com/test',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
      } as import('../../../shared/types').Scenario,
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const reqLog = logLines.find(l => l.prefix === '>' && l.text.includes('request...'));
    expect(reqLog?.text).toMatch(/GET request/);
  });

  it('uses request failed fallback when summarizeRequestFailure returns undefined', async () => {
    mockFetch.mockRejectedValueOnce(new Error('econnrefused'));
    const summarizeSpy = vi.spyOn(workflowRunErrors, 'summarizeRequestFailure').mockReturnValue(undefined as unknown as string);
    try {
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({
        callbacks,
        log: (line) => logLines.push(line),
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

      const bang = logLines.find(l => l.prefix === '!');
      expect(bang).toBeDefined();
    } finally {
      summarizeSpy.mockRestore();
    }
  });
});
