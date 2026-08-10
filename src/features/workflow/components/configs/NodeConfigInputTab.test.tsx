/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import NodeConfigInputTab from './NodeConfigInputTab';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

describe('NodeConfigInputTab', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows empty state when hints array is empty', () => {
    render(<NodeConfigInputTab hints={[]} />);
    expect(screen.getByText('No variables yet')).toBeTruthy();
    expect(screen.getByText(/Add workflow defaults/)).toBeTruthy();
  });

  it('shows card title and empty hint', () => {
    render(<NodeConfigInputTab hints={[]} />);
    expect(screen.getByText('Available variables')).toBeTruthy();
    expect(screen.getByText(/Resolved for this step at run time/)).toBeTruthy();
  });

  it('renders variable rows with source and type', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'step1.body.name', label: 'Step 1 → body.name', type: 'string' },
      {
        ref: 'env.BASE_URL',
        label: 'Workflow variable',
        type: 'string',
        source: { nodeLabel: 'workflow', category: 'Workflow', nodeType: 'workflow' },
      },
    ];
    render(<NodeConfigInputTab hints={hints} />);
    expect(screen.getByText('{{step1.body.name}}')).toBeTruthy();
    expect(screen.getByText('Step 1 → body.name')).toBeTruthy();
    expect(screen.getByText('{{env.BASE_URL}}')).toBeTruthy();
    expect(screen.getByText('workflow · Workflow')).toBeTruthy();
    expect(screen.getAllByText('string')).toHaveLength(2);
  });

  it('renders column headers', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'x', label: 'X source', type: 'string' },
    ];
    render(<NodeConfigInputTab hints={hints} />);
    expect(screen.getByText('Variable')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
    expect(screen.getByText('Type')).toBeTruthy();
  });

  it('copies variable template to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const hints: WorkflowVariableHint[] = [
      { ref: 'orderId', label: 'orderId (workflow)', type: 'string' },
    ];
    render(<NodeConfigInputTab hints={hints} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy {{orderId}}' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('{{orderId}}');
    });
    expect(screen.getByRole('button', { name: 'Copied {{orderId}}' })).toBeTruthy();
  });

  it('renders fallback source label and empty type placeholder', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'response.value', label: 'Response value label' },
    ];
    render(<NodeConfigInputTab hints={hints} />);
    expect(screen.getByText('Response value label')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders nodeLabel without category separator when source category is missing', () => {
    const hints: WorkflowVariableHint[] = [
      {
        ref: 'step2.id',
        label: 'fallback label',
        source: { nodeLabel: 'Step 2', nodeType: 'http' },
      },
    ];
    render(<NodeConfigInputTab hints={hints} />);
    expect(screen.getByText('Step 2')).toBeTruthy();
    expect(screen.queryByText('Step 2 ·')).toBeNull();
  });

  it('keeps copy button state when clipboard write fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const hints: WorkflowVariableHint[] = [
      { ref: 'orderId', label: 'orderId (workflow)', type: 'string' },
    ];
    render(<NodeConfigInputTab hints={hints} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy {{orderId}}' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('{{orderId}}');
    });
    expect(screen.queryByRole('button', { name: 'Copied {{orderId}}' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy {{orderId}}' })).toBeTruthy();
  });

  it('schedules copied-state reset timeout after successful copy', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const hints: WorkflowVariableHint[] = [
      { ref: 'orderId', label: 'orderId (workflow)', type: 'string' },
    ];
    render(<NodeConfigInputTab hints={hints} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy {{orderId}}' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Copied {{orderId}}' })).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByRole('button', { name: 'Copy {{orderId}}' })).toBeTruthy();
    vi.useRealTimers();
  });
});
