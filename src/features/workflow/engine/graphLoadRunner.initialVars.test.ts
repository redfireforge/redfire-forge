import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Workflow } from '../types/workflow';
import type { HttpNodeData } from '../types/workflow';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { runGraphLoad } from './graphLoadRunner';
import { httpFetch } from '@shared/utils/httpClient';

const mockFetch = vi.mocked(httpFetch);

function makeWorkflow(): Workflow {
  return {
    id: 'wf-test',
    name: 'Test Workflow',
    nodes: [
      {
        id: 'h1',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'Step 1',
          scenario: {
            id: 'h1',
            name: 'Step 1',
            url: 'https://example.com/api',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        } as HttpNodeData,
      },
    ],
    edges: [],
    variables: { baseVar: 'fromWorkflow' },
  };
}

describe('graphLoadRunner — initialVariables capture', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
  });

  it('captures merged initialVariables on each iteration trace', async () => {
    const wf = makeWorkflow();
    const { trace } = await runGraphLoad(wf, {
      iterations: 3,
      concurrency: 1,
      initialVariables: { userVar: 'override' },
      traceOptions: { captureFullTrace: false },
    });

    expect(trace.iterations).toHaveLength(3);
    for (const iter of trace.iterations) {
      expect(iter.initialVariables).toBeDefined();
      expect(iter.initialVariables!.baseVar).toBe('fromWorkflow');
      expect(iter.initialVariables!.userVar).toBe('override');
    }
  });

  it('sets captureLevel on the execution trace', async () => {
    const wf = makeWorkflow();

    const { trace: t1 } = await runGraphLoad(wf, {
      iterations: 1,
      concurrency: 1,
      traceOptions: { captureFullTrace: false, traceLevel: 'minimal' },
    });
    expect(t1.captureLevel).toBe('minimal');

    const { trace: t2 } = await runGraphLoad(wf, {
      iterations: 1,
      concurrency: 1,
      traceOptions: { captureFullTrace: true },
    });
    expect(t2.captureLevel).toBe('full');

    const { trace: t3 } = await runGraphLoad(wf, {
      iterations: 1,
      concurrency: 1,
      traceOptions: { captureFullTrace: false, traceLevel: 'debug' },
    });
    expect(t3.captureLevel).toBe('debug');
  });

  it('captures initialVariables even with empty workflow variables', async () => {
    const wf = makeWorkflow();
    wf.variables = {};

    const { trace } = await runGraphLoad(wf, {
      iterations: 1,
      concurrency: 1,
      initialVariables: { only: 'this' },
      traceOptions: { captureFullTrace: false },
    });

    expect(trace.iterations[0].initialVariables).toEqual({ only: 'this' });
  });

  it('defaults captureLevel to standard when no traceOptions', async () => {
    const wf = makeWorkflow();
    const { trace } = await runGraphLoad(wf, {
      iterations: 1,
      concurrency: 1,
    });
    expect(trace.captureLevel).toBe('standard');
  });
});
