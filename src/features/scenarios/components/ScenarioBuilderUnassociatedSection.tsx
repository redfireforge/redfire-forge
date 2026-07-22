import { useState } from 'react';
import type { FeatureGroup, Environment, Microservice } from '../../../shared/types';
import { CustomSelect } from '../../../shared/components/CustomSelect';

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
  const [assignments, setAssignments] = useState<Record<string, { svcId: string; envId: string }>>({});

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
                <CustomSelect
                  value={assignments[fg.id]?.svcId ?? ''}
                  onChange={(v) => setAssignments((prev) => ({
                    ...prev,
                    [fg.id]: { svcId: v, envId: prev[fg.id]?.envId ?? '' },
                  }))}
                  placeholder="Microservice…"
                  options={microservices.map((svc) => ({ value: svc.id, label: svc.name }))}
                />
                <CustomSelect
                  value={assignments[fg.id]?.envId ?? ''}
                  onChange={(v) => setAssignments((prev) => ({
                    ...prev,
                    [fg.id]: { svcId: prev[fg.id]?.svcId ?? '', envId: v },
                  }))}
                  placeholder="Environment…"
                  options={[
                    ...environments.map((env) => ({ value: env.id, label: env.name })),
                    ...microservices.flatMap((s) => (s.customEnvs ?? []).map((ce) => ({
                      value: ce.id,
                      label: `${ce.name} (${s.name})`,
                    }))),
                  ]}
                />
                <button className="btn btn-sm btn-primary" onClick={() => {
                  const a = assignments[fg.id];
                  if (a?.svcId && a?.envId) assignFeatureGroup(fg.id, a.svcId, a.envId);
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
