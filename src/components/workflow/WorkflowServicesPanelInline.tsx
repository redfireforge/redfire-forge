import type { Environment, GlobalAuthProfile, Microservice } from '../../types';
import type { WorkflowService } from '../../types/workflow';
import { resolveInheritLabel, authSummary } from './WorkflowServiceRegistryModal';
import { authToState, emptyAuthState } from '../../utils/requestAuthState';

interface Props {
  services: WorkflowService[];
  environments: Environment[];
  microservices: Microservice[];
  globalAuthProfiles: GlobalAuthProfile[];
  selectedEnvId: string;
  onExpand: () => void;
  onClose: () => void;
}

export default function WorkflowServicesPanelInline({
  services,
  environments,
  microservices,
  globalAuthProfiles,
  selectedEnvId,
  onExpand,
  onClose,
}: Props) {
  const currentEnvName = environments.find((e) => e.id === selectedEnvId)?.name ?? selectedEnvId;

  const svcEnvReady = (svc: WorkflowService) => {
    if (!selectedEnvId) return 'none';
    const ep = (svc.endpoints ?? []).find((e) => e.envId === selectedEnvId);
    if (ep && ep.enabled && ep.url.trim()) return 'ready';
    return 'missing';
  };

  return (
    <div className="wf-config-panel wf-services-panel">
      <div className="wf-config-header">
        <span className="wf-config-type">🔗 Services</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm" onClick={onExpand} title="Expand to full screen">⛶</button>
          <button className="btn btn-sm" onClick={onClose} title="Close">×</button>
        </div>
      </div>

      <div className="wf-svc-inline-list">
        <div className="wf-svc-inline-header">
          <span className="wf-svc-inline-col-status"></span>
          <span className="wf-svc-inline-col-name">Service</span>
          <span className="wf-svc-inline-col-url">URL ({currentEnvName || 'no env'})</span>
          <span className="wf-svc-inline-col-auth">Auth</span>
        </div>
        {services.map((svc) => {
          const status = svcEnvReady(svc);
          const ep = selectedEnvId ? (svc.endpoints ?? []).find((e) => e.envId === selectedEnvId) : undefined;
          const url = ep?.url?.trim() || '—';
          const defaultAuth = authToState(svc.defaultAuth, globalAuthProfiles);
          const authLabel = ep
            ? (ep.authMode === 'custom'
              ? authSummary(ep, defaultAuth, globalAuthProfiles)
              : resolveInheritLabel(ep.envId, svc.microserviceId, microservices, globalAuthProfiles))
            : '—';
          return (
            <div key={svc.id} className="wf-svc-inline-row">
              <span className="wf-svc-inline-col-status">
                {status === 'ready' && <span className="wf-svc-env-dot ready">●</span>}
                {status === 'missing' && <span className="wf-svc-env-dot missing">●</span>}
              </span>
              <span className="wf-svc-inline-col-name" title={svc.name}>{svc.name}</span>
              <span className="wf-svc-inline-col-url" title={url}>{url}</span>
              <span className="wf-svc-inline-col-auth" title={authLabel}>{authLabel}</span>
            </div>
          );
        })}
        {services.length === 0 && (
          <div className="wf-svc-inline-empty">No services configured. Click <strong>⛶</strong> to add one.</div>
        )}
      </div>
    </div>
  );
}
