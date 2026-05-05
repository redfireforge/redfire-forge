/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import WorkflowToolbar from './WorkflowToolbar';
import type { Workflow } from '../../types/workflow';

const mockWorkflow: Workflow = {
  id: 'wf-1',
  name: 'Test Workflow',
  nodes: [],
  edges: [],
  variables: {},
  services: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('WorkflowToolbar', () => {
  const defaultProps = {
    workflows: [mockWorkflow],
    selected: mockWorkflow,
    isRunning: false,
    onNew: vi.fn(),
    onSelect: vi.fn(),
    onSave: vi.fn(),
    onQuickTest: vi.fn(),
  };

  it('renders "Run in Harness" button when workflow is selected and callback provided', () => {
    const onRunInHarness = vi.fn();
    render(<WorkflowToolbar {...defaultProps} onRunInHarness={onRunInHarness} />);

    const button = screen.getByRole('button', { name: /run in harness/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('does not render "Run in Harness" button when no callback provided', () => {
    render(<WorkflowToolbar {...defaultProps} />);

    expect(screen.queryByRole('button', { name: /run in harness/i })).not.toBeInTheDocument();
  });

  it('does not render "Run in Harness" button in preview mode', () => {
    const onRunInHarness = vi.fn();
    render(<WorkflowToolbar {...defaultProps} isPreview={true} onRunInHarness={onRunInHarness} />);

    expect(screen.queryByRole('button', { name: /run in harness/i })).not.toBeInTheDocument();
  });

  it('calls onRunInHarness when button is clicked', () => {
    const onRunInHarness = vi.fn();
    render(<WorkflowToolbar {...defaultProps} onRunInHarness={onRunInHarness} />);

    fireEvent.click(screen.getByRole('button', { name: /run in harness/i }));
    expect(onRunInHarness).toHaveBeenCalledTimes(1);
  });

  it('disables "Run in Harness" button when running', () => {
    const onRunInHarness = vi.fn();
    render(<WorkflowToolbar {...defaultProps} isRunning={true} onRunInHarness={onRunInHarness} />);

    expect(screen.getByRole('button', { name: /run in harness/i })).toBeDisabled();
  });
});
