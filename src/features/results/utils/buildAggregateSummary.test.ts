import { describe, it, expect } from 'vitest';
import { buildAggregateSummary } from './buildAggregateSummary';
import type { WorkflowExecutionTrace, WorkflowIterationTrace, ExecutionEvent } from '../../../shared/types';

function makeEvent(overrides?: Partial<ExecutionEvent>): ExecutionEvent {
  return {
    nodeId: 'n1',
    nodeType: 'http',
    nodeLabel: 'Step 1',
    timestamp: 1000,
    state: 'pass',
    durationMs: 100,
    details: { method: 'GET', url: '/users', statusCode: 200, responseTimeMs: 50 },
    ...overrides,
  };
}

function makeIter(overrides?: Partial<WorkflowIterationTrace>): WorkflowIterationTrace {
  return {
    index: 0,
    passed: true,
    durationMs: 200,
    events: [makeEvent()],
    finalVariables: {},
    traversedEdges: [],
    ...overrides,
  };
}

function makeTrace(overrides?: Partial<WorkflowExecutionTrace>): WorkflowExecutionTrace {
  return {
    workflowName: 'Test',
    totalIterations: 1,
    totalDurationMs: 200,
    iterations: [makeIter()],
    traversedEdges: [],
    workflowSnapshot: { nodes: [], edges: [] },
    ...overrides,
  } as WorkflowExecutionTrace;
}

function allText(trace: WorkflowExecutionTrace): string {
  return buildAggregateSummary(trace).map(l => l.text).join('\n');
}

describe('buildAggregateSummary', () => {
  it('returns empty for empty iterations', () => {
    const trace = makeTrace({ iterations: [] });
    expect(buildAggregateSummary(trace)).toEqual([]);
  });

  it('produces run overview with pass rate and duration stats', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({ index: 0, durationMs: 100 }),
        makeIter({ index: 1, durationMs: 200 }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('Run Overview');
    expect(text).toContain('2/2 passed (100%)');
    expect(text).toContain('min 100ms');
    expect(text).toContain('avg 150ms');
    expect(text).toContain('max 200ms');
  });

  it('shows iterations table with status and duration', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({ index: 0, durationMs: 100 }),
        makeIter({ index: 1, passed: false, durationMs: 300, events: [makeEvent({ state: 'fail' })] }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('Iterations');
    expect(text).toContain('PASS');
    expect(text).toContain('FAIL');
  });

  it('shows Failures section with reason for failed iterations', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({
          index: 0,
          passed: false,
          events: [makeEvent({ state: 'fail', nodeLabel: 'API Call', details: { error: 'connection refused' } })],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('Failures');
    expect(text).toContain('API Call');
    expect(text).toContain('connection refused');
  });

  it('shows HTTP status code as failure reason', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({
          index: 0,
          passed: false,
          events: [makeEvent({ state: 'fail', nodeLabel: 'Fetch', details: { statusCode: 500 } })],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('HTTP 500');
  });

  it('includes sub-workflow section', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'Child Flow',
      totalIterations: 3,
      totalDurationMs: 300,
      iterations: [
        makeIter({ index: 0, durationMs: 80 }),
        makeIter({ index: 1, durationMs: 100 }),
        makeIter({ index: 2, durationMs: 120 }),
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          events: [
            makeEvent({ nodeType: 'subWorkflow', nodeLabel: 'Process', details: { subWorkflowTrace: childTrace } }),
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('Sub-Workflows');
    expect(text).toContain('Child Flow');
    expect(text).toContain('3/3 passed (100%)');
    expect(text).toContain('avg 100ms');
  });

  it('shows failed child iterations in sub-workflow section', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'Child Flow',
      totalIterations: 3,
      totalDurationMs: 300,
      iterations: [
        makeIter({ index: 0 }),
        makeIter({ index: 1, passed: false, events: [makeEvent({ state: 'fail', nodeLabel: 'Validate', details: { error: 'schema mismatch' } })] }),
        makeIter({ index: 2 }),
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          events: [makeEvent({ nodeType: 'subWorkflow', details: { subWorkflowTrace: childTrace } })],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('#2 FAIL');
    expect(text).toContain('Validate');
    expect(text).toContain('schema mismatch');
  });

  it('limits child failure lines to 3 and shows overflow', () => {
    const childIters = Array.from({ length: 5 }, (_, i) =>
      makeIter({ index: i, passed: false, events: [makeEvent({ state: 'fail', nodeLabel: `N${i}`, details: { error: `err${i}` } })] })
    );
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'Big Child',
      totalIterations: 5,
      totalDurationMs: 500,
      iterations: childIters,
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          events: [makeEvent({ nodeType: 'subWorkflow', details: { subWorkflowTrace: childTrace } })],
        }),
      ],
    });
    const lines = buildAggregateSummary(trace);
    const childFailLines = lines.filter(l => l.text.includes('FAIL →'));
    expect(childFailLines.length).toBe(3);
    expect(lines.some(l => l.text.includes('… and 2 more'))).toBe(true);
  });

  it('includes footer hint', () => {
    const trace = makeTrace();
    const text = allText(trace);
    expect(text).toContain('Select an iteration to see full console output.');
  });

  it('skips sampled-out iterations', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({ index: 0 }),
        { ...makeIter({ index: 1 }), sampled: false } as WorkflowIterationTrace,
        makeIter({ index: 2 }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('2/2 passed');
  });

  it('shows node and HTTP counts in overview', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({
          events: [
            makeEvent({ nodeId: 'a', nodeType: 'http' }),
            makeEvent({ nodeId: 'b', nodeType: 'http' }),
            makeEvent({ nodeId: 'c', nodeType: 'data' }),
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('3 per iteration');
    expect(text).toContain('2 HTTP calls');
  });

  it('shows failed count in overview header', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({ index: 0, passed: false, events: [makeEvent({ state: 'fail' })] }),
        makeIter({ index: 1, passed: true }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('1/2 passed');
    expect(text).toContain('1 failed');
  });

  it('marks slow iterations in the table', () => {
    const iters = Array.from({ length: 10 }, (_, i) =>
      makeIter({ index: i, durationMs: i === 9 ? 5000 : 100 })
    );
    const trace = makeTrace({ iterations: iters });
    const lines = buildAggregateSummary(trace);
    const slowLine = lines.find(l => l.text.includes('slow'));
    expect(slowLine).toBeTruthy();
    expect(slowLine!.text).toContain('5000ms');
  });

  it('no Failures section when all pass', () => {
    const trace = makeTrace({
      iterations: [makeIter({ index: 0 }), makeIter({ index: 1 })],
    });
    const text = allText(trace);
    expect(text).not.toContain('Failures');
  });

  it('shows sub-workflow failure breakdown inside Failures when parent iteration fails', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'Nested',
      totalIterations: 2,
      totalDurationMs: 200,
      iterations: [
        makeIter({
          index: 0,
          passed: false,
          events: [
            makeEvent({
              state: 'fail',
              nodeLabel: 'Inner',
              details: { error: 'boom' },
            }),
          ],
        }),
        makeIter({ index: 1, passed: true }),
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          index: 0,
          passed: false,
          durationMs: 400,
          events: [
            makeEvent({ state: 'fail', nodeLabel: 'Root', details: { error: 'root err' } }),
            makeEvent({
              nodeType: 'subWorkflow',
              nodeLabel: 'Run Nested',
              details: { subWorkflowTrace: childTrace },
            }),
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('Nested');
    expect(text).toMatch(/1\/2 iteration failed/);
    expect(text).toContain('#1 → Inner');
    expect(text).toContain('boom');
  });

  it('uses singular iteration label when exactly one child iteration failed in Failures section', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'SingleFail',
      totalIterations: 1,
      totalDurationMs: 50,
      iterations: [
        makeIter({
          index: 0,
          passed: false,
          events: [makeEvent({ state: 'fail', details: { statusCode: 503 } })],
        }),
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          passed: false,
          events: [
            makeEvent({ state: 'fail' }),
            makeEvent({
              nodeType: 'subWorkflow',
              details: { subWorkflowTrace: childTrace },
            }),
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('1/1 iteration failed');
  });

  it('caps nested sub-workflow failure lines at 3 and shows overflow in Failures section', () => {
    const childIters = Array.from({ length: 5 }, (_, i) =>
      makeIter({
        index: i,
        passed: false,
        events: [makeEvent({ state: 'fail', nodeLabel: `L${i}`, details: { error: `e${i}` } })],
      })
    );
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'ManyFails',
      totalIterations: 5,
      totalDurationMs: 500,
      iterations: childIters,
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          passed: false,
          events: [
            makeEvent({ state: 'fail' }),
            makeEvent({
              nodeType: 'subWorkflow',
              details: { subWorkflowTrace: childTrace },
            }),
          ],
        }),
      ],
    });
    const lines = buildAggregateSummary(trace);
    const depth2Overflow = lines.filter(
      l => l.depth === 2 && l.text.includes('… and 2 more')
    );
    expect(depth2Overflow.length).toBeGreaterThan(0);
  });

  it('shows unknown node when child failed iteration has no fail event', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'NoFailEv',
      totalIterations: 1,
      totalDurationMs: 10,
      iterations: [
        {
          index: 0,
          passed: false,
          durationMs: 10,
          events: [makeEvent({ state: 'pass' })],
          finalVariables: {},
          traversedEdges: [],
        } as WorkflowIterationTrace,
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          passed: false,
          events: [
            makeEvent({ state: 'fail' }),
            makeEvent({
              nodeType: 'subWorkflow',
              details: { subWorkflowTrace: childTrace },
            }),
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('#1 → unknown');
  });

  it('uses condition-evaluated-false as failure reason when no error or HTTP', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({
          passed: false,
          events: [
            makeEvent({
              state: 'fail',
              nodeLabel: 'If',
              details: {
                conditionExpression: 'vars.ok === true',
                conditionResult: false,
              },
            }),
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('condition evaluated false');
  });

  it('omits colon reason when fail event has empty details', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({
          passed: false,
          events: [makeEvent({ state: 'fail', nodeLabel: 'Bare', details: undefined })],
        }),
      ],
    });
    const lines = buildAggregateSummary(trace);
    const failDetail = lines.find(l => l.text.includes('└─ Bare') && !l.text.includes('Bare:'));
    expect(failDetail).toBeDefined();
  });

  it('uses singular HTTP call label when count is 1', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({
          events: [makeEvent({ nodeId: 'a', nodeType: 'http' })],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('1 HTTP call');
    expect(text).not.toContain('1 HTTP calls');
  });

  it('uses singular sub-workflow count in overview', () => {
    const stubChild: WorkflowExecutionTrace = {
      workflowName: 'S',
      totalIterations: 1,
      totalDurationMs: 1,
      iterations: [makeIter()],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          events: [
            makeEvent({ nodeType: 'subWorkflow', details: { subWorkflowTrace: stubChild } }),
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('1 sub-workflow');
  });

  it('returns empty when all iterations are sampled out', () => {
    const trace = makeTrace({
      iterations: [
        { ...makeIter(), sampled: false } as WorkflowIterationTrace,
        { ...makeIter({ index: 1 }), sampled: false } as WorkflowIterationTrace,
      ],
    });
    expect(buildAggregateSummary(trace)).toEqual([]);
  });

  it('handles child trace where every iteration is sampled out (empty sub stats)', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'AllSkipped',
      totalIterations: 2,
      totalDurationMs: 0,
      iterations: [
        { ...makeIter({ index: 0 }), sampled: false } as WorkflowIterationTrace,
        { ...makeIter({ index: 1 }), sampled: false } as WorkflowIterationTrace,
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          events: [
            makeEvent({ nodeType: 'subWorkflow', details: { subWorkflowTrace: childTrace } }),
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('AllSkipped');
    expect(text).toContain('0/0 passed (0%)');
    expect(text).toContain('avg 0ms');
  });

  it('shows sub-workflow failure line without reason when fail event only has non-error HTTP status', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'NoReason',
      totalIterations: 1,
      totalDurationMs: 10,
      iterations: [
        {
          ...makeIter({
            index: undefined as never,
            passed: false,
            events: [
              makeEvent({
                state: 'fail',
                nodeLabel: 'X',
                details: { statusCode: 200 },
              }),
            ],
          }),
        },
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          events: [
            makeEvent({ nodeType: 'subWorkflow', details: { subWorkflowTrace: childTrace } }),
          ],
        }),
      ],
    });
    const lines = buildAggregateSummary(trace);
    const failLine = lines.find(l => l.depth === 1 && l.text.includes('#1 FAIL → X') && !l.text.includes(': HTTP'));
    expect(failLine).toBeDefined();
  });

  it('lists multiple sub-workflow blocks when first iteration has several sub-workflow nodes', () => {
    const mkChild = (name: string): WorkflowExecutionTrace =>
      ({
        workflowName: name,
        totalIterations: 1,
        totalDurationMs: 10,
        iterations: [makeIter()],
        traversedEdges: [],
        workflowSnapshot: { nodes: [], edges: [] },
      }) as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          events: [
            makeEvent({
              nodeId: 's1',
              nodeType: 'subWorkflow',
              details: { subWorkflowTrace: mkChild('Alpha') },
            }),
            makeEvent({
              nodeId: 's2',
              nodeType: 'subWorkflow',
              details: { subWorkflowTrace: mkChild('Beta') },
            }),
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('Alpha');
    expect(text).toContain('Beta');
  });

  it('uses nodeId in Failures when fail event has no nodeLabel', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({
          passed: false,
          index: undefined as never,
          events: [
            {
              ...makeEvent({
                state: 'fail',
                nodeLabel: '' as never,
                nodeId: 'only-id',
                details: { error: 'x' },
              }),
            },
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('└─ only-id');
    expect(text).toContain('#1');
  });

  it('omits failure reason colon when getFailureReason is empty for top-level fail event', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({
          passed: false,
          events: [
            makeEvent({
              state: 'fail',
              nodeLabel: 'Bare top',
              details: { statusCode: 200 },
            }),
          ],
        }),
      ],
    });
    const lines = buildAggregateSummary(trace);
    const row = lines.find(l => l.text.includes('└─ Bare top') && !l.text.includes('Bare top:'));
    expect(row).toBeDefined();
  });

  it('does not expand nested sub-workflow in Failures when all child iterations passed', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'All OK Child',
      totalIterations: 1,
      totalDurationMs: 10,
      iterations: [makeIter({ index: undefined as never, passed: true })],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          passed: false,
          events: [
            makeEvent({ state: 'fail', nodeLabel: 'Root', details: { error: 'root' } }),
            makeEvent({
              nodeType: 'subWorkflow',
              details: { subWorkflowTrace: childTrace },
            }),
          ],
        }),
      ],
    });
    const text = allText(trace);
    expect(text).toContain('Root');
    // Failures nesting only lists sub-workflow when child iterations failed
    expect(text).not.toMatch(/└─ All OK Child:/);
  });

  it('nested failure detail uses nodeId and omits reason when fail event yields empty reason', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowName: 'Nest',
      totalIterations: 1,
      totalDurationMs: 10,
      iterations: [
        makeIter({
          index: undefined as never,
          passed: false,
          events: [
            makeEvent({
              state: 'fail',
              nodeLabel: '' as never,
              nodeId: 'nid-deep',
              details: { statusCode: 302 },
            }),
          ],
        }),
      ],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
    } as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          passed: false,
          events: [
            makeEvent({ state: 'fail', details: { error: 'p' } }),
            makeEvent({
              nodeType: 'subWorkflow',
              details: { subWorkflowTrace: childTrace },
            }),
          ],
        }),
      ],
    });
    const lines = buildAggregateSummary(trace);
    const row = lines.find(
      l => l.depth === 2 && l.text.includes('#1 → nid-deep') && !l.text.includes('nid-deep:'),
    );
    expect(row).toBeDefined();
  });

  it('iterations table uses index fallback and zero timestamp when iteration has empty events', () => {
    const trace = makeTrace({
      iterations: [
        {
          passed: true,
          index: undefined,
          durationMs: 150,
          events: [],
          finalVariables: {},
          traversedEdges: [],
        } as WorkflowIterationTrace,
      ],
    });
    const lines = buildAggregateSummary(trace);
    const row = lines.find(l => l.text.includes('PASS'));
    expect(row).toBeDefined();
    expect(row!.ts).toBe(0);
  });

  it('never marks slow when fewer than five iterations exist', () => {
    const trace = makeTrace({
      iterations: [
        makeIter({ index: 0, durationMs: 9999 }),
        makeIter({ index: 1, durationMs: 1 }),
        makeIter({ index: 2, durationMs: 2 }),
      ],
    });
    expect(allText(trace)).not.toContain('slow');
  });

  it('treats undefined 90th-percentile duration as Infinity so slow label is suppressed', () => {
    const iters = Array.from({ length: 5 }, (_, i) =>
      makeIter({ index: i, durationMs: undefined as unknown as number }),
    );
    const trace = makeTrace({ iterations: iters });
    expect(buildAggregateSummary(trace).some(l => l.text.includes('slow'))).toBe(false);
  });

  it('uses plural sub-workflow label in overview when two sub-workflow nodes exist', () => {
    const mkChild = (name: string): WorkflowExecutionTrace =>
      ({
        workflowName: name,
        totalIterations: 1,
        totalDurationMs: 1,
        iterations: [makeIter()],
        traversedEdges: [],
        workflowSnapshot: { nodes: [], edges: [] },
      }) as WorkflowExecutionTrace;

    const trace = makeTrace({
      iterations: [
        makeIter({
          events: [
            makeEvent({
              nodeType: 'subWorkflow',
              details: { subWorkflowTrace: mkChild('A') },
            }),
            makeEvent({
              nodeType: 'subWorkflow',
              details: { subWorkflowTrace: mkChild('B') },
            }),
          ],
        }),
      ],
    });
    expect(allText(trace)).toContain('2 sub-workflows');
  });
});
