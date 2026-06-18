/**
 * Shared UI selectors — single source of truth for data-testid attributes
 * and CSS selectors used across E2E tests, demo lessons, and test scenarios.
 *
 * RULE: Never hardcode selector strings in demo lessons or E2E tests.
 *       Import from this file instead. When a UI element changes its
 *       testid or class name, update it HERE and TypeScript will flag
 *       every consumer that needs attention.
 */

// ─── WebSocket Studio: Mode & Tabs ──────────────────────────────
export const WS = {
  // Mode toggle
  MODE_CLIENT:       '[data-testid="mode-client"]',
  MODE_MOCK:         '[data-testid="mode-mock"]',
  MODE_SAVED:        '[data-testid="mode-saved"]',

  // Left sidebar tabs
  LEFT_TAB_CONNECT:  '[data-testid="left-tab-connect"]',
  LEFT_TAB_SEND:     '[data-testid="left-tab-send"]',
  LEFT_TAB_AUTH:     '[data-testid="left-tab-auth"]',
  LEFT_TAB_HEADERS:  '[data-testid="left-tab-headers"]',
  LEFT_TAB_PARAMS:   '[data-testid="left-tab-params"]',

  // Right sidebar tabs
  RIGHT_TAB_EVENTS:  '[data-testid="right-tab-events"]',
  RIGHT_TAB_CONSOLE: '[data-testid="right-tab-console"]',

  // Console panel (variant=ws)
  CONSOLE_CMD_INPUT:      '[data-testid="ws-console-cmd-input"]',
  CONSOLE_CATEGORY:       '[data-testid="ws-console-category"]',
  CONSOLE_SEARCH:         '[data-testid="ws-console-search"]',
  CONSOLE_VIEW_STRUCTURED:'[data-testid="ws-console-view-structured"]',
  CONSOLE_VIEW_RAW:       '[data-testid="ws-console-view-raw"]',
  CONSOLE_CLEAR:          '[data-testid="ws-console-clear"]',
  CONSOLE_COUNT:          '[data-testid="ws-console-count"]',
  CONSOLE_ENTRY:          '[data-testid^="ws-console-entry-"]',

  // Connection tabs
  CONN_TAB_BAR:      '[data-testid="conn-tab-bar"]',
  CONN_TAB_ADD:      '[data-testid="conn-tab-add"]',
  CONN_TAB_FIRST:    '[data-testid="conn-tab-bar"] [role="tab"]:first-child',
  CONN_TAB_LAST:     '[data-testid="conn-tab-bar"] > [role="tab"]:not(:has(~ [role="tab"]))',
  CONN_TAB_CLOSE:    '[data-testid^="conn-tab-close-"]',
  CONN_TAB_RENAME:   '[data-testid^="conn-tab-rename-"]',
  CONN_TAB_HISTORY:  '[data-testid="conn-tab-history-trigger"]',
  CONN_TAB_HISTORY_DD: '[data-testid="conn-tab-history-dropdown"]',

  // Mock server
  MOCK_START_BTN:    '[data-testid="mock-start-btn"]',
  MOCK_STOP_BTN:     '[data-testid="mock-stop-btn"]',
  /** Matches either start or stop — for spotlight on "the mock button" */
  MOCK_BTN_ANY:      '[data-testid="mock-start-btn"], [data-testid="mock-stop-btn"]',
  MOCK_STATUS_LABEL: '[data-testid="mock-status-label"]',
  MOCK_CLIENT_COUNT: '[data-testid="mock-client-count"]',
  MOCK_BROADCAST_INPUT: '[data-testid="mock-broadcast-input"]',
  MOCK_BROADCAST_BTN:   '[data-testid="mock-broadcast-btn"]',
  MOCK_FALLBACK_SELECT: '[data-testid="mock-fallback-select"]',
  // Mock rules pane
  MOCK_TAB_RULES:       '[data-testid="mock-tab-rules"]',
  MOCK_TAB_LOG:         '[data-testid="mock-tab-log"]',
  MOCK_ADD_RULE:        '[data-testid="mock-add-rule"]',
  MOCK_EMPTY_RULES:     '[data-testid="mock-empty-rules"]',
  MOCK_SERVER_PANEL:    '[data-testid="mock-server-panel"]',
  MOCK_TEST_SECTION:    '[data-testid="mock-test-section"]',
  MOCK_TEST_INPUT:      '[data-testid="mock-test-input"]',
  MOCK_TEST_RESULT:     '[data-testid="mock-test-result"]',
  MOCK_LOG:             '[data-testid="mock-log"]',
  /** Delete button on any rule card — used for bulk-delete in setup/cleanup */
  MOCK_RULE_DELETE_ANY: '[data-testid^="rule-delete-"]',
  /** First rule card — used for spotlight before we know the rule ID */
  MOCK_RULE_FIRST:      '[data-testid^="mock-rule-"]',
  /** Toggle checkbox on the first rule card (CSS-hidden; use MOCK_RULE_TOGGLE_LABEL_FIRST for clicks) */
  MOCK_RULE_TOGGLE_FIRST: '[data-testid^="rule-toggle-"]',
  /** Visible toggle-switch label on the first rule card (use this for ctx.click / spotlight) */
  MOCK_RULE_TOGGLE_LABEL_FIRST: '[data-testid^="rule-toggle-label-"]',
  /** Delay input on the first rule card */
  MOCK_RULE_DELAY_FIRST:  '[data-testid^="rule-delay-"]',
  /** Response data textarea on the first rule card (only in DOM when response type = static|template) */
  MOCK_RULE_RESPONSE_FIRST: '[data-testid^="rule-response-data-"]',
  /** Match pattern input on the first rule card (only in DOM when match type ≠ any) */
  MOCK_RULE_PATTERN_FIRST:  '[data-testid^="rule-match-pattern-"]',
  /** Match-type dropdown on the first rule card (always in DOM when card is open) */
  MOCK_RULE_MATCH_TYPE_FIRST:   '[data-testid^="rule-match-type-"]',
  /** Response-type dropdown on the first rule card (always in DOM when card is open) */
  MOCK_RULE_RESPONSE_TYPE_FIRST: '[data-testid^="rule-response-type-"]',

  // Connect panel
  CONNECT_BTN:       '[data-testid="connect-btn"]',
  DISCONNECT_BTN:    '[data-testid="disconnect-btn"]',
  URL_INPUT:         '[aria-label="WebSocket URL"]',
  PROTOCOL_SELECT:   '[data-testid="protocol-select"]',

  // Socket.IO send-pane fields (shown when protocol = socket-io)
  SIO_COMPOSE_FIELDS: '[data-testid="sio-compose-fields"]',
  SIO_EVENT_NAME:     '[data-testid="sio-event-name"]',
  SIO_NAMESPACE:      '[data-testid="sio-namespace"]',
  SIO_MODE_BADGE:     '[data-testid="sio-mode-badge"]',
  SIO_SERVER_PARAMS:  '[data-testid="sio-server-params"]',

  // STOMP send-pane fields (shown when protocol = stomp)
  STOMP_COMPOSE_FIELDS: '[data-testid="stomp-compose-fields"]',
  STOMP_COMMAND:        '[data-testid="stomp-command"]',
  STOMP_DESTINATION:    '[data-testid="stomp-destination"]',
  STOMP_LOGIN:          '[data-testid="stomp-login"]',
  STOMP_PASSCODE:       '[data-testid="stomp-passcode"]',
  STOMP_MODE_BADGE:     '[data-testid="stomp-mode-badge"]',

  // GraphQL-WS send-pane fields (shown when protocol = graphql-ws)
  GQL_COMPOSE_FIELDS:   '[data-testid="gql-compose-fields"]',
  GQL_OPERATION_NAME:   '[data-testid="gql-operation-name"]',
  GQL_VARIABLES:        '[data-testid="gql-variables"]',
  GQL_OP_ID:            '[data-testid="gql-op-id"]',

  // Saved Profiles
  SAVED_CONNECTIONS:    '[data-testid="saved-connections"]',
  SAVED_EMPTY:          '[data-testid="saved-empty"]',
  SAVED_SEARCH:         '[data-testid="saved-search"]',
  SAVED_COUNT:          '[data-testid="saved-count"]',
  NEW_PROFILE_BTN:      '[data-testid="new-profile-btn"]',
  SAVE_AS_PROFILE_BTN:  '[data-testid="save-as-profile-btn"]',
  PROFILE_EDITOR_MODAL: '[data-testid="profile-editor-modal"]',
  PROFILE_NAME_INPUT:   '[data-testid="profile-name-input"]',
  PROFILE_URL_INPUT:    '[data-testid="profile-url-input"]',
  PROFILE_SAVE_BTN:     '[data-testid="profile-save-btn"]',
  PROFILE_CANCEL_BTN:   '[data-testid="profile-cancel-btn"]',
  EXPORT_BTN:           '[data-testid="export-btn"]',
  IMPORT_BTN:           '[data-testid="import-btn"]',

  // Message Templates (Send panel)
  TEMPLATE_TRIGGER:     '[data-testid="template-trigger"]',
  TEMPLATE_DROPDOWN:    '[data-testid="template-dropdown"]',
  TEMPLATE_EMPTY:       '[data-testid="template-empty"]',
  TEMPLATE_LIST:        '[data-testid="template-list"]',
  TEMPLATE_SAVE_NAME:   '[data-testid="template-save-name"]',
  TEMPLATE_SAVE_BTN:    '[data-testid="template-save-btn"]',

  // Environment Variable Preview (connect panel)
  ENV_PREVIEW:          '[data-testid="env-preview"]',
  ENV_UNRESOLVED_WARN:  '[data-testid="env-unresolved-warning"]',
  ENV_NO_ENV_WARN:      '[data-testid="env-no-env-warning"]',

  // Connect panel extras
  SUBPROTOCOLS_INPUT:   '[aria-label="Subprotocols"]',

  // Send panel
  MESSAGE_INPUT:     '[aria-label="Message input"]',
  SEND_BTN:          '[data-testid="send-btn"]',
  COMPOSE_INPUT:     '.ws-compose-input',

  // Events / Messages
  MESSAGE_ROW:       '.ws-message-row',
  CLEAR_BTN:         '[data-testid="clear-btn"]',

  // Session Recording & Replay (Events toolbar)
  REC_START_BTN:       '[data-testid="start-recording-btn"]',
  REC_STOP_BTN:        '[data-testid="stop-recording-btn"]',
  REC_IMPORT_BTN:      '[data-testid="import-recording-btn"]',
  REC_FILE_INPUT:      '[data-testid="recording-file-input"]',
  REC_IMPORT_ERROR:    '[data-testid="import-error"]',
  REPLAY_START_BTN:    '[data-testid="start-replay-btn"]',
  REPLAY_BAR:          '[data-testid="replay-bar"]',
  REPLAY_PLAYPAUSE:    '[data-testid="replay-playpause-btn"]',
  REPLAY_SPEED:        '[data-testid="replay-speed-select"]',
  REPLAY_PROGRESS:     '[data-testid="replay-progress"]',
  REPLAY_EXIT:         '[data-testid="replay-exit-btn"]',

  // Search & Filter
  SEARCH_MODE_PILLS: '[data-testid="search-mode-pills"]',
  SEARCH_MODE_TEXT:   '[data-testid="search-mode-text"]',
  SEARCH_MODE_REGEX:  '[data-testid="search-mode-regex"]',
  SEARCH_MODE_JSONPATH: '[data-testid="search-mode-jsonpath"]',
  SEARCH_INPUT:      '[data-testid="search-input"]',
  MATCH_COUNTER:     '[data-testid="match-counter"]',
  DIRECTION_FILTER:  '[aria-label="Direction filter"]',
  FILTER_TOGGLE_BTN: '[data-testid="filter-toggle-btn"]',
  FILTER_BAR:        '[data-testid="filter-bar"]',

  // Compare / Diff
  COMPARE_BTN:       '[data-testid="compare-btn"]',
  COMPARE_BANNER:    '[data-testid="compare-banner"]',
  COMPARE_CANCEL:    '[data-testid="compare-cancel"]',
  DIFF_MODAL:        '[data-testid="diff-modal"]',
  DIFF_CLOSE:        '[data-testid="diff-close"]',

  // Schema
  RIGHT_TAB_SCHEMA:  '[data-testid="right-tab-schema"]',
  SCHEMA_PANEL:      '[data-testid="ws-schema-panel"]',
  SCHEMA_ADD_BTN:      '[data-testid="ws-schema-add-btn"]',
  SCHEMA_GENERATE_BTN: '[data-testid="ws-schema-generate-btn"]',
  SCHEMA_NAME_INPUT:   '[data-testid="ws-schema-name-input"]',
  SCHEMA_DIRECTION_SELECT: '[data-testid="ws-schema-direction-select"]',
  SCHEMA_TEXTAREA:   '[data-testid="ws-schema-textarea"]',
  SCHEMA_SAVE_BTN:   '[data-testid="ws-schema-save-btn"]',
  SCHEMA_CARD:       '[data-testid="ws-schema-card"]',
  VALIDATION_TOGGLE: '[data-testid="ws-validation-toggle"]',

  // Auto-Reconnect (Connect panel)
  RECONNECT_SETTINGS:   '[data-testid="reconnect-settings"]',
  RECONNECT_TOGGLE:     '[data-testid="auto-reconnect-toggle"]',
  RECONNECT_MAX:        '[data-testid="max-reconnect-attempts"]',
  RECONNECT_INTERVAL:   '[data-testid="reconnect-interval-ms"]',
  RECONNECT_BACKOFF:    '[data-testid="backoff-multiplier"]',
  RECONNECT_BANNER:     '[data-testid="reconnect-banner"]',
  RECONNECT_CANCEL:     '[data-testid="cancel-reconnect-btn"]',
  RECONNECT_FAILED:     '[data-testid="reconnect-failed"]',
  RETRY_NOW_BTN:        '[data-testid="retry-now-btn"]',

  // Close with Code (Connect panel)
  DISCONNECT_CARET:     '[data-testid="disconnect-caret"]',
  CLOSE_CODE_DROPDOWN:  '[data-testid="close-code-dropdown"]',
  CLOSE_CODE_INPUT:     '[data-testid="close-code-input"]',
  CLOSE_REASON_INPUT:   '[data-testid="close-reason-input"]',
  CLOSE_WITH_CODE_BTN:  '[data-testid="close-with-code-btn"]',

  // Stats tab (right panel)
  RIGHT_TAB_STATS:    '[data-testid="right-tab-stats"]',
  STATS_PANE:         '[data-testid="ws-studio-stats-pane"]',
  STATS_PANEL:        '[data-testid="stats-panel"]',
  STATS_MSG_RATE:     '[data-testid="stats-msg-rate"]',
  STATS_BYTES_IN:     '[data-testid="stats-bytes-in"]',
  STATS_BYTES_OUT:    '[data-testid="stats-bytes-out"]',
  STATS_FRAMES:       '[data-testid="stats-frames"]',

  // Status bar (Connect panel footer)
  STATUS_BAR:        '[data-testid="status-bar"]',
  STATUS_BADGE:      '[data-testid="status-badge"]',
  LATENCY:           '[data-testid="latency"]',
  UPTIME:            '[data-testid="uptime"]',

  // URL History (Connect panel)
  URL_HISTORY_TRIGGER:  '[data-testid="url-history-trigger"]',
  URL_HISTORY_DROPDOWN: '[data-testid="url-history-dropdown"]',

  // TLS / mTLS (Connect panel, visible only for wss:// URLs)
  TLS_PANEL:          '[data-testid="tls-panel"]',
  TLS_TOGGLE:         '[data-testid="tls-toggle"]',
  TLS_BODY:           '[data-testid="tls-body"]',
  TLS_INDICATOR:      '[data-testid="tls-indicator"]',
  TLS_PROXY_NOTICE:   '[data-testid="tls-proxy-notice"]',
  TLS_SKIP_CERT:      '[data-testid="tls-reject-unauthorized"]',
  TLS_CA_CERT:        '[data-testid="tls-ca-cert"]',
  TLS_CLIENT_CERT:    '[data-testid="tls-client-cert"]',
  TLS_CLIENT_KEY:     '[data-testid="tls-client-key"]',

  // Transport badge (shown when connected)
  TRANSPORT_BADGE:    '[data-testid="transport-badge"]',

  // Status indicators
  STATUS_LABEL:      '.ws-messages-status-label',
  STATUS_CONNECTED:  '.ws-status-dot.connected',

  // Auth panel
  AUTH_TYPE_SELECT:   '.auth-type-select',
  AUTH_TYPE_DROPDOWN: '.auth-type-select select',
  AUTH_PANEL:         '.ws-auth-panel',
  AUTH_PANE_INPUTS:   '.ws-auth-pane input',
  AUTH_CALLOUT:       '.ws-auth-callout',

  // Load Test
  RIGHT_TAB_LOADTEST:  '[data-testid="right-tab-loadtest"]',
  LT_PANEL:            '[data-testid="load-test-panel"]',
  LT_CONFIG:           '[data-testid="lt-config"]',
  LT_PROFILE_PILLS:    '[data-testid="lt-profile-pills"]',
  LT_PROFILE_CONSTANT: '[data-testid="lt-profile-constant"]',
  LT_PROFILE_RAMP:     '[data-testid="lt-profile-ramp"]',
  LT_PROFILE_BURST:    '[data-testid="lt-profile-burst"]',
  LT_MESSAGE_TEMPLATE: '[data-testid="lt-message-template"]',
  LT_RATE:             '[data-testid="lt-rate"]',
  LT_DURATION:         '[data-testid="lt-duration"]',
  LT_SUMMARY:          '[data-testid="lt-summary"]',
  LT_START_BTN:        '[data-testid="lt-start-btn"]',
  LT_STOP_BTN:         '[data-testid="lt-stop-btn"]',
  LT_RESULTS:          '[data-testid="lt-results"]',
  LT_RESULT_CARDS:     '[data-testid="lt-result-cards"]',
  LT_HISTOGRAM:        '[data-testid="lt-histogram"]',
  LT_EXPORT_BTN:       '[data-testid="lt-export-btn"]',
  LT_CLEAR_BTN:        '[data-testid="lt-clear-btn"]',
  LT_NOT_CONNECTED:    '[data-testid="lt-not-connected"]',
  LT_TOGGLE_BTN:       '[data-testid="load-test-toggle-btn"]',
} as const;

// ─── SSE Studio ─────────────────────────────────────────────────
export const SSE = {
  STUDIO:              '[data-testid="sse-studio"]',
  URL_INPUT:           '[data-testid="sse-url-input"]',
  CONNECT_BTN:         '[data-testid="sse-connect-btn"]',
  STATE_LABEL:         '[data-testid="sse-state-label"]',
  LEFT_TAB_CONNECT:    '[data-testid="sse-left-tab-connect"]',
  LEFT_TAB_AUTH:       '[data-testid="sse-left-tab-auth"]',
  RIGHT_TAB_EVENTS:    '[data-testid="sse-right-tab-events"]',
  RIGHT_TAB_CONSOLE:   '[data-testid="sse-right-tab-console"]',
  MESSAGE_LOG:         '[data-testid="sse-message-log"]',
  EVENT_ROW:           '[data-testid="sse-event-row"]',
  EVENT_DETAIL:        '[data-testid="sse-event-detail"]',
  SEARCH_INPUT:        '[data-testid="sse-search"]',
  TYPE_FILTER:         '[data-testid="sse-type-filter"]',
  BOOKMARK_FILTER:     '[data-testid="sse-bookmark-filter"]',
  EXPORT_BTN:          '[data-testid="sse-export-btn"]',
  CLEAR_BTN:           '[data-testid="sse-clear-btn"]',
  STATUS_BAR:          '[data-testid="sse-status-bar"]',
  RECONNECT_CARD:      '[data-testid="sse-reconnect-card"]',
  RECONNECT_TOGGLE:    '[data-testid="sse-reconnect-toggle"]',
} as const;

// ─── Workflow Designer ──────────────────────────────────────────
export const WF = {
  DESIGNER:            '.wf-designer',
  TOOLBAR:             '.wf-toolbar',
  TOOLBAR_SELECT:      '[data-testid="wf-toolbar-select"]',
  QUICK_TEST_BTN:      '.wf-quick-test-btn',
  PALETTE:             '[data-testid="palette"]',
  CANVAS:              '[data-testid="rf"]',
  CONTROLS:            '[data-testid="controls"]',
  NODE_CONFIG:         '.wf-config-modal',
  CFG_CLOSE:           '[data-testid="cfg-close"]',
  CONSOLE:             '[data-testid="console"]',
  EXEC_SUMMARY:        '[data-testid="exec-summary"]',
  TPL_BROWSE:          '[data-testid="tpl-browse"]',
  WS_CONNECT_CFG:      '[data-testid="ws-connect-config"]',
  WS_SEND_CFG:         '[data-testid="ws-send-config"]',
  WS_RECEIVE_CFG:      '[data-testid="ws-receive-config"]',
  SERVICES_BTN:        '[data-testid="wf-toolbar-services-btn"]',
  VARIABLES_BTN:       '[data-testid="wf-toolbar-variables-btn"]',
  // Sidebar
  SIDEBAR:             '.wf-sidebar',
  SIDEBAR_NEW_BTN:     'button[title="New workflow"]',
  NEW_BLANK_ITEM:      '.wf-new-dropdown-item:first-child',
  CREATE_INPUT:        '.req-confirm-input',
  CREATE_OK:           '.req-confirm-ok',
  // Palette items
  PAL_WS_CONNECT:      '.wf-palette-block-wsConnect',
  PAL_WS_SEND:         '.wf-palette-block-wsSend',
  PAL_WS_RECEIVE:      '.wf-palette-block-wsReceive',
  // Node config fields
  CFG_WS_URL:          '[data-testid="ws-connect-config"] .expr-input-wrapper input',
  CFG_WS_MSG:          '[data-testid="ws-send-config"] textarea.wf-config-textarea',
  CFG_SAVE:            '.wf-config-modal-footer-actions .btn-primary',
  CFG_CANCEL:          '.wf-config-modal-footer-actions .btn-ghost',
  // Canvas nodes
  NODE_WS_CONNECT:     '.react-flow__node-wsConnect',
  NODE_WS_SEND:        '.react-flow__node-wsSend',
  NODE_WS_RECEIVE:     '.react-flow__node-wsReceive',
  // Defaults (Variables) modal
  DEFAULTS_MODAL:      '.wf-defaults-modal',
  DEFAULTS_NEW_KEY:    '.wf-defaults-modal .wf-var-key-input[placeholder="name"]',
  DEFAULTS_NEW_VAL:    '.wf-defaults-modal .wf-var-new-row-value .wf-var-value-input',
  DEFAULTS_ADD_BTN:    '.wf-defaults-modal .wf-config-vars > div:last-child > button[type="button"]:last-of-type',
  DEFAULTS_SAVE_BTN:   '.wf-defaults-modal .btn-primary',
} as const;

// ─── Workflow Runner ─────────────────────────────────────────────
export const WFR = {
  VAR_ROW:    '.wfp-var-row',
  VAR_INPUT:  '.wfp-var-input',
} as const;

// ─── Demo Hub ───────────────────────────────────────────────────
export const DEMO = {
  HUB_BTN:           'button[title="Demo Hub"]',
  DOMAIN_CARD:       '.demo-domain-card:not(.coming-soon)',
  LESSON_ITEM:       '.demo-lesson-item',
  START_BTN:         '.demo-start-btn',
  STEP_COUNTER:      '.demo-live-step-counter',
  STEP_TITLE:        '.demo-live-step-title',
  SPOTLIGHT_RING:    '.demo-spotlight-ring',
  MODE_BADGE:        '.demo-live-mode-badge',
  PHASE_BADGE:       '.demo-live-phase-badge',
  PHASE_SKIPPABLE:   '.demo-live-phase-badge.skippable',
  PLAY_BTN:          '.demo-live-play-btn',
  CATEGORY_TAB:      '.demo-category-tab',
} as const;

// ─── Kafka ───────────────────────────────────────────────────────
//
// All selectors here must work with document.querySelector().
// Playwright-specific :has-text() is NOT valid CSS — any selector that
// needed :has-text() instead uses a data-testid or CSS structure selector.
// Selectors used only in future lessons (K1/K2/K11/K12) are marked TODO.
//
export const KAFKA = {
  // ── Navigation ────────────────────────────────────────────────
  // KafkaMessageStudioPage root uses .kafka-message-studio-page (no testid)
  STUDIO_PAGE:              '.kafka-message-studio-page',
  // Tab buttons — data-testid attributes added to KafkaMessageStudioPage.tsx
  PUBLISH_TAB:              '[data-testid="tab-publish"]',
  CONSUME_TAB:              '[data-testid="tab-consume"]',
  TOPICS_TAB:               '[data-testid="tab-topics"]',
  SCHEMA_TAB:               '[data-testid="tab-schema"]',
  // KafkaStudioGuard: "→ Open Kafka Settings" / "→ Add a cluster" CTA
  SETTINGS_LINK:            '[data-testid="guard-action-btn"]',
  GUARD_SUBTITLE:           '[data-testid="guard-subtitle"]',

  // ── Settings Page ─────────────────────────────────────────────
  SETTINGS_PAGE:            '[data-testid="kafka-settings-page"]',
  SETTINGS_LIST:            '[data-testid="kafka-settings-list"]',
  ADD_CLUSTER_BTN:          '[data-testid="kafka-add-cluster-btn"]',
  EMPTY_CREATE_BTN:         '[data-testid="kafka-empty-create-btn"]',
  // Either variant (empty-state vs toolbar) — querySelector returns first match
  NEW_CLUSTER_BTN:          '[data-testid="kafka-empty-create-btn"],[data-testid="kafka-add-cluster-btn"]',
  CLUSTER_EDITOR:           '[data-testid="kafka-cluster-editor"]',
  SAVE_BTN:                 '[data-testid="kafka-save-cluster-btn"]',
  // TODO(K1): add data-testid to KafkaSettingsPage action buttons instead of
  //           using these class-scoped text selectors (they throw in querySelector)
  CONNECT_BTN:              '[data-testid="kafka-connect-btn"]',
  TEST_BTN:                 '[data-testid="kafka-test-btn"]',
  DISCONNECT_BTN:           '[data-testid="kafka-disconnect-btn"]',
  DELETE_CLUSTER_BTN:       '[data-testid="kafka-delete-cluster-btn"]',
  CONFIRM_DELETE_BTN:       '[data-testid="kafka-confirm-delete-btn"]',
  AUTO_CONNECT_TOGGLE:      '[data-testid="kafka-auto-connect-toggle"]',
  BROKER_INPUT:             'input[placeholder="127.0.0.1:19092"]',
  AUTH_TYPE_SELECT:         '#kafka-auth-mode',
  AUTH_USER_INPUT:          '#kafka-auth-username',
  AUTH_PASS_INPUT:          '#kafka-auth-password',
  // TODO(K12): add data-testid to TLS checkbox labels in KafkaClusterEditor
  TLS_TOGGLE:               '[data-testid="kafka-tls-toggle"]',
  TLS_VERIFY_TOGGLE:        '[data-testid="kafka-tls-verify-toggle"]',

  // ── Publish Studio ────────────────────────────────────────────
  PUB_TOPIC_INPUT:          '#kms-pub-topic',
  PUB_KEY_INPUT:            '#kms-pub-key',
  PUB_ACKS_SELECT:          '#kms-pub-acks',
  PUB_BODY_TEXTAREA:        '#kms-pub-body',
  PUB_HEADER_ADD_BTN:       '.kafka-ms-add-btn',
  PUB_FORMAT_BTN:           '[data-testid="pub-format-btn"]',
  PUB_SEND_BTN:             '[data-testid="pub-send-btn"]',
  PUB_CLEAR_BTN:            '[data-testid="pub-clear-btn"]',
  PUB_RESULT:               '[data-testid="pub-result"]',
  PUB_ERROR:                '[data-testid="pub-error"]',
  // Template controls — structure selectors (both buttons share kafka-ms-template-btn class;
  // Save is a direct child of .kafka-ms-template-controls; Load is inside the dropdown anchor)
  PUB_SAVE_BTN:             '.kafka-ms-template-controls > .kafka-ms-template-btn',
  PUB_LOAD_BTN:             '.kafka-ms-template-controls .kafka-ms-template-dropdown-anchor .kafka-ms-template-btn',

  // ── Consume Studio ────────────────────────────────────────────
  CON_TOPIC_INPUT:          '#kms-con-topic',
  CON_GROUP_INPUT:          '#kms-con-group',
  CON_POSITION_SELECT:      '#kms-con-pos',
  CON_MAX_INPUT:            '#kms-con-max',
  CON_TIMEOUT_INPUT:        '#kms-con-timeout',
  CON_SORT_ORDER:           '[data-testid="con-sort-order"]',
  CON_KEY_FILTER_INPUT:     '#kms-con-key',
  CON_HEADER_FILTER_INPUT:  '#kms-con-header',
  CON_JSONPATH_INPUT:       '#kms-con-jsonpath',
  CON_JSONVAL_INPUT:        '#kms-con-jsonval',
  CON_MODE_TABS:            '[data-testid="con-mode-tabs"]',
  CON_MODE_ONCE:            '[data-testid="con-mode-once"]',
  CON_MODE_STREAM:          '[data-testid="con-mode-stream"]',
  CON_CONSUME_BTN:          '[data-testid="con-consume-btn"]',
  CON_RESULTS_ZONE:         '[data-testid="con-results-zone"]',
  CON_DETAIL_PANE:          '[data-testid="con-detail-pane"]',
  CON_DETAIL_BODY:          '[data-testid="con-detail-body"]',
  CON_COPY_KEY_BTN:         '[data-testid="con-copy-key-btn"]',
  CON_COPY_PAYLOAD_BTN:     '[data-testid="con-copy-payload-btn"]',
  CON_EXPORT_BTN:           '[data-testid="con-export-btn"]',
  CON_CLEAR_BTN:            '[data-testid="con-clear-btn"]',
  CON_ERROR:                '[data-testid="con-error"]',
  CON_LOAD_MORE_BTN:        '[data-testid="con-load-more-btn"]',
  // Template controls (consume side — same structure as publish)
  CON_SAVE_BTN:             '.kafka-ms-template-controls > .kafka-ms-template-btn',
  CON_LOAD_BTN:             '.kafka-ms-template-controls .kafka-ms-template-dropdown-anchor .kafka-ms-template-btn',

  // ── Stream Mode ───────────────────────────────────────────────
  STREAM_ACTION_ROW:        '[data-testid="stream-action-row"]',
  STREAM_START_BTN:         '[data-testid="stream-start-btn"]',
  STREAM_STOP_BTN:          '[data-testid="stream-stop-btn"]',
  STREAM_EXPORT_BTN:        '[data-testid="stream-export-btn"]',
  STREAM_CLEAR_BTN:         '[data-testid="stream-clear-btn"]',
  STREAM_RESULTS_ZONE:      '[data-testid="stream-results-zone"]',
  STREAM_COUNT:             '[data-testid="stream-count"]',
  STREAM_LIVE_BADGE:        '[data-testid="stream-live-badge"]',
  STREAM_CURSOR_GAP:        '[data-testid="stream-cursor-gap"]',
  STREAM_ERROR:             '[data-testid="stream-error"]',

  // ── Topic Explorer ────────────────────────────────────────────
  TOPIC_EXPLORER_PAGE:      '[data-testid="topic-explorer-page"]',
  TOPIC_SEARCH:             '[data-testid="topic-search"]',
  TOPIC_HEALTH_FILTER:      '[data-testid="health-filter"]',
  TOPIC_PARTITION_FILTER:   '[data-testid="partition-filter"]',
  TOPIC_RETENTION_FILTER:   '[data-testid="retention-filter"]',
  TOPIC_CHIPBAR:            '[data-testid="domain-chips"]',
  TOPIC_TABLE:              '.kafka-explorer-topic-table',
  DETAIL_TABS:              '[data-testid="detail-tabs"]',
  DETAIL_TAB_MESSAGES:      '[data-testid="detail-tab-messages"]',
  DETAIL_TAB_PARTITIONS:    '[data-testid="detail-tab-partitions"]',
  DETAIL_TAB_GROUPS:        '[data-testid="detail-tab-groups"]',
  DETAIL_TAB_CONFIG:        '[data-testid="detail-tab-config"]',
  DETAIL_MESSAGES_TAB:      '[data-testid="detail-messages-tab"]',
  DETAIL_PARTITIONS_TAB:    '[data-testid="detail-partitions-tab"]',
  DETAIL_GROUPS_TAB:        '[data-testid="detail-groups-tab"]',
  DETAIL_CONFIG_TAB:        '[data-testid="detail-config-tab"]',
  DETAIL_CONSUME_BTN:       '[data-testid="detail-consume-btn"]',
  DETAIL_RESULTS:           '[data-testid="detail-results"]',
  DETAIL_MSG_PANE:          '[data-testid="detail-msg-pane"]',
  DETAIL_LOAD_MORE_BTN:     '[data-testid="detail-load-more-btn"]',
  TOPIC_METRICS_ROW:        '.kafka-explorer-metrics-row',

  // ── Schema Registry ───────────────────────────────────────────
  SCHEMA_REGISTRY_PAGE:     '[data-testid="schema-registry-page"]',
  SCHEMA_URL_INPUT:         '[data-testid="registry-url-input"]',
  SCHEMA_CONNECT_BTN:       '[data-testid="registry-connect-btn"]',
  SCHEMA_AUTH_USER:         '[data-testid="registry-auth-user"]',
  SCHEMA_AUTH_PASS:         '[data-testid="registry-auth-pass"]',
  SCHEMA_SEARCH:            '[data-testid="subject-filter"]',
  SCHEMA_SUBJECT_TABLE:     '[data-testid="subject-table"]',
  SCHEMA_URL_PROMPT:        '[data-testid="url-prompt"]',
  SCHEMA_ERROR:             '[data-testid="subjects-error"]',
  SCHEMA_DETAIL_PANEL:      '[data-testid="schema-detail-panel"]',
  SCHEMA_VERSION_SELECT:    '[data-testid="version-select"]',
  SCHEMA_FORMAT_BADGE:      '[data-testid="detail-format-badge"]',
  SCHEMA_CONTENT:           '[data-testid="schema-content"]',
  SCHEMA_COPY_BTN:          '[data-testid="copy-schema-btn"]',
  SCHEMA_EXPORT_BTN:        '[data-testid="export-schema-btn"]',
  SCHEMA_SKELETON:          '[data-testid="schema-skeleton"]',
  VERSIONS_ERROR:           '[data-testid="versions-error"]',

  // ── Workflow Kafka Nodes ──────────────────────────────────────
  NODE_PRODUCE:             '.wf-node-kafkaProduce',
  NODE_CONSUME:             '.wf-node-kafkaConsume',
  NODE_WAIT:                '.wf-node-kafkaWait',
  TRIGGER_CONFIG:           '[data-testid="kafka-trigger-config"]',
  WAIT_CONFIG:              '[data-testid="kafka-wait-config"]',
  NODE_TOPIC_INPUT:         'input[placeholder="orders.events"]',
  // TODO(K9): add data-testid="node-binding-add-btn" to the binding add button
  NODE_BINDING_ADD_BTN:     '[data-testid="node-binding-add-btn"]',
  WAIT_SAMPLE_TEXTAREA:     '[data-testid="wait-sample-payload"]',
  WAIT_LOAD_MODE_SELECT:    '[data-testid="wait-load-mode"]',
} as const;

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
  INTROSPECT_BTN:      '[data-testid="gql-introspect-btn"]',
  EXECUTE_BTN:         '[data-testid="gql-execute-btn"]',
  OP_SELECTOR:         '[data-testid="gql-op-selector"]',
  SCHEMA_BADGE_OK:     '[data-testid="gql-schema-badge-ok"]',
  SCHEMA_BADGE_ERROR:  '[data-testid="gql-schema-badge-error"]',

  // ── Tab Bar ────────────────────────────────────────────────────────────────
  TAB_BAR:             '[data-testid="gql-tab-bar"]',
  TAB_ADD_BTN:         '[data-testid="gql-tab-add-btn"]',

  // ── Editor ─────────────────────────────────────────────────────────────────
  EDITOR:              '[data-testid="gql-editor"]',

  // ── Bottom Panel ───────────────────────────────────────────────────────────
  BOTTOM_TAB_VARS:     '[data-testid="gql-bottom-tab-variables"]',
  BOTTOM_TAB_HEADERS:  '[data-testid="gql-bottom-tab-headers"]',

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
  RESPONSE_ERRORS:     '[data-testid="gql-response-error-count"]',

  // ── Schema Explorer (Phase 1B) ─────────────────────────────────────────────
  // BUG-P1-R1-6 fix: all SCHEMA_* selectors updated to match actual data-testid
  // values in GraphqlSchemaExplorer.tsx (old "gql-schema-*" prefix was stale).
  SCHEMA_EXPLORER:     '[data-testid="gql-schema-explorer"]',
  SCHEMA_SEARCH:       '[data-testid="gql-se-search"]',
  SCHEMA_TYPE_LIST:    '[data-testid="gql-se-type-list"]',
  SCHEMA_TYPE_DETAIL:  '[data-testid="gql-se-type-detail"]',
  SCHEMA_SDL_TAB:      '[data-testid="gql-se-dtab-sdl"]',
  SCHEMA_SDL_VIEW:     '[data-testid="gql-se-detail-panel"]',
  COPY_SDL_BTN:        '[data-testid="gql-se-copy-sdl-btn"]',
  SNAPSHOT_BTN:        '[data-testid="gql-se-export-sdl-btn"]',

  // ── Execution (Phase 1C) ───────────────────────────────────────────────────
  CANCEL_BTN:          '[data-testid="gql-cancel-btn"]',

  // ── Performance (Phase 2G) ─────────────────────────────────────────────────
  COMPLEXITY_BADGE:    '[data-testid="gql-complexity-badge"]',

  // ── Workflow nodes (Phase 4) ───────────────────────────────────────────────
  WF_QUERY_PANEL:      '[data-testid="gql-wf-query-panel"]',
  WF_MUTATION_PANEL:   '[data-testid="gql-wf-mutation-panel"]',
  WF_SUBSCRIPTION_PANEL: '[data-testid="gql-wf-subscription-panel"]',
  WF_INTROSPECT_PANEL: '[data-testid="gql-wf-introspect-panel"]',
  WF_ASSERT_PANEL:     '[data-testid="gql-wf-assert-panel"]',
} as const;
