/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TestEditorAuthTab from './TestEditorAuthTab';
import type { TestEditorAuthTabProps } from './TestEditorAuthTab';
import type { AuthConfig, FeatureGroup, GlobalAuthProfile, Scenario } from '@shared/types';
import { makeScenario as _makeScenario } from '@test-utils/factories';

const makeScenario = (auth: AuthConfig): Scenario =>
  _makeScenario({
    id: 't1',
    name: 'T',
    url: 'http://x',
    auth,
    validation: { mode: 'status' } as Scenario['validation'],
  });

function makeProps(overrides: Partial<TestEditorAuthTabProps> = {}): TestEditorAuthTabProps {
  return {
    draft: makeScenario({ type: 'none' }),
    onDraftChange: vi.fn(),
    featureGroups: [],
    editingTest: { fgId: 'fg1', scenarioId: 'sc1', testId: 'new' },
    allAuthProfiles: [],
    verifyAuth: vi.fn(),
    resolveEffectiveAuth: vi.fn(() => ({ auth: { type: 'none' }, source: 'none' })),
    authVerifying: false,
    authVerifyResult: null,
    setAuthVerifyResult: vi.fn(),
    showSecret: false,
    setShowSecret: vi.fn(),
    ...overrides,
  };
}

function makeFg(over: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg1',
    name: 'FG',
    scenarios: [{ id: 'sc1', name: 'SC', kind: 'standard', tests: [] }],
    ...over,
  };
}

describe('TestEditorAuthTab', () => {
  it('changes auth type via the select', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorAuthTab {...makeProps({ onDraftChange })} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByText('Basic Auth'));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'basic' } }));
  });

  it('renders no verify section for none type', () => {
    render(<TestEditorAuthTab {...makeProps()} />);
    expect(screen.queryByText('Verify Auth')).not.toBeInTheDocument();
  });

  describe('basic auth', () => {
    it('renders and edits username/password', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'basic' }), onDraftChange })} />);
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'u' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'basic', username: 'u' } }));
      const pwd = document.querySelector('input[type="password"]')!;
      fireEvent.change(pwd, { target: { value: 'p' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'basic', password: 'p' } }));
      expect(screen.getByText('Verify Auth')).toBeInTheDocument();
    });
  });

  describe('bearer auth', () => {
    it('renders token and prefix default', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'bearer' }), onDraftChange })} />);
      expect(screen.getByPlaceholderText('eyJhbGciOi...')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('eyJhbGciOi...'), { target: { value: 'abc' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'bearer', token: 'abc' } }));
      fireEvent.change(screen.getByPlaceholderText('Bearer'), { target: { value: 'Token' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'bearer', prefix: 'Token' } }));
    });
  });

  describe('apikey auth', () => {
    it('renders fields and toggles location radios', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'apikey' }), onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('X-API-Key'), { target: { value: 'K' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'apikey', apiKeyName: 'K' } }));
      fireEvent.change(screen.getByPlaceholderText('your-api-key'), { target: { value: 'V' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'apikey', apiKeyValue: 'V' } }));
      const radios = screen.getAllByRole('radio');
      fireEvent.click(radios[1]);
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'apikey', apiKeyIn: 'query' } }));
    });

    it('switches back to header location', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'apikey', apiKeyIn: 'query' }), onDraftChange })} />);
      const radios = screen.getAllByRole('radio');
      fireEvent.click(radios[0]);
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'apikey', apiKeyIn: 'header' } }));
    });

    it('marks query radio checked when apiKeyIn is query', () => {
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'apikey', apiKeyIn: 'query' }) })} />);
      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios[1].checked).toBe(true);
    });
  });

  describe('digest auth', () => {
    it('renders username/password', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'digest' }), onDraftChange })} />);
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'du' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'digest', username: 'du' } }));
      const pwd = document.querySelector('input[type="password"]')!;
      fireEvent.change(pwd, { target: { value: 'dp' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'digest', password: 'dp' } }));
    });
  });

  describe('oauth2 auth', () => {
    it('renders fields and toggles secret visibility', () => {
      const onDraftChange = vi.fn();
      const setShowSecret = vi.fn();
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'oauth2' }), onDraftChange, setShowSecret, showSecret: false })} />);
      fireEvent.change(screen.getByPlaceholderText('https://auth.example.com/oauth/token'), { target: { value: 'u' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'oauth2', tokenUrl: 'u' } }));
      const textboxes = screen.getAllByRole('textbox');
      fireEvent.change(textboxes[1], { target: { value: 'cid' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'oauth2', clientId: 'cid' } }));
      const secret = document.querySelector('input[type="password"]')!;
      fireEvent.change(secret, { target: { value: 'sec' } });
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'oauth2', clientSecret: 'sec' } }));
      fireEvent.click(screen.getByTitle('Show'));
      expect(setShowSecret).toHaveBeenCalled();
    });

    it('shows secret as text when showSecret is true', () => {
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'oauth2' }), showSecret: true })} />);
      expect(screen.getByTitle('Hide')).toBeInTheDocument();
    });
  });

  describe('verify section', () => {
    it('clears result and verifies on click', () => {
      const verifyAuth = vi.fn();
      const setAuthVerifyResult = vi.fn();
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'bearer', token: 't' }), verifyAuth, setAuthVerifyResult })} />);
      fireEvent.click(screen.getByText('Verify Auth'));
      expect(setAuthVerifyResult).toHaveBeenCalledWith(null);
      expect(verifyAuth).toHaveBeenCalledWith({ type: 'bearer', token: 't' });
    });

    it('shows verifying state', () => {
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'bearer' }), authVerifying: true })} />);
      expect(screen.getByText('Verifying...')).toBeInTheDocument();
      expect(screen.getByText('Verifying...').closest('button')).toBeDisabled();
    });

    it('shows ok result with detail', () => {
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'bearer' }), authVerifyResult: { ok: true, message: 'Good', detail: 'd' } })} />);
      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getByText('d')).toBeInTheDocument();
    });

    it('shows fail result without detail', () => {
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'bearer' }), authVerifyResult: { ok: false, message: 'Bad' } })} />);
      expect(screen.getByText('✗')).toBeInTheDocument();
      expect(screen.getByText('Bad')).toBeInTheDocument();
    });
  });

  describe('inherit hint', () => {
    it('uses scenario-level auth', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc1', name: 'SC', kind: 'standard', tests: [], auth: { type: 'basic' } }] });
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'inherit' }), featureGroups: [fg] })} />);
      expect(screen.getByText(/Will use scenario-level Basic Auth/)).toBeInTheDocument();
    });

    it('uses feature-level auth and notes scenario inheritance', () => {
      const fg = makeFg({ auth: { type: 'bearer' }, scenarios: [{ id: 'sc1', name: 'SC', kind: 'standard', tests: [], auth: { type: 'inherit' } }] });
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'inherit' }), featureGroups: [fg] })} />);
      expect(screen.getByText(/Will use feature-level Bearer Token \(scenario inherits from feature\)/)).toBeInTheDocument();
    });

    it('uses global profile when feature inherits', () => {
      const fg = makeFg({ auth: { type: 'inherit' }, globalAuthProfileId: 'p1', scenarios: [{ id: 'sc1', name: 'SC', kind: 'standard', tests: [], auth: { type: 'inherit' } }] });
      const profiles: GlobalAuthProfile[] = [{ id: 'p1', name: 'Prod', auth: { type: 'apikey' } }];
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'inherit' }), featureGroups: [fg], allAuthProfiles: profiles })} />);
      expect(screen.getByText(/Will use global profile "Prod" \(API Key\).*via scenario → feature → global/)).toBeInTheDocument();
    });

    it('flags missing global profile', () => {
      const fg = makeFg({ auth: { type: 'inherit' }, globalAuthProfileId: 'missing' });
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'inherit' }), featureGroups: [fg] })} />);
      expect(screen.getByText(/Feature references a missing global profile/)).toBeInTheDocument();
    });

    it('shows no auth configured fallback', () => {
      const fg = makeFg();
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'inherit' }), featureGroups: [fg] })} />);
      expect(screen.getByText(/No auth configured at scenario or feature level/)).toBeInTheDocument();
    });
  });

  describe('inherit verify section', () => {
    it('renders nothing extra when resolved auth is none', () => {
      render(<TestEditorAuthTab {...makeProps({ draft: makeScenario({ type: 'inherit' }), resolveEffectiveAuth: () => ({ auth: { type: 'none' }, source: 'none' }) })} />);
      expect(screen.queryByText(/Verify Inherited Auth/)).not.toBeInTheDocument();
    });

    it('verifies resolved inherited auth', () => {
      const verifyAuth = vi.fn();
      const setAuthVerifyResult = vi.fn();
      render(
        <TestEditorAuthTab
          {...makeProps({
            draft: makeScenario({ type: 'inherit' }),
            resolveEffectiveAuth: () => ({ auth: { type: 'bearer', token: 'r' }, source: 'scenario' }),
            verifyAuth,
            setAuthVerifyResult,
          })}
        />,
      );
      const btn = screen.getByText('Verify Inherited Auth (scenario)');
      fireEvent.click(btn);
      expect(setAuthVerifyResult).toHaveBeenCalledWith(null);
      expect(verifyAuth).toHaveBeenCalledWith({ type: 'bearer', token: 'r' });
    });

    it('shows verifying + result in inherited section', () => {
      render(
        <TestEditorAuthTab
          {...makeProps({
            draft: makeScenario({ type: 'inherit' }),
            resolveEffectiveAuth: () => ({ auth: { type: 'bearer' }, source: 'feature' }),
            authVerifying: true,
            authVerifyResult: { ok: true, message: 'OK', detail: 'x' },
          })}
        />,
      );
      expect(screen.getByText('Verifying...')).toBeInTheDocument();
      expect(screen.getByText('OK')).toBeInTheDocument();
      expect(screen.getByText('x')).toBeInTheDocument();
    });
  });
});
