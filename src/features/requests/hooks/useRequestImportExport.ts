import { useCallback, useState } from 'react';
import type { RequestItem, HttpMethod, Scenario } from '../../../shared/types';
import { parseCurl } from '../../../shared/utils/curlParser';
import { buildCurlCommand } from '../../../shared/utils/curlGenerator';
import type { AuthConfig } from '../../../shared/types';
import { pickJsonFile, unwrapImport } from '../../scenarios/utils/testEditorUtils';
import { saveFile } from '../../../shared/utils/fileSaver';
import { toErrorMessage } from '../../../shared/utils/helpers';
import { useToast } from '../../../shared/hooks/useToast';
import type { RequestInputMode, RequestSubTab } from '../../../shared/types';

export interface UseRequestImportExportOptions {
  request: RequestItem;
  onUpdateRequest: (patch: Partial<RequestItem>) => void;
  stripToRelative: (url: string) => string;
  resolveAuth: (envId?: string) => AuthConfig;
  asDraftScenario: () => Scenario;
  subColEnvId?: string;
  selectedEnvId?: string;
  setInputMode: (mode: RequestInputMode) => void;
  setActiveTab: (tab: RequestSubTab) => void;
}

export function useRequestImportExport({
  request,
  onUpdateRequest,
  stripToRelative,
  resolveAuth,
  asDraftScenario,
  subColEnvId,
  selectedEnvId,
  setInputMode,
  setActiveTab,
}: UseRequestImportExportOptions) {
  const toast = useToast();
  const [curlText, setCurlText] = useState('');
  const [generatedCurl, setGeneratedCurl] = useState('');
  const [curlGenerating, setCurlGenerating] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);

  const handleCurlImport = useCallback(() => {
    if (!curlText.trim()) return;
    const parsed = parseCurl(curlText);
    const { id: _discardId, validation: _discardVal, name: parsedName, ...parsedFields } = parsed as Scenario;
    const patch: Partial<typeof parsedFields & { name?: string }> = {
      ...parsedFields,
      url: stripToRelative(parsedFields.url),
      method: parsedFields.method as HttpMethod,
    };
    if (!request.name.trim() && parsedName) patch.name = parsedName;
    onUpdateRequest(patch as Partial<RequestItem>);
    setInputMode('builder');
    setCurlText('');
    if (parsed.bodyType && parsed.bodyType !== 'none' && parsed.method !== 'GET') setActiveTab('body');
  }, [curlText, onUpdateRequest, stripToRelative, request.name, setInputMode, setActiveTab]);

  const triggerCurlGeneration = useCallback(async () => {
    if (!request.url.trim()) { setGeneratedCurl(''); return; }
    setCurlGenerating(true);
    try {
      const effectiveEnvId = subColEnvId || selectedEnvId;
      const cmd = await buildCurlCommand(asDraftScenario(), resolveAuth(effectiveEnvId));
      setGeneratedCurl(cmd);
    } catch (err) { setGeneratedCurl(`# Error: ${toErrorMessage(err)}`); }
    finally { setCurlGenerating(false); }
  }, [asDraftScenario, resolveAuth, request.url, subColEnvId, selectedEnvId]);

  const handleCopyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(generatedCurl);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2000);
  }, [generatedCurl]);

  const handleJsonImport = useCallback(() => {
    pickJsonFile((raw) => {
      const data = unwrapImport(raw) as Record<string, unknown>;
      if (!data.name || !data.url || !data.method) {
        toast.show('error', 'Invalid file', 'Expected a request with name, url, and method.');
        return;
      }
      const imported = data as unknown as RequestItem;
      onUpdateRequest({
        name: imported.name, method: imported.method, url: stripToRelative(imported.url),
        headers: imported.headers || [{ key: '', value: '' }], body: imported.body || '',
        bodyType: imported.bodyType, bodyForm: imported.bodyForm, auth: imported.auth || { type: 'inherit' },
      });
      setInputMode('builder');
    });
  }, [onUpdateRequest, stripToRelative, toast, setInputMode]);

  const handleJsonExport = useCallback(async () => {
    const payload = {
      _exportMeta: { type: 'requests-request', version: 1, exportedAt: new Date().toISOString() },
      data: {
        name: request.name, method: request.method, url: request.url, headers: request.headers,
        body: request.body, bodyType: request.bodyType, bodyForm: request.bodyForm, auth: request.auth,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const filename = `${request.name || 'request'}.json`;
    await saveFile(blob, { filename, mimeType: 'application/json', description: 'JSON file' });
  }, [request]);

  return {
    curlText, setCurlText,
    generatedCurl,
    curlGenerating,
    curlCopied,
    handleCurlImport,
    triggerCurlGeneration,
    handleCopyToClipboard,
    handleJsonImport,
    handleJsonExport,
  };
}
