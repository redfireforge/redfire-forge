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
import { handleHttpNode } from './graphRunnerNodeHandlers';
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
});
