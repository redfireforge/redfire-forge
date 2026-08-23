import type { ProtocolKey } from '@shared/types';
import { buildEnvVarMap } from '@shared/utils/envVarUtils';
import type { Microservice } from '@shared/types';
import {
  PROTOCOL_TABS,
  derivedVarSourceLabel,
  getRowStatus,
  hasDerivedVarsForProtocol,
  type EndpointRowStatus,
} from '../utils/protocolEndpointUtils';

interface DerivedVarsPanelProps {
  svc: Microservice;
  protocol: ProtocolKey;
  envId: string;
  envName: string;
}

export function DerivedVarsPanel({ svc, protocol, envId, envName }: DerivedVarsPanelProps) {
  if (!hasDerivedVarsForProtocol(protocol)) return null;
  const tabDef = PROTOCOL_TABS.find((t) => t.key === protocol)!;

  const map = buildEnvVarMap(svc, envId, protocol, envName);
  const status = getRowStatus(svc, protocol, envId);

  const rows = tabDef.derivedVars
    .map((key) => ({ key, value: map[key] }))
    .filter((row) => row.value);

  if (rows.length === 0) return null;

  return (
    <div className="em-derived-vars" data-testid={`derived-vars-${protocol}`}>
      <div className="em-derived-vars-title">Derived variables ({envName})</div>
      {rows.map(({ key, value }) => (
        <div key={key} className="em-derived-var-row">
          <span className="em-derived-var-name">{`{{${key}}}`}</span>
          <span className="em-derived-var-val">{value}</span>
          <span className="em-derived-var-from">{derivedVarSourceLabel(key, status as EndpointRowStatus)}</span>
        </div>
      ))}
    </div>
  );
}
