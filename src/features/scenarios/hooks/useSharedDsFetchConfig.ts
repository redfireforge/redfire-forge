import { useState, useCallback, useEffect } from 'react';
import type { SharedDataSource, SharedDataSourceFetchConfig, Scenario } from '../../../shared/types';
import { parseCurl } from '../../../shared/utils/curlParser';
import { buildScenarioFromFetchConfig } from '../utils/dataSourceSetupUtils';

function defaultFetchConfig(): SharedDataSourceFetchConfig {
  return {
    url: '',
    method: 'GET',
    headers: [{ key: '', value: '' }],
    body: '',
    bodyType: 'none',
    auth: { type: 'none' },
  };
}

/**
 * Hook that manages all fetch-configuration handlers for a shared data source.
 */
export function useSharedDsFetchConfig(
  selected: SharedDataSource | undefined,
  sharedDataSources: SharedDataSource[],
  onUpdate: (sources: SharedDataSource[]) => void,
) {
  const [curlInput, setCurlInput] = useState('');
  const [curlImportExpanded, setCurlImportExpanded] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [wizardScenario, setWizardScenario] = useState<Scenario | null>(null);

  useEffect(() => {
    setCurlInput(selected?.fetchConfig?.rawCurl ?? '');
  }, [selected?.id, selected?.fetchConfig?.rawCurl]);

  const handleFetchConfigChange = useCallback((patch: Partial<SharedDataSourceFetchConfig>) => {
    if (!selected) return;
    const next = { ...(selected.fetchConfig ?? defaultFetchConfig()), ...patch };
    onUpdate(sharedDataSources.map(ds =>
      ds.id === selected.id ? { ...ds, fetchConfig: next, updatedAt: Date.now() } : ds,
    ));
  }, [selected, sharedDataSources, onUpdate]);

  const handleFetchHeaderChange = useCallback((idx: number, field: 'key' | 'value', value: string) => {
    if (!selected) return;
    const current = selected.fetchConfig ?? defaultFetchConfig();
    const headers = [...current.headers];
    if (!headers[idx]) return;
    headers[idx] = { ...headers[idx], [field]: value };
    handleFetchConfigChange({ headers });
  }, [selected, handleFetchConfigChange]);

  const handleAddFetchHeader = useCallback(() => {
    if (!selected) return;
    const current = selected.fetchConfig ?? defaultFetchConfig();
    handleFetchConfigChange({ headers: [...current.headers, { key: '', value: '' }] });
  }, [selected, handleFetchConfigChange]);

  const handleRemoveFetchHeader = useCallback((idx: number) => {
    if (!selected) return;
    const current = selected.fetchConfig ?? defaultFetchConfig();
    const nextHeaders = current.headers.filter((_, i) => i !== idx);
    handleFetchConfigChange({ headers: nextHeaders.length > 0 ? nextHeaders : [{ key: '', value: '' }] });
  }, [selected, handleFetchConfigChange]);

  const handleImportCurl = useCallback(() => {
    if (!selected || !curlInput.trim()) return;
    const parsed = parseCurl(curlInput);
    const method = parsed.method && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(parsed.method)
      ? parsed.method as SharedDataSourceFetchConfig['method']
      : (selected.fetchConfig?.method ?? 'GET');

    let parsedHeaders = parsed.headers && parsed.headers.length > 0
      ? parsed.headers
      : (selected.fetchConfig?.headers ?? [{ key: '', value: '' }]);

    let parsedAuth = parsed.auth ?? selected.fetchConfig?.auth ?? { type: 'none' as const };
    const authHeader = parsedHeaders.find(h => h.key.trim().toLowerCase() === 'authorization')?.value ?? '';
    const bearerMatch = authHeader.match(/^([^\s]+)\s+(.+)$/);
    if (bearerMatch && bearerMatch[1].toLowerCase() === 'bearer' && bearerMatch[2].trim()) {
      parsedAuth = { type: 'bearer', prefix: bearerMatch[1], token: bearerMatch[2].trim() };
      parsedHeaders = parsedHeaders.filter(h => h.key.trim().toLowerCase() !== 'authorization');
      if (parsedHeaders.length === 0) parsedHeaders = [{ key: '', value: '' }];
    }

    const next: SharedDataSourceFetchConfig = {
      ...(selected.fetchConfig ?? defaultFetchConfig()),
      url: parsed.url ?? selected.fetchConfig?.url ?? '',
      method,
      headers: parsedHeaders,
      body: parsed.body ?? selected.fetchConfig?.body ?? '',
      bodyType: parsed.bodyType ?? selected.fetchConfig?.bodyType ?? (parsed.body ? 'json' : 'none'),
      auth: parsedAuth,
      rawCurl: curlInput,
    };
    handleFetchConfigChange(next);
    setWizardScenario(buildScenarioFromFetchConfig(selected.id, selected.name, next, selected.dataSource));
    setShowSetupWizard(true);
    setCurlImportExpanded(false);
  }, [selected, curlInput, handleFetchConfigChange]);

  const handleCurlInputChange = useCallback((value: string) => {
    setCurlInput(value);
    if (!selected) return;
    const current = selected.fetchConfig ?? defaultFetchConfig();
    handleFetchConfigChange({ ...current, rawCurl: value });
  }, [selected, handleFetchConfigChange]);

  const handleFetchAuthTypeChange = useCallback((type: SharedDataSourceFetchConfig['auth'] extends infer A ? A extends { type: infer T } ? T : never : never) => {
    if (!selected) return;
    handleFetchConfigChange({ auth: { type: type as 'none' | 'inherit' | 'basic' | 'bearer' | 'apikey' | 'digest' | 'oauth2' } });
  }, [selected, handleFetchConfigChange]);

  const handleFetchAuthPatch = useCallback((patch: Record<string, string>) => {
    if (!selected) return;
    const current = selected.fetchConfig ?? defaultFetchConfig();
    const currentAuth = current.auth ?? { type: 'none' as const };
    handleFetchConfigChange({ auth: { ...currentAuth, ...patch } });
  }, [selected, handleFetchConfigChange]);

  return {
    curlInput,
    curlImportExpanded, setCurlImportExpanded,
    showSetupWizard, setShowSetupWizard,
    wizardScenario, setWizardScenario,
    handleFetchConfigChange,
    handleFetchHeaderChange,
    handleAddFetchHeader,
    handleRemoveFetchHeader,
    handleImportCurl,
    handleCurlInputChange,
    handleFetchAuthTypeChange,
    handleFetchAuthPatch,
  };
}
