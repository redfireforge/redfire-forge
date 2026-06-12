/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowRequestsSettingsModal from './WorkflowRequestsSettingsModal';
import type { Workflow, WorkflowNode } from '../../types/workflow';
import type { Environment, GlobalAuthProfile, Microservice } from '../../../../shared/types';

vi.mock('./WorkflowEditorModalFrame', () => ({
  default: ({ open, title, children, footer, onClose }: {
    open: boolean;
    title: React.ReactNode;
    children: React.ReactNode;
    footer: React.ReactNode;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="frame">
        <div>{title}</div>
        <button data-testid="frame-x" onClick={onClose}>x</button>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
}));

const httpNode = (id: string, label: string): WorkflowNode => ({
  id,
  type: 'http',
  position: { x: 0, y: 0 },
  data: {
    label,
    scenario: { name: label, method: 'GET', url: '/x', auth: { type: 'none' } },
  },
} as unknown as WorkflowNode);

const workflow: Workflow = {
  id: 'wf1',
  name: 'My WF',
  nodes: [
    httpNode('h1', 'First'),
    httpNode('h2', 'Second'),
    { id: 'd1', type: 'delay', position: { x: 0, y: 0 }, data: {} } as unknown as WorkflowNode,
  ],
} as unknown as Workflow;

const emptyWorkflow: Workflow = {
  id: 'wf2',
  name: 'Empty',
  nodes: [{ id: 'd1', type: 'delay', position: { x: 0, y: 0 }, data: {} } as unknown as WorkflowNode],
} as unknown as Workflow;

const environments: Environment[] = [
  { id: 'env1', name: 'Dev' } as unknown as Environment,
  { id: 'env2', name: 'Prod' } as unknown as Environment,
];

const microservices: Microservice[] = [
  { id: 'ms1', name: 'Users', baseUrls: { env1: 'http://users.dev' } } as unknown as Microservice,
];

const globalAuthProfiles: GlobalAuthProfile[] = [
  { id: 'gp1', name: 'Corp', auth: { type: 'bearer', token: 't' } } as unknown as GlobalAuthProfile,
];

const baseProps = {
  open: true,
  workflow,
  environments,
  microservices,
  globalAuthProfiles,
  harnessEnvId: 'env1',
  harnessSvcId: 'ms1',
  harnessBaseUrl: 'http://harness',
  onApply: vi.fn(),
  onClose: vi.fn(),
};

describe('WorkflowRequestsSettingsModal', () => {
  it('renders nothing when closed or workflow null', () => {
    const { container: c1 } = render(<WorkflowRequestsSettingsModal {...baseProps} open={false} />);
    expect(c1.innerHTML).toBe('');
    const { container: c2 } = render(<WorkflowRequestsSettingsModal {...baseProps} workflow={null} />);
    expect(c2.innerHTML).toBe('');
  });

  it('lists http nodes and selects first by default', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    const nameInput = document.querySelector('.wf-config-field input') as HTMLInputElement;
    expect(nameInput.value).toBe('First');
  });

  it('shows empty state and disables Apply when no http nodes', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} workflow={emptyWorkflow} />);
    expect(screen.getByText('No HTTP requests in this workflow.')).toBeTruthy();
    const apply = screen.getByText('Apply') as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
  });

  it('selects a different request', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Second'));
    const nameInput = document.querySelector('.wf-config-field input') as HTMLInputElement;
    expect(nameInput.value).toBe('Second');
  });

  it('edits request name', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    const nameInput = document.querySelector('.wf-config-field input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Renamed' } });
    expect((document.querySelector('.wf-config-field input') as HTMLInputElement).value).toBe('Renamed');
  });

  it('switches to "this request only" host mode and shows env/microservice selects', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    const radios = document.querySelectorAll('input[name="wf-bulk-host-mode"]');
    fireEvent.click(radios[1]);
    const selects = document.querySelectorAll('.wf-config-field select');
    // env + microservice + auth type
    expect(selects.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Environment')).toBeTruthy();
    expect(screen.getByText('Microservice')).toBeTruthy();
  });

  it('changes environment select', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    fireEvent.click(document.querySelectorAll('input[name="wf-bulk-host-mode"]')[1]);
    const envSelect = document.querySelectorAll('.wf-config-field select')[0] as HTMLSelectElement;
    fireEvent.change(envSelect, { target: { value: 'env1' } });
    expect(envSelect.value).toBe('env1');
    // reset env to empty
    fireEvent.change(envSelect, { target: { value: '' } });
  });

  it('changes auth type to bearer and edits token', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    const authSelect = Array.from(document.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.value === 'bearer'),
    ) as HTMLSelectElement;
    fireEvent.change(authSelect, { target: { value: 'bearer' } });
    expect(screen.getByText('Token')).toBeTruthy();
    const prefixInput = screen.getByText('Prefix').parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.change(prefixInput, { target: { value: 'JWT' } });
    const tokenInput = screen.getByText('Token').parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.change(tokenInput, { target: { value: 'abc123' } });
    expect((screen.getByText('Token').parentElement!.querySelector('input') as HTMLInputElement).value).toBe('abc123');
  });

  it('changes auth type to basic', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    const authSelect = Array.from(document.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.value === 'basic'),
    ) as HTMLSelectElement;
    fireEvent.change(authSelect, { target: { value: 'basic' } });
    expect(screen.getByText('Username')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
    const userInput = screen.getByText('Username').parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.change(userInput, { target: { value: 'admin' } });
    const passInput = screen.getByText('Password').parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.change(passInput, { target: { value: 'secret' } });
    expect((screen.getByText('Username').parentElement!.querySelector('input') as HTMLInputElement).value).toBe('admin');
  });

  it('selects a global auth profile', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    const authSelect = Array.from(document.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.value === 'global-profile'),
    ) as HTMLSelectElement;
    fireEvent.change(authSelect, { target: { value: 'global-profile' } });
    expect(screen.getByText('Corp (bearer)')).toBeTruthy();
    const profileSelect = Array.from(document.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.value === 'gp1'),
    ) as HTMLSelectElement;
    fireEvent.change(profileSelect, { target: { value: 'gp1' } });
    expect(profileSelect.value).toBe('gp1');
  });

  it('Apply calls onApply with workflow id and nodes, then onClose', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<WorkflowRequestsSettingsModal {...baseProps} onApply={onApply} onClose={onClose} />);
    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalledWith('wf1', expect.any(Array));
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel calls onClose', () => {
    const onClose = vi.fn();
    render(<WorkflowRequestsSettingsModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
