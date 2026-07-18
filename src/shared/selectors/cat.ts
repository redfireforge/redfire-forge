// ─── API Catalog ─────────────────────────────────────────────────
//
// All selectors here must work with document.querySelector().
// Used by demo lessons (CAT-*), E2E tests, and test scenarios.
//
export const CAT = {
  // ── Sidebar ───────────────────────────────────────────────────
  SIDEBAR:                  '[data-testid="catalog-sidebar"]',
  SIDEBAR_FILTER:           '[data-testid="catalog-sidebar-filter"]',
  IMPORT_BTN:               '[data-testid="catalog-import-btn"]',
  BATCH_CONVERT_BTN:        '[data-testid="catalog-batch-convert-btn"]',
  ENTRY_ITEM:               '[data-testid="catalog-entry-item"]',
  /** Sidebar entry addressed by its display name (case-sensitive attribute match). */
  entryByName: (name: string) => `[data-testid="catalog-entry-item"][data-cat-entry-name="${name}"]`,

  // ── Sidebar context menu ──────────────────────────────────────
  CTX_MENU:                 '[data-testid="catalog-ctx-menu"]',
  CTX_CONVERT:              '[data-testid="catalog-ctx-convert"]',

  // ── Main-panel sub-tabs (Overview / Endpoints / Export) ───────
  VIEW_OVERVIEW:            '[data-testid="catalog-view-overview"]',
  VIEW_ENDPOINTS:           '[data-testid="catalog-view-endpoints"]',
  VIEW_EXPORT:              '[data-testid="catalog-view-export"]',

  // ── Overview panel ────────────────────────────────────────────
  OVERVIEW:                 '[data-testid="catalog-overview"]',
  OVERVIEW_SPEC_FORMAT:     '[data-testid="catalog-overview-spec-format"]',
  CONVERT_BTN:              '[data-testid="catalog-convert-btn"]',

  // ── Convert / Upgrade modal ───────────────────────────────────
  CONVERT_MODAL:            '[data-testid="catalog-convert-modal"]',
  CONVERT_ENGINE_S2O:       '[data-testid="catalog-convert-engine-swagger2openapi"]',
  CONVERT_ENGINE_SCALAR:    '[data-testid="catalog-convert-engine-scalar"]',
  /** Target OpenAPI version segmented button (`3.0` / `3.1` / `3.2`). */
  convertTarget: (t: string) => `[data-testid="catalog-convert-target-${t}"]`,
  CONVERT_BADGE:            '[data-testid="catalog-convert-badge"]',
  CONVERT_LINT_BTN:         '[data-testid="catalog-convert-lint-btn"]',
  CONVERT_LINT_RESULT:      '[data-testid="catalog-convert-lint-result"]',
  CONVERT_PREVIEW:          '[data-testid="catalog-convert-preview"]',
  CONVERT_SEARCH_INPUT:     '[data-testid="catalog-convert-search-input"]',
  CONVERT_COPY_BTN:         '[data-testid="catalog-convert-copy-btn"]',
  CONVERT_PRETTY_TOGGLE:    '[data-testid="catalog-convert-pretty-toggle"]',
  CONVERT_COMPARE_BTN:      '[data-testid="catalog-convert-compare-btn"]',
  CONVERT_DOWNLOAD_BTN:     '[data-testid="catalog-convert-download-btn"]',
  CONVERT_SAVE_BTN:         '[data-testid="catalog-convert-save-btn"]',
} as const;
