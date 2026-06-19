// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnvironmentManager, { type EnvironmentManagerProps } from './EnvironmentManager';
import type { Environment, Microservice, GlobalAuthProfile, FeatureGroup } from '../../shared/types';

// ── Deterministic ids ──
let uuidCounter = 0;
vi.mock('uuid', () => ({ v4: () => `uuid-${++uuidCounter}` }));

// ── Audit log writes to storage — stub all to no-ops ──
vi.mock('../audit/utils/auditLog', () => ({
  logEnvironmentCreated: vi.fn(),
  logEnvironmentDeleted: vi.fn(),
  logMicroserviceCreated: vi.fn(),
  logMicroserviceDeleted: vi.fn(),
  logMicroserviceUpdated: vi.fn(),
}));

import {
  logEnvironmentCreated, logEnvironmentDeleted,
  logMicroserviceCreated, logMicroserviceDeleted, logMicroserviceUpdated,
} from '../audit/utils/auditLog';

const mockedEnvCreated = vi.mocked(logEnvironmentCreated);
const mockedEnvDeleted = vi.mocked(logEnvironmentDeleted);
const mockedSvcCreated = vi.mocked(logMicroserviceCreated);
const mockedSvcDeleted = vi.mocked(logMicroserviceDeleted);
const mockedSvcUpdated = vi.mocked(logMicroserviceUpdated);

interface HarnessProps {
  environments?: Environment[];
  microservices?: Microservice[];
  appGlobalAuthProfiles?: GlobalAuthProfile[];
  featureGroups?: FeatureGroup[];
  selectedEnvId?: string;
  selectedSvcId?: string;
  confirm?: EnvironmentManagerProps['confirm'];
}

function Harness(props: HarnessProps) {
  const [environments, setEnvironments] = useState<Environment[]>(props.environments ?? []);
  const [microservices, setMicroservices] = useState<Microservice[]>(props.microservices ?? []);
  const [selectedEnvId, setSelectedEnvId] = useState<string>(props.selectedEnvId ?? '');
  const [selectedSvcId, setSelectedSvcId] = useState<string>(props.selectedSvcId ?? '');
  return (
    <EnvironmentManager
      environments={environments}
      setEnvironments={setEnvironments}
      microservices={microservices}
      setMicroservices={setMicroservices}
      appGlobalAuthProfiles={props.appGlobalAuthProfiles ?? []}
      featureGroups={props.featureGroups ?? []}
      selectedEnvId={selectedEnvId}
      selectedSvcId={selectedSvcId}
      setSelectedEnvId={setSelectedEnvId}
      setSelectedSvcId={setSelectedSvcId}
      confirm={props.confirm ?? ((_msg, onConfirm) => onConfirm())}
    />
  );
}

const env = (id: string, name: string): Environment => ({ id, name });
const svc = (overrides: Partial<Microservice> = {}): Microservice => ({
  id: 'svc-1', name: 'svc-one', baseUrls: {}, ...overrides,
});

function fgWith(overrides: Partial<FeatureGroup>): FeatureGroup {
  return {
    id: `fg-${Math.random()}`,
    name: 'FG',
    scenarios: [{ id: 's1', name: 'sc', kind: 'standard', tests: [{ id: 't1', name: 'test' }] }],
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('EnvironmentManager', () => {
  beforeEach(() => {
    uuidCounter = 0;
    vi.clearAllMocks();
  });

  // ── Empty states ──
  it('renders empty hints when there are no environments or microservices', () => {
    render(<Harness />);
    expect(screen.getByText('No environments defined.')).toBeInTheDocument();
    expect(screen.getByText('No microservices defined.')).toBeInTheDocument();
  });

  // ── Add environment ──
  it('adds an environment via the Add button and disables Add when empty', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('e.g. t01, p01, staging');
    const addBtn = screen.getAllByRole('button', { name: 'Add' })[0];
    expect(addBtn).toBeDisabled();
    fireEvent.change(input, { target: { value: 't01' } });
    expect(screen.getAllByRole('button', { name: 'Add' })[0]).not.toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    expect(screen.getByText('t01')).toBeInTheDocument();
    expect(mockedEnvCreated).toHaveBeenCalledWith('t01', 'uuid-1');
    // Input cleared
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('adds an environment via the Enter key and ignores Enter when blank', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('e.g. t01, p01, staging');
    // Blank Enter → no-op
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockedEnvCreated).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'staging' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(mockedEnvCreated).toHaveBeenCalled();
  });

  it('does nothing when clicking Add with only whitespace', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('e.g. t01, p01, staging');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    expect(mockedEnvCreated).not.toHaveBeenCalled();
  });

  // ── Delete environment ──
  it('deletes an environment, surfaces the warning detail, clears selection and prunes baseUrls', () => {
    const confirmSpy = vi.fn((_msg: string, onConfirm: () => void) => onConfirm());
    render(
      <Harness
        environments={[env('e1', 't01')]}
        microservices={[svc({ baseUrls: { e1: 'http://x' } })]}
        featureGroups={[fgWith({ environmentId: 'e1' })]}
        selectedEnvId="e1"
        confirm={confirmSpy}
      />
    );
    const chip = screen.getByText('t01').closest('.settings-chip')!;
    fireEvent.click(within(chip as HTMLElement).getByTitle('Delete'));
    expect(confirmSpy).toHaveBeenCalled();
    const detail = confirmSpy.mock.calls[0][2] as string;
    expect(detail).toContain('microservice');
    expect(detail).toContain('feature group');
    expect(mockedEnvDeleted).toHaveBeenCalledWith('t01', 'e1');
    expect(screen.queryByText('t01')).not.toBeInTheDocument();
  });

  it('omits the warning detail when deleting an unused environment', () => {
    const confirmSpy = vi.fn((_msg: string, onConfirm: () => void) => onConfirm());
    render(<Harness environments={[env('e1', 't01')]} confirm={confirmSpy} />);
    const chip = screen.getByText('t01').closest('.settings-chip')!;
    fireEvent.click(within(chip as HTMLElement).getByTitle('Delete'));
    expect(confirmSpy.mock.calls[0][2]).toBeUndefined();
    expect(mockedEnvDeleted).toHaveBeenCalled();
  });

  // ── Add / delete microservice ──
  it('adds a microservice via button and Enter, ignoring blank input', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('e.g. sales-product-autoassign');
    fireEvent.keyDown(input, { key: 'Enter' }); // blank → no-op
    expect(mockedSvcCreated).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'orders-svc' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[1]);
    expect(screen.getByText('orders-svc')).toBeInTheDocument();
    expect(mockedSvcCreated).toHaveBeenCalled();
    // Add second via Enter
    fireEvent.change(input, { target: { value: 'billing-svc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('billing-svc')).toBeInTheDocument();
  });

  it('does nothing when clicking Add microservice with only whitespace', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('e.g. sales-product-autoassign');
    fireEvent.change(input, { target: { value: '  ' } });
    // The microservice Add button is the second one
    const addButtons = screen.getAllByRole('button', { name: 'Add' });
    fireEvent.click(addButtons[addButtons.length - 1]);
    expect(mockedSvcCreated).not.toHaveBeenCalled();
  });

  it('deletes a microservice with affected feature groups and clears selection', () => {
    const confirmSpy = vi.fn((_msg: string, onConfirm: () => void) => onConfirm());
    render(
      <Harness
        microservices={[svc({ id: 'svc-1', name: 'orders' })]}
        featureGroups={[fgWith({ microserviceId: 'svc-1' })]}
        selectedSvcId="svc-1"
        confirm={confirmSpy}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirmSpy.mock.calls[0][2]).toContain('feature group');
    expect(mockedSvcDeleted).toHaveBeenCalledWith('orders', 'svc-1');
    expect(screen.queryByText('orders')).not.toBeInTheDocument();
  });

  it('deletes a microservice with no affected feature groups (no detail)', () => {
    const confirmSpy = vi.fn((_msg: string, onConfirm: () => void) => onConfirm());
    render(<Harness microservices={[svc({ id: 'svc-1', name: 'orders' })]} confirm={confirmSpy} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirmSpy.mock.calls[0][2]).toBeUndefined();
  });

  // ── Configure / expand microservice ──
  it('expands a microservice and prompts to add environments first when none exist', () => {
    render(<Harness microservices={[svc()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByText('Add environments first.')).toBeInTheDocument();
    // Collapse
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.queryByText('Add environments first.')).not.toBeInTheDocument();
  });

  it('shows the env table with deployed counts when environments exist', () => {
    render(<Harness environments={[env('e1', 't01'), env('e2', 'p01')]} microservices={[svc({ baseUrls: { e1: 'http://x' } })]} />);
    expect(screen.getByText('1/2 envs')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByText('Base URL')).toBeInTheDocument();
    expect(screen.getByText('Auth Profile')).toBeInTheDocument();
  });

  // ── Deploy checkbox toggle ──
  it('toggles a base environment deployment checkbox on and off', () => {
    render(<Harness environments={[env('e1', 't01')]} microservices={[svc()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox); // deploy
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox')); // undeploy
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  // ── Edit base URL ──
  it('edits a base URL via Save button and logs the change', () => {
    render(<Harness environments={[env('e1', 't01')]} microservices={[svc({ baseUrls: { e1: '' } })]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByText('No URL configured')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const urlInput = screen.getByPlaceholderText('https://svc-one.t01.example.com');
    fireEvent.change(urlInput, { target: { value: 'http://orders.t01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('http://orders.t01')).toBeInTheDocument();
    expect(mockedSvcUpdated).toHaveBeenCalled();
  });

  it('saves a base URL via the Enter key', () => {
    render(<Harness environments={[env('e1', 't01')]} microservices={[svc({ baseUrls: { e1: '' } })]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const urlInput = screen.getByPlaceholderText('https://svc-one.t01.example.com');
    fireEvent.change(urlInput, { target: { value: 'http://orders.t01' } });
    fireEvent.keyDown(urlInput, { key: 'Enter' });
    expect(screen.getByText('http://orders.t01')).toBeInTheDocument();
  });

  it('does not log an audit change when the base URL is unchanged', () => {
    render(<Harness environments={[env('e1', 't01')]} microservices={[svc({ baseUrls: { e1: 'http://same' } })]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mockedSvcUpdated).not.toHaveBeenCalled();
  });

  it('cancels base URL editing via the Cancel button and the Escape key', () => {
    render(<Harness environments={[env('e1', 't01')]} microservices={[svc({ baseUrls: { e1: 'http://x' } })]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    // Re-open and Escape
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const urlInput = screen.getByDisplayValue('http://x');
    fireEvent.keyDown(urlInput, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  // ── Auth profile select ──
  it('sets and clears an auth profile for a deployed environment', () => {
    const profiles: GlobalAuthProfile[] = [{ id: 'p1', name: 'Bearer Profile', auth: { type: 'bearer' } }];
    render(
      <Harness
        environments={[env('e1', 't01')]}
        microservices={[svc({ baseUrls: { e1: 'http://x' } })]}
        appGlobalAuthProfiles={profiles}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'p1' } });
    expect(mockedSvcUpdated).toHaveBeenCalled();
    mockedSvcUpdated.mockClear();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(mockedSvcUpdated).toHaveBeenCalled();
  });

  // ── Additional (custom) environments ──
  it('adds an additional environment, prevents duplicates and ignores blank submits', () => {
    render(<Harness environments={[env('e1', 't01')]} microservices={[svc()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const addInput = screen.getByPlaceholderText('+ Add additional environment (e.g. staging-2)');
    // Blank submit → no-op
    fireEvent.submit(addInput.closest('form')!);
    expect(screen.queryByText('staging-2')).not.toBeInTheDocument();
    // Add
    fireEvent.change(addInput, { target: { value: 'staging-2' } });
    fireEvent.submit(addInput.closest('form')!);
    expect(screen.getByText('staging-2')).toBeInTheDocument();
    expect(screen.getByText('Additional Environments')).toBeInTheDocument();
    // Duplicate (case-insensitive) → ignored
    fireEvent.change(screen.getByPlaceholderText('+ Add additional environment (e.g. staging-2)'), { target: { value: 'STAGING-2' } });
    fireEvent.submit(screen.getByPlaceholderText('+ Add additional environment (e.g. staging-2)').closest('form')!);
    expect(screen.getAllByText('staging-2').length).toBe(1);
  });

  it('configures and deletes an additional environment row', () => {
    const profiles: GlobalAuthProfile[] = [{ id: 'p1', name: 'Bearer', auth: { type: 'bearer' } }];
    render(
      <Harness
        environments={[env('e1', 't01')]}
        microservices={[svc({ customEnvs: [{ id: 'c1', name: 'staging-2' }], baseUrls: { c1: '' } })]}
        appGlobalAuthProfiles={profiles}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByText('staging-2')).toBeInTheDocument();
    // Edit URL for the custom env, save via Enter key
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const urlInput = screen.getByPlaceholderText('https://svc-one.staging-2.example.com');
    fireEvent.change(urlInput, { target: { value: 'http://staging2' } });
    fireEvent.keyDown(urlInput, { key: 'Enter' });
    expect(screen.getByText('http://staging2')).toBeInTheDocument();
    // Re-edit and cancel via Escape key
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.keyDown(screen.getByPlaceholderText('https://svc-one.staging-2.example.com'), { key: 'Escape' });
    expect(screen.getByText('http://staging2')).toBeInTheDocument();
    // Re-edit, change, then Save button
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByPlaceholderText('https://svc-one.staging-2.example.com'), { target: { value: 'http://staging2b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('http://staging2b')).toBeInTheDocument();
    // Re-edit and cancel via Cancel button
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('http://staging2b')).toBeInTheDocument();
    // Set auth on custom env
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'p1' } });
    // Delete the additional env
    fireEvent.click(screen.getByTitle('Remove additional environment'));
    expect(screen.queryByText('staging-2')).not.toBeInTheDocument();
  });

  it('toggles deployment for a custom environment that starts undeployed', () => {
    render(
      <Harness
        environments={[env('e1', 't01')]}
        microservices={[svc({ customEnvs: [{ id: 'c1', name: 'staging-2' }], baseUrls: {} })]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    // Two checkboxes: base env (e1) + custom env (c1), both undeployed
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // deploy custom env
    expect(screen.getAllByRole('checkbox')[1]).toBeChecked();
  });

  // ── Drag reordering ──
  it('reorders environments via drag and drop', () => {
    render(<Harness environments={[env('e1', 'alpha'), env('e2', 'beta')]} />);
    const chips = document.querySelectorAll('.settings-chip');
    fireEvent.dragStart(chips[0]);
    fireEvent.dragOver(chips[1]);
    fireEvent.dragEnd(chips[0]);
    const namesAfter = Array.from(document.querySelectorAll('.settings-chip span:nth-child(2)')).map((n) => n.textContent);
    expect(namesAfter[0]).toBe('beta');
  });

  it('reorders microservices via drag and drop', () => {
    render(<Harness microservices={[svc({ id: 's1', name: 'aaa' }), svc({ id: 's2', name: 'bbb' })]} />);
    const cards = document.querySelectorAll('.settings-svc-card');
    fireEvent.dragStart(cards[0]);
    fireEvent.dragOver(cards[1]);
    fireEvent.dragEnd(cards[0]);
    const names = Array.from(document.querySelectorAll('.settings-svc-name')).map((n) => n.textContent);
    expect(names[0]).toBe('bbb');
  });

  it('ignores drag-over when dragging onto the same index or with no active drag', () => {
    render(<Harness environments={[env('e1', 'alpha'), env('e2', 'beta')]} />);
    const chips = document.querySelectorAll('.settings-chip');
    // dragOver without dragStart → draggingEnvIdx is null, early return
    fireEvent.dragOver(chips[0]);
    // dragStart then dragOver on the same chip → early return
    fireEvent.dragStart(chips[0]);
    fireEvent.dragOver(chips[0]);
    const names = Array.from(document.querySelectorAll('.settings-chip span:nth-child(2)')).map((n) => n.textContent);
    expect(names[0]).toBe('alpha');
  });

  it('uses plural wording in delete-environment warning for multiple dependents', () => {
    const confirmSpy = vi.fn((_msg: string, onConfirm: () => void) => onConfirm());
    render(
      <Harness
        environments={[env('e1', 't01')]}
        microservices={[
          svc({ id: 's1', baseUrls: { e1: 'http://a' } }),
          svc({ id: 's2', baseUrls: { e1: 'http://b' } }),
        ]}
        featureGroups={[
          fgWith({ environmentId: 'e1', scenarios: [{ id: 's1', name: 'a', kind: 'standard', tests: [{ id: 't1', name: 't1' }, { id: 't2', name: 't2' }] }] }),
          fgWith({ environmentId: 'e1', scenarios: [{ id: 's2', name: 'b', kind: 'standard', tests: [{ id: 't3', name: 't3' }] }] }),
        ]}
        confirm={confirmSpy}
      />,
    );
    const chip = screen.getByText('t01').closest('.settings-chip')!;
    fireEvent.click(within(chip as HTMLElement).getByTitle('Delete'));
    const detail = confirmSpy.mock.calls[0][2] as string;
    expect(detail).toContain('2 microservices');
    expect(detail).toContain('2 feature groups');
    expect(detail).toContain('2 scenarios');
    expect(detail).toContain('3 tests');
  });

  it('uses plural wording in delete-microservice warning for multiple dependents', () => {
    const confirmSpy = vi.fn((_msg: string, onConfirm: () => void) => onConfirm());
    render(
      <Harness
        microservices={[svc({ id: 'svc-1', name: 'orders' })]}
        featureGroups={[
          fgWith({
            microserviceId: 'svc-1',
            scenarios: [
              { id: 's1', name: 'a', kind: 'standard', tests: [{ id: 't1', name: 't1' }, { id: 't2', name: 't2' }] },
              { id: 's2', name: 'b', kind: 'standard', tests: [{ id: 't3', name: 't3' }] },
            ],
          }),
          fgWith({ microserviceId: 'svc-1' }),
        ]}
        confirm={confirmSpy}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const detail = confirmSpy.mock.calls[0][2] as string;
    expect(detail).toContain('2 feature groups');
    expect(detail).toContain('3 scenarios');
    expect(detail).toContain('4 tests');
  });

  it('does not log auth profile audit when the selection is unchanged', () => {
    const profiles: GlobalAuthProfile[] = [{ id: 'p1', name: 'Bearer Profile', auth: { type: 'bearer' } }];
    render(
      <Harness
        environments={[env('e1', 't01')]}
        microservices={[svc({ baseUrls: { e1: 'http://x' }, authProfileIds: { e1: 'p1' } })]}
        appGlobalAuthProfiles={profiles}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'p1' } });
    expect(mockedSvcUpdated).not.toHaveBeenCalled();
  });

  it('prevents duplicate additional env names against global environments', () => {
    render(<Harness environments={[env('e1', 't01')]} microservices={[svc()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const addInput = screen.getByPlaceholderText('+ Add additional environment (e.g. staging-2)');
    fireEvent.change(addInput, { target: { value: 'T01' } });
    fireEvent.submit(addInput.closest('form')!);
    expect(screen.queryByText('T01')).not.toBeInTheDocument();
  });

  it('logs base URL audit using custom environment name', () => {
    render(
      <Harness
        environments={[env('e1', 't01')]}
        microservices={[svc({ customEnvs: [{ id: 'c1', name: 'staging-2' }], baseUrls: { c1: '' } })]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByPlaceholderText('https://svc-one.staging-2.example.com'), { target: { value: 'http://custom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mockedSvcUpdated).toHaveBeenCalledWith(
      'svc-one',
      'svc-1',
      expect.arrayContaining([expect.objectContaining({ field: 'baseUrl[staging-2]' })]),
    );
  });
});
