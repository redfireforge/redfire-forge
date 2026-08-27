/** Typed access to demo bridge functions mounted on `window` by App shell hooks. */

import type { GlobalAuthProfile } from '@shared/types';
import type { GqlTlsSettings } from '@shared/types/gqlTls';
import type { GrpcGrpcurlExportContext } from '@grpc/utils/grpcGrpcurlTypes';

export type DemoBridgeWindow = Window &
  typeof globalThis & {
    __demoPatchGrpcActiveTab?: (patch: { grpcurlExportContext?: GrpcGrpcurlExportContext }) => boolean;
    __demoResetGrpcActiveTab?: () => boolean;
    /** Reset Manage Schemas draft state without opening the modal. */
    __demoResetGrpcManageSchemasDrafts?: () => boolean;
    __demoGetGrpcActiveDescriptorKey?: () => string | null;
    __demoCollapseAppSidebar?: () => void;
    __demoExpandAppSidebar?: () => void;
    __demoBeginAppSidebarSession?: () => void;
    __demoEndAppSidebarSession?: () => void;
    __demoUpsertGlobalAuthProfile?: (profile: GlobalAuthProfile) => void;
    __demoPurgeGlobalAuthProfiles?: (names: string[], ids: string[]) => void;
    /** Clear per-tab auth override without opening the Auth panel (lesson setup). */
    __demoClearActiveTabAuth?: () => boolean;
    __demoUpsertGqlEnv?: (name: string, envVars: Array<{ key: string; value: string; masked?: boolean }>) => void;
    __demoApplyGqlTlsSettings?: (patch: Partial<GqlTlsSettings>) => void;
    __demoSetGqlQuery?: (query: string) => void;
    __demoSetGqlRightView?: (view: 'response' | 'schema') => void;
    __demoGqlModalLockState?: { envAllowed: boolean; profileAllowed: boolean };
    __demoSetGqlModalLock?: (lock: { envAllowed: boolean; profileAllowed: boolean }) => void;
    __demoOpenGqlProfileModal?: () => boolean;
    __demoDeleteGqlEnvByName?: (name: string) => void;
    __demoUpsertWorkspaceDefaults?: (patch: Record<string, string>) => void;
    __demoRemoveWorkspaceDefaults?: (keys: string[]) => void;
    __demoResetGqlBatchDetection?: () => boolean;
    __wfDeleteByName?: (name: string) => void;
    /** Fit the Results Explorer replay canvas to all nodes (demo lessons). */
    __reExplorerFitView?: () => boolean;
    __wfInsertWorkflow?: (wf: Record<string, unknown>) => void;
    __wfGetWorkflowByName?: (name: string) => unknown;
    __wfSelectByName?: (name: string) => boolean;
    /** Dismiss Gallery sample preview so the real selected workflow paints on the canvas. */
    __wfClearSamplePreview?: () => void;
    /** Select workflow in Workflow Runner (Test Harness) by display name — fixes stale persisted IDs after re-seed. */
    __wfRunnerSelectByName?: (name: string) => boolean;
    /** Apply workflow selection directly in Workflow Runner (bypasses initialWorkflowId race). */
    __wfRunnerApplySelection?: (name: string) => boolean;
    /** Invoke Workflow Runner handleRun directly (demo lesson fallback when DOM click is ignored). */
    __wfRunnerTriggerRun?: () => boolean;
    /** Select workflow by name and start run atomically (avoids stale React closure). */
    __wfRunnerSelectAndRun?: (name: string) => boolean;
    /** Force batch execution mode with iterations/concurrency via React state (demo lessons). */
    __wfRunnerApplyBatchConfig?: (iterations: number, concurrency: number, traceLevel?: import('@shared/types').TraceCaptureLevel) => boolean;
    __wfPatchWorkflowByName?: (
      name: string,
      patch: Record<string, unknown>,
    ) => boolean;
    __wfSyncLiveWorkflowFromPatch?: (
      workflowName: string,
      patch: Record<string, unknown>,
    ) => boolean;
    __wfGetSelectedName?: () => string | undefined;
    __wfWorkflowsLoaded?: boolean;
    __wfOpenNodeConfig?: (nodeId: string) => void;
    __wfFitView?: (opts?: {
      padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
      maxZoom?: number;
      minZoom?: number;
      duration?: number;
    }) => boolean;
    __wfDeselectAll?: () => void;
    __wfSetConsoleFloatLayout?: () => void;
    __wfConnect?: (
      sourceId: string,
      targetId: string,
      sourceHandle?: string | null,
      targetHandle?: string | null,
    ) => void;
    __wfRemoveEdge?: (sourceId: string, targetId: string) => void;
    __wfPatchNodeDataByType?: (nodeType: string, patch: Record<string, unknown>) => boolean;
    __wfPatchNodeDataById?: (nodeId: string, patch: Record<string, unknown>) => boolean;
    __wfResetRunState?: () => boolean;
    __wfAddNode?: {
      (type: string): string | undefined;
      (type: string, id: string, label: string, position: { x: number; y: number }): void;
    };
    __wfQuickTest?: () => void;
    __wfCloseConfigModal?: () => void;
    /**
     * Parse HAR JSON text and open the Workflow Designer HAR import preview modal —
     * avoids driving the native OS file picker, which cannot be automated.
     * Used by the `wf-har-import` demo lesson.
     */
    __wfTriggerHarImport?: (harText: string, fileName?: string) => void;
    __demoSeedHarnessTarget?: () => { envId: string; svcId: string } | null;
    __demoSeedFeatureGroup?: (fg: Record<string, unknown>) => void;
    __demoSelectEnvSvc?: (envId: string, svcId: string) => void;
    /** Seed a TestRun into storage (for Results Dashboard demos). */
    __demoSeedTestRun?: (run: Record<string, unknown>) => Promise<void>;
    /** Delete TestRuns whose IDs start with the given prefix (demo cleanup). */
    __demoDeleteTestRuns?: (prefix: string) => Promise<void>;
    /** True when any stored TestRun ID starts with the given prefix. */
    __demoHasTestRuns?: (prefix: string) => Promise<boolean>;
    /** Seed a Swagger 2.0 spec as a Catalog entry (idempotent by name). Returns the entry id. */
    __demoSeedCatalogSwagger2?: (name: string, rawSpec: string) => Promise<string | null>;
    /** Remove a Catalog entry by display name (demo cleanup). */
    __demoDeleteCatalogByName?: (name: string) => void;
    /** Select a Catalog entry by display name. Returns false when absent. */
    __demoSelectCatalogByName?: (name: string) => boolean;
    /** Add a new version to an existing Catalog entry (by name). Returns true on success. */
    __demoAddVersionByName?: (name: string, rawSpec: string) => Promise<boolean>;
    /** Look up a Catalog entry by display name. Returns the entry object or null. */
    __demoGetCatalogEntryByName?: (name: string) => Record<string, unknown> | null;
    /**
     * Quietly publish a Catalog endpoint (by entry name + method + path) for Workflow Designer.
     * Data-layer only — no Catalog tab / publish modal. Returns false when entry/endpoint missing.
     */
    __demoPublishCatalogEndpoint?: (entryName: string, method: string, path: string) => boolean;
    /** True once the Catalog store has hydrated from storage. */
    __demoCatalogLoaded?: boolean;
    /** Ensure a Settings environment exists by name; returns its ID. */
    __demoEnsureSettingsEnv?: (name: string) => string;
    /** Remove a Settings environment by name (demo cleanup). */
    __demoRemoveSettingsEnv?: (name: string) => void;
    /** Ensure a Settings microservice exists by name; optionally set base URLs. Returns its ID. */
    __demoEnsureSettingsSvc?: (name: string, baseUrls?: Record<string, string>) => string;
    /** Remove a Settings microservice by name (demo cleanup). */
    __demoRemoveSettingsSvc?: (name: string) => void;
    /**
     * Quietly clear protocol tabs / endpoints / global vars on a named Settings
     * microservice (demo lesson boot). Returns false when the svc is missing.
     */
    __demoResetSettingsSvcProtocols?: (
      name: string,
      options?: { clearProtocols?: boolean; clearGlobalVars?: boolean },
    ) => boolean;
    /** Delete all feature groups whose name matches (demo cleanup). */
    __demoDeleteFeatureGroupsByName?: (name: string) => void;
    __demoDeleteScenariosByName?: (name: string) => void;
    /** Seed shared data sources (idempotent — skips existing IDs). */
    __demoSeedSharedDataSources?: (sources: Array<Record<string, unknown>>) => void;
    /** Delete shared data sources whose name matches (demo cleanup). */
    __demoDeleteSharedDataSourcesByName?: (name: string) => void;
    /** Delete all request collections whose name matches exactly (demo cleanup). Returns count deleted. */
    __demoDeleteCollectionsByName?: (name: string) => number;
    /** Quiet seed of a Requests collection (idempotent by name). Returns the collection id. */
    __demoSeedRequestCollection?: (
      name: string,
      requests: Array<{ id?: string; name: string; method: string; url: string; body?: string }>,
    ) => string | null;
    /** Remove all workflow preview endpoints from storage (demo cleanup). */
    __demoClearAllWorkflowPreviews?: () => Promise<void>;
    /** Delete a Kafka cluster by ID (demo lesson cleanup). */
    __demoDeleteKafkaClusterById?: (clusterId: string) => void;
    /** Delete a Kafka cluster by display name (demo lesson cleanup). */
    __demoDeleteKafkaClusterByName?: (name: string) => void;
    /** Clear all Kafka clusters + disconnect (quiet Quick Start prep — no UI delete flash). */
    __demoClearAllKafkaClusters?: () => void;
    /** Upsert Demo Cluster (`demo-cluster` @ 127.0.0.1:19092) into React state (quiet Publish prep). */
    __demoEnsurePlaintextKafkaCluster?: () => void;
    /** Sync React connection snapshot after a quiet API connect (avoids Settings UI tour). */
    __demoMarkKafkaConnected?: (clusterId: string) => void;
    /**
     * Remove Kafka publish/consume templates by name (quiet demo setup/cleanup).
     * Updates React state when Message Studio is mounted; no-op otherwise.
     */
    __demoRemoveKafkaTemplatesByName?: (names: string[]) => Promise<void>;
    /** Clear all WebSocket Saved connection profiles (quiet demo setup). */
    __demoClearWsProfiles?: () => Promise<void>;
    /** Clear all WebSocket message templates (quiet demo setup). */
    __demoClearWsTemplates?: () => Promise<void>;
    /**
     * Quietly replace the WS connection tab bar with the given labels
     * (no add/rename UI flash — used by Power User / tab lessons).
     */
    __demoSeedWsConnectionTabs?: (labels: string[]) => boolean;
    /**
     * Quiet Secure WebSocket lesson prep — Client/Connect/Events, single tab,
     * reset TLS/auth/headers/URL without flashing the TLS bar or modal.
     */
    __demoPrepareWsTlsLesson?: () => boolean;
    /**
     * Apply WebSocket Studio TLS config on the active tab (skip-cert / CA / mTLS PEMs)
     * without fighting controlled inputs in the TLS modal.
     */
    __demoApplyWsTlsConfig?: (patch: {
      rejectUnauthorized?: boolean;
      caCert?: string;
      clientCert?: string;
      clientKey?: string;
    }) => void;
    /** Wipe API Mock Studio workspace + stop orphan listeners (quiet demo setup). */
    __demoWipeApiMockWorkspace?: () => Promise<boolean>;
    /** Restore the user mock library captured before a lesson wipe. */
    __demoRestoreApiMockUserWorkspace?: () => Promise<boolean>;
    /** Live Studio mock library (ids are remapped on gallery import). */
    __demoListApiMockServers?: () => Promise<Array<{
      id: string;
      name: string;
      port: number;
      active: boolean;
    }>>;
    /** Quiet Gallery → Studio import by sample id (`am-gallery-health`, …). */
    __demoImportApiMockGallerySample?: (sampleId: string) => Promise<boolean>;
    /** Ensure an empty mock server is open (no rules). Used by import lessons. */
    __demoEnsureBlankApiMockServer?: () => Promise<boolean>;
    /** Quiet TLS key + sensitive variable so export redaction has something to strip. */
    __demoSeedApiMockExportSecrets?: () => Promise<boolean>;
    /**
     * Patch the active mock route Match path / priority / Response body from React state
     * (Monaco body is not a plain input — demos must not ctx.fill it). The matcher kind
     * is re-inferred from `path` unless `pathKind` pins it (regex is never inferable).
     */
    __demoPatchApiMockActiveRoute?: (patch: {
      path?: string;
      pathKind?: 'exact' | 'parameterized' | 'glob' | 'regex';
      selectPath?: string;
      selectMethod?: string;
      method?: string;
      addRoute?: boolean;
      removeRoute?: boolean;
      enabled?: boolean;
      addVariant?: boolean;
      body?: string;
      contentType?: string;
      status?: number;
      reasonPhrase?: string;
      priority?: number;
      /** Replaces the whole Match group — condition steps rebuild it on replay. */
      predicates?: {
        id: string;
        combinator: 'all' | 'any' | 'not';
        children: unknown[];
      };
      behavior?: {
        delayMs?: number;
        jitterMs?: number;
        maxMatches?: number | null;
        expiresAt?: string | null;
        probability?: number | null;
        fault?: 'none' | 'timeout' | 'close' | 'reset' | 'malformed' | 'dribble';
        longRunningMs?: number | null;
        chunkSchedule?: Array<{ afterMs: number; body: string }> | null;
      };
    }) => boolean;
    /** Clear all saved Simulate samples on the active server (lesson replay). */
    __demoClearApiMockServerSamples?: () => boolean;
    /** Upsert saved Simulate samples by name (AM-24 WIDGET / MISSING / FLAKY suite). */
    __demoUpsertApiMockServerSamples?: (drafts: Array<{
      name: string;
      method: string;
      path: string;
      body?: string | null;
      contentType?: string;
      expected?: {
        outcome: 'matched' | 'unmatched' | 'ambiguous' | 'fault' | 'error' | 'proxied';
        status?: number;
        bodyContains?: string;
      };
    }>) => boolean;
    /** Quiet patch of the active server's selection policy (guards, not live beats). */
    __demoPatchApiMockServerSettings?: (patch: {
      multipleMatchPolicy?: 'highest_priority' | 'reject_multiple';
      equalPriorityPolicy?: 'specificity_then_id' | 'reject';
      ambiguityBody?: string;
      fallbackMode?: 'default_response' | 'closest_match_debug' | 'proxy';
      proxyEnabled?: boolean;
      proxyAllowlist?: string[];
      proxyBlockPrivate?: boolean;
      proxyForwardAuth?: boolean;
      proxyRecordDrafts?: boolean;
    }) => boolean;
    /**
     * Send a real request to a running mock server from inside the app (web: Vite
     * `/__proxy`, Tauri: native client) so lessons can show live traffic + journal rows.
     */
    __demoSendApiMockRequest?: (req?: {
      path?: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      serverId?: string;
      timeoutMs?: number;
    }) => Promise<{ status: number; body: string } | null>;
    /** E2E: jump to a step's reading phase (preAction only — skips action/verify). */
    __demoGoToStepReadingOnly?: (index: number) => Promise<void>;
    /** E2E: run action/verify for the current step from its reading phase. */
    __demoFinishStepFromReading?: () => Promise<void>;
  };

export function getDemoBridgeWindow(): DemoBridgeWindow {
  return window as DemoBridgeWindow;
}
