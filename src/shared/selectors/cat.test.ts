/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { CAT } from './cat';

describe('shared selectors cat', () => {
  it('exposes stable selector constants for the catalog', () => {
    expect(CAT.SIDEBAR).toBe('[data-testid="catalog-sidebar"]');
    expect(CAT.IMPORT_BTN).toBe('[data-testid="catalog-import-btn"]');
    expect(CAT.BATCH_CONVERT_BTN).toBe('[data-testid="catalog-batch-convert-btn"]');
    expect(CAT.VIEW_OVERVIEW).toBe('[data-testid="catalog-view-overview"]');
    expect(CAT.VIEW_ENDPOINTS).toBe('[data-testid="catalog-view-endpoints"]');
    expect(CAT.VIEW_EXPORT).toBe('[data-testid="catalog-view-export"]');
    expect(CAT.OVERVIEW_SPEC_FORMAT).toBe('[data-testid="catalog-overview-spec-format"]');
    expect(CAT.CONVERT_BTN).toBe('[data-testid="catalog-convert-btn"]');
    expect(CAT.CONVERT_MODAL).toBe('[data-testid="catalog-convert-modal"]');
    expect(CAT.CONVERT_BADGE).toBe('[data-testid="catalog-convert-badge"]');
    expect(CAT.CONVERT_SEARCH_INPUT).toBe('[data-testid="catalog-convert-search-input"]');
    expect(CAT.CONVERT_COPY_BTN).toBe('[data-testid="catalog-convert-copy-btn"]');
    expect(CAT.CONVERT_PRETTY_TOGGLE).toBe('[data-testid="catalog-convert-pretty-toggle"]');
    expect(CAT.CONVERT_COMPARE_BTN).toBe('[data-testid="catalog-convert-compare-btn"]');
    expect(CAT.CONVERT_SAVE_BTN).toBe('[data-testid="catalog-convert-save-btn"]');
  });

  it('builds a sidebar entry selector for a given API name', () => {
    expect(CAT.entryByName('Swagger Petstore (demo)'))
      .toBe('[data-testid="catalog-entry-item"][data-cat-entry-name="Swagger Petstore (demo)"]');
  });

  it('builds a convert target selector for each OpenAPI version', () => {
    expect(CAT.convertTarget('3.0')).toBe('[data-testid="catalog-convert-target-3.0"]');
    expect(CAT.convertTarget('3.1')).toBe('[data-testid="catalog-convert-target-3.1"]');
    expect(CAT.convertTarget('3.2')).toBe('[data-testid="catalog-convert-target-3.2"]');
  });
});
