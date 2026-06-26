import type { GqlTlsSettings } from '../../shared/types/gqlTls';
import { useDemoGqlEnvBridge } from './hooks/useDemoGqlEnvBridge';
import { useDemoGqlQueryBridge } from './hooks/useDemoGqlQueryBridge';
import { useDemoGqlTlsBridge } from './hooks/useDemoGqlTlsBridge';
import type { useGraphqlConnectionSettings } from './hooks/useGraphqlConnectionSettings';

type ConnectionSettings = ReturnType<typeof useGraphqlConnectionSettings>;

export interface DemoGqlStudioBridgesProps {
  upsertEnvironment: ConnectionSettings['upsertEnvironment'];
  deleteEnvironmentByName: ConnectionSettings['deleteEnvironmentByName'];
  applyTlsSettings: (patch: Partial<GqlTlsSettings>) => void;
  setGqlQuery: (query: string) => void;
}

/** Lazy-loaded demo bridge hooks for GraphQL Studio (Learning Hub builds only). */
export default function DemoGqlStudioBridges({
  upsertEnvironment,
  deleteEnvironmentByName,
  applyTlsSettings,
  setGqlQuery,
}: DemoGqlStudioBridgesProps) {
  useDemoGqlEnvBridge({ upsertEnvironment, deleteEnvironmentByName });
  useDemoGqlTlsBridge({ applyTlsSettings });
  useDemoGqlQueryBridge({ setGqlQuery });
  return null;
}
