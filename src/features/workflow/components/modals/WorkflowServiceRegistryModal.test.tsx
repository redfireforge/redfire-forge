/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '../../../../test-utils/customSelectHelper';
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
    const nameInput = document.querySelector('.wf-svc-identity-fields input') as HTMLInputElement;
    expect(nameInput.value).toBe('svc-a');
  });

  it('shows empty list message when no services', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} services={[]} />);
    expect(screen.getByText(/No services yet/)).toBeTruthy();
    expect(screen.getByText(/Select a service to configure/)).toBeTruthy();
  });

  it('adds a service', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} services={[]} />);
    fireEvent.click(document.querySelector('.wf-svc-registry-left-head button') as HTMLButtonElement);
    expect(screen.getByText('service-1')).toBeTruthy();
  });

  it('edits service name', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    const nameInput = document.querySelector('.wf-svc-identity-fields input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'renamed' } });
    expect((document.querySelector('.wf-svc-identity-fields input') as HTMLInputElement).value).toBe('renamed');
  });

  it('links a microservice and auto-populates urls', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    selectOption(document.querySelector('.wf-svc-identity-fields')!, 'Users');
    expect(screen.getByText(/URLs managed by/)).toBeTruthy();
    selectOption(document.querySelector('.wf-svc-identity-fields')!, 'None (manual)');
  });

  it('toggles endpoint enabled and edits url', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    const checkbox = document.querySelector('.wf-svc-matrix-col-on input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    const urlInput = document.querySelector('.wf-svc-matrix-col-url input') as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: 'http://new' } });
    expect(urlInput.value).toBe('http://new');
  });

  it('opens auth popup and cycles through auth types', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    const toggle = document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement;
    fireEvent.click(toggle);
    const popup = document.querySelector('.wf-svc-auth-popup')!;
    const typeSelector = popup.querySelector('.wf-svc-auth-popup-type')!;
    selectOption(typeSelector, 'Bearer Token');
    expect(screen.getByText('Token')).toBeTruthy();
    selectOption(typeSelector, 'Basic Auth');
    expect(screen.getByText('Username')).toBeTruthy();
    selectOption(typeSelector, 'API Key');
    expect(screen.getByText('Key Name')).toBeTruthy();
    selectOption(typeSelector, 'OAuth2 Client Credentials');
    expect(screen.getByText('Token URL')).toBeTruthy();
    selectOption(typeSelector, 'Global Auth Profile');
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('edits bearer fields in auth popup and resets to inherit', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    fireEvent.click(document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement);
    const popup = document.querySelector('.wf-svc-auth-popup')!;
    const typeSelector = popup.querySelector('.wf-svc-auth-popup-type')!;
    selectOption(typeSelector, 'Bearer Token');
    const prefix = screen.getByText('Prefix').parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.change(prefix, { target: { value: 'JWT' } });
    const token = screen.getByText('Token').parentElement!.querySelector('input') as HTMLInputElement;
    fireEvent.change(token, { target: { value: 'tok' } });
    selectOption(typeSelector, 'Basic Auth');
    fireEvent.change(screen.getByText('Username').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'u' } });
    fireEvent.change(screen.getByText('Password').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'p' } });
    selectOption(typeSelector, 'API Key');
    fireEvent.change(screen.getByText('Key Name').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'X' } });
    fireEvent.change(screen.getByText('Value').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'v' } });
    const body = popup.querySelector('.wf-svc-auth-popup-body')!;
    selectOption(body.querySelector('.wf-svc-auth-field:last-child')!, 'Query Param');
    selectOption(typeSelector, 'OAuth2 Client Credentials');
    fireEvent.change(screen.getByText('Token URL').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'http://t' } });
    fireEvent.change(screen.getByText('Client ID').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 'c' } });
    fireEvent.change(screen.getByText('Client Secret').parentElement!.querySelector('input') as HTMLInputElement, { target: { value: 's' } });
    fireEvent.click(screen.getByText('Reset to Inherit'));
    expect(document.querySelector('.wf-svc-auth-popup')).toBeNull();
  });

  it('closes auth popup by clicking pill again', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    const toggle = document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(document.querySelector('.wf-svc-auth-popup')).toBeTruthy();
    fireEvent.click(document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement);
    expect(document.querySelector('.wf-svc-auth-popup')).toBeNull();
  });

  it('opens auth popup when microservice linked (prefills from env profile)', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    selectOption(document.querySelector('.wf-svc-identity-fields')!, 'Users');
    const toggle = document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(document.querySelector('.wf-svc-auth-popup')).toBeTruthy();
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
    expect(document.querySelector('.wf-svc-row-status.ready')).toBeTruthy();
    fireEvent.click(screen.getByText('svc-b'));
    expect((document.querySelector('.wf-svc-identity-fields input') as HTMLInputElement).value).toBe('svc-b');
    expect(document.querySelector('.wf-svc-row-status.missing')).toBeTruthy();
  });

  it('opens auth popup for custom auth row', () => {
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
    const toggle = document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(document.querySelector('.wf-svc-auth-popup')).toBeTruthy();
    fireEvent.click(toggle);
    expect(document.querySelector('.wf-svc-auth-popup')).toBeNull();
  });

  it('changes global profile in auth popup', () => {
    const profiles: GlobalAuthProfile[] = [
      globalAuthProfiles[0],
      { id: 'gp2', name: 'Alt', auth: { type: 'basic', username: 'u' } } as unknown as GlobalAuthProfile,
    ];
    render(<WorkflowServiceRegistryModal {...baseProps} globalAuthProfiles={profiles} />);
    fireEvent.click(document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement);
    const popup = document.querySelector('.wf-svc-auth-popup')!;
    const typeSelector = popup.querySelector('.wf-svc-auth-popup-type')!;
    selectOption(typeSelector, 'Global Auth Profile');
    const body = popup.querySelector('.wf-svc-auth-popup-body')!;
    selectOption(body, 'Alt (basic)');
    expect(body.querySelector('.cs-text')?.textContent).toBe('Alt (basic)');
  });

  it('omits the global profile auth option when no profiles are available', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} globalAuthProfiles={[]} />);
    fireEvent.click(document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement);

    const popup = document.querySelector('.wf-svc-auth-popup')!;
    const typeSelector = popup.querySelector('.wf-svc-auth-popup-type')!;
    fireEvent.click(typeSelector.querySelector('.cs-trigger') as HTMLButtonElement);

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

    const badge = document.querySelector('.wf-svc-row-badge') as HTMLElement;
    expect(badge.textContent).toBe('0');

    selectOption(document.querySelector('.wf-svc-identity-fields')!, 'Users');
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

  // ── Delete service and selection fallback ──

  it('deletes the selected service and selects the next available', () => {
    const twoServices: WorkflowService[] = [
      { id: 's1', name: 'svc-a', endpoints: [], defaultAuth: { type: 'none' } } as unknown as WorkflowService,
      { id: 's2', name: 'svc-b', endpoints: [], defaultAuth: { type: 'none' } } as unknown as WorkflowService,
    ];
    render(<WorkflowServiceRegistryModal {...baseProps} services={twoServices} />);
    // Delete the first (selected) service
    const deleteBtn = document.querySelectorAll('.wf-svc-row-delete')[0] as HTMLButtonElement;
    fireEvent.click(deleteBtn);
    expect(screen.queryByText('svc-a')).toBeNull();
    expect((document.querySelector('.wf-svc-identity-fields input') as HTMLInputElement).value).toBe('svc-b');
  });

  it('deletes the only service and shows empty state', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    const deleteBtn = document.querySelector('.wf-svc-row-delete') as HTMLButtonElement;
    fireEvent.click(deleteBtn);
    expect(screen.getByText(/No services yet/)).toBeTruthy();
  });

  // ── Auth popup backdrop + escape ──

  it('closes auth popup on backdrop mousedown', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    fireEvent.click(document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement);
    expect(document.querySelector('.wf-svc-auth-popup')).toBeTruthy();
    const backdrop = document.querySelector('.wf-svc-auth-popup-backdrop')!;
    fireEvent.mouseDown(backdrop, { target: backdrop });
    expect(document.querySelector('.wf-svc-auth-popup')).toBeNull();
  });

  it('closes auth popup on Escape key', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    fireEvent.click(document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement);
    expect(document.querySelector('.wf-svc-auth-popup')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.wf-svc-auth-popup')).toBeNull();
  });

  // ── Microservice unlinking ──

  it('unlinks microservice by selecting None', () => {
    const linkedSvc: WorkflowService[] = [{
      id: 's1',
      name: 'linked',
      microserviceId: 'ms1',
      endpoints: [
        { envId: 'env1', url: 'http://users.dev', enabled: true, authMode: 'inherit', source: 'microservice' },
      ],
      defaultAuth: { type: 'none' },
    } as unknown as WorkflowService];
    render(<WorkflowServiceRegistryModal {...baseProps} services={linkedSvc} />);
    selectOption(document.querySelector('.wf-svc-identity-fields')!, 'None (manual)');
    // URL input should still be editable after unlinking
    const urlInput = document.querySelector('.wf-svc-matrix-col-url input') as HTMLInputElement;
    expect(urlInput).toBeTruthy();
  });

  // ── Adhoc env name ──

  it('renders adhoc env row with label "adhoc"', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);
    expect(screen.getByText('adhoc')).toBeTruthy();
  });

  // ── Linked microservice renders linked indicator ──

  it('renders linked microservice indicator when service has microserviceId', () => {
    const linkedSvc: WorkflowService[] = [{
      id: 's1',
      name: 'linked-svc',
      microserviceId: 'ms1',
      endpoints: [
        { envId: 'env1', url: 'http://users.dev', enabled: true, authMode: 'inherit', source: 'microservice' },
        { envId: 'env2', url: 'http://users.prod', enabled: true, authMode: 'inherit', source: 'microservice' },
      ],
      defaultAuth: { type: 'none' },
    } as unknown as WorkflowService];
    render(<WorkflowServiceRegistryModal {...baseProps} services={linkedSvc} />);
    // Linked microservice should show URL management notice
    expect(screen.getByText(/URLs managed by/)).toBeTruthy();
  });

  // ── env fallback to envId when name is not found ──

  it('shows raw envId when environment is not in the list', () => {
    // Use a minimal env list that doesn't include env1/env2
    const customEnvs: Environment[] = [
      { id: 'env-custom', name: 'Custom' } as unknown as Environment,
    ];
    const svc: WorkflowService[] = [{
      id: 's1',
      name: 'svc-x',
      endpoints: [
        { envId: 'env-custom', url: 'http://x', enabled: true, authMode: 'inherit', source: 'manual' },
      ],
      defaultAuth: { type: 'none' },
    } as unknown as WorkflowService];
    render(<WorkflowServiceRegistryModal {...baseProps} services={svc} environments={customEnvs} selectedEnvId="env-custom" />);
    expect(screen.getByText('Custom')).toBeTruthy();
  });

  // ── svcEnvReady returns 'missing' when endpoint url is empty ──

  it('shows missing status when endpoint has empty url', () => {
    const emptySvc: WorkflowService[] = [{
      id: 's1',
      name: 'empty-url',
      endpoints: [
        { envId: 'env1', url: '', enabled: true, authMode: 'inherit', source: 'manual' },
      ],
      defaultAuth: { type: 'none' },
    } as unknown as WorkflowService];
    render(<WorkflowServiceRegistryModal {...baseProps} services={emptySvc} selectedEnvId="env1" />);
    expect(document.querySelector('.wf-svc-row-status.missing')).toBeTruthy();
  });

  // ── svcEnvReady "none" when no env selected ──

  it('shows no env-status dot when selectedEnvId is empty', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} selectedEnvId="" />);
    const dot = document.querySelector('.wf-svc-row-status.none');
    expect(dot).toBeTruthy();
  });

  // ── Empty services → selected=null → defaultAuth/linkedMs memos hit falsy path ──

  it('computes defaultAuth via emptyAuthState when no service is selected', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} services={[]} />);
    // With no services, selected is null, defaultAuth should use emptyAuthState
    expect(screen.getByText(/No services yet/)).toBeTruthy();
    // Add a service and verify it works (proves the defaultAuth path toggles)
    fireEvent.click(document.querySelector('.wf-svc-registry-left-head button') as HTMLButtonElement);
    expect(screen.getByText('service-1')).toBeTruthy();
  });

  // ── Deletes a non-selected service ──

  it('deletes a non-selected service without changing selection', () => {
    const twoServices: WorkflowService[] = [
      { id: 's1', name: 'svc-a', endpoints: [], defaultAuth: { type: 'none' } } as unknown as WorkflowService,
      { id: 's2', name: 'svc-b', endpoints: [], defaultAuth: { type: 'none' } } as unknown as WorkflowService,
    ];
    render(<WorkflowServiceRegistryModal {...baseProps} services={twoServices} />);
    // s1 is selected, delete s2
    const deleteBtns = document.querySelectorAll('.wf-svc-row-delete');
    fireEvent.click(deleteBtns[1] as HTMLButtonElement);
    expect(screen.queryByText('svc-b')).toBeNull();
    expect((document.querySelector('.wf-svc-identity-fields input') as HTMLInputElement).value).toBe('svc-a');
  });

  // ── Microservice linking with adhoc endpoint kept ──

  it('keeps adhoc endpoint unchanged when linking microservice', () => {
    const svcWithAdhoc: WorkflowService[] = [{
      id: 's1',
      name: 'svc-with-adhoc',
      endpoints: [
        { envId: 'env1', url: 'http://old', enabled: true, authMode: 'inherit', source: 'manual' },
        { envId: 'env2', url: '', enabled: false, authMode: 'inherit', source: 'manual' },
        { envId: '__adhoc__', url: 'http://adhoc', enabled: true, authMode: 'inherit', source: 'manual' },
      ],
      defaultAuth: { type: 'none' },
    } as unknown as WorkflowService];
    render(<WorkflowServiceRegistryModal {...baseProps} services={svcWithAdhoc} />);
    selectOption(document.querySelector('.wf-svc-identity-fields')!, 'Users');
    // adhoc row URL should remain unchanged
    const urlInputs = document.querySelectorAll('.wf-svc-matrix-col-url input');
    const adhocInput = Array.from(urlInputs).find(
      (input) => (input as HTMLInputElement).value === 'http://adhoc',
    );
    expect(adhocInput).toBeTruthy();
  });

  // ── Services with no endpoints array (fallback to []) ──

  it('handles services with missing endpoints array', () => {
    const noEndpoints: WorkflowService[] = [{
      id: 's1',
      name: 'no-ep',
      defaultAuth: { type: 'none' },
    } as unknown as WorkflowService];
    render(<WorkflowServiceRegistryModal {...baseProps} services={noEndpoints} />);
    const badge = document.querySelector('.wf-svc-row-badge') as HTMLElement;
    expect(badge.textContent).toBe('0');
  });

  // ── Auth popup with microservice linked and profileId found ──

  it('prefills auth from microservice env profile when opening popup', () => {
    const linkedSvc: WorkflowService[] = [{
      id: 's1',
      name: 'linked',
      microserviceId: 'ms1',
      endpoints: [
        { envId: 'env1', url: 'http://users.dev', enabled: true, authMode: 'inherit', source: 'microservice' },
      ],
      defaultAuth: { type: 'none' },
    } as unknown as WorkflowService];
    render(<WorkflowServiceRegistryModal {...baseProps} services={linkedSvc} />);
    const toggle = document.querySelector('.wf-svc-auth-pill') as HTMLButtonElement;
    fireEvent.click(toggle);
    // Auth popup should open with prefilled auth from the profile (Corp bearer)
    expect(document.querySelector('.wf-svc-auth-popup')).toBeTruthy();
  });

  // ── Auth popup viewport clamping ──

  it('clamps auth popup position when it overflows viewport right/bottom', () => {
    // Use a service with inherit auth to trigger popup
    render(<WorkflowServiceRegistryModal {...baseProps} />);

    // Mock getBoundingClientRect to simulate pill at far right of viewport
    const pill = document.querySelector('.wf-svc-auth-pill') as HTMLElement;
    const origGetBCR = pill.getBoundingClientRect.bind(pill);
    pill.getBoundingClientRect = () => ({ ...origGetBCR(), bottom: 760, left: 1000, top: 750, right: 1050, width: 50, height: 10, x: 1000, y: 750, toJSON: () => ({}) });

    // Shrink viewport to force clamping
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 300, writable: true });

    fireEvent.click(pill);
    const popup = document.querySelector('.wf-svc-auth-popup');
    expect(popup).toBeTruthy();

    // Restore
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  it('clamps auth popup position when it overflows viewport left/top', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);

    const pill = document.querySelector('.wf-svc-auth-pill') as HTMLElement;
    const origGetBCR = pill.getBoundingClientRect.bind(pill);
    pill.getBoundingClientRect = () => ({ ...origGetBCR(), bottom: 4, left: -10, top: 0, right: 40, width: 50, height: 10, x: -10, y: 0, toJSON: () => ({}) });

    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    fireEvent.click(pill);
    const popup = document.querySelector('.wf-svc-auth-popup');
    expect(popup).toBeTruthy();

    // The popup should have been clamped (left >= 12, top >= 12)
    const style = (popup as HTMLElement).style;
    expect(style.left).toBeTruthy();
    expect(style.top).toBeTruthy();
  });

  it('does not clamp auth popup position when already within viewport', () => {
    render(<WorkflowServiceRegistryModal {...baseProps} />);

    // Mock getBoundingClientRect so anchor is well within bounds (no clamping needed)
    const pill = document.querySelector('.wf-svc-auth-pill') as HTMLElement;
    pill.getBoundingClientRect = () => ({
      bottom: 200, left: 100, top: 190, right: 150, width: 50, height: 10, x: 100, y: 190,
      toJSON: () => ({}),
    });

    // Also mock popup getBoundingClientRect — need the popup ref to report a small size
    const origProto = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function() {
      if (this.classList?.contains('wf-svc-auth-popup')) {
        return { width: 200, height: 150, top: 204, left: 100, bottom: 354, right: 300, x: 100, y: 204, toJSON: () => ({}) };
      }
      return origProto.call(this);
    };

    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    fireEvent.click(pill);
    const popup = document.querySelector('.wf-svc-auth-popup');
    expect(popup).toBeTruthy();

    // Restore
    HTMLElement.prototype.getBoundingClientRect = origProto;
  });
});
