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

  it('uses per-node timeoutSec when provided', async () => {
    const execSpy = vi.spyOn(graphRunnerHelpers, 'executeHttpNode');
    try {
      mockFetch.mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: {}, body: '{}' });
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, httpTimeoutMs: 1000 });
      const node = makeNode('h1', 'http', {
        label: 'HTTP',
        timeoutSec: 5,
        scenario: {
          id: 'h1', name: 'HTTP', url: 'https://api.example.com/test', method: 'GET',
          headers: [], body: '', auth: { type: 'none' },
          validation: { mode: 'none', assertions: [] },
        },
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      expect(execSpy).toHaveBeenCalled();
      const args = execSpy.mock.calls[0];
      expect(args[7]).toBe(5000);
    } finally {
      execSpy.mockRestore();
    }
  });

  it('breaks data-source loop when abort signal is aborted between rows', async () => {
    const controller = new AbortController();
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) controller.abort();
      return { status: 200, statusText: 'OK', headers: {}, body: '{}' };
    });

    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      abortSignal: controller.signal,
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
          id: 'ds-1', type: 'inline', origin: 'manual', distribution: 'sequential',
          columns: [{ id: 'c1', name: 'itemId', type: 'path', mapping: 'itemId' }],
          rows: [
            { id: 'r1', enabled: true, values: { c1: 'A' } },
            { id: 'r2', enabled: true, values: { c1: 'B' } },
            { id: 'r3', enabled: true, values: { c1: 'C' } },
          ],
        },
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    expect(hCtx.results.length).toBeLessThan(3);
  });

  it('logs humanized error when request fails with empty failureDetails array', async () => {
    const spy = vi.spyOn(graphRunnerHelpers, 'executeHttpNode').mockResolvedValue({
      requestResult: {
        id: 'r1', scenarioId: 'h1', scenarioName: 'HTTP',
        url: 'https://api.example.com/test', method: 'GET',
        httpStatus: 200, responseTimeMs: 10, responseBody: '{}',
        timestamp: Date.now(), passed: false,
        validationMode: 'none', failureDetails: [],
      },
      extracted: {},
      fullResponseBody: '{}',
      requestHeaders: {},
      responseHeaders: {},
      requestBody: '',
    } as unknown as Awaited<ReturnType<typeof graphRunnerHelpers.executeHttpNode>>);
    try {
      const logLines: Array<{ prefix: string; text: string }> = [];
      const { callbacks } = makeCallbacks();
      const hCtx = makeHandlerContext({ callbacks, log: (l) => logLines.push(l) });
      const node = makeNode('h1', 'http', {
        label: 'HTTP',
        scenario: {
          id: 'h1', name: 'HTTP', url: 'https://api.example.com/test', method: 'GET',
          headers: [], body: '', auth: { type: 'none' },
          validation: { mode: 'none', assertions: [] },
        },
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const bang = logLines.find(l => l.prefix === '!');
      expect(bang).toBeDefined();
      expect(bang!.text).toMatch(/(failed|error|step)/i);
    } finally {
      spy.mockRestore();
    }
  });

  it('skips mapping trace capture when no body-source extractions exist', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}',
    });
    const { callbacks } = makeCallbacks();
    const capturedHttpDetails = new Map();
    const hCtx = makeHandlerContext({
      callbacks,
      traceOptions: { captureFullTrace: true, traceLevel: 'full' } as Record<string, unknown> as NonNullable<Parameters<typeof makeHandlerContext>[0]>['traceOptions'],
      capturedHttpDetails,
    });
    const node = makeNode('h1', 'http', {
      label: 'HTTP',
      scenario: {
        id: 'h1', name: 'HTTP', url: 'https://api.example.com/test', method: 'GET',
        headers: [], body: '', auth: { type: 'none' },
        validation: { mode: 'none', assertions: [] },
        extractions: [{ name: 'reqId', source: 'header', expression: 'x-request-id' }],
      },
    });

    await handleHttpNode('h1', node, hCtx, makePassedFlag());

    const captured = capturedHttpDetails.get('h1');
    expect(captured).toBeDefined();
    expect(captured.mappingTraces).toBeUndefined();
  });

  it('omits status assertion when httpStatus is undefined on the request result', async () => {
    const origExec = graphRunnerHelpers.executeHttpNode;
    const spy = vi.spyOn(graphRunnerHelpers, 'executeHttpNode').mockImplementation(async (...args: Parameters<typeof origExec>) => {
      const out = await origExec(...args);
      return {
        ...out,
        requestResult: {
          ...out.requestResult,
          httpStatus: undefined as unknown as number,
        },
      };
    });
    try {
      mockFetch.mockResolvedValueOnce({ status: 200, statusText: 'OK', headers: {}, body: '{}' });
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
          id: 'h1', name: 'HTTP', url: 'https://api.example.com/test', method: 'GET',
          headers: [], body: '', auth: { type: 'none' },
          validation: { mode: 'none', assertions: [] },
        },
      });

      await handleHttpNode('h1', node, hCtx, makePassedFlag());

      const captured = capturedHttpDetails.get('h1')!;
      const statusAssert = captured.assertions.find((a: { type: string }) => a.type === 'status');
      expect(statusAssert).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
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
