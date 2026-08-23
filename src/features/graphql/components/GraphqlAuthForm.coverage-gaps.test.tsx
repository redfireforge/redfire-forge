/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { GraphqlAuth } from '@shared/types/graphql';
import { GraphqlAuthForm } from './GraphqlAuthForm';

vi.mock('../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({ value, onChange, options, 'data-testid': dataTestId }: {
    value: string;
    onChange: (next: string) => void;
    options: Array<{ value: string; label: string; disabled?: boolean }>;
    'data-testid'?: string;
  }) => (
    <select
      data-testid={dataTestId ?? 'mock-select'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
      ))}
    </select>
  ),
}));

vi.mock('./GraphqlAuthPasswordInput', () => ({
  GraphqlAuthPasswordInput: ({ value, onChange, testId }: {
    value?: string;
    onChange: (next: string) => void;
    testId: string;
  }) => (
    <input
      data-testid={testId}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

function renderForm(storedAuth: GraphqlAuth | null | undefined, onChange = vi.fn(), authScope: 'page' | 'tab' = 'page') {
  return {
    onChange,
    ...render(
      <GraphqlAuthForm
        storedAuth={storedAuth}
        authScope={authScope}
        hasAuthOverride={authScope === 'tab' ? !!storedAuth : false}
        onChange={onChange}
        onResetToInherit={vi.fn()}
        linkedProfileName={null}
        globalAuthProfiles={[
          { id: 'p1', name: 'Profile A', auth: { type: 'bearer', token: 't1' } },
          { id: 'p2', name: 'Profile B', auth: { type: 'bearer', token: 't2' } },
        ]}
        defaultAuthProfileId="p2"
      />,
    ),
  };
}

describe('GraphqlAuthForm coverage gaps', () => {
  it('handles tab inherit-workspace and no-auth transitions', () => {
    const { onChange } = renderForm(undefined, vi.fn(), 'tab');
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'inherit-workspace' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'none' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('creates inherit auth with default profile and updates profile selection', () => {
    const { onChange } = renderForm(null);
    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'inherit' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: 'p2' });

    const onChange2 = vi.fn();
    renderForm({ type: 'inherit', globalProfileId: 'p1' }, onChange2);
    fireEvent.change(screen.getByTestId('gql-auth-profile-select'), { target: { value: '' } });
    expect(onChange2).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: undefined });
  });

  it('covers apiKey and oauth2 conversion branches', () => {
    const onChange = vi.fn();
    renderForm({ type: 'bearer', token: 'abc' }, onChange);

    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'apiKey' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'apiKey', headerName: 'X-API-Key' }));

    fireEvent.change(screen.getByTestId('gql-auth-type-select'), { target: { value: 'oauth2' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'oauth2',
        oauth2: { tokenUrl: '', clientId: '', clientSecret: '' },
      }),
    );
  });

  it('updates oauth2 fields and custom auth info rendering', () => {
    const onChange = vi.fn();
    const first = renderForm({ type: 'oauth2', oauth2: { tokenUrl: '', clientId: '', clientSecret: '' } }, onChange);

    fireEvent.change(screen.getByTestId('gql-auth-oauth-token-url'), { target: { value: 'https://idp/token' } });
    fireEvent.change(screen.getByTestId('gql-auth-oauth-client-id'), { target: { value: 'client-id' } });
    fireEvent.change(screen.getByTestId('gql-auth-oauth-client-secret'), { target: { value: 'secret' } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ oauth2: expect.objectContaining({ tokenUrl: 'https://idp/token' }) }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ oauth2: expect.objectContaining({ clientId: 'client-id' }) }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ oauth2: expect.objectContaining({ clientSecret: 'secret' }) }));

    first.unmount();
    renderForm({ type: 'custom' }, vi.fn());
    expect(screen.getAllByText(/Headers panel/i).length).toBeGreaterThan(0);
  });
});
