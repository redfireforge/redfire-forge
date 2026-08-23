import { useState, useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { Scenario, FailureDetail } from '@shared/types';
import type { FetchErrorDetail } from '@shared/components/data-mapper/types';
import { MapperFetchError } from '@shared/components/data-mapper/types';
import { validate, evaluateAssertions, type AssertionContext } from '../../../engine/validator';
import { fetchScenarioSample } from '../engine/fetchScenarioSample';
import { prettyJson, parseJsonOrRaw, isValidJson, toErrorMessage } from '@shared/utils/helpers';
import { getByPath } from '@shared/utils/jsonPath';
import { createResponseVersion, createRulesVersion } from '../../scenarios/utils/versionFactory';
import { hasActiveRules, hasAssertions, hasExpectedFields, hasSampleJson, getExpectedFields, checkValidationScopeGuards } from '../../scenarios/utils/validationHelpers';
import { jsonEqual } from '../../scenarios/utils/testEditorUtils';

export interface UseWorkflowValidationFetchOptions {
  draftRef: MutableRefObject<Scenario>;
  onDraftChange: (draft: Scenario) => void;
  /** Merged workflow + entry + per-step variables for template resolution. */
  liveVariables: Record<string, string>;
  /** Resolved base URL from service registry / environment. */
  resolvedBaseUrl: string;
  /** Resolved auth from service registry — used when scenario auth is 'inherit'. */
  resolvedAuth?: Scenario['auth'];
  /** Reset trigger — changes when node/workflow selection changes. */
  resetKey?: string;
}

export function useWorkflowValidationFetch({
  draftRef,
  onDraftChange,
  liveVariables,
  resolvedBaseUrl,
  resolvedAuth,
  resetKey,
}: UseWorkflowValidationFetchOptions) {
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

  // Track the last values this hook wrote to the draft, to distinguish
  // our own sync writes from external changes (e.g. Extract tab).
  const lastWrittenHost = useRef({ override: fetchHostOverride, enabled: fetchHostEnabled });

  useEffect(() => {
    setFetchError(null);
    setPendingFetchResponse(null);
    setValidationResult(null);
    const nextOverride = draftRef.current.fetchHostOverride || '';
    const nextEnabled = !!draftRef.current.fetchHostEnabled;
    setFetchHostOverride(nextOverride);
    setFetchHostEnabled(nextEnabled);
    lastWrittenHost.current = { override: nextOverride, enabled: nextEnabled };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Sync local → draft when the user changes host override via the Validation tab UI.
  useEffect(() => {
    const prev = draftRef.current;
    if (prev.fetchHostOverride !== fetchHostOverride || !!prev.fetchHostEnabled !== fetchHostEnabled) {
      lastWrittenHost.current = { override: fetchHostOverride, enabled: fetchHostEnabled };
      onDraftChange({ ...prev, fetchHostOverride, fetchHostEnabled });
    }
  }, [fetchHostOverride, fetchHostEnabled, onDraftChange, draftRef]);

  // Sync draft → local when another tab (e.g. Extract) externally changed the host override.
  // Runs on every render but only sets state when there's an actual external mismatch.
  const draftOverride = draftRef.current.fetchHostOverride || '';
  const draftEnabled = !!draftRef.current.fetchHostEnabled;
  if (draftOverride !== lastWrittenHost.current.override || draftEnabled !== lastWrittenHost.current.enabled) {
    if (draftOverride !== fetchHostOverride || draftEnabled !== fetchHostEnabled) {
      setFetchHostOverride(draftOverride);
      setFetchHostEnabled(draftEnabled);
      lastWrittenHost.current = { override: draftOverride, enabled: draftEnabled };
    }
  }

  const handleFetchSampleResponse = useCallback(async () => {
    const cur = draftRef.current;
    if (!cur.url.trim()) {
      setFetchError({ message: 'URL is required' });
      return;
    }
    setFetchingResponse(true);
    setFetchError(null);
    try {
      const result = await fetchScenarioSample(cur, liveVariables, resolvedBaseUrl, {
        fetchHostEnabled,
        fetchHostOverride,
        resolvedAuth,
      });

      const latest = draftRef.current;
      if (!result.ok) {
        setFetchError({
          message: result.error,
          status: result.httpStatus,
          body: result.body,
        });
        if (result.body && isValidJson(result.body)) {
          onDraftChange({ ...latest, validation: { ...latest.validation, sampleJson: prettyJson(result.body) } });
        }
      } else {
        const pretty = prettyJson(result.body);
        const v = latest.validation;
        if (hasExpectedFields(v) || hasSampleJson(v)) {
          setPendingFetchResponse(pretty);
        } else {
          const prevVersions = v.responseVersions || [];
          const latestVersion = prevVersions.length > 0 ? prevVersions[prevVersions.length - 1] : null;
          const isDup = latestVersion ? jsonEqual(latestVersion.json, pretty) : false;
          const updatedVersions = isDup ? prevVersions : [...prevVersions, createResponseVersion(v, pretty)];
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
  }, [draftRef, liveVariables, resolvedBaseUrl, resolvedAuth, fetchHostEnabled, fetchHostOverride, onDraftChange]);

  const handleFetchKeepRules = useCallback(() => {
    if (!pendingFetchResponse) return;
    const latest = draftRef.current;
    const v = latest.validation;
    const prevVersions = v.responseVersions || [];
    const updatedVersions = hasSampleJson(v)
      ? [...prevVersions, createResponseVersion(v, v.sampleJson || '')]
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
    } catch { /* keep existing */ }
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
      ? [...prevVersions, createResponseVersion(v, v.sampleJson || '')]
      : prevVersions;
    const prevRulesVersions = v.rulesVersions || [];
    const updatedRulesVersions = hasExpectedFields(v)
      ? [...prevRulesVersions, createRulesVersion(v)]
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

  const fetchSampleDataForMapper = useCallback(async (): Promise<unknown> => {
    const cur = draftRef.current;
    if (!cur.url.trim()) throw new Error('URL is required');
    const result = await fetchScenarioSample(cur, liveVariables, resolvedBaseUrl, {
      fetchHostEnabled,
      fetchHostOverride,
      resolvedAuth,
    });
    if (!result.ok) {
      throw new MapperFetchError({
        message: result.error,
        status: result.httpStatus,
        body: result.body,
      });
    }
    return parseJsonOrRaw(result.body);
  }, [draftRef, liveVariables, resolvedBaseUrl, resolvedAuth, fetchHostEnabled, fetchHostOverride]);

  const handleValidateResponse = useCallback(async (scope: 'assertions' | 'rules' | 'all' = 'all') => {
    const cur = draftRef.current;
    const v = cur.validation;
    const rulesConfigured = hasActiveRules(v);
    const assertionsConfigured = hasAssertions(v);
    const scopeFailures = checkValidationScopeGuards(cur.url, v, scope);
    if (scopeFailures) {
      setValidationResult({ passed: false, failures: scopeFailures });
      return;
    }

    setValidating(true);
    setValidationResult(null);
    try {
      const result = await fetchScenarioSample(cur, liveVariables, resolvedBaseUrl, {
        fetchHostEnabled,
        fetchHostOverride,
        resolvedAuth,
      });

      if (!result.ok) {
        setValidationResult({
          passed: false,
          failures: [{ path: result.httpStatus ? '(http)' : '(network)', expected: result.httpStatus ? '2xx' : 'response', actual: result.error }],
          httpStatus: result.httpStatus,
          responseJson: result.body,
          responseHeaders: result.responseHeaders,
        });
        return;
      }

      const responseObj: unknown = parseJsonOrRaw(result.body);

      const allFailures: FailureDetail[] = [];

      if (scope === 'rules' || scope === 'all') {
        if (rulesConfigured) allFailures.push(...validate(v, responseObj));
      }

      if (scope === 'assertions' || scope === 'all') {
        if (assertionsConfigured) {
          const ctx: AssertionContext = {
            httpStatus: result.httpStatus,
            responseTimeMs: result.responseTimeMs ?? 0,
            responseHeaders: result.responseHeaders ?? {},
            responseBody: responseObj,
            rawBody: result.rawBody,
          };
          const assertionResult = evaluateAssertions(v.assertions!, ctx);
          allFailures.push(...assertionResult.failures);
        }
      }

      setValidationResult({
        passed: allFailures.length === 0,
        failures: allFailures,
        httpStatus: result.httpStatus,
        responseJson: result.body,
        responseHeaders: result.responseHeaders ?? {},
        verifyScope: scope,
      });
    } catch (err) {
      setValidationResult({ passed: false, failures: [{ path: '(error)', expected: 'success', actual: toErrorMessage(err) }] });
    } finally {
      setValidating(false);
    }
  }, [draftRef, liveVariables, resolvedBaseUrl, resolvedAuth, fetchHostEnabled, fetchHostOverride]);

  return {
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
    handleFetchSampleResponse,
    fetchSampleDataForMapper,
    handleFetchKeepRules,
    handleFetchReplaceAll,
    handleFetchCancel,
    handleValidateResponse,
  } as const;
}
