// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BaselineListPanel } from './BaselineListPanel';
import type { TestRun } from '../../../shared/types';
import type { BaselineMark } from '../utils/runBaselines';

function makeRun(id: string, ts = Date.now()): TestRun {
  return {
    id,
    timestamp: ts,
    config: { scenarios: [], concurrency: 5, iterations: 100, executionMode: 'pool' as const } as TestRun['config'],
    summary: {
      tps: 50, avgResponseTime: 80, minResponseTime: 10, maxResponseTime: 300,
      p50ResponseTime: 70, p95ResponseTime: 150, p99ResponseTime: 200,
      errorRate: 1, errorsByStatus: {}, totalRequests: 500,
      successfulRequests: 495, failedRequests: 5, failedValidations: 0, totalDurationMs: 10000,
    },
    results: [],
  };
}

function makeMark(runId: string, label?: string): BaselineMark {
  return { runId, markedAt: Date.now(), label };
}

describe('BaselineListPanel', () => {
  it('renders nothing when baselines is empty', () => {
    const { container } = render(
      <BaselineListPanel baselines={[]} runs={[]} selectedRunId="" onCompare={vi.fn()} onUnmark={vi.fn()} onRename={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a row per baseline', () => {
    const runs = [makeRun('r1'), makeRun('r2')];
    const baselines = [makeMark('r1', 'Sprint 1'), makeMark('r2', 'Sprint 2')];
    const { container } = render(
      <BaselineListPanel baselines={baselines} runs={runs} selectedRunId="" onCompare={vi.fn()} onUnmark={vi.fn()} onRename={vi.fn()} />,
    );
    expect(container.querySelectorAll('.baseline-list-item')).toHaveLength(2);
    expect(container.textContent).toContain('Sprint 1');
    expect(container.textContent).toContain('Sprint 2');
  });

  it('shows Compare button when run is in the filtered view and is not selected', () => {
    const run = makeRun('r1');
    const { container } = render(
      <BaselineListPanel
        baselines={[makeMark('r1', 'Baseline')]}
        runs={[run]}
        selectedRunId="other"
        onCompare={vi.fn()}
        onUnmark={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const compareBtn = container.querySelector('.btn:not(.btn-danger)');
    expect(compareBtn?.textContent).toContain('Compare');
  });

  it('hides Compare button when baseline run is not in the filtered view (Bug H)', () => {
    // The baseline exists (runId known) but the run is NOT in the `runs` array
    // (e.g., a workflow baseline while the "Test Runs" filter is active).
    const { container } = render(
      <BaselineListPanel
        baselines={[makeMark('workflow-run-1', 'WF Baseline')]}
        runs={[]}  // filtered view excludes this run
        selectedRunId="other"
        onCompare={vi.fn()}
        onUnmark={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    // Unmark should still be present, but Compare must be hidden
    const buttons = container.querySelectorAll('button');
    const compareBtn = [...buttons].find((b) => b.textContent?.includes('Compare'));
    expect(compareBtn).toBeUndefined();
    const unmarkBtn = [...buttons].find((b) => b.textContent?.includes('Unmark'));
    expect(unmarkBtn).toBeTruthy();
  });

  it('hides Compare button for the currently selected run', () => {
    const run = makeRun('r1');
    const { container } = render(
      <BaselineListPanel
        baselines={[makeMark('r1', 'Baseline')]}
        runs={[run]}
        selectedRunId="r1"  // this is the selected run
        onCompare={vi.fn()}
        onUnmark={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const buttons = container.querySelectorAll('button');
    const compareBtn = [...buttons].find((b) => b.textContent?.includes('Compare'));
    expect(compareBtn).toBeUndefined();
  });

  it('calls onCompare with the runId when Compare is clicked', () => {
    const onCompare = vi.fn();
    const run = makeRun('r1');
    const { container } = render(
      <BaselineListPanel
        baselines={[makeMark('r1', 'Baseline')]}
        runs={[run]}
        selectedRunId="other"
        onCompare={onCompare}
        onUnmark={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const compareBtn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Compare'))!;
    fireEvent.click(compareBtn);
    expect(onCompare).toHaveBeenCalledWith('r1');
  });

  it('calls onUnmark with the runId when Unmark is clicked', () => {
    const onUnmark = vi.fn();
    const run = makeRun('r1');
    const { container } = render(
      <BaselineListPanel
        baselines={[makeMark('r1', 'Baseline')]}
        runs={[run]}
        selectedRunId="other"
        onCompare={vi.fn()}
        onUnmark={onUnmark}
        onRename={vi.fn()}
      />,
    );
    const unmarkBtn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Unmark'))!;
    fireEvent.click(unmarkBtn);
    expect(onUnmark).toHaveBeenCalledWith('r1');
  });

  it('inline rename: clicking label opens input; blur commits', () => {
    const onRename = vi.fn();
    const run = makeRun('r1');
    const { container } = render(
      <BaselineListPanel
        baselines={[makeMark('r1', 'Old Label')]}
        runs={[run]}
        selectedRunId="other"
        onCompare={vi.fn()}
        onUnmark={vi.fn()}
        onRename={onRename}
      />,
    );
    // Click the label to start editing
    const label = container.querySelector('.baseline-list-label')!;
    fireEvent.click(label);
    const input = container.querySelector('.baseline-list-edit-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    // Type a new name and blur
    fireEvent.change(input, { target: { value: 'New Label' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('r1', 'New Label');
  });

  it('inline rename: Escape key cancels without calling onRename', () => {
    const onRename = vi.fn();
    const run = makeRun('r1');
    const { container } = render(
      <BaselineListPanel
        baselines={[makeMark('r1', 'Old Label')]}
        runs={[run]}
        selectedRunId="other"
        onCompare={vi.fn()}
        onUnmark={vi.fn()}
        onRename={onRename}
      />,
    );
    const label = container.querySelector('.baseline-list-label')!;
    fireEvent.click(label);
    const input = container.querySelector('.baseline-list-edit-input')!;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    // Input should be gone after cancel
    expect(container.querySelector('.baseline-list-edit-input')).toBeNull();
  });

  it('shows baseline-list-item-current class for selected baseline', () => {
    const run = makeRun('r1');
    const { container } = render(
      <BaselineListPanel
        baselines={[makeMark('r1', 'Baseline')]}
        runs={[run]}
        selectedRunId="r1"
        onCompare={vi.fn()}
        onUnmark={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(container.querySelector('.baseline-list-item-current')).toBeTruthy();
  });

  it('falls back to truncated runId when run is not in the filtered view', () => {
    const { container } = render(
      <BaselineListPanel
        baselines={[makeMark('abcdefghijklmnop')]}
        runs={[]}
        selectedRunId="other"
        onCompare={vi.fn()}
        onUnmark={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    // Should show first 12 chars of runId as fallback label
    expect(container.textContent).toContain('abcdefghijkl');
  });
});
