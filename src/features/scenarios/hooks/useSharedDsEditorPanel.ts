/**
 * useSharedDsEditorPanel — Editor panel state and helpers for SharedDataSourceModal.
 * Handles fetch config display, tab navigation, and URL/mapping utilities.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import type { SharedDataSource, DataSource, Scenario, SharedDataSourceFetchConfig, GlobalAuthProfile, FeatureGroup } from '@shared/types';
import type { HttpResponse } from '@shared/utils/httpClient';
import { buildMappingSummary, extractTemplateVariables } from '../utils/dataSourceContract';
import { parseCurl } from '@shared/utils/curlParser';
import { buildScenarioFromFetchConfig } from '../utils/dataSourceSetupUtils';
import { proxyFetch } from '../../../engine/executor';
import { applyAuthHeaders } from '@shared/utils/applyAuthHeaders';

export type FetchTabId = 'params' | 'auth' | 'headers' | 'body';

export interface DetectedParam {
  name: string;
  source: 'path' | 'query';
  value?: string;
}

export interface UseSharedDsEditorPanelOptions {
  selected: SharedDataSource | null;
  sharedDataSources: SharedDataSource[];
  onUpdate: (sources: SharedDataSource[]) => void;
  featureGroups: FeatureGroup[];
  globalAuthProfiles: GlobalAuthProfile[];
}

export interface UseSharedDsEditorPanelReturn {
  fetchExpanded: boolean;
  setFetchExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  fetchTab: FetchTabId;
  setFetchTab: (tab: FetchTabId) => void;
  fetchUrlRowRef: React.RefObject<HTMLDivElement | null>;
  fetchHeadersRef: React.RefObject<HTMLDivElement | null>;
  fetchAuthRef: React.RefObject<HTMLDivElement | null>;
  fetchBodyRef: React.RefObject<HTMLDivElement | null>;
  fetchDraftScenario: Scenario | null;
  editorDraft: Scenario | null;
  mappingSummary: ReturnType<typeof buildMappingSummary>;
  detectedParams: DetectedParam[];
  headerCount: number;
  jumpToFetchSection: (section: 'url' | 'headers' | 'auth' | 'body') => void;
  handleEditorDraftChange: (updatedDraft: Scenario) => void;
  handleFetchRow: (
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    authOverride?: Scenario['auth'],
  ) => Promise<HttpResponse & { sentHeaders?: Record<string, string>; sentUrl?: string; sentMethod?: string; sentBody?: string }>;
  usedByExpanded: boolean;
  setUsedByExpanded: (v: boolean) => void;
}

export function defaultFetchConfig(): SharedDataSourceFetchConfig {
  return {
    url: '',
    method: 'GET',
    headers: [{ key: '', value: '' }],
    body: '',
    bodyType: 'none',
    auth: { type: 'none' },
  };
}

export function extractPathVariablesFromUrlTemplate(urlTemplate: string): Array<{ segmentIndex: number; variableName: string }> {
  if (!urlTemplate) return [];
  try {
    const pathOnly = (urlTemplate.split('?')[0] ?? '').trim();
    if (!pathOnly) return [];
    const parsed = new URL(pathOnly, 'http://x');
    const segments = parsed.pathname.split('/').filter(Boolean);
    const vars: Array<{ segmentIndex: number; variableName: string }> = [];
    for (let i = 0; i < segments.length; i++) {
      const match = segments[i].match(/^\{\{\s*([^{}\s]+)\s*\}\}$/);
      if (!match) continue;
      vars.push({ segmentIndex: i, variableName: match[1] });
    }
    return vars;
  } catch {
    return [];
  }
}

export function useSharedDsEditorPanel({
  selected,
  sharedDataSources,
  onUpdate,
  featureGroups,
  globalAuthProfiles,
}: UseSharedDsEditorPanelOptions): UseSharedDsEditorPanelReturn {
  const [fetchExpanded, setFetchExpanded] = useState(false);
  const [fetchTab, setFetchTab] = useState<FetchTabId>('params');
  const [usedByExpanded, setUsedByExpanded] = useState(false);
  const fetchUrlRowRef = useRef<HTMLDivElement>(null);
  const fetchHeadersRef = useRef<HTMLDivElement>(null);
  const fetchAuthRef = useRef<HTMLDivElement>(null);
  const fetchBodyRef = useRef<HTMLDivElement>(null);

  const fetchDraftScenario = useMemo<Scenario | null>(() => {
    if (!selected) return null;
    const cfg = selected.fetchConfig;
    if (!cfg?.url.trim()) return null;
    const hasTemplateVars = extractTemplateVariables(cfg.url).length > 0;
    const rawCurlUrl = cfg.rawCurl?.trim() ? parseCurl(cfg.rawCurl).url : undefined;
    const scenarioUrl = hasTemplateVars && rawCurlUrl ? rawCurlUrl : cfg.url;
    return buildScenarioFromFetchConfig(selected.id, selected.name, cfg, selected.dataSource, scenarioUrl);
  }, [selected]);

  const editorDraft = useMemo<Scenario | null>(() => {
    if (!selected) return null;
    return buildScenarioFromFetchConfig(selected.id, selected.name, selected.fetchConfig, selected.dataSource);
  }, [selected]);

  const mappingSummary = useMemo(() => {
    return buildMappingSummary(selected?.fetchConfig, selected?.dataSource);
  }, [selected?.fetchConfig, selected?.dataSource]);

  const detectedParams = useMemo<DetectedParam[]>(() => {
    const url = selected?.fetchConfig?.url ?? '';
    const pathOnly = url.split('?')[0] ?? '';
    const pathVars = extractTemplateVariables(pathOnly).map(v => ({ name: v, source: 'path' as const }));
    const queryPart = url.includes('?') ? url.split('?')[1] ?? '' : '';
    const queryVars = extractTemplateVariables(queryPart).map(v => ({ name: v, source: 'query' as const }));
    const queryKeys = queryPart.split('&').filter(Boolean).map(p => p.split('=')[0]).filter(Boolean);
    const templateVarNames = new Set([...pathVars.map(v => v.name), ...queryVars.map(v => v.name)]);
    const plainQueryParams = queryKeys
      .filter(k => !templateVarNames.has(k))
      .map(k => {
        const match = queryPart.match(new RegExp(`${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^&]*)`));
        return { name: k, source: 'query' as const, value: match?.[1] ?? '' };
      });
    return [...pathVars, ...queryVars, ...plainQueryParams];
  }, [selected?.fetchConfig?.url]);

  const headerCount = useMemo(() => {
    return (selected?.fetchConfig?.headers ?? []).filter(h => h.key.trim()).length;
  }, [selected?.fetchConfig?.headers]);

  const jumpToFetchSection = useCallback((section: 'url' | 'headers' | 'auth' | 'body') => {
    setFetchExpanded(true);
    setFetchTab(section === 'url' ? 'params' : section);
    const getTarget = () => {
      if (section === 'url') return fetchUrlRowRef.current;
      if (section === 'headers') return fetchHeadersRef.current;
      if (section === 'auth') return fetchAuthRef.current;
      return fetchBodyRef.current;
    };
    window.setTimeout(() => {
      const target = getTarget();
      if (!target) return;
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const field = target.querySelector('input, select, textarea') as HTMLElement | null;
      field?.focus();
    }, 0);
  }, []);

  const handleDataSourceChange = useCallback((newDs: DataSource) => {
    if (!selected) return;
    onUpdate(sharedDataSources.map(ds =>
      ds.id === selected.id ? { ...ds, dataSource: newDs, updatedAt: Date.now() } : ds,
    ));
  }, [selected, sharedDataSources, onUpdate]);

  const handleEditorDraftChange = useCallback((updatedDraft: Scenario) => {
    if (!selected || !updatedDraft.dataSource) return;
    const authChanged = updatedDraft.auth.type !== (selected.fetchConfig?.auth?.type ?? 'none')
      || JSON.stringify(updatedDraft.auth) !== JSON.stringify(selected.fetchConfig?.auth ?? { type: 'none' });
    if (authChanged && selected.fetchConfig) {
      onUpdate(sharedDataSources.map(ds =>
        ds.id === selected.id
          ? { ...ds, dataSource: updatedDraft.dataSource!, fetchConfig: { ...ds.fetchConfig!, auth: updatedDraft.auth }, updatedAt: Date.now() }
          : ds,
      ));
    } else {
      handleDataSourceChange(updatedDraft.dataSource);
    }
  }, [selected, sharedDataSources, onUpdate, handleDataSourceChange]);

  const handleFetchRow = useCallback(async (
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    authOverride?: Scenario['auth'],
  ) => {
    const cfg = selected?.fetchConfig;
    let auth = authOverride ?? cfg?.auth ?? { type: 'none' as const };

    if (auth.type === 'inherit' || auth.type === 'none') {
      for (const fg of featureGroups) {
        if (fg.auth && fg.auth.type !== 'none' && fg.auth.type !== 'inherit') {
          auth = fg.auth;
          break;
        }
        if (fg.auth?.type === 'inherit' && fg.globalAuthProfileId) {
          const p = globalAuthProfiles.find(gp => gp.id === fg.globalAuthProfileId);
          if (p && p.auth.type !== 'none' && p.auth.type !== 'inherit') {
            auth = p.auth;
            break;
          }
        }
      }
    }

    if ((auth.type === 'inherit' || auth.type === 'none') && globalAuthProfiles.length > 0) {
      const p = globalAuthProfiles.find(gp => gp.auth.type !== 'none' && gp.auth.type !== 'inherit');
      if (p) auth = p.auth;
    }

    const reqHeaders = { ...headers };
    await applyAuthHeaders(auth, reqHeaders);

    const response = await proxyFetch(url, method, reqHeaders, body);
    return {
      ...response,
      sentHeaders: reqHeaders,
      sentUrl: url,
      sentMethod: method,
      sentBody: body,
    };
  }, [selected?.fetchConfig, featureGroups, globalAuthProfiles]);

  return {
    fetchExpanded,
    setFetchExpanded,
    fetchTab,
    setFetchTab,
    fetchUrlRowRef,
    fetchHeadersRef,
    fetchAuthRef,
    fetchBodyRef,
    fetchDraftScenario,
    editorDraft,
    mappingSummary,
    detectedParams,
    headerCount,
    jumpToFetchSection,
    handleEditorDraftChange,
    handleFetchRow,
    usedByExpanded,
    setUsedByExpanded,
  };
}
