/**
 * API Mock Studio selectors — single source for demos / E2E / lessons.
 * Values are CSS selectors usable with document.querySelector / Playwright.
 */
import { API_MOCK_RUNTIME } from './apiMockRuntimeSelectors';
import { API_MOCK_STUDIO } from './apiMockStudioSelectors';

export const API_MOCK = {
  ...API_MOCK_STUDIO,
  ...API_MOCK_RUNTIME,
} as const;

/** @deprecated Prefer `API_MOCK` — kept as a short alias for lesson narration. */
export const AMS = API_MOCK;
