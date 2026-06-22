/** Lesson GQL-4: Authentication & Headers */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_DEMO_HTTP,
  LESSON6_AUTH_TOKEN_VALUE,
  LESSON6_BEARER_TEMPLATE,
  LESSON6_PROFILE_NAME,
  ensureApiKeyAuthConfigured,
  ensureAuthPopoverOpen,
  ensureBasicAuthConfigured,
  ensureBearerAuthConfiguredQuiet,
  ensureEnvAuthToken,
  ensureHealthQuery,
  ensureInheritAuthConfigured,
  ensureInheritExecutedWithMetadata,
  ensureProfileSaved,
  LESSON6_GLOBAL_AUTH_PROFILE_NAME,
  gqlAuthLessonCleanup,
  gqlAuthLessonSetup,
  prepareApiKeyAuthSpotlight,
  prepareApiKeyExecuteSpotlight,
  prepareBasicAuthSpotlight,
  prepareBasicExecuteSpotlight,
  prepareBearerAuthSpotlight,
  prepareBearerExecuteSpotlight,
  prepareInheritAuthSpotlight,
  prepareInheritExecuteSpotlight,
  prepareProfileSpotlight,
  selectAuthType,
} from './graphql-lesson-helpers';

export const gqlAuthHeadersLesson: DemoLesson = {
  id: 'gql-auth-headers',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Authentication & Headers',
  description:
    'Configure Inherit, Bearer, API Key, and Basic auth — resolve secrets from global profiles or environment variables, verify outgoing headers in the Metadata tab, and save a reusable connection profile.',
  estimatedMinutes: 6,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlAuthLessonSetup,
  cleanup: gqlAuthLessonCleanup,

  concept: {
    title: 'Auth & Connection Profiles',
    body: `Every GraphQL API requires some form of credential — a JWT for user identity, an API key for service-to-service calls, or a username/password pair for legacy services. GraphQL Studio puts **all auth configuration on the connection bar** so you never have to hunt through a separate settings page.

**Why not put credentials in the query?** GraphQL sends operations as JSON in the request body. Credentials belong in HTTP **headers** — they travel outside the payload, can be stripped by proxies at the edge, and follow HTTP security standards that API gateways and load balancers already understand.

The **Auth badge** (🔒) opens a popover where you choose **Inherit from Auth Profile**, Bearer, Basic, or API Key. **Inherit** pulls credentials from the **Environment Manager** auth-profile catalog — the same profiles used by WebSocket and SSE studios — so one update propagates everywhere. For per-tab secrets, type \`{{variableName}}\` and GraphQL Studio resolves the value from your active **environment** at execute time.

After **Execute**, open the **Metadata** tab in the response panel to see the exact \`Authorization\` (or custom) header the client sent. This is your ground truth for debugging auth failures.

**Connection profiles** snapshot the current endpoint + auth combination with a name. They differ from **global auth profiles**: connection profiles capture a whole GraphQL Studio context (URL + auth mode), while global auth profiles store reusable credentials shared across the app.

> The test server on port **4010** accepts any token value. This lesson focuses on *configuration and verification*, not on server-side token validation.`,
    keyTerms: [
      {
        term: 'Bearer token',
        definition:
          'HTTP `Authorization: Bearer <token>` header — the most common auth scheme for REST and GraphQL APIs. Typically carries a signed JWT that the server validates to confirm user identity.',
      },
      {
        term: 'Basic Auth',
        definition:
          'HTTP `Authorization: Basic base64(user:pass)` header. Credentials are base64-encoded (not encrypted). Requires HTTPS (GQL-5) to be safe in transit.',
      },
      {
        term: 'API Key',
        definition:
          'A custom header (e.g. `X-API-Key: secret`) used for service-to-service calls. The header name is configurable — not all APIs use `Authorization`.',
      },
      {
        term: 'Environment variable',
        definition:
          'Named secret stored in the Env modal. Referenced as `{{key}}` in auth fields and endpoint URLs. Prevents hardcoding credentials in demos or shared configs.',
      },
      {
        term: 'Request headers (Metadata)',
        definition:
          'The outgoing HTTP headers actually sent with the operation — visible in the Metadata tab after execute. Use this to confirm auth is resolved and transmitted correctly.',
      },
      {
        term: 'Inherit from Auth Profile',
        definition:
          'Auth mode that references a global profile from Environment Manager. GraphQL Studio resolves the profile\'s Bearer/Basic/API Key credentials at execute time — same pattern as WebSocket and SSE studios.',
      },
      {
        term: 'Connection profile',
        definition:
          'Named snapshot of endpoint URL + auth settings in GraphQL Studio. Save via the Profiles badge; load with one click to restore a full context without re-entering credentials.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- ── Window chrome ─────────────────────────────────────────────────────── -->
  <rect x="0" y="0" width="700" height="430" rx="10" fill="var(--bg)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Title bar -->
  <rect x="0" y="0" width="700" height="32" rx="10" fill="var(--surface)"/>
  <rect x="0" y="22" width="700" height="10" fill="var(--surface)"/>
  <!-- Traffic lights -->
  <circle cx="18" cy="16" r="5" fill="#ff5f57"/>
  <circle cx="34" cy="16" r="5" fill="#febc2e"/>
  <circle cx="50" cy="16" r="5" fill="#28c840"/>
  <!-- Title -->
  <text x="350" y="21" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">GraphQL Studio — Authentication &amp; Headers</text>

  <!-- ── Connection bar ─────────────────────────────────────────────────────── -->
  <rect x="8" y="38" width="684" height="30" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <!-- Padlock icon (left of endpoint) -->
  <rect x="16" y="46" width="14" height="14" rx="2" fill="none" stroke="var(--text-muted)" stroke-width="1.3"/>
  <path d="M19 46 v-3 a4 4 0 0 1 8 0 v3" fill="none" stroke="var(--text-muted)" stroke-width="1.3"/>
  <circle cx="23" cy="53" r="1.5" fill="var(--text-muted)"/>
  <!-- Endpoint input -->
  <rect x="36" y="42" width="368" height="22" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="44" y="57" fill="var(--text-muted)" font-size="10">localhost:4010/graphql</text>
  <!-- Auth badge (highlighted) -->
  <rect x="412" y="42" width="62" height="22" rx="3" fill="color-mix(in srgb, var(--primary) 18%, var(--surface))" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="443" y="57" text-anchor="middle" fill="var(--primary)" font-size="9" font-weight="600">🔒 Auth</text>
  <!-- Env badge -->
  <rect x="480" y="42" width="54" height="22" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="507" y="57" text-anchor="middle" fill="var(--text-muted)" font-size="9">Env</text>
  <!-- Execute button -->
  <rect x="542" y="42" width="70" height="22" rx="3" fill="var(--primary)" stroke="none"/>
  <text x="577" y="57" text-anchor="middle" fill="white" font-size="10" font-weight="600">▶ Execute</text>

  <!-- ── Editor pane ─────────────────────────────────────────────────────────── -->
  <rect x="8" y="74" width="336" height="196" rx="4" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <!-- Editor tab bar -->
  <rect x="8" y="74" width="336" height="24" rx="4" fill="var(--bg)"/>
  <rect x="8" y="88" width="336" height="10" fill="var(--bg)"/>
  <rect x="16" y="78" width="52" height="16" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="42" y="89" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Editor</text>
  <rect x="74" y="78" width="52" height="16" rx="3" fill="none"/>
  <text x="100" y="89" text-anchor="middle" fill="var(--text-muted)" font-size="9">Builder</text>
  <!-- Monaco code area -->
  <rect x="8" y="98" width="336" height="172" fill="var(--bg)"/>
  <!-- Line numbers -->
  <text x="18" y="116" fill="var(--text-muted)" font-size="9" opacity="0.5">1</text>
  <text x="18" y="130" fill="var(--text-muted)" font-size="9" opacity="0.5">2</text>
  <text x="18" y="144" fill="var(--text-muted)" font-size="9" opacity="0.5">3</text>
  <!-- Code -->
  <text x="34" y="116" fill="#a78bfa" font-size="10" font-family="monospace">query</text>
  <text x="70" y="116" fill="var(--text)" font-size="10" font-family="monospace">{</text>
  <text x="44" y="130" fill="#34d399" font-size="10" font-family="monospace">  health</text>
  <text x="34" y="144" fill="var(--text)" font-size="10" font-family="monospace">}</text>
  <!-- Cursor -->
  <rect x="75" y="136" width="1.5" height="10" fill="var(--primary)" opacity="0.8"/>

  <!-- ── Auth popover (floating) ─────────────────────────────────────────────── -->
  <rect x="344" y="68" width="214" height="202" rx="6" fill="var(--surface)" stroke="var(--primary)" stroke-width="1.5"
    style="filter:drop-shadow(0 4px 16px rgba(0,0,0,0.4))"/>
  <!-- Popover header -->
  <rect x="344" y="68" width="214" height="28" rx="6" fill="var(--bg)"/>
  <rect x="344" y="82" width="214" height="14" fill="var(--bg)"/>
  <text x="360" y="86" fill="var(--text)" font-size="10" font-weight="600">Authentication</text>
  <!-- Close X -->
  <text x="543" y="86" fill="var(--text-muted)" font-size="11">✕</text>
  <!-- Type row -->
  <text x="360" y="112" fill="var(--text-muted)" font-size="8.5" font-weight="500">Type</text>
  <rect x="394" y="100" width="152" height="20" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="400" y="113" fill="var(--text)" font-size="9">Inherit from Auth Profile</text>
  <text x="532" y="113" fill="var(--text-muted)" font-size="9">▾</text>
  <!-- Profile row (inherit mode) -->
  <text x="360" y="138" fill="var(--text-muted)" font-size="8.5" font-weight="500">Auth Profile</text>
  <rect x="394" y="126" width="152" height="20" rx="3" fill="var(--bg)" stroke="var(--primary)" stroke-width="1"/>
  <text x="400" y="139" fill="var(--text)" font-size="9">Lesson 6 Bearer</text>
  <text x="532" y="139" fill="var(--text-muted)" font-size="9">▾</text>
  <!-- Preview footer -->
  <rect x="344" y="236" width="214" height="34" rx="6" fill="var(--bg)"/>
  <rect x="344" y="236" width="214" height="14" fill="var(--surface)"/>
  <text x="356" y="251" fill="var(--text-muted)" font-size="7.5">ℹ</text>
  <text x="366" y="249" fill="#34d399" font-size="7.5" font-family="monospace">Lesson 6 Bearer: Authorization: Bearer les…</text>
  <text x="366" y="261" fill="var(--text-muted)" font-size="7" opacity="0.7">Resolved from global auth profile</text>

  <!-- ── Response pane (right) ──────────────────────────────────────────────── -->
  <rect x="350" y="74" width="342" height="196" rx="4" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <!-- (Response pane is partially obscured by auth popover — visible on the right) -->
  <!-- Right tab bar -->
  <rect x="350" y="74" width="342" height="24" rx="4" fill="var(--bg)"/>
  <rect x="350" y="88" width="342" height="10" fill="var(--bg)"/>
  <text x="562" y="89" text-anchor="middle" fill="var(--text-muted)" font-size="9">Response</text>
  <text x="612" y="89" text-anchor="middle" fill="var(--text-muted)" font-size="9">Schema</text>
  <!-- Metadata sub-tabs (visible on right of popover) -->
  <rect x="560" y="98" width="130" height="18" rx="0" fill="var(--bg)"/>
  <text x="566" y="110" fill="var(--text-muted)" font-size="8">Body</text>
  <text x="590" y="110" fill="var(--text-muted)" font-size="8">Headers</text>
  <rect x="619" y="98" width="46" height="18" fill="color-mix(in srgb, var(--primary) 12%, var(--bg))" stroke="none"/>
  <text x="642" y="110" text-anchor="middle" fill="var(--primary)" font-size="8" font-weight="600">Metadata</text>
  <!-- Request Headers visible -->
  <rect x="560" y="120" width="130" height="14" rx="2" fill="var(--bg)"/>
  <text x="566" y="130" fill="var(--text-muted)" font-size="7.5" font-weight="600">REQUEST HEADERS</text>
  <rect x="560" y="136" width="130" height="40" rx="2" fill="var(--bg)" opacity="0.6"/>
  <text x="566" y="147" fill="var(--text-muted)" font-size="7.5" font-family="monospace">Content-Type:</text>
  <text x="566" y="156" fill="var(--text-muted)" font-size="7.5" font-family="monospace" opacity="0.7">  application/json</text>
  <text x="566" y="166" fill="#34d399" font-size="7.5" font-family="monospace">Authorization:</text>
  <text x="566" y="175" fill="#34d399" font-size="7.5" font-family="monospace" opacity="0.8">  Bearer les…</text>

  <!-- ── Bottom panel ────────────────────────────────────────────────────────── -->
  <rect x="8" y="276" width="684" height="26" rx="4" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="20" y="293" fill="var(--text-muted)" font-size="8.5">Variables</text>
  <text x="68" y="293" fill="var(--text-muted)" font-size="8.5">Headers</text>
  <text x="110" y="293" fill="var(--text-muted)" font-size="8.5">Files</text>

  <!-- ── Legend ─────────────────────────────────────────────────────────────── -->
  <text x="350" y="322" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-weight="600" opacity="0.7">Authentication workflow</text>

  <!-- Step 1: Auth badge -->
  <rect x="8" y="330" width="156" height="54" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="8" y="330" width="156" height="18" rx="5" fill="color-mix(in srgb, var(--primary) 15%, var(--surface))"/>
  <rect x="8" y="340" width="156" height="8" fill="color-mix(in srgb, var(--primary) 15%, var(--surface))"/>
  <text x="86" y="342" text-anchor="middle" fill="var(--primary)" font-size="8.5" font-weight="700">① Auth Badge</text>
  <text x="86" y="356" text-anchor="middle" fill="var(--text-muted)" font-size="8">Click 🔒 → Inherit, Bearer,</text>
  <text x="86" y="366" text-anchor="middle" fill="var(--text-muted)" font-size="8">Basic, or API Key</text>
  <text x="86" y="378" text-anchor="middle" fill="var(--text-muted)" font-size="8">Use {{var}} to reference secrets</text>

  <!-- Step 2: Env -->
  <rect x="172" y="330" width="156" height="54" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="172" y="330" width="156" height="18" rx="5" fill="color-mix(in srgb, #34d399 12%, var(--surface))"/>
  <rect x="172" y="340" width="156" height="8" fill="color-mix(in srgb, #34d399 12%, var(--surface))"/>
  <text x="250" y="342" text-anchor="middle" fill="#34d399" font-size="8.5" font-weight="700">② Env Variables</text>
  <text x="250" y="356" text-anchor="middle" fill="var(--text-muted)" font-size="8">Click Env → add authToken</text>
  <text x="250" y="366" text-anchor="middle" fill="var(--text-muted)" font-size="8">and apiKey values</text>
  <text x="250" y="378" text-anchor="middle" fill="var(--text-muted)" font-size="8">{{vars}} resolve at execute</text>

  <!-- Step 3: Metadata -->
  <rect x="336" y="330" width="156" height="54" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="336" y="330" width="156" height="18" rx="5" fill="color-mix(in srgb, #a78bfa 12%, var(--surface))"/>
  <rect x="336" y="340" width="156" height="8" fill="color-mix(in srgb, #a78bfa 12%, var(--surface))"/>
  <text x="414" y="342" text-anchor="middle" fill="#a78bfa" font-size="8.5" font-weight="700">③ Metadata Tab</text>
  <text x="414" y="356" text-anchor="middle" fill="var(--text-muted)" font-size="8">Execute → open Metadata</text>
  <text x="414" y="366" text-anchor="middle" fill="var(--text-muted)" font-size="8">confirm Authorization header</text>
  <text x="414" y="378" text-anchor="middle" fill="var(--text-muted)" font-size="8">was sent (env-resolved)</text>

  <!-- Step 4: Profiles -->
  <rect x="500" y="330" width="192" height="54" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="500" y="330" width="192" height="18" rx="5" fill="color-mix(in srgb, #febc2e 12%, var(--surface))"/>
  <rect x="500" y="340" width="192" height="8" fill="color-mix(in srgb, #febc2e 12%, var(--surface))"/>
  <text x="596" y="342" text-anchor="middle" fill="#febc2e" font-size="8.5" font-weight="700">④ Connection Profile</text>
  <text x="596" y="356" text-anchor="middle" fill="var(--text-muted)" font-size="8">Click Profiles → name → Save</text>
  <text x="596" y="366" text-anchor="middle" fill="var(--text-muted)" font-size="8">Captures endpoint + auth</text>
  <text x="596" y="378" text-anchor="middle" fill="var(--text-muted)" font-size="8">One-click context restore</text>

  <!-- Flow arrows between legend boxes -->
  <line x1="164" y1="357" x2="172" y2="357" stroke="var(--border)" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="328" y1="357" x2="336" y2="357" stroke="var(--border)" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="492" y1="357" x2="500" y2="357" stroke="var(--border)" stroke-width="1.5" marker-end="url(#arr)"/>

  <defs>
    <marker id="arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
      <polygon points="0 0,5 2.5,0 5" fill="var(--border)"/>
    </marker>
  </defs>

  <!-- Callout arrow from ① to Auth badge in connection bar -->
  <line x1="86" y1="330" x2="443" y2="64" stroke="var(--primary)" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
</svg>`,
  },

  steps: [
    {
      id: 'gql6-intro',
      title: 'Auth on the Connection Bar',
      description:
        'Most GraphQL APIs require credentials — but **where** you put them matters. In GraphQL Studio, auth lives on the **connection bar**, not buried in a settings page. Click the **🔒 Auth badge** to open the authentication popover — you can pick **Inherit from Auth Profile** (central catalog), **Bearer**, **Basic**, or **API Key**. Notice the **Profiles** badge beside it (saved endpoint + auth snapshots) and the **Env** badge (secret store). They work together to keep credentials out of your queries.',
      highlight: GQL.AUTH_BADGE_BTN,
      pauseAfter: true,
    },

    {
      id: 'gql6-bearer',
      title: 'Bearer Token — Referencing a Secret',
      description:
        'Click the **Auth badge** → select **Bearer Token** → type `{{authToken}}` in the token field. Notice the preview footer immediately shows `Authorization: Bearer {{authToken}}`. The `{{…}}` syntax is intentional: you never paste a raw token here. The actual value is stored in **Env** and resolved at execute time — so demos, screenshots, and shared configs never leak real credentials.',
      highlight: GQL.AUTH_BEARER_INPUT,
      preAction: prepareBearerAuthSpotlight,
      action: async (ctx) => {
        await ensureAuthPopoverOpen(ctx);
        await selectAuthType(ctx, 'bearer');
        await ctx.fill(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
        await ctx.delay(800);
      },
      verify: GQL.AUTH_PREVIEW,
      pauseAfter: true,
    },

    {
      id: 'gql6-env',
      title: 'Store the Secret in Env',
      description:
        'Now store the actual values. Click the **Env badge** → add variable `authToken` with value `' + LESSON6_AUTH_TOKEN_VALUE + '`. Also add `apiKey` for the API Key step. **Why this separation?** The query editor, connection bar config, and your code can all reference `{{authToken}}` safely — only the Env modal ever sees the real secret. Swap environments (dev/staging/prod) without touching the auth config.',
      highlight: GQL.ENV_BADGE,
      preAction: ensureBearerAuthConfiguredQuiet,
      action: async (ctx) => {
        await ensureEnvAuthToken(ctx);
        await ctx.delay(800);
      },
      verify: GQL.ENV_MODAL,
      pauseAfter: true,
    },

    {
      id: 'gql6-execute-bearer',
      title: 'Execute & Verify the Bearer Header',
      description:
        'Click **Execute**. When the response arrives, open the **Metadata** tab and scroll to **Request headers**. Find `Authorization: Bearer lesson6-demo-jwt` — the `{{authToken}}` placeholder was resolved to the real value before the request left the client. This is your **ground truth for debugging**: if a server rejects auth, Metadata shows exactly what was sent.',
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareBearerExecuteSpotlight,
      action: async (ctx) => {
        await ensureHealthQuery(ctx);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(500);
        await ctx.click(GQL.RV_TAB_METADATA);
        await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },

    {
      id: 'gql6-apikey',
      title: 'Switch to API Key Auth',
      description:
        'Some services prefer a **custom header** over the standard `Authorization` scheme — especially internal microservices or third-party gateways. Re-open **Auth** → select **API Key** → set header name `X-API-Key`, value `{{apiKey}}`. The preview updates instantly. Notice the header *name* is now `X-API-Key` instead of `Authorization` — the same env variable trick applies to the value.',
      highlight: GQL.AUTH_TYPE_SELECT,
      preAction: prepareApiKeyAuthSpotlight,
      action: async (ctx) => {
        await ensureApiKeyAuthConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.AUTH_PREVIEW,
      pauseAfter: true,
    },

    {
      id: 'gql6-execute-apikey',
      title: 'Verify the API Key Header',
      description:
        'Click **Execute** → open the **Metadata** tab. The **Request headers** section now shows `X-API-Key: lesson6-secret-key` — the `{{apiKey}}` env variable resolved to its value. Compare this to the Bearer step: **same query, same endpoint, different auth injection**. This is the power of separating auth config from the query itself.',
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareApiKeyExecuteSpotlight,
      action: async (ctx) => {
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(500);
        await ctx.click(GQL.RV_TAB_METADATA);
        await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },

    {
      id: 'gql6-basic',
      title: 'Basic Auth — Username & Password',
      description:
        'The third auth scheme is **Basic Auth**, used by many older REST and GraphQL services. Re-open **Auth** → select **Basic Auth** → enter username `demo` and password `demo-pass`. The preview shows `Authorization: Basic ••• (demo:••••••)` — the colon-joined credentials are base64-encoded before transmission. **Important:** base64 is *encoding*, not *encryption*. Without HTTPS (Lesson GQL-5), anyone intercepting the request can decode it instantly.',
      highlight: GQL.AUTH_TYPE_SELECT,
      preAction: prepareBasicAuthSpotlight,
      action: async (ctx) => {
        await ensureBasicAuthConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.AUTH_PREVIEW,
      pauseAfter: true,
    },

    {
      id: 'gql6-basic-exec',
      title: 'Execute & Confirm Basic Auth Encoding',
      description:
        'Click **Execute** → **Metadata** tab → **Request headers**. You will see `Authorization: Basic ZGVtbzpkZW1vLXBhc3M=` — the base64 of `demo:demo-pass`. Notice the **header name** is identical to Bearer (`Authorization`) but the **scheme prefix** is `Basic` instead of `Bearer`. The GraphQL server reads the scheme to know how to decode the credential. This single header field carries three different auth types — just by changing the prefix.',
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareBasicExecuteSpotlight,
      action: async (ctx) => {
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(500);
        await ctx.click(GQL.RV_TAB_METADATA);
        await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },

    {
      id: 'gql6-inherit',
      title: 'Inherit from Auth Profile',
      description:
        `After manual Bearer, API Key, and Basic, there is a fourth mode: **Inherit from Auth Profile** — the same option WebSocket and SSE studios use. Auth profiles live in **Environment Manager** as a central catalog. Re-open **Auth** → select **Inherit from Auth Profile** → choose **${LESSON6_GLOBAL_AUTH_PROFILE_NAME}**.\n\nThe preview footer shows the resolved \`Authorization: Bearer …\` from the catalog — no \`{{authToken}}\` placeholder in the connection bar. **Why inherit?** Update the profile once in Environment Manager and every studio tab that references it picks up the new credential automatically.`,
      highlight: GQL.AUTH_PROFILE_SELECT,
      preAction: prepareInheritAuthSpotlight,
      action: async (ctx) => {
        await ensureInheritAuthConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.AUTH_PREVIEW,
      pauseAfter: true,
    },

    {
      id: 'gql6-inherit-exec',
      title: 'Execute with Inherited Profile',
      description:
        `Click **Execute** → open the **Metadata** tab. **Request headers** shows \`Authorization: Bearer ${LESSON6_AUTH_TOKEN_VALUE}\` — the token came from the **${LESSON6_GLOBAL_AUTH_PROFILE_NAME}** global profile, not from Env variables or manual entry. Compare to the Bearer step: same header on the wire, but the credential source moved from per-tab config to the shared catalog. This is how teams standardize staging and prod tokens across GraphQL, WebSocket, and SSE.`,
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareInheritExecuteSpotlight,
      action: async (ctx) => {
        await ensureInheritExecutedWithMetadata(ctx);
        await ctx.delay(800);
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },

    {
      id: 'gql6-profile',
      title: 'Save a Connection Profile',
      description:
        `Click **Profiles** on the connection bar → enter name **${LESSON6_PROFILE_NAME}** → **Save**. This **connection profile** captures the endpoint \`${GQL_DEMO_HTTP}\` plus the current auth mode (inherit) as a named snapshot — distinct from the **global auth profile** you selected in the previous step. **Why connection profiles?** When you switch between dev, staging, and prod — each with different URLs and auth modes — load the right connection profile in one click instead of re-entering everything.`,
      highlight: GQL.PROFILE_BADGE,
      preAction: prepareProfileSpotlight,
      action: async (ctx) => {
        await ctx.click(GQL.PROFILE_BADGE);
        await ctx.waitFor(GQL.PROFILE_MODAL, 5000);
        await ctx.delay(600);
        await ctx.fill(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
        await ctx.delay(400);
        await ctx.click(GQL.PROFILE_SAVE_BTN);
        await ctx.delay(800);
      },
      verify: GQL.PROFILE_MODAL,
      pauseAfter: true,
    },

    {
      id: 'gql6-subscription-auth',
      title: 'Auth Carries into Subscriptions',
      description:
        'Here is a subtle but important detail: the Bearer, API Key, or Basic credentials you configured here **automatically travel into the WebSocket handshake** when you subscribe (Lesson GQL-7). The initial HTTP upgrade request that establishes the WebSocket connection includes the same auth headers. You do **not** need to configure auth separately for subscriptions — it inherits from the connection bar. This is why auth is on the *connection bar* rather than tied to individual query tabs.',
      highlight: GQL.AUTH_BADGE_BTN,
      preAction: ensureProfileSaved,
      pauseAfter: true,
    },
  ],
};
