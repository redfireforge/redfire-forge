import { useState, useCallback, useMemo } from 'react';
import type { CatalogEntry } from '../types/catalog';
import type { Environment, Microservice } from '../../../shared/types';
import AppModalFrame from '../../../shared/components/AppModalFrame';

interface Props {
  entry: CatalogEntry;
  microservices: Microservice[];
  environments: Environment[];
  onSave: (patch: Partial<CatalogEntry>) => void;
  onClose: () => void;
}

export default function CatalogEditModal({ entry, microservices, environments, onSave, onClose }: Props) {
  const [selectedSvcId, setSelectedSvcId] = useState<string>(entry.microserviceId ?? '');

  const linkedSvc = useMemo(
    () => microservices.find(s => s.id === selectedSvcId),
    [microservices, selectedSvcId],
  );

  const envRows = useMemo(() => {
    if (!linkedSvc) return [];
    const allEnvs = [...environments, ...(linkedSvc.customEnvs ?? [])];
    return allEnvs
      .filter(e => linkedSvc.baseUrls[e.id] || linkedSvc.authProfileIds?.[e.id])
      .map(e => ({
        envId: e.id,
        envName: e.name,
        baseUrl: linkedSvc.baseUrls[e.id] ?? '',
      }));
  }, [linkedSvc, environments]);

  const handleSave = useCallback(() => {
    const patch: Partial<CatalogEntry> = {
      microserviceId: selectedSvcId || undefined,
      environments: undefined,
      activeEnvironmentId: undefined,
    };

    if (!selectedSvcId && entry.hostConfig.strategy === 'environment') {
      patch.hostConfig = { ...entry.hostConfig, strategy: 'inherited', environmentId: undefined };
    }
    if (selectedSvcId && entry.hostConfig.strategy === 'environment' && entry.hostConfig.environmentId) {
      const svc = microservices.find(s => s.id === selectedSvcId);
      if (svc && !svc.baseUrls[entry.hostConfig.environmentId]) {
        const firstEnvId = Object.keys(svc.baseUrls).find(k => svc.baseUrls[k]);
        patch.hostConfig = { ...entry.hostConfig, environmentId: firstEnvId };
      }
    }

    onSave(patch);
    onClose();
  }, [selectedSvcId, entry, microservices, onSave, onClose]);

  return (
    <AppModalFrame
      title={`Edit — ${entry.name}`}
      onClose={onClose}
      overlayClassName="cat-modal-overlay"
      dialogClassName="cat-modal cat-modal-wide"
      headerClassName="cat-modal-header"
      bodyClassName="cat-modal-body"
      footerClassName="cat-modal-footer"
      closeButtonClassName="cat-modal-close"
      footer={(
        <>
          <button className="cat-btn" onClick={onClose}>Cancel</button>
          <button className="cat-btn cat-btn-primary" onClick={handleSave}>Save Changes</button>
        </>
      )}
    >
          <div className="cat-edit-section">
            <h4 className="cat-edit-section-title">Link to Microservice</h4>
            <p className="cat-edit-hint">
              Associate this API spec with a microservice from your Environments.
              The host bar will resolve base URLs automatically.
            </p>

            <select
              className="ceb-server-select"
              value={selectedSvcId}
              onChange={e => setSelectedSvcId(e.target.value)}
              style={{ width: '100%', marginTop: 8 }}
            >
              <option value="">— None (use From Spec / Custom URL) —</option>
              {microservices.map(svc => (
                <option key={svc.id} value={svc.id}>{svc.name}</option>
              ))}
            </select>

            {linkedSvc && envRows.length > 0 && (
              <div className="cat-edit-env-preview" style={{ marginTop: 12 }}>
                <table className="cat-env-table">
                  <thead>
                    <tr>
                      <th>Environment</th>
                      <th>Base URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {envRows.map(row => (
                      <tr key={row.envId}>
                        <td>{row.envName}</td>
                        <td>{row.baseUrl ? <code>{row.baseUrl}</code> : <span style={{ opacity: 0.5 }}>Not configured</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {linkedSvc && envRows.length === 0 && (
              <div className="cat-edit-empty" style={{ marginTop: 12 }}>
                This microservice has no base URLs configured. Go to Environments to add them.
              </div>
            )}

            {!selectedSvcId && (
              <div className="cat-edit-empty" style={{ marginTop: 12 }}>
                No microservice linked. You can still use "From Spec" or "Custom URL" in the host bar.
              </div>
            )}
          </div>
    </AppModalFrame>
  );
}
