// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from './SettingsModal';
import type { GlobalAuthProfile, AuthType } from '../../shared/types';

// ── Mock storage ──
vi.mock('../../shared/utils/storage', () => ({
  getStorageUsage: vi.fn().mockResolvedValue({ usedBytes: 0, entries: {} }),
  getMaxRuns: vi.fn().mockResolvedValue(50),
}));

// ── Mock audit log ──
vi.mock('../audit/utils/auditLog', () => ({
  logAuthProfileCreated: vi.fn(),
  logAuthProfileDeleted: vi.fn(),
  logAuthProfileRenamed: vi.fn(),
  logAuthProfileUpdated: vi.fn(),
}));

// ── Mock child tabs/panels to isolate this component ──
vi.mock('./SettingsStorageTab', () => ({ default: () => <div data-testid="storage-tab" /> }));
vi.mock('./SettingsExportImportTab', () => ({ default: () => <div data-testid="export-import-tab" /> }));
vi.mock('../audit/components/AuditLogPanel', () => ({ default: () => <div data-testid="audit-log-panel" /> }));

// ── Mock useAuthVerify hook with mutable module-level state ──
let mockAuthVerifying = false;
let mockAuthVerifyResult: { ok: boolean; message: string } | null = null;
const mockVerify = vi.fn();
const mockSetVerifyResult = vi.fn();
vi.mock('../requests/hooks/useAuthVerify', () => ({
  useAuthVerify: () => ({
    authVerifying: mockAuthVerifying,
    authVerifyResult: mockAuthVerifyResult,
    setAuthVerifyResult: mockSetVerifyResult,
    verifyAuth: mockVerify,
  }),
}));

import {
  logAuthProfileCreated,
  logAuthProfileDeleted,
  logAuthProfileRenamed,
  logAuthProfileUpdated,
} from '../audit/utils/auditLog';

const mCreated = vi.mocked(logAuthProfileCreated);
const mDeleted = vi.mocked(logAuthProfileDeleted);
const mRenamed = vi.mocked(logAuthProfileRenamed);
const mUpdated = vi.mocked(logAuthProfileUpdated);

function makeProfile(id: string, name: string, type: AuthType = 'none'): GlobalAuthProfile {
  return { id, name, auth: { type } as GlobalAuthProfile['auth'] };
}

/** Stateful harness so setAppGlobalAuthProfiles updates re-render with new profiles. */
function Harness({
  initialProfiles = [],
  confirmImpl,
  onImport = vi.fn(),
}: {
  initialProfiles?: GlobalAuthProfile[];
  confirmImpl?: (message: string, onConfirm: () => void) => void;
  onImport?: (data: unknown) => void;
}) {
  const [profiles, setProfiles] = useState<GlobalAuthProfile[]>(initialProfiles);
  return (
    <SettingsPage
      appGlobalAuthProfiles={profiles}
      setAppGlobalAuthProfiles={setProfiles}
      environments={[{ id: 'e1', name: 'Dev' }]}
      microservices={[{ id: 's1', name: 'Svc', baseUrls: {} }]}
      featureGroups={[]}
      onImport={onImport as never}
      confirm={confirmImpl ?? ((_m, cb) => cb())}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthVerifying = false;
  mockAuthVerifyResult = null;
});

describe('SettingsPage — navigation', () => {
  it('renders globalAuth tab by default and loads storage usage', async () => {
    render(<Harness />);
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Global Auth Profiles' })).toBeTruthy();
    expect(screen.getByText('No global auth profiles yet.')).toBeTruthy();
    const { getStorageUsage } = await import('../../shared/utils/storage');
    await waitFor(() => expect(getStorageUsage).toHaveBeenCalled());
  });

  it('switches between all four nav tabs', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));
    expect(screen.getByTestId('storage-tab')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Export & Import' }));
    expect(screen.getByTestId('export-import-tab')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));
    expect(screen.getByTestId('audit-log-panel')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Global Auth Profiles' }));
    expect(screen.getByRole('heading', { name: 'Global Auth Profiles' })).toBeTruthy();
  });
});

describe('SettingsPage — add profile', () => {
  function nameInput() {
    return screen.getByPlaceholderText(/Profile name/) as HTMLInputElement;
  }

  it('adds a profile via the Add button and logs creation', () => {
    render(<Harness />);
    fireEvent.change(nameInput(), { target: { value: 'my-profile' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mCreated).toHaveBeenCalledWith('my-profile', expect.any(String));
    // editing opens automatically -> Type select appears
    expect(screen.getByText('Type')).toBeTruthy();
  });

  it('does not add when the name is blank (Add button disabled / guarded)', () => {
    render(<Harness />);
    const addBtn = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
    // typing whitespace keeps it effectively empty after trim
    fireEvent.change(nameInput(), { target: { value: '   ' } });
    expect(addBtn.disabled).toBe(true);
  });

  it('adds a profile via Enter key with a trimmed name', () => {
    render(<Harness />);
    fireEvent.change(nameInput(), { target: { value: '  bearer-x  ' } });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(mCreated).toHaveBeenCalledWith('bearer-x', expect.any(String));
  });

  it('ignores Enter when the name is empty', () => {
    render(<Harness />);
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(mCreated).not.toHaveBeenCalled();
  });
});

describe('SettingsPage — profile editing', () => {
  it('renames a profile on blur when the name actually changed', () => {
    render(<Harness initialProfiles={[makeProfile('p1', 'old-name')]} />);
    const nameField = document.querySelector('.global-auth-profile-name') as HTMLInputElement;
    // Blur with a different value while state still holds the old name so the
    // rename-detection branch (oldProfile.name !== newName) fires.
    fireEvent.blur(nameField, { target: { value: 'new-name' } });
    expect(mRenamed).toHaveBeenCalledWith('p1', 'old-name', 'new-name');
  });

  it('does not log a rename when the name is unchanged', () => {
    render(<Harness initialProfiles={[makeProfile('p1', 'same')]} />);
    const nameField = document.querySelector('.global-auth-profile-name') as HTMLInputElement;
    fireEvent.blur(nameField, { target: { value: 'same' } });
    expect(mRenamed).not.toHaveBeenCalled();
  });

  it('updates the profile name as the user types', () => {
    render(<Harness initialProfiles={[makeProfile('p1', 'a')]} />);
    const nameField = document.querySelector('.global-auth-profile-name') as HTMLInputElement;
    fireEvent.change(nameField, { target: { value: 'renamed' } });
    expect((document.querySelector('.global-auth-profile-name') as HTMLInputElement).value).toBe('renamed');
  });

  it('shows a No Auth badge for none-type and a type badge otherwise', () => {
    render(<Harness initialProfiles={[makeProfile('p1', 'a', 'none'), makeProfile('p2', 'b', 'bearer')]} />);
    expect(screen.getByText('No Auth')).toBeTruthy();
    expect(screen.getByText('BEARER')).toBeTruthy();
  });

  it('toggles Configure/Collapse and resets verify result + secret', () => {
    render(<Harness initialProfiles={[makeProfile('p1', 'a', 'none')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(mockSetVerifyResult).toHaveBeenCalledWith(null);
    expect(screen.getByText('Type')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.queryByText('Type')).toBeNull();
  });

  it('deletes a profile through confirm and logs deletion', () => {
    const confirmImpl = vi.fn((_m: string, cb: () => void) => cb());
    render(<Harness initialProfiles={[makeProfile('p1', 'doomed')]} confirmImpl={confirmImpl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirmImpl).toHaveBeenCalledWith('Delete global auth profile "doomed"?', expect.any(Function));
    expect(mDeleted).toHaveBeenCalledWith('doomed', 'p1');
    expect(document.querySelector('.global-auth-profile-card')).toBeNull();
  });

  it('does not delete when confirm is cancelled', () => {
    const confirmImpl = vi.fn(); // never invokes the callback
    render(<Harness initialProfiles={[makeProfile('p1', 'kept')]} confirmImpl={confirmImpl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mDeleted).not.toHaveBeenCalled();
    expect(document.querySelector('.global-auth-profile-card')).toBeTruthy();
  });
});

describe('SettingsPage — auth type fields', () => {
  function openConfig(profiles: GlobalAuthProfile[]) {
    render(<Harness initialProfiles={profiles} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
  }

  it('changes the auth type and logs the update', () => {
    openConfig([makeProfile('p1', 'a', 'none')]);
    const select = document.querySelector('.auth-type-select select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'bearer' } });
    expect(mUpdated).toHaveBeenCalledWith('a', 'p1', [
      { field: 'type', oldValue: 'none', newValue: 'bearer' },
    ]);
  });

  it('does not log when the selected type is unchanged', () => {
    openConfig([makeProfile('p1', 'a', 'bearer')]);
    const select = document.querySelector('.auth-type-select select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'bearer' } });
    expect(mUpdated).not.toHaveBeenCalled();
  });

  it('renders basic fields and toggles the secret', () => {
    openConfig([makeProfile('p1', 'a', 'basic')]);
    expect(screen.getByText('Username')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
    const inputs = document.querySelectorAll('.form-row.two-col input');
    fireEvent.change(inputs[0], { target: { value: 'user' } });
    fireEvent.change(inputs[1], { target: { value: 'pass' } });
    const pwd = document.querySelector('.secret-input-wrap input') as HTMLInputElement;
    expect(pwd.type).toBe('password');
    fireEvent.click(document.querySelector('.secret-toggle') as HTMLElement);
    expect((document.querySelector('.secret-input-wrap input') as HTMLInputElement).type).toBe('text');
  });

  it('renders bearer fields and edits token/prefix', () => {
    openConfig([makeProfile('p1', 'a', 'bearer')]);
    expect(screen.getByText('Token')).toBeTruthy();
    expect(screen.getByText('Prefix')).toBeTruthy();
    const tokenInput = screen.getByPlaceholderText('eyJhbGciOi...') as HTMLInputElement;
    fireEvent.change(tokenInput, { target: { value: 'tok' } });
    const prefixInput = screen.getByPlaceholderText('Bearer') as HTMLInputElement;
    fireEvent.change(prefixInput, { target: { value: 'Token' } });
  });

  it('renders apikey fields with header/query radios', () => {
    openConfig([makeProfile('p1', 'a', 'apikey')]);
    expect(screen.getByText('Key Name')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('X-API-Key'), { target: { value: 'X-Key' } });
    fireEvent.change(screen.getByPlaceholderText('your-api-key'), { target: { value: 'v' } });
    const radios = document.querySelectorAll('.radio-group input[type="radio"]');
    fireEvent.click(radios[1]); // query
    fireEvent.click(radios[0]); // header
  });

  it('renders digest fields', () => {
    openConfig([makeProfile('p1', 'a', 'digest')]);
    expect(screen.getByText('Username')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
    const inputs = document.querySelectorAll('.form-row.two-col input');
    fireEvent.change(inputs[0], { target: { value: 'user' } });
    fireEvent.change(inputs[1], { target: { value: 'pass' } });
    fireEvent.click(document.querySelector('.secret-toggle') as HTMLElement);
  });

  it('renders oauth2 fields and edits them', () => {
    openConfig([makeProfile('p1', 'a', 'oauth2')]);
    expect(screen.getByText('Token URL')).toBeTruthy();
    expect(screen.getByText('Client ID')).toBeTruthy();
    expect(screen.getByText('Client Secret')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('https://auth.example.com/oauth/token'), { target: { value: 'u' } });
    const inputs = document.querySelectorAll('.form-row.two-col input');
    fireEvent.change(inputs[0], { target: { value: 'client-id' } });
    fireEvent.change(inputs[1], { target: { value: 'secret' } });
    fireEvent.click(document.querySelector('.secret-toggle') as HTMLElement);
  });
});

describe('SettingsPage — verify auth', () => {
  it('does not show the verify section for none-type profiles', () => {
    render(<Harness initialProfiles={[makeProfile('p1', 'a', 'none')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.queryByText('Verify Auth')).toBeNull();
  });

  it('calls verifyAuth when the verify button is clicked', () => {
    render(<Harness initialProfiles={[makeProfile('p1', 'a', 'bearer')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify Auth' }));
    expect(mockVerify).toHaveBeenCalled();
  });

  it('disables the button and shows "Verifying..." while verifying', () => {
    mockAuthVerifying = true;
    render(<Harness initialProfiles={[makeProfile('p1', 'a', 'bearer')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const btn = screen.getByRole('button', { name: 'Verifying...' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders a successful verify result', () => {
    mockAuthVerifyResult = { ok: true, message: 'All good' };
    render(<Harness initialProfiles={[makeProfile('p1', 'a', 'bearer')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByText('All good')).toBeTruthy();
    expect(document.querySelector('.auth-verify-ok')).toBeTruthy();
  });

  it('renders a failed verify result', () => {
    mockAuthVerifyResult = { ok: false, message: 'Nope' };
    render(<Harness initialProfiles={[makeProfile('p1', 'a', 'bearer')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByText('Nope')).toBeTruthy();
    expect(document.querySelector('.auth-verify-fail')).toBeTruthy();
  });
});
