/**
 * @vitest-environment jsdom
 *
 * GqlConnectionModals — unit tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the heavy child components that have complex dependencies
vi.mock('./GraphqlProfileModal', () => ({
  GraphqlProfileModal: ({ onClose, onSave, onLoad, onDelete, profiles }: {
    onClose: () => void;
    onSave: (name: string) => unknown;
    onLoad: (p: { endpoint: string; auth: unknown }) => void;
    onDelete: (id: string) => void;
    profiles: unknown[];
  }) => (
    <div data-testid="graphql-profile-modal">
      <button onClick={onClose} data-testid="profile-close">Close Profile</button>
      <button onClick={() => onSave('New Profile')} data-testid="profile-save">Save</button>
      <button onClick={() => onLoad({ endpoint: 'https://new.endpoint/gql', auth: null })} data-testid="profile-load">Load</button>
      <button onClick={() => onDelete('profile-1')} data-testid="profile-delete">Delete</button>
      <span data-testid="profile-count">{profiles.length}</span>
    </div>
  ),
}));

vi.mock('./GraphqlEnvModal', () => ({
  GraphqlEnvModal: ({ onClose, onCreate, onDelete, onSetActive, onRename, onUpdateVariables, onImport, onExport }: {
    onClose: () => void;
    onCreate: (name: string) => string;
    onDelete: (id: string) => void;
    onSetActive: (id: string | null) => void;
    onRename: (id: string, name: string) => void;
    onUpdateVariables: (id: string, vars: unknown[]) => void;
    onImport: (json: string) => { success: boolean };
    onExport: (id: string) => string | null;
  }) => (
    <div data-testid="graphql-env-modal">
      <button onClick={onClose} data-testid="env-close">Close Env</button>
      <button onClick={() => onCreate('New Env')} data-testid="env-create">Create</button>
      <button onClick={() => onDelete('env-1')} data-testid="env-delete">Delete</button>
      <button onClick={() => onSetActive('env-1')} data-testid="env-set-active">Set Active</button>
      <button onClick={() => onRename('env-1', 'Renamed')} data-testid="env-rename">Rename</button>
      <button onClick={() => onUpdateVariables('env-1', [])} data-testid="env-update-vars">Update Vars</button>
      <button onClick={() => onImport('{"name":"test"}')} data-testid="env-import">Import</button>
      <button onClick={() => onExport('env-1')} data-testid="env-export">Export</button>
    </div>
  ),
}));

vi.mock('../../../shared/utils/storage', () => ({
  removeKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/tabPersistence', () => ({
  ENDPOINT_BASE_STORAGE_KEY: 'gql-endpoint-base',
}));

import { GqlConnectionModals } from './GqlConnectionModals';
import { removeKey } from '../../../shared/utils/storage';

// ─── Default Props ────────────────────────────────────────────────────────────

function makeDefaultProps(overrides = {}) {
  return {
    profileModalOpen: false,
    onProfileModalClose: vi.fn(),
    profiles: [],
    endpoint: 'https://api.example.com/graphql',
    auth: null,
    onSaveProfile: vi.fn(),
    onDeleteProfile: vi.fn(),
    onApplyProfileToActiveTab: vi.fn(),
    prevBaseUrlRef: { current: undefined } as React.MutableRefObject<string | undefined>,
    envModalOpen: false,
    onEnvModalClose: vi.fn(),
    environments: [],
    activeEnvironmentId: null,
    onCreateEnvironment: vi.fn().mockReturnValue('new-env-id'),
    onDeleteEnvironment: vi.fn(),
    onSetActiveEnvironment: vi.fn(),
    onRenameEnvironment: vi.fn(),
    onUpdateVariables: vi.fn(),
    onImportEnvironment: vi.fn().mockReturnValue({ success: true }),
    onExportEnvironment: vi.fn().mockReturnValue('{"name":"test"}'),
    ...overrides,
  };
}

import React from 'react';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GqlConnectionModals — conditional rendering', () => {
  it('does not render profile modal when profileModalOpen is false', () => {
    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: false })} />);
    expect(screen.queryByTestId('graphql-profile-modal')).toBeNull();
  });

  it('renders profile modal when profileModalOpen is true', () => {
    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: true })} />);
    expect(screen.getByTestId('graphql-profile-modal')).toBeTruthy();
  });

  it('does not render env modal when envModalOpen is false', () => {
    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: false })} />);
    expect(screen.queryByTestId('graphql-env-modal')).toBeNull();
  });

  it('renders env modal when envModalOpen is true', () => {
    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: true })} />);
    expect(screen.getByTestId('graphql-env-modal')).toBeTruthy();
  });

  it('can render both modals simultaneously', () => {
    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: true, envModalOpen: true })} />);
    expect(screen.getByTestId('graphql-profile-modal')).toBeTruthy();
    expect(screen.getByTestId('graphql-env-modal')).toBeTruthy();
  });
});

describe('GqlConnectionModals — profile modal interactions', () => {
  it('calls onProfileModalClose when profile modal close button is clicked', () => {
    const onProfileModalClose = vi.fn();
    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: true, onProfileModalClose })} />);
    fireEvent.click(screen.getByTestId('profile-close'));
    expect(onProfileModalClose).toHaveBeenCalledOnce();
  });

  it('calls onSaveProfile when profile save button is clicked', () => {
    const onSaveProfile = vi.fn();
    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: true, onSaveProfile })} />);
    fireEvent.click(screen.getByTestId('profile-save'));
    expect(onSaveProfile).toHaveBeenCalledWith('New Profile');
  });

  it('Phase 6F: applies profile to active tab on profile load without closing modal', () => {
    const onApplyProfileToActiveTab = vi.fn();
    const onProfileModalClose = vi.fn();
    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: true, onApplyProfileToActiveTab, onProfileModalClose })} />);
    fireEvent.click(screen.getByTestId('profile-load'));
    expect(onApplyProfileToActiveTab).toHaveBeenCalledWith({
      endpoint: 'https://new.endpoint/gql',
      auth: null,
    });
    expect(onProfileModalClose).not.toHaveBeenCalled();
    expect(removeKey).toHaveBeenCalledWith('gql-endpoint-base');
  });

  it('calls onDeleteProfile when profile delete button is clicked', () => {
    const onDeleteProfile = vi.fn();
    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: true, onDeleteProfile })} />);
    fireEvent.click(screen.getByTestId('profile-delete'));
    expect(onDeleteProfile).toHaveBeenCalledWith('profile-1');
  });

  it('passes profiles array to profile modal', () => {
    const profiles = [{ id: 'p1', name: 'Dev', endpoint: 'https://dev/gql', auth: null }];
    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: true, profiles })} />);
    expect(screen.getByTestId('profile-count').textContent).toBe('1');
  });
});

describe('GqlConnectionModals — env modal interactions', () => {
  it('calls onEnvModalClose when env modal close button is clicked', () => {
    const onEnvModalClose = vi.fn();
    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: true, onEnvModalClose })} />);
    fireEvent.click(screen.getByTestId('env-close'));
    expect(onEnvModalClose).toHaveBeenCalledOnce();
  });

  it('calls onCreateEnvironment when env create button is clicked', () => {
    const onCreateEnvironment = vi.fn().mockReturnValue('new-id');
    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: true, onCreateEnvironment })} />);
    fireEvent.click(screen.getByTestId('env-create'));
    expect(onCreateEnvironment).toHaveBeenCalledWith('New Env');
  });

  it('calls onDeleteEnvironment when env delete button is clicked', () => {
    const onDeleteEnvironment = vi.fn();
    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: true, onDeleteEnvironment })} />);
    fireEvent.click(screen.getByTestId('env-delete'));
    expect(onDeleteEnvironment).toHaveBeenCalledWith('env-1');
  });

  it('calls onSetActiveEnvironment when set active button is clicked', () => {
    const onSetActiveEnvironment = vi.fn();
    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: true, onSetActiveEnvironment })} />);
    fireEvent.click(screen.getByTestId('env-set-active'));
    expect(onSetActiveEnvironment).toHaveBeenCalledWith('env-1');
  });

  it('calls onRenameEnvironment when rename button is clicked', () => {
    const onRenameEnvironment = vi.fn();
    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: true, onRenameEnvironment })} />);
    fireEvent.click(screen.getByTestId('env-rename'));
    expect(onRenameEnvironment).toHaveBeenCalledWith('env-1', 'Renamed');
  });

  it('calls onUpdateVariables when update vars button is clicked', () => {
    const onUpdateVariables = vi.fn();
    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: true, onUpdateVariables })} />);
    fireEvent.click(screen.getByTestId('env-update-vars'));
    expect(onUpdateVariables).toHaveBeenCalledWith('env-1', []);
  });

  it('calls onImportEnvironment when import button is clicked', () => {
    const onImportEnvironment = vi.fn().mockReturnValue({ success: true });
    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: true, onImportEnvironment })} />);
    fireEvent.click(screen.getByTestId('env-import'));
    expect(onImportEnvironment).toHaveBeenCalledWith('{"name":"test"}');
  });

  it('calls onExportEnvironment when export button is clicked', () => {
    const onExportEnvironment = vi.fn().mockReturnValue('exported-json');
    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: true, onExportEnvironment })} />);
    fireEvent.click(screen.getByTestId('env-export'));
    expect(onExportEnvironment).toHaveBeenCalledWith('env-1');
  });
});

describe('GqlConnectionModals — focus restoration', () => {
  it('focuses profile badge after profile modal close', () => {
    const badge = document.createElement('button');
    badge.setAttribute('data-testid', 'gql-profile-badge');
    document.body.appendChild(badge);
    const focusSpy = vi.spyOn(badge, 'focus');

    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((fn: FrameRequestCallback) => {
      fn(0);
      return 1;
    });

    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: true })} />);
    fireEvent.click(screen.getByTestId('profile-close'));

    expect(focusSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
    document.body.removeChild(badge);
  });

  it('focuses env badge after env modal close', () => {
    const badge = document.createElement('button');
    badge.setAttribute('data-testid', 'gql-env-badge');
    document.body.appendChild(badge);
    const focusSpy = vi.spyOn(badge, 'focus');

    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((fn: FrameRequestCallback) => {
      fn(0);
      return 1;
    });

    render(<GqlConnectionModals {...makeDefaultProps({ envModalOpen: true })} />);
    fireEvent.click(screen.getByTestId('env-close'));

    expect(focusSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
    document.body.removeChild(badge);
  });

  it('sets prevBaseUrlRef sentinel when loading a profile', () => {
    const prevBaseUrlRef = { current: 'http://old' } as React.MutableRefObject<string | undefined>;
    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: true, prevBaseUrlRef })} />);
    fireEvent.click(screen.getByTestId('profile-load'));
    expect(prevBaseUrlRef.current).toBe('\0profile-pinned');
  });

  it('silently ignores removeKey failures when loading a profile', async () => {
    vi.mocked(removeKey).mockRejectedValueOnce(new Error('storage unavailable'));
    render(<GqlConnectionModals {...makeDefaultProps({ profileModalOpen: true })} />);
    fireEvent.click(screen.getByTestId('profile-load'));
    await Promise.resolve();
    expect(removeKey).toHaveBeenCalled();
  });
});
