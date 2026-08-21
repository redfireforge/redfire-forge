import type { FeatureGroup } from '../../shared/types';

export function collectHarnessRequestIds(featureGroups: FeatureGroup[]): Set<string> {
  const ids = new Set<string>();
  for (const fg of featureGroups) {
    for (const sc of fg.scenarios) {
      for (const t of sc.tests) {
        if (t.sourceRequestId) ids.add(t.sourceRequestId);
      }
    }
  }
  return ids;
}
