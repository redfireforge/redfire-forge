import type { GqlTlsSettings } from '../../shared/types/gqlTls';
import { useDemoGqlEnvBridge } from './hooks/useDemoGqlEnvBridge';
import { useDemoGqlTlsBridge } from './hooks/useDemoGqlTlsBridge';
import type { useGraphqlConnectionSettings } from './hooks/useGraphqlConnectionSettings';

type ConnectionSettings = ReturnType<typeof useGraphqlConnectionSettings>;

export interface DemoGqlStudioBridgesProps {
  upsertEnvironment: ConnectionSettings['upsertEnvironment'];
  deleteEnvironmentByName: ConnectionSettings['deleteEnvironmentByName'];
  applyTlsSettings: (patch: Partial<GqlTlsSettings>) => void;
}

/** Lazy-loaded demo bridge hooks for GraphQL Studio (Learning Hub builds only). */
export default function DemoGqlStudioBridges({
  upsertEnvironment,
  deleteEnvironmentByName,
  applyTlsSettings,
}: DemoGqlStudioBridgesProps) {
  useDemoGqlEnvBridge({ upsertEnvironment, deleteEnvironmentByName });
  useDemoGqlTlsBridge({ applyTlsSettings });
  return null;
}
