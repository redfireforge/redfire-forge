/**
 * GraphqlProfileModal.test.tsx
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GraphqlProfileModal } from './GraphqlProfileModal';
import type { ConnectionProfile } from '../hooks/useGraphqlConnectionProfiles';

function makeProfile(overrides: Partial<ConnectionProfile> = {}): ConnectionProfile {
  return {
    id: 'p1',
    name: 'My Profile',
    endpoint: 'https://api.example.com/graphql',
    auth: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

const defaultProps = {
  profiles: [],
  currentEndpoint: 'https://api.example.com/graphql',
  currentAuth: null,
  onClose: vi.fn(),
  onSave: vi.fn(),
  onLoad: vi.fn(),
  onDelete: vi.fn(),
};

describe('GraphqlProfileModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Rendering ────────────────────────────────────────────────────────────

  it('renders the modal with title', () => {
    render(<GraphqlProfileModal {...defaultProps} />);
    expect(screen.getByText('Connection Profiles')).toBeInTheDocument();
  });

  it('renders footer Close button (no header ×)', () => {
    render(<GraphqlProfileModal {...defaultProps} />);
    expect(screen.getByTestId('gql-profile-close-btn')).toHaveTextContent('Close');
    expect(screen.getByTestId('gql-profile-close-btn')).toHaveClass('gql-btn--secondary');
    expect(screen.queryByRole('button', { name: /^×$/i })).not.toBeInTheDocument();
  });

  it('shows profile count in saved section', () => {
    render(<GraphqlProfileModal {...defaultProps} profiles={[makeProfile(), makeProfile({ id: 'p2' })]} />);
    expect(screen.getByText('2 saved profiles')).toBeInTheDocument();
  });

  it('shows empty state when no profiles', () => {
    render(<GraphqlProfileModal {...defaultProps} profiles={[]} />);
    expect(screen.getByText('No saved profiles yet')).toBeInTheDocument();
  });

  it('shows profile list when profiles exist', () => {
    const profiles = [makeProfile()];
    render(<GraphqlProfileModal {...defaultProps} profiles={profiles} />);
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load profile: my profile/i })).toBeInTheDocument();
  });

  it('shows Loaded badge for the profile linked to the active tab', () => {
    const profiles = [
      makeProfile({ id: 'p1', name: 'GQL Auth Demo' }),
      makeProfile({ id: 'p2', name: 'Test' }),
    ];
    render(
      <GraphqlProfileModal
        {...defaultProps}
        profiles={profiles}
        activeConnectionId="p2"
      />,
    );
    expect(screen.getByTestId('gql-profile-loaded-badge')).toBeInTheDocument();
    expect(screen.getByText('Test loaded on active tab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load profile: gql auth demo/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load profile: test/i })).not.toBeInTheDocument();
  });

  it('marks the loaded profile row with aria-current', () => {
    const profiles = [makeProfile({ id: 'p1', name: 'Test' })];
    render(
      <GraphqlProfileModal
        {...defaultProps}
        profiles={profiles}
        activeConnectionId="p1"
      />,
    );
    expect(screen.getByTestId('gql-profile-row-p1')).toHaveAttribute('aria-current', 'true');
  });

  it('shows Used by tab pills for profiles linked to workspace tabs', () => {
    const profiles = [
      makeProfile({ id: 'p1', name: 'Staging' }),
      makeProfile({ id: 'p2', name: 'Production' }),
    ];
    render(
      <GraphqlProfileModal
        {...defaultProps}
        profiles={profiles}
        activeTabId="tab-2"
        activeConnectionId="p2"
        studioTabs={[
          { id: 'tab-1', label: 'Staging', connectionId: 'p1' },
          { id: 'tab-2', label: 'Production', connectionId: 'p2' },
        ]}
      />,
    );
    expect(screen.getByTestId('gql-profile-tab-usage-p1')).toHaveTextContent('Used by');
    expect(screen.getByTestId('gql-profile-tab-pill-p1-tab-1')).toHaveTextContent('Staging');
    expect(screen.getByTestId('gql-profile-tab-pill-p2-tab-2')).toHaveTextContent('Production');
    expect(screen.getByTestId('gql-profile-tab-pill-p2-tab-2')).toHaveClass('gql-profile-row__tab-pill--active');
  });

  it('shows Not linked to any tab when profile has no tab links', () => {
    const profiles = [makeProfile({ id: 'p1', name: 'Orphan' })];
    render(
      <GraphqlProfileModal
        {...defaultProps}
        profiles={profiles}
        studioTabs={[{ id: 'tab-1', label: 'Query 1', connectionId: undefined }]}
      />,
    );
    expect(screen.getByTestId('gql-profile-tab-usage-p1')).toHaveTextContent('Not linked to any tab');
  });

  it('marks profile row in-use when linked on another tab', () => {
    const profiles = [makeProfile({ id: 'p1', name: 'Shared' })];
    render(
      <GraphqlProfileModal
        {...defaultProps}
        profiles={profiles}
        activeTabId="tab-2"
        activeConnectionId="p2"
        studioTabs={[
          { id: 'tab-1', label: 'Tab A', connectionId: 'p1' },
          { id: 'tab-2', label: 'Tab B', connectionId: 'p2' },
        ]}
      />,
    );
    expect(screen.getByTestId('gql-profile-row-p1')).toHaveClass('gql-profile-row--in-use');
  });

  // ─── Endpoint truncation ──────────────────────────────────────────────────

  it('truncates long endpoint URLs in profile list', () => {
    const longEndpoint = 'https://very-long-api.example.com/graphql/endpoint/path/that/is/long';
    const profiles = [makeProfile({ endpoint: longEndpoint })];
    render(<GraphqlProfileModal {...defaultProps} profiles={profiles} />);
    // Truncated endpoint should appear (with ellipsis)
    expect(screen.getByTitle(longEndpoint)).toBeInTheDocument();
  });

  it('does not truncate short endpoint URLs', () => {
    const shortEndpoint = 'https://api.com/gql';
    const profiles = [makeProfile({ endpoint: shortEndpoint })]
    render(<GraphqlProfileModal {...defaultProps} profiles={profiles} />);
    expect(screen.getByText(shortEndpoint)).toBeInTheDocument();
  });

  // ─── Auth badge ───────────────────────────────────────────────────────────

  it('shows No Auth badge when auth is null', () => {
    const profiles = [makeProfile({ auth: null })];
    render(<GraphqlProfileModal {...defaultProps} profiles={profiles} />);
    expect(screen.getAllByText('No Auth').length).toBeGreaterThan(0);
  });

  it('shows Bearer auth badge when auth is bearer type', () => {
    const profiles = [makeProfile({ auth: { type: 'bearer', token: 'tok' } })];
    render(<GraphqlProfileModal {...defaultProps} profiles={profiles} />);
    expect(screen.getByText('Bearer')).toBeInTheDocument();
  });

  // ─── Close behavior ───────────────────────────────────────────────────────

  it('calls onClose when Close footer button clicked', () => {
    render(<GraphqlProfileModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('gql-profile-close-btn'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay background', () => {
    render(<GraphqlProfileModal {...defaultProps} />);
    const overlay = screen.getByTestId('gql-profile-modal-overlay');
    fireEvent.click(overlay);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when clicking inside the modal panel', () => {
    render(<GraphqlProfileModal {...defaultProps} />);
    const modal = screen.getByTestId('gql-profile-modal');
    fireEvent.click(modal);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<GraphqlProfileModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  // ─── Save behavior ────────────────────────────────────────────────────────

  it('renders name input with save button', () => {
    render(<GraphqlProfileModal {...defaultProps} />);
    expect(screen.getByTestId('gql-profile-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('gql-profile-save-btn')).toBeInTheDocument();
  });

  it('shows inherit global auth profile name in save preview and saved rows', () => {
    const profiles = [
      makeProfile({
        auth: { type: 'inherit', globalProfileId: 'p1' },
        name: 'GQL Auth Demo',
      }),
    ];
    const globalAuthProfiles = [{ id: 'p1', name: 'Lesson 6 Bearer', auth: { type: 'bearer', token: 'tok' } }];
    render(
      <GraphqlProfileModal
        {...defaultProps}
        profiles={profiles}
        currentAuth={{ type: 'inherit', globalProfileId: 'p1' }}
        globalAuthProfiles={globalAuthProfiles}
      />,
    );
    expect(screen.getAllByText('Inherit (Lesson 6 Bearer)').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('gql-profile-inherit-note')).toBeInTheDocument();
    expect(screen.getByText('Lesson 6 Bearer')).toBeInTheDocument();
  });

  it('shows plain Inherit when global auth catalog is unavailable', () => {
    render(
      <GraphqlProfileModal
        {...defaultProps}
        currentAuth={{ type: 'inherit', globalProfileId: 'p1' }}
      />,
    );
    expect(screen.getByText('Inherit')).toBeInTheDocument();
  });

  it('save button is disabled when name is empty', () => {
    render(<GraphqlProfileModal {...defaultProps} />);
    expect(screen.getByTestId('gql-profile-save-btn')).toBeDisabled();
  });

  it('save button is enabled when name is filled and endpoint exists', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="https://api.com/graphql" />);
    fireEvent.change(screen.getByTestId('gql-profile-name-input'), { target: { value: 'Test' } });
    expect(screen.getByTestId('gql-profile-save-btn')).not.toBeDisabled();
  });

  it('calls onSave when save button clicked with valid name', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="https://api.com/graphql" />);
    fireEvent.change(screen.getByTestId('gql-profile-name-input'), { target: { value: 'New Profile' } });
    fireEvent.click(screen.getByTestId('gql-profile-save-btn'));
    expect(defaultProps.onSave).toHaveBeenCalledWith('New Profile');
  });

  it('shows ✓ Saved flash after saving', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="https://api.com/graphql" />);
    fireEvent.change(screen.getByTestId('gql-profile-name-input'), { target: { value: 'Profile X' } });
    fireEvent.click(screen.getByTestId('gql-profile-save-btn'));
    expect(screen.getByTestId('gql-profile-save-btn')).toHaveTextContent('✓ Saved');
  });

  it('✓ Saved flash disappears after 2 seconds', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="https://api.com/graphql" />);
    fireEvent.change(screen.getByTestId('gql-profile-name-input'), { target: { value: 'Profile X' } });
    fireEvent.click(screen.getByTestId('gql-profile-save-btn'));
    act(() => vi.advanceTimersByTime(2001));
    expect(screen.getByTestId('gql-profile-save-btn')).toHaveTextContent('Save');
  });

  it('does NOT call onSave when name is empty', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="https://api.com/graphql" />);
    fireEvent.click(screen.getByTestId('gql-profile-save-btn'));
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('does NOT call onSave when endpoint is empty', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="" />);
    fireEvent.change(screen.getByTestId('gql-profile-name-input'), { target: { value: 'Profile X' } });
    fireEvent.click(screen.getByTestId('gql-profile-save-btn'));
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('saves on Enter key press when canSave is true', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="https://api.com/graphql" />);
    const input = screen.getByTestId('gql-profile-name-input');
    fireEvent.change(input, { target: { value: 'Enter Profile' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onSave).toHaveBeenCalledWith('Enter Profile');
  });

  it('does not save on Enter when canSave is false', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="https://api.com/graphql" />);
    const input = screen.getByTestId('gql-profile-name-input');
    // Name is empty so canSave is false
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('shows "saved flash" cleared on rapid double-save', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="https://api.com/graphql" />);
    const input = screen.getByTestId('gql-profile-name-input');
    // First save
    fireEvent.change(input, { target: { value: 'P1' } });
    fireEvent.click(screen.getByTestId('gql-profile-save-btn'));
    // input cleared, name is now '' — simulate user typing again immediately
    fireEvent.change(input, { target: { value: 'P2' } });
    fireEvent.click(screen.getByTestId('gql-profile-save-btn'));
    expect(defaultProps.onSave).toHaveBeenCalledTimes(2);
  });

  // ─── No endpoint warning ──────────────────────────────────────────────────

  it('shows no-endpoint warning when currentEndpoint is empty', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="" />);
    expect(screen.getByText(/enter an endpoint url/i)).toBeInTheDocument();
  });

  it('does not show no-endpoint warning when currentEndpoint is set', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="https://api.com/graphql" />);
    expect(screen.queryByText(/enter an endpoint url/i)).not.toBeInTheDocument();
  });

  // ─── Delete behavior ──────────────────────────────────────────────────────

  it('shows Remove delete button initially', () => {
    const profiles = [makeProfile()];
    render(<GraphqlProfileModal {...defaultProps} profiles={profiles} />);
    const deleteBtn = screen.getByTestId('gql-profile-delete-p1');
    expect(deleteBtn).toHaveTextContent('Remove');
  });

  it('changes to Delete? on first click (confirm mode)', () => {
    const profiles = [makeProfile()];
    render(<GraphqlProfileModal {...defaultProps} profiles={profiles} />);
    fireEvent.click(screen.getByTestId('gql-profile-delete-p1'));
    expect(screen.getByTestId('gql-profile-delete-p1')).toHaveTextContent('Delete?');
  });

  it('calls onDelete on second click (confirmed)', () => {
    const profiles = [makeProfile()];
    render(<GraphqlProfileModal {...defaultProps} profiles={profiles} />);
    fireEvent.click(screen.getByTestId('gql-profile-delete-p1'));
    fireEvent.click(screen.getByTestId('gql-profile-delete-p1'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('p1');
  });

  it('resets delete confirm state after 2.5 seconds', () => {
    const profiles = [makeProfile()];
    render(<GraphqlProfileModal {...defaultProps} profiles={profiles} />);
    fireEvent.click(screen.getByTestId('gql-profile-delete-p1'));
    expect(screen.getByTestId('gql-profile-delete-p1')).toHaveTextContent('Delete?');
    act(() => vi.advanceTimersByTime(2501));
    expect(screen.getByTestId('gql-profile-delete-p1')).toHaveTextContent('Remove');
  });

  it('resets timer on double first-click (same profile)', () => {
    const profiles = [makeProfile({ id: 'p1' }), makeProfile({ id: 'p2', name: 'Second' })];
    render(<GraphqlProfileModal {...defaultProps} profiles={profiles} />);
    fireEvent.click(screen.getByTestId('gql-profile-delete-p1'));
    fireEvent.click(screen.getByTestId('gql-profile-delete-p2'));
    expect(screen.getByTestId('gql-profile-delete-p2')).toHaveTextContent('Delete?');
    expect(screen.getByTestId('gql-profile-delete-p1')).toHaveTextContent('Remove');
  });

  // ─── Load behavior ────────────────────────────────────────────────────────

  it('calls onLoad when Load button clicked', () => {
    const profile = makeProfile();
    render(<GraphqlProfileModal {...defaultProps} profiles={[profile]} />);
    fireEvent.click(screen.getByRole('button', { name: /load profile: my profile/i }));
    expect(defaultProps.onLoad).toHaveBeenCalledWith(profile);
  });

  // ─── No-endpoint display in save preview ─────────────────────────────────

  it('shows "No endpoint configured" when currentEndpoint is empty in save preview', () => {
    render(<GraphqlProfileModal {...defaultProps} currentEndpoint="" />);
    expect(screen.getByText('No endpoint configured')).toBeInTheDocument();
  });

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  it('cleans up Escape keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<GraphqlProfileModal {...defaultProps} />);
    unmount();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('renders draggable header with grip', () => {
    render(<GraphqlProfileModal {...defaultProps} />);
    const header = screen.getByTestId('gql-profile-modal-header');
    expect(header).toHaveClass('gql-profile-modal__header--draggable');
    expect(header.querySelector('.gql-profile-modal__drag-grip')).toBeTruthy();
  });

  it('drag on header moves the modal offset', () => {
    render(<GraphqlProfileModal {...defaultProps} />);
    const header = screen.getByTestId('gql-profile-modal-header');
    const modal = screen.getByTestId('gql-profile-modal');
    const rect = { left: 100, top: 80, width: 540, height: 400 };
    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    });
    fireEvent.mouseDown(header, { clientX: 120, clientY: 90 });
    fireEvent.mouseMove(window, { clientX: 160, clientY: 120 });
    fireEvent.mouseUp(window);
    expect(modal.style.left).toBe('140px');
    expect(modal.style.top).toBe('110px');
  });
});
