/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestCollectionModal from './RequestCollectionModal';
import type { RequestCollection, RequestEnv, GlobalAuthProfile, Microservice, Environment } from '../../../shared/types';

const toastShow = vi.fn();
vi.mock('../../../shared/hooks/useToast', () => ({
  useToast: () => ({ show: toastShow }),
}));

const appEnvironments: Environment[] = [
  { id: 'e1', name: 'Dev' },
  { id: 'e2', name: 'Prod' },
];
const environments: RequestEnv[] = [
  { id: 'e1', name: 'Dev' },
  { id: 'e2', name: 'Prod' },
];
const profiles: GlobalAuthProfile[] = [
  { id: 'p1', name: 'Prod Token', auth: { type: 'bearer', token: 't' } },
];
const linkedMicroservices: Microservice[] = [
  { id: 'm1', name: 'Payments', baseUrls: { e1: 'https://pay-dev' }, customEnvs: [] },
];
const emptyMicroservices: Microservice[] = [
  { id: 'm2', name: 'Empty Svc', baseUrls: {}, customEnvs: [] },
];

function setup(overrides: {
  collection?: RequestCollection | null;
  collections?: RequestCollection[];
  environments?: RequestEnv[];
  appMicroservices?: Microservice[];
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultMode?: 'direct' | 'multi-env';
} = {}) {
  const onSave = vi.fn();
  const onAddEnv = vi.fn();
  const onClose = vi.fn();
  render(
    <RequestCollectionModal
      collection={overrides.collection ?? null}
      collections={overrides.collections ?? []}
      environments={overrides.environments ?? environments}
      appEnvironments={appEnvironments}
      appMicroservices={overrides.appMicroservices ?? []}
      globalAuthProfiles={overrides.globalAuthProfiles ?? profiles}
      defaultMode={overrides.defaultMode}
      onSave={onSave}
      onAddEnv={onAddEnv}
      onClose={onClose}
    />,
  );
  return { onSave, onAddEnv, onClose };
}

const nameInput = () => screen.getByPlaceholderText('e.g. veh-metadata, weather-api');

// WfDarkSelect helpers: open the trigger by testId, then click the option by label.
const darkTrigger = (testId: string) =>
  screen.getByTestId(testId).querySelector('.wf-dark-select__trigger') as HTMLButtonElement;
function pickDark(testId: string, optionLabel: string | RegExp) {
  fireEvent.click(darkTrigger(testId));
  fireEvent.click(screen.getByRole('option', { name: optionLabel }));
}
const setAuthType = (label: string | RegExp) => pickDark('req-auth-type-select', label);

beforeEach(() => {
  toastShow.mockReset();
});

describe('RequestCollectionModal', () => {
  it('renders New Collection with disabled Create until name typed', () => {
    setup();
    expect(screen.getByText('New Collection')).toBeInTheDocument();
    const create = screen.getByRole('button', { name: 'Create' });
    expect(create).toBeDisabled();
    fireEvent.change(nameInput(), { target: { value: 'My API' } });
    expect(create).toBeEnabled();
  });

  it('renders Edit Collection with prefilled name and Save label', () => {
    const collection: RequestCollection = { id: 'c1', name: 'Existing', mode: 'direct', requests: [], folders: [] };
    setup({ collection });
    expect(screen.getByText('Edit Collection')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('coerces group mode to direct', () => {
    const collection: RequestCollection = { id: 'c1', name: 'Grp', mode: 'group', requests: [], folders: [] };
    const { onSave } = setup({ collection });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ mode: 'direct' }));
  });

  it('warns on duplicate name and does not save', () => {
    const existing: RequestCollection = { id: 'c1', name: 'Taken', mode: 'direct', requests: [], folders: [] };
    const { onSave } = setup({ collections: [existing] });
    fireEvent.change(nameInput(), { target: { value: 'taken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(toastShow).toHaveBeenCalledWith('warning', 'Name already exists', expect.stringContaining('taken'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a direct collection with default none auth', () => {
    const { onSave } = setup();
    fireEvent.change(nameInput(), { target: { value: 'Plain' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Plain',
      mode: 'direct',
      baseUrls: undefined,
      auth: { type: 'none' },
      authPerEnv: undefined,
    }));
  });

  it('starts in multi-env mode when defaultMode is multi-env', () => {
    setup({ defaultMode: 'multi-env' });
    expect(screen.getByText('Base URLs per Environment')).toBeInTheDocument();
  });

  it('links a microservice and inherits env base URLs (read-only)', () => {
    const { onSave } = setup({ appMicroservices: linkedMicroservices });
    fireEvent.change(nameInput(), { target: { value: 'Linked' } });
    pickDark('req-svc-select', 'Payments');
    expect(screen.getByText(/inherited from Environments/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://pay-dev')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'multi-env',
      microserviceId: 'm1',
      baseUrls: undefined,
      auth: undefined,
      authPerEnv: undefined,
    }));
  });

  it('shows empty message when linked microservice has no environments', () => {
    setup({ appMicroservices: emptyMicroservices });
    pickDark('req-svc-select', 'Empty Svc');
    expect(screen.getByText('No environments configured for this microservice.')).toBeInTheDocument();
  });

  it('switches to multi-env, edits base URLs, toggles back to direct', () => {
    const { onSave } = setup();
    fireEvent.change(nameInput(), { target: { value: 'Multi' } });
    fireEvent.click(screen.getByRole('button', { name: /Multi-Environment/ }));
    const devUrl = screen.getByPlaceholderText('https://Multi.Dev.example.com');
    fireEvent.change(devUrl, { target: { value: 'https://dev.api' } });
    fireEvent.click(screen.getByRole('button', { name: /Direct URL/ }));
    fireEvent.click(screen.getByRole('button', { name: /Multi-Environment/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'multi-env',
      baseUrls: expect.objectContaining({ e1: 'https://dev.api' }),
    }));
  });

  it('shows hint when multi-env has no environments', () => {
    setup({ environments: [], defaultMode: 'multi-env' });
    expect(screen.getByText(/No environments defined yet/)).toBeInTheDocument();
  });

  it('adds a new environment via button and clears the field', () => {
    const { onAddEnv } = setup({ defaultMode: 'multi-env' });
    const addInput = screen.getByPlaceholderText('Add new environment (e.g. staging)');
    fireEvent.change(addInput, { target: { value: 'Staging' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add Env' }));
    expect(onAddEnv).toHaveBeenCalledWith('Staging');
    expect((addInput as HTMLInputElement).value).toBe('');
  });

  it('warns on duplicate environment name when adding', () => {
    const { onAddEnv } = setup({ defaultMode: 'multi-env' });
    const addInput = screen.getByPlaceholderText('Add new environment (e.g. staging)');
    fireEvent.change(addInput, { target: { value: 'dev' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add Env' }));
    expect(toastShow).toHaveBeenCalledWith('warning', 'Environment already exists', expect.any(String));
    expect(onAddEnv).not.toHaveBeenCalled();
  });

  it('adds environment via Enter key', () => {
    const { onAddEnv } = setup({ defaultMode: 'multi-env' });
    const addInput = screen.getByPlaceholderText('Add new environment (e.g. staging)');
    fireEvent.change(addInput, { target: { value: 'QA' } });
    fireEvent.keyDown(addInput, { key: 'Enter' });
    expect(onAddEnv).toHaveBeenCalledWith('QA');
  });

  it('warns on duplicate environment when adding via Enter key', () => {
    const { onAddEnv } = setup({ defaultMode: 'multi-env' });
    const addInput = screen.getByPlaceholderText('Add new environment (e.g. staging)');
    fireEvent.change(addInput, { target: { value: 'prod' } });
    fireEvent.keyDown(addInput, { key: 'Enter' });
    expect(toastShow).toHaveBeenCalledWith('warning', 'Environment already exists', expect.any(String));
    expect(onAddEnv).not.toHaveBeenCalled();
  });

  it('configures default bearer auth and saves it', () => {
    const { onSave } = setup();
    fireEvent.change(nameInput(), { target: { value: 'Bearer Col' } });
    setAuthType('Bearer Token');
    fireEvent.change(screen.getByPlaceholderText('Paste your token'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auth: { type: 'bearer', prefix: 'Bearer', token: 'abc' },
    }));
  });

  it('renders global-profile auth fields and fires profile select change', () => {
    setup();
    setAuthType('Global Auth Profile');
    expect(screen.getByText('Select Profile')).toBeInTheDocument();
    expect(screen.getByText('BEARER')).toBeInTheDocument();
    pickDark('req-profile-select', 'Prod Token (bearer)');
  });

  it('edits bearer prefix and token fields', () => {
    setup();
    setAuthType('Bearer Token');
    fireEvent.change(screen.getByPlaceholderText('Bearer'), { target: { value: 'Token' } });
    fireEvent.change(screen.getByPlaceholderText('Paste your token'), { target: { value: 'tok' } });
    expect(screen.getByPlaceholderText('Bearer')).toHaveValue('Token');
  });

  it('edits basic, apikey (incl. Add To), and oauth2 auth fields', () => {
    setup();
    setAuthType('Basic Auth');
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'u' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'p' } });
    setAuthType('API Key');
    fireEvent.change(screen.getByPlaceholderText('e.g. X-API-Key'), { target: { value: 'X-Key' } });
    fireEvent.change(screen.getByPlaceholderText('Key value'), { target: { value: 'kv' } });
    pickDark('req-apikey-in-select', 'Query String');
    setAuthType('OAuth2 Client Credentials');
    fireEvent.change(screen.getByPlaceholderText('https://auth.example.com/oauth/token'), { target: { value: 'https://t' } });
    fireEvent.change(screen.getByPlaceholderText('Client ID'), { target: { value: 'cid' } });
    fireEvent.change(screen.getByPlaceholderText('Client Secret'), { target: { value: 'cs' } });
    expect(screen.getByPlaceholderText('Client ID')).toHaveValue('cid');
  });

  it('supports per-environment auth tabs and saves authPerEnv', () => {
    const { onSave } = setup({ defaultMode: 'multi-env' });
    fireEvent.change(nameInput(), { target: { value: 'PerEnv' } });
    fireEvent.click(screen.getByRole('button', { name: 'Per environment' }));
    // active tab is e1 (Dev). Configure bearer on Dev.
    setAuthType('Bearer Token');
    fireEvent.change(screen.getByPlaceholderText('Paste your token'), { target: { value: 'devtok' } });
    // switch to Prod tab
    fireEvent.click(screen.getByRole('button', { name: /Prod/ }));
    // toggle back to single then per-env to exercise both switcher buttons
    fireEvent.click(screen.getByRole('button', { name: 'Same for all envs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Per environment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      authPerEnv: expect.objectContaining({ e1: { type: 'bearer', prefix: 'Bearer', token: 'devtok' } }),
      auth: undefined,
    }));
  });

  it('initializes per-env auth mode from existing authPerEnv', () => {
    const collection: RequestCollection = {
      id: 'c1', name: 'Existing', mode: 'multi-env', requests: [], folders: [],
      authPerEnv: { e1: { type: 'bearer', token: 'x' } },
    };
    setup({ collection });
    expect(screen.getByRole('button', { name: 'Per environment' })).toHaveClass('active');
  });

  it('has no top-right close button', () => {
    setup();
    expect(screen.queryByRole('button', { name: '×' })).not.toBeInTheDocument();
    expect(document.querySelector('.req-modal-close')).toBeNull();
  });

  it('is draggable via the header', () => {
    setup();
    const modal = screen.getByTestId('req-collection-modal');
    expect(modal).toHaveStyle({ transform: 'translate(0px, 0px)' });
    const header = document.querySelector('.req-modal-header')!;
    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 145, clientY: 130 });
    fireEvent.mouseUp(document);
    expect(modal).toHaveStyle({ transform: 'translate(45px, 30px)' });
  });

  it('closes via Cancel, overlay, and Escape; panel click does not close', () => {
    const { onClose } = setup();
    fireEvent.click(document.querySelector('.req-col-modal')!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(document.querySelector('.req-modal-overlay')!);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
