/**
 * GraphqlStudioSplitWorkspace — editor/builder column, bottom panel, and right pane
 * for the GraphQL Studio main workspace split.
 */
import { useCallback, useRef } from 'react';
import type { RefObject, MutableRefObject } from 'react';
import type {
  GraphqlAuth,
  GraphqlEnvironment,
  GraphqlResponse,
  GraphqlSchemaInfo,
  GraphqlSchemaSnapshot,
  GraphqlSubscriptionAssertion,
} from '../../../shared/types/graphql';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { SplitPaneDividerProps } from '../../../shared/hooks/useSplitPaneResize';
import type { VerticalSplitPaneDividerProps } from '../../../shared/hooks/useVerticalSplitPaneResize';
import { GraphqlEditor } from './GraphqlEditor';
import { GraphqlQueryBuilder } from './GraphqlQueryBuilder';
import { GraphqlSubscriptionAssertionPanel } from './GraphqlSubscriptionAssertionPanel';
import { GqlComplexityWarningBanner } from './GqlComplexityWarningBanner';
import { GraphqlCollectionRunnerPanel } from './GraphqlCollectionRunnerPanel';
import { GqlBottomPanel } from './GqlBottomPanel';
import { GqlRightPane } from './GqlRightPane';
import type { UseGraphqlCollectionRunnerResult } from '../hooks/useGraphqlCollectionRunner';
import type { UseGraphqlCollectionsResult } from '../hooks/useGraphqlCollections';
import type { UseGraphqlSubscriptionResult } from '../hooks/useGraphqlSubscription';
import type { GqlStudioTab } from '../utils/tabPersistence';
import { DEFAULT_VARS } from '../utils/tabPersistence';
import type { BuilderState } from '../hooks/useGraphqlQueryBuilder';
import { cloneBuilderState } from '../hooks/useGraphqlQueryBuilder';
import type { BottomPanelTab, BottomPanelTabExtended, RightPaneView } from '../graphqlStudioPageTypes';
import type { ComplexityResult } from '../utils/complexityEstimator';
import type { DeprecatedFieldUsage } from '../utils/deprecatedFieldScanner';
import type { FileEntry } from '../utils/multipartBuilder';
import type { MessageAssertionResults } from '../utils/subscriptionAssertions';

export interface GraphqlStudioSplitWorkspaceProps {
  gqlSplitRef: RefObject<HTMLDivElement | null>;
  gqlLeftPaneRef: RefObject<HTMLDivElement | null>;
  editorPaneWidth: number;
  gqlPaneDividerProps: SplitPaneDividerProps;
  bottomPanelDividerProps: VerticalSplitPaneDividerProps;
  bottomPanelHeight: number;
  builderMode: boolean;
  onSetBuilderMode: (builder: boolean) => void;
  schemaInfo: GraphqlSchemaInfo | null;
  onEditInEditor: (sdl: string, variablesJson: string) => void;
  onBuilderExecute: (sdl: string, variablesJson: string) => void;
  activeTab: GqlStudioTab;
  onQueryChange: (value: string) => void;
  editorMountRef: MutableRefObject<import('monaco-editor').editor.IStandaloneCodeEditor | null>;
  prettifyError: boolean;
  onPrettify: () => void;
  insertToast: string | null;
  complexityWarningPending: boolean;
  complexityResult: ComplexityResult | null;
  onExecute: () => void;
  onDismissComplexityWarning: () => void;
  onAssertionsChange: (assertions: GraphqlSubscriptionAssertion[]) => void;
  bottomTab: BottomPanelTabExtended;
  onSetBottomTab: (tab: BottomPanelTabExtended) => void;
  runnerCollectionId: string | null;
  runner: UseGraphqlCollectionRunnerResult;
  collections: UseGraphqlCollectionsResult;
  varsModelPath: string;
  varsError: string | null;
  onVariablesChange: (value: string) => void;
  onHeadersChange: (headers: GqlStudioTab['headers']) => void;
  activeEnvironment: GraphqlEnvironment | null;
  globalEnvMap: Record<string, string>;
  fileEntries: FileEntry[];
  onFileEntriesChange: (entries: FileEntry[]) => void;
  activeTabUploadProgress: number | null | undefined;
  storedAuthForPanel: GraphqlAuth | null | undefined;
  resolvedAuthPreview: string;
  usesPageDefaultAuth: boolean;
  hasActiveTabAuthOverride: boolean;
  onAuthChange: (auth: GraphqlAuth | null) => void;
  onResetAuthToInherit?: () => void;
  linkedProfileName: string | null;
  globalAuthProfiles: GlobalAuthProfile[];
  defaultAuthProfileId: string | null;
  rightView: RightPaneView;
  onRightViewChange: (view: RightPaneView) => void;
  response: GraphqlResponse | null;
  isActiveTabExecuting: boolean;
  execStatus: 'idle' | 'loading' | 'success' | 'error';
  schemaStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'introspection-disabled';
  schemaErrorMessage: string | null;
  onIntrospect: () => void;
  introspecting: boolean;
  onInsertField: (fieldName: string, fieldType: string, hasArgs: boolean) => void;
  snapshots: GraphqlSchemaSnapshot[];
  onSaveSnapshot: () => Promise<void>;
  onDeleteSnapshot: (id: string) => void;
  onClearOlderSnapshots: (keepCount?: number) => Promise<number>;
  onOpenDiff: (snapshot: GraphqlSchemaSnapshot, compareToId?: string) => void;
  deprecatedUsages: DeprecatedFieldUsage[];
  onOpenCollectionItem: (itemId: string) => void;
  subscription: UseGraphqlSubscriptionResult;
  selectedOperation: string | null | undefined;
  assertionResultMap: Map<string, MessageAssertionResults>;
  onExportSubscription: () => void;
  onStopSubscription: () => void;
  onResubscribeSubscription: () => void;
  onOpenBatchResults?: () => void;
  batchExecuting?: boolean;
}

export function GraphqlStudioSplitWorkspace({
  gqlSplitRef,
  gqlLeftPaneRef,
  editorPaneWidth,
  gqlPaneDividerProps,
  bottomPanelDividerProps,
  bottomPanelHeight,
  builderMode,
  onSetBuilderMode,
  schemaInfo,
  onEditInEditor,
  onBuilderExecute,
  activeTab,
  onQueryChange,
  editorMountRef,
  prettifyError,
  onPrettify,
  insertToast,
  complexityWarningPending,
  complexityResult,
  onExecute,
  onDismissComplexityWarning,
  onAssertionsChange,
  bottomTab,
  onSetBottomTab,
  runnerCollectionId,
  runner,
  collections,
  varsModelPath,
  varsError,
  onVariablesChange,
  onHeadersChange,
  activeEnvironment,
  globalEnvMap,
  fileEntries,
  onFileEntriesChange,
  activeTabUploadProgress,
  storedAuthForPanel,
  resolvedAuthPreview,
  usesPageDefaultAuth,
  hasActiveTabAuthOverride,
  onAuthChange,
  onResetAuthToInherit,
  linkedProfileName,
  globalAuthProfiles,
  defaultAuthProfileId,
  rightView,
  onRightViewChange,
  response,
  isActiveTabExecuting,
  execStatus,
  schemaStatus,
  schemaErrorMessage,
  onIntrospect,
  introspecting,
  onInsertField,
  snapshots,
  onSaveSnapshot,
  onDeleteSnapshot,
  onClearOlderSnapshots,
  onOpenDiff,
  deprecatedUsages,
  onOpenCollectionItem,
  subscription,
  selectedOperation,
  assertionResultMap,
  onExportSubscription,
  onStopSubscription,
  onResubscribeSubscription,
  onOpenBatchResults,
  batchExecuting = false,
}: GraphqlStudioSplitWorkspaceProps) {
  const runnerTree = runnerCollectionId
    ? collections.trees.find((t) => t.collection.id === runnerCollectionId)
    : undefined;

  /** Per-tab builder selection model — survives Editor ↔ Builder toggles. */
  const builderStateByTabRef = useRef<Map<string, BuilderState>>(new Map());
  const handleBuilderStateChange = useCallback(
    (state: BuilderState) => {
      builderStateByTabRef.current.set(activeTab.id, cloneBuilderState(state));
    },
    [activeTab.id],
  );
  const savedBuilderState = builderStateByTabRef.current.get(activeTab.id);

  return (
    <div
      className={`gql-studio-workspace${builderMode ? ' gql-studio-workspace--builder' : ''}`}
      ref={gqlSplitRef}
      data-testid="gql-studio-workspace"
    >
      <div
        className="gql-left-pane"
        ref={gqlLeftPaneRef}
        style={builderMode ? undefined : { width: editorPaneWidth, flexShrink: 0 }}
      >
        <div className="gql-editor-mode-bar" data-testid="gql-editor-mode-bar">
          <div className="gql-mode-toggle" role="group" aria-label="Edit mode">
            <button
              type="button"
              className={`gql-mode-btn${!builderMode ? ' gql-mode-btn--active' : ''}`}
              onClick={() => onSetBuilderMode(false)}
              aria-pressed={!builderMode}
              data-testid="gql-mode-editor"
            >
              Editor
            </button>
            <button
              type="button"
              className={`gql-mode-btn${builderMode ? ' gql-mode-btn--active' : ''}`}
              onClick={() => onSetBuilderMode(true)}
              aria-pressed={builderMode}
              data-testid="gql-mode-builder"
              title={schemaInfo ? undefined : 'Introspect a schema to use the builder'}
            >
              Builder
            </button>
          </div>
        </div>

        <div
          className={`gql-mode-pane gql-mode-pane--builder${builderMode ? '' : ' gql-mode-pane--hidden'}`}
          aria-hidden={!builderMode}
        >
          <GraphqlQueryBuilder
            key={activeTab.id}
            schemaInfo={schemaInfo}
            initialState={savedBuilderState}
            onStateChange={handleBuilderStateChange}
            onEditInEditor={onEditInEditor}
            onExecute={onBuilderExecute}
          />
        </div>

        <div
          className={`gql-mode-pane gql-mode-pane--editor${builderMode ? ' gql-mode-pane--hidden' : ''}`}
          aria-hidden={builderMode}
        >
          <div className="gql-editor-pane" data-testid="gql-editor-pane">
            <GraphqlEditor
              modelPath={activeTab.modelUri}
              defaultValue={activeTab.query}
              onChange={onQueryChange}
              height="100%"
              data-testid="gql-editor"
              editorMountRef={editorMountRef}
            />
            <button
              type="button"
              className={`gql-prettify-btn${prettifyError ? ' gql-prettify-btn--error' : ''}`}
              onClick={onPrettify}
              aria-label={prettifyError ? 'Fix syntax errors before formatting' : 'Prettify / format query'}
              title={prettifyError ? 'Cannot format — fix syntax errors first' : 'Prettify / format query'}
              data-testid="gql-prettify-btn"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
                <line x1="16" y1="8" x2="2" y2="22" />
                <line x1="17.5" y1="15" x2="9" y2="15" />
              </svg>
              Prettify
            </button>
          </div>

          {insertToast && (
            <div className="gql-insert-toast" role="status" aria-live="polite" data-testid="gql-insert-toast">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              {insertToast}
            </div>
          )}

          {activeTab.operationType === 'subscription' && (
            <GraphqlSubscriptionAssertionPanel
              assertions={activeTab.subscriptionAssertions ?? []}
              onChange={onAssertionsChange}
            />
          )}

          <GqlComplexityWarningBanner
            visible={complexityWarningPending}
            complexityResult={complexityResult}
            onConfirm={onExecute}
            onDismiss={onDismissComplexityWarning}
          />

          {bottomTab === 'runner' && runnerCollectionId ? (
            <>
              <div
                className="gql-bottom-panel-divider"
                data-testid="gql-bottom-panel-divider"
                {...bottomPanelDividerProps}
              />
              <GraphqlCollectionRunnerPanel
                runner={runner}
                items={runnerTree?.items ?? []}
                collectionName={runnerTree?.collection.name ?? 'Collection'}
                onClose={() => onSetBottomTab('variables')}
              />
            </>
          ) : (
            <>
              <div
                className="gql-bottom-panel-divider"
                data-testid="gql-bottom-panel-divider"
                {...bottomPanelDividerProps}
              />
              <div className="gql-bottom-panel-container" style={{ height: bottomPanelHeight }}>
                <GqlBottomPanel
                  activeTab={(bottomTab === 'runner' ? 'variables' : bottomTab) as BottomPanelTab}
                  onTabChange={(tab) => onSetBottomTab(tab as BottomPanelTabExtended)}
                  varsModelPath={varsModelPath}
                  defaultVarsValue={activeTab.variables ?? DEFAULT_VARS}
                  onVariablesChange={onVariablesChange}
                  varsError={varsError}
                  headers={activeTab.headers}
                  onHeadersChange={onHeadersChange}
                  activeEnvironment={activeEnvironment}
                  globalEnvMap={globalEnvMap}
                  fileEntries={fileEntries}
                  onFileEntriesChange={onFileEntriesChange}
                  uploadProgress={activeTabUploadProgress}
                  storedAuth={storedAuthForPanel}
                  resolvedAuthPreview={resolvedAuthPreview}
                  authScope={usesPageDefaultAuth ? 'page' : 'tab'}
                  hasAuthOverride={hasActiveTabAuthOverride}
                  onAuthChange={onAuthChange}
                  onResetAuthToInherit={usesPageDefaultAuth ? undefined : onResetAuthToInherit}
                  linkedProfileName={linkedProfileName}
                  globalAuthProfiles={globalAuthProfiles}
                  defaultAuthProfileId={defaultAuthProfileId}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {!builderMode && (
        <>
          <div
            className="gql-pane-divider"
            data-testid="gql-pane-divider"
            {...gqlPaneDividerProps}
          />
          <GqlRightPane
            view={rightView}
            onViewChange={onRightViewChange}
            response={response}
            executing={isActiveTabExecuting}
            execStatus={execStatus}
            schemaInfo={schemaInfo}
            schemaStatus={schemaStatus}
            schemaErrorMessage={schemaErrorMessage}
            onIntrospect={onIntrospect}
            introspecting={introspecting}
            activeOperationType={activeTab.operationType ?? null}
            onInsertField={onInsertField}
            snapshots={snapshots}
            onSaveSnapshot={onSaveSnapshot}
            onDeleteSnapshot={onDeleteSnapshot}
            onClearOlderSnapshots={onClearOlderSnapshots}
            onOpenDiff={onOpenDiff}
            deprecatedUsages={deprecatedUsages}
            onOpenCollectionItem={onOpenCollectionItem}
            onOpenBatchResults={onOpenBatchResults}
            batchExecuting={batchExecuting}
            subscriptionLog={
              activeTab.operationType === 'subscription' && subscription.state !== 'idle'
                ? {
                    state: subscription.state,
                    messages: subscription.messages,
                    stats: subscription.stats,
                    connectedSince: subscription.connectedSince,
                    isPaused: subscription.isPaused,
                    pausedBufferCount: subscription.pausedBufferCount,
                    errorMessage: subscription.errorMessage,
                    reconnectAttempt: subscription.reconnectAttempt,
                    transport: subscription.transport,
                    operationName: selectedOperation ?? activeTab.label,
                    assertions: activeTab.subscriptionAssertions,
                    assertionResultMap,
                    onPause: subscription.pause,
                    onResume: subscription.resume,
                    onClear: subscription.clear,
                    onExport: onExportSubscription,
                    onStop: onStopSubscription,
                    onResubscribe: onResubscribeSubscription,
                  }
                : null
            }
          />
        </>
      )}
    </div>
  );
}
