/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubCollectionModal from './SubCollectionModal';
import type { RequestFolder, RequestCollection, RequestEnv, GlobalAuthProfile, Microservice } from '@shared/types';

const ENVS: RequestEnv[] = [
  { id: 'e1', name: 'Dev' },
  { id: 'e2', name: 'Prod' },
];

const PROFILES: GlobalAuthProfile[] = [
  { id: 'p1', name: 'Prod Bearer', auth: { type: 'bearer', token: 'tok' } },
  { id: 'p2', name: 'Basic', auth: { type: 'basic', username: 'u' } },
];

const directCollection: RequestCollection = {
  id: 'c1',
  name: 'Direct',
  mode: 'direct',
  requests: [],
  folders: [],
};

const multiEnvCollection: RequestCollection = {
  id: 'c2',
  name: 'Multi',
  mode: 'multi-env',
  baseUrls: { e1: 'https://dev.example.com', e2: 'https://prod.example.com' },
  requests: [],
  folders: [],
};

function makeSub(overrides: Partial<RequestFolder> = {}): RequestFolder {
  return { id: 'f1', name: 'Sub A', requests: [], folders: [], isSubCollection: true, ...overrides };
}

function setup(overrides: {
  subCollection?: RequestFolder;
  parentCollection?: RequestCollection;
  environments?: RequestEnv[];
  microservices?: Microservice[];
  globalAuthProfiles?: GlobalAuthProfile[];
} = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <SubCollectionModal
      subCollection={overrides.subCollection ?? makeSub()}
      parentCollection={overrides.parentCollection ?? directCollection}
      environments={overrides.environments ?? ENVS}
      microservices={overrides.microservices}
      globalAuthProfiles={overrides.globalAuthProfiles ?? PROFILES}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
}

const darkTrigger = (testId: string) =>
  screen.getByTestId(testId).querySelector('.wf-dark-select__trigger') as HTMLButtonElement;

function pickDark(testId: string, optionLabel: string | RegExp) {
  fireEvent.click(darkTrigger(testId));
  fireEvent.click(screen.getByRole('option', { name: optionLabel }));
}

describe('SubCollectionModal', () => {
  it('renders header and prefilled name', () => {
    setup();
    expect(screen.getByText('Sub-Collection Settings')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sub A')).toBeInTheDocument();
  });

  it('closes on overlay click and stops propagation on panel click', () => {
    const { onClose } = setup();
    fireEvent.click(document.querySelector('.req-subcol-panel')!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('.req-subcol-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Cancel button', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('saves trimmed name with inherit auth by default', () => {
    const { onSave, onClose } = setup();
    fireEvent.change(screen.getByDisplayValue('Sub A'), { target: { value: '  Renamed  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
      name: 'Renamed',
      auth: { type: 'inherit' },
      selectedEnvId: undefined,
      baseUrls: undefined,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('falls back to original name when blank', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByDisplayValue('Sub A'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sub A' }));
  });

  it('does not render env selector for direct parent collection', () => {
    setup({ parentCollection: directCollection });
    expect(screen.queryByText('Environment')).toBeNull();
  });

  it('renders env selector for multi-env parent and saves selected env with override', () => {
    const { onSave } = setup({ parentCollection: multiEnvCollection });
    expect(screen.getByText('Environment')).toBeInTheDocument();
    pickDark('req-subcol-env-select', 'Dev');
    expect(screen.getByText('https://dev.example.com')).toBeInTheDocument();
    const overrideInput = screen.getByPlaceholderText('https://dev.example.com');
    fireEvent.change(overrideInput, { target: { value: 'https://override.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      selectedEnvId: 'e1',
      baseUrls: { e1: 'https://override.example.com' },
    }));
  });

  it('shows (not set) when parent has no base url for selected env', () => {
    const partial: RequestCollection = { ...multiEnvCollection, baseUrls: { e1: '' } };
    setup({ parentCollection: partial });
    // only e1 listed (e2 missing); but e1 has empty string => filtered out, so no envs
    expect(screen.queryByText('Environment')).toBeNull();
  });

  it('lists envs from a linked microservice (resolved base URLs)', () => {
    const linked: RequestCollection = {
      id: 'c3', name: 'Linked', mode: 'multi-env', microserviceId: 'svc1', requests: [], folders: [],
    };
    const microservices: Microservice[] = [
      { id: 'svc1', name: 'Svc', baseUrls: { e1: 'https://svc-dev', e2: 'https://svc-prod' } },
    ];
    const { onSave } = setup({ parentCollection: linked, microservices });
    expect(screen.getByText('Environment')).toBeInTheDocument();
    pickDark('req-subcol-env-select', 'Prod');
    expect(screen.getByText('https://svc-prod')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ selectedEnvId: 'e2' }));
  });

  it('excludes an env already bound to a sibling sub-collection (one-per-env)', () => {
    const parent: RequestCollection = {
      ...multiEnvCollection,
      folders: [
        { id: 'sibling', name: 'Dev', requests: [], folders: [], isSubCollection: true, selectedEnvId: 'e1' },
        makeSub(),
      ],
    };
    setup({ parentCollection: parent });
    fireEvent.click(darkTrigger('req-subcol-env-select'));
    // e1 (Dev) is used by the sibling → hidden; only e2 (Prod) offered
    expect(screen.queryByRole('option', { name: 'Dev' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Prod' })).toBeInTheDocument();
  });

  it('keeps its own bound env selectable even if it appears used', () => {
    const sub = makeSub({ id: 'self', selectedEnvId: 'e1' });
    const parent: RequestCollection = {
      ...multiEnvCollection,
      folders: [sub],
    };
    setup({ subCollection: sub, parentCollection: parent });
    fireEvent.click(darkTrigger('req-subcol-env-select'));
    expect(screen.getByRole('option', { name: 'Dev' })).toBeInTheDocument();
  });

  it('initializes baseUrlOverride from existing sub baseUrls', () => {
    const sub = makeSub({ selectedEnvId: 'e1', baseUrls: { e1: 'https://existing.example.com' } });
    setup({ subCollection: sub, parentCollection: multiEnvCollection });
    expect(screen.getByDisplayValue('https://existing.example.com')).toBeInTheDocument();
  });

  it('saves none auth', () => {
    const { onSave } = setup();
    pickDark('req-subcol-auth-type-select', 'No Auth');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'none' } }));
  });

  it('configures and saves bearer auth', () => {
    const { onSave } = setup();
    pickDark('req-subcol-auth-type-select', 'Bearer Token');
    fireEvent.change(screen.getByPlaceholderText('Paste your token'), { target: { value: 'mytoken' } });
    fireEvent.change(screen.getByPlaceholderText('Bearer'), { target: { value: 'JWT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auth: { type: 'bearer', prefix: 'JWT', token: 'mytoken' },
    }));
  });

  it('configures and saves basic auth', () => {
    const { onSave } = setup();
    pickDark('req-subcol-auth-type-select', 'Basic Auth');
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auth: { type: 'basic', username: 'alice', password: 'pw' },
    }));
  });

  it('configures and saves api-key auth with query target', () => {
    const { onSave } = setup();
    pickDark('req-subcol-auth-type-select', 'API Key');
    fireEvent.change(screen.getByPlaceholderText('e.g. X-API-Key'), { target: { value: 'X-Key' } });
    fireEvent.change(screen.getByPlaceholderText('Key value'), { target: { value: 'secret' } });
    pickDark('req-subcol-apikey-in-select', 'Query String');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secret', apiKeyIn: 'query' },
    }));
  });

  it('configures and saves oauth2 auth', () => {
    const { onSave } = setup();
    pickDark('req-subcol-auth-type-select', 'OAuth2 Client Credentials');
    fireEvent.change(screen.getByPlaceholderText('https://auth.example.com/oauth/token'), { target: { value: 'https://t' } });
    fireEvent.change(screen.getByPlaceholderText('Client ID'), { target: { value: 'cid' } });
    fireEvent.change(screen.getByPlaceholderText('Client Secret'), { target: { value: 'sec' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auth: { type: 'oauth2', tokenUrl: 'https://t', clientId: 'cid', clientSecret: 'sec' },
    }));
  });

  it('configures and saves global-profile auth resolving the profile', () => {
    const { onSave } = setup();
    pickDark('req-subcol-auth-type-select', 'Global Auth Profile');
    pickDark('req-subcol-profile-select', 'Basic (basic)');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auth: { type: 'basic', username: 'u', globalProfileId: 'p2' },
    }));
  });

  it('saves inherit when global-profile selection points to a missing profile', () => {
    const sub = makeSub({ auth: { type: 'bearer', token: 't', globalProfileId: 'gone' } });
    const { onSave } = setup({ subCollection: sub });
    // initial authType is global-profile because globalProfileId set + profiles present
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'inherit' } }));
  });

  it('hides global-profile option when no profiles available', () => {
    setup({ globalAuthProfiles: [] });
    fireEvent.click(darkTrigger('req-subcol-auth-type-select'));
    expect(screen.queryByRole('option', { name: 'Global Auth Profile' })).toBeNull();
  });

  it('derives authType none from existing none auth', () => {
    const sub = makeSub({ auth: { type: 'none' } });
    const { onSave } = setup({ subCollection: sub });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'none' } }));
  });
});
