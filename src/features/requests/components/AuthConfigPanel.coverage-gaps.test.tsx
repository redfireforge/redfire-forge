/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AuthConfigPanel, { type AuthConfigPanelProps } from './AuthConfigPanel';
import type { GlobalAuthProfile } from '../../../shared/types';

const AUTH_TYPE_OPTIONS = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic' },
  { value: 'bearer', label: 'Bearer' },
  { value: 'apikey', label: 'API Key' },
  { value: 'digest', label: 'Digest' },
  { value: 'oauth2', label: 'OAuth2' },
];

const PROFILES: GlobalAuthProfile[] = [
  { id: 'p1', name: 'Prod Bearer', auth: { type: 'bearer', token: 'abc' } } as GlobalAuthProfile,
];

function renderPanel(overrides: Partial<AuthConfigPanelProps> = {}) {
  return render(
    <AuthConfigPanel
      auth={{ type: 'none' }}
      onChange={vi.fn()}
      title="Authentication"
      hint="Configure auth"
      authVerifying={false}
      authVerifyResult={null}
      setAuthVerifyResult={vi.fn()}
      verifyAuth={vi.fn()}
      showSecret={false}
      setShowSecret={vi.fn()}
      authTypeOptions={AUTH_TYPE_OPTIONS}
      {...overrides}
    />,
  );
}

describe('AuthConfigPanel coverage gaps', () => {
  it('uses an empty profile selector value and normalizes empty selections to undefined', () => {
    const onProfileChange = vi.fn();
    renderPanel({
      auth: { type: 'inherit' },
      showProfileSelector: true,
      allAuthProfiles: PROFILES,
      onProfileChange,
    });

    const profileSelect = document.querySelector('.global-profile-selector select') as HTMLSelectElement | null;
    expect(profileSelect).toBeTruthy();
    expect(profileSelect?.value).toBe('');
    fireEvent.change(profileSelect!, { target: { value: '' } });
    expect(onProfileChange).toHaveBeenCalledWith(undefined);
  });

  it('renders empty-string defaults for optional bearer, api key, and digest fields', () => {
    const { rerender } = render(
      <AuthConfigPanel
        auth={{ type: 'bearer' }}
        onChange={vi.fn()}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
      />,
    );

    expect(screen.getByPlaceholderText('eyJhbGciOi...')).toHaveValue('');
    expect(screen.getByPlaceholderText('Bearer')).toHaveValue('Bearer');

    rerender(
      <AuthConfigPanel
        auth={{ type: 'apikey' }}
        onChange={vi.fn()}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
      />,
    );

    expect(screen.getByPlaceholderText('X-API-Key')).toHaveValue('');
    expect(screen.getByPlaceholderText('your-api-key')).toHaveValue('');

    rerender(
      <AuthConfigPanel
        auth={{ type: 'digest' }}
        onChange={vi.fn()}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
      />,
    );

    expect(screen.getAllByRole('textbox').every((input) => (input as HTMLInputElement).value === '')).toBe(true);
  });

  it('executes the secret visibility updater callback', () => {
    const setShowSecret = vi.fn((updater: (current: boolean) => boolean) => updater(false));
    renderPanel({
      auth: { type: 'oauth2', clientSecret: 'secret' },
      setShowSecret,
    });

    fireEvent.click(screen.getByTitle('Show'));

    expect(setShowSecret).toHaveBeenCalled();
  });

  it('covers stacked field variants and emits updates for all stacked auth inputs', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AuthConfigPanel
        auth={{ type: 'basic', username: 'u1', password: 'p1' }}
        onChange={onChange}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
        useStackedBearerFields={true}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('u1'), { target: { value: 'u2' } });
    fireEvent.change(screen.getByDisplayValue('p1'), { target: { value: 'p2' } });

    rerender(
      <AuthConfigPanel
        auth={{ type: 'bearer', token: 't1', prefix: 'Bearer' }}
        onChange={onChange}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
        useStackedBearerFields={true}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('eyJhbGciOi...'), { target: { value: 't2' } });
    fireEvent.change(screen.getByPlaceholderText('Bearer'), { target: { value: 'JWT' } });

    rerender(
      <AuthConfigPanel
        auth={{ type: 'apikey', apiKeyName: 'X-A', apiKeyValue: 'V-A', apiKeyIn: 'header' }}
        onChange={onChange}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
        useStackedBearerFields={true}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('X-A'), { target: { value: 'X-B' } });
    fireEvent.change(screen.getByDisplayValue('V-A'), { target: { value: 'V-B' } });
    fireEvent.click(screen.getByLabelText('Query Parameter'));
    fireEvent.click(screen.getByLabelText('Header'));

    rerender(
      <AuthConfigPanel
        auth={{ type: 'digest', username: 'du', password: 'dp' }}
        onChange={onChange}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
        useStackedBearerFields={true}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('du'), { target: { value: 'du2' } });
    fireEvent.change(screen.getByDisplayValue('dp'), { target: { value: 'dp2' } });

    rerender(
      <AuthConfigPanel
        auth={{ type: 'oauth2', tokenUrl: 'https://a', clientId: 'cid', clientSecret: 'sec' }}
        onChange={onChange}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
        useStackedBearerFields={true}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('https://a'), { target: { value: 'https://b' } });
    fireEvent.change(screen.getByDisplayValue('cid'), { target: { value: 'cid2' } });
    fireEvent.change(screen.getByDisplayValue('sec'), { target: { value: 'sec2' } });
    fireEvent.click(screen.getByTitle('Show'));

    expect(onChange).toHaveBeenCalled();
  });

  it('covers custom auth dropdown close paths and type fallback label', () => {
    const onChange = vi.fn();
    const withUnknownType = [{ value: 'none', label: 'No Auth' }];
    render(
      <AuthConfigPanel
        auth={{ type: 'custom-type' }}
        onChange={onChange}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={withUnknownType}
        useCustomTypeDropdown={true}
      />,
    );

    expect(screen.getByTestId('auth-type-trigger').textContent).toContain('custom-type');
    fireEvent.change(document.querySelector('.auth-type-hidden-select') as HTMLSelectElement, { target: { value: 'none' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'none' });

    fireEvent.click(screen.getByTestId('auth-type-trigger'));
    expect(screen.getByRole('listbox', { name: 'Auth type options' })).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox', { name: 'Auth type options' })).toBeNull();
  });

  it('covers profile dropdown close and clear-selection paths in inherit mode', () => {
    const onProfileChange = vi.fn();
    render(
      <AuthConfigPanel
        auth={{ type: 'inherit' }}
        onChange={vi.fn()}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useCustomTypeDropdown={true}
        showProfileSelector={true}
        allAuthProfiles={PROFILES}
        globalAuthProfileId={'p1'}
        onProfileChange={onProfileChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Auth profile'));
    expect(screen.getByRole('listbox', { name: 'Auth profile options' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Auth profile options' })).toBeNull();

    fireEvent.click(screen.getByLabelText('Auth profile'));
    fireEvent.click(screen.getByRole('option', { name: '— Select a profile —' }));
    expect(onProfileChange).toHaveBeenCalledWith(undefined);
  });

  it('keeps dropdown open on non-Escape key and ignores non-Node mousedown targets', () => {
    render(
      <AuthConfigPanel
        auth={{ type: 'inherit' }}
        onChange={vi.fn()}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useCustomTypeDropdown={true}
        showProfileSelector={true}
        allAuthProfiles={PROFILES}
      />,
    );

    fireEvent.click(screen.getByTestId('auth-type-trigger'));
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByRole('listbox', { name: 'Auth type options' })).toBeTruthy();

    const fakeTypeMouseDown = new MouseEvent('mousedown');
    Object.defineProperty(fakeTypeMouseDown, 'target', { value: { notNode: true } });
    document.dispatchEvent(fakeTypeMouseDown);
    expect(screen.getByRole('listbox', { name: 'Auth type options' })).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Auth profile'));
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByRole('listbox', { name: 'Auth profile options' })).toBeTruthy();
    const fakeProfileMouseDown = new MouseEvent('mousedown');
    Object.defineProperty(fakeProfileMouseDown, 'target', { value: { notNode: true } });
    document.dispatchEvent(fakeProfileMouseDown);
    expect(screen.getByRole('listbox', { name: 'Auth profile options' })).toBeTruthy();
  });

  it('covers stacked api-key query checked state and stacked oauth hide toggle', () => {
    const setShowSecret = vi.fn();
    const { rerender } = render(
      <AuthConfigPanel
        auth={{ type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'val', apiKeyIn: 'query' }}
        onChange={vi.fn()}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={setShowSecret}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
      />,
    );
    expect(screen.getByLabelText('Query Parameter')).toBeChecked();
    expect(screen.getByLabelText('Header')).not.toBeChecked();

    rerender(
      <AuthConfigPanel
        auth={{ type: 'bearer', token: 'tok' }}
        onChange={vi.fn()}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={setShowSecret}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedBearerFields={true}
      />,
    );
    expect(screen.getByPlaceholderText('Bearer')).toHaveValue('Bearer');

    rerender(
      <AuthConfigPanel
        auth={{ type: 'oauth2', tokenUrl: 'https://a', clientId: 'id', clientSecret: 'sec' }}
        onChange={vi.fn()}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={true}
        setShowSecret={setShowSecret}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
      />,
    );
    fireEvent.click(screen.getByTitle('Hide'));
    expect(setShowSecret).toHaveBeenCalled();
  });

  it('covers non-custom auth type select change', () => {
    const onChange = vi.fn();
    renderPanel({
      auth: { type: 'none' },
      onChange,
      useCustomTypeDropdown: false,
    });

    fireEvent.change(screen.getByDisplayValue('No Auth'), { target: { value: 'basic' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'basic' });
  });

  it('covers auth/profile dropdown Escape close and profile outside-click close', () => {
    render(
      <AuthConfigPanel
        auth={{ type: 'inherit' }}
        onChange={vi.fn()}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useCustomTypeDropdown={true}
        showProfileSelector={true}
        allAuthProfiles={PROFILES}
      />,
    );

    fireEvent.click(screen.getByTestId('auth-type-trigger'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Auth type options' })).toBeNull();

    fireEvent.click(screen.getByLabelText('Auth profile'));
    expect(screen.getByRole('listbox', { name: 'Auth profile options' })).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox', { name: 'Auth profile options' })).toBeNull();
  });

  it('covers stacked default fallbacks and onChange handlers for optional fields', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AuthConfigPanel
        auth={{ type: 'basic' }}
        onChange={onChange}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={true}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
      />,
    );
    let stackedInputs = container.querySelectorAll('.auth-stacked-field-control');
    fireEvent.change(stackedInputs[0], { target: { value: 'user' } });
    fireEvent.change(stackedInputs[1], { target: { value: 'pass' } });

    rerender(
      <AuthConfigPanel
        auth={{ type: 'apikey' }}
        onChange={onChange}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={true}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('X-API-Key'), { target: { value: 'X-K' } });
    fireEvent.change(screen.getByPlaceholderText('your-api-key'), { target: { value: 'v' } });

    rerender(
      <AuthConfigPanel
        auth={{ type: 'digest' }}
        onChange={onChange}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={true}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
      />,
    );
    const digestInputs = container.querySelectorAll('.auth-stacked-field-control');
    fireEvent.change(digestInputs[0], { target: { value: 'du' } });
    fireEvent.change(digestInputs[1], { target: { value: 'dp' } });

    rerender(
      <AuthConfigPanel
        auth={{ type: 'oauth2' }}
        onChange={onChange}
        title="Authentication"
        hint="Configure auth"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={true}
        setShowSecret={vi.fn()}
        authTypeOptions={AUTH_TYPE_OPTIONS}
        useStackedAuthFields={true}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('https://auth.example.com/oauth/token'), { target: { value: 'https://idp' } });
    stackedInputs = container.querySelectorAll('.auth-stacked-field-control');
    fireEvent.change(stackedInputs[1], { target: { value: 'client-id' } });
    const secretWrap = screen.getByText('Client Secret').closest('.auth-stacked-field-row')?.querySelector('.secret-input-wrap');
    const secretInput = secretWrap?.querySelector('input') as HTMLInputElement;
    fireEvent.change(secretInput, { target: { value: 'client-secret' } });

    expect(onChange).toHaveBeenCalled();
  });
});