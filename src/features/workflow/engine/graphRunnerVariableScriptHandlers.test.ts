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

import {
  handleSetVariableNode,
  handleScriptNode,
  handleAggregateNode,
  handleLogDebugNode,
} from './graphRunnerNodeHandlers';
import {
  getMockFetch,
  getMockExecuteScript,
  makeCtx,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
  makePassedFlag,
} from './graphRunnerNodeHandlers.test-utils';

const mockFetch = getMockFetch();
const mockExecuteScript = getMockExecuteScript();

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok": true}',
  });
});

describe('handleSetVariableNode', () => {
  it('sets variables from assignments', async () => {
    const ctx = makeCtx({ name: 'world' });
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('sv1', 'setVariable', {
      assignments: [
        { name: 'greeting', expression: 'hello {{name}}' },
        { name: 'static', expression: 'constant' },
      ],
    });

    await handleSetVariableNode('sv1', node, hCtx);

    expect(states['sv1']?.state).toBe('pass');
    expect(ctx.resolve('{{greeting}}')).toBe('hello world');
    expect(ctx.resolve('{{static}}')).toBe('constant');
  });

  it('skips assignments without names', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('sv1', 'setVariable', {
      assignments: [{ name: '', expression: 'ignored' }],
    });

    await handleSetVariableNode('sv1', node, hCtx);
  });

  it('handles undefined assignments (uses ?? [] fallback)', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    // No assignments — uses ?? [] fallback
    const node = makeNode('sv1', 'setVariable', {});

    await handleSetVariableNode('sv1', node, hCtx);
    expect(states['sv1']?.state).toBe('pass');
  });
});

// ── handleScriptNode ──
describe('handleScriptNode', () => {
  it('executes script and captures outputs', async () => {
    mockExecuteScript.mockReturnValue({
      success: true,
      outputs: { result: '42' },
      consoleLogs: [],
      error: undefined,
    });

    const ctx = makeCtx({ input: 'test' });
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('sc1', 'script', {
      mode: 'expression',
      inputVariables: ['input'],
      outputVariables: ['result'],
      code: 'return 42',
    });

    await handleScriptNode('sc1', node, hCtx, makePassedFlag());

    expect(states['sc1']?.state).toBe('pass');
    expect(ctx.resolve('{{result}}')).toBe('42');
  });

  it('marks fail on script error', async () => {
    mockExecuteScript.mockReturnValue({
      success: false,
      outputs: {},
      consoleLogs: [],
      error: 'SyntaxError: unexpected token',
    });

    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = makeNode('sc1', 'script', {
      mode: 'expression',
      inputVariables: [],
      outputVariables: [],
      code: 'invalid{{',
    });
    const passed = makePassedFlag();

    await handleScriptNode('sc1', node, hCtx, passed);

    expect(states['sc1']?.state).toBe('fail');
    expect(passed.value).toBe(false);
  });

  it('captures console logs when enabled', async () => {
    mockExecuteScript.mockReturnValue({
      success: true,
      outputs: {},
      consoleLogs: ['hello from script', 'debug info'],
      error: undefined,
    });

    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('sc1', 'script', {
      mode: 'expression',
      inputVariables: [],
      outputVariables: [],
      code: '',
      captureConsole: true,
    });

    await handleScriptNode('sc1', node, hCtx, makePassedFlag());

    expect(logLines.some(l => l.text.includes('hello from script'))).toBe(true);
    expect(logLines.some(l => l.text.includes('debug info'))).toBe(true);
  });

  it('passes library preamble when libraryIds are present', async () => {
    mockExecuteScript.mockReturnValue({
      success: true,
      outputs: {},
      consoleLogs: [],
      error: undefined,
    });

    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = makeNode('sc1', 'script', {
      mode: 'expression',
      inputVariables: [],
      outputVariables: [],
      code: 'return 1',
      libraryIds: ['lib1'],
    });

    await handleScriptNode('sc1', node, hCtx, makePassedFlag());
    // Should call executeScript with a preamble string (3rd argument)
    expect(mockExecuteScript).toHaveBeenCalled();
  });
});

// ── handleAggregateNode ──
describe('handleAggregateNode', () => {
  it('handles concat strategy', async () => {
    const ctx = makeCtx({ source: '"item1"' });
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'collected', sourceExpression: '{{source}}', strategy: 'concat' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(states['a1']?.state).toBe('pass');
    expect(ctx.resolve('{{collected}}')).toBe('["item1"]');
  });

  it('handles sum strategy', async () => {
    const ctx = makeCtx({ amount: '10' });
    ctx.set('total', '5');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'total', sourceExpression: '{{amount}}', strategy: 'sum' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{total}}')).toBe('15');
  });

  it('handles count strategy', async () => {
    const ctx = makeCtx();
    ctx.set('counter', '3');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'counter', sourceExpression: '', strategy: 'count' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{counter}}')).toBe('4');
  });

  it('handles first strategy', async () => {
    const ctx = makeCtx({ val: 'first-value' });
    ctx.set('target', 'already-set');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'target', sourceExpression: '{{val}}', strategy: 'first' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{target}}')).toBe('already-set');
  });

  it('handles last strategy', async () => {
    const ctx = makeCtx({ val: 'latest' });
    ctx.set('target', 'old');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'target', sourceExpression: '{{val}}', strategy: 'last' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{target}}')).toBe('latest');
  });

  it('handles custom strategy', async () => {
    const ctx = makeCtx({ val: 'hello' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'result', sourceExpression: '{{val}}', strategy: 'custom', customExpression: '{{val}}-custom' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{result}}')).toBe('hello-custom');
  });

  it('handles default strategy', async () => {
    const ctx = makeCtx({ val: 'hello' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'result', sourceExpression: '{{val}}', strategy: 'unknown' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{result}}')).toBe('hello');
  });

  it('skips mappings without targetVariable', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: '', sourceExpression: 'val', strategy: 'last' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
  });

  it('first strategy uses source when target not set', async () => {
    const ctx = makeCtx({ val: 'new-value' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'target', sourceExpression: '{{val}}', strategy: 'first' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{target}}')).toBe('new-value');
  });

  it('count strategy starts from 0 when not a number', async () => {
    const ctx = makeCtx();
    ctx.set('counter', 'not-a-number');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'counter', sourceExpression: '', strategy: 'count' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{counter}}')).toBe('1');
  });

  it('sum strategy handles NaN source', async () => {
    const ctx = makeCtx({ amount: 'abc' });
    ctx.set('total', '5');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'total', sourceExpression: '{{amount}}', strategy: 'sum' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{total}}')).toBe('5');
  });

  it('sum strategy handles NaN existing value', async () => {
    const ctx = makeCtx({ amount: '10' });
    ctx.set('total', 'xyz');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'total', sourceExpression: '{{amount}}', strategy: 'sum' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{total}}')).toBe('10');
  });

  it('concat strategy handles non-array existing value', async () => {
    const ctx = makeCtx({ source: '"item2"' });
    ctx.set('collected', 'not-json');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'collected', sourceExpression: '{{source}}', strategy: 'concat' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{collected}}')).toBe('["item2"]');
  });

  it('concat strategy handles non-JSON source', async () => {
    const ctx = makeCtx({ source: 'plain-text' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'collected', sourceExpression: '{{source}}', strategy: 'concat' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{collected}}')).toBe('["plain-text"]');
  });

  it('concat strategy handles existing non-array JSON', async () => {
    const ctx = makeCtx({ source: '"item"' });
    ctx.set('collected', '{"key":"val"}');
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'collected', sourceExpression: '{{source}}', strategy: 'concat' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    // Existing is object (not array), so arr gets reset to []
    expect(ctx.resolve('{{collected}}')).toBe('["item"]');
  });

  it('handles empty mappings array', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', { mappings: [] });

    await handleAggregateNode('a1', node, hCtx);
    expect(states['a1']?.state).toBe('pass');
  });

  it('handles undefined mappings (uses ?? [] fallback)', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {});

    await handleAggregateNode('a1', node, hCtx);
    expect(states['a1']?.state).toBe('pass');
  });

  it('custom strategy without customExpression uses source', async () => {
    const ctx = makeCtx({ val: 'hello' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('a1', 'aggregate', {
      mappings: [
        { targetVariable: 'result', sourceExpression: '{{val}}', strategy: 'custom' },
      ],
    });

    await handleAggregateNode('a1', node, hCtx);
    expect(ctx.resolve('{{result}}')).toBe('hello');
  });
});

// ── handleLogDebugNode ──
describe('handleLogDebugNode', () => {
  it('logs resolved message with level prefix', async () => {
    const ctx = makeCtx({ user: 'Alice' });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('ld1', 'logDebug', {
      message: 'Hello {{user}}!',
      logLevel: 'info',
    });

    await handleLogDebugNode('ld1', node, hCtx);

    expect(states['ld1']?.state).toBe('pass');
    expect(logLines.some(l => l.text.includes('Hello Alice!'))).toBe(true);
    expect(logLines.some(l => l.text.includes('[INFO]'))).toBe(true);
  });

  it('warns about unresolved variables', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('ld1', 'logDebug', {
      message: 'Value is {{undefined_var}}',
      logLevel: 'info',
    });

    await handleLogDebugNode('ld1', node, hCtx);

    expect(logLines.some(l => l.text.includes('Unresolved variable'))).toBe(true);
  });

  it('snapshots variables when enabled', async () => {
    const ctx = makeCtx({ x: '1', y: '2' });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('ld1', 'logDebug', {
      message: 'snapshot',
      logLevel: 'debug',
      snapshotVariables: true,
    });

    await handleLogDebugNode('ld1', node, hCtx);

    expect(logLines.some(l => l.text.includes('Variable snapshot'))).toBe(true);
  });

  it('handles error log level', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('ld1', 'logDebug', {
      message: 'error msg', logLevel: 'error',
    });

    await handleLogDebugNode('ld1', node, hCtx);
    expect(logLines[0]?.prefix).toBe('!');
  });

  it('handles warn log level', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('ld1', 'logDebug', {
      message: 'warn msg', logLevel: 'warn',
    });

    await handleLogDebugNode('ld1', node, hCtx);
    expect(logLines[0]?.prefix).toBe('⚠');
  });

  it('handles debug log level', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('ld1', 'logDebug', {
      message: 'debug msg', logLevel: 'debug',
    });

    await handleLogDebugNode('ld1', node, hCtx);
    expect(logLines[0]?.prefix).toBe('🐛');
  });

  it('handles empty message', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('ld1', 'logDebug', {
      message: '', logLevel: 'info',
    });

    await handleLogDebugNode('ld1', node, hCtx);
    expect(logLines[0]?.prefix).toBe('ℹ');
    expect(logLines[0]?.text).toContain('[INFO]');
  });
});
