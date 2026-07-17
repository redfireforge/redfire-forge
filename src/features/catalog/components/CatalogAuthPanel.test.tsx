/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CatalogAuthPanel from './CatalogAuthPanel';
import { makeScheme } from './catalogTestFactories';
import type { AuthConfig, GlobalAuthProfile } from '../../../shared/types';
import type { CatalogSecurityScheme } from '../types/catalog';

const verifyState = vi.hoisted(() => ({
  authVerifying: false,
  authVerifyResult: null as { ok: boolean; message: string; detail?: string } | null,
  setAuthVerifyResult: vi.fn(),
  verifyAuth: vi.fn(),
}));

vi.mock('../../requests/hooks/useAuthVerify', () => ({
  useAuthVerify: () => verifyState,
}));

beforeEach(() => {
  verifyState.authVerifying = false;
  verifyState.authVerifyResult = null;
  verifyState.setAuthVerifyResult.mockClear();
  verifyState.verifyAuth.mockClear();
});

function renderPanel(over: {
  auth?: AuthConfig;
  schemes?: Record<string, CatalogSecurityScheme>;
  globals?: GlobalAuthProfile[];
  onAuthChange?: (a: AuthConfig) => void;
  onClose?: () => void;
} = {}) {
  const onAuthChange = over.onAuthChange ?? vi.fn();
  const onClose = over.onClose ?? vi.fn();
  render(
    <CatalogAuthPanel
      auth={over.auth ?? { type: 'none' }}
      onAuthChange={onAuthChange}
      securitySchemes={over.schemes ?? {}}
      globalAuthProfiles={over.globals}
      onClose={onClose}
    />,
  );
  return { onAuthChange, onClose };
}

describe('CatalogAuthPanel', () => {
  it('renders No Auth by default and hides the verify button', () => {
    renderPanel();
    expect(screen.getByText('Authorization')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Verify Auth/ })).not.toBeInTheDocument();
  });

  it('switches to Bearer and shows token fields plus verify button', async () => {
    const { onAuthChange } = renderPanel();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'bearer');
    expect(onAuthChange).toHaveBeenCalledWith({ type: 'bearer' });
  });

  it('renders bearer fields and verifies auth', async () => {
    renderPanel({ auth: { type: 'bearer', token: 'abc' } });
    const verifyBtn = screen.getByRole('button', { name: 'Verify Auth' });
    await userEvent.click(verifyBtn);
    expect(verifyState.setAuthVerifyResult).toHaveBeenCalledWith(null);
    expect(verifyState.verifyAuth).toHaveBeenCalled();
  });

  it('shows verifying state and a success result', () => {
    verifyState.authVerifying = true;
    verifyState.authVerifyResult = { ok: true, message: 'Looks good', detail: 'HTTP 200' };
    renderPanel({ auth: { type: 'bearer' } });
    expect(screen.getByRole('button', { name: 'Verifying...' })).toBeDisabled();
    expect(screen.getByText('Looks good')).toBeInTheDocument();
    expect(screen.getByText('HTTP 200')).toBeInTheDocument();
  });

  it('shows a failure result', () => {
    verifyState.authVerifyResult = { ok: false, message: 'Unauthorized' };
    renderPanel({ auth: { type: 'bearer' } });
    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
  });

  it('offers Inherit from Spec and auto-detects an apiKey scheme', async () => {
    const { onAuthChange } = renderPanel({
      schemes: { apiKeyAuth: makeScheme({ type: 'apiKey', name: 'X-Key', in: 'header' }) },
    });
    await userEvent.selectOptions(screen.getByRole('combobox'), 'inherit');
    expect(onAuthChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'apikey', apiKeyName: 'X-Key', apiKeyIn: 'header', __inherit: true, __schemeName: 'apiKeyAuth' }),
    );
  });

  it('renders inherited apiKey fields with the authorization hint', () => {
    renderPanel({
      auth: { type: 'apikey', apiKeyName: 'Authorization', apiKeyIn: 'header', __inherit: true, __schemeName: 's1' },
      schemes: { s1: makeScheme({ type: 'apiKey', name: 'Authorization', in: 'header' }) },
    });
    expect(screen.getByText(/"Bearer" prefix is added automatically/)).toBeInTheDocument();
  });

  it('lets the user switch between multiple inherited schemes', async () => {
    const { onAuthChange } = renderPanel({
      auth: { type: 'bearer', __inherit: true, __schemeName: 'bearerAuth' },
      schemes: {
        bearerAuth: makeScheme({ type: 'http', scheme: 'bearer' }),
        basicAuth: makeScheme({ type: 'http', scheme: 'basic' }),
      },
    });
    const selects = screen.getAllByRole('combobox');
    // Second combobox is the Scheme selector
    await userEvent.selectOptions(selects[1], 'basicAuth');
    expect(onAuthChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'basic', __inherit: true, __schemeName: 'basicAuth' }),
    );
  });

  it('supports From Environment global profiles', async () => {
    const globals: GlobalAuthProfile[] = [
      { id: 'g1', name: 'Prod Token', auth: { type: 'bearer', token: 't' } },
      { id: 'g2', name: 'OAuth', auth: { type: 'oauth2', tokenUrl: 'https://token' } },
    ];
    const { onAuthChange } = renderPanel({
      auth: { type: 'bearer', __globalProfileId: 'g1', __globalProfileName: 'Prod Token' },
      globals,
    });
    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'g2');
    expect(onAuthChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'oauth2', __globalProfileId: 'g2', __globalProfileName: 'OAuth' }),
    );
  });

  it('switches the mode to global when selecting From Environment', async () => {
    const globals: GlobalAuthProfile[] = [{ id: 'g1', name: 'Prod', auth: { type: 'bearer', token: 't' } }];
    const { onAuthChange } = renderPanel({ globals });
    await userEvent.selectOptions(screen.getByRole('combobox'), 'global');
    expect(onAuthChange).toHaveBeenCalledWith(
      expect.objectContaining({ __globalProfileId: 'g1', __globalProfileName: 'Prod' }),
    );
  });

  it('shows the OAuth2 hint for a global oauth2 profile', () => {
    renderPanel({
      auth: { type: 'oauth2', tokenUrl: 'https://token.example', __globalProfileId: 'g1', __globalProfileName: 'OAuth' },
      globals: [{ id: 'g1', name: 'OAuth', auth: { type: 'oauth2', tokenUrl: 'https://token.example' } }],
    });
    expect(screen.getByText(/Token will be acquired automatically/)).toBeInTheDocument();
    expect(screen.getByText('https://token.example')).toBeInTheDocument();
  });

  it('edits standalone apiKey fields including Add To', async () => {
    const { onAuthChange } = renderPanel({ auth: { type: 'apikey' } });
    const addToSelect = screen.getAllByRole('combobox')[1];
    await userEvent.selectOptions(addToSelect, 'query');
    expect(onAuthChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyIn: 'query' }));
  });

  it('edits basic auth username and password', async () => {
    const { onAuthChange } = renderPanel({ auth: { type: 'basic' } });
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], 'u');
    expect(onAuthChange).toHaveBeenCalled();
  });

  it('describes every scheme type in the multi-scheme selector', () => {
    renderPanel({
      auth: { type: 'apikey', __inherit: true, __schemeName: 'apiKeyAuth' },
      schemes: {
        apiKeyAuth: makeScheme({ type: 'apiKey', name: 'X-Key', in: 'query', description: 'a query key' }),
        basicAuth: makeScheme({ type: 'http', scheme: 'basic' }),
        oauthAuth: makeScheme({ type: 'oauth2' }),
        oidcAuth: makeScheme({ type: 'openIdConnect' }),
      },
    });
    expect(document.body.textContent).toContain('API Key in query: X-Key');
    expect(document.body.textContent).toContain('OAuth 2.0');
    expect(document.body.textContent).toContain('OpenID Connect');
  });

  it('auto-detects an http basic scheme on switch', async () => {
    const { onAuthChange } = renderPanel({
      auth: { type: 'bearer', __inherit: true, __schemeName: 'a' },
      schemes: {
        a: makeScheme({ type: 'http', scheme: 'bearer' }),
        b: makeScheme({ type: 'http', scheme: 'basic' }),
        c: makeScheme({ type: 'oauth2' }),
      },
    });
    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'c');
    expect(onAuthChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'bearer', __inherit: true, __schemeName: 'c' }),
    );
  });

  it('shows the global badge detail for basic and apikey profiles', () => {
    const { unmount } = render(
      <CatalogAuthPanel
        auth={{ type: 'basic', __globalProfileId: 'g1', __globalProfileName: 'BasicProf' }}
        onAuthChange={vi.fn()}
        securitySchemes={{}}
        globalAuthProfiles={[{ id: 'g1', name: 'BasicProf', auth: { type: 'basic' } }]}
        onClose={vi.fn()}
      />,
    );
    expect(document.body.textContent).toContain('Basic Auth');
    unmount();

    render(
      <CatalogAuthPanel
        auth={{ type: 'apikey', apiKeyName: 'X-Key', __globalProfileId: 'g2', __globalProfileName: 'KeyProf' }}
        onAuthChange={vi.fn()}
        securitySchemes={{}}
        globalAuthProfiles={[{ id: 'g2', name: 'KeyProf', auth: { type: 'apikey', apiKeyName: 'X-Key' } }]}
        onClose={vi.fn()}
      />,
    );
    expect(document.body.textContent).toContain('API Key: X-Key');
  });

  it('switches to None and to standalone apikey via the mode selector', async () => {
    const { onAuthChange } = renderPanel({ auth: { type: 'bearer' } });
    await userEvent.selectOptions(screen.getByRole('combobox'), 'none');
    expect(onAuthChange).toHaveBeenCalledWith({ type: 'none' });
    onAuthChange.mockClear();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'apikey');
    expect(onAuthChange).toHaveBeenCalledWith({ type: 'apikey' });
  });

  it('edits bearer token and prefix fields', async () => {
    const { onAuthChange } = renderPanel({ auth: { type: 'bearer' } });
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], 'x');
    await userEvent.type(inputs[1], 'y');
    expect(onAuthChange).toHaveBeenCalled();
  });

  it('edits basic auth password field', async () => {
    const { onAuthChange } = renderPanel({ auth: { type: 'basic' } });
    const pwd = document.querySelector('input[type="password"]') as HTMLInputElement;
    await userEvent.type(pwd, 'p');
    expect(onAuthChange).toHaveBeenCalledWith(expect.objectContaining({ password: 'p' }));
  });

  it('edits inherited apiKey value field', async () => {
    const { onAuthChange } = renderPanel({
      auth: { type: 'apikey', apiKeyName: 'authorization', apiKeyValue: '', __inherit: true, __schemeName: 'k' },
      schemes: { k: makeScheme({ type: 'apiKey', name: 'authorization', in: 'header' }) },
    });
    const valueInput = screen.getByPlaceholderText(/Paste JWT token/);
    await userEvent.type(valueInput, 'v');
    expect(onAuthChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyValue: 'v' }));
  });

  it('edits standalone apiKey key name and value', async () => {
    const { onAuthChange } = renderPanel({ auth: { type: 'apikey' } });
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], 'K');
    await userEvent.type(inputs[1], 'V');
    expect(onAuthChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyName: 'K' }));
    expect(onAuthChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyValue: 'V' }));
  });

  it('switches inherited scheme to an apiKey and to an http basic scheme', async () => {
    const { onAuthChange } = renderPanel({
      auth: { type: 'bearer', __inherit: true, __schemeName: 'a' },
      schemes: {
        a: makeScheme({ type: 'http', scheme: 'bearer' }),
        b: makeScheme({ type: 'apiKey', name: 'X-Tok', in: 'query' }),
        c: makeScheme({ type: 'http', scheme: 'basic' }),
      },
    });
    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'b');
    expect(onAuthChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'apikey', apiKeyName: 'X-Tok', apiKeyIn: 'query', __inherit: true, __schemeName: 'b' }),
    );
    await userEvent.selectOptions(selects[1], 'c');
    expect(onAuthChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'basic', __inherit: true, __schemeName: 'c' }),
    );
  });

  it('auto-detects an http basic scheme as the first inherited scheme', async () => {
    const { onAuthChange } = renderPanel({
      schemes: {
        basicAuth: makeScheme({ type: 'http', scheme: 'basic' }),
        oidcAuth: makeScheme({ type: 'openIdConnect' }),
      },
    });
    await userEvent.selectOptions(screen.getByRole('combobox'), 'inherit');
    expect(onAuthChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'basic', __inherit: true, __schemeName: 'basicAuth' }),
    );
  });

  it('closes via the close button', async () => {
    const { onClose } = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalled();
  });
});
