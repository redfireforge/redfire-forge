/**
 * Lesson GRPC-4: Request Metadata & Authentication
 *
 * Covers custom request metadata (HTTP/2 headers), all four auth modes, conflict
 * detection between manual metadata and structured auth, and environment-variable
 * interpolation in metadata values.
 *
 *   grpc18-intro          — gRPC session settings tour (5 tabs overview)
 *   grpc18-metadata-add   — Metadata tab: add x-request-id custom header
 *   grpc18-send-metadata  — Send Echo with metadata, verify response body
 *   grpc18-bearer-auth    — Auth tab → Bearer token configuration
 *   grpc18-basic-auth     — Switch to Basic auth (username + password)
 *   grpc18-api-key-auth   — Switch to API Key auth (header name + value)
 *   grpc18-conflict       — Add conflicting metadata key, show AUTH_CONFLICTS
 *   grpc18-oauth2         — Switch to OAuth2 (token URL + client credentials)
 *   grpc18-env-var        — Add {{authToken}} metadata, show interpolation preview
 */
import { GRPC } from '@shared/selectors';
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import { upsertWorkspaceDefaults } from '../../adapters';
import {
  GRPC_DEMO_MESSAGE,
  closeGrpcSettingsDrawerQuiet,
  ensureEchoMethodSelected,
  ensureGrpcReflected,
  ensureGrpcStudioSubNavQuiet,
  ensureGrpcTarget,
  ensureUnaryExecuted,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';

const GRPC4_ROSTER = getGrpcLessonRosterEntry('grpc-metadata-auth')!;

const DEMO_REQUEST_ID = 'lesson-4-demo';
const DEMO_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo';
const DEMO_BASIC_USERNAME = 'demo';
const DEMO_BASIC_PASSWORD = 'secret';
const DEMO_API_KEY_NAME = 'x-api-key';
const DEMO_API_KEY_VALUE = 'my-key-123';
const DEMO_OAUTH2_TOKEN_URL = 'http://127.0.0.1:50560/oauth2/token';
const DEMO_OAUTH2_CLIENT_ID = 'client-id-demo';
const DEMO_OAUTH2_CLIENT_SECRET = 'client-secret-demo';
const DEMO_ENV_METADATA_KEY = 'x-env-token';
const DEMO_ENV_METADATA_VALUE = '{{authToken}}';
const DEMO_ENV_AUTH_TOKEN = 'rf-demo-auth-token-lesson4';

type LessonCtx = Parameters<NonNullable<GrpcDemoLesson['steps'][number]['action']>>[0];
type PreCtx = Parameters<NonNullable<GrpcDemoLesson['steps'][number]['preAction']>>[0];

// spotlightAndPause / spotlightElementAndPause moved to grpc-lesson-helpers.ts (GRPC-19)
// for reuse across lessons — re-imported above.

/** Open gRPC session settings quietly if not already open. */
async function openSettingsDrawerQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  if (document.querySelector(GRPC.SETTINGS_DRAWER)) return;
  const btn = document.querySelector<HTMLButtonElement>(GRPC.CONNECTION_SETTINGS_BTN);
  if (btn && !btn.disabled) {
    btn.click();
    try {
      await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
    } catch {
      // Best-effort.
    }
  }
}

/**
 * Open the Auth tab in the call panel by clicking the Auth badge in the connection bar.
 * The Auth badge is always visible in the connection bar and clicking it closes any open
 * gRPC session settings panel and activates the Auth tab in the call panel.
 */
async function openAuthTabQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  await closeGrpcSettingsDrawerQuiet(ctx);
  const authTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_AUTH);
  if (authTabBtn && !authTabBtn.disabled) {
    const authTabActive = authTabBtn.getAttribute('aria-pressed') === 'true';
    if (!authTabActive) {
      authTabBtn.click();
      await ctx.delay(150);
    }
  }
}

/** Select auth type using the AUTH_TYPE_SELECT dropdown. Caller must ensure auth tab is active. */
async function selectAuthType(
  ctx: LessonCtx | PreCtx,
  type: 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2',
): Promise<void> {
  const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
  if (authSelect && authSelect.value !== type) {
    await ctx.selectOption(GRPC.AUTH_TYPE_SELECT, type);
  }
}

function authBadgeLooksLikeType(type: 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2'): boolean {
  const badgeText = (document.querySelector<HTMLElement>(GRPC.AUTH_BADGE)?.textContent ?? '').toLowerCase();
  if (!badgeText) return false;
  if (type === 'api_key') {
    return badgeText.includes('api key') || badgeText.includes('apikey');
  }
  if (type === 'oauth2') {
    return badgeText.includes('oauth2') || badgeText.includes('oauth 2');
  }
  return badgeText.includes(type);
}

type AuthFieldExpectation = {
  testId: string;
  value: string;
};

function isAuthStepAlreadyConfigured(
  type: 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2',
  fields: AuthFieldExpectation[],
): boolean {
  const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
  if (authSelect) {
    if (authSelect.value !== type) return false;
    for (const field of fields) {
      const input = document.querySelector<HTMLInputElement>(`[data-testid="${field.testId}"]`);
      if (!input) return false;
      if ((input.value ?? '').trim() !== field.value.trim()) return false;
    }
    return true;
  }

  // When the auth panel is not open, fall back to badge type text so replayed
  // steps do not forcibly pull viewers back into Auth if already configured.
  return authBadgeLooksLikeType(type);
}

/** Reset auth back to 'none' for preAction guards that need a clean slate. */
async function resetAuthToNoneQuiet(ctx: PreCtx): Promise<void> {
  const authBadgeText = document.querySelector<HTMLElement>(GRPC.AUTH_BADGE)?.textContent ?? '';
  if (/\bnone\b/i.test(authBadgeText)) {
    return;
  }

  await openAuthTabQuiet(ctx);
  const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
  if (authSelect && authSelect.value !== 'none') {
    await ctx.selectOption(GRPC.AUTH_TYPE_SELECT, 'none');
    await ctx.delay(200);
  }
}

/**
 * Add a key-value row to the metadata editor.
 * Clicks METADATA_ADD_BTN, then fills the last empty key/value inputs in the editor.
 */
async function addMetadataRowQuiet(ctx: LessonCtx | PreCtx, key: string, value: string): Promise<void> {
  const editor = document.querySelector<HTMLElement>(GRPC.METADATA_EDITOR);
  if (!editor) return;
  const targetKey = key.trim().toLowerCase();
  const targetValue = value.trim();

  const setInputValue = (input: HTMLInputElement, next: string) => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    if (valueSetter) {
      valueSetter.call(input, next);
    } else {
      input.value = next;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const readRow = (row: HTMLElement) => {
    const rowKey = row.querySelector<HTMLInputElement>('input.ws-connect-kv-key');
    const rowValue = row.querySelector<HTMLInputElement>('input.ws-connect-kv-value');
    return {
      keyInput: rowKey,
      valueInput: rowValue,
      keyText: rowKey?.value.trim().toLowerCase() ?? '',
      valueText: rowValue?.value.trim() ?? '',
    };
  };

  const getRows = () => Array.from(editor.querySelectorAll<HTMLElement>('.ws-connect-kv-row'));

  const removeRow = async (row: HTMLElement) => {
    const removeBtn = row.querySelector<HTMLButtonElement>('button.ws-connect-kv-remove-btn');
    if (removeBtn && !removeBtn.disabled) {
      removeBtn.click();
      await ctx.delay(100);
    }
  };

  const findEmptyRow = () => {
    const rows = getRows();
    return rows.find((row) => {
      const { keyText, valueText } = readRow(row);
      return keyText === '' && valueText === '';
    });
  };

  const matchingKeyRows = getRows().filter((row) => readRow(row).keyText === targetKey);
  if (matchingKeyRows.length > 0) {
    const primary = matchingKeyRows[0]!;
    const { keyInput, valueInput, valueText } = readRow(primary);
    if (keyInput && keyInput.value.trim().toLowerCase() !== targetKey) {
      keyInput.focus();
      setInputValue(keyInput, key);
      await ctx.delay(120);
    }
    if (valueInput && valueText !== targetValue) {
      valueInput.focus();
      setInputValue(valueInput, value);
      await ctx.delay(120);
    }

    for (const extraRow of matchingKeyRows.slice(1)) {
      await removeRow(extraRow);
    }
  }

  let targetRow = findEmptyRow();

  if (!targetRow && matchingKeyRows.length === 0) {
    const addBtn = document.querySelector<HTMLButtonElement>(GRPC.METADATA_ADD_BTN);
    if (addBtn && !addBtn.disabled) {
      addBtn.click();
      await ctx.delay(300);
    }
    targetRow = findEmptyRow();
  }

  // Fallback: use the last row when we cannot identify an empty row.
  if (!targetRow && matchingKeyRows.length === 0) {
    const rows = getRows();
    targetRow = rows.at(-1);
  }
  if (!targetRow && matchingKeyRows.length === 0) return;

  const keyInput = targetRow?.querySelector<HTMLInputElement>('input.ws-connect-kv-key');
  const valInput = targetRow?.querySelector<HTMLInputElement>('input.ws-connect-kv-value');

  if (keyInput && matchingKeyRows.length === 0) {
    keyInput.focus();
    setInputValue(keyInput, key);
    await ctx.delay(150);
  }

  if (valInput && matchingKeyRows.length === 0) {
    valInput.focus();
    setInputValue(valInput, value);
    await ctx.delay(150);
  }

  // Remove any leftover fully-empty rows so the demo ends with a clean metadata list.
  const rows = getRows();
  for (const row of rows) {
    const { keyText, valueText } = readRow(row);
    const isEmpty = keyText === '' && valueText === '';
    if (!isEmpty) continue;
    await removeRow(row);
  }
}

/**
 * Fill a labelled field in the auth panel by its exact data-testid.
 * Uses React-compatible input event dispatch so state updates correctly.
 */
async function tryFillAuthField(_ctx: LessonCtx | PreCtx, testId: string, value: string): Promise<void> {
  const selector = `[data-testid="${testId}"]`;
  const input = document.querySelector<HTMLInputElement>(selector);
  if (!input || input.disabled) {
    return;
  }

  const setInputValue = (input: HTMLInputElement, next: string) => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (valueSetter) {
      valueSetter.call(input, next);
    } else {
      input.value = next;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  input.focus();
  setInputValue(input, value);
}

/** Lightweight echo readiness guard for step preAction timing. */
async function ensureEchoReadyFast(ctx: PreCtx): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);

  const hasComposer = Boolean(document.querySelector(GRPC.REQUEST_TAB_METADATA));
  const hasMessageInput = Boolean(document.querySelector(GRPC.PROTO_FIELD_INPUT_MESSAGE));
  const hasMethodDetail = Boolean(document.querySelector(GRPC.CALL_METHOD_NAME));
  // Method detail is stable across composer tabs; message input only exists in Form tab.
  // Treat either as ready to avoid replaying full reflect/select during Auth/Metadata steps.
  if (hasComposer && (hasMessageInput || hasMethodDetail)) {
    return;
  }
  await ensureEchoMethodSelected(ctx);
}

/** Fast guard for auth-only steps: do not trigger reflection/method setup in preAction. */
async function ensureAuthReadyFast(ctx: PreCtx): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);

  // Compatibility fallback for sparse/mocked runtimes: if the connection bar is
  // not mounted yet, reuse echo-method readiness to bootstrap the composer.
  // Restrict this to test runtimes so live browser playback doesn't take the slow path.
  const isJsdomRuntime =
    typeof navigator !== 'undefined'
    && typeof navigator.userAgent === 'string'
    && /jsdom/i.test(navigator.userAgent);
  if (isJsdomRuntime && !document.querySelector(GRPC.AUTH_BADGE)) {
    await ensureEchoMethodSelected(ctx);
  }
}

async function waitForIfMissing(ctx: LessonCtx | PreCtx, selector: string, timeoutMs: number): Promise<void> {
  if (document.querySelector(selector)) return;
  await ctx.waitFor(selector, timeoutMs);
}

async function spotlightAuthField(ctx: LessonCtx | PreCtx, testId: string, holdMs = 550): Promise<void> {
  const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!el) return;
  await spotlightElementAndPause(ctx, el, holdMs);
}

async function spotlightMetadataRowKeyValue(
  ctx: LessonCtx | PreCtx,
  metadataKey: string,
  holdMs = 700,
): Promise<void> {
  const editor = document.querySelector<HTMLElement>(GRPC.METADATA_EDITOR);
  if (!editor) return;

  const targetKey = metadataKey.trim().toLowerCase();
  const rows = Array.from(editor.querySelectorAll<HTMLElement>('.ws-connect-kv-row'));
  const row = rows.find((candidate) => {
    const keyInput = candidate.querySelector<HTMLInputElement>('input.ws-connect-kv-key');
    return (keyInput?.value.trim().toLowerCase() ?? '') === targetKey;
  });
  if (!row) return;

  const keyInput = row.querySelector<HTMLElement>('input.ws-connect-kv-key');
  const valueInput = row.querySelector<HTMLElement>('input.ws-connect-kv-value');
  if (keyInput) {
    await spotlightElementAndPause(ctx, keyInput, holdMs);
  }
  if (valueInput) {
    await spotlightElementAndPause(ctx, valueInput, holdMs);
  }
}

async function removeMetadataRowsByKey(ctx: LessonCtx | PreCtx, metadataKey: string): Promise<void> {
  const editor = document.querySelector<HTMLElement>(GRPC.METADATA_EDITOR);
  if (!editor) return;

  const targetKey = metadataKey.trim().toLowerCase();
  const rows = Array.from(editor.querySelectorAll<HTMLElement>('.ws-connect-kv-row'));
  for (const row of rows) {
    const keyInput = row.querySelector<HTMLInputElement>('input.ws-connect-kv-key');
    const rowKey = keyInput?.value.trim().toLowerCase() ?? '';
    if (rowKey !== targetKey) continue;

    const removeBtn = row.querySelector<HTMLButtonElement>('button.ws-connect-kv-remove-btn');
    if (!removeBtn || removeBtn.disabled) continue;
    removeBtn.click();
    await ctx.delay(120);
  }
}

async function clearAllMetadataRowsQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  const metadataTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_METADATA);
  if (metadataTab && !metadataTab.disabled) {
    metadataTab.click();
    await ctx.delay(140);
  }

  const editor = document.querySelector<HTMLElement>(GRPC.METADATA_EDITOR);
  if (!editor) return;

  const removeButtons = Array.from(editor.querySelectorAll<HTMLButtonElement>('button.ws-connect-kv-remove-btn'));
  for (const btn of removeButtons) {
    if (btn.disabled) continue;
    btn.click();
    await ctx.delay(100);
  }
}

async function switchToFormTabQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  const formTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
  if (!formTabBtn || formTabBtn.disabled) return;
  formTabBtn.click();
  await ctx.delay(140);
}

export const grpcMetadataAuthLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC4_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Add custom request metadata headers, configure Bearer, Basic, and API Key auth, detect auth conflicts, ' +
    'try OAuth2 client-credentials flow, and interpolate environment variables in metadata values.',

  setup: grpcFirstCallSetup,
  cleanup: async (ctx) => {
    await grpcFirstCallCleanup(ctx);

    // Lesson-specific teardown so metadata/auth state from GRPC-18 never leaks
    // into other lessons when users jump between demos.
    await navigateToGrpcStudio(ctx);
    await closeGrpcSettingsDrawerQuiet(ctx);
    await ensureGrpcStudioSubNavQuiet(ctx);
    await resetAuthToNoneQuiet(ctx);
    await clearAllMetadataRowsQuiet(ctx);
    await switchToFormTabQuiet(ctx);

    // The bridge is merge-only, so use an empty value to neutralize the token
    // seeded by the env-var interpolation step.
    upsertWorkspaceDefaults({ authToken: '' });
  },

  grpc: buildGrpcContractMetaFromRoster(GRPC4_ROSTER),

  concept: {
    title: 'gRPC Metadata & Auth',
    body: `**Request metadata** is gRPC's equivalent of HTTP request headers — key-value pairs transmitted as HTTP/2 headers alongside the RPC payload. Common uses:
- **Tracing** — \`x-request-id\`, \`x-trace-id\`
- **Auth** — \`authorization: bearer <token>\`
- **Feature flags** — \`x-feature: dark-mode\`

RedfireForge's **gRPC session settings** panel (gear icon ⚙ in the connection bar) centralises per-session call behavior. It has **five tabs**:

| Tab | What it controls |
|---|---|
| **Call** | Deadline / timeout, max response size, keepalive interval |
| **Compression** | Payload compression algorithm (gzip, deflate) |
| **Health** | gRPC Health Protocol probe (grpc.health.v1) |
| **K8s** | Kubernetes port-forward tunnel setup |
| **Transport** | Call routing mode: Express Proxy, Tauri Native, gRPC-Web, Spring Servlet |

**Authentication** is configured in the **Auth tab** of the Call Panel (the panel below the service explorer) — not in **gRPC session settings**. Click the **Auth** tab or the **Auth badge** in the connection bar to open it. Auth settings are **per-tab** — each gRPC Studio tab can have its own auth configuration.

**TLS** is accessed via the **TLS badge** in the connection bar, which opens a separate TLS config modal.

**What you will do in this lesson:**
1. **gRPC session settings** — tour the five tabs to see available call-session options.
2. **Metadata tab** — add a custom \`x-request-id\` header and send an Echo call.
3. **Bearer auth** — click the Auth badge, select Bearer, and fill a demo token.
4. **Basic auth** — switch to Basic (username + password).
5. **API Key auth** — switch to API Key (\`x-api-key\` header).
6. **Conflict detection** — manually add the same key as the API Key auth → Studio flags the conflict.
7. **OAuth2** — fill token URL + client credentials; Studio fetches the token server-side.
8. **Env-var interpolation** — add \`{{authToken}}\` as a metadata value and watch the preview strip resolve it.

**Auth precedence rule:** when the Auth tab has a type other than \`none\`, it owns the \`authorization\` header. Adding the same key manually in the Metadata tab creates a conflict — Studio highlights it with a warning badge.`,
    keyTerms: [
      {
        term: 'Request metadata',
        definition:
          'Key-value pairs sent as HTTP/2 headers alongside the RPC — gRPC\'s equivalent of HTTP request headers. Metadata travels before (initial) and after (trailing) the message body.',
      },
      {
        term: 'Auth tab (Call Panel)',
        definition:
          'The Auth tab inside the Call Panel configures per-tab authentication. Click the Auth badge in the connection bar or the Auth tab button to open it. Each gRPC Studio tab has independent auth settings.',
      },
      {
        term: 'Auth precedence',
        definition:
          'When the Auth tab has a type other than `none`, it auto-generates the `authorization` header. A matching key in the manual Metadata tab creates a conflict that Studio flags with a warning.',
      },
      {
        term: 'Bearer token',
        definition:
          'An opaque token (often a JWT) sent in the `authorization: bearer <token>` header. Studio stores the value in the session vault, not in localStorage.',
      },
      {
        term: 'OAuth2 client-credentials',
        definition:
          'Studio fetches a token from the token URL using client ID + secret before each call. The raw credentials are held in the session secret vault — they never appear in History exports.',
      },
      {
        term: '{{variable}} interpolation',
        definition:
          'Template syntax to inject environment variable values into metadata, target, auth, or body fields at execute time. Unresolved tokens surface an orange error banner.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 420" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc4-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc4-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpc4-arr-o" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#f59e0b"/>
    </marker>
  </defs>

  <!-- Window chrome -->
  <rect x="1" y="1" width="698" height="270" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5"/>
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc">gRPC Studio — Request Metadata &amp; Authentication</text>

  <!-- Connection bar -->
  <rect x="1" y="31" width="698" height="38" fill="#0f172a"/>
  <rect x="12" y="39" width="200" height="22" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="22" y="53" font-family="monospace" font-size="10" fill="#f1f5f9">localhost:50051</text>
  <!-- Gear icon (gRPC session settings) -->
  <rect x="222" y="39" width="22" height="22" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="233" y="53" text-anchor="middle" font-size="12" fill="#a8b8cc">⚙</text>
  <text x="222" y="71" font-size="7" fill="#64748b">Settings</text>
  <!-- Status badge -->
  <rect x="254" y="39" width="100" height="22" rx="11" fill="#1c3a2a" stroke="#22c55e" stroke-width="0.8"/>
  <text x="304" y="53" text-anchor="middle" font-size="9" fill="#22c55e">Ready — Plaintext</text>
  <!-- Auth badge (in connection bar) -->
  <rect x="364" y="39" width="52" height="22" rx="11" fill="#172554" stroke="#3b82f6" stroke-width="1"/>
  <text x="390" y="53" text-anchor="middle" font-size="8.5" fill="#3b82f6">Bearer ▸</text>
  <text x="370" y="71" font-size="7" fill="#3b82f6">Auth badge</text>
  <!-- TLS badge -->
  <rect x="424" y="39" width="42" height="22" rx="11" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="445" y="53" text-anchor="middle" font-size="8" fill="#64748b">TLS ▸</text>

  <!-- gRPC session settings panel (5 tabs) -->
  <rect x="12" y="80" width="180" height="168" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="24" y="98" font-size="9.5" fill="#a8b8cc">gRPC session settings</text>
  <text x="24" y="110" font-size="7.5" fill="#64748b">5 tabs — call behavior</text>
  <line x1="24" y1="115" x2="184" y2="115" stroke="#1e293b"/>
  <rect x="24" y="120" width="156" height="18" rx="3" fill="#1e3a5f" stroke="#3b82f6" stroke-width="0.8"/>
  <text x="35" y="132" font-size="8" fill="#93c5fd">Call  (timeout / size / keepalive)</text>
  <rect x="24" y="141" width="156" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="35" y="153" font-size="8" fill="#64748b">Compression  (gzip / deflate)</text>
  <rect x="24" y="161" width="156" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="35" y="173" font-size="8" fill="#64748b">Health  (grpc.health.v1 probe)</text>
  <rect x="24" y="181" width="156" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="35" y="193" font-size="8" fill="#64748b">K8s  (port-forward tunnel)</text>
  <rect x="24" y="201" width="156" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="35" y="213" font-size="8" fill="#64748b">Transport  (Express / Tauri / gRPC-Web / Spring)</text>
  <text x="24" y="238" font-size="7" fill="#475569">Auth &amp; TLS are NOT here →</text>

  <!-- Call panel with Auth tab active -->
  <rect x="205" y="80" width="480" height="168" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="218" y="98" font-size="9.5" fill="#a8b8cc">Call Panel</text>
  <!-- Tabs -->
  <rect x="218" y="104" width="54" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="245" y="116" text-anchor="middle" font-size="7.5" fill="#64748b">Form Input</text>
  <rect x="275" y="104" width="30" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="290" y="116" text-anchor="middle" font-size="7.5" fill="#64748b">JSON</text>
  <rect x="308" y="104" width="44" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="330" y="116" text-anchor="middle" font-size="7.5" fill="#64748b">Metadata</text>
  <!-- Auth tab — active/highlighted -->
  <rect x="355" y="104" width="30" height="18" rx="3" fill="#172554" stroke="#3b82f6" stroke-width="1"/>
  <text x="370" y="116" text-anchor="middle" font-size="7.5" fill="#3b82f6">Auth</text>
  <rect x="388" y="104" width="28" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
  <text x="402" y="116" text-anchor="middle" font-size="7.5" fill="#64748b">Files</text>

  <!-- Auth panel content -->
  <text x="218" y="140" font-size="8" fill="#64748b">Auth type</text>
  <rect x="218" y="145" width="200" height="20" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1"/>
  <text x="318" y="158" text-anchor="middle" font-size="9" fill="#93c5fd">Bearer Token ▾</text>
  <text x="218" y="178" font-size="8" fill="#64748b">Bearer token</text>
  <rect x="218" y="182" width="200" height="20" rx="4" fill="#0a1118" stroke="#334155"/>
  <text x="228" y="195" font-family="monospace" font-size="8" fill="#4ade80">eyJ•••••••••••••••</text>
  <text x="218" y="215" font-size="8" fill="#64748b">Outgoing metadata (auth merged)</text>
  <rect x="218" y="220" width="200" height="16" rx="3" fill="#0a1118" stroke="#334155"/>
  <text x="228" y="231" font-family="monospace" font-size="7.5" fill="#a8b8cc">authorization: bearer eyJ…</text>
  <text x="218" y="245" font-size="7.5" fill="#3b82f6">✓ token stored in session vault</text>

  <!-- Metadata editor panel (right side of call panel) -->
  <text x="435" y="140" font-size="9" fill="#a8b8cc">Metadata tab</text>
  <rect x="435" y="145" width="232" height="18" rx="3" fill="#0a1118" stroke="#334155"/>
  <text x="443" y="157" font-family="monospace" font-size="8" fill="#f1f5f9">x-request-id</text>
  <text x="555" y="157" font-family="monospace" font-size="8" fill="#4ade80">lesson-4-demo</text>
  <rect x="435" y="166" width="232" height="18" rx="3" fill="#0a1118" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="443" y="178" font-family="monospace" font-size="8" fill="#f1f5f9">x-api-key</text>
  <text x="555" y="178" font-family="monospace" font-size="8" fill="#f59e0b">conflicting-value</text>
  <rect x="435" y="188" width="232" height="14" rx="3" fill="#451a03" stroke="#f59e0b" stroke-width="0.7"/>
  <text x="443" y="198" font-size="7" fill="#fbbf24">⚠ x-api-key conflicts with API Key auth</text>
  <rect x="435" y="206" width="232" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="443" y="217" font-family="monospace" font-size="7.5" fill="#f59e0b">{{authToken}}</text>
  <text x="510" y="217" font-family="monospace" font-size="7.5" fill="#22c55e">→ Bearer abc123…</text>
  <rect x="435" y="226" width="80" height="14" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="0.7"/>
  <text x="475" y="235" text-anchor="middle" font-size="7.5" fill="#4ade80">+ Add row</text>

  <!-- Legend -->
  <text x="350" y="300" text-anchor="middle" font-size="11" fill="#a8b8cc">Lesson flow</text>

  <circle cx="50" cy="330" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="50" y="334" text-anchor="middle" font-size="9" fill="#3b82f6">1</text>
  <text x="50" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Session</text>
  <text x="50" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">settings</text>
  <line x1="62" y1="330" x2="98" y2="330" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="110" cy="330" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="110" y="334" text-anchor="middle" font-size="9" fill="#3b82f6">2</text>
  <text x="110" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Add</text>
  <text x="110" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">metadata</text>
  <line x1="122" y1="330" x2="158" y2="330" stroke="#22c55e" marker-end="url(#grpc4-arr-g)"/>

  <circle cx="170" cy="330" r="11" fill="#052e16" stroke="#22c55e"/>
  <text x="170" y="334" text-anchor="middle" font-size="9" fill="#22c55e">3</text>
  <text x="170" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Send</text>
  <text x="170" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">call</text>
  <line x1="182" y1="330" x2="218" y2="330" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="230" cy="330" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="230" y="334" text-anchor="middle" font-size="9" fill="#3b82f6">4</text>
  <text x="230" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Bearer</text>
  <text x="230" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">auth</text>
  <line x1="242" y1="330" x2="278" y2="330" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="290" cy="330" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="290" y="334" text-anchor="middle" font-size="9" fill="#3b82f6">5-6</text>
  <text x="290" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Basic /</text>
  <text x="290" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">API Key</text>
  <line x1="302" y1="330" x2="338" y2="330" stroke="#f59e0b" marker-end="url(#grpc4-arr-o)"/>

  <circle cx="350" cy="330" r="11" fill="#451a03" stroke="#f59e0b"/>
  <text x="350" y="334" text-anchor="middle" font-size="9" fill="#f59e0b">7</text>
  <text x="350" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Conflict</text>
  <text x="350" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">detect</text>
  <line x1="362" y1="330" x2="398" y2="330" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="410" cy="330" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="410" y="334" text-anchor="middle" font-size="9" fill="#3b82f6">8</text>
  <text x="410" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">OAuth2</text>
  <line x1="422" y1="330" x2="458" y2="330" stroke="#22c55e" marker-end="url(#grpc4-arr-g)"/>

  <circle cx="470" cy="330" r="11" fill="#052e16" stroke="#22c55e"/>
  <text x="470" y="334" text-anchor="middle" font-size="9" fill="#22c55e">9</text>
  <text x="470" y="351" text-anchor="middle" font-size="7.5" fill="#94a3b8">Env var</text>
  <text x="470" y="361" text-anchor="middle" font-size="7.5" fill="#94a3b8">interp.</text>

  <!-- Callout: Auth badge → Auth tab -->
  <line x1="390" y1="61" x2="370" y2="104" stroke="#3b82f6" stroke-width="0.8" stroke-dasharray="3,2"/>
  <text x="395" y="85" font-size="7" fill="#3b82f6">click opens</text>
  <text x="395" y="94" font-size="7" fill="#3b82f6">Auth tab</text>
</svg>`,
  },

  steps: [
    // -------------------------------------------------------------------------
    // Step 1 — Intro: gRPC session settings tour
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-intro',
      title: 'gRPC Session Settings',
      description:
        'Click the **gear icon ⚙** in the connection bar to open **gRPC session settings**. ' +
        'The panel has **five tabs**:\n\n' +
        '- **Call** — Deadline / timeout, max response size, keepalive interval\n' +
        '- **Compression** — Payload compression (gzip, deflate)\n' +
        '- **Health** — gRPC Health Protocol probe (grpc.health.v1)\n' +
        '- **K8s** — Kubernetes port-forward tunnel\n' +
        '- **Transport** — Call routing mode (Express Proxy, Tauri Native, gRPC-Web, Spring Servlet)\n\n' +
        'Watch as the demo opens gRPC session settings so you can see what options are available.\n\n' +
        'This lesson focuses on **Authentication** (Bearer, Basic, API Key, OAuth2) and the **Metadata tab** in the Call Panel. ' +
        '**Auth is not in gRPC session settings** — it lives in the **Auth tab** of the Call Panel below. ' +
        'Click the **Auth badge** in the connection bar (or the Auth tab) to open it. ' +
        'Auth settings apply per-tab — changing them on one gRPC tab does not affect others.',
      highlight: GRPC.CONNECTION_SETTINGS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
        await ensureGrpcStudioSubNavQuiet(ctx);
        await ensureGrpcTarget(ctx);
        await ensureGrpcReflected(ctx);
        await ensureEchoMethodSelected(ctx);

        // Cleanup belt: lesson should always begin from a neutral composer state.
        await resetAuthToNoneQuiet(ctx);
        await clearAllMetadataRowsQuiet(ctx);
        await switchToFormTabQuiet(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await openSettingsDrawerQuiet(ctx);
        // Hold on the open panel so viewers can orient before tab tour starts.
        await ctx.delay(2200);

        // Tour all five tabs at human-friendly pacing.
        const settingsTabs: Array<'call' | 'compression' | 'health' | 'k8s' | 'transport'> = [
          'call',
          'compression',
          'health',
          'k8s',
          'transport',
        ];
        for (const tab of settingsTabs) {
          const tabSelector = GRPC.SETTINGS_NAV_ITEM(tab);
          const tabButton = document.querySelector<HTMLButtonElement>(tabSelector);
          if (!tabButton || tabButton.disabled) continue;

          await spotlightAndPause(ctx, tabSelector, 1000);
          tabButton.click();
          await ctx.delay(900);
        }

        // Keep the last tab visible a bit longer before closing.
        await ctx.delay(1400);

        // Close gRPC session settings so the call panel is fully visible for the next step.
        const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(700);
        }

        // Show destinations without changing active tab state.
        // Narrative order: Metadata first, then Authentication.
        await spotlightAndPause(ctx, GRPC.REQUEST_TAB_METADATA, 1000);
        await ctx.delay(700);
        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 900);
        await spotlightAndPause(ctx, GRPC.REQUEST_TAB_AUTH, 1000);
      },
      verify: GRPC.CONNECTION_BAR,
    },

    // -------------------------------------------------------------------------
    // Step 2 — Metadata tab: add x-request-id header
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-metadata-add',
      title: 'Add Request Metadata',
      description:
        'In the Call Panel, click the **Metadata** tab. This editor manages the **HTTP/2 headers** sent ' +
        'alongside your RPC — every row becomes a header field.\n\n' +
        `Click **+ Add row** and fill in the new entry:\n- **Key:** \`x-request-id\`\n- **Value:** \`${DEMO_REQUEST_ID}\`\n\n` +
        'This header will appear in the **request metadata** the echo server receives. ' +
        'Use `x-request-id` for distributed tracing, `x-feature` for flag passing, or any custom header your server reads.',
      // REQUEST_TAB_METADATA is always visible in the call panel during reading —
      // better than METADATA_EDITOR which only renders once the tab is active.
      highlight: GRPC.REQUEST_TAB_METADATA,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureAuthReadyFast(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);

        // Reset auth only when it is clearly not in None mode.
        const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
        const authBadgeText = document.querySelector<HTMLElement>(GRPC.AUTH_BADGE)?.textContent ?? '';
        const authLooksNone = authSelect?.value === 'none' || /\bnone\b/i.test(authBadgeText);
        if (!authLooksNone) {
          await resetAuthToNoneQuiet(ctx);
          await closeGrpcSettingsDrawerQuiet(ctx);
        }

        // Resume/jump safety: clear stale metadata (especially x-api-key conflict rows)
        // so this step always demonstrates a single fresh x-request-id addition.
        await clearAllMetadataRowsQuiet(ctx);
      },
      action: async (ctx) => {
        // Spotlight the Metadata tab so the viewer knows where to look before it activates.
        await spotlightAndPause(ctx, GRPC.REQUEST_TAB_METADATA, 600);
        await waitForIfMissing(ctx, GRPC.REQUEST_TAB_METADATA, 8_000);
        await ctx.click(GRPC.REQUEST_TAB_METADATA);
        await waitForIfMissing(ctx, GRPC.METADATA_EDITOR, 5_000);
        await ctx.delay(220);

        // Spotlight the + Add row button before clicking it.
        await spotlightAndPause(ctx, GRPC.METADATA_ADD_BTN, 600);

        // Add the x-request-id row.
        await addMetadataRowQuiet(ctx, 'x-request-id', DEMO_REQUEST_ID);

        // Hold on the filled editor so the viewer can confirm the entry was added.
        await spotlightAndPause(ctx, GRPC.METADATA_EDITOR, 800);
      },
      verify: GRPC.METADATA_EDITOR,
    },

    // -------------------------------------------------------------------------
    // Step 3 — Send Echo with metadata, verify response
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-send-metadata',
      title: 'Send Call with Metadata',
      description:
        'Click **Send**. The Echo call now carries `x-request-id: lesson-4-demo` as an HTTP/2 header ' +
        'alongside the request body. The echo server returns OK — the call succeeds with your metadata attached.\n\n' +
        'Notice: the response **Body**, **Headers**, and **Trailers** tabs show the standard echo response. ' +
        'The `x-request-id` header traveled to the server as initial metadata — not reflected in the echo body ' +
        'unless the server is configured to echo headers back. This is the typical gRPC pattern: ' +
        'metadata handles infrastructure concerns (auth, tracing, routing), while the business payload stays in the message body.',
      highlight: GRPC.SEND_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await closeGrpcSettingsDrawerQuiet(ctx);

        const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
        let messageField = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);

        // Step 2 usually leaves the Metadata tab active; switch back to Form Input first
        // before deciding whether a heavier readiness path is needed.
        if (!messageField) {
          const formTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
          if (formTabBtn && !formTabBtn.disabled) {
            formTabBtn.click();
            try {
              await waitForIfMissing(ctx, GRPC.PROTO_FIELD_INPUT_MESSAGE, 1_400);
            } catch {
              // Best-effort: fall through to fast readiness helper below.
            }
            messageField = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
          }
        }

        // Fast-path: avoid replaying full target/reflect/method setup when composer is already ready.
        if (!sendBtn || !messageField) {
          await ensureEchoReadyFast(ctx);
          messageField = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
        }

        // Ensure a message is filled so Send is enabled.
        const field = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
        if (field && !field.value.trim()) {
          await ctx.fill(GRPC.PROTO_FIELD_INPUT_MESSAGE, GRPC_DEMO_MESSAGE);
          // Fallback: force native input/change in case synthetic fill is dropped.
          if (!field.value.trim()) {
            const valueSetter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              'value',
            )?.set;
            if (valueSetter) {
              valueSetter.call(field, GRPC_DEMO_MESSAGE);
            } else {
              field.value = GRPC_DEMO_MESSAGE;
            }
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
          }
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        const statusText = document.querySelector<HTMLElement>(GRPC.RESPONSE_STATUS)?.textContent ?? '';
        const hasResponseBody = Boolean(document.querySelector(GRPC.RESPONSE_BODY));
        const hasRecentSuccess = /\bOK\b/i.test(statusText) && hasResponseBody;

        if (!hasRecentSuccess) {
          await ensureUnaryExecuted(ctx);
        }

        // Spotlight the response body so the viewer sees the successful result.
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 900);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 4 — Bearer auth
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-bearer-auth',
      title: 'Bearer Token Authentication',
      description:
        'Click the **Auth badge** in the connection bar (or the **Auth** tab in the Call Panel) to open the auth settings. ' +
        'Select **Bearer Token** as the auth type. ' +
        `Fill in a demo token: \`${DEMO_BEARER_TOKEN.slice(0, 30)}…\`\n\n` +
        'RedfireForge stores the token in the **session vault** — it is never written to localStorage ' +
        'or included in collection / History exports. The **Outgoing metadata** preview at the bottom of the panel ' +
        'shows the exact header that will be sent: `authorization: bearer <token>`.\n\n' +
        'With Bearer selected, click **Send** — the `authorization` header is automatically forwarded ' +
        'by the proxy to the echo server. Most gRPC services validate it via a server-side interceptor.',
      // AUTH_BADGE is always visible in the connection bar — the natural entry point for auth settings.
      highlight: GRPC.AUTH_BADGE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureAuthReadyFast(ctx);
      },
      action: async (ctx) => {
        const bearerReady = isAuthStepAlreadyConfigured('bearer', [
          { testId: 'grpc-auth-bearer-token', value: DEMO_BEARER_TOKEN },
        ]);

        // Spotlight the Auth badge so the viewer knows which element opens auth settings.
        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 700);

        if (!bearerReady) {
          // Click the Auth badge — this closes gRPC session settings and activates the Auth tab.
          await ctx.click(GRPC.AUTH_BADGE);
          try {
            await ctx.waitFor(GRPC.AUTH_PANEL, 5_000);
          } catch {
            // Auth panel may already be visible from a previous step.
          }
          await ctx.delay(220);

          // Spotlight the auth type dropdown before changing it.
          await spotlightAndPause(ctx, GRPC.AUTH_TYPE_SELECT, 420);
          await selectAuthType(ctx, 'bearer');
          await ctx.delay(220);

          // Fill the bearer token field.
          await spotlightAuthField(ctx, 'grpc-auth-bearer-token', 620);
          await tryFillAuthField(ctx, 'grpc-auth-bearer-token', DEMO_BEARER_TOKEN);
          await ctx.delay(260);
        }

        // Spotlight the auth preview to confirm the header was generated.
        try {
          await ctx.waitFor(GRPC.AUTH_PREVIEW, 3_000);
          await spotlightAndPause(ctx, GRPC.AUTH_PREVIEW, 680);
        } catch {
          // Preview may not render until token is filled.
          await ctx.delay(320);
        }

        // Spotlight the auth badge — it now shows "Bearer" to confirm the mode is active.
        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 700);
      },
      verify: GRPC.AUTH_BADGE,
    },

    // -------------------------------------------------------------------------
    // Step 5 — Basic auth
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-basic-auth',
      title: 'Basic Authentication',
      description:
        'Click the **Auth badge** again to return to the Auth tab. Switch the auth type to **Basic Auth**. ' +
        `Fill in **Username:** \`${DEMO_BASIC_USERNAME}\` and **Password:** \`${DEMO_BASIC_PASSWORD}\`.\n\n` +
        'RedfireForge encodes these as `authorization: basic <base64(username:password)>`. ' +
        'Use Basic auth for services that accept HTTP Basic credentials — typically internal ' +
        'APIs or legacy gRPC services that read the `authorization` header directly. ' +
        'Note: Basic auth transmits credentials on every call; prefer Bearer or OAuth2 for production.',
      // AUTH_BADGE reflects current auth type — draws attention to its updated state before changing it.
      highlight: GRPC.AUTH_BADGE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureAuthReadyFast(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        const basicReady = isAuthStepAlreadyConfigured('basic', [
          { testId: 'grpc-auth-basic-user', value: DEMO_BASIC_USERNAME },
          { testId: 'grpc-auth-basic-pass', value: DEMO_BASIC_PASSWORD },
        ]);

        // Spotlight auth badge first to show Bearer is active, then open auth tab.
        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 500);
        if (!basicReady) {
          await ctx.click(GRPC.AUTH_BADGE);
          try {
            await ctx.waitFor(GRPC.AUTH_PANEL, 5_000);
          } catch {
            await ctx.delay(220);
          }
          await ctx.delay(220);

          // Spotlight auth type dropdown before switching.
          await spotlightAndPause(ctx, GRPC.AUTH_TYPE_SELECT, 420);
          await selectAuthType(ctx, 'basic');
          await ctx.delay(220);

          // Fill username then password with a brief pause on each field.
          await spotlightAuthField(ctx, 'grpc-auth-basic-user', 560);
          await tryFillAuthField(ctx, 'grpc-auth-basic-user', DEMO_BASIC_USERNAME);
          await ctx.delay(260);
          await spotlightAuthField(ctx, 'grpc-auth-basic-pass', 620);
          await tryFillAuthField(ctx, 'grpc-auth-basic-pass', DEMO_BASIC_PASSWORD);
        }

        // Hold on the auth preview strip to show the base64-encoded header.
        try {
          await ctx.waitFor(GRPC.AUTH_PREVIEW, 2_000);
          await spotlightAndPause(ctx, GRPC.AUTH_PREVIEW, 680);
        } catch {
          await ctx.delay(340);
        }

        // Spotlight the auth badge so the viewer sees it now shows Basic.
        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 700);
      },
      verify: GRPC.AUTH_BADGE,
    },

    // -------------------------------------------------------------------------
    // Step 6 — API Key auth
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-api-key-auth',
      title: 'API Key Authentication',
      description:
        'Open the **Auth** tab again. Switch the auth type to **API Key**. ' +
        `Set the header name to \`${DEMO_API_KEY_NAME}\` and the key value to \`${DEMO_API_KEY_VALUE}\`.\n\n` +
        'Unlike Bearer, API Key auth lets you **choose the header name** — useful for services that ' +
        'read `x-api-key`, `x-auth-token`, or any custom key. The key is sent as a standard metadata header, ' +
        'so the server reads it the same way it reads any other gRPC request metadata.\n\n' +
        'The **Outgoing metadata** preview shows: `x-api-key: my-key-123`. In the next step you will see what happens ' +
        'when you also add this key manually in the Metadata tab.',
      highlight: GRPC.AUTH_BADGE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureAuthReadyFast(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        const apiKeyReady = isAuthStepAlreadyConfigured('api_key', [
          { testId: 'grpc-auth-api-key-name', value: DEMO_API_KEY_NAME },
          { testId: 'grpc-auth-api-key-value', value: DEMO_API_KEY_VALUE },
        ]);

        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 500);
        if (!apiKeyReady) {
          await ctx.click(GRPC.AUTH_BADGE);
          try {
            await ctx.waitFor(GRPC.AUTH_PANEL, 5_000);
          } catch {
            await ctx.delay(220);
          }
          await ctx.delay(220);

          await spotlightAndPause(ctx, GRPC.AUTH_TYPE_SELECT, 420);
          await selectAuthType(ctx, 'api_key');
          await ctx.delay(220);

          // Fill header name and value with a pause on each so the viewer can read them.
          await spotlightAuthField(ctx, 'grpc-auth-api-key-name', 560);
          await tryFillAuthField(ctx, 'grpc-auth-api-key-name', DEMO_API_KEY_NAME);
          await ctx.delay(260);
          await spotlightAuthField(ctx, 'grpc-auth-api-key-value', 620);
          await tryFillAuthField(ctx, 'grpc-auth-api-key-value', DEMO_API_KEY_VALUE);
        }

        // Spotlight auth preview.
        try {
          await ctx.waitFor(GRPC.AUTH_PREVIEW, 3_000);
          await spotlightAndPause(ctx, GRPC.AUTH_PREVIEW, 680);
        } catch {
          await ctx.delay(320);
        }

        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 700);
      },
      verify: GRPC.AUTH_BADGE,
    },

    // -------------------------------------------------------------------------
    // Step 7 — Conflict detection
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-conflict',
      title: 'Auth Conflict Detection',
      description:
        'The Auth tab is set to **API Key** with header `x-api-key`. ' +
        `Now click the **Metadata** tab and add another row with the same key: \`${DEMO_API_KEY_NAME}\` and a **different** value.\n\n` +
        'Studio immediately shows a **conflict warning** — the Auth tab owns `x-api-key`, so a duplicate ' +
        'manual entry would produce two headers with conflicting values. The warning prevents ' +
        'subtle bugs where the wrong key silently overrides the structured auth config.\n\n' +
        'The **Outgoing metadata** preview still shows the authoritative value from the Auth tab. ' +
        'Remove the conflicting metadata row or switch auth type to `none` to resolve it.',
      // REQUEST_TAB_METADATA is always visible and is what the viewer needs to click.
      // AUTH_CONFLICTS only exists once the conflict is triggered, so using it here
      // would leave the spotlight invisible during reading.
      highlight: GRPC.REQUEST_TAB_METADATA,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Skip preAction setup if API Key auth is already configured.
        const apiKeyAlreadyConfigured = isAuthStepAlreadyConfigured('api_key', [
          { testId: 'grpc-auth-api-key-name', value: DEMO_API_KEY_NAME },
          { testId: 'grpc-auth-api-key-value', value: DEMO_API_KEY_VALUE },
        ]);
        if (apiKeyAlreadyConfigured) {
          return;
        }

        await ensureAuthReadyFast(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);

        // Ensure API Key auth is active.
        await openAuthTabQuiet(ctx);
        await selectAuthType(ctx, 'api_key');
        await tryFillAuthField(ctx, 'grpc-auth-api-key-name', DEMO_API_KEY_NAME);
        await tryFillAuthField(ctx, 'grpc-auth-api-key-value', DEMO_API_KEY_VALUE);
        // Navigate back to form tab so action starts from a clean state.
        const formTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
        if (formTabBtn && !formTabBtn.disabled) {
          formTabBtn.click();
          await ctx.delay(40);
        }
      },
      action: async (ctx) => {
        // Start from Auth and spotlight the API key value that owns x-api-key.
        await openAuthTabQuiet(ctx);
        await waitForIfMissing(ctx, '[data-testid="grpc-auth-api-key-value"]', 3_000);
        await spotlightAuthField(ctx, 'grpc-auth-api-key-name', 90);
        await spotlightAuthField(ctx, 'grpc-auth-api-key-value', 90);

        const authApiKeyValueInput = document.querySelector<HTMLInputElement>('[data-testid="grpc-auth-api-key-value"]');
        const authApiKeyValue = authApiKeyValueInput?.value.trim() ?? '';
        const conflictingMetadataValue = authApiKeyValue
          ? `${authApiKeyValue}-conflict`
          : 'conflicting-value';

        // Close Auth panel so Metadata tab is reachable/clickable.
        await closeGrpcSettingsDrawerQuiet(ctx);
        const authTabActive = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_AUTH)
          ?.getAttribute('aria-pressed') === 'true';
        if (authTabActive) {
          const formTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
          if (formTabBtn && !formTabBtn.disabled) {
            formTabBtn.click();
            await ctx.delay(40);
          }
        }

        // Spotlight the Metadata tab before clicking so the viewer knows where to look.
        await spotlightAndPause(ctx, GRPC.REQUEST_TAB_METADATA, 70);
        await waitForIfMissing(ctx, GRPC.REQUEST_TAB_METADATA, 8_000);
        const metadataTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_METADATA);
        if (metadataTabBtn && !metadataTabBtn.disabled) {
          await ctx.click(GRPC.REQUEST_TAB_METADATA);
        }
        await waitForIfMissing(ctx, GRPC.METADATA_EDITOR, 5_000);
        await ctx.waitFor(GRPC.METADATA_EDITOR, 5_000);
        await ctx.delay(20);

        // Spotlight the + Add row button before clicking.
        await spotlightAndPause(ctx, GRPC.METADATA_ADD_BTN, 60);

        // Force a fresh x-api-key row so the conflict is deterministic and visible.
        await removeMetadataRowsByKey(ctx, DEMO_API_KEY_NAME);
        await ctx.delay(10);
        await addMetadataRowQuiet(ctx, DEMO_API_KEY_NAME, conflictingMetadataValue);
        await spotlightMetadataRowKeyValue(ctx, DEMO_API_KEY_NAME, 70);
        // Hold briefly on Metadata after configuration before moving to Auth.
        await ctx.delay(15);

        // Switch to Auth so the conflict warning is actually visible and highlight it.
        await ctx.click(GRPC.AUTH_BADGE);
        await waitForIfMissing(ctx, GRPC.AUTH_PANEL, 3_000);
        await ctx.delay(15);

        // Spotlight the conflict warning as the key outcome of this step.
        try {
          await ctx.waitFor(GRPC.AUTH_CONFLICTS, 4_000);
          await spotlightAuthField(ctx, 'grpc-auth-api-key-value', 90);
          await spotlightAndPause(ctx, GRPC.AUTH_CONFLICTS, 120);
          // Also highlight the call-level block hint so viewers see conflict detection
          // both inside Auth and in the global send block strip.
          try {
            await ctx.waitFor(GRPC.SEND_BLOCK_HINT, 1_500);
            await spotlightAndPause(ctx, GRPC.SEND_BLOCK_HINT, 120);
          } catch {
            // Optional visual strip can be hidden in compact/mocked layouts.
          }
        } catch {
          // Conflict indicator may appear asynchronously; continue the lesson.
          await ctx.delay(60);
        }
      },
      verify: GRPC.AUTH_CONFLICTS,
    },

    // -------------------------------------------------------------------------
    // Step 8 — OAuth2 client-credentials
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-oauth2',
      title: 'OAuth2 Client-Credentials Flow',
      description:
        'Open the **Auth** tab and select **OAuth 2.0 (Client Credentials)**. Fill in:\n\n' +
        `- **Token URL:** \`${DEMO_OAUTH2_TOKEN_URL}\`\n` +
        `- **Client ID:** \`${DEMO_OAUTH2_CLIENT_ID}\`\n` +
        '- **Client Secret:** (your secret)\n\n' +
        'RedfireForge fetches the token **server-side** before each gRPC call — the raw credentials ' +
        'never reach the browser. The access token is stored in the session secret vault and ' +
        'injected as `authorization: bearer <token>` automatically.\n\n' +
        '**Why server-side?** If the token URL were fetched directly from the browser, the client secret ' +
        'would appear in network devtools. Routing through the proxy keeps secrets server-only.',
      // AUTH_BADGE is visible after step 6 set API Key — draws the viewer's eye to
      // the current auth state before the step changes it to OAuth2.
      highlight: GRPC.AUTH_BADGE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureAuthReadyFast(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        const oauthReady = isAuthStepAlreadyConfigured('oauth2', [
          { testId: 'grpc-auth-oauth-token-url', value: DEMO_OAUTH2_TOKEN_URL },
          { testId: 'grpc-auth-oauth-client-id', value: DEMO_OAUTH2_CLIENT_ID },
          { testId: 'grpc-auth-oauth-client-secret', value: DEMO_OAUTH2_CLIENT_SECRET },
        ]);

        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 500);
        if (!oauthReady) {
          await ctx.click(GRPC.AUTH_BADGE);
          try {
            await ctx.waitFor(GRPC.AUTH_PANEL, 5_000);
          } catch {
            await ctx.delay(220);
          }
          await ctx.delay(220);

          await spotlightAndPause(ctx, GRPC.AUTH_TYPE_SELECT, 420);
          await selectAuthType(ctx, 'oauth2');
          await ctx.delay(220);

          // Fill token URL and client ID with a pause on each field.
          await spotlightAuthField(ctx, 'grpc-auth-oauth-token-url', 560);
          await tryFillAuthField(ctx, 'grpc-auth-oauth-token-url', DEMO_OAUTH2_TOKEN_URL);
          await ctx.delay(260);
          await spotlightAuthField(ctx, 'grpc-auth-oauth-client-id', 560);
          await tryFillAuthField(ctx, 'grpc-auth-oauth-client-id', DEMO_OAUTH2_CLIENT_ID);
          await ctx.delay(260);
          await spotlightAuthField(ctx, 'grpc-auth-oauth-client-secret', 620);
          await tryFillAuthField(ctx, 'grpc-auth-oauth-client-secret', DEMO_OAUTH2_CLIENT_SECRET);
          await ctx.delay(500);
        }

        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 700);
      },
      verify: GRPC.AUTH_BADGE,
    },

    // -------------------------------------------------------------------------
    // Step 9 — Env-var interpolation in metadata
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-env-var',
      title: 'Environment Variables in Metadata',
      description:
        'Open the **Metadata** tab again. Add a new row:\n\n' +
        `- **Key:** \`${DEMO_ENV_METADATA_KEY}\`\n` +
        `- **Value:** \`${DEMO_ENV_METADATA_VALUE}\`\n\n` +
        'The `{{authToken}}` template resolves against the **active environment**. ' +
        'The **Interpolation Preview Strip** below the target field shows the resolved value — ' +
        'or an orange **Interpolation Error** banner if `authToken` is missing from the environment.\n\n' +
        'This pattern lets you drive metadata values from environment configs: switch between ' +
        '`local`, `staging`, and `production` environments and the metadata values update automatically ' +
        'without editing the call. Use `{{grpcHost}}` in the target, `{{authToken}}` in metadata, ' +
        'and `{{userId}}` in the request body for fully environment-driven gRPC calls. ' +
        'Then click **Send Unary** and confirm the **Response Body** renders successfully.',
      // METADATA_EDITOR is always visible once metadata tab is active.
      highlight: GRPC.METADATA_EDITOR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoReadyFast(ctx);
        // Reset auth to none for a clean final state.
        await resetAuthToNoneQuiet(ctx);
        // Seed interpolation env for deterministic lesson playback.
        upsertWorkspaceDefaults({ authToken: DEMO_ENV_AUTH_TOKEN });

        // Ensure a message is filled so Send is enabled when the step fires.
        const field = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
        if (field && !field.value.trim()) {
          await ctx.fill(GRPC.PROTO_FIELD_INPUT_MESSAGE, GRPC_DEMO_MESSAGE);
          // Fallback: force native input/change in case synthetic fill is dropped.
          if (!field.value.trim()) {
            const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (valueSetter) {
              valueSetter.call(field, GRPC_DEMO_MESSAGE);
            } else {
              field.value = GRPC_DEMO_MESSAGE;
            }
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
          }
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        // Spotlight the Metadata tab before clicking.
        await spotlightAndPause(ctx, GRPC.REQUEST_TAB_METADATA, 600);
        await ctx.waitFor(GRPC.REQUEST_TAB_METADATA, 8_000);
        await ctx.click(GRPC.REQUEST_TAB_METADATA);
        await ctx.waitFor(GRPC.METADATA_EDITOR, 5_000);
        await ctx.delay(500);

        // Spotlight the + Add row button before clicking.
        await spotlightAndPause(ctx, GRPC.METADATA_ADD_BTN, 500);

        // Ensure this step visibly demonstrates adding the row even on replay.
        await removeMetadataRowsByKey(ctx, DEMO_ENV_METADATA_KEY);
        await ctx.delay(120);

        // Add {{authToken}} metadata row.
        await addMetadataRowQuiet(ctx, DEMO_ENV_METADATA_KEY, DEMO_ENV_METADATA_VALUE);
        await ctx.delay(500);

        // Spotlight the entire metadata row (key + value) to highlight the template.
        await spotlightMetadataRowKeyValue(ctx, DEMO_ENV_METADATA_KEY, 800);
        await ctx.delay(300);

        // Spotlight the value field where the {{authToken}} template is visible.
        await spotlightAndPause(
          ctx,
          `[data-testid="grpc-metadata-row-value-${DEMO_ENV_METADATA_KEY}"]`,
          1_100
        );

        // Now highlight the interpolation preview or error banner showing the resolved value.
        const hasPreview = document.querySelector(GRPC.INTERPOLATION_PREVIEW_STRIP);
        const hasErrorBanner = document.querySelector(GRPC.INTERPOLATION_ERROR_BANNER);

        if (hasPreview) {
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_STRIP, 1_200);
          await ctx.delay(200);
          // Highlight the template part of the preview.
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_TEMPLATE, 600);
          await ctx.delay(200);
          // Highlight the resolved part.
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_VALUE, 800);
        } else if (hasErrorBanner) {
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_ERROR_BANNER, 1_200);
        } else {
          await ctx.delay(600);
        }

        // Send Unary and focus Response Body as the user-visible result for this final step.
        await ctx.delay(300);
        const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
        if (sendBtn && !sendBtn.disabled) {
          await spotlightAndPause(ctx, GRPC.SEND_BTN, 600);
          await ctx.click(GRPC.SEND_BTN);
        } else {
          await ensureUnaryExecuted(ctx);
        }

        await ctx.waitFor(GRPC.RESPONSE_PANEL, 8_000);
        await ctx.waitFor(GRPC.RESPONSE_BODY, 8_000);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 900);
      },
      verify: GRPC.RESPONSE_BODY,
    },
  ],
};
