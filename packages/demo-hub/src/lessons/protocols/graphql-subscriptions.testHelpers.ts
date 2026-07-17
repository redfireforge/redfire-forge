/**
 * Shared setup for split graphql-subscriptions test files.
 */
import { vi } from 'vitest';
import {
  resetGqlLesson5SessionFlags,
  resetGqlLessonSessionFlags,
} from './graphql-lesson-helpers';

export function setupGraphqlSubscriptionsBeforeEach(): void {
  document.body.innerHTML = '';
  resetGqlLessonSessionFlags();
  resetGqlLesson5SessionFlags();
}

export async function teardownGraphqlSubscriptionsAfterEach(): Promise<void> {
  vi.unstubAllGlobals();
}
