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

  // Left sidebar tabs
  LEFT_TAB_CONNECT:  '[data-testid="left-tab-connect"]',
  LEFT_TAB_COMPOSE:  '[data-testid="left-tab-compose"]',
  LEFT_TAB_AUTH:     '[data-testid="left-tab-auth"]',
  LEFT_TAB_HEADERS:  '[data-testid="left-tab-headers"]',
  LEFT_TAB_PARAMS:   '[data-testid="left-tab-params"]',

  // Right sidebar tabs
  RIGHT_TAB_EVENTS:  '[data-testid="right-tab-events"]',

  // Connection tabs
  CONN_TAB_ADD:      '[data-testid="conn-tab-add"]',

  // Mock server
  MOCK_START_BTN:    '[data-testid="mock-start-btn"]',
  MOCK_STOP_BTN:     '[data-testid="mock-stop-btn"]',
  /** Matches either start or stop — for spotlight on "the mock button" */
  MOCK_BTN_ANY:      '[data-testid="mock-start-btn"], [data-testid="mock-stop-btn"]',

  // Connect panel
  CONNECT_BTN:       '[data-testid="connect-btn"]',
  DISCONNECT_BTN:    '[data-testid="disconnect-btn"]',
  URL_INPUT:         '[aria-label="WebSocket URL"]',
  PROTOCOL_SELECT:   '[data-testid="protocol-select"]',

  // Compose panel
  MESSAGE_INPUT:     '[aria-label="Message input"]',
  SEND_BTN:          '[data-testid="send-btn"]',
  COMPOSE_INPUT:     '.ws-compose-input',

  // Events / Messages
  MESSAGE_ROW:       '.ws-message-row',
  CLEAR_BTN:         '[data-testid="clear-btn"]',

  // Status indicators
  STATUS_LABEL:      '.ws-messages-status-label',
  STATUS_CONNECTED:  '.ws-status-dot.connected',

  // Auth panel
  AUTH_TYPE_SELECT:   '.auth-type-select',
  AUTH_TYPE_DROPDOWN: '.auth-type-select select',
  AUTH_PANEL:         '.ws-auth-panel',
  AUTH_PANE_INPUTS:   '.ws-auth-pane input',
  AUTH_CALLOUT:       '.ws-auth-callout',
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
