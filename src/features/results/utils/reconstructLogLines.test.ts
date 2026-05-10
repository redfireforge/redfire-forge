import { describe, it, expect } from 'vitest';
import { reconstructLogLines } from './reconstructLogLines';
import type { WorkflowIterationTrace, ExecutionEvent } from '../../../shared/types';

function makeEvent(overrides: Partial<ExecutionEvent> & { nodeId: string }): ExecutionEvent {
  return {
    nodeType: 'http',
    nodeLabel: overrides.nodeLabel ?? overrides.nodeId,
    timestamp: 1000,
    state: 'pass',
    durationMs: 100,
    ...overrides,
  };
}

function makeIteration(events: ExecutionEvent[], overrides?: Partial<WorkflowIterationTrace>): WorkflowIterationTrace {
  return {
    index: 0,
    passed: true,
    durationMs: 500,
    events,
    finalVariables: {},
    traversedEdges: [],
    ...overrides,
  };
}

describe('reconstructLogLines', () => {
  it('returns start and end lines for empty-event iteration', () => {
    const iter = makeIteration([]);
    const lines = reconstructLogLines(iter);
    expect(lines.length).toBe(2);
    expect(lines[0].text).toContain('Iteration #1 started');
    expect(lines[1].text).toContain('Iteration #1 PASSED');
  });

  it('generates HTTP summary lines for an HTTP event', () => {
    const event = makeEvent({
      nodeId: 'n1',
      nodeLabel: 'GetUsers',
      details: {
        method: 'GET',
        url: 'https://api.example.com/users',
        statusCode: 200,
        responseTimeMs: 45,
      },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const requestLine = lines.find(l => l.prefix === '>' && l.text.includes('GET'));
    expect(requestLine).toBeDefined();
    expect(requestLine!.text).toBe('GET https://api.example.com/users');

    const responseLine = lines.find(l => l.prefix === '<' && l.text.includes('200'));
    expect(responseLine).toBeDefined();
    expect(responseLine!.text).toBe('200 (45ms)');
  });

  it('generates extracted variable lines', () => {
    const event = makeEvent({
      nodeId: 'n1',
      details: {
        extractedVariables: { userId: '42', __internal: 'hidden' },
      },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const varLine = lines.find(l => l.prefix === '#' && l.text.includes('userId'));
    expect(varLine).toBeDefined();
    expect(varLine!.text).toBe('userId = 42');

    const internalLine = lines.find(l => l.text.includes('__internal'));
    expect(internalLine).toBeUndefined();
  });

  it('generates assertion lines', () => {
    const event = makeEvent({
      nodeId: 'n1',
      details: {
        assertions: [
          { type: 'statusCode', passed: true, description: 'Status is 200' },
          { type: 'jsonPath', passed: false, description: 'Body has name', expected: '"John"', actual: '"Jane"' },
        ],
      },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const passLine = lines.find(l => l.text.includes('✓') && l.text.includes('Status is 200'));
    expect(passLine).toBeDefined();
    expect(passLine!.prefix).toBe('*');

    const failLine = lines.find(l => l.text.includes('✗') && l.text.includes('Body has name'));
    expect(failLine).toBeDefined();
    expect(failLine!.prefix).toBe('!');
    expect(failLine!.text).toContain('expected: "John"');
  });

  it('generates error line for node with error', () => {
    const event = makeEvent({
      nodeId: 'n1',
      state: 'fail',
      details: { error: 'Connection refused' },
    });
    const iter = makeIteration([event], { passed: false });
    const lines = reconstructLogLines(iter);

    const errorLine = lines.find(l => l.prefix === '!' && l.text === 'Connection refused');
    expect(errorLine).toBeDefined();
  });

  it('generates failed iteration summary', () => {
    const event = makeEvent({ nodeId: 'n1', state: 'fail' });
    const iter = makeIteration([event], { index: 3, passed: false });
    const lines = reconstructLogLines(iter);

    const summary = lines[lines.length - 1];
    expect(summary.text).toContain('Iteration #4 FAILED');
    expect(summary.prefix).toBe('!');
  });

  it('applies node filter', () => {
    const e1 = makeEvent({ nodeId: 'n1', nodeLabel: 'A' });
    const e2 = makeEvent({ nodeId: 'n2', nodeLabel: 'B' });
    const iter = makeIteration([e1, e2]);
    const lines = reconstructLogLines(iter, { nodeFilter: 'n1' });

    const bLines = lines.filter(l => l.nodeId === 'n2');
    expect(bLines.length).toBe(0);

    const aLines = lines.filter(l => l.nodeId === 'n1');
    expect(aLines.length).toBeGreaterThan(0);
  });

  it('includes HTTP bodies only when includeHttpBodies is true', () => {
    const event = makeEvent({
      nodeId: 'n1',
      details: {
        method: 'POST',
        url: '/api',
        statusCode: 201,
        request: { bodyResolved: '{"name":"test"}' } as never,
        response: { body: '{"id":1}' } as never,
      },
    });
    const iter = makeIteration([event]);

    const withoutBodies = reconstructLogLines(iter, { includeHttpBodies: false });
    const bodyLines = withoutBodies.filter(l => l.text.includes('Body:'));
    expect(bodyLines.length).toBe(0);

    const withBodies = reconstructLogLines(iter, { includeHttpBodies: true });
    const bodyLinesIncluded = withBodies.filter(l => l.text.includes('Body:'));
    expect(bodyLinesIncluded.length).toBe(2);
  });

  it('generates sub-workflow summary when no trace captured', () => {
    const event = makeEvent({
      nodeId: 'n1',
      nodeType: 'subWorkflow',
      details: { subWorkflowId: 'child-wf', subWorkflowPassed: true },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const subLine = lines.find(l => l.text.includes('Sub-workflow child-wf'));
    expect(subLine).toBeDefined();
    expect(subLine!.text).toContain('trace not captured');
  });

  it('recursively expands sub-workflow trace events', () => {
    const childEvent = makeEvent({
      nodeId: 'c1',
      nodeLabel: 'Child Step',
      details: { method: 'POST', url: '/child-api', statusCode: 201, responseTimeMs: 30 },
    });
    const childTrace = {
      workflowName: 'Child Workflow',
      totalIterations: 1,
      totalDurationMs: 200,
      fullTraceCaptured: true,
      iterations: [{
        index: 0, passed: true, durationMs: 200,
        events: [childEvent], finalVariables: {}, traversedEdges: [],
      }],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    };

    const event = makeEvent({
      nodeId: 'n1',
      nodeType: 'subWorkflow',
      nodeLabel: 'Run Child',
      details: {
        subWorkflowId: 'child-wf',
        subWorkflowPassed: true,
        subWorkflowTrace: childTrace as never,
      },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const subHeader = lines.find(l => l.text.includes('Sub-workflow "Child Workflow"'));
    expect(subHeader).toBeDefined();
    expect(subHeader!.text).toContain('1 iteration');
    expect(subHeader!.text).toContain('passed');

    const childLines = lines.filter(l => (l.depth ?? 0) > 0);
    expect(childLines.length).toBeGreaterThan(0);

    const childHttpLine = childLines.find(l => l.text.includes('POST /child-api'));
    expect(childHttpLine).toBeDefined();
    expect(childHttpLine!.depth).toBe(1);

    const childResponseLine = childLines.find(l => l.text.includes('201'));
    expect(childResponseLine).toBeDefined();
  });

  it('limits sub-workflow recursion depth', () => {
    function buildNestedTrace(depthRemaining: number): typeof import('../../../shared/types').WorkflowExecutionTrace | undefined {
      if (depthRemaining <= 0) return undefined;
      const childTrace = buildNestedTrace(depthRemaining - 1);
      return {
        workflowName: `Level ${depthRemaining}`,
        totalIterations: 1,
        totalDurationMs: 100,
        fullTraceCaptured: true,
        iterations: [{
          index: 0, passed: true, durationMs: 100,
          events: [makeEvent({
            nodeId: `sw-${depthRemaining}`,
            nodeType: 'subWorkflow',
            nodeLabel: `Sub ${depthRemaining}`,
            details: {
              subWorkflowId: `sub-${depthRemaining}`,
              subWorkflowPassed: true,
              ...(childTrace ? { subWorkflowTrace: childTrace as never } : {}),
            },
          })],
          finalVariables: {},
          traversedEdges: [],
        }],
        traversedEdges: [],
        workflowSnapshot: { nodes: [], edges: [] },
      } as never;
    }

    const deepTrace = buildNestedTrace(8);
    const event = makeEvent({
      nodeId: 'n1',
      nodeType: 'subWorkflow',
      details: {
        subWorkflowId: 'deep-root',
        subWorkflowPassed: true,
        subWorkflowTrace: deepTrace as never,
      },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const maxDepth = Math.max(...lines.map(l => l.depth ?? 0));
    expect(maxDepth).toBeLessThanOrEqual(5);
  });

  it('generates wait duration line', () => {
    const event = makeEvent({
      nodeId: 'n1',
      nodeType: 'correlationWait',
      details: { waitDurationMs: 3500 },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const waitLine = lines.find(l => l.text.includes('Waited 3500ms'));
    expect(waitLine).toBeDefined();
  });

  it('generates webhook input line', () => {
    const event = makeEvent({
      nodeId: 'n1',
      nodeType: 'webhook',
      details: { webhookInput: { payload: '{}', method: 'POST', path: '/hook' } },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const hookLine = lines.find(l => l.text.includes('Webhook received: POST /hook'));
    expect(hookLine).toBeDefined();
  });

  it('truncates long extracted variable values', () => {
    const longValue = 'x'.repeat(100);
    const event = makeEvent({
      nodeId: 'n1',
      details: { extractedVariables: { bigVal: longValue } },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const varLine = lines.find(l => l.prefix === '#' && l.text.includes('bigVal'));
    expect(varLine!.text).toContain('...');
    expect(varLine!.text.length).toBeLessThan(longValue.length + 20);
  });

  it('assigns nodeId and nodeLabel to lines', () => {
    const event = makeEvent({ nodeId: 'n5', nodeLabel: 'MyStep' });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const nodeLines = lines.filter(l => l.nodeId === 'n5');
    expect(nodeLines.length).toBeGreaterThan(0);
    expect(nodeLines[0].nodeLabel).toBe('MyStep');
  });

  it('skipped events get proper completion line', () => {
    const event = makeEvent({ nodeId: 'n1', state: 'skipped' });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const skipLine = lines.find(l => l.text.includes('skipped'));
    expect(skipLine).toBeDefined();
  });

  it('formats condition with and without expression', () => {
    const onlyResult = makeEvent({
      nodeId: 'c1',
      nodeType: 'condition',
      details: { conditionResult: true },
    });
    const withExpr = makeEvent({
      nodeId: 'c2',
      nodeType: 'condition',
      details: { conditionResult: false, conditionExpression: 'x > 1' },
    });
    const iter = makeIteration([onlyResult, withExpr]);
    const lines = reconstructLogLines(iter);

    expect(lines.some(l => l.text === 'Condition: TRUE')).toBe(true);
    expect(lines.some(l => l.text === 'Condition: FALSE (x > 1)')).toBe(true);
  });

  it('formats loop iteration with explicit currentLoopIndex', () => {
    const event = makeEvent({
      nodeId: 'l1',
      nodeType: 'loop',
      details: { loopIterationCount: 5, currentLoopIndex: 2 },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter);

    const loopLine = lines.find(l => l.text.includes('Loop iteration 3 of 5'));
    expect(loopLine).toBeDefined();
  });

  it('truncates HTTP bodies longer than 200 characters when bodies enabled', () => {
    const longBody = 'y'.repeat(250);
    const event = makeEvent({
      nodeId: 'n1',
      details: {
        method: 'POST',
        url: '/api',
        request: { bodyResolved: longBody } as never,
      },
    });
    const iter = makeIteration([event]);
    const lines = reconstructLogLines(iter, { includeHttpBodies: true });

    const bodyLine = lines.find(l => l.prefix === '>' && l.text.startsWith('Body:'));
    expect(bodyLine).toBeDefined();
    expect(bodyLine!.text.endsWith('...')).toBe(true);
    expect(bodyLine!.text.length).toBeLessThan(longBody.length + 30);
  });

  it('covers formatNodeType labels for non-http node kinds', () => {
    const kinds: Array<{ nodeType: string; needle: string }> = [
      { nodeType: 'delay', needle: 'Delay' },
      { nodeType: 'correlationWait', needle: 'Correlation Wait' },
      { nodeType: 'waitForCondition', needle: 'Wait For Condition' },
      { nodeType: 'fork', needle: 'Fork' },
      { nodeType: 'join', needle: 'Join' },
      { nodeType: 'loop', needle: 'Loop' },
      { nodeType: 'setVariable', needle: 'Set Variable' },
      { nodeType: 'script', needle: 'Script' },
      { nodeType: 'aggregate', needle: 'Aggregate' },
      { nodeType: 'schedule', needle: 'Schedule' },
      { nodeType: 'start', needle: 'Start' },
      { nodeType: 'errorHandler', needle: 'Error Handler' },
    ];
    const events = kinds.map((k, i) =>
      makeEvent({ nodeId: `k${i}`, nodeType: k.nodeType, nodeLabel: k.needle }),
    );
    const lines = reconstructLogLines(makeIteration(events));

    for (const k of kinds) {
      expect(
        lines.some(l => l.text.includes(`[${k.needle}]`) && l.text.includes(k.needle + ' — started')),
        k.nodeType,
      ).toBe(true);
    }
  });

  it('falls back to raw node type string when unmapped', () => {
    const event = makeEvent({ nodeId: 'u1', nodeType: 'customGadget', nodeLabel: 'Gadget' });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.some(l => l.text.includes('[Gadget] customGadget — started'))).toBe(true);
  });

  it('marks sub-workflow header FAILED and plural iterations', () => {
    const childTrace = {
      workflowName: 'Wide',
      totalIterations: 2,
      totalDurationMs: 100,
      iterations: [
        {
          index: 0,
          passed: true,
          durationMs: 50,
          events: [],
          finalVariables: {},
          traversedEdges: [],
        },
        {
          index: 1,
          passed: true,
          durationMs: 50,
          events: [],
          finalVariables: {},
          traversedEdges: [],
        },
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    };

    const event = makeEvent({
      nodeId: 'sw',
      nodeType: 'subWorkflow',
      details: {
        subWorkflowPassed: false,
        subWorkflowTrace: childTrace as never,
      },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    const header = lines.find(l => l.text.includes('Sub-workflow "Wide"'));
    expect(header).toBeDefined();
    expect(header!.text).toContain('2 iterations');
    expect(header!.text).toContain('FAILED');
  });

  it('sub-workflow not captured shows failed lowercase', () => {
    const event = makeEvent({
      nodeId: 'n1',
      nodeType: 'subWorkflow',
      details: { subWorkflowId: 'no-trace', subWorkflowPassed: false },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    const line = lines.find(l => l.text.includes('no-trace') && l.text.includes('failed'));
    expect(line).toBeDefined();
    expect(line!.text).toContain('(trace not captured)');
  });

  it('resolves sub-workflow display name from subWorkflowId when workflowName missing', () => {
    const childTrace = {
      totalIterations: 1,
      totalDurationMs: 10,
      iterations: [
        {
          index: 0,
          passed: true,
          durationMs: 10,
          events: [makeEvent({ nodeId: 'c1', details: { method: 'GET', url: '/x' } })],
          finalVariables: {},
          traversedEdges: [],
        },
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    };

    const event = makeEvent({
      nodeId: 'sw',
      nodeType: 'subWorkflow',
      details: {
        subWorkflowId: 'by-id',
        subWorkflowPassed: true,
        subWorkflowTrace: childTrace as never,
      },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.some(l => l.text.includes('Sub-workflow "by-id"'))).toBe(true);
  });

  it('assertion failure without expected omits expected/got suffix', () => {
    const event = makeEvent({
      nodeId: 'n1',
      details: {
        assertions: [{ type: 'custom', passed: false, description: 'check' }],
      },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    const failLine = lines.find(l => l.text.includes('✗') && l.text.includes('check'));
    expect(failLine).toBeDefined();
    expect(failLine!.text).not.toContain('expected:');
  });

  it('status line omits timing when responseTimeMs undefined', () => {
    const event = makeEvent({
      nodeId: 'n1',
      details: { method: 'GET', url: '/z', statusCode: 204 },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    const statusLine = lines.find(l => l.prefix === '<' && l.text.startsWith('204'));
    expect(statusLine).toBeDefined();
    expect(statusLine!.text).toBe('204');
  });

  it('uses nodeId as label when nodeLabel missing', () => {
    const event = makeEvent({ nodeId: 'id-only', nodeLabel: undefined as never });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.some(l => l.text.includes('[id-only]'))).toBe(true);
  });

  it('child sub-workflow uses workflowName fallback when id and name missing', () => {
    const childTrace = {
      totalIterations: 1,
      totalDurationMs: 5,
      iterations: [
        {
          index: 0,
          passed: true,
          durationMs: 5,
          events: [],
          finalVariables: {},
          traversedEdges: [],
        },
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    };

    const event = makeEvent({
      nodeId: 'sw',
      nodeType: 'subWorkflow',
      details: {
        subWorkflowPassed: true,
        subWorkflowTrace: childTrace as never,
      },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.some(l => l.text.includes('Sub-workflow "child"'))).toBe(true);
  });

  it('webhook defaults use POST and /webhook when method and path omitted', () => {
    const event = makeEvent({
      nodeId: 'w1',
      nodeType: 'webhook',
      details: { webhookInput: { payload: '{}' } as { payload: string } },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.some(l => l.text === 'Webhook received: POST /webhook')).toBe(true);
  });

  it('loop line uses default currentLoopIndex when omitted', () => {
    const event = makeEvent({
      nodeId: 'l1',
      nodeType: 'loop',
      details: { loopIterationCount: 4 },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.some(l => l.text === 'Loop iteration 1 of 4')).toBe(true);
  });

  it('formats condition FALSE without expression', () => {
    const event = makeEvent({
      nodeId: 'c1',
      nodeType: 'condition',
      details: { conditionResult: false },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.some(l => l.text === 'Condition: FALSE')).toBe(true);
  });

  it('prints non-string extracted variable values without truncation', () => {
    const event = makeEvent({
      nodeId: 'n1',
      details: { extractedVariables: { n: 42 as never } },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.some(l => l.text === 'n = 42')).toBe(true);
  });

  it('when includeHttpBodies true, emits only response body when request missing', () => {
    const event = makeEvent({
      nodeId: 'n1',
      details: {
        method: 'GET',
        url: '/z',
        statusCode: 200,
        response: { body: '{"ok":true}' } as never,
      },
    });
    const lines = reconstructLogLines(makeIteration([event]), { includeHttpBodies: true });

    const reqBodyLines = lines.filter(l => l.text.startsWith('Body:') && l.prefix === '>');
    expect(reqBodyLines.length).toBe(0);
    expect(lines.some(l => l.text.includes('Body: {"ok":true}'))).toBe(true);
  });

  it('skips HTTP request line when method or url missing', () => {
    const event = makeEvent({
      nodeId: 'n1',
      details: { statusCode: 202 },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.filter(l => l.prefix === '>' && !l.text.startsWith('[')).length).toBe(0);
    expect(lines.some(l => l.text === '202')).toBe(true);
  });

  it('uses assertion type when description missing', () => {
    const event = makeEvent({
      nodeId: 'n1',
      details: {
        assertions: [{ type: 'equals', passed: true }],
      },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.some(l => l.text.includes('✓ equals'))).toBe(true);
  });

  it('emits error detail line inside nested sub-workflow events', () => {
    const inner = makeEvent({
      nodeId: 'inner',
      state: 'fail',
      details: { error: 'nested boom' },
    });
    const childTrace = {
      workflowName: 'Nest',
      totalIterations: 1,
      totalDurationMs: 20,
      iterations: [
        {
          index: 0,
          passed: false,
          durationMs: 20,
          events: [inner],
          finalVariables: {},
          traversedEdges: [],
        },
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    };

    const event = makeEvent({
      nodeId: 'sw',
      nodeType: 'subWorkflow',
      details: {
        subWorkflowPassed: false,
        subWorkflowTrace: childTrace as never,
      },
    });
    const lines = reconstructLogLines(makeIteration([event]));

    expect(lines.some(l => l.depth === 1 && l.text === 'nested boom')).toBe(true);
  });

  it('completion line omits duration suffix when event durationMs undefined', () => {
    const event = makeEvent({
      nodeId: 'n1',
      durationMs: undefined,
    });
    const lines = reconstructLogLines(makeIteration([event]));

    const done = lines.filter(l => l.text.includes('passed') && l.text.startsWith('['));
    expect(done[0].text.endsWith('passed')).toBe(true);
    expect(done[0].text).not.toContain('ms)');
  });
});
