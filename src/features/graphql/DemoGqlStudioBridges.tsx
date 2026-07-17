import type { GqlTlsSettings } from '../../shared/types/gqlTls';
import { useDemoGqlEnvBridge } from './hooks/useDemoGqlEnvBridge';
import { useDemoGqlQueryBridge } from './hooks/useDemoGqlQueryBridge';
import { useDemoGqlRightViewBridge, type GqlStudioRightView } from './hooks/useDemoGqlRightViewBridge';
import { useDemoGqlTlsBridge } from './hooks/useDemoGqlTlsBridge';
import { useDemoGqlBatchDetectionBridge } from './hooks/useDemoGqlBatchDetectionBridge';
import type { AdvancedSettingsValues } from './components/GraphqlAdvancedSettings';
import type { useGraphqlConnectionSettings } from './hooks/useGraphqlConnectionSettings';

type ConnectionSettings = ReturnType<typeof useGraphqlConnectionSettings>;

export interface DemoGqlStudioBridgesProps {
  upsertEnvironment: ConnectionSettings['upsertEnvironment'];
  deleteEnvironmentByName: ConnectionSettings['deleteEnvironmentByName'];
  applyTlsSettings: (patch: Partial<GqlTlsSettings>) => void;
  setGqlQuery: (query: string) => void;
  setRightView: (view: GqlStudioRightView) => void;
  handleAdvSettingsChange: (patch: Partial<AdvancedSettingsValues>) => void;
  setBatchUnsupportedToast: (v: boolean) => void;
}

/** Lazy-loaded demo bridge hooks for GraphQL Studio (Learning Hub builds only). */
export default function DemoGqlStudioBridges({
  upsertEnvironment,
  deleteEnvironmentByName,
  applyTlsSettings,
  setGqlQuery,
  setRightView,
  handleAdvSettingsChange,
  setBatchUnsupportedToast,
}: DemoGqlStudioBridgesProps) {
  useDemoGqlEnvBridge({ upsertEnvironment, deleteEnvironmentByName });
  useDemoGqlTlsBridge({ applyTlsSettings });
  useDemoGqlQueryBridge({ setGqlQuery });
  useDemoGqlRightViewBridge({ setRightView });
  useDemoGqlBatchDetectionBridge({ handleAdvSettingsChange, setBatchUnsupportedToast });
  return null;
}
