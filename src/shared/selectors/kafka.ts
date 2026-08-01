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
  PUB_ACKS_SELECT:          '[data-testid="pub-acks-select"]',
  PUB_BODY_TEXTAREA:        '#kms-pub-body',
  PUB_BODY_EXPAND:          '[data-testid="pub-body-expand"]',
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
  CON_POSITION_SELECT:      '[data-testid="con-position-select"]',
  CON_MAX_INPUT:            '#kms-con-max',
  CON_TIMEOUT_INPUT:        '#kms-con-timeout',
  CON_SORT_ORDER:           '[data-testid="con-sort-order"]',
  CON_KEY_FILTER_INPUT:     '#kms-con-key',
  CON_HEADER_FILTER_INPUT:  '#kms-con-header',
  CON_JSONPATH_INPUT:       '[data-testid="con-jsonpath-input"]',
  CON_JSONVAL_INPUT:        '[data-testid="con-jsonval-input"]',
  /** Path + equals pair — prefer this for JSONPath demo spotlights (keeps ring off Body Contains). */
  CON_JSONPATH_PAIR:        '[data-testid="con-jsonpath-pair"]',
  CON_BODY_CONTAINS_INPUT:  '[data-testid="con-body-contains-input"]',
  CON_MODE_TABS:            '[data-testid="con-mode-tabs"]',
  CON_MODE_ONCE:            '[data-testid="con-mode-once"]',
  CON_MODE_STREAM:          '[data-testid="con-mode-stream"]',
  CON_CONSUME_BTN:          '[data-testid="con-consume-btn"]',
  CON_RESULTS_ZONE:         '[data-testid="con-results-zone"]',
  CON_DETAIL_MODAL:         '[data-testid="kafka-message-detail-modal"]',
  CON_DETAIL_BODY:          '[data-testid="kmd-body"]',
  CON_DETAIL_CLOSE:         '[data-testid="kmd-close-btn"]',
  CON_COPY_KEY_BTN:         '[data-testid="kmd-copy-key"]',
  CON_COPY_PAYLOAD_BTN:     '[data-testid="kmd-copy-payload"]',
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
  STREAM_TABLE_WRAP:        '[data-testid="stream-table-wrap"]',
  STREAM_SCROLL_BOTTOM_BTN: '[data-testid="stream-scroll-bottom-btn"]',
  /** First stream result row (0-based index in data-testid). */
  STREAM_ROW_FIRST:         '[data-testid="stream-row-0"]',
  STREAM_COUNT:             '[data-testid="stream-count"]',
  STREAM_LIVE_BADGE:        '[data-testid="stream-live-badge"]',
  STREAM_CURSOR_GAP:        '[data-testid="stream-cursor-gap"]',
  STREAM_ERROR:             '[data-testid="stream-error"]',

  // ── Topic Explorer ────────────────────────────────────────────
  TOPIC_EXPLORER_PAGE:      '[data-testid="topic-explorer-page"]',
  TOPIC_SEARCH:             '[data-testid="topic-search"]',
  TOPIC_HEALTH_FILTER:      '[data-testid="health-filter"]',
  TOPIC_FILTER_ROW:         '[data-testid="topic-filter-row"]',
  TOPIC_PARTITION_FILTER:   '[data-testid="partition-filter"]',
  TOPIC_RETENTION_FILTER:   '[data-testid="retention-filter"]',
  TOPIC_CHIPBAR:            '[data-testid="domain-chips"]',
  TOPIC_TABLE:              '.kafka-explorer-topic-table',
  TOPIC_TABLE_WRAP:         '[data-testid="topic-table-wrap"]',
  TOPIC_LIST_COLLAPSE_BTN:  '[data-testid="topic-list-collapse-btn"]',
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
  WAIT_CORRELATION_SECTION: '[data-testid="wait-correlation-section"]',
  NODE_TOPIC_INPUT:         'input[placeholder="orders.events"]',
  // TODO(K9): add data-testid="node-binding-add-btn" to the binding add button
  NODE_BINDING_ADD_BTN:     '[data-testid="node-binding-add-btn"]',
  WAIT_SAMPLE_TEXTAREA:     '[data-testid="wait-sample-payload"]',
  WAIT_LOAD_MODE_SELECT:    '[data-testid="wait-load-mode"]',
} as const;
