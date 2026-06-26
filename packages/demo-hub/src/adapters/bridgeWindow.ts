/** Typed access to demo bridge functions mounted on `window` by App shell hooks. */

import type { GlobalAuthProfile } from '@shared/types';
import type { GqlTlsSettings } from '@shared/types/gqlTls';

export type DemoBridgeWindow = Window &
  typeof globalThis & {
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
    __wfDeleteByName?: (name: string) => void;
    __wfInsertWorkflow?: (wf: Record<string, unknown>) => void;
    __wfGetWorkflowByName?: (name: string) => unknown;
    __wfSelectByName?: (name: string) => boolean;
    __wfWorkflowsLoaded?: boolean;
    __wfOpenNodeConfig?: (nodeId: string) => void;
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
    __wfAddNode?: {
      (type: string): string | undefined;
      (type: string, id: string, label: string, position: { x: number; y: number }): void;
    };
    __wfQuickTest?: () => void;
    __wfCloseConfigModal?: () => void;
  };

export function getDemoBridgeWindow(): DemoBridgeWindow {
  return window as DemoBridgeWindow;
}
