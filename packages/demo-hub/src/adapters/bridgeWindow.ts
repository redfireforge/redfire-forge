/** Typed access to demo bridge functions mounted on `window` by App shell hooks. */

import type { GlobalAuthProfile } from '@shared/types';
import type { GqlTlsSettings } from '@shared/types/gqlTls';
import type { GrpcGrpcurlExportContext } from '@grpc/utils/grpcGrpcurlTypes';

export type DemoBridgeWindow = Window &
  typeof globalThis & {
    __demoPatchGrpcActiveTab?: (patch: { grpcurlExportContext?: GrpcGrpcurlExportContext }) => boolean;
    __demoResetGrpcActiveTab?: () => boolean;
    __demoGetGrpcActiveDescriptorKey?: () => string | null;
    __demoCollapseAppSidebar?: () => void;
    __demoExpandAppSidebar?: () => void;
    __demoUpsertGlobalAuthProfile?: (profile: GlobalAuthProfile) => void;
    __demoPurgeGlobalAuthProfiles?: (names: string[], ids: string[]) => void;
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
    __demoSeedHarnessTarget?: () => { envId: string; svcId: string } | null;
    /** Seed a Swagger 2.0 spec as a Catalog entry (idempotent by name). Returns the entry id. */
    __demoSeedCatalogSwagger2?: (name: string, rawSpec: string) => Promise<string | null>;
    /** Remove a Catalog entry by display name (demo cleanup). */
    __demoDeleteCatalogByName?: (name: string) => void;
    /** Select a Catalog entry by display name. Returns false when absent. */
    __demoSelectCatalogByName?: (name: string) => boolean;
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
  };

export function getDemoBridgeWindow(): DemoBridgeWindow {
  return window as DemoBridgeWindow;
}
