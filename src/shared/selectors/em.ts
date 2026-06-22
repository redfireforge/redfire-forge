// ─── Environment Manager (Phase 2/5) ─────────────────────────────
export const EM = {
  MANAGER:              '.env-manager',
  PROTOCOL_PANEL:       '[data-testid="microservice-protocol-panel"]',
  PROTOCOL_TAB_HTTP:    '[data-testid="em-protocol-tab-http"]',
  PROTOCOL_TAB_WS:      '[data-testid="em-protocol-tab-websocket"]',
  PROTOCOL_TAB_SSE:     '[data-testid="em-protocol-tab-sse"]',
  PROTOCOL_TAB_GQL:     '[data-testid="em-protocol-tab-graphql"]',
  PROTOCOL_TAB_GRPC:    '[data-testid="em-protocol-tab-grpc"]',
  /** First microservice Configure button (prefix match — pick first in DOM). */
  SVC_CONFIGURE:        '[data-testid^="em-svc-configure-"]',
  ENDPOINT_EDIT:        '[data-testid="em-endpoint-edit-btn"]',
  ENDPOINT_EDIT_INPUT:  '[data-testid="em-endpoint-edit-input"]',
  ENDPOINT_SAVE:        '[data-testid="em-endpoint-save-btn"]',
  GRAPHQL_PATH_INPUT:   '[data-testid="em-graphql-path-input"]',
  DEPLOY_CHECKBOX:      'input[type="checkbox"][aria-label^="Deploy"]',
  /** Inputs and buttons for creating new environments and microservices. */
  ADD_ENV_INPUT:        '[data-testid="em-new-env-input"]',
  ADD_ENV_BTN:          '[data-testid="em-add-env-btn"]',
  ADD_SVC_INPUT:        '[data-testid="em-new-svc-input"]',
  ADD_SVC_BTN:          '[data-testid="em-add-svc-btn"]',
  /** Protocol selection — "+ Add protocol" trigger button inside an expanded service card. */
  ADD_PROTOCOL_BTN:     '[data-testid="em-add-protocol-btn"]',
  /** Derived-variables panel on a protocol tab (protocol key suffix). */
  DERIVED_VARS_GQL:     '[data-testid="derived-vars-graphql"]',
} as const;

/**
 * Selector for a specific protocol item inside the "+ Add protocol" dropdown menu.
 * Usage: `emAddProtocolItemSel('sse')` → `'[data-testid="em-add-protocol-item-sse"]'`
 */
export function emAddProtocolItemSel(protocol: string): string {
  return `[data-testid="em-add-protocol-item-${protocol}"]`;
}

/**
 * Selector for the × remove button on an enabled protocol tab.
 * Usage: `emRemoveProtocolSel('http')` → `'[data-testid="em-remove-protocol-http"]'`
 */
export function emRemoveProtocolSel(protocol: string): string {
  return `[data-testid="em-remove-protocol-${protocol}"]`;
}
