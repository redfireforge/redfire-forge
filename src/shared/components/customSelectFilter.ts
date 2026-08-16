import type { CustomSelectGroup, CustomSelectItems, CustomSelectOption } from './customSelectTypes';

export const CUSTOM_SELECT_SEARCH_MIN = 8;

export function isGroupedSelectItems(items: CustomSelectItems): items is CustomSelectGroup[] {
  return items.length > 0 && 'options' in items[0];
}

export function flattenSelectItems(items: CustomSelectItems): CustomSelectOption[] {
  return isGroupedSelectItems(items) ? items.flatMap(g => g.options) : items;
}

/** @deprecated Use flattenSelectItems — kept so stale HMR modules still resolve. */
export const flattenItems = flattenSelectItems;

export function optionMatchesQuery(option: CustomSelectOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [option.label, option.value, option.detail]
    .some(part => Boolean(part) && part!.toLowerCase().includes(q));
}

export function filterSelectItems(items: CustomSelectItems, query: string): CustomSelectItems {
  if (!query.trim()) return items;
  if (isGroupedSelectItems(items)) {
    return items
      .map(group => ({
        ...group,
        options: group.options.filter(option => optionMatchesQuery(option, query)),
      }))
      .filter(group => group.options.length > 0);
  }
  return items.filter(option => optionMatchesQuery(option, query));
}

export function shouldShowSelectSearch(
  searchable: boolean | 'auto',
  items: CustomSelectItems,
  minCount: number = CUSTOM_SELECT_SEARCH_MIN,
): boolean {
  if (searchable === false) return false;
  if (searchable === true) return true;
  return flattenSelectItems(items).length >= minCount;
}
