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
  SUBPROTOCOLS:      '[aria-label="Subprotocols"]',
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
  GQL_TAB_QUERY:        '[data-testid="gql-tab-query"]',
  GQL_TAB_VARIABLES:    '[data-testid="gql-tab-variables"]',

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
  TLS_CLOSE:          '[data-testid="tls-close"]',
  TLS_CANCEL:         '[data-testid="tls-cancel"]',

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
