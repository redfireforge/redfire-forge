/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { catVersionLifecycleLesson } from './cat-version-lifecycle';

describe('catVersionLifecycleLesson boot surface', () => {
  it('arms Overview landing + prepareBeforeNavigate so Start skips CatalogWelcome', () => {
    expect(catVersionLifecycleLesson.initialSurface).toEqual({ catalogView: 'overview' });
    expect(typeof catVersionLifecycleLesson.prepareBeforeNavigate).toBe('function');
  });
});
