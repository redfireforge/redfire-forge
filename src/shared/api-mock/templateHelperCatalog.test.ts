/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { FAKER_HELPER_PATHS } from './templateFaker';
import {
  TEMPLATE_ENGINE_HELPER_NAMES,
  TEMPLATE_HELPER_CATALOG,
  copyTemplateSnippet,
  filterTemplateHelpers,
  formatHelperCatalogCount,
  groupTemplateHelpers,
  insertTemplateSnippet,
  nextHelperMatch,
  scopeTemplateHelpers,
  templateHelperNavItems,
} from './templateHelperCatalog';

describe('templateHelperCatalog', () => {
  it('lists every engine helper name exactly once at the core level', () => {
    const coreNames = TEMPLATE_HELPER_CATALOG
      .filter(entry => entry.engineName && entry.category !== 'faker')
      .map(entry => entry.engineName);
    expect(new Set(coreNames).size).toBe(TEMPLATE_ENGINE_HELPER_NAMES.length);
    for (const name of TEMPLATE_ENGINE_HELPER_NAMES) {
      expect(coreNames).toContain(name);
    }
  });

  it('lists every curated faker path', () => {
    for (const path of FAKER_HELPER_PATHS) {
      expect(TEMPLATE_HELPER_CATALOG.some(entry => entry.id === `faker:${path}`)).toBe(true);
    }
  });

  it('does not invent requestId as a body helper', () => {
    expect(TEMPLATE_HELPER_CATALOG.some(entry => entry.name === 'requestId')).toBe(false);
  });

  it('filters by name, snippet, detail, and category label', () => {
    expect(filterTemplateHelpers('').length).toBe(TEMPLATE_HELPER_CATALOG.length);
    expect(filterTemplateHelpers('   ').length).toBe(TEMPLATE_HELPER_CATALOG.length);
    expect(filterTemplateHelpers('uuid').map(e => e.id)).toContain('uuid');
    expect(filterTemplateHelpers("header 'X-Tenant'").map(e => e.id)).toContain('header');
    expect(filterTemplateHelpers('JSONPath').map(e => e.id)).toContain('jsonPath');
    expect(filterTemplateHelpers('Identity').every(e => e.category === 'identity')).toBe(true);
    expect(filterTemplateHelpers('person').some(e => e.id === 'faker:person.firstName')).toBe(true);
    expect(filterTemplateHelpers('zzzz-missing')).toEqual([]);
  });

  it('scopes by category and builds a search-aware nav', () => {
    expect(scopeTemplateHelpers(TEMPLATE_HELPER_CATALOG, 'all')).toHaveLength(TEMPLATE_HELPER_CATALOG.length);
    expect(scopeTemplateHelpers(TEMPLATE_HELPER_CATALOG, 'request').every(e => e.category === 'request')).toBe(true);
    const nav = templateHelperNavItems(filterTemplateHelpers('uuid'));
    expect(nav[0]).toEqual(expect.objectContaining({ id: 'all', label: 'All' }));
    expect(nav.some(item => item.id === 'identity' && item.count > 0)).toBe(true);
    expect(nav.some(item => item.id === 'request')).toBe(false);
  });

  it('groups in category order and drops empty groups', () => {
    const groups = groupTemplateHelpers(filterTemplateHelpers('uuid'));
    expect(groups.map(g => g.category)).toEqual(['identity', 'faker']);
    expect(groups[0]?.label).toBe('Identity & time');
    expect(groupTemplateHelpers([])).toEqual([]);
  });

  it('cycles match index and formats the filtered/total count', () => {
    expect(nextHelperMatch(0, 0, 1)).toBe(0);
    expect(nextHelperMatch(0, 3, 1)).toBe(1);
    expect(nextHelperMatch(2, 3, 1)).toBe(0);
    expect(nextHelperMatch(0, 3, -1)).toBe(2);
    expect(formatHelperCatalogCount(4, 32)).toBe('4/32');
  });

  it('inserts a snippet on its own line', () => {
    expect(insertTemplateSnippet('', '{{uuid}}')).toBe('{{uuid}}');
    expect(insertTemplateSnippet('   ', '{{uuid}}')).toBe('{{uuid}}');
    expect(insertTemplateSnippet('{\n  "id": 1\n}\n', '{{uuid}}')).toBe('{\n  "id": 1\n}\n{{uuid}}');
    expect(insertTemplateSnippet('{\n  "id": 1\n}', '{{uuid}}')).toBe('{\n  "id": 1\n}\n{{uuid}}');
  });

  it('copies through the clipboard API and reports failure', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyTemplateSnippet('{{uuid}}', { writeText })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('{{uuid}}');

    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(copyTemplateSnippet('{{now}}')).resolves.toBe(true);

    const denied = vi.fn().mockRejectedValue(new Error('denied'));
    await expect(copyTemplateSnippet('{{now}}', { writeText: denied })).resolves.toBe(false);
  });
});
