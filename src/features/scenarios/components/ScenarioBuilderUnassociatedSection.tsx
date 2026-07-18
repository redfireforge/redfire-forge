import type { FeatureGroup, Environment, Microservice } from '../../../shared/types';

interface Props {
  unassociatedFeatureGroups: FeatureGroup[];
  selectedSvcId?: string;
  selectedEnvId?: string;
  assignFeatureGroup: (featureGroupId: string, svcId: string, envId: string) => void;
  removeFeatureGroup: (featureGroupId: string) => void;
  microservices: Microservice[];
  environments: Environment[];
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export default function ScenarioBuilderUnassociatedSection({
  unassociatedFeatureGroups,
  selectedSvcId,
  selectedEnvId,
  assignFeatureGroup,
  removeFeatureGroup,
  microservices,
  environments,
  showConfirm,
}: Props) {
  if (unassociatedFeatureGroups.length === 0) return null;

  return (
    <div className="unassociated-section">
      <h3>Unassigned Feature Groups ({unassociatedFeatureGroups.length})</h3>
      <p className="unassociated-hint">These feature groups need a microservice and environment assignment. {selectedSvcId && selectedEnvId ? 'Click "Assign here" to assign to the current selection.' : 'Select both from the sidebar, or use the dropdowns below.'}</p>
      {unassociatedFeatureGroups.map((fg) => (
        <div key={fg.id} className="unassociated-card">
          <div className="unassociated-info">
            <strong>{fg.name}</strong>
            <span className="count-badge">{fg.scenarios.length} scenario{fg.scenarios.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="unassociated-actions">
            {selectedSvcId && selectedEnvId ? (
              <button className="btn btn-sm btn-primary" onClick={() => assignFeatureGroup(fg.id, selectedSvcId, selectedEnvId)}>
                Assign here
              </button>
            ) : (
              <>
                <select id={`svc-${fg.id}`} defaultValue="">
                  <option value="" disabled>Microservice…</option>
                  {microservices.map((svc) => (
                    <option key={svc.id} value={svc.id}>{svc.name}</option>
                  ))}
                </select>
                <select id={`env-${fg.id}`} defaultValue="">
                  <option value="" disabled>Environment…</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                  {microservices.flatMap((s) => (s.customEnvs ?? []).map((ce) => (
                    <option key={ce.id} value={ce.id}>{ce.name} ({s.name})</option>
                  )))}
                </select>
                <button className="btn btn-sm btn-primary" onClick={() => {
                  const svcEl = document.getElementById(`svc-${fg.id}`) as HTMLSelectElement;
                  const envEl = document.getElementById(`env-${fg.id}`) as HTMLSelectElement;
                  if (svcEl?.value && envEl?.value) assignFeatureGroup(fg.id, svcEl.value, envEl.value);
                  else showConfirm('Assign Error', 'Select both a microservice and an environment.', () => {});
                }}>Assign</button>
              </>
            )}

            <button className="btn btn-sm btn-danger" onClick={() => removeFeatureGroup(fg.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
