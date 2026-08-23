/**
 * Hook that encapsulates re-running failed data rows from a previous test run.
 * Extracted from App.tsx to reduce component size.
 */
import { useState, useCallback } from 'react';
import type { FeatureGroup, GlobalAuthProfile, Scenario, TestConfig, TestRun, AuthConfig } from '@shared/types';
import { expandDataSourceForRows } from '@engine/core/dataSourceExpander';
import { runTest } from '@engine/core/executor';
import { mergeRerunResults } from '@engine/core/rerunMerge';
import { resolveAuth } from '../../features/requests/utils/authResolver';
import { replaceHost } from '@shared/utils/urlUtils';
import { updateTestRun } from '@shared/utils/storage';

interface UseRerunFailedOptions {
  featureGroups: FeatureGroup[];
  resolvedBaseUrl: string;
  globalAuthProfiles: GlobalAuthProfile[];
  envFallbackAuth?: AuthConfig;
  onComplete?: () => void;
}

export function useRerunFailed({
  featureGroups,
  resolvedBaseUrl,
  globalAuthProfiles,
  envFallbackAuth,
  onComplete,
}: UseRerunFailedOptions) {
  const [isRerunning, setIsRerunning] = useState(false);

  const handleRerunFailed = useCallback(async (run: TestRun, failedRowIds: string[]) => {
    if (isRerunning) return;
    setIsRerunning(true);

    try {
      const failedResults = run.results.filter(r => !r.passed && r.dataRowId && failedRowIds.includes(r.dataRowId));
      const scenarioIds = [...new Set(failedResults.map(r => r.scenarioId))];

      const expandedScenarios: Scenario[] = [];
      for (const scenarioId of scenarioIds) {
        let foundTest: Scenario | undefined;
        let foundSc: { auth?: AuthConfig } | undefined;
        let foundFg: FeatureGroup | undefined;

        for (const fg of featureGroups) {
          for (const sc of fg.scenarios) {
            const test = sc.tests.find(t => t.id === scenarioId);
            if (test) {
              foundTest = test;
              foundSc = sc;
              foundFg = fg;
              break;
            }
          }
          if (foundTest) break;
        }

        if (!foundTest || !foundFg || !foundSc) continue;

        const rowIdsForScenario = failedResults
          .filter(r => r.scenarioId === scenarioId)
          .map(r => r.dataRowId!);

        const rows = expandDataSourceForRows(foundTest, rowIdsForScenario);

        const baseUrl = run.baseUrl || resolvedBaseUrl || '';
        const isGallery = foundFg.source === 'gallery';
        const effectiveBaseUrl = isGallery ? '' : baseUrl;
        const auth = resolveAuth(foundTest, foundSc, foundFg, globalAuthProfiles, envFallbackAuth);

        for (const row of rows) {
          const url = effectiveBaseUrl ? replaceHost(row.url, effectiveBaseUrl) : row.url;
          expandedScenarios.push({
            ...row,
            url,
            auth,
            featureGroupName: foundFg.name,
            groupName: foundSc ? (foundSc as import('../../shared/types').TestScenario).name : undefined,
          });
        }
      }

      if (expandedScenarios.length === 0) {
        setIsRerunning(false);
        return;
      }

      const rerunConfig: TestConfig = {
        concurrency: 1,
        iterations: expandedScenarios.length,
        executionMode: 'sequential',
        scenarioWeights: expandedScenarios.map(s => ({ scenarioId: s.id, weight: 1 })),
        timeoutSec: run.config.timeoutSec,
        retryCount: run.config.retryCount,
        retryDelayMs: run.config.retryDelayMs,
      };

      const rerunResults = await runTest(
        rerunConfig,
        expandedScenarios,
        () => {},
        new AbortController().signal,
      );

      const merged = mergeRerunResults(run, rerunResults.results);
      await updateTestRun(merged);
      onComplete?.();
    } catch (err) {
      console.error('Re-run failed:', err);
    } finally {
      setIsRerunning(false);
    }
  }, [isRerunning, featureGroups, resolvedBaseUrl, globalAuthProfiles, envFallbackAuth, onComplete]);

  return { isRerunning, handleRerunFailed };
}
