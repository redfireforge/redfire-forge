import { useMemo } from 'react';
import type { FeatureGroup } from '@shared/types';
import { collectHarnessRequestIds } from '../utils/harnessRequestIds';

export function useHarnessRequestIds(featureGroups: FeatureGroup[]): Set<string> {
  return useMemo(() => collectHarnessRequestIds(featureGroups), [featureGroups]);
}
