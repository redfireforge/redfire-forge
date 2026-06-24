// ── GraphQL Studio (Phase 1–4) ────────────────────────────────────────────────
export const GQL = {
  // ── Page & Layout ──────────────────────────────────────────────────────────
  STUDIO_PAGE:         '[data-testid="gql-studio-page"]',
  CONNECTION_BAR:      '[data-testid="gql-connection-bar"]',
  MAIN:                '[data-testid="gql-main"]',
  EDITOR_PANE:         '[data-testid="gql-editor-pane"]',
  RIGHT_PANE:          '[data-testid="gql-right-pane"]',

  // ── Connection Bar ─────────────────────────────────────────────────────────
  ENDPOINT_INPUT:      '[data-testid="gql-endpoint-input"]',
  ENDPOINT_RESET_BTN:  '[data-testid="gql-endpoint-reset-btn"]',
  ENDPOINT_PREVIEW:    '[data-testid="gql-endpoint-preview"]',
  INTROSPECT_BTN:      '[data-testid="gql-introspect-btn"]',
  EXECUTE_BTN:         '[data-testid="gql-execute-btn"]',
  OP_SELECTOR:         '[data-testid="gql-op-selector"]',
  SCHEMA_BADGE_OK:     '[data-testid="gql-schema-badge-ok"]',
  SCHEMA_BADGE_ERROR:  '[data-testid="gql-schema-badge-error"]',
  POLLING_CONFIG_BTN:  '[data-testid="gql-polling-config-btn"]',
  POLLING_CONFIG_BTN_STANDALONE: '[data-testid="gql-polling-config-btn-standalone"]',
  POLLING_TOGGLE:      '[data-testid="gql-polling-toggle"]',
  POLLING_POPOVER:     '[data-testid="gql-polling-popover"]',
  POLLING_POPOVER_CLOSE: '[aria-label="Close polling config"]',

  // ── Tab Bar ────────────────────────────────────────────────────────────────
  TAB_BAR:             '[data-testid="gql-tab-bar"]',
  TAB_ADD_BTN:         '[data-testid="gql-tab-add-btn"]',
  /** Inline rename input (visible after double-clicking a tab label). */
  TAB_RENAME_INPUT:    '[data-testid^="gql-tab-rename-"]',
  tabRename:           (tabId: string) => `[data-testid="gql-tab-rename-${tabId}"]`,
  tab:                 (tabId: string) => `[data-testid="gql-tab-${tabId}"]`,
  tabLabel:            (tabId: string) => `[data-testid="gql-tab-${tabId}"] .gql-tab-label`,
  tabSubtitle:         (tabId: string) => `[data-testid="gql-tab-subtitle-${tabId}"]`,
  /** @deprecated Use tabSubtitle or tabLabel — connection hints moved to unified subtitle/title */
  tabEndpointBadge:    (tabId: string) => `[data-testid="gql-tab-subtitle-${tabId}"]`,
  /** @deprecated Use tabSubtitle or tabLabel */
  tabProfileBadge:     (tabId: string) => `[data-testid="gql-tab-subtitle-${tabId}"]`,
  /** GQL-14 lesson spotlight: demo Tab 2 endpoint override badge (set in preAction). */
  LESSON14_TAB2_BADGE: '[data-lesson-target="gql14-tab2-badge"]',
  /** GQL-14 lesson spotlight: demo Tab 1 workspace tab (set by activateGqlTabByIndex). */
  LESSON14_TAB1: '[data-lesson-target="gql14-tab-0"]',
  /** GQL-14 lesson spotlight: demo Tab 2 workspace tab (set when Tab 2 is added). */
  LESSON14_TAB2: '[data-lesson-target="gql14-tab-1"]',

  // ── Editor ─────────────────────────────────────────────────────────────────
  EDITOR:              '[data-testid="gql-editor"]',
  MODE_EDITOR:         '[data-testid="gql-mode-editor"]',
  MODE_BUILDER:        '[data-testid="gql-mode-builder"]',

  // ── Right Pane Tabs ────────────────────────────────────────────────────────
  RIGHT_TAB_RESPONSE:  '[data-testid="gql-right-tab-response"]',
  RIGHT_TAB_SCHEMA:    '[data-testid="gql-right-tab-schema"]',

  // ── Bottom Panel ───────────────────────────────────────────────────────────
  BOTTOM_TAB_VARS:     '[data-testid="gql-bottom-tab-variables"]',
  BOTTOM_TAB_HEADERS:  '[data-testid="gql-bottom-tab-headers"]',
  BOTTOM_TAB_AUTH:     '[data-testid="gql-bottom-tab-auth"]',
  BOTTOM_TAB_FILES:    '[data-testid="gql-bottom-tab-files"]',
  AUTH_PANEL:          '[data-testid="gql-auth-panel"]',
  AUTH_PAGE_SCOPE_BANNER: '[data-testid="gql-auth-page-scope-banner"]',
  AUTH_OVERRIDE_BANNER: '[data-testid="gql-auth-override-banner"]',
  AUTH_SWITCH_OVERRIDE_BTN: '[data-testid="gql-auth-switch-override-btn"]',

  // ── Variables Panel ────────────────────────────────────────────────────────
  VARS_PANEL:          '[data-testid="gql-variables-panel"]',

  // ── Headers Panel ──────────────────────────────────────────────────────────
  HEADERS_PANEL:       '[data-testid="gql-headers-panel"]',
  HEADERS_ADD_BTN:     '[data-testid="gql-headers-add-btn"]',
  HEADERS_EMPTY:       '[data-testid="gql-headers-empty"]',

  // ── Response Viewer ────────────────────────────────────────────────────────
  RESPONSE_EMPTY:      '[data-testid="gql-response-empty"]',
  RESPONSE_LOADING:    '[data-testid="gql-response-loading"]',
  RESPONSE_VIEWER:     '[data-testid="gql-response-viewer"]',
  RESPONSE_STATUS:     '[data-testid="gql-response-status"]',
  RESPONSE_LATENCY:    '[data-testid="gql-response-latency"]',
  RESPONSE_BODY:       '[data-testid="gql-response-body"]',
  /** Compact data.user field summary — narrower spotlight target for variable lessons */
  RESPONSE_DATA_USER:  '[data-testid="gql-response-data-user"]',
  RESPONSE_DATA_CREATE_USER: '[data-testid="gql-response-data-create-user"]',
  RESPONSE_ERRORS:     '[data-testid="gql-response-error-count"]',
  RV_TAB_BODY:         '[data-testid="gql-rv-tab-body"]',
  RV_TAB_METADATA:     '[data-testid="gql-rv-tab-metadata"]',
  RV_METADATA:         '[data-testid="gql-rv-metadata"]',
  RV_AUTH_SENT:          '[data-testid="gql-rv-auth-sent"]',
  RV_REQUEST_HEADERS:  '[data-testid="gql-rv-request-headers"]',

  // ── TLS (Lesson 5) — toggle appears only for https:// endpoints ──────────
  TLS_TOGGLE:          '[data-testid="gql-tls-toggle"]',
  TLS_PANEL:           '[data-testid="gql-tls-panel"]',
  TLS_CONFIGURE:       '[data-testid="gql-tls-configure"]',
  TLS_BODY:            '[data-testid="gql-tls-body"]',
  TLS_SKIP_CERT:       '[data-testid="gql-tls-skip-cert"]',
  TLS_CA_CERT:         '[data-testid="gql-tls-ca-cert"]',
  TLS_CLIENT_CERT:     '[data-testid="gql-tls-client-cert"]',
  TLS_CLIENT_KEY:      '[data-testid="gql-tls-client-key"]',
  TLS_SAVE:            '[data-testid="gql-tls-save"]',
  TLS_CANCEL:          '[data-testid="gql-tls-cancel"]',
  TLS_CLOSE:           '[data-testid="gql-tls-close"]',
  TLS_INDICATOR:       '[data-testid="gql-tls-indicator"]',
  /** TLS mode badge — only present when skip-cert is off and CA PEM is set (Phase 2). */
  TLS_INDICATOR_CA:    '[data-testid="gql-tls-indicator"].gql-tls-mode-badge--ca',
  /** TLS mode badge — client cert + key configured (Phase 3 mTLS). */
  TLS_INDICATOR_MTLS:  '[data-testid="gql-tls-indicator"].gql-tls-mode-badge--mtls',
  /** TLS mode badge — skip-cert active (Phase 1 dev mode). */
  TLS_INDICATOR_SKIP:  '[data-testid="gql-tls-indicator"].gql-tls-mode-badge--skip',

  // ── Auth, Environments & Profiles (Lesson 6) ─────────────────────────────
  AUTH_BADGE_BTN:      '[data-testid="gql-auth-badge-btn"]',
  AUTH_TYPE_SELECT:    '[data-testid="gql-auth-type-select"]',
  AUTH_BEARER_INPUT:   '[data-testid="gql-auth-bearer-input"]',
  AUTH_BASIC_USER:     '[data-testid="gql-auth-basic-user"]',
  AUTH_BASIC_PASS:     '[data-testid="gql-auth-basic-pass"]',
  AUTH_APIKEY_NAME:    '[data-testid="gql-auth-apikey-name"]',
  AUTH_APIKEY_VAL:     '[data-testid="gql-auth-apikey-val"]',
  AUTH_OAUTH_TOKEN_URL: '[data-testid="gql-auth-oauth-token-url"]',
  AUTH_OAUTH_CLIENT_ID: '[data-testid="gql-auth-oauth-client-id"]',
  AUTH_OAUTH_CLIENT_SECRET: '[data-testid="gql-auth-oauth-client-secret"]',
  AUTH_PREVIEW:        '[data-testid="gql-auth-preview"]',
  AUTH_PROFILE_SELECT: '[data-testid="gql-auth-profile-select"]',
  AUTH_PROFILE_HINT:   '[data-testid="gql-auth-profile-hint"]',
  AUTH_INHERIT_BANNER: '[data-testid="gql-auth-inherit-banner"]',
  AUTH_RESET_INHERIT_BTN: '[data-testid="gql-auth-reset-inherit-btn"]',
  AUTH_BADGE_SCOPE_PILL: '[data-testid="gql-auth-badge-scope-pill"]',
  tabAuthDot: (tabId: string) => `[data-testid="gql-tab-auth-dot-${tabId}"]`,
  PROFILE_BADGE:       '[data-testid="gql-profile-badge"]',
  PROFILE_MODAL:       '[data-testid="gql-profile-modal"]',
  PROFILE_NAME_INPUT:  '[data-testid="gql-profile-name-input"]',
  PROFILE_SAVE_BTN:    '[data-testid="gql-profile-save-btn"]',
  PROFILE_CLOSE_BTN:   '[data-testid="gql-profile-close-btn"]',
  ENV_BADGE:           '[data-testid="gql-env-badge"]',
  ENV_MODAL:           '[data-testid="gql-env-modal"]',
  ENV_CLOSE_BTN:       '[data-testid="gql-env-close-btn"]',
  ENV_NEW_BTN:         '[data-testid="gql-env-new-btn"]',
  ENV_SET_ACTIVE_BTN:  '[data-testid="gql-env-set-active-btn"]',
  ENV_VAR_ADD_BTN:     '[data-testid="gql-env-var-add-btn"]',
  ENV_VAR_KEY:         '[data-testid="gql-env-var-key"]',
  ENV_VAR_VALUE:       '[data-testid="gql-env-var-row"] .gql-env-var-input',

  // ── Schema Explorer (Phase 1B) ─────────────────────────────────────────────
  // BUG-P1-R1-6 fix: all SCHEMA_* selectors updated to match actual data-testid
  // values in GraphqlSchemaExplorer.tsx (old "gql-schema-*" prefix was stale).
  SCHEMA_EXPLORER:     '[data-testid="gql-schema-explorer"]',
  SCHEMA_SEARCH:       '[data-testid="gql-se-search"]',
  SCHEMA_TYPE_LIST:    '[data-testid="gql-se-type-list"]',
  SCHEMA_TYPE_DETAIL:  '[data-testid="gql-se-type-detail"]',
  SCHEMA_SDL_TAB:      '[data-testid="gql-se-dtab-sdl"]',
  SCHEMA_FIELDS_TAB:   '[data-testid="gql-se-dtab-fields"]',
  SCHEMA_SDL_VIEW:     '[data-testid="gql-se-detail-panel"]',
  COPY_SDL_BTN:        '[data-testid="gql-se-copy-sdl-btn"]',
  /** Export SDL to file (Lesson 4) — not the schema snapshot button. */
  SNAPSHOT_BTN:        '[data-testid="gql-se-export-sdl-btn"]',
  SE_TAB_TYPES:        '[data-testid="gql-se-tab-types"]',
  SAVE_SNAPSHOT_BTN:   '[data-testid="gql-se-save-snapshot"]',
  CHANGELOG_TAB:       '[data-testid="gql-se-tab-changelog"]',
  CHANGELOG_PANEL:     '[data-testid="gql-changelog-panel"]',
  CHANGELOG_ROW:       '[data-testid="gql-changelog-row"]',
  /** Baseline snapshot row — set via data-lesson-baseline during GQL-12 demo. */
  CHANGELOG_BASELINE_ROW: '[data-lesson-baseline="true"]',
  CHANGELOG_BASELINE_DIFF_BTN: '[data-lesson-baseline="true"] [data-testid="gql-changelog-diff-btn"]',
  CHANGELOG_DIFF_BTN:  '[data-testid="gql-changelog-diff-btn"]',
  CHANGELOG_COMPARE_SELECT: '[data-testid="gql-changelog-compare-select"]',
  CHANGELOG_CLEAR_OLDER_BTN: '[data-testid="gql-changelog-clear-older-btn"]',
  CHANGELOG_ROW_DELETE_BTN: '[data-testid="gql-changelog-row-delete-btn"]',
  CHANGELOG_COMPARE_BAR: '[data-testid="gql-changelog-compare-bar"]',
  CHANGELOG_SHOW_MORE: '[data-testid="gql-changelog-show-more"]',
  SCHEMA_CHANGE_TOAST: '[data-testid="gql-schema-change-toast"]',
  SCHEMA_TYPE_QUERY:   '[data-testid="gql-se-type-Query"]',
  SCHEMA_TYPE_MUTATION:'[data-testid="gql-se-type-Mutation"]',
  SCHEMA_TYPE_USER:    '[data-testid="gql-se-type-User"]',
  TRY_FIELD_HEALTH:    '[data-testid="gql-try-field-health"]',
  INSERT_FIELD_TOAST:  '[data-testid="gql-insert-toast"]',

  // ── Execution (Phase 1C) ───────────────────────────────────────────────────
  CANCEL_BTN:          '[data-testid="gql-cancel-btn"]',

  // ── Subscriptions — Phase 2A/2B/2C ────────────────────────────────────────
  SUBSCRIBE_BTN:           '[data-testid="gql-subscribe-btn"]',
  STOP_SUB_BTN:            '[data-testid="gql-stop-sub-btn"]',
  DISCONNECT_BTN:          '[data-testid="gql-stop-sub-btn"]',
  CONNECTION_STATUS:       '[data-testid="gql-connection-status"]',
  WS_STATUS:               '[data-testid="gql-ws-status"]',
  TRANSPORT_SELECT:        '[data-testid="gql-transport-select"]',
  SUBSCRIPTION_LOG:        '[data-testid="gql-sub-log"]',
  SUBSCRIPTION_MSG_LIST:   '[data-testid="gql-sub-message-list"]',
  SUBSCRIPTION_MSG_ROW:    '[data-testid="gql-sub-row"]',
  SUBSCRIPTION_ROW:        '[data-testid="gql-sub-row"]',
  SUB_STATE:               '[data-testid="gql-sub-state"]',
  SUB_STATS_BAR:           '[data-testid="gql-sub-stats-bar"]',
  SUBSCRIPTION_PAUSE_BTN:  '[data-testid="gql-sub-pause-btn"]',
  SUBSCRIPTION_RESUME_BTN: '[data-testid="gql-sub-resume-btn"]',
  SUBSCRIPTION_CLEAR_BTN:  '[data-testid="gql-sub-clear-btn"]',
  SUBSCRIPTION_EXPORT_BTN: '[data-testid="gql-sub-export-btn"]',
  SUBSCRIPTION_FILTER_BTN: '[data-testid="gql-sub-filter-btn"]',
  SUBSCRIPTION_FILTER_BAR: '[data-testid="gql-sub-filter-bar"]',
  SUBSCRIPTION_FILTER_INPUT:'[data-testid="gql-sub-filter-input"]',
  SUB_STOP_BTN:            '[data-testid="gql-sub-stop-btn"]',
  // Legacy aliases (deprecated testids — do not use in new lesson steps)
  SUBSCRIPTION_STATS:      '[data-testid="gql-sub-stats-bar"]',

  // ── Query Builder — Phase 2F ───────────────────────────────────────────────
  QB_FIELD_TREE:       '[data-testid="gql-qb-field-tree"]',
  QB_CODE:             '[data-testid="gql-qb-code"]',
  QB_COPY:             '[data-testid="gql-qb-copy"]',
  QB_EDIT:             '[data-testid="gql-qb-edit"]',
  QB_SELECT_ALL:       '[data-testid="gql-qb-select-all"]',
  QB_SUMMARY:          '[data-testid="gql-qb-summary"]',
  QB_FIELD_OPTIONS:    '[data-testid="gql-qb-field-options"]',
  QB_PREVIEW:          '[data-testid="gql-qb-preview"]',
  QB_ARG_USER_ID:      '[data-testid="gql-qb-arg-user-id"] .gql-qb-arg-input',
  FO_ALIAS_USER_ID:    '[data-testid="gql-fo-alias-user.id"]',
  FO_EXPAND_USER_ID:   '[data-testid="gql-fo-expand-user.id"]',
  FO_INCLUDE_USER_ID:  '[data-testid="gql-fo-include-user.id"]',
  // Legacy aliases (stale testids — prefer QB_* above)
  BUILDER_TAB:          '[data-testid="gql-qb-field-tree"]',
  BUILDER_OP_TYPE:      '[data-testid="gql-qb-op-query"]',
  BUILDER_OP_NAME:      '[data-testid="gql-qb-op-name"]',
  BUILDER_FIELD_TREE:   '[data-testid="gql-qb-field-tree"]',
  BUILDER_FIELD_ROW:    '.gql-qb-field-row',
  BUILDER_FIELD_CHECK:  '.gql-qb-check',
  BUILDER_ARG_INPUT:    '.gql-qb-arg-input',
  BUILDER_SEARCH:       '[data-testid="gql-qb-search"]',
  BUILDER_BREADCRUMB:   '[data-testid="gql-qb-summary"]',
  BUILDER_PREVIEW:      '[data-testid="gql-qb-preview"]',
  BUILDER_COPY_SDL:     '[data-testid="gql-qb-copy"]',
  BUILDER_EDIT_EDITOR:  '[data-testid="gql-qb-edit"]',
  BUILDER_EXECUTE:      '[data-testid="gql-qb-execute"]',

  // ── Subscription Assertions — Phase 2C-5 ─────────────────────────────────
  ASSERTION_PANEL:     '[data-testid="gql-assertion-panel"]',
  ASSERTION_TOGGLE:    '[data-testid="gql-assertion-toggle"]',
  ASSERTION_ADD_BTN:   '[data-testid="gql-assertion-add-btn"]',
  ASSERTION_ROW:       '[data-testid="gql-assertion-row"]',
  ASSERTION_JSONPATH:  '[data-testid="gql-assertion-jsonpath"]',
  ASSERTION_OPERATOR:  '[data-testid="gql-assertion-operator"]',
  ASSERTION_EXPECTED:  '[data-testid="gql-assertion-expected"]',
  ASSERTION_DELETE:    '[data-testid="gql-assertion-delete"]',
  ASSERTION_BADGE:     '[data-testid="gql-assertion-badge"]',
  ASSERTION_AGGREGATE: '[data-testid="gql-assertion-aggregate"]',

  // ── File Upload — Phase 2E ─────────────────────────────────────────────────
  FILES_TAB:         '[data-testid="gql-files-tab"]',
  FILES_DROPZONE:    '[data-testid="gql-files-dropzone"]',
  FILES_BROWSE_BTN:  '[data-testid="gql-files-browse-btn"]',
  FILES_LIST:        '[data-testid="gql-files-list"]',
  FILES_ROW:         '[data-testid="gql-files-row"]',
  FILES_REMOVE_BTN:  '[data-testid="gql-files-remove-btn"]',
  FILES_SIZE_ERROR:  '[data-testid="gql-files-size-error"]',
  FILES_PROGRESS:    '[data-testid="gql-files-progress"]',

  // ── Incremental Delivery — Phase 2D ────────────────────────────────────────
  DEFER_SKELETON:    '[data-testid="gql-defer-skeleton"]',
  CHUNK_TRACKER:     '[data-testid="gql-chunk-tracker"]',

  // ── Performance — Phase 2G ─────────────────────────────────────────────────
  COMPLEXITY_BADGE:    '[data-testid="gql-complexity-badge"]',
  RV_TRACING_BADGE:    '[data-testid="gql-rv-tracing-badge"]',
  RV_TAB_TRACING:      '[data-testid="gql-rv-tab-tracing"]',
  TRACE_VIEW:          '[data-testid="gql-trace-view"]',
  TRACE_RESOLVER_ROW:  '[data-testid="gql-trace-resolver-row"]',
  TRACE_SORT_DURATION: '[data-testid="gql-trace-sort-duration"]',
  HISTOGRAM_STRIP:     '[data-testid="gql-histogram-strip"]',
  /** @deprecated Use RV_TAB_TRACING — no standalone gql-tracing-tab exists */
  TRACING_TAB:         '[data-testid="gql-rv-tab-tracing"]',
  /** @deprecated Use TRACE_VIEW */
  TRACING_WATERFALL:   '[data-testid="gql-trace-view"]',
  /** @deprecated Use TRACE_SORT_DURATION */
  TRACING_SORT:        '[data-testid="gql-trace-sort-duration"]',

  // ── Activity Bar — Phase 3A ───────────────────────────────────────────────
  ACTIVITY_BAR:        '[data-testid="gql-activity-bar"]',
  ACTIVITY_HISTORY:    '[data-testid="gql-activity-history"]',
  ACTIVITY_COLLECTIONS:'[data-testid="gql-activity-collections"]',
  ACTIVITY_MOCK:       '[data-testid="gql-activity-mock"]',

  // ── History Panel — Phase 3A ────────────────────────────────────────────
  HISTORY_PANEL:       '[data-testid="gql-history-panel"]',
  HISTORY_SEARCH:      '[data-testid="gql-history-search"]',
  HISTORY_COMPARE_TOGGLE: '[data-testid="gql-history-compare-toggle"]',
  HISTORY_COMPARE_BAR:    '[data-testid="gql-history-compare-bar"]',
  HISTORY_COMPARE_BTN:    '[data-testid="gql-history-compare-btn"]',
  HISTORY_COMPARE_PANEL:  '[data-testid="gql-history-compare-panel"]',
  HISTORY_COMPARE_TABLE:  '[data-testid="gql-history-compare-table"]',
  HISTORY_COMPARE_MARK:   '[data-testid="gql-history-compare-mark"]',
  /** Compare mark on a row not yet assigned slot A/B — avoids toggling off an existing mark. */
  HISTORY_COMPARE_MARK_UNMARKED: '[data-testid="gql-history-entry"]:not([data-compare-slot]) [data-testid="gql-history-compare-mark"]',
  HISTORY_ENTRY:       '[data-testid="gql-history-entry"]',
  HISTORY_ENTRY_SLOT_A:'[data-testid="gql-history-entry"][data-compare-slot="A"]',
  HISTORY_ENTRY_SLOT_B:'[data-testid="gql-history-entry"][data-compare-slot="B"]',
  /** Compare bar slot labels — update synchronously with React state (before row data-compare-slot). */
  HISTORY_COMPARE_SLOT_A_FILLED: '[data-testid="gql-history-compare-slot-a"][data-filled="true"]',
  HISTORY_COMPARE_SLOT_B_FILLED: '[data-testid="gql-history-compare-slot-b"][data-filled="true"]',
  HISTORY_COMPARE_BTN_ENABLED: '[data-testid="gql-history-compare-btn"]:not([disabled])',
  HISTORY_PREVIEW:            '[data-testid="gql-history-preview"]',
  HISTORY_PREVIEW_VARS_TAB:   '[data-testid="gql-history-preview-tab-variables"]',
  HISTORY_PREVIEW_VARS_PANEL: '[data-testid="gql-history-preview-variables"]',
  HISTORY_LOAD:        '[data-testid="gql-history-load"]',
  HISTORY_RUN:         '[data-testid="gql-history-run"]',
  HISTORY_SAVE_TO_COL: '[data-testid="gql-history-save-to-col"]',
  HISTORY_CLEAR:       '[data-testid="gql-history-clear"]',
  HISTORY_MAX_ITEMS:   '[data-testid="gql-history-max-items"]',
  HISTORY_SETTINGS:    '[data-testid="gql-history-settings"]',
  HISTORY_CONTEXT_MENU:'[data-testid="gql-history-context-menu"]',

  // ── Collections Panel — Phase 3A ────────────────────────────────────────
  COLLECTIONS_PANEL:   '[data-testid="gql-collections-panel"]',
  COLLECTIONS_NEW:     '[data-testid="gql-collections-new"]',
  COLLECTIONS_EXPORT:  '[data-testid="gql-collections-export"]',
  COLLECTIONS_IMPORT:  '[data-testid="gql-collections-import"]',
  COLLECTIONS_SEARCH:  '[data-testid="gql-collections-search"]',
  COLLECTIONS_TREE:    '[data-testid="gql-collections-tree"]',
  COL_NODE:            '[data-testid="gql-col-node"]',
  COL_RUN_ALL:         '[data-testid="gql-col-run-all"]',
  COL_ITEM:            '[data-testid="gql-col-item"]',
  COL_ITEM_RENAME:     '[data-testid="gql-col-item-rename-input"]',
  COL_SAVE_CURRENT:    '[data-testid="gql-col-save-current"]',
  COL_VARS_EDITOR:     '[data-testid="gql-col-vars-editor"]',
  COLLECTIONS_IMPORT_INPUT: '[data-testid="gql-collections-import-input"]',
  IMPORT_MODE_DIALOG:  '[data-testid="gql-import-mode-dialog"]',
  IMPORT_MODE_MERGE:   '[data-testid="gql-import-mode-merge"]',
  COL_CTX_MENU:        '.gql-history-context-menu',
  SAVE_COL_MODAL:      '[data-testid="gql-save-col-modal"]',
  SAVE_COL_NAME:       '[data-testid="gql-save-col-name"]',
  SAVE_COL_SAVE:       '[data-testid="gql-save-col-save"]',
  SAVE_COL_CANCEL:     '[data-testid="gql-save-col-cancel"]',

  // ── Collection Runner — Phase 3A ────────────────────────────────────────
  RUNNER_PANEL:        '[data-testid="gql-runner-panel"]',
  RUNNER_TABLE:        '[data-testid="gql-runner-table"]',
  RUNNER_CONSOLE:      '[data-testid="gql-runner-console"]',
  RUNNER_PAUSE:        '[data-testid="gql-runner-pause"]',
  RUNNER_RESUME:       '[data-testid="gql-runner-resume"]',
  RUNNER_ABORT:        '[data-testid="gql-runner-abort"]',
  RUNNER_EXPORT:       '[data-testid="gql-runner-export"]',

  // ── Schema Diff — Phase 3D ──────────────────────────────────────────────
  DIFF_MODAL:          '[data-testid="gql-diff-modal"]',
  DIFF_ROW:            '[data-testid="gql-diff-row"]',
  DIFF_ACK_BTN:        '[data-testid="gql-diff-ack-btn"]',
  DIFF_SUMMARY:        '.gql-diff-summary',
  DIFF_CONTENT:        '.gql-diff-content',
  DIFF_FILTERS:        '.gql-diff-filters',
  DIFF_COUNT_BREAKING: '.gql-diff-count--breaking',
  DIFF_FILTER_ALL:     '.gql-diff-filter--all',
  DIFF_FILTER_BREAKING: '.gql-diff-filter--breaking',
  DIFF_FILTER_SAFE:    '.gql-diff-filter--safe',
  DIFF_FILTER_DEPRECATED: '.gql-diff-filter--deprecated',
  DIFF_EXPORT_JSON:    '[data-testid="gql-diff-export-json"]',
  DIFF_EXPORT_HTML:    '[data-testid="gql-diff-export-html"]',
  DIFF_SDL_VIEW:       '[data-testid="gql-diff-sdl-view"]',

  // ── Mock Panel — Phase 3E ───────────────────────────────────────────────
  MOCK_PANEL:          '[data-testid="gql-mock-panel"]',
  MOCK_TOGGLE:         '[data-testid="gql-mock-toggle"]',
  /** Visible toggle card — use for spotlight (checkbox input is display:none). */
  MOCK_TOGGLE_CARD:    '[data-testid="gql-mock-toggle-card"]',
  MOCK_LATENCY_VALUE:  '[data-testid="gql-mock-latency-value"]',
  MOCK_GUARD:          '[data-testid="gql-mock-guard"]',
  MOCK_STATUS_ROW:     '[data-testid="gql-mock-status-row"]',
  MOCK_SCHEMA_SOURCE:  '[data-testid="gql-mock-schema-source"]',
  MOCK_SDL_EDITOR:     '[data-testid="gql-mock-sdl-editor"]',
  MOCK_LATENCY_SLIDER: '[data-testid="gql-mock-latency-slider"]',
  MOCK_JITTER_INPUT:   '[data-testid="gql-mock-jitter-input"]',
  MOCK_SEED_INPUT:     '[data-testid="gql-mock-seed-input"]',
  MOCK_RESOLVERS_LIST: '[data-testid="gql-mock-resolvers-list"]',
  MOCK_TYPE_GROUP:     '[data-testid="gql-mock-type-group"]',
  MOCK_TYPE_HEADER:    '[data-testid="gql-mock-type-header"]',
  MOCK_FIELD_ROW:      '[data-testid="gql-mock-field-row"]',
  MOCK_RESOLVER_SELECT:'[data-testid="gql-mock-resolver-select"]',
  MOCK_FIXED_INPUT:    '[data-testid="gql-mock-fixed-input"]',
  /** GQL-13 lesson spotlight: Query.health resolver row (set in preAction). */
  LESSON13_MOCK_HEALTH_ROW: '[data-lesson-target="mock-health"]',
  MOCK_SCENARIOS:      '[data-testid="gql-mock-scenarios"]',
  MOCK_SCALAR_FACTORIES:'[data-testid="gql-mock-scalar-factories"]',
  MOCK_LOG:            '[data-testid="gql-mock-log"]',

  // ── Batch Execution — Phase 3F ──────────────────────────────────────────
  /** "Send Batch (N)" button in the connection bar — appears only when batch mode is enabled. */
  BATCH_EXECUTE_BTN:   '[data-testid="gql-send-batch-btn"]',
  BATCH_RESULTS:       '[data-testid="gql-batch-results"]',
  /** Phase 6G — batch configuration panel inside Advanced Settings → Batch. */
  ADV_BATCH_PANEL:     '[data-testid="gql-adv-batch-panel"]',
  ADV_BATCH_GROUP_SELECT: '[data-testid="gql-adv-batch-group-select"]',
  ADV_BATCH_GROUP_LABEL:  '[data-testid="gql-adv-batch-group-label"]',
  ADV_BATCH_SELECTION_HINT: '[data-testid="gql-adv-batch-selection-hint"]',
  advBatchTabRow:      (tabId: string) => `[data-testid="gql-adv-batch-tab-row-${tabId}"]`,
  advBatchTabCb:       (tabId: string) => `[data-testid="gql-adv-batch-tab-cb-${tabId}"]`,
  /** @deprecated Tab-bar checkboxes removed in 6G — use advBatchTabCb in Advanced Settings. */
  TAB_BATCH_CHECKBOX:  '.gql-adv-batch-panel__tab-cb-input',
  BATCH_SUMMARY_CHIP:  '[data-testid="gql-batch-summary-chip"]',
  TAB_BATCH_BADGE:     '.gql-tab-batch-badge',

  // ── Advanced Settings — Phase 3F ─────────────────────────────────────────
  /** Gear button that opens the Advanced Settings popover. */
  ADV_SETTINGS_BTN:        '[data-testid="gql-adv-settings-btn"]',
  /** Footer Close button inside the Advanced Settings popover. */
  ADV_SETTINGS_CANCEL_BTN: '[data-testid="gql-adv-settings-cancel-btn"]',
  ADV_SETTINGS_SAVE_BTN:   '[data-testid="gql-adv-settings-save-btn"]',
  /** @deprecated Use ADV_SETTINGS_CANCEL_BTN */
  ADV_SETTINGS_CLOSE_BTN:  '[data-testid="gql-adv-settings-cancel-btn"]',
  /** Batch tab inside Advanced Settings. */
  ADV_SETTINGS_TAB_BATCH:  '[data-testid="gql-adv-settings-tab-batch"]',
  /** Hidden checkbox input for batch mode (use ADV_BATCH_ENABLE_TOGGLE for demo clicks). */
  ADV_BATCH_ENABLE:        '[aria-label="Enable query batching"]',
  /** Visible label row for Enable query batching — demo player clicks this. */
  ADV_BATCH_ENABLE_TOGGLE: '[data-testid="gql-adv-batch-enable-toggle"]',
  advBatchTabLabel:        (tabId: string) => `[data-testid="gql-adv-batch-tab-label-${tabId}"]`,

  // ── Workflow canvas nodes (Phase 4) — the draggable node cards on canvas ─────
  WF_CANVAS_QUERY_NODE:        '[data-testid="gql-canvas-query-node"]',
  WF_CANVAS_MUTATION_NODE:     '[data-testid="gql-canvas-mutation-node"]',
  WF_CANVAS_SUBSCRIPTION_NODE: '[data-testid="gql-canvas-subscription-node"]',
  WF_CANVAS_INTROSPECT_NODE:   '[data-testid="gql-canvas-introspect-node"]',
  WF_CANVAS_ASSERT_NODE:       '[data-testid="gql-canvas-assert-node"]',

  // ── Workflow node config panels (Phase 4) — rendered inside the modal ────────
  WF_QUERY_PANEL:        '[data-testid="gql-wf-query-panel"]',
  WF_MUTATION_PANEL:     '[data-testid="gql-wf-mutation-panel"]',
  WF_SUBSCRIPTION_PANEL: '[data-testid="gql-wf-subscription-panel"]',
  WF_SUBSCRIPTION_QUERY_EDITOR:'[data-testid="gql-wf-subscription-query-editor"]',
  WF_SUB_VARIABLES_EDITOR: '[data-testid="gql-wf-sub-variables-editor"]',
  WF_STOP_SECS_INPUT:    '[data-testid="gql-wf-stop-secs-input"]',
  WF_STOP_MESSAGES_INPUT:'[data-testid="gql-wf-stop-messages-input"]',
  WF_INTROSPECT_PANEL:   '[data-testid="gql-wf-introspect-panel"]',
  WF_ASSERT_PANEL:       '[data-testid="gql-wf-assert-panel"]',
  WF_IMPORT_BTN:         '[data-testid="gql-wf-import-collections-btn"]',
  WF_IMPORT_MODAL:       '[data-testid="gql-wf-import-col-modal"]',
  WF_IMPORT_SEARCH:      '[data-testid="gql-wf-import-col-search"]',
  WF_IMPORT_ITEM:        '[data-testid="gql-wf-import-col-item"]',
  WF_IMPORT_CONFIRM:     '[data-testid="gql-wf-import-col-import"]',
  WF_IMPORT_CANCEL:      '[data-testid="gql-wf-import-col-cancel"]',
  WF_IMPORT_EMPTY:       '[data-testid="gql-wf-import-col-empty"]',
  WF_EXTRACTION_TEST_BTN:'[data-testid="gql-wf-extraction-test-btn"]',
  WF_ASSERT_RUN_TEST_BTN:'[data-testid="gql-wf-assert-run-test-btn"]',
  WF_ASSERT_ROW:         '[data-testid="gql-wf-assert-row"]',
  WF_ASSERT_JSONPATH:    '[data-testid="gql-wf-assert-jsonpath"]',
  WF_ASSERT_OPERATOR:    '[data-testid="gql-wf-assert-operator"]',
  WF_ASSERT_EXPECTED:    '[data-testid="gql-wf-assert-expected"]',
  WF_ASSERT_ADD_BTN:     '[data-testid="gql-wf-assert-add-btn"]',
  WF_ASSERT_DESCRIPTION: '[data-testid="gql-wf-assert-description"]',
  WF_QUERY_EDITOR:       '[data-testid="gql-wf-query-editor"]',
  WF_VARIABLES_EDITOR:   '[data-testid="gql-wf-variables-editor"]',
  WF_EXTRACTION_ADD_BTN: '[data-testid="gql-wf-extraction-add-btn"]',
  WF_EXTRACTION_JSONPATH:'[data-testid="gql-wf-extraction-jsonpath"]',
  WF_EXTRACTION_VARNAME: '[data-testid="gql-wf-extraction-varname"]',
  WF_OUTPUT_ADD_BTN:     '[data-testid="gql-wf-output-add-btn"]',
  WF_OUTPUT_FIELD_SELECT:'[data-testid="gql-wf-output-field-select"]',
  WF_OUTPUT_VARNAME:     '[data-testid="gql-wf-output-varname"]',
  WF_EXTRACTION_TABLE:   '[data-testid="gql-wf-extraction-table"]',
  WF_OUTPUT_TABLE:       '[data-testid="gql-wf-output-table"]',
} as const;
