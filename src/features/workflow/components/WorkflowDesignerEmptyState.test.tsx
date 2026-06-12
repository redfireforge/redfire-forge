/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkflowDesignerEmptyState from './WorkflowDesignerEmptyState';

describe('WorkflowDesignerEmptyState', () => {
  it('renders the empty state content', () => {
    const { container } = render(<WorkflowDesignerEmptyState />);
    expect(container.querySelector('.wf-designer')).toBeTruthy();
    expect(container.querySelector('.wf-empty-state')).toBeTruthy();
    expect(screen.getByText('⚡')).toBeTruthy();
    expect(screen.getByText('Workflow Designer')).toBeTruthy();
    expect(screen.getByText(/Design multi-step API workflows/)).toBeTruthy();
    expect(screen.getByText(/Select a workflow from the sidebar/)).toBeTruthy();
  });
});
