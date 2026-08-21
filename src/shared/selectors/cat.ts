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

  // ── Welcome screen ───────────────────────────────────────────
  WELCOME_IMPORT_BTN:       '[data-testid="catalog-welcome-import-btn"]',

  // ── Main-panel sub-tabs (Overview / Endpoints / Export / Workflow Exposure) ──
  VIEW_OVERVIEW:            '[data-testid="catalog-view-overview"]',
  VIEW_ENDPOINTS:           '[data-testid="catalog-view-endpoints"]',
  VIEW_EXPORT:              '[data-testid="catalog-view-export"]',
  /** Workflow Exposure management tab (testid kept for stability). */
  VIEW_PUBLISHED:           '[data-testid="catalog-view-published"]',

  // ── Overview panel ────────────────────────────────────────────
  OVERVIEW:                 '[data-testid="catalog-overview"]',
  OVERVIEW_SPEC_FORMAT:     '[data-testid="catalog-overview-spec-format"]',
  OVERVIEW_METHOD_STATS:    '[data-testid="catalog-overview-method-stats"]',
  OVERVIEW_SERVERS:         '[data-testid="catalog-overview-servers"]',
  OVERVIEW_BY_TAG:          '[data-testid="catalog-overview-by-tag"]',
  OVERVIEW_QUICK_ACTIONS:   '[data-testid="catalog-overview-quick-actions"]',
  REIMPORT_BTN:             '[data-testid="catalog-reimport-btn"]',
  EXPORT_SPEC_BTN:          '[data-testid="catalog-export-spec-btn"]',
  VERSION_HISTORY_BTN:      '[data-testid="catalog-version-history-btn"]',
  CONVERT_BTN:              '[data-testid="catalog-convert-btn"]',

  // ── Auth panel ──────────────────────────────────────────────────
  AUTHORIZE_BTN:            '[data-testid="catalog-authorize-btn"]',
  AUTH_PANEL:               '[data-testid="catalog-auth-panel"]',
  AUTH_TYPE_SELECT:          '[data-testid="catalog-auth-type-select"]',
  AUTH_TOKEN_INPUT:          '[data-testid="catalog-auth-token-input"]',
  AUTH_PREFIX_INPUT:         '[data-testid="catalog-auth-prefix-input"]',
  VERIFY_AUTH_BTN:          '[data-testid="catalog-verify-auth-btn"]',
  /** @deprecated Panel close is now via Authorize toggle — no dedicated close button */
  AUTH_CLOSE_BTN:           '[data-testid="catalog-auth-close-btn"]',

  // ── Version History modal ───────────────────────────────────────
  VERSION_HISTORY_MODAL:    '[data-testid="catalog-version-history-modal"]',
  VERSION_LIST:             '[data-testid="catalog-version-list"]',
  VERSION_ITEM:             '[data-testid="catalog-version-item"]',
  VERSION_COMPARE_BTN:      '[data-testid="catalog-version-compare-btn"]',
  VERSION_RESTORE_BTN:      '[data-testid="catalog-version-restore-btn"]',
  VERSION_DIFF:             '[data-testid="catalog-version-diff"]',
  VERSION_DIFF_SUMMARY:     '[data-testid="catalog-version-diff-summary"]',
  VERSION_CHECKBOX:         '[data-testid="catalog-version-checkbox"]',

  // ── Import modal ──────────────────────────────────────────────
  IMPORT_TAB_GALLERY:       '[data-testid="catalog-import-tab-gallery"]',
  IMPORT_GALLERY_GRID:      '[data-testid="catalog-import-gallery-grid"]',
  IMPORT_GALLERY_CARD:      '[data-testid="catalog-import-gallery-card"]',
  /** Gallery card addressed by sample id. */
  importGalleryCard: (id: string) => `[data-testid="catalog-import-gallery-card"][data-gallery-id="${id}"]`,
  IMPORT_PREVIEW:           '[data-testid="catalog-import-preview"]',
  IMPORT_CONFIRM_BTN:       '[data-testid="catalog-import-confirm-btn"]',

  // ── Endpoint browser ──────────────────────────────────────────
  ENDPOINT_BROWSER:         '[data-testid="catalog-endpoint-browser"]',
  ENDPOINT_FILTER:          '[data-testid="catalog-endpoint-filter"]',
  ENDPOINT_LIST:            '[data-testid="catalog-endpoint-list"]',
  HIDE_DEPRECATED:          '[data-testid="catalog-hide-deprecated"]',

  // ── Host Strategy ───────────────────────────────────────────
  HOST_STRATEGY:            '[data-testid="catalog-host-strategy"]',
  HOST_FROM_SPEC:           '[data-testid="catalog-host-from-spec"]',
  HOST_ENVIRONMENT:         '[data-testid="catalog-host-environment"]',
  HOST_CUSTOM_URL:          '[data-testid="catalog-host-custom-url"]',
  HOST_SERVER_SELECT:       '[data-testid="catalog-host-server-select"]',
  HOST_ENV_SELECT:          '[data-testid="catalog-host-env-select"]',
  HOST_INPUT:               '[data-testid="catalog-host-input"]',
  BASE_URL:                 '[data-testid="catalog-base-url"]',
  /** Linked microservice name chip in Environment host mode. */
  HOST_SVC_LABEL:           '[data-testid="catalog-host-svc-label"]',
  /** Opens Edit modal to change the linked microservice. */
  HOST_SVC_CHANGE:          '[data-testid="catalog-host-svc-change"]',
  /** Edit modal — link catalog entry to a microservice. */
  EDIT_MICROSERVICE_SELECT: '[data-testid="catalog-edit-microservice-select"]',
  EDIT_MODAL:               '.cat-edit-modal',
  EDIT_SAVE_BTN:            '.cat-edit-footer .cat-btn-primary',
  EDIT_CANCEL_BTN:          '.cat-edit-footer .cat-btn:not(.cat-btn-primary)',
  TAG_GROUP:                '[data-testid="catalog-tag-group"]',
  /** Tag group addressed by tag name (case-sensitive). */
  tagByName: (name: string) => `[data-testid="catalog-tag-group"][data-tag-name="${name}"]`,
  ENDPOINT_CARD:            '[data-testid="catalog-endpoint-card"]',
  /** Clickable header row inside the first endpoint card — click to expand. */
  ENDPOINT_CARD_HEADER:     '[data-testid="catalog-endpoint-card"] .sw-header',
  /** Endpoint card addressed by method + path. */
  endpointCard: (method: string, path: string) => `[data-testid="catalog-endpoint-card"][data-endpoint-method="${method}"][data-endpoint-path="${path}"]`,

  // ── Endpoint card: Try It Out ────────────────────────────────
  TRYIT_BTN:                '[data-testid="catalog-tryit-btn"]',
  BODY_EDITOR:              '[data-testid="catalog-body-editor"]',
  EXECUTE_BTN:              '[data-testid="catalog-execute-btn"]',
  CURL_BTN:                 '[data-testid="catalog-curl-btn"]',
  CURL_BOX:                 '[data-testid="catalog-curl-box"]',
  LIVE_RESPONSE:            '[data-testid="catalog-live-response"]',
  /** Parameter input addressed by param name (e.g. `id`, `userId`). */
  paramInput: (name: string) => `[data-testid="catalog-param-${name}"]`,

  // ── Endpoint card: Actions / Export / Coverage ──────────────
  EXPORT_TO_REQ_BTN:        '[data-testid="catalog-export-to-req-btn"]',
  EXPORT_TO_MOCK_BTN:       '[data-testid="catalog-export-to-mock-btn"]',
  SEND_TO_HARNESS_BTN:      '[data-testid="catalog-send-to-harness-btn"]',
  SAVE_AS_TEST_BTN:         '[data-testid="catalog-save-as-test-btn"]',
  EXPOSE_TO_WORKFLOW:       '[data-testid="catalog-expose-to-workflow"]',
  EXPOSE_OPTION_NONE:       '[data-testid="catalog-expose-option-none"]',
  EXPOSE_OPTION_PREVIEW:    '[data-testid="catalog-expose-option-preview"]',
  EXPOSE_OPTION_PUBLISHED:  '[data-testid="catalog-expose-option-published"]',
  COVERAGE_BADGE:           '[data-testid="catalog-coverage-badge"]',
  COVERAGE_POPOVER:         '[data-testid="catalog-coverage-popover"]',
  COVERAGE_GOTO:            '[data-testid="catalog-coverage-goto"]',

  // ── Export to Requests modal / inline ──────────────────────
  EXPORT_MODAL:             '[data-testid="catalog-export-modal"]',
  EXPORT_INLINE:            '[data-testid="catalog-export-inline"]',
  EXPORT_COL_NAME:          '[data-testid="catalog-export-col-name"]',
  EXPORT_TARGET_GROUP:      '[data-testid="catalog-export-target-group"]',
  EXPORT_ENV_TABLE:         '[data-testid="catalog-export-env-table"]',
  EXPORT_EP_TABLE:          '[data-testid="catalog-export-ep-table"]',
  EXPORT_SAMPLE_TOGGLE:     '[data-testid="catalog-export-sample-toggle"]',
  EXPORT_PREVIEW:           '[data-testid="catalog-export-preview"]',
  EXPORT_CONFIRM_BTN:       '[data-testid="catalog-export-confirm-btn"]',

  // ── Publish Endpoint modal ───────────────────────────────────
  PUBLISH_MODAL:            '[data-testid="publish-endpoint-modal"]',
  PUBLISH_CONFIRM_BTN:      '[data-testid="publish-confirm-btn"]',
  PUBLISH_CANCEL_BTN:       '[data-testid="publish-cancel-btn"]',
  PUBLISH_NOTE_INPUT:       '[data-testid="publish-note-input"]',
  PUBLISH_INCLUDE_VALUES:   '[data-testid="publish-include-values"]',

  // ── Preview Promote Alert ───────────────────────────────────
  PREVIEW_PROMOTE_ALERT:    '[data-testid="preview-promote-alert"]',
  PREVIEW_PROMOTE_GO_BTN:   '[data-testid="preview-promote-go-btn"]',
  PREVIEW_PROMOTE_DISMISS:  '[data-testid="preview-promote-dismiss-btn"]',

  // ── Workflow Exposure panel ───────────────────────────────────
  PUB_PANEL:                '[data-testid="published-endpoints-panel"]',
  PUB_SEARCH:               '[data-testid="pub-search"]',
  PUB_FILTER_ALL:           '[data-testid="pub-filter-all"]',
  PUB_FILTER_PUBLISHED:     '[data-testid="pub-filter-published"]',
  /** @deprecated Use PUB_FILTER_PUBLISHED */
  PUB_FILTER_CURRENT:       '[data-testid="pub-filter-published"]',
  PUB_FILTER_STALE:         '[data-testid="pub-filter-stale"]',
  PUB_FILTER_PREVIEW:       '[data-testid="pub-filter-preview"]',
  PUB_BULK_UNPUBLISH:       '[data-testid="pub-bulk-unpublish"]',
  PUB_BULK_REPUBLISH:       '[data-testid="pub-bulk-republish"]',
  PUB_TABLE:                '[data-testid="pub-table"]',
  PUB_PREVIEW_TABLE:        '[data-testid="pub-preview-table"]',
  PUB_ROW:                  '[data-testid="pub-row"]',
  PUB_PREVIEW_ROW:          '[data-testid="pub-preview-row"]',
  PUB_SELECT_ALL:           '[data-testid="pub-select-all"]',
  PUB_STATUS_STALE:         '[data-testid="pub-status-stale"]',
  PUB_STATUS_PUBLISHED:     '[data-testid="pub-status-published"]',
  /** @deprecated Use PUB_STATUS_PUBLISHED */
  PUB_STATUS_CURRENT:       '[data-testid="pub-status-published"]',
  PUB_ACTIONS_BTN:          '[data-testid="pub-actions-btn"]',
  PUB_ACTIONS_MENU:         '[data-testid="pub-actions-menu"]',
  PUB_ACTION_VIEW:          '[data-testid="pub-action-view"]',
  PUB_ACTION_USAGE:         '[data-testid="pub-action-usage"]',
  PUB_ACTION_REPUBLISH:     '[data-testid="pub-action-republish"]',
  PUB_ACTION_UNPUBLISH:     '[data-testid="pub-action-unpublish"]',
  PUB_PREVIEW_ACTIONS_BTN:  '[data-testid="pub-preview-actions-btn"]',
  PUB_PREVIEW_ACTION_VIEW:  '[data-testid="pub-preview-action-view"]',
  PUB_PREVIEW_ACTION_PROMOTE: '[data-testid="pub-preview-action-promote"]',
  PUB_PREVIEW_ACTION_REMOVE:  '[data-testid="pub-preview-action-remove"]',
  PUB_USAGE_ROW:            '[data-testid="pub-usage-row"]',
  PUB_USAGE_LIST:           '[data-testid="pub-usage-list"]',
  PUB_USAGE_EMPTY:          '[data-testid="pub-usage-empty"]',
  PUB_STALE_HINT:           '[data-testid="pub-stale-hint"]',

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
