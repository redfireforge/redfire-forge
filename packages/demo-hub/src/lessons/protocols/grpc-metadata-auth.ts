/**
 * Lesson GRPC-4: Request Metadata & Authentication
 *
 * Covers custom request metadata (HTTP/2 headers), all four auth modes, conflict
 * detection between manual metadata and structured auth, and environment-variable
 * interpolation in metadata values.
 *
 *   grpc18-intro          — Connection Settings drawer tour (7 panels overview)
 *   grpc18-metadata-add   — Metadata tab: add x-request-id custom header
 *   grpc18-send-metadata  — Send Echo with metadata, verify response body
 *   grpc18-bearer-auth    — Settings → Auth → Bearer token configuration
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
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';

const GRPC4_ROSTER = getGrpcLessonRosterEntry('grpc-metadata-auth')!;

const DEMO_REQUEST_ID = 'lesson-4-demo';
const DEMO_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo';
const DEMO_BASIC_USERNAME = 'demo';
const DEMO_BASIC_PASSWORD = 'secret';
const DEMO_API_KEY_NAME = 'x-api-key';
const DEMO_API_KEY_VALUE = 'my-key-123';
const DEMO_OAUTH2_TOKEN_URL = 'https://auth.example.com/oauth2/token';
const DEMO_OAUTH2_CLIENT_ID = 'client-id-demo';
const DEMO_ENV_METADATA_KEY = 'x-env-token';
const DEMO_ENV_METADATA_VALUE = '{{authToken}}';

/** Open the Connection Settings drawer quietly if not already open. */
async function openSettingsDrawerQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['steps'][number]['preAction']>>[0],
): Promise<void> {
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

/** Navigate to the auth settings panel, opening the drawer if needed. */
async function openAuthSettingsPanelQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['steps'][number]['preAction']>>[0],
): Promise<void> {
  await openSettingsDrawerQuiet(ctx);
  const authNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('auth'));
  if (authNav) {
    authNav.click();
    try {
      await ctx.waitFor(GRPC.SETTINGS_PANEL('auth'), 3_000);
    } catch {
      // Best-effort.
    }
    await ctx.delay(300);
  }
}

/** Select auth type using the AUTH_TYPE_SELECT dropdown. */
async function selectAuthType(
  ctx: Parameters<NonNullable<GrpcDemoLesson['steps'][number]['action']>>[0],
  type: 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2',
): Promise<void> {
  await openAuthSettingsPanelQuiet(ctx);
  const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
  if (authSelect && authSelect.value !== type) {
    await ctx.selectOption(GRPC.AUTH_TYPE_SELECT, type);
    await ctx.delay(400);
  }
}

/** Reset auth back to 'none' for preAction guards that need a clean slate. */
async function resetAuthToNoneQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['steps'][number]['preAction']>>[0],
): Promise<void> {
  await openAuthSettingsPanelQuiet(ctx);
  const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
  if (authSelect && authSelect.value !== 'none') {
    authSelect.value = 'none';
    authSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(200);
  }
}

/**
 * Add a key-value row to the metadata editor.
 * Clicks METADATA_ADD_BTN, then fills the last empty key/value inputs in the editor.
 */
async function addMetadataRowQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['steps'][number]['action']>>[0],
  key: string,
  value: string,
): Promise<void> {
  const addBtn = document.querySelector<HTMLButtonElement>(GRPC.METADATA_ADD_BTN);
  if (addBtn && !addBtn.disabled) {
    addBtn.click();
    await ctx.delay(300);
  }

  // Fill the last key/value input pair in the metadata editor.
  const editor = document.querySelector<HTMLElement>(GRPC.METADATA_EDITOR);
  if (!editor) return;

  const keyInputs = Array.from(editor.querySelectorAll<HTMLInputElement>('input[placeholder*="key" i], input[data-testid*="key"]'));
  const valInputs = Array.from(editor.querySelectorAll<HTMLInputElement>('input[placeholder*="value" i], input[data-testid*="value"]'));

  const lastKey = keyInputs.at(-1);
  const lastVal = valInputs.at(-1);

  if (lastKey && !lastKey.value.trim()) {
    lastKey.focus();
    lastKey.value = key;
    lastKey.dispatchEvent(new Event('input', { bubbles: true }));
    lastKey.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(200);
  }

  if (lastVal && !lastVal.value.trim()) {
    lastVal.focus();
    lastVal.value = value;
    lastVal.dispatchEvent(new Event('input', { bubbles: true }));
    lastVal.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(200);
  }
}

/** Try to fill a labelled field within a panel by its data-testid pattern. */
async function tryFillAuthField(
  ctx: Parameters<NonNullable<GrpcDemoLesson['steps'][number]['action']>>[0],
  testIdSubstring: string,
  value: string,
): Promise<void> {
  try {
    const input = document.querySelector<HTMLInputElement>(`[data-testid*="${testIdSubstring}"]`);
    if (input && !input.disabled) {
      input.focus();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await ctx.delay(300);
    }
  } catch {
    // Best-effort — auth field layout varies by type.
  }
}

/** Ensure Studio sub-nav is on the main Studio surface and Echo is selected. */
async function ensureEchoReady(
  ctx: Parameters<NonNullable<GrpcDemoLesson['steps'][number]['preAction']>>[0],
): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
  await ensureEchoMethodSelected(ctx);
}

export const grpcMetadataAuthLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC4_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Add custom request metadata headers, configure Bearer, Basic, and API Key auth, detect auth conflicts, ' +
    'try OAuth2 client-credentials flow, and interpolate environment variables in metadata values.',

  setup: grpcFirstCallSetup,
  cleanup: grpcFirstCallCleanup,

  grpc: buildGrpcContractMetaFromRoster(GRPC4_ROSTER),

  concept: {
    title: 'gRPC Metadata & Auth',
    body: `**Request metadata** is gRPC's equivalent of HTTP request headers — key-value pairs transmitted as HTTP/2 headers alongside the RPC payload. Common uses:
- **Tracing** — \`x-request-id\`, \`x-trace-id\`
- **Auth** — \`authorization: bearer <token>\`
- **Feature flags** — \`x-feature: dark-mode\`

RedfireForge's **Connection Settings drawer** centralises all per-session configuration. Click the **gear icon** in the connection bar to open it. The drawer has seven panels across three groups:

| Group | Panels |
|---|---|
| **Connection** | TLS / mTLS, Authentication |
| **Call config** | Call settings, Compression |
| **Advanced** | Health check, K8s port-forward, Transport |

**What you will do in this lesson:**
1. **Metadata tab** — add a custom \`x-request-id\` header and send an Echo call.
2. **Bearer auth** — select Bearer in the Auth panel and fill a demo token.
3. **Basic auth** — switch to Basic (username + password).
4. **API Key auth** — switch to API Key (\`x-api-key\` header).
5. **Conflict detection** — manually add the same key as the API Key auth → Studio flags the conflict.
6. **OAuth2** — fill token URL + client credentials; Studio fetches the token server-side.
7. **Env-var interpolation** — add \`{{authToken}}\` as a metadata value and watch the preview strip resolve it.

**Auth precedence rule:** when the Auth panel has a type other than \`none\`, it owns the \`authorization\` header. Adding the same key manually in the Metadata tab creates a conflict — Studio highlights it with a warning badge.`,
    keyTerms: [
      {
        term: 'Request metadata',
        definition:
          'Key-value pairs sent as HTTP/2 headers alongside the RPC — gRPC\'s equivalent of HTTP request headers. Metadata travels before (initial) and after (trailing) the message body.',
      },
      {
        term: 'Auth precedence',
        definition:
          'When the Auth panel has a type other than `none`, it auto-generates the `authorization` header. A matching key in the manual Metadata tab creates a conflict that Studio flags with a warning.',
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
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
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
  <rect x="1" y="1" width="698" height="260" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5"/>
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
  <rect x="222" y="39" width="22" height="22" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="233" y="53" text-anchor="middle" font-size="12" fill="#a8b8cc">⚙</text>
  <rect x="254" y="39" width="80" height="22" rx="11" fill="#1c3a2a" stroke="#22c55e" stroke-width="0.8"/>
  <text x="294" y="53" text-anchor="middle" font-size="9" fill="#22c55e">Target OK</text>
  <rect x="344" y="41" width="44" height="18" rx="9" fill="#1e293b" stroke="#3b82f6" stroke-width="0.8"/>
  <text x="366" y="53" text-anchor="middle" font-size="8" fill="#3b82f6">Bearer</text>

  <!-- Settings drawer panel -->
  <rect x="12" y="78" width="160" height="172" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="24" y="97" font-size="9.5" fill="#a8b8cc">Connection Settings</text>
  <line x1="24" y1="103" x2="160" y2="103" stroke="#1e293b"/>
  <text x="24" y="118" font-size="8.5" fill="#64748b">Connection</text>
  <rect x="24" y="123" width="136" height="20" rx="3" fill="#1e3a5f" stroke="#3b82f6" stroke-width="0.8"/>
  <text x="35" y="136" font-size="8" fill="#93c5fd">🔒 TLS / mTLS</text>
  <rect x="24" y="147" width="136" height="20" rx="3" fill="#172554" stroke="#60a5fa" stroke-width="1"/>
  <text x="35" y="160" font-size="8" fill="#3b82f6">🔑 Authentication</text>
  <text x="24" y="182" font-size="8.5" fill="#64748b">Call config</text>
  <text x="35" y="197" font-size="8" fill="#475569">⚙ Call settings</text>
  <text x="35" y="211" font-size="8" fill="#475569">≡ Compression</text>
  <text x="24" y="228" font-size="8.5" fill="#64748b">Advanced</text>
  <text x="35" y="242" font-size="8" fill="#475569">♥ Health  ☸ K8s  ⇄ Transport</text>

  <!-- Auth panel detail -->
  <rect x="184" y="78" width="200" height="172" rx="5" fill="#0f172a" stroke="#3b82f6" stroke-width="1"/>
  <text x="196" y="97" font-size="9.5" fill="#a8b8cc">Authentication</text>
  <line x1="196" y1="103" x2="376" y2="103" stroke="#1e293b"/>
  <text x="196" y="118" font-size="8" fill="#64748b">Auth type</text>
  <rect x="196" y="123" width="176" height="22" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1"/>
  <text x="284" y="137" text-anchor="middle" font-size="9" fill="#93c5fd">Bearer ▾</text>
  <text x="196" y="162" font-size="8" fill="#64748b">Token</text>
  <rect x="196" y="167" width="176" height="22" rx="4" fill="#0a1118" stroke="#334155"/>
  <text x="208" y="181" font-family="monospace" font-size="8" fill="#4ade80">eyJ•••••••••••</text>
  <text x="196" y="207" font-size="8" fill="#64748b">Preview</text>
  <rect x="196" y="212" width="176" height="20" rx="3" fill="#0a1118" stroke="#334155"/>
  <text x="208" y="224" font-family="monospace" font-size="7.5" fill="#a8b8cc">authorization: bearer eyJ…</text>
  <text x="196" y="244" font-size="7.5" fill="#3b82f6">✓ token stored in session vault</text>

  <!-- Metadata editor -->
  <rect x="396" y="78" width="294" height="172" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="408" y="97" font-size="9.5" fill="#a8b8cc">Metadata Tab (Call Panel)</text>
  <line x1="408" y1="103" x2="682" y2="103" stroke="#1e293b"/>

  <rect x="408" y="108" width="264" height="20" rx="3" fill="#0a1118" stroke="#334155"/>
  <text x="416" y="120" font-family="monospace" font-size="8" fill="#f1f5f9">x-request-id</text>
  <text x="530" y="120" font-family="monospace" font-size="8" fill="#4ade80">lesson-4-demo</text>

  <rect x="408" y="131" width="264" height="20" rx="3" fill="#0a1118" stroke="#334155"/>
  <text x="416" y="143" font-family="monospace" font-size="8" fill="#f1f5f9">x-api-key</text>
  <text x="530" y="143" font-family="monospace" font-size="8" fill="#4ade80">my-key-123</text>

  <rect x="408" y="154" width="264" height="20" rx="3" fill="#0a1118" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="416" y="166" font-family="monospace" font-size="8" fill="#f1f5f9">x-env-token</text>
  <text x="530" y="166" font-family="monospace" font-size="8" fill="#f59e0b">{{authToken}}</text>

  <!-- Conflict banner -->
  <rect x="408" y="182" width="264" height="18" rx="3" fill="#451a03" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="420" y="193" font-size="7.5" fill="#fbbf24">⚠ x-api-key conflicts with API Key auth config</text>

  <!-- Interpolation preview -->
  <rect x="408" y="204" width="264" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="416" y="214" font-size="7.5" fill="#a8b8cc">{{authToken}} → </text>
  <text x="486" y="214" font-family="monospace" font-size="7.5" fill="#22c55e">Bearer abc123…</text>

  <rect x="408" y="224" width="110" height="18" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="0.8"/>
  <text x="463" y="235" text-anchor="middle" font-size="8" fill="#4ade80">+ Add row</text>

  <!-- Legend -->
  <text x="350" y="290" text-anchor="middle" font-size="11" fill="#a8b8cc">Lesson flow</text>

  <circle cx="70" cy="320" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="70" y="324" text-anchor="middle" font-size="9" fill="#3b82f6">1</text>
  <text x="70" y="341" text-anchor="middle" font-size="8" fill="#94a3b8">Settings</text>
  <text x="70" y="351" text-anchor="middle" font-size="8" fill="#94a3b8">tour</text>
  <line x1="82" y1="320" x2="122" y2="320" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="134" cy="320" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="134" y="324" text-anchor="middle" font-size="9" fill="#3b82f6">2</text>
  <text x="134" y="341" text-anchor="middle" font-size="8" fill="#94a3b8">Add</text>
  <text x="134" y="351" text-anchor="middle" font-size="8" fill="#94a3b8">metadata</text>
  <line x1="146" y1="320" x2="186" y2="320" stroke="#22c55e" marker-end="url(#grpc4-arr-g)"/>

  <circle cx="198" cy="320" r="11" fill="#052e16" stroke="#22c55e"/>
  <text x="198" y="324" text-anchor="middle" font-size="9" fill="#22c55e">3</text>
  <text x="198" y="341" text-anchor="middle" font-size="8" fill="#94a3b8">Send</text>
  <text x="198" y="351" text-anchor="middle" font-size="8" fill="#94a3b8">call</text>
  <line x1="210" y1="320" x2="250" y2="320" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="262" cy="320" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="262" y="324" text-anchor="middle" font-size="9" fill="#3b82f6">4</text>
  <text x="262" y="341" text-anchor="middle" font-size="8" fill="#94a3b8">Bearer</text>
  <text x="262" y="351" text-anchor="middle" font-size="8" fill="#94a3b8">auth</text>
  <line x1="274" y1="320" x2="314" y2="320" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="326" cy="320" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="326" y="324" text-anchor="middle" font-size="9" fill="#3b82f6">5-6</text>
  <text x="326" y="341" text-anchor="middle" font-size="8" fill="#94a3b8">Basic /</text>
  <text x="326" y="351" text-anchor="middle" font-size="8" fill="#94a3b8">API Key</text>
  <line x1="338" y1="320" x2="378" y2="320" stroke="#f59e0b" marker-end="url(#grpc4-arr-o)"/>

  <circle cx="390" cy="320" r="11" fill="#451a03" stroke="#f59e0b"/>
  <text x="390" y="324" text-anchor="middle" font-size="9" fill="#f59e0b">7</text>
  <text x="390" y="341" text-anchor="middle" font-size="8" fill="#94a3b8">Conflict</text>
  <text x="390" y="351" text-anchor="middle" font-size="8" fill="#94a3b8">detect</text>
  <line x1="402" y1="320" x2="442" y2="320" stroke="#3b82f6" marker-end="url(#grpc4-arr)"/>

  <circle cx="454" cy="320" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="454" y="324" text-anchor="middle" font-size="9" fill="#3b82f6">8</text>
  <text x="454" y="341" text-anchor="middle" font-size="8" fill="#94a3b8">OAuth2</text>
  <line x1="466" y1="320" x2="506" y2="320" stroke="#22c55e" marker-end="url(#grpc4-arr-g)"/>

  <circle cx="518" cy="320" r="11" fill="#052e16" stroke="#22c55e"/>
  <text x="518" y="324" text-anchor="middle" font-size="9" fill="#22c55e">9</text>
  <text x="518" y="341" text-anchor="middle" font-size="8" fill="#94a3b8">Env var</text>
  <text x="518" y="351" text-anchor="middle" font-size="8" fill="#94a3b8">interp.</text>
</svg>`,
  },

  steps: [
    // -------------------------------------------------------------------------
    // Step 1 — Intro: Connection Settings drawer tour
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-intro',
      title: 'Connection Settings Drawer',
      description:
        'Click the **gear icon** in the connection bar to open the **Connection Settings drawer**. ' +
        'The drawer has **seven panels** across three groups:\n\n' +
        '- **Connection:** TLS / mTLS · Authentication\n' +
        '- **Call config:** Call settings · Compression\n' +
        '- **Advanced:** Health check · K8s port-forward · Transport\n\n' +
        'This lesson focuses on **Authentication** (Bearer, Basic, API Key, OAuth2) and ' +
        'the **Metadata tab** in the Call Panel. Auth settings apply per-tab — changing them ' +
        'on one gRPC tab does not affect others.',
      highlight: GRPC.CONNECTION_SETTINGS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
        await ensureGrpcStudioSubNavQuiet(ctx);
        await ensureGrpcTarget(ctx);
        await ensureGrpcReflected(ctx);
        await ensureEchoMethodSelected(ctx);
      },
      action: async (ctx) => {
        if (!document.querySelector(GRPC.SETTINGS_DRAWER)) {
          await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
          try {
            await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
          } catch {
            // Best-effort — drawer may already be present.
          }
        }
        await ctx.delay(1_000);
        // Tour each nav section so viewers can read the labels.
        for (const navItem of ['tls', 'auth', 'call', 'compression', 'health']) {
          const navEl = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM(navItem));
          if (navEl) {
            navEl.click();
            await ctx.delay(500);
          }
        }
        await ctx.delay(600);
        // Close the drawer after the tour.
        const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(500);
        }
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
      highlight: GRPC.METADATA_EDITOR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoReady(ctx);
        // Reset auth to none so metadata editor is in a clean state.
        await resetAuthToNoneQuiet(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        // Navigate to Metadata tab.
        await ctx.waitFor(GRPC.REQUEST_TAB_METADATA, 8_000);
        await ctx.click(GRPC.REQUEST_TAB_METADATA);
        await ctx.waitFor(GRPC.METADATA_EDITOR, 5_000);
        await ctx.delay(600);
        // Add the x-request-id row.
        await addMetadataRowQuiet(ctx, 'x-request-id', DEMO_REQUEST_ID);
        await ctx.delay(800);
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
        'Notice: the response **Body**, **Headers**, and **Trailers** tabs still show the standard echo response. ' +
        'The `x-request-id` header traveled to the server as initial metadata — not reflected in the echo body ' +
        'unless the server is configured to echo headers back. This is the typical gRPC pattern: ' +
        'metadata is for infrastructure concerns (auth, tracing, routing), not business payload.',
      highlight: GRPC.SEND_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoReady(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
        // Ensure a message is filled so Send is enabled.
        const field = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
        if (!field?.value.trim()) {
          await ctx.fill(GRPC.PROTO_FIELD_INPUT_MESSAGE, GRPC_DEMO_MESSAGE);
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        await ensureUnaryExecuted(ctx);
        await ctx.delay(1_000);
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
        'Open **Settings → Authentication**. Select **Bearer** as the auth type. ' +
        `Fill in a demo token: \`${DEMO_BEARER_TOKEN.slice(0, 30)}…\`\n\n` +
        'RedfireForge stores the token in the **session vault** — it is never written to localStorage ' +
        'or included in collection/History exports. The **Auth preview** bar at the bottom of the panel ' +
        'shows the exact header that will be sent: `authorization: bearer <token>`.\n\n' +
        'With Bearer selected, click **Send** — the `authorization` header is automatically forwarded ' +
        'by the Express proxy to the echo server. Most gRPC services validate it via a server-side interceptor.',
      highlight: GRPC.AUTH_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoReady(ctx);
      },
      action: async (ctx) => {
        await openSettingsDrawerQuiet(ctx);
        await ctx.delay(600);
        // Navigate to auth panel.
        const authNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('auth'));
        if (authNav) {
          authNav.click();
          try {
            await ctx.waitFor(GRPC.SETTINGS_PANEL('auth'), 3_000);
          } catch {
            // Best-effort.
          }
        }
        await ctx.delay(500);
        // Select Bearer auth type.
        await selectAuthType(ctx, 'bearer');
        await ctx.delay(600);
        // Fill the bearer token field (best-effort — testid pattern varies by implementation).
        await tryFillAuthField(ctx, 'bearer-token', DEMO_BEARER_TOKEN);
        // Verify auth preview appears.
        try {
          await ctx.waitFor(GRPC.AUTH_PREVIEW, 3_000);
        } catch {
          // Preview may not render until token is filled.
        }
        await ctx.delay(1_000);
        // Close drawer so viewer sees the Auth badge in the connection bar.
        const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(600);
        }
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
        'Open **Settings → Authentication** again. Switch the auth type to **Basic**. ' +
        `Fill in **Username:** \`${DEMO_BASIC_USERNAME}\` and **Password:** \`${DEMO_BASIC_PASSWORD}\`.\n\n` +
        'RedfireForge encodes these as `authorization: basic <base64(username:password)>`. ' +
        'Use Basic auth for services that accept HTTP Basic credentials — typically internal ' +
        'APIs or legacy gRPC services that read the `authorization` header directly. ' +
        'Note: Basic auth transmits credentials on every call; prefer Bearer or OAuth2 for production.',
      highlight: GRPC.AUTH_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoReady(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await openSettingsDrawerQuiet(ctx);
        await ctx.delay(500);
        const authNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('auth'));
        if (authNav) {
          authNav.click();
          try {
            await ctx.waitFor(GRPC.SETTINGS_PANEL('auth'), 3_000);
          } catch {
            // Best-effort.
          }
        }
        await ctx.delay(400);
        // Switch to Basic.
        await selectAuthType(ctx, 'basic');
        await ctx.delay(600);
        await tryFillAuthField(ctx, 'basic-username', DEMO_BASIC_USERNAME);
        await tryFillAuthField(ctx, 'basic-password', DEMO_BASIC_PASSWORD);
        await ctx.delay(1_000);
        const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(600);
        }
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
        'Switch the auth type to **API Key**. ' +
        `Set the header name to \`${DEMO_API_KEY_NAME}\` and value to \`${DEMO_API_KEY_VALUE}\`.\n\n` +
        'Unlike Bearer, API Key auth lets you **choose the header name** — useful for services that ' +
        'read `x-api-key`, `x-auth-token`, or any custom key. The key is added as a standard metadata header, ' +
        'so the server reads it the same way it would read any other gRPC request metadata.\n\n' +
        'The **Auth preview** shows: `x-api-key: my-key-123`. In the next step you will see what happens ' +
        'when you also add this key manually in the Metadata tab.',
      highlight: GRPC.AUTH_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoReady(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await openSettingsDrawerQuiet(ctx);
        await ctx.delay(500);
        const authNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('auth'));
        if (authNav) {
          authNav.click();
          try {
            await ctx.waitFor(GRPC.SETTINGS_PANEL('auth'), 3_000);
          } catch {
            // Best-effort.
          }
        }
        await ctx.delay(400);
        // Switch to API Key.
        await selectAuthType(ctx, 'apikey');
        await ctx.delay(600);
        await tryFillAuthField(ctx, 'apikey-header', DEMO_API_KEY_NAME);
        await tryFillAuthField(ctx, 'apikey-value', DEMO_API_KEY_VALUE);
        // Show auth preview.
        try {
          await ctx.waitFor(GRPC.AUTH_PREVIEW, 3_000);
          await ctx.delay(800);
        } catch {
          await ctx.delay(600);
        }
        const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(600);
        }
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
        'The Auth panel is set to **API Key** with `x-api-key`. ' +
        `Now click the **Metadata** tab and add another row with the same key: \`${DEMO_API_KEY_NAME}\` and a **different** value.\n\n` +
        'Studio immediately shows a **conflict indicator** — the Auth panel owns `x-api-key`, so a duplicate ' +
        'manual entry would produce two headers with conflicting values. The conflict warning prevents ' +
        'subtle bugs where the wrong key silently overrides the structured auth config.\n\n' +
        'The **Auth preview** still shows the authoritative value from the Auth panel. ' +
        'Remove the conflicting metadata row or switch auth type to `none` to resolve the conflict.',
      highlight: GRPC.AUTH_CONFLICTS,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoReady(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
        // Ensure API Key auth is active.
        await openAuthSettingsPanelQuiet(ctx);
        const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
        if (authSelect && authSelect.value !== 'apikey') {
          await selectAuthType(ctx, 'apikey');
        }
        await tryFillAuthField(ctx, 'apikey-header', DEMO_API_KEY_NAME);
        await tryFillAuthField(ctx, 'apikey-value', DEMO_API_KEY_VALUE);
        const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(400);
        }
      },
      action: async (ctx) => {
        // Navigate to Metadata tab.
        await ctx.waitFor(GRPC.REQUEST_TAB_METADATA, 8_000);
        await ctx.click(GRPC.REQUEST_TAB_METADATA);
        await ctx.waitFor(GRPC.METADATA_EDITOR, 5_000);
        await ctx.delay(600);
        // Add a conflicting x-api-key row.
        await addMetadataRowQuiet(ctx, DEMO_API_KEY_NAME, 'conflicting-value');
        await ctx.delay(800);
        // Spotlight the conflict warning if it appears.
        try {
          await ctx.waitFor(GRPC.AUTH_CONFLICTS, 4_000);
          await ctx.delay(1_200);
        } catch {
          // Conflict indicator may appear asynchronously; continue the lesson.
          await ctx.delay(800);
        }
      },
      verify: GRPC.METADATA_EDITOR,
    },

    // -------------------------------------------------------------------------
    // Step 8 — OAuth2 client-credentials
    // -------------------------------------------------------------------------
    {
      id: 'grpc18-oauth2',
      title: 'OAuth2 Client-Credentials Flow',
      description:
        'Open **Settings → Authentication** and select **OAuth2**. Fill in:\n\n' +
        `- **Token URL:** \`${DEMO_OAUTH2_TOKEN_URL}\`\n` +
        `- **Client ID:** \`${DEMO_OAUTH2_CLIENT_ID}\`\n` +
        '- **Client Secret:** (your secret)\n\n' +
        'RedfireForge fetches the token **server-side** before each gRPC call — the raw credentials ' +
        'never reach the browser. The access token is stored in the session secret vault and ' +
        'injected as `authorization: bearer <token>` automatically.\n\n' +
        '**Why server-side?** If the token URL is fetched from the browser, the client secret would ' +
        'appear in network devtools. Routing through the Express proxy keeps secrets server-only.',
      highlight: GRPC.AUTH_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoReady(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await openSettingsDrawerQuiet(ctx);
        await ctx.delay(500);
        const authNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('auth'));
        if (authNav) {
          authNav.click();
          try {
            await ctx.waitFor(GRPC.SETTINGS_PANEL('auth'), 3_000);
          } catch {
            // Best-effort.
          }
        }
        await ctx.delay(400);
        // Switch to OAuth2.
        await selectAuthType(ctx, 'oauth2');
        await ctx.delay(600);
        await tryFillAuthField(ctx, 'oauth2-token-url', DEMO_OAUTH2_TOKEN_URL);
        await tryFillAuthField(ctx, 'oauth2-client-id', DEMO_OAUTH2_CLIENT_ID);
        await ctx.delay(1_200);
        const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(600);
        }
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
        'and `{{userId}}` in the request body for fully environment-driven gRPC calls.',
      highlight: GRPC.INTERPOLATION_PREVIEW_STRIP,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoReady(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
        // Reset auth to none for a clean final state.
        await resetAuthToNoneQuiet(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        // Navigate to Metadata tab.
        await ctx.waitFor(GRPC.REQUEST_TAB_METADATA, 8_000);
        await ctx.click(GRPC.REQUEST_TAB_METADATA);
        await ctx.waitFor(GRPC.METADATA_EDITOR, 5_000);
        await ctx.delay(600);
        // Add {{authToken}} metadata row.
        await addMetadataRowQuiet(ctx, DEMO_ENV_METADATA_KEY, DEMO_ENV_METADATA_VALUE);
        await ctx.delay(800);
        // Show interpolation preview or error banner.
        const hasPreview = document.querySelector(GRPC.INTERPOLATION_PREVIEW_STRIP);
        const hasErrorBanner = document.querySelector(GRPC.INTERPOLATION_ERROR_BANNER);
        if (hasPreview || hasErrorBanner) {
          await ctx.delay(1_200);
        } else {
          await ctx.delay(600);
        }
      },
      verify: GRPC.METADATA_EDITOR,
    },
  ],
};
