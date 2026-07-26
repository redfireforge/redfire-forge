/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkflowServicesPanelInline from './WorkflowServicesPanelInline';
import type { WorkflowService } from '../../types/workflow';
import type { Environment, GlobalAuthProfile, Microservice } from '../../../../shared/types';

vi.mock('../modals/WorkflowServiceRegistryModal', () => ({
  resolveInheritLabel: () => 'Inherited Auth',
  authSummary: () => 'Custom Auth',
}));

vi.mock('../../../requests/utils/requestAuthState', () => ({
  authToState: () => ({ type: 'none' }),
}));

const environments = [{ id: 'env1', name: 'Dev' }] as unknown as Environment[];
const microservices = [] as unknown as Microservice[];
const globalAuthProfiles = [] as unknown as GlobalAuthProfile[];

const makeService = (over: Partial<WorkflowService> = {}): WorkflowService => ({
  id: 's1',
  name: 'Orders',
  endpoints: [],
  ...over,
}) as WorkflowService;

describe('WorkflowServicesPanelInline', () => {
  const baseProps = {
    environments,
    microservices,
    globalAuthProfiles,
    selectedEnvId: 'env1',
    onExpand: vi.fn(),
    onClose: vi.fn(),
  };

  it('shows empty message when no services', () => {
    const { container } = render(<WorkflowServicesPanelInline {...baseProps} services={[]} />);
    expect(container.querySelector('.wf-svc-inline-empty')?.textContent).toMatch(/No services configured/);
  });

  it('shows env name in column header', () => {
    render(<WorkflowServicesPanelInline {...baseProps} services={[]} />);
    expect(screen.getByText(/URL \(Dev\)/)).toBeTruthy();
  });

  it('renders a ready service with custom auth', () => {
    const svc = makeService({
      endpoints: [{ envId: 'env1', url: 'https://api.dev', enabled: true, authMode: 'custom', source: 'manual' }],
    });
    render(<WorkflowServicesPanelInline {...baseProps} services={[svc]} />);
    expect(screen.getByText('Orders')).toBeTruthy();
    expect(screen.getByText('https://api.dev')).toBeTruthy();
    expect(screen.getByText('Custom Auth')).toBeTruthy();
  });

  it('renders a missing endpoint (disabled) with inherited auth', () => {
    const svc = makeService({
      endpoints: [{ envId: 'env1', url: '', enabled: false, authMode: 'inherit', source: 'manual' }],
    });
    render(<WorkflowServicesPanelInline {...baseProps} services={[svc]} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('Inherited Auth')).toBeTruthy();
  });

  it('renders dash auth when no endpoint for selected env', () => {
    const svc = makeService({
      endpoints: [{ envId: 'other', url: 'x', enabled: true, authMode: 'custom', source: 'manual' }],
    });
    render(<WorkflowServicesPanelInline {...baseProps} services={[svc]} />);
    expect(screen.getByText('Orders')).toBeTruthy();
  });

  it('handles missing selectedEnvId (status none, fallback label)', () => {
    const svc = makeService({ endpoints: [] });
    render(<WorkflowServicesPanelInline {...baseProps} selectedEnvId="" services={[svc]} />);
    expect(screen.getByText(/URL \(no env\)/)).toBeTruthy();
  });

  it('fires onExpand and onClose', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkflowServicesPanelInline {...baseProps} services={[]} onExpand={onExpand} onClose={onClose} />,
    );
    await user.click(screen.getByTitle('Open Service Registry'));
    await user.click(screen.getByTitle('Close panel'));
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
