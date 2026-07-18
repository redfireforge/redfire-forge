import { useState, useCallback, useMemo } from 'react';
import type { CatalogEntry } from '../types/catalog';
import type { Environment, Microservice } from '../../../shared/types';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import CatalogDarkSelect from './CatalogDarkSelect';

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

  const svcOptions = useMemo(() => [
    { value: '', label: '— None (use From Spec / Custom URL) —' },
    ...microservices.map(svc => ({ value: svc.id, label: svc.name })),
  ], [microservices]);

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
      overlayClassName="modal-overlay cat-edit-overlay"
      dialogClassName="modal cat-edit-modal"
      headerClassName="cat-edit-header"
      bodyClassName="cat-edit-body"
      footerClassName="cat-edit-footer"
      showExpandButton={false}
      closeButtonKind="none"
      minWidth={480}
      minHeight={280}
      constrainDragToViewport
      dragViewportPadding={12}
      footer={(
        <>
          <button className="cat-btn" onClick={onClose}>Cancel</button>
          <button className="cat-btn cat-btn-primary" onClick={handleSave}>Save Changes</button>
        </>
      )}
    >
      <div className="cat-edit-section cat-edit-section-elevated">
        <div className="cat-edit-section-header">
          <h4 className="cat-edit-section-title">Link to Microservice</h4>
          <span className={`cat-edit-status-pill ${selectedSvcId ? 'linked' : 'unlinked'}`}>
            {selectedSvcId ? 'Linked' : 'Not Linked'}
          </span>
        </div>
        <p className="cat-edit-hint">
          Associate this API spec with a microservice from your Environments.
          The host bar will resolve base URLs automatically.
        </p>

        <label className="cat-edit-label" htmlFor="catalog-edit-microservice-select">
          Microservice
        </label>
        <CatalogDarkSelect
          id="catalog-edit-microservice-select"
          value={selectedSvcId}
          options={svcOptions}
          onChange={setSelectedSvcId}
          aria-label="Microservice"
          testId="catalog-edit-microservice-select"
        />

        {linkedSvc && (
          <div className="cat-edit-linked-summary">
            <span className="cat-edit-linked-dot" aria-hidden="true" />
            <span>Connected to {linkedSvc.name}</span>
          </div>
        )}

        {linkedSvc && envRows.length > 0 && (
          <div className="cat-edit-env-preview">
            <div className="cat-edit-preview-title">Resolved Environment Base URLs</div>
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
                    <td>{row.baseUrl ? <code>{row.baseUrl}</code> : <span className="cat-edit-empty-inline">Not configured</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {linkedSvc && envRows.length === 0 && (
          <div className="cat-edit-empty cat-edit-empty-warning">
            This microservice has no base URLs configured. Go to Environments to add them.
          </div>
        )}

        {!selectedSvcId && (
          <div className="cat-edit-empty">
            No microservice linked. You can still use "From Spec" or "Custom URL" in the host bar.
          </div>
        )}
      </div>
    </AppModalFrame>
  );
}
