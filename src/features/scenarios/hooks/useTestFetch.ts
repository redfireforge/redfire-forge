import { useState, useCallback, useEffect, type MutableRefObject } from 'react';
import type { Scenario, AuthConfig, FailureDetail, FeatureGroup, GlobalAuthProfile } from '../../../shared/types';
import { serializeWithContentType, getEffectiveBodyType } from '../../../shared/utils/bodySerializer';
import { toErrorMessage, prettyJson } from '../../../shared/utils/helpers';
import { proxyFetch } from '../../../engine/executor';
import { acquireOAuth2Token } from '../../../engine/tokenManager';
import { resolveAuthHeaders } from '../../../shared/utils/authHeaders';
import { MapperFetchError, type FetchErrorDetail } from '../../../shared/components/data-mapper/types';
import { validate, evaluateAssertions, type AssertionContext } from '../../../engine/validator';
import { jsonEqual } from '../utils/testEditorUtils';
import { getByPath } from '../../../shared/utils/jsonPath';
import { hasExpectedFields, hasActiveRules, hasAssertions, hasSampleJson, getExpectedFields } from '../utils/validationHelpers';

// ─── Shared helpers ──────────────────────────────────────────

interface AuthResolution {
  auth: AuthConfig;
  source: string;
}

/**
 * Walk the auth inheritance chain:
 *   test → scenario → feature group → global profile.
 */
export function resolveEffectiveAuthFromHierarchy(
  draft: Scenario,
  featureGroups: FeatureGroup[],
  editingFgId: string,
  editingScenarioId: string,
  allAuthProfiles: GlobalAuthProfile[],
): AuthResolution {
  if (draft.auth.type !== 'inherit' && draft.auth.type !== 'none') {
    return { auth: draft.auth, source: 'test' };
  }
  const fg = featureGroups.find((f) => f.id === editingFgId);
  const sc = fg?.scenarios.find((s) => s.id === editingScenarioId);

  if (draft.auth.type === 'inherit' || draft.auth.type === 'none') {
    if (sc?.auth && sc.auth.type !== 'none' && sc.auth.type !== 'inherit') {
      return { auth: sc.auth, source: 'scenario' };
    }
    if (fg?.auth && fg.auth.type !== 'none' && fg.auth.type !== 'inherit') {
      return { auth: fg.auth, source: 'feature' };
    }
    if ((fg?.auth?.type === 'inherit' || !fg?.auth || fg.auth.type === 'none') && fg?.globalAuthProfileId) {
      const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
      if (profile && profile.auth.type !== 'none') {
        return { auth: profile.auth, source: `global:${profile.name}` };
      }
    }
  }
  return { auth: { type: 'none' }, source: 'none' };
}

/**
 * Build request headers from the scenario's KV headers, applying auth headers.
 * Deduplicates the header-building pattern that was repeated across fetch & validate.
 */
export async function buildAuthedRequest(
  draft: Scenario,
  effectiveAuth: AuthConfig,
  authSource: string,
): Promise<{ headers: Record<string, string>; body: string | undefined; fetchError?: string }> {
  const reqHeaders: Record<string, string> = {};
  for (const h of draft.headers) {
    if (!h.key.trim()) continue;
    if (h.key.trim().toLowerCase() === 'authorization' && effectiveAuth.type !== 'none') continue;
    reqHeaders[h.key.trim()] = h.value;
  }
  const { body: reqBody, contentType: autoContentType } = serializeWithContentType(draft);
  const bt = getEffectiveBodyType(draft);
  if (bt === 'form-data' && autoContentType) {
    reqHeaders['Content-Type'] = autoContentType;
  } else if (!reqHeaders['Content-Type'] && autoContentType) {
    reqHeaders['Content-Type'] = autoContentType;
  }

  if (effectiveAuth.type === 'oauth2') {
    if (!effectiveAuth.tokenUrl || !effectiveAuth.clientId || !effectiveAuth.clientSecret) {
      const missing = [
        !effectiveAuth.tokenUrl && 'tokenUrl',
        !effectiveAuth.clientId && 'clientId',
        !effectiveAuth.clientSecret && 'clientSecret',
      ].filter(Boolean).join(', ');
      return {
        headers: reqHeaders,
        body: reqBody,
        fetchError: `OAuth2 missing: ${missing} (auth source: ${authSource}). Configure OAuth2 credentials in the scenario auth panel.`,
      };
    }
    const token = await acquireOAuth2Token(effectiveAuth);
    Object.assign(reqHeaders, resolveAuthHeaders(effectiveAuth, token));
  } else if (effectiveAuth.type !== 'none') {
    Object.assign(reqHeaders, resolveAuthHeaders(effectiveAuth));
  }

  return { headers: reqHeaders, body: reqBody };
}

import { createResponseVersion, createRulesVersion } from '../utils/versionFactory';

/** @deprecated Use `createResponseVersion` from `versionFactory.ts` directly. */
export const buildResponseVersion = createResponseVersion;
/** @deprecated Use `createRulesVersion` from `versionFactory.ts` directly. */
export const buildRulesVersion = createRulesVersion;

// ─── Hook ────────────────────────────────────────────────────

export interface UseTestFetchOptions {
  draftRef: MutableRefObject<Scenario>;
  onDraftChange: (draft: Scenario) => void;
  featureGroups: FeatureGroup[];
  editingFgId: string;
  editingScenarioId: string;
  editingTestId: string;
  allAuthProfiles: GlobalAuthProfile[];
  draftId: string;
}

export function useTestFetch({
  draftRef,
  onDraftChange,
  featureGroups,
  editingFgId,
  editingScenarioId,
  editingTestId,
  allAuthProfiles,
  draftId,
}: UseTestFetchOptions) {
  const [fetchingResponse, setFetchingResponse] = useState(false);
  const [fetchError, setFetchError] = useState<FetchErrorDetail | null>(null);
  const [fetchHostOverride, setFetchHostOverride] = useState(draftRef.current.fetchHostOverride || '');
  const [fetchHostEnabled, setFetchHostEnabled] = useState(!!draftRef.current.fetchHostEnabled);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    passed: boolean;
    failures: FailureDetail[];
    httpStatus?: number;
    statusText?: string;
    responseJson?: string;
    responseHeaders?: Record<string, string>;
    verifyScope?: 'all' | 'assertions' | 'rules';
  } | null>(null);

  const [pendingFetchResponse, setPendingFetchResponse] = useState<string | null>(null);

  // Reset local state when the test switches
  useEffect(() => {
    setFetchError(null);
    setFetchHostOverride(draftRef.current.fetchHostOverride || '');
    setFetchHostEnabled(!!draftRef.current.fetchHostEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingFgId, editingScenarioId, editingTestId, draftId]);

  // Sync fetchHost changes back to draft
  useEffect(() => {
    const prev = draftRef.current;
    if (prev.fetchHostOverride !== fetchHostOverride || !!prev.fetchHostEnabled !== fetchHostEnabled) {
      onDraftChange({ ...prev, fetchHostOverride, fetchHostEnabled });
    }
  }, [fetchHostOverride, fetchHostEnabled, onDraftChange, draftRef]);

  // ── resolveEffectiveAuth ──

  const resolveEffectiveAuth = useCallback((): AuthResolution => {
    return resolveEffectiveAuthFromHierarchy(
      draftRef.current,
      featureGroups,
      editingFgId,
      editingScenarioId,
      allAuthProfiles,
    );
  }, [draftRef, featureGroups, editingFgId, editingScenarioId, allAuthProfiles]);

  // ── URL overrides ──

  const applyFetchUrlOverrides = useCallback((url: string, auth: AuthConfig): string => {
    let fetchUrl = url;
    if (fetchHostEnabled && fetchHostOverride.trim()) {
      try {
        const orig = new URL(fetchUrl);
        const base = new URL(fetchHostOverride.trim().endsWith('/') ? fetchHostOverride.trim() : `${fetchHostOverride.trim()}/`);
        orig.protocol = base.protocol;
        orig.host = base.host;
        fetchUrl = orig.toString();
      } catch { /* keep original */ }
    }
    if (auth.type === 'apikey' && auth.apiKeyIn === 'query' && auth.apiKeyName && auth.apiKeyValue) {
      try {
        const u = new URL(fetchUrl);
        u.searchParams.set(auth.apiKeyName, auth.apiKeyValue);
        fetchUrl = u.toString();
      } catch { /* keep original */ }
    }
    return fetchUrl;
  }, [fetchHostEnabled, fetchHostOverride]);

  // ── Fetch a single data-source row (used by DataSourceEditor) ──

  const handleFetchRow = useCallback(async (
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
  ) => {
    const { auth: effectiveAuth } = resolveEffectiveAuth();
    const reqHeaders = { ...headers };

    if (effectiveAuth.type === 'oauth2') {
      const token = await acquireOAuth2Token(effectiveAuth);
      Object.assign(reqHeaders, resolveAuthHeaders(effectiveAuth, token));
    } else if (effectiveAuth.type !== 'none') {
      Object.assign(reqHeaders, resolveAuthHeaders(effectiveAuth));
    }

    const fetchUrl = applyFetchUrlOverrides(url, effectiveAuth);
    const result = await proxyFetch(fetchUrl, method, reqHeaders, body);
    return { ...result, sentHeaders: reqHeaders };
  }, [resolveEffectiveAuth, applyFetchUrlOverrides]);

  // ── Fetch sample response ──

  const handleFetchSampleResponse = useCallback(async () => {
    const cur = draftRef.current;
    if (!cur.url.trim()) {
      setFetchError({ message: 'URL is required' });
      return;
    }
    setFetchingResponse(true);
    setFetchError(null);
    try {
      const { auth: effectiveAuth, source: authSource } = resolveEffectiveAuth();
      const { headers: reqHeaders, body: reqBody, fetchError: authError } = await buildAuthedRequest(cur, effectiveAuth, authSource);

      if (authError) {
        setFetchError({ message: authError });
        setFetchingResponse(false);
        return;
      }

      const fetchUrl = applyFetchUrlOverrides(cur.url, effectiveAuth);
      const result = await proxyFetch(fetchUrl, cur.method, reqHeaders, reqBody);
      const latest = draftRef.current;

      if (result.error) {
        setFetchError({
          message: result.error,
          status: result.status || undefined,
          statusText: result.statusText || undefined,
          headers: result.headers,
          body: result.body || undefined,
          timing: result.timing ? { ttfb: result.timing.ttfb, total: result.timing.total } : undefined,
        });
      } else if (result.status >= 400) {
        setFetchError({
          message: `HTTP ${result.status}: ${result.statusText}`,
          status: result.status,
          statusText: result.statusText,
          headers: result.headers,
          body: result.body || undefined,
          timing: result.timing ? { ttfb: result.timing.ttfb, total: result.timing.total } : undefined,
        });
        if (result.body) {
          const pretty = prettyJson(result.body);
          onDraftChange({ ...latest, validation: { ...latest.validation, sampleJson: pretty } });
        }
      } else {
        const pretty = prettyJson(result.body);
        const v = latest.validation;
        if (hasExpectedFields(v) || hasSampleJson(v)) {
          setPendingFetchResponse(pretty);
        } else {
          const prevVersions = v.responseVersions || [];
          const latestVersion = prevVersions.length > 0 ? prevVersions[prevVersions.length - 1] : null;
          const isDup = latestVersion ? jsonEqual(latestVersion.json, pretty, v.excludedPaths) : false;
          const updatedVersions = isDup
            ? prevVersions
            : [...prevVersions, buildResponseVersion(v, pretty)];
          onDraftChange({
            ...latest,
            validation: {
              ...latest.validation,
              sampleJson: pretty,
              expectedFields: [],
              responseVersions: updatedVersions,
            },
          });
        }
        setFetchError(null);
      }
    } catch (err) {
      setFetchError({ message: toErrorMessage(err) });
    } finally {
      setFetchingResponse(false);
    }
  }, [draftRef, applyFetchUrlOverrides, onDraftChange, resolveEffectiveAuth]);

  // ── Pending fetch response handlers ──

  const handleFetchKeepRules = useCallback(() => {
    if (!pendingFetchResponse) return;
    const latest = draftRef.current;
    const v = latest.validation;
    const prevVersions = v.responseVersions || [];
    const updatedVersions = hasSampleJson(v)
      ? [...prevVersions, buildResponseVersion(v, v.sampleJson || '')]
      : prevVersions;
    const currentExpectedFields = getExpectedFields(v);
    let updatedExpectedFields = currentExpectedFields;
    try {
      const parsed = JSON.parse(pendingFetchResponse);
      updatedExpectedFields = currentExpectedFields.map((field) => {
        const nextValue = getByPath(parsed, field.jsonPath);
        if (nextValue === undefined) return field;
        return { ...field, expectedValue: JSON.stringify(nextValue) };
      });
    } catch { /* keep existing values when response is not JSON */ }
    onDraftChange({
      ...latest,
      validation: {
        ...latest.validation,
        sampleJson: pendingFetchResponse,
        expectedFields: updatedExpectedFields,
        responseVersions: updatedVersions,
      },
    });
    setPendingFetchResponse(null);
  }, [pendingFetchResponse, onDraftChange, draftRef]);

  const handleFetchReplaceAll = useCallback(() => {
    if (!pendingFetchResponse) return;
    const latest = draftRef.current;
    const v = latest.validation;
    const prevVersions = v.responseVersions || [];
    const updatedVersions = hasSampleJson(v)
      ? [...prevVersions, buildResponseVersion(v, v.sampleJson || '')]
      : prevVersions;
    const prevRulesVersions = v.rulesVersions || [];
    const updatedRulesVersions = hasExpectedFields(v)
      ? [...prevRulesVersions, buildRulesVersion(v)]
      : prevRulesVersions;
    onDraftChange({
      ...latest,
      validation: {
        ...latest.validation,
        sampleJson: pendingFetchResponse,
        expectedFields: [],
        responseVersions: updatedVersions,
        rulesVersions: updatedRulesVersions,
      },
    });
    setPendingFetchResponse(null);
  }, [pendingFetchResponse, onDraftChange, draftRef]);

  const handleFetchCancel = useCallback(() => {
    setPendingFetchResponse(null);
  }, []);

  // ── Fetch for mapper (returns body without updating draft) ──

  const fetchSampleDataForMapper = useCallback(async (): Promise<unknown> => {
    const cur = draftRef.current;
    if (!cur.url.trim()) throw new Error('URL is required');
    const { auth: effectiveAuth, source: authSource } = resolveEffectiveAuth();
    const { headers: reqHeaders, body: reqBody, fetchError: authError } = await buildAuthedRequest(cur, effectiveAuth, authSource);
    if (authError) throw new Error(authError);
    const fetchUrl = applyFetchUrlOverrides(cur.url, effectiveAuth);
    const result = await proxyFetch(fetchUrl, cur.method, reqHeaders, reqBody);
    if (result.error) throw new MapperFetchError({
      message: result.error,
      status: result.status || undefined,
      statusText: result.statusText || undefined,
      headers: result.headers,
      body: result.body || undefined,
      timing: result.timing ? { ttfb: result.timing.ttfb, total: result.timing.total } : undefined,
    });
    if (result.status >= 400) throw new MapperFetchError({
      message: `HTTP ${result.status}: ${result.statusText}`,
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
      body: result.body || undefined,
      timing: result.timing ? { ttfb: result.timing.ttfb, total: result.timing.total } : undefined,
    });
    try { return JSON.parse(result.body); } catch { return result.body; }
  }, [draftRef, applyFetchUrlOverrides, resolveEffectiveAuth]);

  // ── Validate response ──

  const handleValidateResponse = useCallback(async (scope: 'assertions' | 'rules' | 'all' = 'all') => {
    const cur = draftRef.current;
    if (!cur.url.trim()) {
      setValidationResult({ passed: false, failures: [{ path: '(url)', expected: 'a URL', actual: 'empty' }] });
      return;
    }
    const v = cur.validation;
    const rulesConfigured = hasActiveRules(v);
    const assertionsConfigured = hasAssertions(v);

    if (scope === 'rules' && !rulesConfigured) {
      setValidationResult({ passed: false, failures: [{ path: '(config)', expected: 'validation rules', actual: 'no rules configured' }] });
      return;
    }
    if (scope === 'assertions' && !assertionsConfigured) {
      setValidationResult({ passed: false, failures: [{ path: '(config)', expected: 'assertions', actual: 'no assertions configured' }] });
      return;
    }
    if (scope === 'all' && !rulesConfigured && !assertionsConfigured) {
      setValidationResult({ passed: false, failures: [{ path: '(config)', expected: 'validation rules or assertions', actual: 'none configured' }] });
      return;
    }

    setValidating(true);
    setValidationResult(null);
    try {
      const { auth: effectiveAuth, source: authSource } = resolveEffectiveAuth();
      const { headers: reqHeaders, body: reqBody, fetchError: authError } = await buildAuthedRequest(cur, effectiveAuth, authSource);

      if (authError) {
        setValidationResult({ passed: false, failures: [{ path: '(auth)', expected: 'OAuth2 credentials', actual: 'missing tokenUrl/clientId/clientSecret' }] });
        setValidating(false);
        return;
      }

      const fetchUrl = applyFetchUrlOverrides(cur.url, effectiveAuth);
      const result = await proxyFetch(fetchUrl, cur.method, reqHeaders, reqBody);

      if (result.error) {
        setValidationResult({ passed: false, failures: [{ path: '(network)', expected: 'response', actual: result.error }] });
        return;
      }
      if (result.status >= 400) {
        setValidationResult({
          passed: false,
          httpStatus: result.status,
          statusText: result.statusText,
          failures: [{ path: '(http)', expected: '2xx', actual: `${result.status} ${result.statusText}` }],
          responseJson: result.body,
          responseHeaders: result.headers,
        });
        return;
      }

      let responseObj: unknown;
      try { responseObj = JSON.parse(result.body); } catch { responseObj = result.body; }

      const allFailures: FailureDetail[] = [];

      if (scope === 'rules' || scope === 'all') {
        if (rulesConfigured) {
          allFailures.push(...validate(v, responseObj));
        }
      }

      if (scope === 'assertions' || scope === 'all') {
        if (assertionsConfigured) {
          const responseHeaders: Record<string, string> = {};
          if (result.headers) {
            for (const [k, val] of Object.entries(result.headers)) {
              if (typeof val === 'string') responseHeaders[k] = val;
            }
          }
          const ctx: AssertionContext = {
            httpStatus: result.status ?? 200,
            responseTimeMs: 0,
            responseHeaders,
            responseBody: responseObj,
          };
          const assertionResult = evaluateAssertions(v.assertions!, ctx);
          allFailures.push(...assertionResult.failures);
        }
      }

      setValidationResult({
        passed: allFailures.length === 0,
        failures: allFailures,
        httpStatus: result.status,
        responseJson: result.body,
        verifyScope: scope,
      });
    } catch (err) {
      setValidationResult({ passed: false, failures: [{ path: '(error)', expected: 'success', actual: toErrorMessage(err) }] });
    } finally {
      setValidating(false);
    }
  }, [draftRef, applyFetchUrlOverrides, resolveEffectiveAuth]);

  return {
    // State
    fetchingResponse,
    fetchError,
    fetchHostOverride,
    setFetchHostOverride,
    fetchHostEnabled,
    setFetchHostEnabled,
    validating,
    validationResult,
    setValidationResult,
    pendingFetchResponse,
    // Callbacks
    resolveEffectiveAuth,
    applyFetchUrlOverrides,
    handleFetchRow,
    handleFetchSampleResponse,
    fetchSampleDataForMapper,
    handleFetchKeepRules,
    handleFetchReplaceAll,
    handleFetchCancel,
    handleValidateResponse,
  } as const;
}
