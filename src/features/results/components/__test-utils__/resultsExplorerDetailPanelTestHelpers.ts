/**
 * Shared test fixtures for ResultsExplorerDetailPanel test splits.
 *
 * The main `ResultsExplorerDetailPanel.test.tsx` owns the 24 shared rendering
 * tests. Each `partN.test.tsx` only contains its own unique scenarios and
 * imports these fixtures so we don't duplicate the same trace data across files.
 */
import type { ExecutionEvent, WorkflowIterationTrace } from '../../../../shared/types';

export const mockEvents: ExecutionEvent[] = [
  {
    nodeId: 'http-1',
    nodeType: 'http',
    nodeLabel: 'Get Users',
    timestamp: 1000,
    state: 'pass',
    durationMs: 120,
    details: {
      statusCode: 200,
      method: 'GET',
      url: '/api/users',
      responseTimeMs: 120,
    },
  },
  {
    nodeId: 'http-1',
    nodeType: 'http',
    nodeLabel: 'Get Users',
    timestamp: 2000,
    state: 'fail',
    durationMs: 80,
    details: {
      statusCode: 500,
      method: 'GET',
      url: '/api/users',
      error: 'Internal Server Error',
      responseTimeMs: 80,
    },
  },
];

export const mockIterations: WorkflowIterationTrace[] = [
  {
    index: 0,
    passed: true,
    durationMs: 250,
    traversedEdges: [],
    events: [mockEvents[0]],
    finalVariables: {},
  },
  {
    index: 1,
    passed: false,
    durationMs: 300,
    traversedEdges: [],
    events: [mockEvents[1]],
    finalVariables: {},
  },
];
