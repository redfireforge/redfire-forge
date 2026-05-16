import type { ResponseVersion, RulesVersion } from '../../../shared/types';

/** Normalize a version's rule fields into a comparable plain object for diffing. */
export function buildRulesSnapshot(v: ResponseVersion | RulesVersion) {
  return {
    mode: v.validationMode || 'none',
    selectiveMode: v.selectiveMode || 'include',
    expectedFields: [...(v.expectedFields || [])].sort((a, b) => a.jsonPath.localeCompare(b.jsonPath)),
    excludedPaths: [...(v.excludedPaths || [])].sort(),
    unorderedArrays: !!v.unorderedArrays,
    assertions: 'assertions' in v && v.assertions ? [...v.assertions] : [],
  };
}
