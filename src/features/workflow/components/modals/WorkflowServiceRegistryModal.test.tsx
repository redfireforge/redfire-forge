/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption, selectOptionByIndex } from '../../../../test-utils/customSelectHelper';
import WorkflowServiceRegistryModal, {
  resolveInheritLabel,
  authSummary,
} from './WorkflowServiceRegistryModal';
import type { WorkflowService, ServiceEndpoint } from '../../types/workflow';
import type { Environment, GlobalAuthProfile, Microservice } from '../../../../shared/types';
import { emptyAuthState } from '../../../requests/utils/requestAuthState';

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

const environments: Environment[] = [
  { id: 'env1', name: 'Dev' } as unknown as Environment,
  { id: 'env2', name: 'Prod' } as unknown as Environment,
];

const microservices: Microservice[] = [
  {
    id: 'ms1',
    name: 'Users',
    baseUrls: { env1: 'http://users.dev', env2: 'http://users.prod' },
    authProfileIds: { env1: 'gp1' },
  } as unknown as Microservice,
];

const globalAuthProfiles: GlobalAuthProfile[] = [
  { id: 'gp1', name: 'Corp', auth: { type: 'bearer', token: 't' } } as unknown as GlobalAuthProfile,
];

const services: WorkflowService[] = [
  {
    id: 's1',
    name: 'svc-a',
    endpoints: [
      { envId: 'env1', url: 'http://x', enabled: true, authMode: 'inherit', source: 'manual' },
    ],
    defaultAuth: { type: 'none' },
  } as unknown as WorkflowService,
];

const baseProps = {
  open: true,
  services,
  environments,
  microservices,
  globalAuthProfiles,
  selectedEnvId: 'env1',
  workflowName: 'WF',
  onApply: vi.fn(),
  onClose: vi.fn(),
};

describe('WorkflowServiceRegistryModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<WorkflowServiceRegistryModal {...baseProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders service list and selects first', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    expect(screen.getByText('svc-a')).toBeTruthy();
    const nameInput = document.querySelector('.wf-svc-top-fields input') as HTMLInputElement;
    expect(nameInput.value).toBe('svc-a');
  });

  it('shows empty list message when no services', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} services={[]} />);
    expect(screen.getByText(/No services yet/)).toBeTruthy();
    expect(screen.getByText(/Select a service on the left/)).toBeTruthy();
  });

  it('adds a service', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} services={[]} />);
    fireEvent.click(document.querySelector('.wf-svc-registry-left-head button') as HTMLButtonElement);
    expect(screen.getByText('service-1')).toBeTruthy();
  });

  it('edits service name', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    const nameInput = document.querySelector('.wf-svc-top-fields input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'renamed' } });
    expect((document.querySelector('.wf-svc-top-fields input') as HTMLInputElement).value).toBe('renamed');
  });

  it('links a microservice and auto-populates urls', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    selectOption(document.querySelector('.wf-svc-top-fields')!, 'Users');
    expect(screen.getByText(/URLs auto-populated/)).toBeTruthy();
    selectOption(document.querySelector('.wf-svc-top-fields')!, 'None (manual)');
  });

  it('toggles endpoint enabled and edits url', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    const checkbox = document.querySelector('.wf-svc-matrix-col-on input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    const urlInput = document.querySelector('.wf-svc-matrix-col-url input') as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: 'http://new' } });
    expect(urlInput.value).toBe('http://new');
  });

  it('expands inline auth and cycles through auth types', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    const toggle = document.querySelector('.wf-svc-auth-toggle') as HTMLButtonElement;
    fireEvent.click(toggle);
    const expanded = document.querySelector('.wf-svc-matrix-auth-expanded')!;
    selectOption(expanded, 'Bearer Token');
    expect(screen.getByText('Token')).toBeTruthy();
    selectOption(expanded, 'Basic Auth');
    expect(screen.getByText('Username')).toBeTruthy();
    selectOption(expanded, 'API Key');
    expect(screen.getByText('Key Name')).toBeTruthy();
    selectOption(expanded, 'OAuth2 Client Credentials');
    expect(screen.getByText('Token URL')).toBeTruthy();
    selectOption(expanded, 'Global Auth Profile');
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('edits inline bearer fields and resets to inherit', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    fireEvent.click(document.querySelector('.wf-svc-auth-toggle') as HTMLButtonElement);
    const expanded = document.querySelector('.wf-svc-matrix-auth-expanded')!;
    selectOption(expanded, 'Bearer Token');
    const prefix = screen.getByText('Prefix').parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.change(prefix, { target: { value: 'JWT' } });
    const token = screen.getByText('Token').parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.change(token, { target: { value: 'tok' } });
    selectOption(expanded, 'Basic Auth');
    fireEvent.change(screen.getByText('Username').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'u' } });
    fireEvent.change(screen.getByText('Password').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'p' } });
    selectOption(expanded, 'API Key');
    fireEvent.change(screen.getByText('Key Name').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'X' } });
    fireEvent.change(screen.getByText('Key Value').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'v' } });
    selectOption(screen.getByText('In').closest('.wf-config-field')!, 'Query');
    selectOption(expanded, 'OAuth2 Client Credentials');
    fireEvent.change(screen.getByText('Token URL').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'http://t' } });
    fireEvent.change(screen.getByText('Client ID').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'c' } });
    fireEvent.change(screen.getByText('Client Secret').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 's' } });
    fireEvent.click(screen.getByText('Reset to Inherit'));
    expect(document.querySelector('.wf-svc-matrix-auth-expanded')).toBeNull();
  });

  it('collapses an expanded row by clicking toggle again', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    const toggle = document.querySelector('.wf-svc-auth-toggle') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(document.querySelector('.wf-svc-matrix-auth-expanded')).toBeTruthy();
    fireEvent.click(document.querySelector('.wf-svc-auth-toggle') as HTMLButtonElement);
    expect(document.querySelector('.wf-svc-matrix-auth-expanded')).toBeNull();
  });

  it('expands inline auth when microservice linked (prefills from env profile)', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    selectOption(document.querySelector('.wf-svc-top-fields')!, 'Users');
    const toggle = document.querySelector('.wf-svc-auth-toggle') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(document.querySelector('.wf-svc-matrix-auth-expanded')).toBeTruthy();
  });

  it('applies and cancels', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<WorkflowServiceRegistryModal {...baseProps} onApply={onApply} onClose={onClose} />);
    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    render(<WorkflowServiceRegistryModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getAllByText('Cancel')[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders without selectedEnvId (no dot)', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} selectedEnvId="" workflowName={undefined} />);
    expect(screen.getByText('svc-a')).toBeTruthy();
  });

  it('selects a different service row and shows missing env dot', () => {
    const twoServices: WorkflowService[] = [
      {
        id: 's1',
        name: 'svc-a',
        endpoints: [
          { envId: 'env1', url: 'http://x', enabled: true, authMode: 'inherit', source: 'manual' },
          { envId: 'env2', url: 'http://y', enabled: true, authMode: 'inherit', source: 'manual' },
        ],
        defaultAuth: { type: 'none' },
      } as unknown as WorkflowService,
      { id: 's2', name: 'svc-b', endpoints: [], defaultAuth: { type: 'none' } } as unknown as WorkflowService,
    ];
    render(<WorkflowServiceRegistryModal {...baseProps} services={twoServices} selectedEnvId="env2" />);
    expect(document.querySelector('.wf-svc-env-dot.ready')).toBeTruthy();
    fireEvent.click(screen.getByText('svc-b'));
    expect((document.querySelector('.wf-svc-top-fields input') as HTMLInputElement).value).toBe('svc-b');
    expect(document.querySelector('.wf-svc-env-dot.missing')).toBeTruthy();
  });

  it('expands custom auth row without inherit prefill', () => {
    const customSvc: WorkflowService[] = [{
      id: 's3',
      name: 'custom-auth',
      endpoints: [{
        envId: 'env1',
        url: 'http://x',
        enabled: true,
        authMode: 'custom',
        auth: { type: 'bearer', token: 'x' },
        source: 'manual',
      }],
      defaultAuth: { type: 'none' },
    } as unknown as WorkflowService];
    render(<WorkflowServiceRegistryModal {...baseProps} services={customSvc} />);
    const toggle = document.querySelector('.wf-svc-auth-toggle') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(document.querySelector('.wf-svc-matrix-auth-expanded')).toBeTruthy();
    fireEvent.click(toggle);
    expect(document.querySelector('.wf-svc-matrix-auth-expanded')).toBeNull();
  });

  it('changes global profile in expanded inline auth', () => {
    const profiles: GlobalAuthProfile[] = [
      globalAuthProfiles[0],
      { id: 'gp2', name: 'Alt', auth: { type: 'basic', username: 'u' } } as unknown as GlobalAuthProfile,
    ];
    render(<WorkflowServiceRegistryModal {...baseProps} globalAuthProfiles={profiles} />);
    fireEvent.click(document.querySelector('.wf-svc-auth-toggle') as HTMLButtonElement);
    const expanded = document.querySelector('.wf-svc-matrix-auth-expanded')!;
    selectOption(expanded, 'Global Auth Profile');
    selectOptionByIndex(expanded, 1, 'Alt (basic)');
    expect(expanded.querySelectorAll('.cs-wrapper')[1]?.querySelector('.cs-text')?.textContent).toBe('Alt (basic)');
  });

  it('omits the global profile auth option when no profiles are available', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} globalAuthProfiles={[]} />);
    fireEvent.click(document.querySelector('.wf-svc-auth-toggle') as HTMLButtonElement);

    const expanded = document.querySelector('.wf-svc-matrix-auth-expanded')!;
    fireEvent.click(expanded.querySelector('.cs-trigger') as HTMLButtonElement);

    expect(screen.queryByText('Global Auth Profile')).toBeNull();
  });

  it('treats whitespace-only urls as disabled in counts and fills missing microservice urls with empty strings', () => {
    const sparseServices: WorkflowService[] = [
      {
        id: 's1',
        name: 'svc-a',
        endpoints: [
          { envId: 'env1', url: '   ', enabled: true, authMode: 'inherit', source: 'manual' },
        ],
        defaultAuth: { type: 'none' },
      } as unknown as WorkflowService,
    ];
    const sparseMicroservices: Microservice[] = [
      {
        id: 'ms1',
        name: 'Users',
        baseUrls: { env1: 'http://users.dev' },
      } as unknown as Microservice,
    ];

    render(
      <WorkflowServiceRegistryModal
        {...baseProps}
        services={sparseServices}
        microservices={sparseMicroservices}
        selectedEnvId="env2"
      />,
    );

    expect(screen.getByText('0/3 envs')).toBeTruthy();

    selectOption(document.querySelector('.wf-svc-top-fields')!, 'Users');
    const urlInputs = document.querySelectorAll('.wf-svc-matrix-col-url input');
    expect((urlInputs[1] as HTMLInputElement).value).toBe('');
  });

  describe('resolveInheritLabel', () => {
    it('no microservice linked', () => {
      expect(resolveInheritLabel('env1', undefined, microservices, globalAuthProfiles)).toBe('No microservice linked');
    });
    it('no auth configured for ms', () => {
      const ms = [{ id: 'msx', name: 'X', baseUrls: {} } as unknown as Microservice];
      expect(resolveInheritLabel('env1', 'msx', ms, globalAuthProfiles)).toBe('No auth configured for this env');
    });
    it('no auth profile for this env', () => {
      expect(resolveInheritLabel('env2', 'ms1', microservices, globalAuthProfiles)).toBe('No auth profile for this env');
    });
    it('profile not found', () => {
      expect(resolveInheritLabel('env1', 'ms1', microservices, [])).toBe('Profile not found');
    });
    it('profile found', () => {
      expect(resolveInheritLabel('env1', 'ms1', microservices, globalAuthProfiles)).toBe('Corp (bearer)');
    });
  });

  describe('authSummary', () => {
    const da = emptyAuthState(globalAuthProfiles);
    const ep = (over: Partial<ServiceEndpoint>): ServiceEndpoint =>
      ({ envId: 'env1', url: '', enabled: true, authMode: 'custom', source: 'manual', ...over } as ServiceEndpoint);
    it('inherit', () => {
      expect(authSummary(ep({ authMode: 'inherit' }), da, globalAuthProfiles)).toBe('inherit');
    });
    it('custom no auth', () => {
      expect(authSummary(ep({ auth: undefined }), da, globalAuthProfiles)).toBe('none');
    });
    it('none type', () => {
      expect(authSummary(ep({ auth: { type: 'none' } }), da, globalAuthProfiles)).toBe('none');
    });
    it('bearer/basic/apikey/oauth2', () => {
      expect(authSummary(ep({ auth: { type: 'bearer', token: 't' } }), da, globalAuthProfiles)).toBe('Bearer');
      expect(authSummary(ep({ auth: { type: 'basic', username: 'u' } }), da, globalAuthProfiles)).toBe('Basic');
      expect(authSummary(ep({ auth: { type: 'apikey', apiKeyName: 'X-Key' } }), da, globalAuthProfiles)).toBe('Key: X-Key');
      expect(authSummary(ep({ auth: { type: 'oauth2' } }), da, globalAuthProfiles)).toBe('OAuth2');
    });
    it('global-profile found and not found', () => {
      const found = authSummary(ep({ auth: { type: 'bearer', globalProfileId: 'gp1' } }), da, globalAuthProfiles);
      expect(found).toBe('Corp');
      const notFound = authSummary(ep({ auth: { type: 'bearer', globalProfileId: 'gpX' } }), da, globalAuthProfiles);
      expect(notFound).toBe('profile');
    });
    it('apikey without name and unknown auth type fallback', () => {
      expect(authSummary(ep({ auth: { type: 'apikey' } }), da, globalAuthProfiles)).toBe('Key: …');
      expect(authSummary(ep({ auth: { type: 'digest' } as never }), da, globalAuthProfiles)).toBe('digest');
    });
  });
});
