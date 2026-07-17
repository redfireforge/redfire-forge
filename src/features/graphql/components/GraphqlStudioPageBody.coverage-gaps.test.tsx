/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphqlStudioPageBody } from './GraphqlStudioPageBody';

vi.mock('./GraphqlStudioDemoBridges', () => ({ GraphqlStudioDemoBridges: () => null }));
vi.mock('./GraphqlStudioPageToolbar', () => ({ GraphqlStudioPageToolbar: () => null }));
vi.mock('./GqlTabBar', () => ({ GqlTabBar: () => null }));
vi.mock('./GraphqlStudioActivityBar', () => ({ GraphqlStudioActivityBar: () => null }));
vi.mock('./GraphqlStudioLeftActivityPanel', () => ({ GraphqlStudioLeftActivityPanel: () => null }));
vi.mock('./GraphqlStudioSplitWorkspace', () => ({
  GraphqlStudioSplitWorkspace: (props: { globalAuthProfiles?: unknown[] }) => (
    <div data-testid="split-workspace" data-profiles={JSON.stringify(props.globalAuthProfiles ?? [])} />
  ),
}));
vi.mock('./GraphqlStudioPageOverlays', () => ({ GraphqlStudioPageOverlays: () => null }));

const noop = vi.fn();
const ref = { current: null };

function minimalProps(overrides: {
  globalAuthProfiles?: unknown;
  builderMode?: boolean;
  activityTab?: string | null;
} = {}) {
  return {
    demoBridges: {} as never,
    executionLayers: null,
    toolbarSections: {} as never,
    tabBar: {
      tabs: [],
      activeTabId: 't1',
      onSelectTab: noop,
      onCloseTab: noop,
      onAddTab: noop,
      ...(overrides.globalAuthProfiles === undefined
        ? {}
        : { globalAuthProfiles: overrides.globalAuthProfiles }),
    } as never,
    main: {
      builderMode: overrides.builderMode ?? false,
      activityTab: overrides.activityTab ?? null,
      gqlActivitySplitRef: ref,
      activityPanelWidth: 280,
      history: { items: [], loading: false, search: () => [], recentItems: [] },
      historyMaxItems: 100,
      handleHistoryMaxItemsChange: noop,
      tabSchemaConnectionId: null,
      handleLoadHistoryItem: noop,
      handleRunHistoryItem: noop,
      setSaveToColItem: noop,
      mockServer: {} as never,
      schemaInfo: null,
      collections: { trees: [], loading: false } as never,
      invalidItemIds: new Set<string>(),
      handleRunCollection: noop,
      handleLoadCollectionItem: noop,
      saveToColItem: null,
      activeTab: { id: 't1', query: '', variables: '{}', headers: [], operationType: 'query', modelUri: 'u', unsavedChanges: false },
      activeEnvironment: null,
      activityDividerProps: {},
      gqlSplitRef: ref,
      gqlLeftPaneRef: ref,
      editorPaneWidth: 600,
      gqlPaneDividerProps: {},
      bottomPanelDividerProps: {},
      bottomPanelHeight: 200,
      onSetBuilderMode: noop,
      onEditInEditor: noop,
      onBuilderExecute: noop,
      onQueryChange: noop,
      editorMountRef: ref,
      prettifyError: null,
      onPrettify: noop,
      insertToast: null,
      complexityWarningPending: false,
      complexityResult: null,
      onExecute: noop,
      onDismissComplexityWarning: noop,
      onAssertionsChange: noop,
      bottomTab: 'response',
      onSetBottomTab: noop,
      runnerCollectionId: null,
      runner: {} as never,
      varsModelPath: 'vars',
      varsError: null,
      onVariablesChange: noop,
      onHeadersChange: noop,
      globalEnvMap: {},
      fileEntries: [],
      onFileEntriesChange: noop,
      activeTabUploadProgress: null,
      storedAuthForPanel: null,
      resolvedAuthPreview: '',
      usesPageDefaultAuth: true,
      hasActiveTabAuthOverride: false,
      onAuthChange: noop,
      onResetAuthToInherit: noop,
      linkedProfileName: null,
      defaultAuthProfileId: null,
      rightView: 'response',
      onRightViewChange: noop,
      response: null,
      isActiveTabExecuting: false,
      execStatus: 'idle',
      schemaStatus: 'idle',
      schemaErrorMessage: null,
      onIntrospect: noop,
      introspecting: false,
      onInsertField: noop,
      snapshots: [],
      onSaveSnapshot: noop,
      onDeleteSnapshot: noop,
      onClearOlderSnapshots: noop,
      onOpenDiff: noop,
      deprecatedUsages: [],
      onOpenCollectionItem: noop,
      subscription: null,
      selectedOperation: null,
      assertionResultMap: new Map(),
      onExportSubscription: noop,
      onStopSubscription: noop,
      onResubscribeSubscription: noop,
      onOpenBatchResults: noop,
      batchExecutingOnActiveTab: false,
      onResponseSubTabChange: noop,
      onActivityTabChange: noop,
    },
    overlays: {} as never,
  };
}

describe('GraphqlStudioPageBody — coverage gaps', () => {
  it('defaults globalAuthProfiles to empty array when tabBar omits them', () => {
    render(<GraphqlStudioPageBody {...minimalProps()} />);
    const split = screen.getByTestId('split-workspace');
    expect(split.getAttribute('data-profiles')).toBe('[]');
  });

  it('applies builder mode class on gql-main', () => {
    render(<GraphqlStudioPageBody {...minimalProps({ builderMode: true })} />);
    expect(document.querySelector('.gql-main--builder')).toBeTruthy();
  });

  it('renders activity divider when activityTab is set', () => {
    render(<GraphqlStudioPageBody {...minimalProps({ activityTab: 'history' })} />);
    expect(screen.getByTestId('gql-activity-pane-divider')).toBeTruthy();
  });
});
