import type { HttpNodeData } from '../types/workflow';
import type { RequestItem, Scenario, SpecVersion } from '../../../shared/types';

/**
 * Resolve the effective scenario for an HTTP workflow node based on its
 * `specVersionMode` and available request versions.
 *
 * - `'pinned'` (or no requests context): returns the scenario as-is (snapshot).
 * - `'latest'`: looks up the source request's active spec version and patches
 *   the scenario with the latest URL/method/headers/body.
 *
 * Returns a new HttpNodeData with the resolved scenario (never mutates input).
 */
export function resolveNodeSpecVersion(
  data: HttpNodeData,
  allRequests?: RequestItem[],
): HttpNodeData {
  if (data.specVersionMode !== 'latest' || !data.sourceSpecVersionId || !allRequests) {
    return data;
  }

  const sourceReq = allRequests.find(r =>
    r.specVersions?.some(v => v.id === data.sourceSpecVersionId),
  );
  if (!sourceReq?.specVersions?.length || !sourceReq.activeSpecVersionId) {
    return data;
  }

  const activeVersion = sourceReq.specVersions.find(v => v.id === sourceReq.activeSpecVersionId);
  if (!activeVersion || activeVersion.id === data.sourceSpecVersionId) {
    return data;
  }

  const patched = applyVersionToScenario(data.scenario, activeVersion);
  return {
    ...data,
    scenario: patched,
    sourceSpecVersionId: activeVersion.id,
    sourceSpecVersionLabel: activeVersion.catalogVersion,
  };
}

function applyVersionToScenario(scenario: Scenario, version: SpecVersion): Scenario {
  return {
    ...scenario,
    url: version.url,
    method: version.method as Scenario['method'],
    headers: version.headers ?? scenario.headers,
    body: version.body ?? scenario.body,
    bodyType: version.bodyType ?? scenario.bodyType,
    bodyForm: version.bodyForm ?? scenario.bodyForm,
  };
}

/**
 * Check whether a newer spec version is available for a pinned node.
 * Returns the newer version if found, or undefined.
 */
export function detectNewerVersion(
  data: HttpNodeData,
  allRequests: RequestItem[],
): SpecVersion | undefined {
  if (!data.sourceSpecVersionId) return undefined;

  const sourceReq = allRequests.find(r =>
    r.specVersions?.some(v => v.id === data.sourceSpecVersionId),
  );
  if (!sourceReq?.specVersions?.length || !sourceReq.activeSpecVersionId) return undefined;

  if (sourceReq.activeSpecVersionId === data.sourceSpecVersionId) return undefined;
  return sourceReq.specVersions.find(v => v.id === sourceReq.activeSpecVersionId);
}
