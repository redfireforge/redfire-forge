/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AuthConfig, GlobalAuthProfile } from '../../shared/types';

// Mock the heavy shared panel — we only need to observe the props it receives
// and trigger its profile-change callback.
vi.mock('../requests/components/AuthConfigPanel', () => ({
  default: (props: { onProfileChange?: (id: string | undefined) => void }) => (
    <div data-testid="auth-config-panel">
      <button data-testid="trigger-profile-change" onClick={() => props.onProfileChange?.('gp-1')}>
        change profile
      </button>
    </div>
  ),
}));

vi.mock('../requests/hooks/useAuthVerify', () => ({
  useAuthVerify: () => ({
    authVerifying: false,
    authVerifyResult: null,
    setAuthVerifyResult: vi.fn(),
    verifyAuth: vi.fn(),
  }),
}));

const mockIsTauri = vi.fn(() => false);
vi.mock('../../shared/utils/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

import WebSocketAuthPanel from './WebSocketAuthPanel';

const profiles: GlobalAuthProfile[] = [
  { id: 'gp-1', name: 'Prod Bearer', auth: { type: 'bearer', token: 'PROFILE_TOKEN' } },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockIsTauri.mockReturnValue(false);
});

describe('WebSocketAuthPanel', () => {
  it('renders the wrapped AuthConfigPanel', () => {
    render(<WebSocketAuthPanel auth={{ type: 'none' }} onChange={vi.fn()} />);
    expect(screen.getByTestId('auth-config-panel')).toBeTruthy();
  });

  it('shows no resolved preview or callout when auth is none', () => {
    render(<WebSocketAuthPanel auth={{ type: 'none' }} onChange={vi.fn()} />);
    expect(screen.queryByTestId('ws-auth-resolved')).toBeNull();
    expect(screen.queryByTestId('ws-auth-callout')).toBeNull();
  });

  it('shows the masked resolved preview for a header-based bearer auth', () => {
    const auth: AuthConfig = { type: 'bearer', token: 'abcdefghijklmnop' };
    render(<WebSocketAuthPanel auth={auth} onChange={vi.fn()} />);
    const resolved = screen.getByTestId('ws-auth-resolved');
    expect(resolved.textContent).toContain('Will send');
    expect(resolved.textContent).toContain('Authorization: Bearer');
  });

  it('shows the browser callout for header auth in browser mode', () => {
    mockIsTauri.mockReturnValue(false);
    render(<WebSocketAuthPanel auth={{ type: 'bearer', token: 'abcdefghijklmnop' }} onChange={vi.fn()} />);
    expect(screen.getByTestId('ws-auth-callout')).toBeTruthy();
  });

  it('hides the browser callout in desktop (Tauri) mode', () => {
    mockIsTauri.mockReturnValue(true);
    render(<WebSocketAuthPanel auth={{ type: 'bearer', token: 'abcdefghijklmnop' }} onChange={vi.fn()} />);
    expect(screen.queryByTestId('ws-auth-callout')).toBeNull();
  });

  it('hides the browser callout for query-based api-key auth (no proxy needed)', () => {
    mockIsTauri.mockReturnValue(false);
    const auth: AuthConfig = { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'longsecretvalue', apiKeyIn: 'query' };
    render(<WebSocketAuthPanel auth={auth} onChange={vi.fn()} />);
    expect(screen.queryByTestId('ws-auth-callout')).toBeNull();
    // query auth still has a resolved preview
    expect(screen.getByTestId('ws-auth-resolved').textContent).toContain('X-Key (query)');
  });

  it('binds a global profile via onChange when the panel requests a profile change', () => {
    const onChange = vi.fn();
    render(<WebSocketAuthPanel auth={{ type: 'inherit' }} onChange={onChange} globalAuthProfiles={profiles} />);
    fireEvent.click(screen.getByTestId('trigger-profile-change'));
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: 'gp-1' });
  });
});
