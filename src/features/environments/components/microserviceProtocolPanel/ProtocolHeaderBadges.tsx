import type { Environment, Microservice, ProtocolKey } from '../../../../shared/types';
import {
  PROTOCOL_TABS,
  computeProtocolCompleteness,
  listDeployedEnvRows,
} from '../../utils/protocolEndpointUtils';

export function ProtocolHeaderBadges({
  svc,
  environments,
  enabledProtocols,
}: {
  svc: Microservice;
  environments: Environment[];
  enabledProtocols: ProtocolKey[];
}) {
  const deployedEnvIds = listDeployedEnvRows(svc, environments).map((r) => r.envId);
  const visibleTabs = PROTOCOL_TABS.filter((t) => enabledProtocols.includes(t.key));
  return (
    <div className="em-svc-status-badges" data-testid="protocol-header-badges">
      {visibleTabs.map((tab) => {
        const c = computeProtocolCompleteness(svc, tab.key, deployedEnvIds, tab.supportsFallback);
        return (
          <span key={tab.key} className={`em-svc-badge em-svc-badge--${c.tone} em-svc-badge--${tab.cssKey}`}>
            {tab.shortLabel} {c.label}
          </span>
        );
      })}
    </div>
  );
}
