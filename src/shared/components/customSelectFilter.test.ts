import { describe, expect, it } from 'vitest';
import {
  CUSTOM_SELECT_SEARCH_MIN,
  filterSelectItems,
  flattenItems,
  flattenSelectItems,
  isGroupedSelectItems,
  optionMatchesQuery,
  shouldShowSelectSearch,
} from './customSelectFilter';

const flat = [
  { value: 'exact', label: 'Exact', detail: 'Whole value' },
  { value: 'form_field_exact', label: 'Form field exact', detail: 'Named field equals' },
  { value: 'regex', label: 'Regex' },
];

const grouped = [
  { label: 'Text', options: [flat[0]] },
  { label: 'Form', options: [flat[1]] },
  { label: 'Pattern', options: [flat[2]] },
];

describe('customSelectFilter', () => {
  it('detects grouped items and flattens them', () => {
    expect(isGroupedSelectItems(flat)).toBe(false);
    expect(isGroupedSelectItems(grouped)).toBe(true);
    expect(flattenSelectItems(grouped).map(o => o.value)).toEqual([
      'exact', 'form_field_exact', 'regex',
    ]);
    expect(flattenItems(grouped)).toEqual(flattenSelectItems(grouped));
  });

  it('matches label, value, and detail', () => {
    expect(optionMatchesQuery(flat[0], '')).toBe(true);
    expect(optionMatchesQuery(flat[0], 'exact')).toBe(true);
    expect(optionMatchesQuery(flat[0], 'whole')).toBe(true);
    expect(optionMatchesQuery(flat[1], 'field')).toBe(true);
    expect(optionMatchesQuery(flat[2], 'json')).toBe(false);
  });

  it('filters flat and grouped lists and drops empty groups', () => {
    expect(filterSelectItems(flat, 'field').map(o => 'value' in o ? o.value : '')).toEqual(['form_field_exact']);
    const filtered = filterSelectItems(grouped, 'field');
    expect(isGroupedSelectItems(filtered)).toBe(true);
    if (isGroupedSelectItems(filtered)) {
      expect(filtered.map(g => g.label)).toEqual(['Form']);
    }
    expect(filterSelectItems(flat, '')).toEqual(flat);
  });

  it('shows search for long lists unless forced off', () => {
    const many = Array.from({ length: CUSTOM_SELECT_SEARCH_MIN }, (_, i) => ({
      value: String(i),
      label: `Item ${i}`,
    }));
    expect(shouldShowSelectSearch('auto', flat)).toBe(false);
    expect(shouldShowSelectSearch('auto', many)).toBe(true);
    expect(shouldShowSelectSearch(true, flat)).toBe(true);
    expect(shouldShowSelectSearch(false, many)).toBe(false);
  });
});
