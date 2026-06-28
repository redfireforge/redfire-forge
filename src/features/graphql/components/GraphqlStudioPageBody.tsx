/**
 * GraphqlStudioPageBody — render tree for GraphQL Studio main page.
 * Extracted from GraphqlStudioPage.tsx to keep the page component under 900 lines.
 */
import type { ComponentProps, ReactNode } from 'react';
import { GqlTabBar } from './GqlTabBar';
import { GraphqlStudioActivityBar } from './GraphqlStudioActivityBar';
import { GraphqlStudioPageToolbar } from './GraphqlStudioPageToolbar';
import { GraphqlStudioDemoBridges } from './GraphqlStudioDemoBridges';
import { GraphqlStudioPageOverlays } from './GraphqlStudioPageOverlays';
import { GraphqlStudioLeftActivityPanel } from './GraphqlStudioLeftActivityPanel';
import { GraphqlStudioSplitWorkspace } from './GraphqlStudioSplitWorkspace';
import type { SplitPaneDividerProps } from '../../../shared/hooks/useSplitPaneResize';
import type { GraphqlStudioPageToolbarSections } from '../utils/graphqlStudioPageToolbarProps';

type DemoBridgesProps = ComponentProps<typeof GraphqlStudioDemoBridges>;
type TabBarProps = ComponentProps<typeof GqlTabBar>;
type OverlaysProps = ComponentProps<typeof GraphqlStudioPageOverlays>;

export interface GraphqlStudioPageMainProps {
  builderMode: boolean;
  activityTab: Parameters<typeof GraphqlStudioActivityBar>[0]['activeTab'];
  gqlActivitySplitRef: React.RefObject<HTMLDivElement | null>;
  activityPanelWidth: number;
  history: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['history'];
  historyMaxItems: number;
  handleHistoryMaxItemsChange: (max: number) => void;
  tabSchemaConnectionId: string | null;
  handleLoadHistoryItem: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['handleLoadHistoryItem'];
  handleRunHistoryItem: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['handleRunHistoryItem'];
  setSaveToColItem: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['setSaveToColItem'];
  mockServer: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['mockServer'];
  schemaInfo: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['schemaInfo'];
  collections: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['collections'];
  invalidItemIds: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['invalidItemIds'];
  handleRunCollection: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['handleRunCollection'];
  handleLoadCollectionItem: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['handleLoadCollectionItem'];
  saveToColItem: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['saveToColItem'];
  activeTab: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['activeTab'];
  activeEnvironment: ComponentProps<typeof GraphqlStudioLeftActivityPanel>['activeEnvironment'];
  activityDividerProps: SplitPaneDividerProps;
  gqlSplitRef: React.RefObject<HTMLDivElement | null>;
  gqlLeftPaneRef: React.RefObject<HTMLDivElement | null>;
  editorPaneWidth: number;
  gqlPaneDividerProps: ComponentProps<typeof GraphqlStudioSplitWorkspace>['gqlPaneDividerProps'];
  bottomPanelDividerProps: ComponentProps<typeof GraphqlStudioSplitWorkspace>['bottomPanelDividerProps'];
  bottomPanelHeight: number;
  onSetBuilderMode: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onSetBuilderMode'];
  onEditInEditor: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onEditInEditor'];
  onBuilderExecute: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onBuilderExecute'];
  onQueryChange: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onQueryChange'];
  editorMountRef: ComponentProps<typeof GraphqlStudioSplitWorkspace>['editorMountRef'];
  prettifyError: ComponentProps<typeof GraphqlStudioSplitWorkspace>['prettifyError'];
  onPrettify: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onPrettify'];
  insertToast: ComponentProps<typeof GraphqlStudioSplitWorkspace>['insertToast'];
  complexityWarningPending: ComponentProps<typeof GraphqlStudioSplitWorkspace>['complexityWarningPending'];
  complexityResult: ComponentProps<typeof GraphqlStudioSplitWorkspace>['complexityResult'];
  onExecute: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onExecute'];
  onDismissComplexityWarning: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onDismissComplexityWarning'];
  onAssertionsChange: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onAssertionsChange'];
  bottomTab: ComponentProps<typeof GraphqlStudioSplitWorkspace>['bottomTab'];
  onSetBottomTab: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onSetBottomTab'];
  runnerCollectionId: ComponentProps<typeof GraphqlStudioSplitWorkspace>['runnerCollectionId'];
  runner: ComponentProps<typeof GraphqlStudioSplitWorkspace>['runner'];
  varsModelPath: string;
  varsError: ComponentProps<typeof GraphqlStudioSplitWorkspace>['varsError'];
  onVariablesChange: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onVariablesChange'];
  onHeadersChange: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onHeadersChange'];
  globalEnvMap: ComponentProps<typeof GraphqlStudioSplitWorkspace>['globalEnvMap'];
  fileEntries: ComponentProps<typeof GraphqlStudioSplitWorkspace>['fileEntries'];
  onFileEntriesChange: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onFileEntriesChange'];
  activeTabUploadProgress: ComponentProps<typeof GraphqlStudioSplitWorkspace>['activeTabUploadProgress'];
  storedAuthForPanel: ComponentProps<typeof GraphqlStudioSplitWorkspace>['storedAuthForPanel'];
  resolvedAuthPreview: ComponentProps<typeof GraphqlStudioSplitWorkspace>['resolvedAuthPreview'];
  usesPageDefaultAuth: ComponentProps<typeof GraphqlStudioSplitWorkspace>['usesPageDefaultAuth'];
  hasActiveTabAuthOverride: ComponentProps<typeof GraphqlStudioSplitWorkspace>['hasActiveTabAuthOverride'];
  onAuthChange: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onAuthChange'];
  onResetAuthToInherit: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onResetAuthToInherit'];
  linkedProfileName: ComponentProps<typeof GraphqlStudioSplitWorkspace>['linkedProfileName'];
  defaultAuthProfileId: ComponentProps<typeof GraphqlStudioSplitWorkspace>['defaultAuthProfileId'];
  rightView: ComponentProps<typeof GraphqlStudioSplitWorkspace>['rightView'];
  onRightViewChange: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onRightViewChange'];
  response: ComponentProps<typeof GraphqlStudioSplitWorkspace>['response'];
  isActiveTabExecuting: ComponentProps<typeof GraphqlStudioSplitWorkspace>['isActiveTabExecuting'];
  execStatus: ComponentProps<typeof GraphqlStudioSplitWorkspace>['execStatus'];
  schemaStatus: ComponentProps<typeof GraphqlStudioSplitWorkspace>['schemaStatus'];
  schemaErrorMessage: ComponentProps<typeof GraphqlStudioSplitWorkspace>['schemaErrorMessage'];
  onIntrospect: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onIntrospect'];
  introspecting: ComponentProps<typeof GraphqlStudioSplitWorkspace>['introspecting'];
  onInsertField: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onInsertField'];
  snapshots: ComponentProps<typeof GraphqlStudioSplitWorkspace>['snapshots'];
  onSaveSnapshot: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onSaveSnapshot'];
  onDeleteSnapshot: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onDeleteSnapshot'];
  onClearOlderSnapshots: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onClearOlderSnapshots'];
  onOpenDiff: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onOpenDiff'];
  deprecatedUsages: ComponentProps<typeof GraphqlStudioSplitWorkspace>['deprecatedUsages'];
  onOpenCollectionItem: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onOpenCollectionItem'];
  subscription: ComponentProps<typeof GraphqlStudioSplitWorkspace>['subscription'];
  selectedOperation: ComponentProps<typeof GraphqlStudioSplitWorkspace>['selectedOperation'];
  assertionResultMap: ComponentProps<typeof GraphqlStudioSplitWorkspace>['assertionResultMap'];
  onExportSubscription: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onExportSubscription'];
  onStopSubscription: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onStopSubscription'];
  onResubscribeSubscription: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onResubscribeSubscription'];
  onOpenBatchResults: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onOpenBatchResults'];
  batchExecutingOnActiveTab: boolean;
  onResponseSubTabChange: ComponentProps<typeof GraphqlStudioSplitWorkspace>['onResponseSubTabChange'];
  onActivityTabChange: Parameters<typeof GraphqlStudioActivityBar>[0]['onTabChange'];
}

export interface GraphqlStudioPageBodyProps {
  demoBridges: DemoBridgesProps;
  executionLayers: ReactNode;
  toolbarSections: GraphqlStudioPageToolbarSections;
  tabBar: TabBarProps;
  main: GraphqlStudioPageMainProps;
  overlays: OverlaysProps;
}

export function GraphqlStudioPageBody({
  demoBridges,
  executionLayers,
  toolbarSections,
  tabBar,
  main,
  overlays,
}: GraphqlStudioPageBodyProps) {
  const {
    builderMode,
    activityTab,
    gqlActivitySplitRef,
    activityPanelWidth,
    history,
    historyMaxItems,
    handleHistoryMaxItemsChange,
    tabSchemaConnectionId,
    handleLoadHistoryItem,
    handleRunHistoryItem,
    setSaveToColItem,
    mockServer,
    schemaInfo,
    collections,
    invalidItemIds,
    handleRunCollection,
    handleLoadCollectionItem,
    saveToColItem,
    activeTab,
    activeEnvironment,
    activityDividerProps,
    gqlSplitRef,
    gqlLeftPaneRef,
    editorPaneWidth,
    gqlPaneDividerProps,
    bottomPanelDividerProps,
    bottomPanelHeight,
    onSetBuilderMode,
    onEditInEditor,
    onBuilderExecute,
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
    varsModelPath,
    varsError,
    onVariablesChange,
    onHeadersChange,
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
    batchExecutingOnActiveTab,
    onResponseSubTabChange,
    onActivityTabChange,
  } = main;

  return (
    <div className="gql-studio" data-testid="gql-studio-page">
      <GraphqlStudioDemoBridges {...demoBridges} />
      {executionLayers}
      <GraphqlStudioPageToolbar {...toolbarSections} />

      <GqlTabBar {...tabBar} />

      <div className={`gql-main${builderMode ? ' gql-main--builder' : ''} gql-main--with-activity`} data-testid="gql-main">
        <GraphqlStudioActivityBar activeTab={activityTab} onTabChange={onActivityTabChange} />

        <div className="gql-main-body" ref={gqlActivitySplitRef} data-testid="gql-main-body">
          <GraphqlStudioLeftActivityPanel
            activityTab={activityTab}
            activityPanelWidth={activityPanelWidth}
            history={history}
            historyMaxItems={historyMaxItems}
            onHistoryMaxItemsChange={handleHistoryMaxItemsChange}
            tabSchemaConnectionId={tabSchemaConnectionId}
            handleLoadHistoryItem={handleLoadHistoryItem}
            handleRunHistoryItem={handleRunHistoryItem}
            setSaveToColItem={setSaveToColItem}
            mockServer={mockServer}
            schemaInfo={schemaInfo}
            collections={collections}
            invalidItemIds={invalidItemIds}
            handleRunCollection={handleRunCollection}
            handleLoadCollectionItem={handleLoadCollectionItem}
            saveToColItem={saveToColItem}
            activeTab={activeTab}
            activeEnvironment={activeEnvironment}
          />

          {activityTab && (
            <div
              className="gql-activity-pane-divider"
              {...activityDividerProps}
              data-testid="gql-activity-pane-divider"
            />
          )}

          <GraphqlStudioSplitWorkspace
            gqlSplitRef={gqlSplitRef}
            gqlLeftPaneRef={gqlLeftPaneRef}
            editorPaneWidth={editorPaneWidth}
            gqlPaneDividerProps={gqlPaneDividerProps}
            bottomPanelDividerProps={bottomPanelDividerProps}
            bottomPanelHeight={bottomPanelHeight}
            builderMode={builderMode}
            onSetBuilderMode={onSetBuilderMode}
            schemaInfo={schemaInfo}
            onEditInEditor={onEditInEditor}
            onBuilderExecute={onBuilderExecute}
            activeTab={activeTab}
            onQueryChange={onQueryChange}
            editorMountRef={editorMountRef}
            prettifyError={prettifyError}
            onPrettify={onPrettify}
            insertToast={insertToast}
            complexityWarningPending={complexityWarningPending}
            complexityResult={complexityResult}
            onExecute={onExecute}
            onDismissComplexityWarning={onDismissComplexityWarning}
            onAssertionsChange={onAssertionsChange}
            bottomTab={bottomTab}
            onSetBottomTab={onSetBottomTab}
            runnerCollectionId={runnerCollectionId}
            runner={runner}
            collections={collections}
            varsModelPath={varsModelPath}
            varsError={varsError}
            onVariablesChange={onVariablesChange}
            onHeadersChange={onHeadersChange}
            activeEnvironment={activeEnvironment}
            globalEnvMap={globalEnvMap}
            fileEntries={fileEntries}
            onFileEntriesChange={onFileEntriesChange}
            activeTabUploadProgress={activeTabUploadProgress}
            storedAuthForPanel={storedAuthForPanel}
            resolvedAuthPreview={resolvedAuthPreview}
            usesPageDefaultAuth={usesPageDefaultAuth}
            hasActiveTabAuthOverride={hasActiveTabAuthOverride}
            onAuthChange={onAuthChange}
            onResetAuthToInherit={onResetAuthToInherit}
            linkedProfileName={linkedProfileName}
            globalAuthProfiles={tabBar.globalAuthProfiles ?? []}
            defaultAuthProfileId={defaultAuthProfileId}
            rightView={rightView}
            onRightViewChange={onRightViewChange}
            response={response}
            isActiveTabExecuting={isActiveTabExecuting}
            execStatus={execStatus}
            schemaStatus={schemaStatus}
            schemaErrorMessage={schemaErrorMessage}
            onIntrospect={onIntrospect}
            introspecting={introspecting}
            onInsertField={onInsertField}
            snapshots={snapshots}
            onSaveSnapshot={onSaveSnapshot}
            onDeleteSnapshot={onDeleteSnapshot}
            onClearOlderSnapshots={onClearOlderSnapshots}
            onOpenDiff={onOpenDiff}
            deprecatedUsages={deprecatedUsages}
            onOpenCollectionItem={onOpenCollectionItem}
            subscription={subscription}
            selectedOperation={selectedOperation}
            assertionResultMap={assertionResultMap}
            onExportSubscription={onExportSubscription}
            onStopSubscription={onStopSubscription}
            onResubscribeSubscription={onResubscribeSubscription}
            onOpenBatchResults={onOpenBatchResults}
            batchExecuting={batchExecutingOnActiveTab}
            onResponseSubTabChange={onResponseSubTabChange}
          />
        </div>
      </div>

      <GraphqlStudioPageOverlays {...overlays} />
    </div>
  );
}
