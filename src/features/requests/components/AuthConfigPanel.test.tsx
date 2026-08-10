/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthConfigPanel, { type AuthConfigPanelProps } from './AuthConfigPanel';
import type { AuthConfig, GlobalAuthProfile } from '../../../shared/types';
import type { AuthVerifyResult } from '../hooks/useAuthVerify';

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
  { id: 'p1', name: 'Prod Bearer', auth: { type: 'bearer', token: 'abc' } },
  { id: 'p2', name: 'Staging Basic', auth: { type: 'basic', username: 'u' } },
];

function setup(overrides: Partial<AuthConfigPanelProps> = {}) {
  const onChange = vi.fn();
  const verifyAuth = vi.fn();
  const setAuthVerifyResult = vi.fn();
  const setShowSecret = vi.fn();
  const onProfileChange = vi.fn();
  const props: AuthConfigPanelProps = {
    auth: { type: 'none' },
    onChange,
    title: 'Authentication',
    hint: 'Configure auth',
    authVerifying: false,
    authVerifyResult: null,
    setAuthVerifyResult,
    verifyAuth,
    showSecret: false,
    setShowSecret,
    authTypeOptions: AUTH_TYPE_OPTIONS,
    ...overrides,
  };
  const utils = render(<AuthConfigPanel {...props} />);
  return { ...utils, onChange, verifyAuth, setAuthVerifyResult, setShowSecret, onProfileChange, props };
}

describe('AuthConfigPanel', () => {
  it('renders title and hint and stops click propagation', () => {
    const onParentClick = vi.fn();
    const { container } = render(
      <div onClick={onParentClick}>
        <AuthConfigPanel
          auth={{ type: 'none' }}
          onChange={vi.fn()}
          title="My Auth"
          hint="some hint"
          authVerifying={false}
          authVerifyResult={null}
          setAuthVerifyResult={vi.fn()}
          verifyAuth={vi.fn()}
          showSecret={false}
          setShowSecret={vi.fn()}
          authTypeOptions={AUTH_TYPE_OPTIONS}
        />
      </div>,
    );
    expect(screen.getByText('My Auth')).toBeInTheDocument();
    expect(screen.getByText('some hint')).toBeInTheDocument();
    const panel = container.querySelector('.scenario-auth-panel')!;
    fireEvent.click(panel);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('uses custom panelClassName', () => {
    const { container } = setup({ panelClassName: 'custom-panel' });
    expect(container.querySelector('.custom-panel')).toBeInTheDocument();
  });

  it('changes auth type via the type selector', () => {
    const { onChange } = setup({ auth: { type: 'none' }, useCustomTypeDropdown: true });
    const trigger = document.querySelector('.auth-type-select .auth-type-trigger')!;
    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId('auth-type-opt-basic'));
    expect(onChange).toHaveBeenCalledWith({ type: 'basic' });
  });

  it('renders basic auth fields and emits username/password changes', () => {
    const { onChange } = setup({ auth: { type: 'basic', username: 'joe', password: 'pw' } });
    const username = screen.getByDisplayValue('joe');
    fireEvent.change(username, { target: { value: 'jane' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'basic', username: 'jane', password: 'pw' });
    const password = screen.getByDisplayValue('pw');
    fireEvent.change(password, { target: { value: 'pw2' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'basic', username: 'joe', password: 'pw2' });
  });

  it('renders bearer auth fields with prefix default and emits changes', () => {
    const { onChange } = setup({ auth: { type: 'bearer', token: 't' } });
    const prefixInput = screen.getByPlaceholderText('Bearer');
    expect(prefixInput).toHaveValue('Bearer');
    fireEvent.change(screen.getByDisplayValue('t'), { target: { value: 'tok2' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'bearer', token: 'tok2' });
    fireEvent.change(prefixInput, { target: { value: 'JWT' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'bearer', token: 't', prefix: 'JWT' });
  });

  it('renders apikey fields and toggles header/query radios', () => {
    const { onChange } = setup({ auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'v', apiKeyIn: 'header' } });
    fireEvent.change(screen.getByDisplayValue('X-Key'), { target: { value: 'X-Other' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyName: 'X-Other' }));
    fireEvent.change(screen.getByDisplayValue('v'), { target: { value: 'v2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyValue: 'v2' }));
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]); // Query Parameter
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyIn: 'query' }));
    fireEvent.click(radios[0]); // Header
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyIn: 'header' }));
  });

  it('renders digest auth fields', () => {
    const { onChange } = setup({ auth: { type: 'digest', username: 'd', password: 'p' } });
    fireEvent.change(screen.getByDisplayValue('d'), { target: { value: 'd2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ username: 'd2' }));
    fireEvent.change(screen.getByDisplayValue('p'), { target: { value: 'p2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ password: 'p2' }));
  });

  it('renders oauth2 fields and toggles secret visibility', () => {
    const setShowSecret = vi.fn();
    const onChange = vi.fn();
    render(
      <AuthConfigPanel
        auth={{ type: 'oauth2', tokenUrl: 'http://t', clientId: 'cid', clientSecret: 'sec' }}
        onChange={onChange}
        title="A"
        hint="h"
        authVerifying={false}
        authVerifyResult={null}
        setAuthVerifyResult={vi.fn()}
        verifyAuth={vi.fn()}
        showSecret={false}
        setShowSecret={setShowSecret}
        authTypeOptions={AUTH_TYPE_OPTIONS}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('http://t'), { target: { value: 'http://t2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tokenUrl: 'http://t2' }));
    fireEvent.change(screen.getByDisplayValue('cid'), { target: { value: 'cid2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'cid2' }));
    fireEvent.change(screen.getByDisplayValue('sec'), { target: { value: 'sec2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: 'sec2' }));
    fireEvent.click(screen.getByTitle('Show'));
    expect(setShowSecret).toHaveBeenCalled();
  });

  it('shows secret as text and Hide title when showSecret is true', () => {
    setup({ auth: { type: 'oauth2', clientSecret: 'sec' }, showSecret: true });
    expect(screen.getByTitle('Hide')).toBeInTheDocument();
  });

  it('shows verify button and invokes verifyAuth for concrete auth', () => {
    const { verifyAuth, setAuthVerifyResult } = setup({ auth: { type: 'bearer', token: 't' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Auth' }));
    expect(setAuthVerifyResult).toHaveBeenCalledWith(null);
    expect(verifyAuth).toHaveBeenCalledWith({ type: 'bearer', token: 't' });
  });

  it('disables verify button while verifying', () => {
    setup({ auth: { type: 'bearer', token: 't' }, authVerifying: true });
    expect(screen.getByRole('button', { name: 'Verifying...' })).toBeDisabled();
  });

  it('shows OK verify result with detail', () => {
    const result: AuthVerifyResult = { ok: true, message: 'Worked', detail: 'meta' };
    setup({ auth: { type: 'bearer', token: 't' }, authVerifyResult: result });
    expect(screen.getByText('Worked')).toBeInTheDocument();
    expect(screen.getByText('meta')).toBeInTheDocument();
  });

  it('shows failed verify result without detail', () => {
    const result: AuthVerifyResult = { ok: false, message: 'Bad' };
    const { container } = setup({ auth: { type: 'bearer', token: 't' }, authVerifyResult: result });
    expect(screen.getByText('Bad')).toBeInTheDocument();
    expect(container.querySelector('.auth-verify-fail')).toBeInTheDocument();
  });

  it('renders profile selector when showProfileSelector and inherit with profiles', () => {
    const onProfileChange = vi.fn();
    setup({
      auth: { type: 'inherit' },
      useCustomTypeDropdown: true,
      showProfileSelector: true,
      allAuthProfiles: PROFILES,
      globalAuthProfileId: 'p1',
      onProfileChange,
    });
    expect(screen.getByText(/Using/)).toBeInTheDocument();
    const profileTrigger = document.querySelector('.global-profile-selector .auth-profile-trigger')!;
    fireEvent.click(profileTrigger);
    fireEvent.click(screen.getByText('Staging Basic'));
    expect(onProfileChange).toHaveBeenCalledWith('p2');
  });

  it('warns when selected profile no longer exists', () => {
    setup({
      auth: { type: 'inherit' },
      showProfileSelector: true,
      allAuthProfiles: PROFILES,
      globalAuthProfileId: 'missing',
    });
    expect(screen.getByText(/no longer exists/)).toBeInTheDocument();
  });

  it('verifies resolved profile auth in profile-selector mode', () => {
    const verifyAuth = vi.fn();
    setup({
      auth: { type: 'inherit' },
      showProfileSelector: true,
      allAuthProfiles: PROFILES,
      globalAuthProfileId: 'p1',
      verifyAuth,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Auth' }));
    expect(verifyAuth).toHaveBeenCalledWith(PROFILES[0].auth);
  });

  it('shows inherit hint text when provided', () => {
    setup({ auth: { type: 'inherit' }, inheritHint: 'Inheriting from collection' });
    expect(screen.getByText('Inheriting from collection')).toBeInTheDocument();
  });

  it('renders inherited-auth verify section when not using profile selector', () => {
    const verifyAuth = vi.fn();
    const inheritedAuth: AuthConfig = { type: 'bearer', token: 'inh' };
    setup({
      auth: { type: 'inherit' },
      inheritedAuth,
      inheritedLabel: 'collection',
      verifyAuth,
    });
    const btn = screen.getByRole('button', { name: /Verify Inherited Auth/ });
    fireEvent.click(btn);
    expect(verifyAuth).toHaveBeenCalledWith(inheritedAuth);
  });

  it('shows verify result in inherited-auth section', () => {
    const inheritedAuth: AuthConfig = { type: 'bearer', token: 'inh' };
    setup({
      auth: { type: 'inherit' },
      inheritedAuth,
      authVerifyResult: { ok: true, message: 'Inherited OK', detail: 'd' },
    });
    expect(screen.getByText('Inherited OK')).toBeInTheDocument();
  });

  it('does not render verify section for none auth', () => {
    setup({ auth: { type: 'none' } });
    expect(screen.queryByRole('button', { name: /Verify/ })).toBeNull();
  });

  it('defaults apikey to header placement when apiKeyIn is undefined', () => {
    const { onChange } = setup({ auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'v', apiKeyIn: 'query' } });
    const headerRadio = screen.getByLabelText('Header');
    expect(screen.getByLabelText('Query Parameter')).toBeChecked();
    fireEvent.click(headerRadio);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ apiKeyIn: 'header' }));
  });

  it('checks header radio when apiKeyIn is undefined', () => {
    setup({ auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'v' } });
    expect(screen.getByLabelText('Header')).toBeChecked();
  });

  it('uses default feature label for inherited verify when inheritedLabel is omitted', () => {
    setup({
      auth: { type: 'inherit' },
      inheritedAuth: { type: 'bearer', token: 'inh' },
    });
    expect(screen.getByRole('button', { name: 'Verify Inherited Auth (feature)' })).toBeInTheDocument();
  });

  it('shows Verifying... on inherited verify button while authVerifying', () => {
    setup({
      auth: { type: 'inherit' },
      inheritedAuth: { type: 'bearer', token: 'inh' },
      inheritedLabel: 'parent',
      authVerifying: true,
    });
    expect(screen.getByRole('button', { name: 'Verifying...' })).toBeDisabled();
  });

  it('shows failed inherited verify result', () => {
    setup({
      auth: { type: 'inherit' },
      inheritedAuth: { type: 'bearer', token: 'inh' },
      authVerifyResult: { ok: false, message: 'Inherited failed' },
    });
    expect(screen.getByText('Inherited failed')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
  });

  it('disables verify when profile selector has missing profile id', () => {
    setup({
      auth: { type: 'inherit' },
      showProfileSelector: true,
      allAuthProfiles: PROFILES,
      globalAuthProfileId: 'missing',
    });
    expect(screen.getByRole('button', { name: 'Verify Auth' })).toBeDisabled();
  });

  it('does not render inherit hint when inheritHint is null', () => {
    setup({ auth: { type: 'inherit' }, inheritHint: null });
    expect(screen.queryByText('Inheriting from collection')).toBeNull();
  });

  it('hides inherited verify section when inherited auth is inherit type', () => {
    setup({
      auth: { type: 'inherit' },
      inheritedAuth: { type: 'inherit' },
    });
    expect(screen.queryByRole('button', { name: /Verify Inherited Auth/ })).toBeNull();
  });

  it('toggles oauth2 secret visibility off when showSecret is true', () => {
    const setShowSecret = vi.fn();
    setup({ auth: { type: 'oauth2', clientSecret: 'sec' }, showSecret: true, setShowSecret });
    fireEvent.click(screen.getByTitle('Hide'));
    expect(setShowSecret).toHaveBeenCalled();
  });

  it('renders pre-filled values for basic auth fields', () => {
    setup({ auth: { type: 'basic', username: 'usr', password: 'pw' } });
    expect(screen.getByDisplayValue('usr')).toBeInTheDocument();
    expect(screen.getByDisplayValue('pw')).toBeInTheDocument();
  });

  it('renders pre-filled values for bearer auth fields', () => {
    setup({ auth: { type: 'bearer', token: 'tok123', prefix: 'Token' } });
    expect(screen.getByDisplayValue('tok123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Token')).toBeInTheDocument();
  });

  it('renders pre-filled values for apikey auth fields', () => {
    setup({ auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'val1', apiKeyIn: 'query' } });
    expect(screen.getByDisplayValue('X-Key')).toBeInTheDocument();
    expect(screen.getByDisplayValue('val1')).toBeInTheDocument();
  });

  it('renders pre-filled values for digest auth fields', () => {
    setup({ auth: { type: 'digest', username: 'dUser', password: 'dPass' } });
    expect(screen.getByDisplayValue('dUser')).toBeInTheDocument();
    expect(screen.getByDisplayValue('dPass')).toBeInTheDocument();
  });

  it('renders pre-filled oauth2 fields', () => {
    setup({ auth: { type: 'oauth2', tokenUrl: 'https://auth.io/token', clientId: 'cid', clientSecret: 'csecret' } });
    expect(screen.getByDisplayValue('https://auth.io/token')).toBeInTheDocument();
    expect(screen.getByDisplayValue('cid')).toBeInTheDocument();
    expect(screen.getByDisplayValue('csecret')).toBeInTheDocument();
  });

  it('renders profile selector with selected profile showing hint', () => {
    const onProfileChange = vi.fn();
    setup({
      auth: { type: 'inherit' },
      showProfileSelector: true,
      globalAuthProfileId: 'p1',
      onProfileChange,
      allAuthProfiles: PROFILES,
    });
    expect(screen.getByText(/Using/)).toBeInTheDocument();
    expect(screen.getByText(/BEARER/)).toBeInTheDocument();
  });
});
