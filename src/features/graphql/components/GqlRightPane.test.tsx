/**
 * @vitest-environment jsdom
 * GqlRightPane.test.tsx — unit tests for the Response/Schema right panel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GqlRightPane } from './GqlRightPane';
import type { GraphqlSchemaInfo, GraphqlTypeNode, SubscriptionStats } from '@shared/types/graphql';
import type { SubscriptionLogProps } from './GqlRightPane';

vi.mock('../utils/monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql/vars/${id}`,
  extractOperations: vi.fn(() => []),
  deriveTabLabel: vi.fn(() => 'Untitled'),
  deriveOperationType: vi.fn(() => undefined),
  registerGraphqlLanguage: vi.fn(),
  getOrInitGraphqlMode: vi.fn(),
}));

function makeSchemaInfo(overrides: Partial<GraphqlSchemaInfo> = {}): GraphqlSchemaInfo {
  const type: GraphqlTypeNode = {
    name: 'Query',
    kind: 'OBJECT',
    fields: [{ name: 'user', type: 'User!' }],
  };
  return {
    sdl: 'type Query { user: User! }',
    types: [type],
    queryType: 'Query',
    fetchedAt: Date.now(),
    ...overrides,
  };
}

const baseProps = {
  view: 'response' as const,
  onViewChange: vi.fn(),
  response: null,
  executing: false,
  execStatus: 'idle' as const,
  schemaInfo: null,
  schemaStatus: 'idle' as const,
  schemaErrorMessage: null,
  onIntrospect: vi.fn(),
  introspecting: false,
};

describe('GqlRightPane', () => {
  beforeEach(() => resetAllMocks());

  it('renders the right pane container', () => {
    render(<GqlRightPane {...baseProps} />);
    expect(screen.getByTestId('gql-right-pane')).toBeTruthy();
  });

  it('renders Response tab as active when view=response', () => {
    render(<GqlRightPane {...baseProps} />);
    expect(screen.getByTestId('gql-right-tab-response').getAttribute('aria-selected')).toBe('true');
  });

  it('renders Schema tab as inactive when view=response', () => {
    render(<GqlRightPane {...baseProps} />);
    expect(screen.getByTestId('gql-right-tab-schema').getAttribute('aria-selected')).toBe('false');
  });

  it('renders Schema tab as active when view=schema', () => {
    render(<GqlRightPane {...baseProps} view="schema" />);
    expect(screen.getByTestId('gql-right-tab-schema').getAttribute('aria-selected')).toBe('true');
  });

  it('calls onViewChange with "schema" when Schema tab clicked', () => {
    render(<GqlRightPane {...baseProps} />);
    fireEvent.click(screen.getByTestId('gql-right-tab-schema'));
    expect(baseProps.onViewChange).toHaveBeenCalledWith('schema');
  });

  it('calls onViewChange with "response" when Response tab clicked', () => {
    render(<GqlRightPane {...baseProps} view="schema" />);
    fireEvent.click(screen.getByTestId('gql-right-tab-response'));
    expect(baseProps.onViewChange).toHaveBeenCalledWith('response');
  });

  it('shows empty response state when no response', () => {
    render(<GqlRightPane {...baseProps} />);
    expect(screen.getByTestId('gql-response-empty')).toBeTruthy();
  });

  it('shows loading state when executing=true', () => {
    render(<GqlRightPane {...baseProps} executing />);
    expect(screen.getByTestId('gql-response-loading')).toBeTruthy();
  });

  it('shows schema idle state when view=schema and schemaStatus=idle', () => {
    render(<GqlRightPane {...baseProps} view="schema" />);
    expect(screen.getByTestId('gql-se-empty-idle')).toBeTruthy();
  });

  it('shows schema loading state when view=schema and schemaStatus=loading', () => {
    render(<GqlRightPane {...baseProps} view="schema" schemaStatus="loading" />);
    expect(screen.getByTestId('gql-se-loading')).toBeTruthy();
  });

  it('shows schema error state when view=schema and schemaStatus=error', () => {
    render(<GqlRightPane {...baseProps} view="schema" schemaStatus="error" schemaErrorMessage="Connection refused" />);
    expect(screen.getByTestId('gql-se-error')).toBeTruthy();
  });

  it('shows introspection disabled state when schemaStatus=introspection-disabled', () => {
    render(<GqlRightPane {...baseProps} view="schema" schemaStatus="introspection-disabled" />);
    expect(screen.getByTestId('gql-se-introspection-disabled')).toBeTruthy();
  });

  it('shows ok badge on Response tab after successful execution', () => {
    render(<GqlRightPane {...baseProps} execStatus="success" />);
    const responseTab = screen.getByTestId('gql-right-tab-response');
    expect(responseTab.querySelector('.gql-right-tab-badge--ok')).toBeTruthy();
  });

  it('shows warn badge on Response tab for partial success (data + errors)', () => {
    const partialResponse = {
      data: { users: [] },
      errors: [{ message: 'Partial failure on users.avatarUrl' }],
      httpStatus: 200,
      httpHeaders: {},
      latencyMs: 42,
      timestamp: Date.now(),
    };
    render(
      <GqlRightPane
        {...baseProps}
        execStatus="success"
        response={partialResponse}
      />,
    );
    const responseTab = screen.getByTestId('gql-right-tab-response');
    expect(responseTab.querySelector('.gql-right-tab-badge--warn')).toBeTruthy();
    expect(responseTab.querySelector('.gql-right-tab-badge--ok')).toBeNull();
  });

  it('shows error badge on Response tab after execution error', () => {
    render(<GqlRightPane {...baseProps} execStatus="error" />);
    const responseTab = screen.getByTestId('gql-right-tab-response');
    expect(responseTab.querySelector('.gql-right-tab-badge--error')).toBeTruthy();
  });

  it('shows ok badge on Schema tab when schemaStatus=loaded', () => {
    render(<GqlRightPane {...baseProps} schemaStatus="loaded" schemaInfo={makeSchemaInfo()} />);
    const schemaTab = screen.getByTestId('gql-right-tab-schema');
    expect(schemaTab.querySelector('.gql-right-tab-badge--ok')).toBeTruthy();
  });

  it('shows error badge on Schema tab when schemaStatus=error', () => {
    render(<GqlRightPane {...baseProps} schemaStatus="error" />);
    const schemaTab = screen.getByTestId('gql-right-tab-schema');
    expect(schemaTab.querySelector('.gql-right-tab-badge--error')).toBeTruthy();
  });

  // ── Subscription hint (Phase 2 Sprint 1 readiness) ───────────────────────────

  it('shows subscription hint when operationType is subscription and no response', () => {
    render(<GqlRightPane {...baseProps} activeOperationType="subscription" />);
    expect(screen.getByTestId('gql-subscription-hint')).toBeTruthy();
    // Regular response viewer should not render
    expect(screen.queryByTestId('gql-response-empty')).toBeNull();
  });

  it('does not show subscription hint for query operation type', () => {
    render(<GqlRightPane {...baseProps} activeOperationType="query" />);
    expect(screen.queryByTestId('gql-subscription-hint')).toBeNull();
    expect(screen.getByTestId('gql-response-empty')).toBeTruthy();
  });

  it('does not show subscription hint for mutation operation type', () => {
    render(<GqlRightPane {...baseProps} activeOperationType="mutation" />);
    expect(screen.queryByTestId('gql-subscription-hint')).toBeNull();
  });

  it('does not show subscription hint when already executing', () => {
    render(<GqlRightPane {...baseProps} activeOperationType="subscription" executing />);
    expect(screen.queryByTestId('gql-subscription-hint')).toBeNull();
    expect(screen.getByTestId('gql-response-loading')).toBeTruthy();
  });

  it('does not show subscription hint when a response is already present', () => {
    const response = {
      data: { items: [] },
      httpStatus: 200,
      httpHeaders: {},
      latencyMs: 100,
      timestamp: Date.now(),
    };
    render(<GqlRightPane {...baseProps} activeOperationType="subscription" response={response} execStatus="success" />);
    expect(screen.queryByTestId('gql-subscription-hint')).toBeNull();
  });

  it('does not show subscription hint when activeOperationType is null', () => {
    render(<GqlRightPane {...baseProps} activeOperationType={null} />);
    expect(screen.queryByTestId('gql-subscription-hint')).toBeNull();
  });

  // ── Sprint 2: Subscription log integration ─────────────────────────────────

  const emptyStats: SubscriptionStats = {
    totalMessages: 0, errorCount: 0, avgLatencyMs: 0, msgsPerSec: 0, connectedDurationMs: 0,
  };

  function makeSubLog(overrides: Partial<SubscriptionLogProps> = {}): SubscriptionLogProps {
    return {
      state: 'active',
      messages: [],
      stats: emptyStats,
      connectedSince: Date.now(),
      isPaused: false,
      pausedBufferCount: 0,
      errorMessage: null,
      reconnectAttempt: 0,
      transport: 'graphql-transport-ws',
      operationName: 'OnOrder',
      onPause: vi.fn(),
      onResume: vi.fn(),
      onClear: vi.fn(),
      onExport: vi.fn(),
      onStop: vi.fn(),
      ...overrides,
    };
  }

  it('shows subscription log when subscriptionLog.state is active and operationType is subscription', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={makeSubLog({ state: 'active' })}
      />
    );
    expect(screen.getByTestId('gql-sub-log')).toBeTruthy();
    expect(screen.queryByTestId('gql-subscription-hint')).toBeNull();
  });

  it('does not show subscription log when subscriptionLog.state is idle', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={makeSubLog({ state: 'idle' })}
      />
    );
    expect(screen.queryByTestId('gql-sub-log')).toBeNull();
    expect(screen.getByTestId('gql-subscription-hint')).toBeTruthy();
  });

  it('does not show subscription log when subscriptionLog prop is null', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={null}
      />
    );
    expect(screen.queryByTestId('gql-sub-log')).toBeNull();
  });

  it('shows ok badge on Response tab when subscriptionLog.state is active', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={makeSubLog({ state: 'active' })}
      />
    );
    const responseTab = screen.getByTestId('gql-right-tab-response');
    expect(responseTab.querySelector('.gql-right-tab-badge--ok')).toBeTruthy();
  });

  it('shows ok badge on Response tab when subscriptionLog.state is closed', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={makeSubLog({ state: 'closed' })}
      />
    );
    const responseTab = screen.getByTestId('gql-right-tab-response');
    expect(responseTab.querySelector('.gql-right-tab-badge--ok')).toBeTruthy();
  });

  it('shows error badge on Response tab when subscriptionLog.state is error', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={makeSubLog({ state: 'error', errorMessage: 'Connection refused' })}
      />
    );
    const responseTab = screen.getByTestId('gql-right-tab-response');
    expect(responseTab.querySelector('.gql-right-tab-badge--error')).toBeTruthy();
  });

  it('shows connecting badge on Response tab when subscriptionLog.state is connecting', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={makeSubLog({ state: 'connecting' })}
      />
    );
    const responseTab = screen.getByTestId('gql-right-tab-response');
    expect(responseTab.querySelector('.gql-right-tab-badge--connecting')).toBeTruthy();
    expect(responseTab.querySelector('.gql-right-tab-badge--ok')).toBeNull();
    expect(responseTab.querySelector('.gql-right-tab-badge--error')).toBeNull();
  });

  it('shows connecting badge on Response tab when subscriptionLog.state is reconnecting', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={makeSubLog({ state: 'reconnecting', reconnectAttempt: 1 })}
      />
    );
    const responseTab = screen.getByTestId('gql-right-tab-response');
    expect(responseTab.querySelector('.gql-right-tab-badge--connecting')).toBeTruthy();
    expect(responseTab.querySelector('.gql-right-tab-badge--ok')).toBeNull();
  });

  it('shows connecting badge on Response tab when subscriptionLog.state is closing', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={makeSubLog({ state: 'closing' })}
      />
    );
    const responseTab = screen.getByTestId('gql-right-tab-response');
    // 'closing' is a transitioning state — amber connecting badge (same as connecting/reconnecting)
    expect(responseTab.querySelector('.gql-right-tab-badge--connecting')).toBeTruthy();
    expect(responseTab.querySelector('.gql-right-tab-badge--ok')).toBeNull();
    expect(responseTab.querySelector('.gql-right-tab-badge--error')).toBeNull();
  });

  it('shows ok badge on Response tab when subscriptionLog.state is paused', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={makeSubLog({ state: 'paused', isPaused: true })}
      />
    );
    const responseTab = screen.getByTestId('gql-right-tab-response');
    // 'paused' — connection is still live, user manually paused buffering → green badge
    expect(responseTab.querySelector('.gql-right-tab-badge--ok')).toBeTruthy();
    expect(responseTab.querySelector('.gql-right-tab-badge--error')).toBeNull();
  });

  it('shows "Stream" as Response tab label for subscription operations', () => {
    render(
      <GqlRightPane
        {...baseProps}
        activeOperationType="subscription"
        subscriptionLog={makeSubLog({ state: 'active' })}
      />
    );
    expect(screen.getByTestId('gql-right-tab-response').textContent).toContain('Stream');
  });

  it('shows "Response" as Response tab label for query operations', () => {
    render(<GqlRightPane {...baseProps} activeOperationType="query" />);
    expect(screen.getByTestId('gql-right-tab-response').textContent).toContain('Response');
  });
});
