/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '../../../../test-utils/customSelectHelper';
import WorkflowRequestsSettingsModal from './WorkflowRequestsSettingsModal';
import type { Workflow, WorkflowNode } from '../../types/workflow';
import type { Environment, GlobalAuthProfile, Microservice } from '@shared/types';

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

function configField(label: string): HTMLElement {
  const field = Array.from(document.querySelectorAll('.wf-config-field')).find(
    (el) => el.querySelector('label')?.textContent === label,
  );
  if (!field) throw new Error(`Missing config field: ${label}`);
  return field as HTMLElement;
}

function switchToRequestOnlyHost() {
  fireEvent.click(document.querySelectorAll('input[name="wf-bulk-host-mode"]')[1]);
}

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
    switchToRequestOnlyHost();
    const customSelects = document.querySelectorAll('.wf-config-field .cs-wrapper');
    expect(customSelects.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Environment')).toBeTruthy();
    expect(screen.getByText('Microservice')).toBeTruthy();
  });

  it('changes environment select', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    switchToRequestOnlyHost();
    selectOption(configField('Environment'), 'Dev');
    expect(configField('Environment').querySelector('.cs-text')?.textContent).toBe('Dev');
    selectOption(configField('Environment'), 'Environment...');
  });

  it('changes auth type to bearer and edits token', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    selectOption(configField('Auth Type'), 'Bearer Token');
    expect(screen.getByText('Token')).toBeTruthy();
    const prefixInput = screen.getByText('Prefix').parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.change(prefixInput, { target: { value: 'JWT' } });
    const tokenInput = screen.getByText('Token').parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.change(tokenInput, { target: { value: 'abc123' } });
    expect((screen.getByText('Token').parentElement!.querySelector('input') as HTMLInputElement).value).toBe('abc123');
  });

  it('changes auth type to basic', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    selectOption(configField('Auth Type'), 'Basic Auth');
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
    selectOption(configField('Auth Type'), 'Global Auth Profile');
    expect(screen.getByText('Corp (bearer)')).toBeTruthy();
    selectOption(configField('Global Auth Profile'), 'Corp (bearer)');
    expect(configField('Global Auth Profile').querySelector('.cs-text')?.textContent).toBe('Corp (bearer)');
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

  it('switches back to harness bar host mode and changes microservice', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    switchToRequestOnlyHost();
    selectOption(configField('Microservice'), 'Users');
    expect(configField('Microservice').querySelector('.cs-text')?.textContent).toBe('Users');
    fireEvent.click(document.querySelectorAll('input[name="wf-bulk-host-mode"]')[0]);
    expect(screen.queryByText('Environment')).toBeNull();
  });

  it('shows HTTP step fallback label when label is empty', () => {
    const wf: Workflow = {
      ...workflow,
      nodes: [{
        id: 'h0',
        type: 'http',
        position: { x: 0, y: 0 },
        data: { label: '', scenario: { name: '', method: 'GET', url: '/x', auth: { type: 'none' } } },
      } as unknown as WorkflowNode],
    };
    render(<WorkflowRequestsSettingsModal {...baseProps} workflow={wf} />);
    expect(screen.getByText('HTTP step')).toBeTruthy();
  });

  it('changes auth type to apikey and oauth2', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} />);
    selectOption(configField('Auth Type'), 'API Key');
    selectOption(configField('Auth Type'), 'OAuth2 Client Credentials');
    expect(configField('Auth Type').querySelector('.cs-text')?.textContent).toBe('OAuth2 Client Credentials');
  });

  it('global-profile option does nothing when no profiles exist', () => {
    render(<WorkflowRequestsSettingsModal {...baseProps} globalAuthProfiles={[]} />);
    const authField = configField('Auth Type');
    fireEvent.click(authField.querySelector('.cs-trigger')!);
    const labels = Array.from(authField.querySelectorAll('.cs-item-label')).map((el) => el.textContent);
    expect(labels.some((l) => l === 'Global Auth Profile')).toBe(false);
  });

  it('changes environment and clears microservice when env reset', () => {
    const extraMs: Microservice[] = [
      ...microservices,
      { id: 'ms2', name: 'Orders', baseUrls: { env2: 'http://orders.prod' } } as unknown as Microservice,
    ];
    render(<WorkflowRequestsSettingsModal {...baseProps} microservices={extraMs} />);
    switchToRequestOnlyHost();
    selectOption(configField('Environment'), 'Prod');
    expect(configField('Environment').querySelector('.cs-text')?.textContent).toBe('Prod');
    selectOption(configField('Microservice'), 'Microservice...');
    expect(configField('Microservice').querySelector('.cs-text')?.textContent).toBe('Microservice...');
  });

  it('does not switch to per-request host mode when no environments exist', () => {
    render(
      <WorkflowRequestsSettingsModal
        {...baseProps}
        environments={[]}
        harnessEnvId=""
        harnessSvcId=""
      />,
    );
    fireEvent.click(document.querySelectorAll('input[name="wf-bulk-host-mode"]')[1]);
    expect(screen.queryByText('Environment')).toBeNull();
  });
});
