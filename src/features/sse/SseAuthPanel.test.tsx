/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AuthConfig, GlobalAuthProfile } from '../../shared/types';

// Mock the heavy shared panel — we only need to observe that it renders and to
// trigger its profile-change callback.
vi.mock('../requests/components/AuthConfigPanel', () => ({
  default: (props: { onProfileChange?: (id: string | undefined) => void }) => (
    <div data-testid="auth-config-panel">
      <button data-testid="trigger-profile-change" onClick={() => props.onProfileChange?.('gp-1')}>
        change profile
      </button>
      <button data-testid="trigger-profile-clear" onClick={() => props.onProfileChange?.(undefined)}>
        clear profile
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

import SseAuthPanel from './SseAuthPanel';

const profiles: GlobalAuthProfile[] = [
  { id: 'gp-1', name: 'Prod Bearer', auth: { type: 'bearer', token: 'PROFILE_TOKEN' } },
];

beforeEach(() => {
  resetAllMocks();
});

describe('SseAuthPanel', () => {
  it('renders the wrapped AuthConfigPanel inside the SSE auth pane', () => {
    const { container } = render(<SseAuthPanel auth={{ type: 'none' }} onChange={vi.fn()} />);
    expect(screen.getByTestId('auth-config-panel')).toBeTruthy();
    expect(container.querySelector('.sse-auth-pane')).toBeTruthy();
  });

  it('shows no resolved preview when auth is none', () => {
    render(<SseAuthPanel auth={{ type: 'none' }} onChange={vi.fn()} />);
    expect(screen.queryByTestId('sse-auth-resolved')).toBeNull();
  });

  it('shows the masked resolved preview for a header-based bearer auth', () => {
    const auth: AuthConfig = { type: 'bearer', token: 'abcdefghijklmnop' };
    render(<SseAuthPanel auth={auth} onChange={vi.fn()} />);
    const resolved = screen.getByTestId('sse-auth-resolved');
    expect(resolved.textContent).toContain('Will send');
    expect(resolved.textContent).toContain('Authorization: Bearer');
  });

  it('shows the resolved preview for query-based api-key auth', () => {
    const auth: AuthConfig = {
      type: 'apikey',
      apiKeyName: 'X-Key',
      apiKeyValue: 'longsecretvalue',
      apiKeyIn: 'query',
    };
    render(<SseAuthPanel auth={auth} onChange={vi.fn()} />);
    expect(screen.getByTestId('sse-auth-resolved').textContent).toContain('X-Key (query)');
  });

  it('shows an inherit-without-profile preview', () => {
    render(<SseAuthPanel auth={{ type: 'inherit' }} onChange={vi.fn()} />);
    expect(screen.getByTestId('sse-auth-resolved').textContent).toContain('Inherit — no profile selected');
  });

  it('binds a global profile via onChange when the panel requests a profile change', () => {
    const onChange = vi.fn();
    render(<SseAuthPanel auth={{ type: 'inherit' }} onChange={onChange} globalAuthProfiles={profiles} />);
    fireEvent.click(screen.getByTestId('trigger-profile-change'));
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: 'gp-1' });
  });

  it('clears the bound profile via onChange when the panel clears the profile', () => {
    const onChange = vi.fn();
    render(
      <SseAuthPanel
        auth={{ type: 'inherit', globalProfileId: 'gp-1' }}
        onChange={onChange}
        globalAuthProfiles={profiles}
      />,
    );
    fireEvent.click(screen.getByTestId('trigger-profile-clear'));
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', globalProfileId: undefined });
  });

  it('resolves an inherited profile preview when a profile is bound', () => {
    render(
      <SseAuthPanel
        auth={{ type: 'inherit', globalProfileId: 'gp-1' }}
        onChange={vi.fn()}
        globalAuthProfiles={profiles}
      />,
    );
    expect(screen.getByTestId('sse-auth-resolved').textContent).toContain('Authorization: Bearer');
  });

  it('renders without globalAuthProfiles (defaults to empty list)', () => {
    render(<SseAuthPanel auth={{ type: 'none' }} onChange={vi.fn()} />);
    expect(screen.getByTestId('auth-config-panel')).toBeTruthy();
  });
});
