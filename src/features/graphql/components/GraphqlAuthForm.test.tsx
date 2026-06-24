/**
 * @vitest-environment jsdom
 *
 * GraphqlAuthForm.test.tsx — unit tests for the shared auth form (bottom Auth panel).
 */
import { render, fireEvent, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { GraphqlAuthForm } from './GraphqlAuthForm';
import { popoverShowsAuthOverride } from '../utils/gqlAuthPopoverUtils';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { GlobalAuthProfile } from '../../../shared/types';

interface RenderFormOptions {
  linkedProfileName?: string | null;
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
  authScope?: 'page' | 'tab';
  hasAuthOverride?: boolean;
  onResetToInherit?: () => void;
}

function renderForm(
  storedAuth: GraphqlAuth | null | undefined,
  onChange = vi.fn(),
  options: RenderFormOptions = {},
) {
  const {
    linkedProfileName = null,
    globalAuthProfiles = [],
    defaultAuthProfileId = null,
    authScope = 'page',
    onResetToInherit,
  } = options;
  const hasAuthOverride = options.hasAuthOverride
    ?? popoverShowsAuthOverride(storedAuth, authScope);

  return render(
    <GraphqlAuthForm
      storedAuth={storedAuth}
      authScope={authScope}
      hasAuthOverride={hasAuthOverride}
      onResetToInherit={onResetToInherit}
      onChange={onChange}
      linkedProfileName={linkedProfileName}
      globalAuthProfiles={globalAuthProfiles}
      defaultAuthProfileId={defaultAuthProfileId}
    />,
  );
}

describe('GraphqlAuthForm — rendering', () => {
  it('renders panel form with type selector', () => {
    renderForm(null);
    expect(screen.getByTestId('gql-auth-type-select')).toBeTruthy();
    expect(document.querySelector('.gql-auth-panel-form')).toBeTruthy();
  });

  it('shows "No Auth" as selected when auth is null', () => {
    renderForm(null);
    const select = screen.getByTestId('gql-auth-type-select') as HTMLSelectElement;
    expect(select.value).toBe('none');
  });

  it('shows bearer as selected when auth.type is bearer', () => {
    renderForm({ type: 'bearer', token: 'tok' });
    expect((screen.getByTestId('gql-auth-type-select') as HTMLSelectElement).value).toBe('bearer');
  });

  it('renders all auth type options without profiles on page scope', () => {
    renderForm(null);
    const values = Array.from(
      (screen.getByTestId('gql-auth-type-select') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(values).toEqual(['none', 'bearer', 'basic', 'apiKey', 'oauth2', 'custom']);
  });

  it('includes inherit workspace option for tab scope', () => {
    renderForm(undefined, vi.fn(), { authScope: 'tab' });
    const values = Array.from(
      (screen.getByTestId('gql-auth-type-select') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(values[0]).toBe('inherit-workspace');
  });

  it('includes inherit profile option when global auth profiles exist', () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Staging', auth: { type: 'bearer', token: 't' } },
    ];
    renderForm(null, vi.fn(), { globalAuthProfiles: profiles });
    const values = Array.from(
      (screen.getByTestId('gql-auth-type-select') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(values[0]).toBe('inherit');
    expect(values).toContain('none');
  });

  it('shows profile selector when inherit type is selected', () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Staging', auth: { type: 'bearer', token: 't' } },
    ];
    renderForm({ type: 'inherit', globalProfileId: 'p1' }, vi.fn(), { globalAuthProfiles: profiles });
    expect(screen.getByTestId('gql-auth-profile-select')).toBeTruthy();
    expect(screen.getByText('Staging')).toBeTruthy();
  });

  it('shows no-auth hint when type is none', () => {
    renderForm(null);
    expect(screen.getByText(/No authentication headers will be sent/)).toBeTruthy();
  });

  it('shows linked profile hint when tab override and linkedProfileName provided', () => {
    renderForm(
      { type: 'bearer', token: 'tok' },
      vi.fn(),
      { linkedProfileName: 'Staging', authScope: 'tab', hasAuthOverride: true },
    );
    const hint = screen.getByTestId('gql-auth-profile-hint');
    expect(hint.textContent).toContain('Staging');
    expect(hint.textContent).toContain('override');
  });

  it('calls onChange with inherit auth and default profile id when switching to inherit', () => {
    const onChange = vi.fn();
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Staging', auth: { type: 'bearer', token: 't' } },
    ];
    renderForm(null, onChange, { globalAuthProfiles: profiles, defaultAuthProfileId: 'p1' });
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'inherit' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: 'p1' });
  });

  it('falls back to first global profile when defaultAuthProfileId is unset', () => {
    const onChange = vi.fn();
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Staging', auth: { type: 'bearer', token: 't' } },
      { id: 'p2', name: 'Prod', auth: { type: 'bearer', token: 'p' } },
    ];
    renderForm({ type: 'oauth2', oauth2: { tokenUrl: '', clientId: '', clientSecret: '' } }, onChange, {
      authScope: 'tab',
      hasAuthOverride: true,
      globalAuthProfiles: profiles,
    });
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'inherit' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: 'p1' });
  });

  it('hides linked profile hint when linkedProfileName is absent', () => {
    renderForm({ type: 'bearer', token: 'tok' }, vi.fn(), { authScope: 'tab', hasAuthOverride: true });
    expect(screen.queryByTestId('gql-auth-profile-hint')).toBeNull();
  });
});

describe('GraphqlAuthForm — type switching', () => {
  it('calls onChange(null) when switching to No Auth', () => {
    const onChange = vi.fn();
    renderForm({ type: 'bearer', token: 'tok' }, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'none' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange with bearer when switching from null', () => {
    const onChange = vi.fn();
    renderForm(null, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'bearer' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'bearer' }));
  });

  it('does not call onChange when selecting the same type', () => {
    const onChange = vi.fn();
    renderForm({ type: 'bearer', token: 'tok' }, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'bearer' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when No Auth is already selected', () => {
    const onChange = vi.fn();
    renderForm(null, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'none' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sets default headerName when switching to apiKey from scratch', () => {
    const onChange = vi.fn();
    renderForm(null, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'apiKey' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'apiKey', headerName: 'X-API-Key' }),
    );
  });

  it('calls onChange with inherit when switching to inherit workspace on tab', () => {
    const onChange = vi.fn();
    renderForm(
      { type: 'bearer', token: 'tab-only' },
      onChange,
      { authScope: 'tab', hasAuthOverride: true },
    );
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'inherit-workspace' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit' });
  });
});

describe('GraphqlAuthForm — credential inputs', () => {
  it('calls onChange with updated bearer token', () => {
    const onChange = vi.fn();
    renderForm({ type: 'bearer', token: 'old' }, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-bearer-input'), { target: { value: 'new-token' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ token: 'new-token' }));
  });

  it('calls onChange with updated basic username', () => {
    const onChange = vi.fn();
    renderForm({ type: 'basic', username: 'old', password: '' }, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-basic-user'), { target: { value: 'newuser' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ username: 'newuser' }));
  });

  it('calls onChange with updated basic password', () => {
    const onChange = vi.fn();
    renderForm({ type: 'basic', username: 'u', password: 'old' }, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-basic-pass'), { target: { value: 'newpass' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ password: 'newpass' }));
  });

  it('calls onChange with updated apiKey header name', () => {
    const onChange = vi.fn();
    renderForm({ type: 'apiKey', headerName: 'X-Old', headerValue: 'v' }, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-apikey-name'), { target: { value: 'X-New-Key' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ headerName: 'X-New-Key' }));
  });
});

describe('GraphqlAuthForm — inherit and reset', () => {
  it('shows inherit banner for tab inheriting workspace', () => {
    renderForm(undefined, vi.fn(), { authScope: 'tab' });
    expect(screen.getByTestId('gql-auth-inherit-banner').textContent).toMatch(/workspace default/i);
  });

  it('shows inherit banner with profile name when profile-linked tab inherits', () => {
    renderForm(undefined, vi.fn(), { authScope: 'tab', linkedProfileName: 'Staging' });
    expect(screen.getByTestId('gql-auth-inherit-banner').textContent).toContain('Staging');
  });

  it('shows reset button when tab has auth override', () => {
    const onReset = vi.fn();
    renderForm(
      { type: 'bearer', token: 'tab-only' },
      vi.fn(),
      { authScope: 'tab', hasAuthOverride: true, onResetToInherit: onReset },
    );
    fireEvent.click(screen.getByTestId('gql-auth-reset-inherit-btn'));
    expect(onReset).toHaveBeenCalled();
  });

  it('shows page scope banner when editing page default auth', () => {
    renderForm({ type: 'bearer', token: 'page' }, vi.fn(), { authScope: 'page' });
    expect(screen.getByTestId('gql-auth-page-scope-banner')).toBeTruthy();
  });

  it('calls onChange when inherit profile selection changes', () => {
    const onChange = vi.fn();
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Staging', auth: { type: 'bearer', token: 't' } },
      { id: 'p2', name: 'Prod', auth: { type: 'bearer', token: 'p' } },
    ];
    renderForm(
      { type: 'inherit', globalProfileId: 'p1' },
      onChange,
      { authScope: 'tab', globalAuthProfiles: profiles },
    );
    fireEvent.change(screen.getByTestId('gql-auth-profile-select'), { target: { value: 'p2' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: 'p2' });
  });

  it('clears globalProfileId when inherit profile selection is emptied', () => {
    const onChange = vi.fn();
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Staging', auth: { type: 'bearer', token: 't' } },
    ];
    renderForm(
      { type: 'inherit', globalProfileId: 'p1' },
      onChange,
      { authScope: 'tab', globalAuthProfiles: profiles },
    );
    fireEvent.change(screen.getByTestId('gql-auth-profile-select'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: undefined });
  });

  it('shows override banner instead of inherit banner for tab inherit profile', () => {
    renderForm(
      { type: 'inherit', globalProfileId: 'p1' },
      vi.fn(),
      { authScope: 'tab', onResetToInherit: vi.fn() },
    );
    expect(screen.queryByTestId('gql-auth-inherit-banner')).toBeNull();
    expect(screen.getByTestId('gql-auth-override-banner')).toBeTruthy();
  });

  it('calls onChange with bearer when switch to explicit override is clicked', () => {
    const onChange = vi.fn();
    renderForm(undefined, onChange, { authScope: 'tab', hasAuthOverride: false });
    fireEvent.click(screen.getByTestId('gql-auth-switch-override-btn'));
    expect(onChange).toHaveBeenCalledWith({ type: 'bearer', token: '' });
  });

  it('calls onChange with default oauth2 object when switching to oauth2 from scratch', () => {
    const onChange = vi.fn();
    renderForm(null, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'oauth2' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'oauth2',
        oauth2: { tokenUrl: '', clientId: '', clientSecret: '' },
      }),
    );
  });
});

describe('GraphqlAuthForm — read-only auth types', () => {
  it('shows oauth2 fields and guidance', () => {
    renderForm({
      type: 'oauth2',
      oauth2: { tokenUrl: 'https://auth/token', clientId: 'c', clientSecret: 's' },
    });
    expect(screen.getByTestId('gql-auth-oauth-token-url')).toBeTruthy();
    expect(screen.getByTestId('gql-auth-oauth-client-id')).toBeTruthy();
    expect(screen.getByTestId('gql-auth-oauth-client-secret')).toBeTruthy();
    expect(screen.getByText(/pre-request scripts/i)).toBeTruthy();
  });

  it('shows custom read-only info', () => {
    renderForm({ type: 'custom' });
    expect(screen.getByText(/custom authentication headers/i)).toBeTruthy();
  });
});

describe('GraphqlAuthForm — password visibility', () => {
  it('token input starts as password type', () => {
    renderForm({ type: 'bearer', token: 'mytoken' });
    expect((screen.getByTestId('gql-auth-bearer-input') as HTMLInputElement).type).toBe('password');
  });

  it('toggles token input to text when show button is clicked', () => {
    renderForm({ type: 'bearer', token: 'mytoken' });
    fireEvent.click(screen.getByLabelText('Show value'));
    expect((screen.getByTestId('gql-auth-bearer-input') as HTMLInputElement).type).toBe('text');
  });
});

describe('GraphqlAuthForm — additional branches', () => {
  it('does not call onChange when inherit-workspace is already selected', () => {
    const onChange = vi.fn();
    renderForm({ type: 'inherit' }, onChange, { authScope: 'tab', hasAuthOverride: false });
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'inherit-workspace' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when inherit profile is already selected', () => {
    const onChange = vi.fn();
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Staging', auth: { type: 'bearer', token: 't' } },
    ];
    renderForm({ type: 'inherit', globalProfileId: 'p1' }, onChange, { globalAuthProfiles: profiles });
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'inherit' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores profile change when auth type is not inherit', () => {
    const onChange = vi.fn();
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Staging', auth: { type: 'bearer', token: 't' } },
      { id: 'p2', name: 'Prod', auth: { type: 'bearer', token: 'p' } },
    ];
    renderForm({ type: 'bearer', token: 'tok' }, onChange, { globalAuthProfiles: profiles });
    expect(screen.queryByTestId('gql-auth-profile-select')).toBeNull();
  });

  it('calls onChange with updated apiKey header value', () => {
    const onChange = vi.fn();
    renderForm({ type: 'apiKey', headerName: 'X-API-Key', headerValue: 'old' }, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-apikey-val'), { target: { value: 'new-key' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ headerValue: 'new-key' }));
  });

  it('calls onChange when oauth2 token URL changes', () => {
    const onChange = vi.fn();
    renderForm({
      type: 'oauth2',
      oauth2: { tokenUrl: 'https://old/token', clientId: 'c', clientSecret: 's' },
    }, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-oauth-token-url'), {
      target: { value: 'https://new/token' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        oauth2: expect.objectContaining({ tokenUrl: 'https://new/token' }),
      }),
    );
  });

  it('calls onChange when oauth2 client ID changes', () => {
    const onChange = vi.fn();
    renderForm({
      type: 'oauth2',
      oauth2: { tokenUrl: 'https://auth/token', clientId: 'old', clientSecret: 's' },
    }, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-oauth-client-id'), { target: { value: 'new-id' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        oauth2: expect.objectContaining({ clientId: 'new-id' }),
      }),
    );
  });

  it('calls onChange when oauth2 client secret changes', () => {
    const onChange = vi.fn();
    renderForm({
      type: 'oauth2',
      oauth2: { tokenUrl: 'https://auth/token', clientId: 'c', clientSecret: 'old' },
    }, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-oauth-client-secret'), { target: { value: 'new-secret' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        oauth2: expect.objectContaining({ clientSecret: 'new-secret' }),
      }),
    );
  });

  it('calls onChange with basic auth when switching from null', () => {
    const onChange = vi.fn();
    renderForm(null, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'basic' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'basic' }));
  });

  it('calls onChange with custom auth when switching from null', () => {
    const onChange = vi.fn();
    renderForm(null, onChange);
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'custom' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'custom' }));
  });

  it('uses empty-string fallbacks when credential fields are undefined', () => {
    renderForm({ type: 'bearer' } as GraphqlAuth);
    expect((screen.getByTestId('gql-auth-bearer-input') as HTMLInputElement).value).toBe('');

    const { unmount: unmountBasic } = renderForm({ type: 'basic' } as GraphqlAuth);
    expect((screen.getByTestId('gql-auth-basic-user') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('gql-auth-basic-pass') as HTMLInputElement).value).toBe('');
    unmountBasic();

    renderForm({ type: 'apiKey' } as GraphqlAuth);
    expect((screen.getByTestId('gql-auth-apikey-name') as HTMLInputElement).value).toBe('X-API-Key');
    expect((screen.getByTestId('gql-auth-apikey-val') as HTMLInputElement).value).toBe('');

    renderForm({ type: 'oauth2' } as GraphqlAuth);
    expect((screen.getByTestId('gql-auth-oauth-token-url') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('gql-auth-oauth-client-id') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('gql-auth-oauth-client-secret') as HTMLInputElement).value).toBe('');
  });

  it('shows inherit profile select with empty value when globalProfileId is unset', () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'p1', name: 'Staging', auth: { type: 'bearer', token: 't' } },
    ];
    renderForm({ type: 'inherit' }, vi.fn(), { globalAuthProfiles: profiles, authScope: 'tab' });
    expect((screen.getByTestId('gql-auth-profile-select') as HTMLSelectElement).value).toBe('');
  });
});
