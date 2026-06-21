/**
 * @vitest-environment jsdom
 *
 * GraphqlConnectionBar — comprehensive unit tests.
 * Tests the connection bar rendering, interactions, schema status badges,
 * auth popover, transport selector, and more.
 */
import '@testing-library/jest-dom/vitest';
import { render, fireEvent, screen, act, createEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GraphqlConnectionBar } from './GraphqlConnectionBar';

// Prevent Monaco from loading in test environment
vi.mock('../utils/monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql/vars/${id}`,
  extractOperations: vi.fn(() => []),
  deriveTabLabel: vi.fn(() => 'Untitled'),
  deriveOperationType: vi.fn(() => undefined),
  registerGraphqlLanguage: vi.fn(),
  getOrInitGraphqlMode: vi.fn(),
}));

vi.mock('@monaco-editor/react', () => ({
  Editor: () => null,
  default: () => null,
}));

// Minimal default props for a query operation
function defaultProps(overrides = {}) {
  return {
    endpoint: 'https://api.example.com/graphql',
    onEndpointChange: vi.fn(),
    onExecute: vi.fn(),
    onCancel: vi.fn(),
    onIntrospect: vi.fn(),
    activeOperationType: 'query' as const,
    ...overrides,
  };
}

// Minimal props for a subscription-mode connection bar
function subProps(overrides = {}) {
  return {
    endpoint: 'https://api.example.com/graphql',
    onEndpointChange: vi.fn(),
    onExecute: vi.fn(),
    onCancel: vi.fn(),
    onIntrospect: vi.fn(),
    activeOperationType: 'subscription' as const,
    subscriptionState: 'idle' as const,
    onSubscribe: vi.fn(),
    onStop: vi.fn(),
    subscriptionTransport: 'auto' as const,
    onSubscriptionTransportChange: vi.fn(),
    ...overrides,
  };
}

// ─── Basic rendering ──────────────────────────────────────────────────────────

describe('GraphqlConnectionBar — basic rendering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the connection bar', () => {
    render(<GraphqlConnectionBar {...defaultProps()} />);
    expect(screen.getByTestId('gql-connection-bar')).toBeTruthy();
  });

  it('shows endpoint input with provided value', () => {
    render(<GraphqlConnectionBar {...defaultProps()} />);
    const input = screen.getByTestId('gql-endpoint-input') as HTMLInputElement;
    expect(input.value).toBe('https://api.example.com/graphql');
  });

  it('calls onEndpointChange when endpoint input changes', () => {
    const onEndpointChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({ onEndpointChange })} />);
    const input = screen.getByTestId('gql-endpoint-input');
    fireEvent.change(input, { target: { value: 'https://new.example.com/graphql' } });
    expect(onEndpointChange).toHaveBeenCalledWith('https://new.example.com/graphql');
  });

  it('renders Execute button for query operations', () => {
    render(<GraphqlConnectionBar {...defaultProps()} />);
    expect(screen.getByTestId('gql-execute-btn')).toBeTruthy();
  });

  it('calls onExecute when Execute button is clicked', () => {
    const onExecute = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({ onExecute })} />);
    fireEvent.click(screen.getByTestId('gql-execute-btn'));
    expect(onExecute).toHaveBeenCalled();
  });

  it('renders Cancel button while executing', () => {
    render(<GraphqlConnectionBar {...defaultProps({ executing: true })} />);
    expect(screen.getByTestId('gql-cancel-btn')).toBeTruthy();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({ executing: true, onCancel })} />);
    fireEvent.click(screen.getByTestId('gql-cancel-btn'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders Introspect button', () => {
    render(<GraphqlConnectionBar {...defaultProps()} />);
    expect(screen.getByTestId('gql-introspect-btn')).toBeTruthy();
  });

  it('calls onIntrospect when Introspect button is clicked', () => {
    const onIntrospect = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({ onIntrospect })} />);
    fireEvent.click(screen.getByTestId('gql-introspect-btn'));
    expect(onIntrospect).toHaveBeenCalled();
  });

  it('Execute button is disabled when query is empty', () => {
    render(<GraphqlConnectionBar {...defaultProps({ queryEmpty: true })} />);
    const btn = screen.getByTestId('gql-execute-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Execute button is disabled when vars are invalid', () => {
    render(<GraphqlConnectionBar {...defaultProps({ varsInvalid: true })} />);
    const btn = screen.getByTestId('gql-execute-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows validation warning icon when queryValidationErrors > 0', () => {
    render(<GraphqlConnectionBar {...defaultProps({ queryValidationErrors: 2 })} />);
    expect(screen.getByTestId('gql-validation-warning')).toBeTruthy();
  });

  it('does not show validation warning when errors = 0', () => {
    render(<GraphqlConnectionBar {...defaultProps({ queryValidationErrors: 0 })} />);
    expect(screen.queryByTestId('gql-validation-warning')).toBeNull();
  });
});

// ─── Schema status badge ──────────────────────────────────────────────────────

describe('GraphqlConnectionBar — schema status', () => {
  it('shows schema loaded badge when schemaStatus is loaded', () => {
    render(<GraphqlConnectionBar {...defaultProps({ schemaStatus: 'loaded', typesCount: 42 })} />);
    expect(screen.getByTestId('gql-schema-badge-ok')).toBeTruthy();
  });

  it('shows schema error badge when schemaStatus is error', () => {
    render(<GraphqlConnectionBar {...defaultProps({ schemaStatus: 'error' })} />);
    expect(screen.getByTestId('gql-schema-badge-error')).toBeTruthy();
  });

  it('does not show schema badge when schemaStatus is none', () => {
    render(<GraphqlConnectionBar {...defaultProps({ schemaStatus: 'none' })} />);
    expect(screen.queryByTestId('gql-schema-badge-ok')).toBeNull();
    expect(screen.queryByTestId('gql-schema-badge-error')).toBeNull();
  });
});

// ─── Auth badge ───────────────────────────────────────────────────────────────

describe('GraphqlConnectionBar — auth badge', () => {
  it('renders auth badge button when onAuthChange is provided', () => {
    render(<GraphqlConnectionBar {...defaultProps({ onAuthChange: vi.fn(), auth: null })} />);
    expect(screen.getByTestId('gql-auth-badge-btn')).toBeTruthy();
  });

  it('opens auth popover when auth badge is clicked', () => {
    render(<GraphqlConnectionBar {...defaultProps({ onAuthChange: vi.fn(), auth: null })} />);
    fireEvent.click(screen.getByTestId('gql-auth-badge-btn'));
    expect(screen.getByTestId('gql-auth-popover')).toBeTruthy();
  });

  it('closes auth popover when clicking outside', () => {
    render(<GraphqlConnectionBar {...defaultProps({ onAuthChange: vi.fn(), auth: null })} />);
    fireEvent.click(screen.getByTestId('gql-auth-badge-btn'));
    expect(screen.getByTestId('gql-auth-popover')).toBeTruthy();
    // Close by pressing Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('gql-auth-popover')).toBeNull();
  });
});

// ─── Environment badge ────────────────────────────────────────────────────────

describe('GraphqlConnectionBar — environment badge', () => {
  it('shows env badge when activeEnvName and onEnvBadgeClick are provided', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      activeEnvName: 'Production',
      onEnvBadgeClick: vi.fn(),
    })} />);
    expect(screen.getByTestId('gql-env-badge')).toBeTruthy();
  });

  it('calls onEnvBadgeClick when env badge is clicked', () => {
    const onEnvBadgeClick = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      activeEnvName: 'Staging',
      onEnvBadgeClick,
    })} />);
    fireEvent.click(screen.getByTestId('gql-env-badge'));
    expect(onEnvBadgeClick).toHaveBeenCalled();
  });

  it('does not show env badge when onEnvBadgeClick is not provided', () => {
    render(<GraphqlConnectionBar {...defaultProps({ activeEnvName: null })} />);
    expect(screen.queryByTestId('gql-env-badge')).toBeNull();
  });
});

// ─── TLS toggle ───────────────────────────────────────────────────────────────

describe('GraphqlConnectionBar — TLS toggle', () => {
  it('renders TLS toggle when onSkipTlsVerifyChange is provided', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      onSkipTlsVerifyChange: vi.fn(),
      skipTlsVerify: false,
    })} />);
    expect(screen.getByTestId('gql-tls-toggle')).toBeTruthy();
  });

  it('calls onSkipTlsVerifyChange when TLS toggle is clicked', () => {
    const onSkipTlsVerifyChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      onSkipTlsVerifyChange,
      skipTlsVerify: false,
    })} />);
    fireEvent.click(screen.getByTestId('gql-tls-toggle'));
    expect(onSkipTlsVerifyChange).toHaveBeenCalledWith(true);
  });

  it('calls onSkipTlsVerifyChange with false when toggle is ON', () => {
    const onSkipTlsVerifyChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      onSkipTlsVerifyChange,
      skipTlsVerify: true,
    })} />);
    fireEvent.click(screen.getByTestId('gql-tls-toggle'));
    expect(onSkipTlsVerifyChange).toHaveBeenCalledWith(false);
  });
});

// ─── Profile badge ────────────────────────────────────────────────────────────

describe('GraphqlConnectionBar — profile badge', () => {
  it('shows profile badge when profiles are provided', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      profiles: [{ id: 'p1', name: 'My API', endpoint: 'https://api.example.com/graphql', auth: null, createdAt: Date.now() }],
      onProfileBadgeClick: vi.fn(),
    })} />);
    expect(screen.getByTestId('gql-profile-badge')).toBeTruthy();
  });

  it('calls onProfileBadgeClick when profile badge is clicked', () => {
    const onProfileBadgeClick = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      profiles: [{ id: 'p1', name: 'My API', endpoint: 'https://api.example.com/graphql', auth: null, createdAt: Date.now() }],
      onProfileBadgeClick,
    })} />);
    fireEvent.click(screen.getByTestId('gql-profile-badge'));
    expect(onProfileBadgeClick).toHaveBeenCalled();
  });
});

// ─── Operations selector ──────────────────────────────────────────────────────

describe('GraphqlConnectionBar — operations selector', () => {
  it('shows operation selector when multiple operations exist', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      operations: ['GetUser', 'GetProfile'],
      selectedOperation: 'GetUser',
      onSelectOperation: vi.fn(),
    })} />);
    expect(screen.getByTestId('gql-op-selector')).toBeTruthy();
  });

  it('calls onSelectOperation when operation is changed', () => {
    const onSelectOperation = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      operations: ['GetUser', 'GetProfile'],
      selectedOperation: 'GetUser',
      onSelectOperation,
    })} />);
    const select = screen.getByTestId('gql-op-selector');
    fireEvent.change(select, { target: { value: 'GetProfile' } });
    expect(onSelectOperation).toHaveBeenCalledWith('GetProfile');
  });

  it('does not show operation selector for a single operation', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      operations: ['GetUser'],
      selectedOperation: 'GetUser',
      onSelectOperation: vi.fn(),
    })} />);
    expect(screen.queryByTestId('gql-op-selector')).toBeNull();
  });
});

// ─── Sprint 3 transport selector ─────────────────────────────────────────────

describe('GraphqlConnectionBar — Sprint 3 transport selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders transport select dropdown for subscription operations', () => {
    render(<GraphqlConnectionBar {...subProps()} />);
    expect(screen.getByTestId('gql-transport-select')).toBeTruthy();
  });

  it('does NOT render transport selector when onSubscriptionTransportChange is not provided', () => {
    render(<GraphqlConnectionBar {...subProps({ onSubscriptionTransportChange: undefined })} />);
    expect(screen.queryByTestId('gql-transport-select')).toBeNull();
  });

  it('does NOT render transport selector for query operations', () => {
    render(<GraphqlConnectionBar {...subProps({ activeOperationType: 'query' })} />);
    expect(screen.queryByTestId('gql-transport-select')).toBeNull();
  });

  it('does NOT render transport selector for mutation operations', () => {
    render(<GraphqlConnectionBar {...subProps({ activeOperationType: 'mutation' })} />);
    expect(screen.queryByTestId('gql-transport-select')).toBeNull();
  });

  it('shows current transport value as selected option', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionTransport: 'sse' })} />);
    const select = screen.getByTestId('gql-transport-select') as HTMLSelectElement;
    expect(select.value).toBe('sse');
  });

  it('shows "auto" as selected when transport is auto', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionTransport: 'auto' })} />);
    const select = screen.getByTestId('gql-transport-select') as HTMLSelectElement;
    expect(select.value).toBe('auto');
  });

  it('calls onSubscriptionTransportChange when selection changes', () => {
    const onChange = vi.fn();
    render(<GraphqlConnectionBar {...subProps({ onSubscriptionTransportChange: onChange })} />);
    const select = screen.getByTestId('gql-transport-select');
    fireEvent.change(select, { target: { value: 'graphql-transport-ws' } });
    expect(onChange).toHaveBeenCalledWith('graphql-transport-ws');
  });

  it('calls onSubscriptionTransportChange with "sse" when SSE is selected', () => {
    const onChange = vi.fn();
    render(<GraphqlConnectionBar {...subProps({ onSubscriptionTransportChange: onChange })} />);
    const select = screen.getByTestId('gql-transport-select');
    fireEvent.change(select, { target: { value: 'sse' } });
    expect(onChange).toHaveBeenCalledWith('sse');
  });

  it('disables transport select while subscription is connecting', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'connecting' })} />);
    const select = screen.getByTestId('gql-transport-select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it('disables transport select while subscription is active', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'active' })} />);
    const select = screen.getByTestId('gql-transport-select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it('disables transport select while subscription is reconnecting', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'reconnecting' })} />);
    const select = screen.getByTestId('gql-transport-select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it('enables transport select when subscription is idle', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'idle' })} />);
    const select = screen.getByTestId('gql-transport-select') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });

  it('enables transport select when subscription is closed', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'closed' })} />);
    const select = screen.getByTestId('gql-transport-select') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });

  it('has all four transport options', () => {
    render(<GraphqlConnectionBar {...subProps()} />);
    const select = screen.getByTestId('gql-transport-select') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['auto', 'graphql-transport-ws', 'graphql-ws', 'sse']);
  });

  it('has correct aria-label for accessibility', () => {
    render(<GraphqlConnectionBar {...subProps()} />);
    const select = screen.getByLabelText('Subscription transport protocol');
    expect(select).toBeTruthy();
  });

  it('shows "→ SSE" auto-detect hint when Auto transport + /stream endpoint', () => {
    render(<GraphqlConnectionBar {...subProps({
      endpoint: 'https://api.example.com/graphql/stream',
      subscriptionTransport: 'auto',
    })} />);
    expect(screen.getByTestId('gql-transport-auto-hint')).toBeTruthy();
  });

  it('does NOT show auto-detect hint for non-stream Auto endpoint', () => {
    render(<GraphqlConnectionBar {...subProps({
      endpoint: 'wss://api.example.com/graphql',
      subscriptionTransport: 'auto',
    })} />);
    expect(screen.queryByTestId('gql-transport-auto-hint')).toBeNull();
  });

  it('does NOT show auto-detect hint when SSE is explicitly selected (not auto)', () => {
    render(<GraphqlConnectionBar {...subProps({
      endpoint: 'https://api.example.com/graphql/stream',
      subscriptionTransport: 'sse',
    })} />);
    expect(screen.queryByTestId('gql-transport-auto-hint')).toBeNull();
  });

  it('shows "→ SSE" hint for wss:// endpoint ending in /stream', () => {
    render(<GraphqlConnectionBar {...subProps({
      endpoint: 'wss://api.example.com/graphql/stream',
      subscriptionTransport: 'auto',
    })} />);
    expect(screen.getByTestId('gql-transport-auto-hint')).toBeTruthy();
  });

  it('subscribe button aria-label says "SSE" when effectiveTransport is SSE', () => {
    render(<GraphqlConnectionBar {...subProps({
      subscriptionTransport: 'sse',
    })} />);
    const btn = screen.getByTestId('gql-subscribe-btn');
    expect(btn.getAttribute('aria-label')).toMatch(/SSE/);
  });

  it('subscribe button aria-label says "WebSocket" for WS transport', () => {
    render(<GraphqlConnectionBar {...subProps({
      subscriptionTransport: 'auto',
      endpoint: 'wss://api.example.com/graphql',
    })} />);
    const btn = screen.getByTestId('gql-subscribe-btn');
    expect(btn.getAttribute('aria-label')).toMatch(/WebSocket/);
  });
});

// ─── tabPersistence.ts — subscriptionTransport normalisation ────────────────
// (Lightweight normalization tests for the new field; full persistence tests
// are in tabPersistence.test.ts)
import { normalizeTab } from '../utils/tabPersistence';

describe('normalizeTab — subscriptionTransport field', () => {
  it('normalizes valid "sse" transport', () => {
    const tab = normalizeTab({ id: 't1', subscriptionTransport: 'sse' });
    expect(tab?.subscriptionTransport).toBe('sse');
  });

  it('normalizes valid "auto" transport', () => {
    const tab = normalizeTab({ id: 't1', subscriptionTransport: 'auto' });
    expect(tab?.subscriptionTransport).toBe('auto');
  });

  it('normalizes valid "graphql-transport-ws" transport', () => {
    const tab = normalizeTab({ id: 't1', subscriptionTransport: 'graphql-transport-ws' });
    expect(tab?.subscriptionTransport).toBe('graphql-transport-ws');
  });

  it('normalizes valid "graphql-ws" transport', () => {
    const tab = normalizeTab({ id: 't1', subscriptionTransport: 'graphql-ws' });
    expect(tab?.subscriptionTransport).toBe('graphql-ws');
  });

  it('returns undefined for unknown transport value (fallback to auto at runtime)', () => {
    const tab = normalizeTab({ id: 't1', subscriptionTransport: 'invalid-value' });
    expect(tab?.subscriptionTransport).toBeUndefined();
  });

  it('returns undefined when subscriptionTransport is absent', () => {
    const tab = normalizeTab({ id: 't1' });
    expect(tab?.subscriptionTransport).toBeUndefined();
  });
});

// ─── Recent endpoints dropdown ───────────────────────────────────────────────

describe('GraphqlConnectionBar — recent endpoints dropdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows recent endpoints dropdown on endpoint input focus', async () => {
    render(<GraphqlConnectionBar {...defaultProps({
      recentEndpoints: ['https://api.example.com/graphql', 'https://staging.example.com/graphql'],
    })} />);
    const input = screen.getByTestId('gql-endpoint-input');
    await act(async () => { fireEvent.focus(input); });
    expect(screen.getByTestId('gql-recent-endpoints')).toBeTruthy();
  });

  it('does not show dropdown when recentEndpoints is empty', async () => {
    render(<GraphqlConnectionBar {...defaultProps({ recentEndpoints: [] })} />);
    const input = screen.getByTestId('gql-endpoint-input');
    await act(async () => { fireEvent.focus(input); });
    expect(screen.queryByTestId('gql-recent-endpoints')).toBeNull();
  });

  it('calls onEndpointChange when a recent endpoint is clicked', async () => {
    const onEndpointChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      onEndpointChange,
      recentEndpoints: ['https://api.example.com/graphql'],
    })} />);
    await act(async () => { fireEvent.focus(screen.getByTestId('gql-endpoint-input')); });
    const btn = screen.getByTitle('https://api.example.com/graphql');
    await act(async () => { fireEvent.click(btn); });
    expect(onEndpointChange).toHaveBeenCalledWith('https://api.example.com/graphql');
  });

  it('shows remove button when onRemoveRecentEndpoint is provided', async () => {
    render(<GraphqlConnectionBar {...defaultProps({
      recentEndpoints: ['https://api.example.com/graphql'],
      onRemoveRecentEndpoint: vi.fn(),
    })} />);
    await act(async () => { fireEvent.focus(screen.getByTestId('gql-endpoint-input')); });
    expect(screen.getByLabelText('Remove https://api.example.com/graphql from recent endpoints')).toBeTruthy();
  });

  it('calls onRemoveRecentEndpoint when remove button is clicked', async () => {
    const onRemoveRecentEndpoint = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      recentEndpoints: ['https://api.example.com/graphql'],
      onRemoveRecentEndpoint,
    })} />);
    await act(async () => { fireEvent.focus(screen.getByTestId('gql-endpoint-input')); });
    const removeBtn = screen.getByLabelText('Remove https://api.example.com/graphql from recent endpoints');
    await act(async () => { fireEvent.click(removeBtn); });
    expect(onRemoveRecentEndpoint).toHaveBeenCalledWith('https://api.example.com/graphql');
  });

  it('blurring endpoint input hides the dropdown', async () => {
    render(<GraphqlConnectionBar {...defaultProps({
      recentEndpoints: ['https://api.example.com/graphql'],
    })} />);
    const input = screen.getByTestId('gql-endpoint-input');
    await act(async () => { fireEvent.focus(input); });
    expect(screen.getByTestId('gql-recent-endpoints')).toBeTruthy();
    await act(async () => { fireEvent.blur(input); });
    expect(screen.queryByTestId('gql-recent-endpoints')).toBeNull();
  });

  it('mousedown on dropdown prevents default to retain focus', async () => {
    render(<GraphqlConnectionBar {...defaultProps({
      recentEndpoints: ['https://api.example.com/graphql'],
    })} />);
    const input = screen.getByTestId('gql-endpoint-input');
    await act(async () => { fireEvent.focus(input); });
    const dropdown = screen.getByTestId('gql-recent-endpoints');
    const mouseDownEvent = createEvent.mouseDown(dropdown);
    fireEvent(dropdown, mouseDownEvent);
    expect(mouseDownEvent.defaultPrevented).toBe(true);
  });
});

// ─── Unresolved variable warnings ────────────────────────────────────────────

describe('GraphqlConnectionBar — unresolved variable warnings', () => {
  it('shows unresolved icon when endpoint has {{var}} not in active env', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      endpoint: 'https://{{host}}/graphql',
      activeEnvironment: { variables: [{ key: 'OTHER', value: 'x', enabled: true }] },
    })} />);
    expect(screen.getByTestId('gql-endpoint-unresolved-icon')).toBeTruthy();
  });

  it('does not show unresolved icon when all {{var}} are resolved', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      endpoint: 'https://{{host}}/graphql',
      activeEnvironment: { variables: [{ key: 'host', value: 'api.example.com', enabled: true }] },
    })} />);
    expect(screen.queryByTestId('gql-endpoint-unresolved-icon')).toBeNull();
  });

  it('disables Execute button when endpoint has unresolved vars', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      endpoint: 'https://{{host}}/graphql',
      activeEnvironment: { variables: [] },
    })} />);
    const btn = screen.getByTestId('gql-execute-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('does not show unresolved icon when endpoint has no {{var}} references', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      endpoint: 'https://api.example.com/graphql',
    })} />);
    expect(screen.queryByTestId('gql-endpoint-unresolved-icon')).toBeNull();
  });

  it('resolves global env vars from globalEnvMap and shows endpoint preview', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      endpoint: '{{graphqlUrl}}',
      globalEnvMap: { graphqlUrl: 'https://api.example.com/graphql' },
      endpointProtocolStatus: 'fallback',
    })} />);
    expect(screen.queryByTestId('gql-endpoint-unresolved-icon')).toBeNull();
    const preview = screen.getByTestId('gql-endpoint-preview');
    expect(preview.textContent).toContain('https://api.example.com/graphql');
    expect(preview.getAttribute('data-status')).toBe('fallback');
  });
});

// ─── Polling config button and popover ───────────────────────────────────────

describe('GraphqlConnectionBar — polling config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows polling config button when schema is loaded and onPollingChange provided', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange: vi.fn(),
    })} />);
    expect(screen.getByTestId('gql-polling-config-btn')).toBeTruthy();
  });

  it('opens polling config popover when button is clicked', async () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange: vi.fn(),
    })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-polling-config-btn'));
    });
    expect(screen.getByTestId('gql-polling-popover')).toBeTruthy();
  });

  it('closes polling popover when close button is clicked', async () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange: vi.fn(),
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Close polling config'));
    });
    expect(screen.queryByTestId('gql-polling-popover')).toBeNull();
  });

  it('calls onPollingChange when polling toggle is clicked', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange,
      pollingEnabled: false,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-toggle')); });
    expect(onPollingChange).toHaveBeenCalledWith(true, expect.any(Number));
  });

  it('shows polling interval input when polling is enabled', async () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange: vi.fn(),
      pollingEnabled: true,
      pollingIntervalSeconds: 60,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    const input = screen.getByTestId('gql-polling-interval-input') as HTMLInputElement;
    expect(input.value).toBe('60');
  });

  it('shows standalone polling config button when polling is enabled and schema is not loaded', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'none',
      onPollingChange: vi.fn(),
      pollingEnabled: true,
    })} />);
    expect(screen.getByTestId('gql-polling-config-btn-standalone')).toBeTruthy();
  });

  it('shows schema stale when pollErrorMessage is set', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      pollErrorMessage: 'Connection refused',
      onPollingChange: vi.fn(),
    })} />);
    expect(screen.getByText('Schema stale')).toBeTruthy();
  });

  it('shows schema polling dot when schemaPolling is true', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      schemaPolling: true,
    })} />);
    expect(screen.getByLabelText('Schema polling active')).toBeTruthy();
  });
});

// ─── Subscription button states ──────────────────────────────────────────────

describe('GraphqlConnectionBar — subscription states', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Subscribe button when subscription is idle', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'idle' })} />);
    expect(screen.getByTestId('gql-subscribe-btn')).toBeTruthy();
  });

  it('calls onSubscribe when Subscribe button is clicked', async () => {
    const onSubscribe = vi.fn();
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'idle', onSubscribe })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-subscribe-btn')); });
    expect(onSubscribe).toHaveBeenCalled();
  });

  it('shows Stop button when subscription is active', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'active' })} />);
    expect(screen.getByTestId('gql-stop-sub-btn')).toBeTruthy();
  });

  it('calls onStop when Stop button is clicked', async () => {
    const onStop = vi.fn();
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'active', onStop })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-stop-sub-btn')); });
    expect(onStop).toHaveBeenCalled();
  });

  it('shows ws-status badge when subscriptionState is connecting', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'connecting' })} />);
    expect(screen.getByTestId('gql-ws-status')).toBeTruthy();
  });

  it('shows ws-status badge when subscriptionState is active', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'active' })} />);
    expect(screen.getByTestId('gql-ws-status')).toBeTruthy();
  });

  it('shows ws-status badge when subscriptionState is reconnecting', () => {
    render(<GraphqlConnectionBar {...subProps({ subscriptionState: 'reconnecting' })} />);
    expect(screen.getByTestId('gql-ws-status')).toBeTruthy();
  });
});

// ─── fileErrors prop ──────────────────────────────────────────────────────────

describe('GraphqlConnectionBar — fileErrors prop', () => {
  it('disables Execute button when fileErrors is true', () => {
    render(<GraphqlConnectionBar {...defaultProps({ fileErrors: true })} />);
    const btn = screen.getByTestId('gql-execute-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

// ─── Execute button aria-label ternary branches ───────────────────────────────

describe('GraphqlConnectionBar — execute button aria-label branches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows noEndpoint aria-label when endpoint is empty', () => {
    render(<GraphqlConnectionBar {...defaultProps({ endpoint: '' })} />);
    const btn = screen.getByTestId('gql-execute-btn');
    expect(btn.getAttribute('aria-label')).toContain('Enter an endpoint URL');
  });

  it('shows endpointHasUnresolved aria-label when endpoint has {{var}}', () => {
    render(<GraphqlConnectionBar {...defaultProps({ endpoint: 'https://{{host}}/graphql' })} />);
    const btn = screen.getByTestId('gql-execute-btn');
    expect(btn.getAttribute('aria-label')).toContain('Resolve environment variables');
  });

  it('shows queryEmpty aria-label when queryEmpty is true', () => {
    render(<GraphqlConnectionBar {...defaultProps({ queryEmpty: true })} />);
    const btn = screen.getByTestId('gql-execute-btn');
    expect(btn.getAttribute('aria-label')).toContain('Enter a query');
  });

  it('shows varsInvalid aria-label when varsInvalid is true', () => {
    render(<GraphqlConnectionBar {...defaultProps({ varsInvalid: true })} />);
    const btn = screen.getByTestId('gql-execute-btn');
    expect(btn.getAttribute('aria-label')).toContain('Fix invalid JSON');
  });

  it('shows fileErrors aria-label when fileErrors is true', () => {
    render(<GraphqlConnectionBar {...defaultProps({ fileErrors: true })} />);
    const btn = screen.getByTestId('gql-execute-btn');
    expect(btn.getAttribute('aria-label')).toContain('Fix file size errors');
  });

  it('shows default execute aria-label for normal state', () => {
    render(<GraphqlConnectionBar {...defaultProps()} />);
    const btn = screen.getByTestId('gql-execute-btn');
    expect(btn.getAttribute('aria-label')).toContain('Execute operation');
  });
});

// ─── Polling interval input interaction ──────────────────────────────────────

describe('GraphqlConnectionBar — polling interval input interaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates local interval on polling interval input onChange', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 60,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    const input = screen.getByTestId('gql-polling-interval-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '45' } });
    expect(input.value).toBe('45');
  });

  it('commits interval on polling interval input onBlur', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 60,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    const input = screen.getByTestId('gql-polling-interval-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.blur(input);
    expect(onPollingChange).toHaveBeenCalled();
  });

  it('commits interval on Enter key in polling interval input', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 60,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    const input = screen.getByTestId('gql-polling-interval-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '90' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPollingChange).toHaveBeenCalled();
  });

  it('stops propagation on non-Enter keydown in polling interval input', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 60,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    const input = screen.getByTestId('gql-polling-interval-input') as HTMLInputElement;
    // just ensures no error thrown on arbitrary keydown
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toBeTruthy();
  });

  it('polling popover div row onClick toggles polling', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    const toggleRow = screen.getByText('Enable polling').closest('.gql-polling-toggle-row') as HTMLElement;
    await act(async () => { fireEvent.click(toggleRow); });
    expect(onPollingChange).toHaveBeenCalledWith(true, expect.any(Number));
  });

  it('polling popover close button hides popover', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    expect(screen.getByTestId('gql-polling-popover')).toBeTruthy();
    const closeBtn = screen.getByLabelText('Close polling config');
    await act(async () => { fireEvent.click(closeBtn); });
    expect(screen.queryByTestId('gql-polling-popover')).toBeNull();
  });

  it('clicking polling config button again while open closes the popover', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    expect(screen.getByTestId('gql-polling-popover')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    expect(screen.queryByTestId('gql-polling-popover')).toBeNull();
  });

  it('clicking toggle row (not button) in popover toggles polling', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    const toggleRow = screen.getByText('Enable polling').closest('.gql-polling-toggle-row') as HTMLElement;
    await act(async () => { fireEvent.click(toggleRow); });
    expect(onPollingChange).toHaveBeenCalledWith(true, expect.any(Number));
  });
});

// ─── Standalone polling button interactions ───────────────────────────────────

describe('GraphqlConnectionBar — standalone polling button interactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clicking standalone polling button opens polling popover', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'none',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn-standalone')); });
    expect(screen.getByTestId('gql-polling-popover')).toBeTruthy();
  });

  it('close button inside standalone popover hides it', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'none',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn-standalone')); });
    expect(screen.getByTestId('gql-polling-popover')).toBeTruthy();
    const closeBtn = screen.getByLabelText('Close polling config');
    await act(async () => { fireEvent.click(closeBtn); });
    expect(screen.queryByTestId('gql-polling-popover')).toBeNull();
  });

  it('toggle row click inside standalone popover calls onPollingChange', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'none',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn-standalone')); });
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-toggle')); });
    expect(onPollingChange).toHaveBeenCalledWith(false, expect.any(Number));
  });

  it('clicking toggle row (not button) in standalone popover calls onPollingChange', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'none',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn-standalone')); });
    const toggleRow = screen.getByText('Enable polling').closest('.gql-polling-toggle-row') as HTMLElement;
    await act(async () => { fireEvent.click(toggleRow); });
    expect(onPollingChange).toHaveBeenCalledWith(false, expect.any(Number));
  });

  it('clicking standalone polling button again while open closes the popover', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'none',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn-standalone')); });
    expect(screen.getByTestId('gql-polling-popover')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn-standalone')); });
    expect(screen.queryByTestId('gql-polling-popover')).toBeNull();
  });

  it('standalone popover interval input onChange updates value', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'none',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 60,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn-standalone')); });
    const input = screen.getByTestId('gql-polling-interval-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '45' } });
    expect(input.value).toBe('45');
  });

  it('standalone popover interval input onBlur commits interval', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'none',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 60,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn-standalone')); });
    const input = screen.getByTestId('gql-polling-interval-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '90' } });
    fireEvent.blur(input);
    expect(onPollingChange).toHaveBeenCalled();
  });

  it('standalone popover interval input Enter key commits interval', async () => {
    const onPollingChange = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'none',
      onPollingChange,
      pollingEnabled: true,
      pollingIntervalSeconds: 60,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn-standalone')); });
    const input = screen.getByTestId('gql-polling-interval-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPollingChange).toHaveBeenCalled();
  });
});

// ─── Polling popover click-outside and Escape key handlers ───────────────────

describe('GraphqlConnectionBar — polling popover outside-click/Escape', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Escape key closes polling popover', async () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange: vi.fn(),
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    expect(screen.getByTestId('gql-polling-popover')).toBeTruthy();
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByTestId('gql-polling-popover')).toBeNull();
  });

  it('mousedown inside popover does not close it', async () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange: vi.fn(),
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    const popover = screen.getByTestId('gql-polling-popover');
    await act(async () => { fireEvent.mouseDown(popover); });
    expect(screen.getByTestId('gql-polling-popover')).toBeTruthy();
  });

  it('mousedown outside popover and button closes it', async () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      onPollingChange: vi.fn(),
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    })} />);
    await act(async () => { fireEvent.click(screen.getByTestId('gql-polling-config-btn')); });
    expect(screen.getByTestId('gql-polling-popover')).toBeTruthy();
    await act(async () => { fireEvent.mouseDown(document.body); });
    expect(screen.queryByTestId('gql-polling-popover')).toBeNull();
  });
});

// ─── APQ badge tests ──────────────────────────────────────────────────────────

describe('GraphqlConnectionBar — APQ badge', () => {
  it('renders APQ miss badge when apqHash is set and no hit/unsupported', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      apqHash: 'abc123def456789012345678',
    })} />);
    expect(screen.getByText(/APQ miss:/)).toBeInTheDocument();
  });

  it('renders APQ hit badge when apqCacheHit is true', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      apqHash: 'abc123def456789012345678',
      apqCacheHit: true,
    })} />);
    expect(screen.getByText(/APQ hit:/)).toBeInTheDocument();
  });

  it('renders APQ unsupported badge when apqUnsupported is true', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      apqHash: 'abc123def456789012345678',
      apqUnsupported: true,
    })} />);
    expect(screen.getByText('APQ unsupported')).toBeInTheDocument();
  });

  it('does not render APQ badge when apqHash is not set', () => {
    render(<GraphqlConnectionBar {...defaultProps()} />);
    expect(screen.queryByText(/APQ/)).not.toBeInTheDocument();
  });

  it('sets APQ unsupported title on badge', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      apqHash: 'abc123def456789012345678',
      apqUnsupported: true,
    })} />);
    const badge = screen.getByText('APQ unsupported');
    expect(badge.closest('[title]')?.getAttribute('title')).toContain('APQ not supported');
  });

  it('sets APQ hit aria-label on badge', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      apqHash: 'abc123def456789012345678',
      apqCacheHit: true,
    })} />);
    expect(screen.getByLabelText(/APQ cache hit/)).toBeInTheDocument();
  });

  it('sets APQ miss aria-label on badge', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      apqHash: 'abc123def456789012345678',
      apqCacheHit: false,
      apqUnsupported: false,
    })} />);
    expect(screen.getByLabelText(/APQ cache miss/)).toBeInTheDocument();
  });
});

// ─── Batch send button tests ──────────────────────────────────────────────────

describe('GraphqlConnectionBar — batch button', () => {
  it('renders Send Batch button when batchEnabled and batchedTabCount >= 2', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      batchEnabled: true,
      batchedTabCount: 3,
      onSendBatch: vi.fn(),
    })} />);
    expect(screen.getByTestId('gql-send-batch-btn')).toBeInTheDocument();
    expect(screen.getByText('Send Batch (3)')).toBeInTheDocument();
  });

  it('does not render batch button when batchedTabCount < 2', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      batchEnabled: true,
      batchedTabCount: 1,
    })} />);
    expect(screen.queryByTestId('gql-send-batch-btn')).not.toBeInTheDocument();
  });

  it('does not render batch button when batchEnabled is false', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      batchEnabled: false,
      batchedTabCount: 3,
    })} />);
    expect(screen.queryByTestId('gql-send-batch-btn')).not.toBeInTheDocument();
  });

  it('shows "Batching…" when batchExecuting is true', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      batchEnabled: true,
      batchedTabCount: 2,
      batchExecuting: true,
      onSendBatch: vi.fn(),
    })} />);
    expect(screen.getByText('Batching…')).toBeInTheDocument();
  });

  it('calls onSendBatch when batch button is clicked', () => {
    const onSendBatch = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({
      batchEnabled: true,
      batchedTabCount: 2,
      onSendBatch,
    })} />);
    fireEvent.click(screen.getByTestId('gql-send-batch-btn'));
    expect(onSendBatch).toHaveBeenCalledTimes(1);
  });
});

// ─── Advanced settings button tests ──────────────────────────────────────────

describe('GraphqlConnectionBar — advanced settings button', () => {
  it('renders advanced settings gear button when onAdvancedSettingsClick is provided', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      onAdvancedSettingsClick: vi.fn(),
    })} />);
    expect(screen.getByTestId('gql-adv-settings-btn')).toBeInTheDocument();
  });

  it('does not render advanced settings button when onAdvancedSettingsClick is not provided', () => {
    render(<GraphqlConnectionBar {...defaultProps()} />);
    expect(screen.queryByTestId('gql-adv-settings-btn')).not.toBeInTheDocument();
  });

  it('calls onAdvancedSettingsClick when gear button is clicked', () => {
    const onAdvancedSettingsClick = vi.fn();
    render(<GraphqlConnectionBar {...defaultProps({ onAdvancedSettingsClick })} />);
    fireEvent.click(screen.getByTestId('gql-adv-settings-btn'));
    expect(onAdvancedSettingsClick).toHaveBeenCalledTimes(1);
  });

  it('applies active class when advancedSettingsOpen is true', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      onAdvancedSettingsClick: vi.fn(),
      advancedSettingsOpen: true,
    })} />);
    const btn = screen.getByTestId('gql-adv-settings-btn');
    expect(btn.className).toContain('gql-adv-settings-btn--active');
  });
});

// ─── Validation warning singular/plural tests ─────────────────────────────────

describe('GraphqlConnectionBar — validation warning badge', () => {
  it('shows singular "error" label for exactly 1 validation error', () => {
    render(<GraphqlConnectionBar {...defaultProps({ queryValidationErrors: 1 })} />);
    const badge = screen.getByTestId('gql-validation-warning');
    expect(badge.getAttribute('title')).toMatch(/1 schema validation error —/);
    expect(badge.getAttribute('title')).not.toMatch(/errors/);
  });

  it('shows plural "errors" label for more than 1 validation error', () => {
    render(<GraphqlConnectionBar {...defaultProps({ queryValidationErrors: 3 })} />);
    const badge = screen.getByTestId('gql-validation-warning');
    expect(badge.getAttribute('title')).toMatch(/3 schema validation errors/);
  });
});

// ─── Complexity badge level tests ─────────────────────────────────────────────

describe('GraphqlConnectionBar — complexity badge levels', () => {
  it('renders complexity badge with danger title when complexityLevel is danger', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      complexityScore: 5000,
      complexityLevel: 'danger',
    })} />);
    const badge = screen.getByTestId('gql-complexity-badge');
    expect(badge.getAttribute('title')).toContain('very expensive query');
  });

  it('renders complexity badge with warn title when complexityLevel is warn', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      complexityScore: 500,
      complexityLevel: 'warn',
    })} />);
    const badge = screen.getByTestId('gql-complexity-badge');
    expect(badge.getAttribute('title')).toContain('moderately complex query');
  });

  it('renders complexity badge with no extra title text when complexityLevel is ok', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      complexityScore: 50,
      complexityLevel: 'ok',
    })} />);
    const badge = screen.getByTestId('gql-complexity-badge');
    const title = badge.getAttribute('title') ?? '';
    expect(title).not.toContain('very expensive');
    expect(title).not.toContain('moderately complex');
  });
});

// ─── Introspect button edge cases ─────────────────────────────────────────────

describe('GraphqlConnectionBar — introspect button', () => {
  it('shows "Resolve environment variables" in title when endpoint has unresolved vars', () => {
    // Provide endpoint with an unresolved variable but no active environment to resolve it
    render(<GraphqlConnectionBar {...defaultProps({
      endpoint: 'https://{{myHost}}/graphql',
      activeEnvironment: undefined,
    })} />);
    const btn = screen.getByTestId('gql-introspect-btn');
    expect(btn.getAttribute('title')).toContain('Resolve environment variables');
  });

  it('shows spinner when introspecting', () => {
    render(<GraphqlConnectionBar {...defaultProps({ introspecting: true })} />);
    expect(document.querySelector('.gql-btn-spinner')).toBeInTheDocument();
  });
});

// ─── Schema polling error / stale state tests ─────────────────────────────────

describe('GraphqlConnectionBar — schema polling error states', () => {
  it('shows polling dot with warn class when pollErrorMessage is set and schemaPolling is true', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      schemaPolling: true,
      pollErrorMessage: 'Timeout',
      onPollingChange: vi.fn(),
    })} />);
    const dot = screen.getByLabelText(/Schema polling active — last refresh failed/);
    expect(dot).toBeInTheDocument();
    expect(dot.className).toContain('gql-polling-dot--warn');
  });

  it('shows normal schema-status-dot when schemaPolling is false', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      schemaPolling: false,
    })} />);
    expect(document.querySelector('.gql-schema-status-dot')).toBeInTheDocument();
  });

  it('shows typesCount in schema loaded badge when provided', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      typesCount: 42,
    })} />);
    expect(screen.getByText('Schema loaded (42)')).toBeInTheDocument();
  });

  it('shows schema loaded without count when typesCount is undefined', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      schemaStatus: 'loaded',
      typesCount: undefined,
    })} />);
    expect(screen.getByText('Schema loaded')).toBeInTheDocument();
  });

  it('shows polling config button standalone when polling enabled but schema not loaded', () => {
    render(<GraphqlConnectionBar {...defaultProps({
      pollingEnabled: true,
      schemaStatus: 'none',
      onPollingChange: vi.fn(),
      pollingIntervalSeconds: 30,
    })} />);
    expect(screen.getByTestId('gql-polling-config-btn-standalone')).toBeInTheDocument();
  });
});
