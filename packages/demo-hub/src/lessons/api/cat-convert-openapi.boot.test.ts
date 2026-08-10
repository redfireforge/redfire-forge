/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { catConvertOpenApiLesson } from './cat-convert-openapi';

describe('catConvertOpenApiLesson boot surface', () => {
  it('arms Overview landing + prepareBeforeNavigate so Start skips CatalogWelcome', () => {
    expect(catConvertOpenApiLesson.initialSurface).toEqual({ catalogView: 'overview' });
    expect(typeof catConvertOpenApiLesson.prepareBeforeNavigate).toBe('function');
  });
});
