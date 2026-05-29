// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { makeTestRun } from '../../../test-utils/factories';
import { ResultsContextTags } from './ResultsContextTags';

vi.mock('../../test-runner/utils/runnerProgressStorage', () => ({
  thinkTimeLabel: vi.fn((value?: unknown) => (value ? 'Think 100ms' : '')),
}));

describe('ResultsContextTags', () => {
  it('renders workflow context tags and hides svc tag for workflow mode', () => {
    const run = makeTestRun({
      svcName: 'svc-a',
      envName: 'dev',
      workflowName: 'wf-alpha',
      baseUrl: 'https://example.com',
      config: {
        ...makeTestRun().config,
        executionMode: 'workflow',
      },
    });

    render(<ResultsContextTags selectedRun={run} />);

    expect(screen.queryByText('svc-a')).toBeNull();
    expect(screen.getByText('dev')).toBeTruthy();
    expect(screen.getByText(/⚡ wf-alpha/i)).toBeTruthy();
    expect(screen.getByText(/Workflow/i)).toBeTruthy();
  });

  it('renders non-workflow host fallback and arrival-rate details', () => {
    const run = makeTestRun({
      svcName: '',
      envName: '',
      baseUrl: '',
      config: {
        ...makeTestRun().config,
        executionMode: 'constant-arrival',
        arrivalRate: {
          targetRps: 120,
          durationSec: 60,
          ramp: {
            startRps: 10,
            endRps: 120,
          },
        },
        thinkTime: { minMs: 100, maxMs: 100 },
      },
    });

    render(<ResultsContextTags selectedRun={run} />);

    expect(screen.getByText(/Host: hardcoded/i)).toBeTruthy();
    expect(screen.getByText(/Arrival Rate/i)).toBeTruthy();
    expect(screen.getByText(/120 RPS/i)).toBeTruthy();
    expect(screen.getByText(/Think 100ms/i)).toBeTruthy();
  });

  it('renders load-profile tags for spike mode', () => {
    const run = makeTestRun({
      baseUrl: 'https://service.local',
      config: {
        ...makeTestRun().config,
        executionMode: 'load-profile',
        loadProfile: {
          type: 'spike',
          maxConcurrency: 40,
          durationSec: 20,
          spikeConcurrency: 120,
        },
      },
    });

    render(<ResultsContextTags selectedRun={run} />);

    expect(screen.getByText(/Host: https:\/\/service.local/i)).toBeTruthy();
    expect(screen.getByText(/Spike/i)).toBeTruthy();
    expect(screen.getByText(/Peak:40/i)).toBeTruthy();
    expect(screen.getByText(/Spike:120/i)).toBeTruthy();
  });
});
