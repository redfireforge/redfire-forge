/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NodeConfigInputTab from './NodeConfigInputTab';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

describe('NodeConfigInputTab', () => {
  it('shows empty state when hints array is empty', () => {
    render(<NodeConfigInputTab hints={[]} />);
    expect(screen.getByText('No variables available for this step')).toBeTruthy();
  });

  it('shows hint text', () => {
    render(<NodeConfigInputTab hints={[]} />);
    expect(screen.getByText(/Resolved variables available to this step/)).toBeTruthy();
  });

  it('renders a table of variable hints', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'step1.body.name', label: 'Step 1 → body.name', type: 'string' },
      { ref: 'env.BASE_URL', label: 'Workflow variable', type: 'string' },
    ];
    render(<NodeConfigInputTab hints={hints} />);
    expect(screen.getByText('{{step1.body.name}}')).toBeTruthy();
    expect(screen.getByText('Step 1 → body.name')).toBeTruthy();
    expect(screen.getByText('{{env.BASE_URL}}')).toBeTruthy();
    expect(screen.getByText('Workflow variable')).toBeTruthy();
  });

  it('renders table headers', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'x', label: 'X source', type: 'string' },
    ];
    render(<NodeConfigInputTab hints={hints} />);
    expect(screen.getByText('Variable')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
  });
});
