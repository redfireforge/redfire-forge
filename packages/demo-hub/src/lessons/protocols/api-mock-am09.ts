/**
 * Compatibility shim. The Conflict Inspector lesson lives in
 * `api-mock-am09-lesson.ts` so Vite can load a clean module after a poisoned HMR
 * graph on this path (`ensureAm09*` used as unbound identifiers).
 */
export { apiMockAm09Lesson } from './api-mock-am09-lesson';
