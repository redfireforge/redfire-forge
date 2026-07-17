import { describe, it, expect } from 'vitest';
import { GQL } from './gql';

/** Every function selector on GQL must be exercised for coverage. */
const FUNCTION_SELECTORS: Array<{ name: string; call: () => string }> = [
  { name: 'tabRename', call: () => GQL.tabRename('tab-1') },
  { name: 'tab', call: () => GQL.tab('tab-1') },
  { name: 'tabLabel', call: () => GQL.tabLabel('tab-1') },
  { name: 'tabSubtitle', call: () => GQL.tabSubtitle('tab-1') },
  { name: 'tabEndpointBadge', call: () => GQL.tabEndpointBadge('tab-1') },
  { name: 'tabProfileBadge', call: () => GQL.tabProfileBadge('tab-1') },
  { name: 'rvRequestHeaderKey', call: () => GQL.rvRequestHeaderKey('Authorization') },
  { name: 'rvRequestHeaderVal', call: () => GQL.rvRequestHeaderVal('Authorization') },
  { name: 'rvMetadataRequestHeaderVal', call: () => GQL.rvMetadataRequestHeaderVal('Authorization') },
  { name: 'tabAuthDot', call: () => GQL.tabAuthDot('tab-1') },
  { name: 'profileLoadBtn', call: () => GQL.profileLoadBtn('Staging') },
  { name: 'profileRow', call: () => GQL.profileRow('prof-1') },
  { name: 'profileTabUsage', call: () => GQL.profileTabUsage('prof-1') },
  { name: 'profileTabPill', call: () => GQL.profileTabPill('prof-1', 'tab-2') },
  { name: 'advBatchTabRow', call: () => GQL.advBatchTabRow('tab-42') },
  { name: 'advBatchTabCb', call: () => GQL.advBatchTabCb('tab-42') },
  { name: 'advBatchTabLabel', call: () => GQL.advBatchTabLabel('tab-42') },
];

describe('GQL function selectors — full coverage', () => {
  it.each(FUNCTION_SELECTORS)('$name returns a non-empty selector string', ({ call }) => {
    const selector = call();
    expect(typeof selector).toBe('string');
    expect(selector.length).toBeGreaterThan(0);
  });

  it('exposes all static string constants as non-empty selectors', () => {
    for (const [key, value] of Object.entries(GQL)) {
      if (typeof value === 'function') continue;
      expect(typeof value, key).toBe('string');
      expect(value.length, key).toBeGreaterThan(0);
    }
  });
});
