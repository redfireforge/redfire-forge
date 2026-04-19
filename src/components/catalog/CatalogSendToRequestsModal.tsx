import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { CatalogEntry, CatalogEndpoint, CatalogFolder, SavedEndpointValues } from '../../types/catalog';
import type { Environment, Microservice, RequestCollection } from '../../types';
import { collectAllGroups } from '../../utils/requestTree';

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
}

const MC: Record<string, string> = {
  GET: '#49cc90', POST: '#fca130', PUT: '#61affe', PATCH: '#50e3c2', DELETE: '#f93e3e',
};

export default function CatalogSendToRequestsModal({ entry, appEnvironments, appMicroservices, savedEpValues, collections, onSend, onClose }: Props) {
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
      baseUrl: s.url,
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
  const [selEps, setSelEps] = useState<Set<string>>(() => new Set(epRows.map(r => r.endpoint.id)));
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
  const [epColWidths, setEpColWidths] = useState([32, 150, 58, 200, 200, 52]);
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
    setSelEnvs(prev => { const n = new Set(prev); if (n.has(envId)) n.delete(envId); else n.add(envId); return n; });
  }, []);

  const toggleAllEnvs = useCallback(() => {
    setSelEnvs(prev => prev.size === allEnvIds.size ? new Set() : new Set(allEnvIds));
  }, [allEnvIds]);

  const toggleEp = useCallback((epId: string) => {
    setSelEps(prev => { const n = new Set(prev); if (n.has(epId)) n.delete(epId); else n.add(epId); return n; });
  }, []);

  const toggleAllEps = useCallback(() => {
    setSelEps(prev => prev.size === allEpIds.size ? new Set() : new Set(allEpIds));
  }, [allEpIds]);

  const toggleSample = useCallback((epId: string) => {
    if (!sampleableIds.has(epId)) return;
    setSampleEps(prev => { const n = new Set(prev); if (n.has(epId)) n.delete(epId); else n.add(epId); return n; });
  }, [sampleableIds]);

  const toggleAllSamples = useCallback(() => {
    setSampleEps(prev => {
      const allOn = [...sampleableIds].every(id => prev.has(id));
      return allOn ? new Set() : new Set(sampleableIds);
    });
  }, [sampleableIds]);

  const togglePreviewEnv = useCallback((envId: string) => {
    setCollapsedPreviewEnvs(prev => { const n = new Set(prev); if (n.has(envId)) n.delete(envId); else n.add(envId); return n; });
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

  return (
    <div className="cat-send-overlay" onClick={onClose}>
      <div className="cat-send-modal" onClick={e => e.stopPropagation()}>
        <div className="cat-modal-header">
          <h3>Send to Requests</h3>
          <button className="cat-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="cat-send-body">
          {/* ── Left: Selection ── */}
          <div className="cat-send-left">
            {/* Collection Name */}
            <div className="cat-send-card">
              <label className="cat-send-label">Collection Name</label>
              <input className="cep-field-input" value={colName} onChange={e => setColName(e.target.value)} style={{ marginTop: 6 }} />
            </div>

            {/* Target Group */}
            <div className="cat-send-card">
              <label className="cat-send-label">Target Group</label>
              <select className="cep-field-input" value={targetGroup} onChange={e => setTargetGroup(e.target.value)} style={{ marginTop: 6 }}>
                <option value="">None (root level)</option>
                {groupsFlat.map(({ group: g, depth }) => (
                  <option key={g.id} value={g.id}>
                    {'\u00A0\u00A0'.repeat(depth)}&#128450;&#65039; {g.name}
                  </option>
                ))}
                <option value="__new__">+ New Group...</option>
              </select>
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
                <table className="cat-send-env-table">
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
                <table className="cat-send-ep-table" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    {epColWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      {['', 'Group', 'Method', 'Description', 'Custom Name', 'Sample'].map((label, i) => (
                        <th key={i} className="cat-send-ep-th" style={i === 5 ? { textAlign: 'center', cursor: sampleableIds.size > 0 ? 'pointer' : 'default' } : undefined}
                          onClick={i === 5 && sampleableIds.size > 0 ? toggleAllSamples : undefined}>
                          {label}
                          {i > 0 && i < 5 && (
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
            <div className="cat-send-preview">
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
                                <span className="cat-send-method" style={{ color: MC[ep.method] || '#ccc' }}>{ep.method}</span>
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

        <div className="cat-modal-footer">
          <button className="cat-btn" onClick={onClose}>Cancel</button>
          <button className="cat-btn cat-btn-primary" onClick={handleSend} disabled={!canSend}>
            Send {totalRequests} request{totalRequests !== 1 ? 's' : ''} to Requests
          </button>
        </div>
      </div>
    </div>
  );
}
