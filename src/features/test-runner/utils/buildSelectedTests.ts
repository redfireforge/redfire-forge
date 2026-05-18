import type { FeatureGroup, Scenario, GlobalAuthProfile, AuthConfig } from '../../../shared/types';
import type { RunnerConfig } from '../hooks/runnerConfigDefaults';
import { resolveAuth } from '../../requests/utils/authResolver';
import { replaceHost } from '../../../shared/utils/urlUtils';

export interface SelectedTest extends Scenario {
  featureGroupName: string;
  groupName: string;
}

/**
 * Builds the list of selected tests with resolved URLs and auth.
 */
export function buildSelectedTests(
  featureGroups: FeatureGroup[],
  selectedScenarios: Set<string>,
  hostMode: 'hardcoded' | 'settings' | 'custom',
  customBaseUrl: string,
  resolvedBaseUrl: string | undefined,
  skipValidation: boolean,
  validationOverride: RunnerConfig['validationOverride'],
  forceUnordered: boolean,
  globalAuthProfiles: GlobalAuthProfile[],
  envFallbackAuth?: AuthConfig,
): SelectedTest[] {
  const tests: SelectedTest[] = [];
  const runtimeMode = validationOverride !== 'default'
    ? validationOverride
    : (skipValidation ? 'none' as const : null);

  for (const fg of featureGroups) {
    for (const sc of fg.scenarios) {
      if (selectedScenarios.has(sc.id)) {
        for (const test of sc.tests) {
          const isGallery = fg.source === 'gallery';
          const effectiveBaseUrl = isGallery
            ? ''
            : (hostMode === 'settings' ? (resolvedBaseUrl || '') : hostMode === 'custom' ? customBaseUrl.trim() : '');
          const url = effectiveBaseUrl ? replaceHost(test.url, effectiveBaseUrl) : test.url;

          let dataSource = test.dataSource;
          if (dataSource && runtimeMode) {
            dataSource = { ...dataSource, validationMode: runtimeMode };
          }

          let validation = test.validation;
          if (!dataSource && runtimeMode === 'none') {
            validation = { mode: 'none' as const };
          }

          if (forceUnordered && validation.mode === 'selective') {
            validation = { ...validation, unorderedArrays: true };
          }

          const auth = resolveAuth(test, sc, fg, globalAuthProfiles, envFallbackAuth);
          tests.push({
            ...test,
            url,
            auth,
            validation,
            dataSource,
            featureGroupName: fg.name,
            groupName: sc.name,
          });
        }
      }
    }
  }
  return tests;
}
