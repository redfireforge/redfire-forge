/**
 * Shared setup for split graphql-collections-history test files.
 */
import { vi } from 'vitest';
import {
  resetGqlLesson8SessionFlags,
  resetGqlLessonSessionFlags,
} from './graphql-lesson-helpers';

export function setupGraphqlCollectionsHistoryBeforeEach(): void {
  document.body.innerHTML = '';
  resetGqlLessonSessionFlags();
  resetGqlLesson8SessionFlags();
}

export async function teardownGraphqlCollectionsHistoryAfterEach(): Promise<void> {
  vi.unstubAllGlobals();
}
