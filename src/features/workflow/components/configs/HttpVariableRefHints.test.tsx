/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HttpVariableRefHints } from './HttpVariableRefHints';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

describe('HttpVariableRefHints', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns null for empty hints', () => {
    const { container } = render(<HttpVariableRefHints hints={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders source fallback/type placeholder and clears copied state after timeout', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const hints: WorkflowVariableHint[] = [
      {
        ref: 'node:stepA.result',
        label: 'result',
        type: undefined,
        description: 'Step result',
        source: { nodeId: 'stepA', nodeLabel: 'Step A' },
      },
      {
        ref: 'workflowId',
        label: 'Workflow ID',
        type: 'string',
      },
    ];

    render(<HttpVariableRefHints hints={hints} />);

    expect(screen.getByText('{{node:stepA.result}}')).toBeTruthy();
    expect(screen.getByText('Step A')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy {{node:stepA.result}}' }));
    expect(writeText).toHaveBeenCalledWith('{{node:stepA.result}}');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(screen.getByRole('button', { name: 'Copy {{node:stepA.result}}' })).toBeTruthy();
  });

  it('swallows clipboard failures without crashing', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const hints: WorkflowVariableHint[] = [
      { ref: 'workflowId', label: 'Workflow ID', type: 'string' },
    ];

    render(<HttpVariableRefHints hints={hints} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy {{workflowId}}' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('{{workflowId}}');
    expect(screen.getByText('{{workflowId}}')).toBeTruthy();
  });
});
