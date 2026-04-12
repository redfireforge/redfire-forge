import { useState, useMemo, useRef, useCallback } from 'react';
import type { Environment, Microservice, FeatureGroup, TestRun, GlobalAuthProfile } from '../types';

type ItemAction = 'add' | 'skip' | 'overwrite' | 'keepBoth';

interface ImportData {
  environments?: Environment[];
  microservices?: Microservice[];
  globalAuthProfiles?: GlobalAuthProfile[];
  featureGroups?: FeatureGroup[];
  testRuns?: TestRun[];
  exportedAt?: string;
  version?: string;
}

interface ResolvedItem<T> {
  item: T;
  status: 'new' | 'conflict-id' | 'conflict-name';
  existingName?: string;
  action: ItemAction;
  checked: boolean;
  existingItem?: T;
}

interface ResolvedSection<T> {
  key: string;
  label: string;
  items: ResolvedItem<T>[];
  expanded: boolean;
}

interface Props {
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  testRuns: TestRun[];
  globalAuthProfiles: GlobalAuthProfile[];
  onImport: (data: {
    environments?: { item: Environment; action: ItemAction }[];
    microservices?: { item: Microservice; action: ItemAction }[];
    globalAuthProfiles?: { item: GlobalAuthProfile; action: ItemAction }[];
    featureGroups?: { item: FeatureGroup; action: ItemAction }[];
    testRuns?: { item: TestRun; action: ItemAction }[];
  }) => void;
  onClose: () => void;
}

function resolveItems<T extends { id: string }>(
  incoming: T[],
  existing: T[],
  getName: (item: T) => string,
): ResolvedItem<T>[] {
  const existingById = new Map(existing.map((e) => [e.id, e]));
  const existingByName = new Map(existing.map((e) => [getName(e).toLowerCase(), e]));

  return incoming.map((item) => {
    const byId = existingById.get(item.id);
    if (byId) {
      return { item, status: 'conflict-id' as const, existingName: getName(byId), existingItem: byId, action: 'skip' as ItemAction, checked: true };
    }
    const byName = existingByName.get(getName(item).toLowerCase());
    if (byName) {
      return { item, status: 'conflict-name' as const, existingName: getName(byName), existingItem: byName, action: 'skip' as ItemAction, checked: true };
    }
    return { item, status: 'new' as const, action: 'add' as ItemAction, checked: true };
  });
}

function summarizeItem(obj: Record<string, unknown>, keys: string[]): string[] {
  return keys
    .filter((k) => obj[k] !== undefined && obj[k] !== '' && obj[k] !== null)
    .map((k) => {
      const v = obj[k];
      if (typeof v === 'object' && v !== null) {
        if (Array.isArray(v)) return `${k}: [${v.length} items]`;
        return `${k}: {${Object.keys(v).length} keys}`;
      }
      const s = String(v);
      return `${k}: ${s.length > 60 ? s.slice(0, 60) + '…' : s}`;
    });
}

export default function ImportCenter({ environments, microservices, featureGroups, testRuns, globalAuthProfiles, onImport, onClose }: Props) {
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [maximized, setMaximized] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const [envItems, setEnvItems] = useState<ResolvedItem<Environment>[]>([]);
  const [svcItems, setSvcItems] = useState<ResolvedItem<Microservice>[]>([]);
  const [profileItems, setProfileItems] = useState<ResolvedItem<GlobalAuthProfile>[]>([]);
  const [fgItems, setFgItems] = useState<ResolvedItem<FeatureGroup>[]>([]);
  const [runItems, setRunItems] = useState<ResolvedItem<TestRun>[]>([]);
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({
    environments: true, microservices: true, globalAuth: true, features: true, runs: true,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setImportData(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ImportData;
        const hasData = data.environments || data.microservices || data.globalAuthProfiles || data.featureGroups || data.testRuns;
        if (!hasData) {
          setParseError('File does not contain any recognizable data.');
          return;
        }
        setImportData(data);
        setEnvItems(resolveItems(data.environments || [], environments, (e) => e.name));
        setSvcItems(resolveItems(data.microservices || [], microservices, (s) => s.name));
        setProfileItems(resolveItems(data.globalAuthProfiles || [], globalAuthProfiles, (p) => p.name));
        setFgItems(resolveItems(data.featureGroups || [], featureGroups, (fg) => fg.name));
        setRunItems(resolveItems(data.testRuns || [], testRuns, (r) => new Date(r.timestamp).toLocaleString()));
        setExpandedItems(new Set());
      } catch {
        setParseError('Invalid JSON file. Please select a valid export file.');
      }
    };
    reader.onerror = () => setParseError('Failed to read file.');
    reader.readAsText(file);
  };

  const updateItem = useCallback(<T,>(
    setter: React.Dispatch<React.SetStateAction<ResolvedItem<T>[]>>,
    idx: number,
    updates: Partial<ResolvedItem<T>>,
  ) => {
    setter((prev) => prev.map((it, i) => i === idx ? { ...it, ...updates } : it));
  }, []);

  const sections: ResolvedSection<unknown>[] = useMemo(() => {
    const result: ResolvedSection<unknown>[] = [];
    if (envItems.length > 0) result.push({ key: 'environments', label: 'Environments', items: envItems, expanded: sectionExpanded.environments });
    if (svcItems.length > 0) result.push({ key: 'microservices', label: 'Microservices', items: svcItems, expanded: sectionExpanded.microservices });
    if (profileItems.length > 0) result.push({ key: 'globalAuth', label: 'Global Auth Profiles', items: profileItems, expanded: sectionExpanded.globalAuth });
    if (fgItems.length > 0) result.push({ key: 'features', label: 'Feature Groups', items: fgItems, expanded: sectionExpanded.features });
    if (runItems.length > 0) result.push({ key: 'runs', label: 'Test Runs', items: runItems, expanded: sectionExpanded.runs });
    return result;
  }, [envItems, svcItems, profileItems, fgItems, runItems, sectionExpanded]);

  const stats = useMemo(() => {
    const all = [...envItems, ...svcItems, ...profileItems, ...fgItems, ...runItems];
    const checked = all.filter((i) => i.checked);
    const willAdd = checked.filter((i) => i.status === 'new' || i.action === 'add' || i.action === 'keepBoth').length;
    const willOverwrite = checked.filter((i) => i.action === 'overwrite').length;
    const willSkip = checked.filter((i) => i.status !== 'new' && i.action === 'skip').length;
    const unchecked = all.length - checked.length;
    return { total: all.length, checked: checked.length, willAdd, willOverwrite, willSkip, unchecked };
  }, [envItems, svcItems, profileItems, fgItems, runItems]);

  const getItemName = useCallback((secKey: string, item: unknown): string => {
    if (secKey === 'runs') {
      const r = item as TestRun;
      return `${new Date(r.timestamp).toLocaleString()} — ${r.summary.totalRequests} reqs, ${r.summary.tps.toFixed(1)} TPS`;
    }
    return (item as { name?: string }).name || '(unnamed)';
  }, []);

  const getItemDetails = useCallback((secKey: string, item: unknown): string[] => {
    if (secKey === 'environments') return summarizeItem(item as Record<string, unknown>, ['id', 'name']);
    if (secKey === 'microservices') {
      const s = item as Microservice;
      const envCount = Object.keys(s.baseUrls).length;
      return [`id: ${s.id}`, `name: ${s.name}`, `baseUrls: ${envCount} environment(s)`, ...Object.entries(s.baseUrls).map(([eid, url]) => `  ${eid.slice(0, 8)}… → ${url || '(empty)'}`)];
    }
    if (secKey === 'globalAuth') {
      const p = item as GlobalAuthProfile;
      return [`id: ${p.id}`, `name: ${p.name}`, `auth.type: ${p.auth.type}`, ...(p.auth.tokenUrl ? [`tokenUrl: ${p.auth.tokenUrl}`] : []), ...(p.auth.clientId ? [`clientId: ${p.auth.clientId}`] : [])];
    }
    if (secKey === 'features') {
      const fg = item as FeatureGroup;
      const scenarioCount = fg.scenarios.length;
      const testCount = fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0);
      return [`id: ${fg.id}`, `name: ${fg.name}`, `${scenarioCount} scenario(s), ${testCount} test(s)`, ...(fg.globalAuthProfileId ? [`globalAuthProfileId: ${fg.globalAuthProfileId}`] : [])];
    }
    if (secKey === 'runs') {
      const r = item as TestRun;
      return [`id: ${r.id}`, `timestamp: ${new Date(r.timestamp).toISOString()}`, `totalRequests: ${r.summary.totalRequests}`, `tps: ${r.summary.tps.toFixed(2)}`, `avgResponseTime: ${r.summary.avgResponseTime.toFixed(0)}ms`, ...(r.envName ? [`env: ${r.envName}`] : []), ...(r.svcName ? [`svc: ${r.svcName}`] : [])];
    }
    return [];
  }, []);

  const getSetterForSection = (secKey: string) => {
    if (secKey === 'environments') return setEnvItems;
    if (secKey === 'microservices') return setSvcItems;
    if (secKey === 'globalAuth') return setProfileItems;
    if (secKey === 'features') return setFgItems;
    return setRunItems;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bulkAction = useCallback((secKey: string, action: 'checkAll' | 'uncheckAll' | 'skipAll' | 'overwriteAll' | 'keepBothAll') => {
    const setter = getSetterForSection(secKey) as (fn: (prev: ResolvedItem<any>[]) => ResolvedItem<any>[]) => void;
    setter((prev) => prev.map((it) => {
      if (action === 'checkAll') return { ...it, checked: true };
      if (action === 'uncheckAll') return { ...it, checked: false };
      if (it.status === 'new') return it;
      if (action === 'skipAll') return { ...it, action: 'skip' as ItemAction };
      if (action === 'overwriteAll') return { ...it, action: 'overwrite' as ItemAction };
      return { ...it, action: 'keepBoth' as ItemAction };
    }));
  }, []);

  const handleImport = () => {
    if (!importData) return;
    const collect = <T,>(items: ResolvedItem<T>[]): { item: T; action: ItemAction }[] | undefined => {
      const selected = items.filter((i) => i.checked && !(i.status !== 'new' && i.action === 'skip'));
      return selected.length > 0 ? selected.map((i) => ({ item: i.item, action: i.status === 'new' ? 'add' : i.action })) : undefined;
    };
    onImport({
      environments: collect(envItems),
      microservices: collect(svcItems),
      globalAuthProfiles: collect(profileItems),
      featureGroups: collect(fgItems),
      testRuns: collect(runItems),
    });
  };

  const itemsToImport = stats.checked - stats.willSkip;

  return (
    <div className="modal-overlay settings-overlay" onClick={onClose}>
      <div className={`modal settings-modal import-center-modal ${maximized ? 'modal-maximized' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Import Data</h3>
          <div className="import-header-actions">
            <button className="btn btn-sm" onClick={() => setMaximized((v) => !v)} title={maximized ? 'Restore' : 'Maximize'}>
              {maximized ? '⊡' : '⊞'}
            </button>
            <button className="btn btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="import-center-body">
          <div className="import-file-section">
            <p className="settings-section-desc">
              Select a previously exported JSON file. You can then choose exactly which items to import and how to handle conflicts.
            </p>
            <div className="import-file-row">
              <button className="btn btn-sm btn-primary" onClick={() => fileRef.current?.click()}>Choose File</button>
              <span className="import-file-name">{fileName || 'No file selected'}</span>
              <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelect} />
            </div>
            {parseError && <div className="import-error">{parseError}</div>}
          </div>

          {importData && (
            <>
              {importData.exportedAt && (
                <div className="import-meta">
                  Exported: {new Date(importData.exportedAt).toLocaleString()}
                  {importData.version && <> · v{importData.version}</>}
                </div>
              )}

              <div className="import-sections">
                {sections.map((sec) => {
                  const conflicts = sec.items.filter((i) => i.status !== 'new');
                  const newCount = sec.items.filter((i) => i.status === 'new').length;
                  return (
                    <div key={sec.key} className="import-section-card">
                      <div className="import-section-header" onClick={() => setSectionExpanded((p) => ({ ...p, [sec.key]: !p[sec.key] }))}>
                        <span className={`expand-icon ${sec.expanded ? 'expanded' : ''}`}>▸</span>
                        <strong>{sec.label}</strong>
                        <span className="import-section-count">{sec.items.length} item{sec.items.length !== 1 ? 's' : ''}</span>
                        <div className="import-section-badges">
                          {newCount > 0 && <span className="import-stat import-stat-new">{newCount} new</span>}
                          {conflicts.length > 0 && <span className="import-stat import-stat-conflict">{conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}</span>}
                        </div>
                        <div className="import-section-bulk" onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-xs" onClick={() => bulkAction(sec.key, 'checkAll')}>All</button>
                          <button className="btn btn-xs" onClick={() => bulkAction(sec.key, 'uncheckAll')}>None</button>
                          {conflicts.length > 0 && (
                            <>
                              <span className="import-bulk-sep">|</span>
                              <button className="btn btn-xs" onClick={() => bulkAction(sec.key, 'skipAll')}>Skip all</button>
                              <button className="btn btn-xs" onClick={() => bulkAction(sec.key, 'overwriteAll')}>Overwrite all</button>
                              <button className="btn btn-xs" onClick={() => bulkAction(sec.key, 'keepBothAll')}>Keep both all</button>
                            </>
                          )}
                        </div>
                      </div>

                      {sec.expanded && (
                        <div className="import-item-list">
                          {sec.items.map((ri, idx) => {
                            const itemKey = `${sec.key}-${(ri.item as { id: string }).id}`;
                            const isExpanded = expandedItems.has(itemKey);
                            const isConflict = ri.status !== 'new';
                            return (
                              <div key={itemKey} className={`import-item-row ${!ri.checked ? 'import-item-disabled' : ''} ${isConflict ? 'import-item-conflict' : ''}`}>
                                <div className="import-item-main">
                                  <input
                                    type="checkbox"
                                    checked={ri.checked}
                                    onChange={() => updateItem(getSetterForSection(sec.key) as never, idx, { checked: !ri.checked } as never)}
                                  />
                                  <div className="import-item-info" onClick={() => setExpandedItems((prev) => { const n = new Set(prev); if (n.has(itemKey)) n.delete(itemKey); else n.add(itemKey); return n; })}>
                                    <span className="import-item-name">{getItemName(sec.key, ri.item)}</span>
                                    {ri.status === 'new' && <span className="import-badge import-badge-new">NEW</span>}
                                    {ri.status === 'conflict-id' && <span className="import-badge import-badge-conflict">ID MATCH</span>}
                                    {ri.status === 'conflict-name' && <span className="import-badge import-badge-conflict">NAME MATCH</span>}
                                    {isConflict && <span className="import-item-existing">exists as "{ri.existingName}"</span>}
                                    <span className={`import-item-expand ${isExpanded ? 'expanded' : ''}`}>▸</span>
                                  </div>
                                  {isConflict && ri.checked && (
                                    <select
                                      className="import-action-select"
                                      value={ri.action}
                                      onChange={(e) => updateItem(getSetterForSection(sec.key) as never, idx, { action: e.target.value as ItemAction } as never)}
                                    >
                                      <option value="skip">Skip</option>
                                      <option value="overwrite">Overwrite</option>
                                      <option value="keepBoth">Keep Both</option>
                                    </select>
                                  )}
                                </div>
                                {isExpanded && (
                                  <div className="import-item-details">
                                    <div className="import-detail-col">
                                      <div className="import-detail-heading">Incoming</div>
                                      {getItemDetails(sec.key, ri.item).map((line, li) => (
                                        <div key={li} className="import-detail-line">{line}</div>
                                      ))}
                                    </div>
                                    {isConflict && !!ri.existingItem && (
                                      <div className="import-detail-col import-detail-existing">
                                        <div className="import-detail-heading">Existing</div>
                                        {getItemDetails(sec.key, ri.existingItem).map((line, li) => (
                                          <div key={li} className="import-detail-line">{line}</div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="import-summary-bar">
                {stats.willAdd > 0 && <span className="import-stat import-stat-new">{stats.willAdd} will be added</span>}
                {stats.willOverwrite > 0 && <span className="import-stat import-stat-conflict">{stats.willOverwrite} will overwrite</span>}
                {stats.willSkip > 0 && <span className="import-stat import-stat-skip">{stats.willSkip} will be skipped</span>}
                {stats.unchecked > 0 && <span className="import-stat import-stat-skip">{stats.unchecked} unchecked</span>}
              </div>
            </>
          )}
        </div>

        <div className="import-center-footer">
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!importData || itemsToImport === 0}
          >
            Import{itemsToImport > 0 ? ` (${itemsToImport} items)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
