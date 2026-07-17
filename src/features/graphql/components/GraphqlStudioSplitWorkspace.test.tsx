/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphqlStudioSplitWorkspace } from './GraphqlStudioSplitWorkspace';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { BuilderState } from '../hooks/useGraphqlQueryBuilder';

function makeBuilderState(overrides: Partial<BuilderState> = {}): BuilderState {
  return {
    operationType: 'query',
    operationName: '',
    selectedFields: {},
    argValues: {},
    expandedPaths: new Set(),
    searchQuery: '',
    fieldAliases: {},
    fieldDirectives: {},
    fragments: {},
    activeFragmentSpreads: [],
    ...overrides,
  };
}

vi.mock('./GraphqlEditor', () => ({
  GraphqlEditor: () => <div data-testid="gql-editor-mock">Editor</div>,
}));
vi.mock('./GraphqlQueryBuilder', () => ({
  GraphqlQueryBuilder: ({
    onStateChange,
    initialState,
  }: {
    onStateChange?: (state: unknown) => void;
    initialState?: unknown;
  }) => {
    const g = globalThis as {
      __gqlBuilderOnStateChange?: typeof onStateChange;
      __gqlBuilderInitialState?: typeof initialState;
    };
    g.__gqlBuilderOnStateChange = onStateChange;
    g.__gqlBuilderInitialState = initialState;
    return <div data-testid="gql-builder-mock">Builder</div>;
  },
}));
vi.mock('./GqlBottomPanel', () => ({
  GqlBottomPanel: ({ onTabChange, activeTab, defaultVarsValue }: { onTabChange?: (tab: string) => void; activeTab?: string; defaultVarsValue?: string }) => {
    const g = globalThis as {
      __gqlBottomOnTabChange?: typeof onTabChange;
      __gqlBottomActiveTab?: string;
      __gqlBottomDefaultVars?: string;
    };
    g.__gqlBottomOnTabChange = onTabChange;
    g.__gqlBottomActiveTab = activeTab;
    g.__gqlBottomDefaultVars = defaultVarsValue;
    return (
      <button type="button" data-testid="gql-bottom-panel-mock" onClick={() => onTabChange?.('headers')}>
        Bottom
      </button>
    );
  },
}));
vi.mock('./GqlRightPane', () => ({
  GqlRightPane: (props: unknown) => {
    const g = globalThis as { __gqlRightPaneProps?: unknown };
    g.__gqlRightPaneProps = props;
    return <div data-testid="gql-right-pane-mock">Right</div>;
  },
}));
vi.mock('./GraphqlSubscriptionAssertionPanel', () => ({
  GraphqlSubscriptionAssertionPanel: ({ assertions }: { assertions: unknown[] }) => (
    <div data-testid="gql-subscription-assertion-panel-mock">{String(assertions.length)}</div>
  ),
}));
vi.mock('./GqlComplexityWarningBanner', () => ({
  GqlComplexityWarningBanner: () => null,
}));
vi.mock('./GraphqlCollectionRunnerPanel', () => ({
  GraphqlCollectionRunnerPanel: ({ onClose, items, collectionName }: { onClose?: () => void; items?: unknown[]; collectionName?: string }) => {
    const g = globalThis as { __gqlRunnerItems?: unknown[]; __gqlRunnerCollectionName?: string };
    g.__gqlRunnerItems = items;
    g.__gqlRunnerCollectionName = collectionName;
    return (
      <button type="button" data-testid="gql-runner-panel-mock" onClick={() => onClose?.()}>
        Runner
      </button>
    );
  },
}));

const activeTab: GqlStudioTab = {
  id: 'tab-1',
  label: 'Q1',
  modelUri: 'model://tab-1',
  query: 'query { health }',
  variables: '{}',
  headers: [],
  operationType: 'query',
  unsavedChanges: false,
  selectedOperation: 'GetHealth',
};

const splitRef = { current: null };
const leftPaneRef = { current: null };
const editorMountRef = { current: null };

const baseProps = {
  gqlSplitRef: splitRef,
  gqlLeftPaneRef: leftPaneRef,
  editorPaneWidth: 480,
  gqlPaneDividerProps: {},
  bottomPanelDividerProps: {},
  bottomPanelHeight: 220,
  builderMode: false,
  onSetBuilderMode: vi.fn(),
  schemaInfo: null,
  onEditInEditor: vi.fn(),
  onBuilderExecute: vi.fn(),
  activeTab,
  onQueryChange: vi.fn(),
  editorMountRef,
  prettifyError: false,
  onPrettify: vi.fn(),
  insertToast: null,
  complexityWarningPending: false,
  complexityResult: null,
  onExecute: vi.fn(),
  onDismissComplexityWarning: vi.fn(),
  onAssertionsChange: vi.fn(),
  bottomTab: 'variables' as const,
  onSetBottomTab: vi.fn(),
  runnerCollectionId: null,
  runner: { state: 'idle', results: [], run: vi.fn(), cancel: vi.fn(), reset: vi.fn() },
  collections: { trees: [], loading: false, refresh: vi.fn() },
  varsModelPath: 'model://vars/tab-1',
  varsError: null,
  onVariablesChange: vi.fn(),
  onHeadersChange: vi.fn(),
  activeEnvironment: null,
  globalEnvMap: {},
  fileEntries: [],
  onFileEntriesChange: vi.fn(),
  activeTabUploadProgress: undefined,
  storedAuthForPanel: undefined,
  resolvedAuthPreview: 'None',
  usesPageDefaultAuth: true,
  hasActiveTabAuthOverride: false,
  onAuthChange: vi.fn(),
  linkedProfileName: null,
  globalAuthProfiles: [],
  defaultAuthProfileId: null,
  rightView: 'response' as const,
  onRightViewChange: vi.fn(),
  response: null,
  isActiveTabExecuting: false,
  execStatus: 'idle' as const,
  schemaStatus: 'idle' as const,
  schemaErrorMessage: null,
  onIntrospect: vi.fn(),
  introspecting: false,
  onInsertField: vi.fn(),
  snapshots: [],
  onSaveSnapshot: vi.fn(async () => {}),
  onDeleteSnapshot: vi.fn(),
  onClearOlderSnapshots: vi.fn(async () => 0),
  onOpenDiff: vi.fn(),
  deprecatedUsages: [],
  onOpenCollectionItem: vi.fn(),
  subscription: {
    state: 'idle' as const,
    messages: [],
    stats: { messageCount: 0, bytesReceived: 0, errorCount: 0 },
    connectedSince: 0,
    isPaused: false,
    pausedBufferCount: 0,
    subscribe: vi.fn(),
    disconnect: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    clear: vi.fn(),
    reset: vi.fn(),
    transport: null,
  },
  selectedOperation: 'GetHealth',
  assertionResultMap: new Map(),
  onExportSubscription: vi.fn(),
  onStopSubscription: vi.fn(),
  onResubscribeSubscription: vi.fn(),
};

describe('GraphqlStudioSplitWorkspace', () => {
  it('renders editor mode with bottom panel and right pane', () => {
    render(<GraphqlStudioSplitWorkspace {...baseProps} />);
    expect(screen.getByTestId('gql-studio-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('gql-editor-mock')).toBeInTheDocument();
    expect(screen.getByTestId('gql-bottom-panel-mock')).toBeInTheDocument();
    expect(screen.getByTestId('gql-right-pane-mock')).toBeInTheDocument();
  });

  it('switches to builder mode and hides right pane', () => {
    render(<GraphqlStudioSplitWorkspace {...baseProps} builderMode />);
    expect(screen.getByTestId('gql-builder-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('gql-right-pane-mock')).toBeNull();
  });

  it('toggles builder mode from mode bar buttons', () => {
    const onSetBuilderMode = vi.fn();
    render(<GraphqlStudioSplitWorkspace {...baseProps} onSetBuilderMode={onSetBuilderMode} />);
    fireEvent.click(screen.getByTestId('gql-mode-builder'));
    expect(onSetBuilderMode).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId('gql-mode-editor'));
    expect(onSetBuilderMode).toHaveBeenCalledWith(false);
  });

  it('shows collection runner panel when bottom tab is runner', () => {
    const onSetBottomTab = vi.fn();
    render(
      <GraphqlStudioSplitWorkspace
        {...baseProps}
        onSetBottomTab={onSetBottomTab}
        bottomTab="runner"
        runnerCollectionId="col-1"
        collections={{
          trees: [{
            collection: { id: 'col-1', name: 'Demo', createdAt: '', updatedAt: '' },
            folders: [],
            items: [],
          }],
          loading: false,
          refresh: vi.fn(),
        }}
      />,
    );
    expect(screen.getByTestId('gql-runner-panel-mock')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-runner-panel-mock'));
    expect(onSetBottomTab).toHaveBeenCalledWith('variables');
    expect(screen.queryByTestId('gql-bottom-panel-mock')).toBeNull();
  });

  it('renders editor affordances and calls bottom panel tab-change bridge', () => {
    const onPrettify = vi.fn();
    const onSetBottomTab = vi.fn();
    render(
      <GraphqlStudioSplitWorkspace
        {...baseProps}
        onPrettify={onPrettify}
        onSetBottomTab={onSetBottomTab}
        insertToast="Inserted field"
        prettifyError
        activeTab={{ ...activeTab, operationType: 'subscription', subscriptionAssertions: [] }}
      />,
    );

    const prettifyButton = screen.getByTestId('gql-prettify-btn');
    expect(prettifyButton).toHaveClass('gql-prettify-btn--error');
    expect(prettifyButton).toHaveAttribute('title', 'Cannot format — fix syntax errors first');
    fireEvent.click(prettifyButton);
    expect(onPrettify).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('gql-insert-toast')).toHaveTextContent('Inserted field');
    expect(screen.getByTestId('gql-subscription-assertion-panel-mock')).toHaveTextContent('0');

    fireEvent.click(screen.getByTestId('gql-bottom-panel-mock'));
    expect(onSetBottomTab).toHaveBeenCalledWith('headers');
  });

  it('passes subscription right-pane payload and tab-auth panel props', () => {
    type RightPaneProps = {
      activeOperationType?: string | null;
      subscriptionLog?: { operationName: string } | null;
    };
    const g = globalThis as {
      __gqlRightPaneProps?: RightPaneProps;
    };

    render(
      <GraphqlStudioSplitWorkspace
        {...baseProps}
        usesPageDefaultAuth={false}
        onResetAuthToInherit={vi.fn()}
        selectedOperation={undefined}
        activeTab={{ ...activeTab, operationType: 'subscription', label: 'Tab Label', responseSubTab: 'headers' }}
        subscription={{
          state: 'connected' as const,
          messages: [],
          stats: { messageCount: 0, bytesReceived: 0, errorCount: 0 },
          connectedSince: 0,
          isPaused: false,
          pausedBufferCount: 0,
          subscribe: vi.fn(),
          disconnect: vi.fn(),
          pause: vi.fn(),
          resume: vi.fn(),
          clear: vi.fn(),
          reset: vi.fn(),
          transport: 'sse',
          errorMessage: null,
          reconnectAttempt: 0,
        }}
      />,
    );

    expect(g.__gqlRightPaneProps?.activeOperationType).toBe('subscription');
    expect(g.__gqlRightPaneProps?.subscriptionLog?.operationName).toBe('Tab Label');
  });

  it('covers builder title/schema and fallback pane values', () => {
    type RightPaneProps = { activeOperationType?: string | null };
    const g = globalThis as {
      __gqlRightPaneProps?: RightPaneProps;
      __gqlRunnerItems?: unknown[];
      __gqlRunnerCollectionName?: string;
      __gqlBottomActiveTab?: string;
      __gqlBottomDefaultVars?: string;
    };

    const { rerender } = render(
      <GraphqlStudioSplitWorkspace
        {...baseProps}
        schemaInfo={{ sdl: 'type Query { ok: Boolean }' } as never}
      />,
    );
    expect(screen.getByTestId('gql-mode-builder')).not.toHaveAttribute('title');

    rerender(
      <GraphqlStudioSplitWorkspace
        {...baseProps}
        bottomTab="runner"
        runnerCollectionId="missing-runner"
      />,
    );
    expect(g.__gqlRunnerItems).toEqual([]);
    expect(g.__gqlRunnerCollectionName).toBe('Collection');

    rerender(
      <GraphqlStudioSplitWorkspace
        {...baseProps}
        bottomTab="runner"
        runnerCollectionId={null}
        activeTab={{ ...activeTab, variables: undefined, operationType: undefined }}
      />,
    );
    expect(g.__gqlBottomActiveTab).toBe('variables');
    expect(g.__gqlBottomDefaultVars).toContain('{');
    expect(g.__gqlRightPaneProps?.activeOperationType).toBeNull();
  });

  it('persists builder state per tab via onStateChange callback', () => {
    type BuilderStub = BuilderState;
    const g = globalThis as {
      __gqlBuilderOnStateChange?: (s: BuilderStub) => void;
      __gqlBuilderInitialState?: BuilderStub;
    };

    const tabA: GqlStudioTab = { ...activeTab, id: 'tab-a', label: 'A' };
    const tabB: GqlStudioTab = { ...activeTab, id: 'tab-b', label: 'B' };
    const { rerender } = render(
      <GraphqlStudioSplitWorkspace {...baseProps} builderMode activeTab={tabA} />,
    );
    g.__gqlBuilderOnStateChange?.(makeBuilderState({ operationName: 'GetUsers' }));

    rerender(<GraphqlStudioSplitWorkspace {...baseProps} builderMode activeTab={tabB} />);
    expect(g.__gqlBuilderInitialState).toBeUndefined();
    g.__gqlBuilderOnStateChange?.(makeBuilderState({ operationName: 'CreateUser' }));

    rerender(<GraphqlStudioSplitWorkspace {...baseProps} builderMode activeTab={tabA} />);
    expect(g.__gqlBuilderInitialState?.operationName).toBe('GetUsers');
  });
});
