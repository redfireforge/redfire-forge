/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AuthConfigPanel, { type AuthConfigPanelProps } from './AuthConfigPanel';
import type { GlobalAuthProfile } from '../../../shared/types';

vi.mock('../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({ value, onChange, placeholder, options }: {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    options: Array<{ value: string; label: string }>;
  }) => (
    <div data-testid={placeholder ? 'profile-select' : 'auth-select'} data-value={value}>
      <button type="button" onClick={() => onChange('')}>Set empty</button>
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)}>{option.label}</button>
      ))}
    </div>
  ),
}));

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

    const profileSelect = screen.getByTestId('profile-select');
    expect(profileSelect).toHaveAttribute('data-value', '');

    fireEvent.click(within(profileSelect).getByRole('button', { name: 'Set empty' }));
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
});