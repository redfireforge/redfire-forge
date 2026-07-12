/**
 * Shared setup for split graphql-query-builder test files.
 */
import { vi } from 'vitest';
import {
  resetGqlLesson7SessionFlags,
  resetGqlLessonSessionFlags,
} from './graphql-lesson-helpers';

export function setupGraphqlQueryBuilderBeforeEach(): void {
  document.body.innerHTML = '';
  resetGqlLessonSessionFlags();
  resetGqlLesson7SessionFlags();
}

export async function teardownGraphqlQueryBuilderAfterEach(): Promise<void> {
  vi.unstubAllGlobals();
}
