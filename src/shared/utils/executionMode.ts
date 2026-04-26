import type { ExecutionMode } from '../types';

type ExecutionModeMeta = {
  label: string;
  title: string;
  hint: string;
  progressLabel: string;
};

export const executionModes: ExecutionMode[] = [
  'sequential',
  'batch',
  'pool',
  'load-profile',
  'workflow',
];

const executionModeMeta: Record<ExecutionMode, ExecutionModeMeta> = {
  sequential: {
    label: 'Sequential',
    title: 'Executes requests one by one in sequence. No parallelism.',
    hint: 'Executes one request at a time in order - no parallelism',
    progressLabel: 'Sequential',
  },
  batch: {
    label: 'Batch',
    title: 'Fires N requests, waits for ALL to finish, then fires the next N.',
    hint: 'Fires N requests, waits for all to complete, then fires next N',
    progressLabel: 'Batch',
  },
  pool: {
    label: 'Continuous Pool',
    title: 'Maintains N concurrent requests at all times.',
    hint: 'Keeps N requests in-flight at all times - a new request starts as soon as one finishes',
    progressLabel: 'Continuous Pool',
  },
  'load-profile': {
    label: 'Load Profile',
    title: 'Time-based load profiles: ramp-up, sustained, spike, soak',
    hint: 'Time-based execution with dynamic concurrency shaping',
    progressLabel: 'Load Profile',
  },
  workflow: {
    label: 'Workflow',
    title: 'Multi-step workflow with variable chaining between requests',
    hint: 'Multi-step chain: each request can extract values for the next step',
    progressLabel: 'Workflow',
  },
};

export function getExecutionModeMeta(mode: ExecutionMode): ExecutionModeMeta {
  return executionModeMeta[mode];
}
