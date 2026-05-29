// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResultsRunSelect } from './ResultsRunSelect';
import { makeSummary, makeTestRun } from '../../../test-utils/factories';

function makeRun(id: string, projectName: string, timestamp: number) {
  return makeTestRun({
    id,
    projectName,
    timestamp,
    envName: 'dev',
    svcName: 'svc-a',
    summary: makeSummary({ totalRequests: 10, tps: 5 }),
    config: { ...makeTestRun().config, executionMode: 'pool' },
  });
}

describe('ResultsRunSelect', () => {
  it('renders fallback label when there are no runs', () => {
    render(
      <ResultsRunSelect
        runs={[]}
        value=""
        baselines={[]}
        runSlaStatuses={new Map()}
        runRegressionStatuses={new Map()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Select a run...')).toBeTruthy();
  });

  it('opens listbox, selects option and closes', async () => {
    const onChange = vi.fn();
    const runA = makeRun('run-a', 'Project A', 1000);
    const runB = makeRun('run-b', 'Project B', 2000);

    render(
      <ResultsRunSelect
        runs={[runB, runA]}
        value="run-b"
        baselines={[{ runId: 'run-a', markedAt: 1 }]}
        runSlaStatuses={new Map([['run-a', 'pass'], ['run-b', 'warn']])}
        runRegressionStatuses={new Map([['run-a', 'critical'], ['run-b', 'pass']])}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(await screen.findByRole('listbox')).toBeTruthy();

    const option = screen.getByRole('option', { name: /Project A/i });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('run-a');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('supports keyboard open and escape close', async () => {
    const run = makeRun('run-a', 'Project A', 1000);
    render(
      <ResultsRunSelect
        runs={[run]}
        value="run-a"
        baselines={[]}
        runSlaStatuses={new Map()}
        runRegressionStatuses={new Map()}
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(await screen.findByRole('listbox')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('opens with Enter and Space keys and picks first run when value is missing', async () => {
    const runA = makeRun('run-a', 'Project A', 1000);
    const runB = makeRun('run-b', 'Project B', 2000);
    render(
      <ResultsRunSelect
        runs={[runA, runB]}
        value="missing-id"
        baselines={[]}
        runSlaStatuses={new Map([['run-a', 'no-data'], ['run-b', null]])}
        runRegressionStatuses={new Map([['run-a', 'warn']])}
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Project A/i });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(await screen.findByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('closes when clicking outside the component', async () => {
    const run = makeRun('run-a', 'Project A', 1000);
    render(
      <ResultsRunSelect
        runs={[run]}
        value="run-a"
        baselines={[]}
        runSlaStatuses={new Map()}
        runRegressionStatuses={new Map()}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('listbox')).toBeTruthy();
    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });
});
