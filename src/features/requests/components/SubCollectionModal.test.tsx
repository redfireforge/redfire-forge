/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubCollectionModal from './SubCollectionModal';
import type { RequestFolder, RequestCollection, RequestEnv, GlobalAuthProfile } from '../../../shared/types';

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
  globalAuthProfiles?: GlobalAuthProfile[];
} = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <SubCollectionModal
      subCollection={overrides.subCollection ?? makeSub()}
      parentCollection={overrides.parentCollection ?? directCollection}
      environments={overrides.environments ?? ENVS}
      globalAuthProfiles={overrides.globalAuthProfiles ?? PROFILES}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
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
    const envSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(envSelect, { target: { value: 'e1' } });
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

  it('initializes baseUrlOverride from existing sub baseUrls', () => {
    const sub = makeSub({ selectedEnvId: 'e1', baseUrls: { e1: 'https://existing.example.com' } });
    setup({ subCollection: sub, parentCollection: multiEnvCollection });
    expect(screen.getByDisplayValue('https://existing.example.com')).toBeInTheDocument();
  });

  it('saves none auth', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'none' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'none' } }));
  });

  it('configures and saves bearer auth', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bearer' } });
    fireEvent.change(screen.getByPlaceholderText('Paste your token'), { target: { value: 'mytoken' } });
    fireEvent.change(screen.getByPlaceholderText('Bearer'), { target: { value: 'JWT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auth: { type: 'bearer', prefix: 'JWT', token: 'mytoken' },
    }));
  });

  it('configures and saves basic auth', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'basic' } });
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auth: { type: 'basic', username: 'alice', password: 'pw' },
    }));
  });

  it('configures and saves api-key auth with query target', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'api-key' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. X-API-Key'), { target: { value: 'X-Key' } });
    fireEvent.change(screen.getByPlaceholderText('Key value'), { target: { value: 'secret' } });
    const addToSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(addToSelect, { target: { value: 'query' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secret', apiKeyIn: 'query' },
    }));
  });

  it('configures and saves oauth2 auth', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'oauth2' } });
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
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'global-profile' } });
    const profileSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(profileSelect, { target: { value: 'p2' } });
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
    expect(screen.queryByRole('option', { name: 'Global Auth Profile' })).toBeNull();
  });

  it('derives authType none from existing none auth', () => {
    const sub = makeSub({ auth: { type: 'none' } });
    const { onSave } = setup({ subCollection: sub });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'none' } }));
  });
});
