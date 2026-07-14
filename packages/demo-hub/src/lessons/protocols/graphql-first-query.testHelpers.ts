/**
 * Shared setup for split graphql-first-query test files.
 */
import { resetGqlLessonSessionFlags } from './graphql-lesson-helpers';

export function setupGraphqlFirstQueryBeforeEach(): void {
  document.body.innerHTML = '';
  resetGqlLessonSessionFlags();
}
