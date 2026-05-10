import type { Environment, GlobalAuthProfile, Microservice } from '../../../../shared/types';
import type { WorkflowService } from '../../types/workflow';
import { resolveInheritLabel, authSummary } from '../modals/WorkflowServiceRegistryModal';
import { authToState } from '../../../requests/utils/requestAuthState';

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
        <span className="wf-config-type"><svg className="wf-inline-icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Services</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm" onClick={onExpand} title="Expand to full screen"><svg className="wf-inline-icon" viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>
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
                {status === 'ready' && <span className="wf-svc-env-dot ready"><svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg></span>}
                {status === 'missing' && <span className="wf-svc-env-dot missing"><svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg></span>}
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
