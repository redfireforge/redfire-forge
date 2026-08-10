/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { catExportPromoteLesson } from './cat-export-promote';

describe('catExportPromoteLesson boot surface', () => {
  it('arms Endpoints landing + prepareBeforeNavigate so Start skips CatalogWelcome', () => {
    expect(catExportPromoteLesson.initialSurface).toEqual({ catalogView: 'endpoints' });
    expect(typeof catExportPromoteLesson.prepareBeforeNavigate).toBe('function');
  });
});
