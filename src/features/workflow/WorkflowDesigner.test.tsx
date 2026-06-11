/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkflowDesignerWrapper from './WorkflowDesigner';

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@xyflow/react/dist/style.css', () => ({}));

const mockController = vi.fn();
vi.mock('./hooks/useWorkflowDesignerController', () => ({
  useWorkflowDesignerController: (props: unknown) => mockController(props),
}));
vi.mock('./components/WorkflowDesignerEmptyState', () => ({
  default: () => <div data-testid="empty" />,
}));
vi.mock('./components/WorkflowDesignerMainLayout', () => ({
  default: () => <div data-testid="main" />,
}));

describe('WorkflowDesignerWrapper', () => {
  it('renders empty state when no workflow selected', () => {
    mockController.mockReturnValue({ selected: null });
    render(<WorkflowDesignerWrapper {...({} as never)} />);
    expect(screen.getByTestId('empty')).toBeTruthy();
  });

  it('renders main layout when a workflow is selected', () => {
    mockController.mockReturnValue({ selected: { id: 'w1', name: 'WF' } });
    render(<WorkflowDesignerWrapper {...({} as never)} />);
    expect(screen.getByTestId('main')).toBeTruthy();
  });
});
