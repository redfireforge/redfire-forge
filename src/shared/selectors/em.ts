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
  DERIVED_VARS_GRPC:    '[data-testid="derived-vars-grpc"]',
  /** Workspace Defaults (Interpolation) section — bottom of the Environment Manager page. */
  WS_DEFAULT_KEY_INPUT:   '[data-testid="em-ws-default-key-input"]',
  WS_DEFAULT_VALUE_INPUT: '[data-testid="em-ws-default-value-input"]',
  WS_DEFAULT_SAVE_BTN:    '[data-testid="em-ws-default-save-btn"]',
  /** Protocol vars badge — opens the Protocol Variables modal. */
  PROTOCOL_VARS_BADGE:     '[data-testid="protocol-vars-badge"]',
  /** Protocol vars modal elements. */
  PROTOCOL_VARS_MODAL:     '[data-testid="protocol-vars-modal"]',
  PROTOCOL_VARS_KEY_INPUT: '[data-testid="protocol-vars-key-input"]',
  PROTOCOL_VARS_VAL_INPUT: '[data-testid="protocol-vars-val-input"]',
  PROTOCOL_VARS_ADD_BTN:   '[data-testid="protocol-vars-add-btn"]',
  PROTOCOL_VARS_SAVE_BTN:  '[data-testid="protocol-vars-save-btn"]',
  PROTOCOL_VARS_CLOSE_BTN: '[data-testid="protocol-vars-close-btn"]',
  /** Env vars modal elements. */
  ENV_VARS_MODAL:     '[data-testid="env-vars-modal"]',
  ENV_VARS_KEY_INPUT: '[data-testid="env-vars-key-input"]',
  ENV_VARS_VAL_INPUT: '[data-testid="env-vars-val-input"]',
  ENV_VARS_ADD_BTN:   '[data-testid="env-vars-add-btn"]',
  ENV_VARS_SAVE_BTN:  '[data-testid="env-vars-save-btn"]',
  ENV_VARS_CLOSE_BTN: '[data-testid="env-vars-close-btn"]',
} as const;

/** Environment chip row by display name (Environment Manager). */
export function emEnvByNameSel(name: string): string {
  return `[data-env-name="${name}"]`;
}

/** Microservice card by display name (Environment Manager). */
export function emSvcByNameSel(name: string): string {
  return `[data-svc-name="${name}"]`;
}

/** Configure/Collapse button inside a specific microservice card. */
export function emSvcConfigureByNameSel(name: string): string {
  return `${emSvcByNameSel(name)} [data-testid^="em-svc-configure-"]`;
}

/** Environment chip inside a specific microservice protocol table. */
export function emSvcEnvChipByNameSel(svcName: string, envName: string): string {
  return `${emSvcByNameSel(svcName)} .svc-env-table [data-env-name="${envName}"]`;
}

/**
 * Selector for an existing Workspace Default row by key.
 * Usage: `emWsDefaultRowSel('requestId')` → `'[data-testid="em-ws-default-row-requestId"]'`
 */
export function emWsDefaultRowSel(key: string): string {
  return `[data-testid="em-ws-default-row-${key}"]`;
}

/** Inline value input for an existing Workspace Default row. */
export function emWsDefaultRowValueSel(key: string): string {
  return `[data-testid="em-ws-default-row-value-${key}"]`;
}

/** Delete button for an existing Workspace Default row. */
export function emWsDefaultDeleteSel(key: string): string {
  return `[data-testid="em-ws-default-delete-${key}"]`;
}

/**
 * Selector for the Env vars badge on a specific environment row.
 * Usage: `emEnvVarsBadgeSel('env-local')` → `'[data-testid="env-vars-badge-env-local"]'`
 */
export function emEnvVarsBadgeSel(envId: string): string {
  return `[data-testid="env-vars-badge-${envId}"]`;
}

/** Protocol vars modal — row for an existing variable. */
export function emProtocolVarRowSel(key: string): string {
  return `[data-testid="protocol-var-row-${key}"]`;
}
export function emProtocolVarValueSel(key: string): string {
  return `[data-testid="protocol-var-value-${key}"]`;
}
export function emProtocolVarDeleteSel(key: string): string {
  return `[data-testid="protocol-var-delete-${key}"]`;
}

/** Env vars modal — row for an existing override variable. */
export function emEnvVarRowSel(key: string): string {
  return `[data-testid="env-var-row-${key}"]`;
}
export function emEnvVarValueSel(key: string): string {
  return `[data-testid="env-var-value-${key}"]`;
}
export function emEnvVarDeleteSel(key: string): string {
  return `[data-testid="env-var-delete-${key}"]`;
}

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
