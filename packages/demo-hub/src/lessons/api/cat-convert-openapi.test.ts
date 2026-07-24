/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCtx } from '../protocols/ws-test-utils';

vi.mock('../../demoRipple', () => ({ showSpotlightRing: () => () => {} }));
vi.mock('../../adapters', () => ({
  seedSwagger2CatalogEntry: vi.fn().mockResolvedValue('e1'),
  deleteCatalogEntryByName: vi.fn(),
  selectCatalogEntryByName: vi.fn().mockReturnValue(true),
  deleteCollectionsByName: vi.fn().mockReturnValue(0),
}));

import { catConvertOpenApiLesson } from './cat-convert-openapi';
import { catalogLessons } from './index';

describe('cat-convert-openapi lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('has the expected identity + catalog category', () => {
    expect(catConvertOpenApiLesson.id).toBe('cat-convert-openapi');
    expect(catConvertOpenApiLesson.domainId).toBe('api');
    expect(catConvertOpenApiLesson.category).toBe('catalog');
    expect(catConvertOpenApiLesson.initialTab).toBe('catalog');
    expect(catConvertOpenApiLesson.allowedTabs).toEqual(['catalog']);
    expect(catConvertOpenApiLesson.estimatedMinutes).toBe(5);
  });

  it('is registered in the catalog lessons barrel', () => {
    expect(catalogLessons).toContain(catConvertOpenApiLesson);
  });

  it('has 6 convert steps in order, each with a preAction', () => {
    const ids = catConvertOpenApiLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'cat5-swagger-badge',
      'cat5-convert-open',
      'cat5-lint-search',
      'cat5-prettify',
      'cat5-save',
      'cat5-batch',
    ]);
    for (const step of catConvertOpenApiLesson.steps) {
      expect(step.preAction).toBeTypeOf('function');
    }
  });

  it('step cat5-save verifies the overview surface (modal closed)', () => {
    const saveStep = catConvertOpenApiLesson.steps.find((s) => s.id === 'cat5-save')!;
    expect(saveStep.verify).toBe('[data-testid="catalog-overview"]');
  });

  it('concept lists the key spec-format terms', () => {
    const terms = catConvertOpenApiLesson.concept.keyTerms!.map((kt) => kt.term);
    expect(terms).toContain('Swagger 2.0');
    expect(terms).toContain('OpenAPI 3.x');
    expect(terms).toContain('Validation gate');
    expect(terms).toContain('Deep lint');
    expect(terms).toContain('Batch Convert');
  });

  it('setup navigates to the catalog tab', async () => {
    const ctx = makeCtx();
    await catConvertOpenApiLesson.setup!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('catalog');
  });

  it('cleanup navigates to the catalog tab', async () => {
    const ctx = makeCtx();
    await catConvertOpenApiLesson.cleanup!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('catalog');
  });
});
