/**
 * Shared walk + prepare helpers for GQL-1..3 Docker E2E (smoke + per-lesson specs).
 *
 * Keeps lesson step advancement logic in one place so smoke and step-through specs
 * stay aligned on timeouts and last-step handling (finishDemoStep on final step).
 *
 * Canonical source for full-lesson walks — per-lesson specs import from here;
 * do not duplicate walk logic in individual spec files.
 *
 * Pitfalls memo: e2e/DEMO-LESSON-E2E-MEMO.md
 */
export * from './graphql-lesson/step-driver';
export * from './graphql-lesson/constants';
export * from './graphql-lesson/auth-panel';
export * from './graphql-lesson/gql5-proxy';
export * from './graphql-lesson/gql12-baseline';
export * from './graphql-lesson/gql13-mock';
export * from './graphql-lesson/prepare-lessons';
export * from './graphql-lesson/smoke-registry';
export * from './graphql-lesson/walk-lessons';
