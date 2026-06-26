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
  GqlBottomPanel: () => <div data-testid="gql-bottom-panel-mock">Bottom</div>,
}));
vi.mock('./GqlRightPane', () => ({
  GqlRightPane: () => <div data-testid="gql-right-pane-mock">Right</div>,
}));
vi.mock('./GraphqlSubscriptionAssertionPanel', () => ({
  GraphqlSubscriptionAssertionPanel: () => null,
}));
vi.mock('./GqlComplexityWarningBanner', () => ({
  GqlComplexityWarningBanner: () => null,
}));
vi.mock('./GraphqlCollectionRunnerPanel', () => ({
  GraphqlCollectionRunnerPanel: () => <div data-testid="gql-runner-panel-mock">Runner</div>,
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
    render(
      <GraphqlStudioSplitWorkspace
        {...baseProps}
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
    expect(screen.queryByTestId('gql-bottom-panel-mock')).toBeNull();
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
