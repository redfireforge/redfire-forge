import { useMemo } from 'react';
import type { Environment, Microservice } from '../../../../shared/types';
import type { WorkflowService } from '../../types/workflow';
import { checkAllEnvReadiness } from '../../utils/workflowEnvReadiness';
import { stripTrailingSlash } from '../../utils/workflowHostResolve';

interface Props {
  environments: Environment[];
  microservices: Microservice[];
  selectedEnvId: string;
  selectedSvcId: string;
  onEnvSelect: (id: string) => void;
  onSvcSelect: (id: string) => void;
  resolvedBaseUrl: string;
  workflowServices?: WorkflowService[];
}

/**
 * Same Environment + Microservice pairing as the Harness sidebar, inlined for the Workflow tab
 * so Quick Test can resolve {{baseUrl}} without switching away from the designer.
 */
export default function WorkflowHarnessContextBar({
  environments,
  microservices,
  selectedEnvId,
  selectedSvcId,
  onEnvSelect,
  onSvcSelect,
  resolvedBaseUrl,
  workflowServices = [],
}: Props) {
  const microservicesForEnv = useMemo(
    () => (selectedEnvId ? microservices.filter((s) => selectedEnvId in s.baseUrls) : []),
    [microservices, selectedEnvId],
  );

  const envReadinessMap = useMemo(
    () => workflowServices.length > 0
      ? checkAllEnvReadiness(environments.map((e) => e.id), workflowServices)
      : new Map(),
    [environments, workflowServices],
  );

  const handleEnvChange = (envId: string) => {
    onEnvSelect(envId);
    const svcs = envId ? microservices.filter((s) => envId in s.baseUrls) : [];
    const keep = svcs.some((s) => s.id === selectedSvcId);
    if (!keep && svcs.length > 0) onSvcSelect(svcs[0].id);
  };

  return (
    <div className="wf-harness-context-bar" role="region" aria-label="API host for Quick Test">
      <div className="wf-harness-context-title">
        <span className="wf-harness-context-heading">Quick Test host</span>
        <span className="wf-harness-context-sub">
          Default <code>{'{{baseUrl}}'}</code> for Quick Test when an HTTP step uses the harness host. Override Environment + Microservice on each HTTP step when the workflow calls multiple services.
        </span>
      </div>
      <div className="wf-harness-context-controls">
        <label className="wf-harness-context-field">
          <span className="wf-harness-context-field-label">Environment</span>
          <select
            className="wf-harness-context-select"
            value={selectedEnvId}
            onChange={(e) => handleEnvChange(e.target.value)}
          >
            <option value="">Select environment…</option>
            {environments.map((e) => {
              const r = envReadinessMap.get(e.id);
              const warn = r && !r.ready ? ` ⚠ (${r.issues.length} svc missing)` : '';
              return (
                <option key={e.id} value={e.id}>{e.name}{warn}</option>
              );
            })}
          </select>
        </label>
        <label className="wf-harness-context-field">
          <span className="wf-harness-context-field-label">Microservice</span>
          <select
            className="wf-harness-context-select"
            value={selectedSvcId}
            onChange={(e) => onSvcSelect(e.target.value)}
            disabled={!selectedEnvId}
          >
            <option value="">Select microservice…</option>
            {microservicesForEnv.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <div className="wf-harness-context-preview">
          <span className="wf-harness-context-preview-label">Resolved base URL</span>
          {resolvedBaseUrl.trim() ? (
            <code className="wf-harness-context-preview-url" title={resolvedBaseUrl.trim()}>
              {stripTrailingSlash(resolvedBaseUrl)}
            </code>
          ) : (
            <span className="wf-harness-context-preview-missing">
              {selectedEnvId && selectedSvcId
                ? 'No base URL for this pair — edit the microservice in Environments.'
                : 'Choose environment and microservice.'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
