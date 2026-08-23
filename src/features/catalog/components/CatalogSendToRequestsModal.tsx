import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CustomSelect } from '@shared/components/CustomSelect';
import { SWAGGER_METHOD_COLORS } from '@shared/constants/httpMethodColors';
import type { CatalogEntry, CatalogEndpoint, CatalogFolder, SavedEndpointValues } from '../types/catalog';
import type { Environment, Microservice, RequestCollection } from '@shared/types';
import { collectAllGroups } from '../../requests/utils/requestTree';
import { toggleSetItem } from '@shared/utils/setToggle';
import { buildVersionInfoMap } from '../utils/versionStatus';
import { useModalDrag } from '@shared/hooks/useModalDrag';
import { useModalResize } from '@shared/hooks/useModalResize';
import ModalResizeHandles from '@shared/components/ModalResizeHandles';

interface EnvOption {
  envId: string;
  envName: string;
  baseUrl: string;
}

interface EpRow {
  endpoint: CatalogEndpoint;
  groupName: string;
}

export interface SendToRequestsPayload {
  collectionName: string;
  envs: EnvOption[];
  endpoints: CatalogEndpoint[];
  customNames: Record<string, string>;
  sampleEpIds: Set<string>;
  savedEpValues: Record<string, SavedEndpointValues>;
  targetGroupId?: string;
  newGroupName?: string;
}

interface Props {
  entry: CatalogEntry;
  appEnvironments: Environment[];
  appMicroservices: Microservice[];
  savedEpValues: Record<string, SavedEndpointValues>;
  collections: RequestCollection[];
  onSend: (payload: SendToRequestsPayload) => void;
  onClose: () => void;
  preSelectedEndpointId?: string;
  inline?: boolean;
}

export default function CatalogSendToRequestsModal({ entry, appEnvironments, appMicroservices, savedEpValues, collections, onSend, onClose, preSelectedEndpointId, inline }: Props) {
  const linkedSvc = useMemo(
    () => entry.microserviceId ? appMicroservices.find(s => s.id === entry.microserviceId) : undefined,
    [entry.microserviceId, appMicroservices],
  );

  const envOptions = useMemo((): EnvOption[] => {
    if (linkedSvc) {
      const allEnvs = [...appEnvironments, ...(linkedSvc.customEnvs ?? [])];
      return allEnvs
        .filter(e => linkedSvc.baseUrls[e.id])
        .map(e => ({
          envId: e.id,
          envName: e.name,
          baseUrl: linkedSvc.baseUrls[e.id],
        }));
    }
    if (entry.environments?.length) {
      return entry.environments.map(e => ({ envId: e.id, envName: e.name, baseUrl: e.baseUrl }));
    }
    return entry.servers.map((s, i) => ({
      envId: `server-${i}`,
      envName: s.description || `Server ${i + 1}`,
      baseUrl: s.resolvedUrl || s.url,
    }));
  }, [linkedSvc, appEnvironments, entry]);

  const epRows = useMemo((): EpRow[] => {
    const rows: EpRow[] = [];
    const walk = (folders: CatalogFolder[]) => {
      for (const f of folders) {
        for (const ep of f.endpoints) rows.push({ endpoint: ep, groupName: f.name });
        walk(f.folders);
      }
    };
    walk(entry.folders);
    for (const ep of entry.endpoints) rows.push({ endpoint: ep, groupName: 'Other' });
    return rows;
  }, [entry]);

  const allEpIds = useMemo(() => new Set(epRows.map(r => r.endpoint.id)), [epRows]);
  const allEnvIds = useMemo(() => new Set(envOptions.map(e => e.envId)), [envOptions]);

  const versionInfoMap = useMemo(
    () => buildVersionInfoMap(epRows.map(r => r.endpoint), collections),
    [epRows, collections],
  );
  const newEndpointsCount = useMemo(
    () => [...versionInfoMap.values()].filter(v => v.status === 'new').length,
    [versionInfoMap],
  );

  const hasSample = useCallback((ep: CatalogEndpoint): boolean => {
    const saved = savedEpValues[ep.id];
    if (!saved) return false;
    try {
      if (saved.params && Object.values(saved.params).some(v => typeof v === 'string' && v.trim() !== '')) return true;
      if (saved.headers && Object.values(saved.headers).some(v => typeof v === 'string' && v.trim() !== '')) return true;
      if (typeof saved.body === 'string' && saved.body.trim() !== '') return true;
    } catch {
      return false;
    }
    return false;
  }, [savedEpValues]);

  const sampleableIds = useMemo(
    () => new Set(epRows.filter(r => hasSample(r.endpoint)).map(r => r.endpoint.id)),
    [epRows, hasSample],
  );

  const [colName, setColName] = useState(linkedSvc?.name ?? entry.name);
  const [selEnvs, setSelEnvs] = useState<Set<string>>(() => new Set(envOptions.map(e => e.envId)));
  const [selEps, setSelEps] = useState<Set<string>>(() => {
    if (preSelectedEndpointId) {
      return new Set([preSelectedEndpointId]);
    }
    return new Set(epRows.map(r => r.endpoint.id));
  });
  const [customNames, setCustomNames] = useState<Record<string, string>>(() => entry.customEndpointNames ?? {});
  const [sampleEps, setSampleEps] = useState<Set<string>>(() => {
    const ids = epRows.filter(r => hasSample(r.endpoint)).map(r => r.endpoint.id);
    return new Set(ids);
  });
  useEffect(() => {
    setSampleEps(prev => {  
      const next = new Set<string>();
      for (const id of sampleableIds) {
        next.add(id);
      }
      if (next.size === prev.size && [...next].every(id => prev.has(id))) return prev;
      return next;
    });
  }, [sampleableIds]);

  const [targetGroup, setTargetGroup] = useState<string>('');
  const [newGroupName, setNewGroupName] = useState('');
  const groupsFlat = useMemo(() => collectAllGroups(collections), [collections]);

  const [collapsedPreviewEnvs, setCollapsedPreviewEnvs] = useState<Set<string>>(new Set());
  const [epColWidths, setEpColWidths] = useState([32, 120, 58, 170, 160, 80, 52]);
  const resizeRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);

  const handleColResize = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = epColWidths[colIdx];
    resizeRef.current = { colIdx, startX, startW };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      const newW = Math.max(30, resizeRef.current.startW + delta);
      setEpColWidths(prev => { const n = [...prev]; n[resizeRef.current!.colIdx] = newW; return n; });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [epColWidths]);

  const toggleEnv = useCallback((envId: string) => {
    toggleSetItem(setSelEnvs, envId);
  }, []);

  const toggleAllEnvs = useCallback(() => {
    setSelEnvs(prev => prev.size === allEnvIds.size ? new Set() : new Set(allEnvIds));
  }, [allEnvIds]);

  const toggleEp = useCallback((epId: string) => {
    toggleSetItem(setSelEps, epId);
  }, []);

  const toggleAllEps = useCallback(() => {
    setSelEps(prev => prev.size === allEpIds.size ? new Set() : new Set(allEpIds));
  }, [allEpIds]);

  const toggleSample = useCallback((epId: string) => {
    if (!sampleableIds.has(epId)) return;
    toggleSetItem(setSampleEps, epId);
  }, [sampleableIds]);

  const toggleAllSamples = useCallback(() => {
    setSampleEps(prev => {
      const allOn = [...sampleableIds].every(id => prev.has(id));
      return allOn ? new Set() : new Set(sampleableIds);
    });
  }, [sampleableIds]);

  const togglePreviewEnv = useCallback((envId: string) => {
    toggleSetItem(setCollapsedPreviewEnvs, envId);
  }, []);

  const selectedEndpoints = useMemo(
    () => epRows.filter(r => selEps.has(r.endpoint.id)).map(r => r.endpoint),
    [epRows, selEps],
  );
  const selectedEnvs = useMemo(
    () => envOptions.filter(e => selEnvs.has(e.envId)),
    [envOptions, selEnvs],
  );
  const totalRequests = selectedEndpoints.length * selectedEnvs.length;
  const canSend = colName.trim() !== '' && selectedEnvs.length > 0 && selectedEndpoints.length > 0;

  const epDisplayName = useCallback((ep: CatalogEndpoint) => {
    return customNames[ep.id]?.trim() || ep.summary || ep.path;
  }, [customNames]);

  const setCustomName = useCallback((epId: string, name: string) => {
    setCustomNames(prev => ({ ...prev, [epId]: name }));
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const payload: SendToRequestsPayload = {
      collectionName: colName.trim(), envs: selectedEnvs, endpoints: selectedEndpoints,
      customNames, sampleEpIds: sampleEps, savedEpValues,
    };
    if (targetGroup === '__new__' && newGroupName.trim()) {
      payload.newGroupName = newGroupName.trim();
    } else if (targetGroup) {
      payload.targetGroupId = targetGroup;
    }
    onSend(payload);
  }, [canSend, colName, selectedEnvs, selectedEndpoints, customNames, sampleEps, savedEpValues, targetGroup, newGroupName, onSend]);

  const renderBody = () => (
    <>
      <div className="cat-send-body">
        {/* ── Left: Selection ── */}
        <div className="cat-send-left">
          {/* Collection Name */}
          <div className="cat-send-card">
            <label className="cat-send-label">
              Collection Name
              {newEndpointsCount > 0 && (
                <span className="cat-send-new-count">{newEndpointsCount} new endpoint{newEndpointsCount !== 1 ? 's' : ''}</span>
              )}
              {newEndpointsCount === 0 && epRows.length > 0 && (
                <span className="cat-send-all-exported">all previously exported</span>
              )}
            </label>
            <input className="cep-field-input" data-testid="catalog-export-col-name" value={colName} onChange={e => setColName(e.target.value)} style={{ marginTop: 6 }} />
          </div>

          {/* Target Group */}
          <div className="cat-send-card">
            <label className="cat-send-label">Target Group</label>
            <div style={{ marginTop: 6 }}>
              <CustomSelect
                className="kafka-ms-form-select kafka-ms-form-select--acks"
                value={targetGroup}
                onChange={setTargetGroup}
                options={[
                  { value: '', label: 'None (root level)', detail: 'Add to collection root' },
                  ...groupsFlat.map(({ group: g, depth }) => ({
                    value: g.id,
                    label: `${'\u00A0\u00A0'.repeat(depth)}📂 ${g.name}`,
                  })),
                  { value: '__new__', label: '+ New Group...', detail: 'Create a new group' },
                ]}
                aria-label="Target Group"
              />
            </div>
            {targetGroup === '__new__' && (
              <input className="cep-field-input" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="New group name" style={{ marginTop: 6 }} autoFocus />
            )}
          </div>

          {/* Environments */}
          <div className="cat-send-card">
            <div className="cat-send-section-header">
              <label className="cat-send-label">
                Environments
                <span className="cat-send-count">{selEnvs.size} of {envOptions.length}</span>
              </label>
              <label className="cat-send-toggle">
                <input type="checkbox" checked={selEnvs.size === allEnvIds.size && allEnvIds.size > 0} onChange={toggleAllEnvs} />
                Select All
              </label>
            </div>
            {envOptions.length > 0 ? (
              <table className="cat-send-env-table" data-testid="catalog-export-env-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>Name</th>
                    <th>Base URL</th>
                  </tr>
                </thead>
                <tbody>
                  {envOptions.map(opt => (
                    <tr key={opt.envId} className={selEnvs.has(opt.envId) ? 'selected' : ''} onClick={() => toggleEnv(opt.envId)}>
                      <td><input type="checkbox" checked={selEnvs.has(opt.envId)} onChange={() => toggleEnv(opt.envId)} onClick={e => e.stopPropagation()} /></td>
                      <td className="cat-send-env-name">{opt.envName}</td>
                      <td className="cat-send-env-url-cell"><code>{opt.baseUrl}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="cat-edit-empty" style={{ marginTop: 8 }}>
                No environments available. Link a microservice in the Edit modal first.
              </div>
            )}
          </div>

          {/* Endpoints */}
          <div className="cat-send-card cat-send-card-grow">
            <div className="cat-send-section-header">
              <label className="cat-send-label">
                Endpoints
                <span className="cat-send-count">{selEps.size} of {allEpIds.size}</span>
              </label>
              <label className="cat-send-toggle">
                <input type="checkbox" checked={selEps.size === allEpIds.size && allEpIds.size > 0} onChange={toggleAllEps} />
                Select All
              </label>
            </div>
            <div className="cat-send-ep-table-wrap">
              <table className="cat-send-ep-table" data-testid="catalog-export-ep-table" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  {epColWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr>
                    {['', 'Group', 'Method', 'Description', 'Custom Name', 'Version', 'Sample'].map((label, i) => (
                      <th key={i} className="cat-send-ep-th" style={i === 6 ? { textAlign: 'center', cursor: sampleableIds.size > 0 ? 'pointer' : 'default' } : undefined}
                        onClick={i === 6 && sampleableIds.size > 0 ? toggleAllSamples : undefined}>
                        {label}
                        {i > 0 && i < 6 && (
                          <span className="cat-send-col-resize" onMouseDown={e => handleColResize(i, e)} />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {epRows.map(({ endpoint: ep, groupName }) => (
                    <tr
                      key={ep.id}
                      className={selEps.has(ep.id) ? 'selected' : ''}
                      onClick={() => toggleEp(ep.id)}
                    >
                      <td><input type="checkbox" checked={selEps.has(ep.id)} onChange={() => toggleEp(ep.id)} onClick={e => e.stopPropagation()} /></td>
                      <td className="cat-send-ept-group">{groupName}</td>
                      <td><span className={`cat-send-method-badge cat-send-m-${ep.method.toLowerCase()}`}>{ep.method}</span></td>
                      <td className="cat-send-ept-desc" title={ep.path}>{ep.summary || ep.path}</td>
                      <td className="cat-send-ept-name" onClick={e => e.stopPropagation()}>
                        <input
                          className="cat-send-name-input"
                          value={customNames[ep.id] ?? ''}
                          onChange={e => setCustomName(ep.id, e.target.value)}
                          placeholder={ep.summary || ep.path}
                        />
                      </td>
                      <td className="cat-send-version-cell">
                        {(() => {
                          const vi = versionInfoMap.get(ep.id);
                          if (!vi || vi.status === 'new') return <span className="cat-send-version-badge new">NEW</span>;
                          return <span className="cat-send-version-badge exported">from {vi.exportedVersion ?? '?'}</span>;
                        })()}
                      </td>
                      <td className="cat-send-sample-cell" onClick={e => { e.stopPropagation(); if (sampleableIds.has(ep.id)) toggleSample(ep.id); }}>
                        {sampleableIds.has(ep.id) ? (
                          <span className={`cat-send-sample-box ${sampleEps.has(ep.id) ? 'checked' : ''}`}>
                            {sampleEps.has(ep.id) ? '✓' : ''}
                          </span>
                        ) : (
                          <span className="cat-send-sample-box disabled">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right: Preview ── */}
        <div className="cat-send-right">
          <label className="cat-send-label">Preview</label>
          <div className="cat-send-preview" data-testid="catalog-export-preview">
            {canSend ? (
              <div className="cat-send-tree">
                <div className="cat-send-tree-root">
                  <span className="cat-send-tree-pkg">&#128230;</span>
                  <span className="cat-send-tree-name">{colName}</span>
                  <span className="cat-send-tree-badge">ENV</span>
                  <span className="cat-send-tree-total">{totalRequests}</span>
                </div>
                {selectedEnvs.map(env => {
                  const open = !collapsedPreviewEnvs.has(env.envId);
                  return (
                    <div key={env.envId} className="cat-send-tree-env">
                      <div className="cat-send-tree-env-hdr" onClick={() => togglePreviewEnv(env.envId)}>
                        <span className="cat-send-chevron">{open ? '▾' : '▸'}</span>
                        <span className="cat-send-tree-pkg">&#128230;</span>
                        <span className="cat-send-tree-name">{env.envName}</span>
                        <span className="cat-send-tree-total">{selectedEndpoints.length}</span>
                      </div>
                      {open && (
                        <div className="cat-send-tree-eps">
                          {selectedEndpoints.map(ep => (
                            <div key={ep.id} className="cat-send-tree-ep">
                              <span className="cat-send-method" style={{ color: SWAGGER_METHOD_COLORS[ep.method] || '#ccc' }}>{ep.method}</span>
                              <span>{epDisplayName(ep)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="cat-edit-empty">
                Select at least one environment and one endpoint to see a preview.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={inline ? 'cat-send-inline-footer' : 'cat-modal-footer'}>
        {!inline && <button className="cat-btn" onClick={onClose}>Cancel</button>}
        <button className="cat-btn cat-btn-primary" data-testid="catalog-export-confirm-btn" onClick={handleSend} disabled={!canSend}>
          Export {totalRequests} request{totalRequests !== 1 ? 's' : ''}
        </button>
      </div>
    </>
  );

  const modalRef = useRef<HTMLDivElement>(null);
  const { onDragStart, overlayStyle, modalStyle } = useModalDrag(true, {
    modalRef,
    constrainToViewport: true,
    viewportPadding: 12,
  });
  const { resizeStyle, onRightEdge, onCorner, onBottomEdge } = useModalResize(560, 400);

  const combinedModalStyle: React.CSSProperties = {
    ...modalStyle,
    ...resizeStyle,
  };

  if (inline) {
    return <div className="cat-send-inline" data-testid="catalog-export-inline">{renderBody()}</div>;
  }

  return createPortal(
    <div
      className="cat-send-overlay"
      data-testid="catalog-export-modal"
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="cat-send-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Export to Requests"
        ref={modalRef}
        style={combinedModalStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="cat-modal-header" onMouseDown={onDragStart} style={{ cursor: 'grab' }}>
          <h3>Export to Requests</h3>
          <span className="cat-send-header-hint">Drag to move · Resize from edges</span>
        </div>
        {renderBody()}
        <ModalResizeHandles
          onRightEdge={onRightEdge}
          onCorner={onCorner}
          onBottomEdge={onBottomEdge}
        />
      </div>
    </div>,
    document.body,
  );
}
