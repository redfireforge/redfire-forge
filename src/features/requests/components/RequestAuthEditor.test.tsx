/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestAuthEditor from './RequestAuthEditor';
import type { RequestCollection, AuthConfig } from '../../../shared/types';

function collection(overrides: Partial<RequestCollection> = {}): RequestCollection {
  return {
    id: 'c1',
    name: 'Coll',
    mode: 'single',
    requests: [],
    auth: { type: 'bearer', token: 't' },
    ...overrides,
  };
}

describe('RequestAuthEditor', () => {
  it('omits Global Auth Profile option when no workspace profiles exist', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'none' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByRole('option', { name: /Global Auth Profile/ })).toBeNull();
  });

  it('shows inherit summary with profile name when collection uses global profile', () => {
    const auth: AuthConfig = { type: 'inherit' };
    const onUpdate = vi.fn();
    const { container } = render(
      <RequestAuthEditor
        auth={auth}
        collection={collection({
          auth: { ...auth, globalProfileId: 'gp', type: 'bearer', token: 'x' },
        })}
        globalAuthProfiles={[{ id: 'gp', name: 'Shared', auth: { type: 'bearer', token: 'x', globalProfileId: 'gp' } }]}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByText(/Shared/)).toBeInTheDocument();
    expect(container.querySelector('.req-auth-inherit-info')).toHaveTextContent(/collection.*Coll/s);
  });

  it('switching type to global profile picks first profile', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'none' }}
        collection={collection()}
        globalAuthProfiles={[
          { id: 'first', name: 'A', auth: { type: 'basic', username: 'u', password: 'p' } },
        ]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'global-profile' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ globalProfileId: 'first', username: 'u' }),
    );
  });

  it('changing profile in secondary select updates merged auth', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer', token: 'x', globalProfileId: 'p1' }}
        collection={collection()}
        globalAuthProfiles={[
          { id: 'p1', name: 'Old', auth: { type: 'bearer', token: 'old' } },
          { id: 'p2', name: 'Beta', auth: { type: 'apikey', apiKeyName: 'k', apiKeyValue: 'v', apiKeyIn: 'header' } },
        ]}
        onUpdate={onUpdate}
      />,
    );
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'p2' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ globalProfileId: 'p2', apiKeyName: 'k' }),
    );
  });

  it('shows bearer inputs when bearer without selected profile binding', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer', token: 'abc', prefix: 'Custom' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Custom')).toBeInTheDocument();
    expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
  });

  it('updates apiKeyIn select', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'apikey', apiKeyName: 'n', apiKeyValue: '', apiKeyIn: 'header' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[combos.length - 1], { target: { value: 'query' } });
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ apiKeyIn: 'query' }));
  });

  it('shows basic and oauth2 credential fields when selected without global profile', () => {
    const { rerender } = render(
      <RequestAuthEditor
        auth={{ type: 'basic', username: 'u1', password: 'p1' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('u1')).toBeInTheDocument();
    rerender(
      <RequestAuthEditor
        auth={{ type: 'oauth2', tokenUrl: 'https://t', clientId: 'c', clientSecret: 's' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('https://t')).toBeInTheDocument();
    expect(screen.getByDisplayValue('c')).toBeInTheDocument();
  });

  it('inherit summary falls back to raw collection auth type without global profile id', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'inherit' }}
        collection={collection({ auth: { type: 'apikey', apiKeyName: 'X', apiKeyValue: 'Y' } })}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText(/apikey/)).toBeInTheDocument();
  });

  it('omits inherit summary when collection auth is none', () => {
    const { container } = render(
      <RequestAuthEditor
        auth={{ type: 'inherit' }}
        collection={collection({ auth: { type: 'none' } })}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(container.querySelector('.req-auth-inherit-info')).toBeNull();
  });

  it('shows global profile selector and badge when linked to a profile', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer', globalProfileId: 'gp1', token: 't' }}
        collection={collection()}
        globalAuthProfiles={[{ id: 'gp1', name: 'Prod', auth: { type: 'bearer', token: 't' } }]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('Prod')).toBeInTheDocument();
    expect(screen.getByText('BEARER')).toBeInTheDocument();
  });

  it('switching type to none updates auth kind', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer', token: 't' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'none' } });
    expect(onUpdate).toHaveBeenCalledWith({ type: 'none' });
  });

  it('profile change with unknown id does not call onUpdate', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer', globalProfileId: 'gp1', token: 't' }}
        collection={collection()}
        globalAuthProfiles={[{ id: 'gp1', name: 'Prod', auth: { type: 'bearer', token: 't' } }]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'missing' } });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('renders Bearer prefix default while editing token-less bearer auth', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer', token: 'tok' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Bearer')).toBeInTheDocument();
  });

  it('shows bearer credential fields while global-profile row has orphan profile binding', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer', token: 'solo', prefix: 'Token', globalProfileId: 'gone' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('solo')).toBeInTheDocument();
  });

  it('inherit banner falls back to collection auth literal when referenced profile vanished', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'inherit' }}
        collection={collection({
          auth: { type: 'bearer', globalProfileId: 'missing', token: 'x' },
        })}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText(/bearer/)).toBeInTheDocument();
  });

  it('keeps bearer fields editable outside global bindings', async () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer', token: 'secret' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Token'), { target: { value: 'next' } });
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ token: 'next', type: 'bearer' }));
  });

  it('surfaces dedicated oauth credential fields when selected directly', async () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'oauth2', tokenUrl: 'https://auth/old', clientId: 'cid', clientSecret: 'sec' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('https://auth/old'), { target: { value: 'https://auth/next' } });
    expect(onUpdate.mock.calls.some((c) =>
      typeof c[0] === 'object' && c[0] !== null && (c[0] as { tokenUrl?: string }).tokenUrl === 'https://auth/next',
    )).toBe(true);
    vi.mocked(onUpdate).mockClear();
    fireEvent.change(screen.getByDisplayValue('cid'), { target: { value: 'new-c' } });
    expect(onUpdate.mock.calls.some((c) =>
      typeof c[0] === 'object' && c[0] !== null && (c[0] as { clientId?: string }).clientId === 'new-c',
    )).toBe(true);
    vi.mocked(onUpdate).mockClear();
    fireEvent.change(screen.getByPlaceholderText('Client Secret'), { target: { value: 'new-s' } });
    expect(onUpdate.mock.calls.some((c) =>
      typeof c[0] === 'object' && c[0] !== null && (c[0] as { clientSecret?: string }).clientSecret === 'new-s',
    )).toBe(true);
  });

  it('streams basic credential edits independently', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'basic', username: 'u0', password: 'p0' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'u9' } });
    expect(onUpdate.mock.calls.some((c) =>
      typeof c[0] === 'object' && c[0] !== null && (c[0] as { username?: string }).username === 'u9',
    )).toBe(true);
    vi.mocked(onUpdate).mockClear();
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'p9' } });
    expect(onUpdate.mock.calls.some((c) =>
      typeof c[0] === 'object' && c[0] !== null && (c[0] as { password?: string }).password === 'p9',
    )).toBe(true);
  });

  it('streams standalone api key pairing fields independently', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'apikey', apiKeyName: 'kn', apiKeyValue: '', apiKeyIn: 'header' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Key name'), { target: { value: 'new-name' } });
    expect(onUpdate.mock.calls.some((c) =>
      typeof c[0] === 'object' && c[0] !== null && (c[0] as { apiKeyName?: string }).apiKeyName === 'new-name',
    )).toBe(true);
    vi.mocked(onUpdate).mockClear();
    fireEvent.change(screen.getByPlaceholderText('Key value'), { target: { value: 'sekret' } });
    expect(onUpdate.mock.calls.some((c) =>
      typeof c[0] === 'object' && c[0] !== null && (c[0] as { apiKeyValue?: string }).apiKeyValue === 'sekret',
    )).toBe(true);
  });

  it('suppresses bearer field editors while a resolved global profile is active', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer', globalProfileId: 'gp', token: 'shadow' }}
        collection={collection()}
        globalAuthProfiles={[{ id: 'gp', name: 'Platform', auth: { type: 'bearer', token: 'real' } }]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText('Token')).toBeNull();
    expect(screen.getByText('Platform')).toBeInTheDocument();
  });

  it('suppresses oauth fields when oauth travels through a pinned global profile', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'oauth2', globalProfileId: 'go', tokenUrl: '', clientId: '', clientSecret: '' }}
        collection={collection()}
        globalAuthProfiles={[
          { id: 'go', name: 'IdP', auth: { type: 'oauth2', tokenUrl: 'https://auth/t', clientId: 'id', clientSecret: 'sec' } },
        ]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText('https://auth.example.com/oauth/token')).toBeNull();
    expect(screen.getByText('IdP')).toBeInTheDocument();
  });

  it('suppresses basic field editors while a resolved global profile supplies credentials', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'basic', globalProfileId: 'gp', username: 'shadow', password: 'shadow' }}
        collection={collection()}
        globalAuthProfiles={[{ id: 'gp', name: 'Team', auth: { type: 'basic', username: 'real', password: 'pwd' } }]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText('Username')).toBeNull();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('suppresses api key pair editors while relying on synced global credential rows', () => {
    render(
      <RequestAuthEditor
        auth={{
          type: 'apikey',
          globalProfileId: 'apid',
          apiKeyName: 'ignored',
          apiKeyValue: 'ignored',
          apiKeyIn: 'query',
        }}
        collection={collection()}
        globalAuthProfiles={[
          { id: 'apid', name: 'Secrets', auth: { type: 'apikey', apiKeyName: 'real', apiKeyValue: 'v', apiKeyIn: 'header' } },
        ]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText('Key name')).toBeNull();
    expect(screen.getByText('Secrets')).toBeInTheDocument();
  });

  it('shows collection profile label inside inherit summaries when linkage resolves', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'inherit' }}
        collection={collection({
          auth: { type: 'bearer', globalProfileId: 'gp', token: 'x' },
        })}
        globalAuthProfiles={[{ id: 'gp', name: 'Linked', auth: { type: 'bearer', token: 'z' } }]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('Linked')).toBeInTheDocument();
  });

  it('shows raw collection auth identifiers when inheritance targets a vanished profile binding', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'inherit' }}
        collection={collection({
          auth: { type: 'bearer', globalProfileId: 'missing', token: '' },
        })}
        globalAuthProfiles={[{ id: 'other', name: 'Other', auth: { type: 'basic', username: '', password: '' } }]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('bearer')).toBeInTheDocument();
  });

  it('exposes oauth2 secret placeholders even when handshake fields begin empty', () => {
    render(
      <RequestAuthEditor
        auth={{ type: 'oauth2' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('https://auth.example.com/oauth/token')).toHaveValue('');
    expect(screen.getByPlaceholderText('Client Secret')).toHaveValue('');
  });

  it('hides inheritance helper when upstream collection authentication is absent', () => {
    const { container } = render(
      <RequestAuthEditor
        auth={{ type: 'inherit' }}
        collection={collection({ auth: undefined })}
        globalAuthProfiles={[]}
        onUpdate={vi.fn()}
      />,
    );
    expect(container.querySelector('.req-auth-inherit-info')).toBeNull();
  });

  it('allows literal bearer prefix overrides besides the default chip', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer', token: 'scoped' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('Bearer'), { target: { value: 'Token' } });
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'Token', type: 'bearer' }));
  });

  it('renders bearer fields with all defaults when no optional props are set', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'bearer' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByDisplayValue('Bearer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Token')).toHaveValue('');
  });

  it('renders basic fields with undefined username/password', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'basic' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByPlaceholderText('Username')).toHaveValue('');
    expect(screen.getByPlaceholderText('Password')).toHaveValue('');
  });

  it('renders apikey fields with undefined key values', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'apikey' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByPlaceholderText('Key name')).toHaveValue('');
    expect(screen.getByPlaceholderText('Key value')).toHaveValue('');
    const combos = screen.getAllByRole('combobox');
    const addToSelect = combos[combos.length - 1];
    expect(addToSelect).toHaveValue('header');
  });

  it('switching to global-profile with empty profiles does not call onUpdate', () => {
    const onUpdate = vi.fn();
    render(
      <RequestAuthEditor
        auth={{ type: 'none' }}
        collection={collection()}
        globalAuthProfiles={[]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bearer' } });
    expect(onUpdate).toHaveBeenCalledWith({ type: 'bearer' });
  });
});
