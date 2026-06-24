/** Lesson GQL-4: Authentication & Headers (14-step config + Metadata observe splits) */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_STUDIO_LESSON_ALLOWED_TABS,
  GQL_DEMO_HTTP,
  LESSON6_AUTH_TOKEN_VALUE,
  LESSON6_API_KEY_VALUE,
  LESSON6_API_KEY_HEADER,
  LESSON6_API_KEY_TEMPLATE,
  LESSON6_BEARER_TEMPLATE,
  LESSON6_BASIC_USER,
  LESSON6_BASIC_PASS,
  LESSON6_OAUTH_TOKEN_URL,
  LESSON6_OAUTH_CLIENT_ID,
  LESSON6_OAUTH_CLIENT_SECRET,
  LESSON6_GLOBAL_AUTH_PROFILE_NAME,
  LESSON6_PROFILE_NAME,
  closeAuthPanelIfOpen,
  ensureEnvReady,
  markBearerDone,
  markApiKeyDone,
  markBasicDone,
  markOauthDone,
  markInheritDone,
  markProfileDone,
  preEnvStep,
  preOauthStep,
  preProfileStep,
  preIntroStep,
  prepareBearerConfigReading,
  prepareBearerObserveReading,
  prepareApiKeyConfigReading,
  prepareApiKeyObserveReading,
  prepareBasicConfigReading,
  prepareBasicObserveReading,
  prepareInheritConfigReading,
  prepareInheritObserveReading,
  prepareSubscriptionExecReading,
  prepareSubscriptionObserveReading,
  runAuthExecuteWithMetadata,
  selectInheritGlobalProfileInPanel,
  selectAuthInPanel,
  gqlAuthLessonCleanup,
  gqlAuthLessonSetup,
} from './graphql-lesson-helpers';

export const gqlAuthHeadersLesson: DemoLesson = {
  id: 'gql-auth-headers',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Authentication & Headers',
  description:
    'Store secrets in environment variables, then configure Bearer, API Key, Basic, OAuth 2.0, and Inherit auth — each type shown once and verified in Metadata or the auth preview. Save a reusable connection profile at the end.',
  estimatedMinutes: 8,
  initialTab: 'graphql-studio',
  allowedTabs: GQL_STUDIO_LESSON_ALLOWED_TABS,
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlAuthLessonSetup,
  cleanup: gqlAuthLessonCleanup,

  concept: {
    title: 'Auth, Env Variables & Connection Profiles',
    body: `Every GraphQL API requires some form of credential — a JWT for user identity, an API key for service-to-service calls, or a username/password pair for legacy services. GraphQL Studio puts **all auth configuration on the connection bar** so you never have to hunt through a separate settings page.

**Start with Env variables.** Before configuring any auth type, open the **Env badge** and store real secret values there — for example \`authToken = ${LESSON6_AUTH_TOKEN_VALUE}\` and \`apiKey = ${LESSON6_API_KEY_VALUE}\`. Auth fields accept \`{{variableName}}\` placeholders. At execute time, GraphQL Studio resolves \`{{authToken}}\` to \`${LESSON6_AUTH_TOKEN_VALUE}\` before the request leaves the client. The Metadata tab proves it: after execution you'll see the literal resolved value, not the template string.

**Why not put credentials in the query?** GraphQL sends operations as JSON in the request body. Credentials belong in HTTP **headers** — they travel outside the payload, can be stripped by proxies at the edge, and follow HTTP security standards that API gateways already understand.

The **Auth badge** (🔒) focuses the **Auth** bottom tab with four modes:
- **Bearer Token** — \`Authorization: Bearer <token>\`. Use \`{{authToken}}\` as the value.
- **API Key** — a custom header such as \`X-API-Key: {{apiKey}}\`. The header name is configurable.
- **Basic Auth** — credentials encoded as \`Authorization: Basic base64(user:pass)\`. Base64 is *encoding*, not encryption — requires HTTPS (**GQL-5**) to be safe in transit.
- **Inherit from Auth Profile** — references a shared credential from the **Environment Manager** catalog. Update the profile once and every studio that references it picks up the change automatically.

After **Execute**, open the **Metadata** tab to see the exact headers that were sent. This is your ground truth for debugging auth failures.

With a **single tab**, auth edits update the **page-level default** — every new tab inherits it until it sets its own override. With **multiple tabs** (GQL-14), each tab can store an explicit auth override while sharing the same endpoint URL.

**Connection profiles** snapshot the current endpoint + auth mode under a name. Load a profile to restore the full context in one click — useful when switching between dev, staging, and prod.`,
    keyTerms: [
      {
        term: 'Environment variable',
        definition:
          'Named secret stored in the Env modal. Referenced as `{{key}}` in auth fields and endpoint URLs. Prevents hardcoding credentials — swap environments without touching the auth config. At execute time the placeholder is replaced with the real value before the request leaves the client.',
      },
      {
        term: 'Bearer token',
        definition:
          'HTTP `Authorization: Bearer <token>` header — the most common auth scheme for REST and GraphQL APIs. Typically carries a signed JWT. Use `{{authToken}}` as the template value and store the real token in Env.',
      },
      {
        term: 'API Key',
        definition:
          'A custom header (e.g. `X-API-Key: {{apiKey}}`) used for service-to-service calls. The header name is configurable — not all APIs use `Authorization`. The value is resolved from Env at execute time.',
      },
      {
        term: 'Basic Auth',
        definition:
          'HTTP `Authorization: Basic base64(user:pass)` header. Credentials are base64-encoded (not encrypted). Requires HTTPS (GQL-5) to be safe in transit.',
      },
      {
        term: 'OAuth 2.0 (Client Credentials)',
        definition:
          'Service-to-service flow: configure token URL, client ID, and client secret in the Auth panel. GraphQL Studio fetches a short-lived access token at execute time (via pre-request scripts or Environment Manager OAuth profiles) and sends it as `Authorization: Bearer <token>`.',
      },
      {
        term: 'Request headers (Metadata tab)',
        definition:
          'The outgoing HTTP headers actually sent with the operation — visible in the Metadata tab after execute. Confirms that env-variable placeholders were resolved and the correct credential was transmitted.',
      },
      {
        term: 'Inherit from Auth Profile',
        definition:
          "Auth mode that references a global profile from Environment Manager. GraphQL Studio resolves the profile's Bearer/Basic/API Key credentials at execute time — same catalog used by WebSocket and SSE studios.",
      },
      {
        term: 'Connection profile',
        definition:
          'Named snapshot of endpoint URL + auth mode in GraphQL Studio. Save via the Profiles badge; load with one click to restore a full context without re-entering credentials.',
      },
      {
        term: 'Per-tab auth override',
        definition:
          'When two or more tabs are open, auth edits on a tab store an explicit override on that tab only. Other tabs keep their own auth (or inherit workspace). Subscriptions and queries on the active tab use that tab\'s resolved auth chain.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- Window chrome -->
  <rect x="0" y="0" width="700" height="430" rx="10" fill="var(--bg)" stroke="var(--border)" stroke-width="1.5"/>
  <rect x="0" y="0" width="700" height="30" rx="10" fill="var(--surface)"/>
  <rect x="0" y="20" width="700" height="10" fill="var(--surface)"/>
  <circle cx="18" cy="15" r="5" fill="#ff5f57"/><circle cx="34" cy="15" r="5" fill="#febc2e"/><circle cx="50" cy="15" r="5" fill="#28c840"/>
  <text x="350" y="20" text-anchor="middle" fill="var(--text-muted)" font-size="10.5" font-weight="500">GraphQL Studio — Authentication &amp; Headers</text>

  <!-- Connection bar -->
  <rect x="8" y="36" width="684" height="28" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="14" y="42" width="356" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="20" y="54" fill="var(--text-muted)" font-size="9.5">http://localhost:4010/graphql</text>
  <rect x="374" y="42" width="56" height="18" rx="3" fill="color-mix(in srgb, #34d399 18%, var(--surface))" stroke="#34d399" stroke-width="1.5"/>
  <text x="402" y="54" text-anchor="middle" fill="#34d399" font-size="9" font-weight="700">⬡ Env</text>
  <rect x="434" y="42" width="60" height="18" rx="3" fill="color-mix(in srgb, var(--primary) 18%, var(--surface))" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="464" y="54" text-anchor="middle" fill="var(--primary)" font-size="9" font-weight="700">🔒 Auth</text>
  <rect x="498" y="42" width="60" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="528" y="54" text-anchor="middle" fill="var(--text-muted)" font-size="9">Profiles</text>
  <rect x="564" y="42" width="68" height="18" rx="3" fill="var(--primary)"/>
  <text x="598" y="54" text-anchor="middle" fill="white" font-size="9.5" font-weight="600">▶ Execute</text>

  <!-- Env modal -->
  <rect x="8" y="70" width="220" height="148" rx="6" fill="var(--surface)" stroke="#34d399" stroke-width="1.5" style="filter:drop-shadow(0 4px 12px rgba(0,0,0,0.35))"/>
  <rect x="8" y="70" width="220" height="26" rx="6" fill="var(--bg)"/>
  <rect x="8" y="86" width="220" height="10" fill="var(--bg)"/>
  <text x="22" y="87" fill="#34d399" font-size="9.5" font-weight="700">⬡ Environment Variables</text>
  <rect x="16" y="102" width="204" height="22" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="22" y="116" fill="var(--text-muted)" font-size="8.5" font-family="monospace">authToken</text>
  <text x="108" y="116" fill="#34d399" font-size="8.5" font-family="monospace">lesson6-demo-jwt</text>
  <rect x="16" y="128" width="204" height="22" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="22" y="142" fill="var(--text-muted)" font-size="8.5" font-family="monospace">apiKey</text>
  <text x="108" y="142" fill="#34d399" font-size="8.5" font-family="monospace">lesson6-api-key…</text>
  <rect x="60" y="156" width="116" height="18" rx="4" fill="var(--primary)"/>
  <text x="118" y="169" text-anchor="middle" fill="white" font-size="9" font-weight="600">Set Active</text>
  <text x="118" y="197" text-anchor="middle" fill="#34d399" font-size="8.5" font-weight="600">② Env: store secrets first</text>

  <!-- Bottom Auth panel -->
  <rect x="236" y="70" width="232" height="180" rx="6" fill="var(--surface)" stroke="var(--primary)" stroke-width="1.5" style="filter:drop-shadow(0 4px 14px rgba(0,0,0,0.4))"/>
  <rect x="236" y="70" width="232" height="26" rx="6" fill="var(--bg)"/>
  <rect x="236" y="86" width="232" height="10" fill="var(--bg)"/>
  <text x="250" y="87" fill="var(--text)" font-size="9.5" font-weight="700">Authentication</text>
  <text x="250" y="110" fill="var(--text-muted)" font-size="8" font-weight="500">TYPE</text>
  <rect x="284" y="100" width="172" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="290" y="112" fill="var(--text)" font-size="8.5">Bearer Token</text>
  <text x="446" y="112" fill="var(--text-muted)" font-size="8">▾</text>
  <text x="250" y="134" fill="var(--text-muted)" font-size="8" font-weight="500">TOKEN</text>
  <rect x="284" y="124" width="172" height="18" rx="3" fill="var(--bg)" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="290" y="136" fill="var(--primary)" font-size="8.5" font-family="monospace">{{authToken}}</text>
  <rect x="236" y="148" width="232" height="24" rx="3" fill="color-mix(in srgb, var(--primary) 8%, var(--bg))" stroke="var(--border)" stroke-width="0.5"/>
  <text x="244" y="160" fill="var(--text-muted)" font-size="7.5">ℹ</text>
  <text x="254" y="158" fill="var(--primary)" font-size="7.5" font-family="monospace">Authorization: Bearer lesson6-demo-jwt</text>
  <text x="254" y="167" fill="var(--text-muted)" font-size="7">Resolved from env variable</text>
  <text x="352" y="197" text-anchor="middle" fill="var(--primary)" font-size="8.5" font-weight="600">③ Auth bottom tab: Bearer + resolved preview</text>

  <!-- Metadata / request headers -->
  <rect x="476" y="70" width="216" height="180" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="476" y="70" width="216" height="22" rx="6" fill="var(--bg)"/>
  <rect x="476" y="82" width="216" height="10" fill="var(--bg)"/>
  <text x="490" y="83" fill="var(--text-muted)" font-size="8">Body</text>
  <text x="522" y="83" fill="var(--text-muted)" font-size="8">Headers</text>
  <rect x="546" y="70" width="60" height="22" rx="0" fill="color-mix(in srgb, var(--primary) 12%, var(--bg))" stroke="none"/>
  <text x="576" y="83" text-anchor="middle" fill="var(--primary)" font-size="8" font-weight="700">Metadata</text>
  <text x="484" y="104" fill="var(--text-muted)" font-size="7.5" font-weight="700">REQUEST HEADERS</text>
  <rect x="484" y="108" width="200" height="16" rx="2" fill="color-mix(in srgb, var(--primary) 8%, var(--bg))"/>
  <text x="488" y="119" fill="#34d399" font-size="7.5" font-family="monospace">Authorization: Bearer lesson6-demo-jwt</text>
  <rect x="484" y="126" width="200" height="16" rx="2" fill="color-mix(in srgb, #f59e0b 8%, var(--bg))"/>
  <text x="488" y="137" fill="#f59e0b" font-size="7.5" font-family="monospace">X-API-Key: lesson6-api-key-secret</text>
  <rect x="484" y="144" width="200" height="16" rx="2" fill="color-mix(in srgb, #a78bfa 8%, var(--bg))"/>
  <text x="488" y="155" fill="#a78bfa" font-size="7.5" font-family="monospace">Authorization: Basic ZGVtbzpkZW1vLXBhc3M=</text>
  <rect x="484" y="162" width="200" height="16" rx="2" fill="color-mix(in srgb, var(--primary) 8%, var(--bg))"/>
  <text x="488" y="173" fill="var(--primary)" font-size="7.5" font-family="monospace">Authorization: Bearer lesson6-demo-jwt</text>
  <text x="488" y="182" fill="var(--text-muted)" font-size="6.5" font-style="italic">  (from Inherit profile)</text>
  <text x="584" y="197" text-anchor="middle" fill="var(--text-muted)" font-size="8.5" font-weight="600">④⑤⑥: Metadata shows resolved value</text>

  <!-- Bottom flow -->
  <text x="350" y="218" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-weight="700" opacity="0.7">8-step lesson flow</text>

  <rect x="8" y="226" width="98" height="50" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="57" y="238" text-anchor="middle" fill="var(--text)" font-size="8.5" font-weight="600">① Intro</text>
  <text x="57" y="250" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">Auth badge overview</text>
  <text x="57" y="262" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">4 auth modes explained</text>

  <rect x="114" y="226" width="98" height="50" rx="5" fill="color-mix(in srgb, #34d399 8%, var(--surface))" stroke="#34d399" stroke-width="1.2"/>
  <text x="163" y="238" text-anchor="middle" fill="#34d399" font-size="8.5" font-weight="600">② Env Setup</text>
  <text x="163" y="250" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">authToken + apiKey</text>
  <text x="163" y="262" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">Set Active → resolved</text>

  <rect x="220" y="226" width="98" height="50" rx="5" fill="color-mix(in srgb, var(--primary) 8%, var(--surface))" stroke="var(--primary)" stroke-width="1.2"/>
  <text x="269" y="238" text-anchor="middle" fill="var(--primary)" font-size="8.5" font-weight="600">③ Bearer</text>
  <text x="269" y="250" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">{{authToken}} filled</text>
  <text x="269" y="262" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">Execute → verify header</text>

  <rect x="326" y="226" width="98" height="50" rx="5" fill="color-mix(in srgb, #f59e0b 8%, var(--surface))" stroke="#f59e0b" stroke-width="1.2"/>
  <text x="375" y="238" text-anchor="middle" fill="#f59e0b" font-size="8.5" font-weight="600">④ API Key</text>
  <text x="375" y="250" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">{{apiKey}} filled</text>
  <text x="375" y="262" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">Execute → verify header</text>

  <rect x="432" y="226" width="98" height="50" rx="5" fill="color-mix(in srgb, #a78bfa 8%, var(--surface))" stroke="#a78bfa" stroke-width="1.2"/>
  <text x="481" y="238" text-anchor="middle" fill="#a78bfa" font-size="8.5" font-weight="600">⑤ Basic Auth</text>
  <text x="481" y="250" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">user + pass filled</text>
  <text x="481" y="262" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">Execute → verify header</text>

  <rect x="538" y="226" width="154" height="50" rx="5" fill="color-mix(in srgb, #34d399 8%, var(--surface))" stroke="#34d399" stroke-width="1.2"/>
  <text x="615" y="238" text-anchor="middle" fill="#34d399" font-size="8.5" font-weight="600">⑥ Inherit + ⑦ Profile + ⑧ Sub</text>
  <text x="615" y="250" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">Global auth profile catalog</text>
  <text x="615" y="262" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">Save profile → sub auth</text>

  <line x1="106" y1="251" x2="114" y2="251" stroke="var(--border)" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="212" y1="251" x2="220" y2="251" stroke="var(--border)" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="318" y1="251" x2="326" y2="251" stroke="var(--border)" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="424" y1="251" x2="432" y2="251" stroke="var(--border)" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="530" y1="251" x2="538" y2="251" stroke="var(--border)" stroke-width="1.5" marker-end="url(#arr)"/>

  <rect x="8" y="284" width="684" height="30" rx="5" fill="color-mix(in srgb, #34d399 6%, var(--bg))" stroke="color-mix(in srgb, #34d399 30%, var(--border))" stroke-width="1"/>
  <text x="350" y="296" text-anchor="middle" fill="var(--text-muted)" font-size="8.5">
    <tspan font-weight="600" fill="#34d399">Key insight: </tspan>
    Auth fields store templates like {{authToken}} — Env stores real values — Metadata confirms resolved headers were sent
  </text>
  <text x="350" y="308" text-anchor="middle" fill="var(--text-muted)" font-size="8">
    Bearer and API Key use {{vars}} · Basic uses direct credentials · Inherit pulls from shared global profile catalog
  </text>

  <text x="350" y="336" text-anchor="middle" fill="var(--text-muted)" font-size="9" opacity="0.7">
    Each auth type shown exactly once · No repeated screens · Env activated before first execute
  </text>

  <text x="350" y="418" text-anchor="middle" fill="var(--text-muted)" font-size="9" opacity="0.75">Protocols → GraphQL → GQL-4 Authentication &amp; Headers</text>

  <defs>
    <marker id="arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
      <polygon points="0 0,5 2.5,0 5" fill="var(--border)"/>
    </marker>
  </defs>
</svg>`,
  },

  steps: [
    // ── Step 1: Overview + Demo env setup ────────────────────────────────────
    {
      id: 'gql6-intro',
      title: 'Auth on the Connection Bar',
      description:
        `Most GraphQL APIs require credentials — but **where** you put them matters. In GraphQL Studio, all auth lives on the **connection bar**, not buried in a settings page. Click the **🔒 Auth badge** to open the **Auth** bottom tab — a docked panel with four modes: **Bearer Token**, **API Key**, **Basic Auth**, and **Inherit from Auth Profile**. Notice the **Env badge** beside it — the lesson configures a **Demo** environment here with two variables (\`authToken\` and \`apiKey\`) so auth fields can use \`{{authToken}}\` placeholders instead of hardcoded secrets. Watch the modal open now so you can see the configured values before the auth steps begin.`,
      highlight: GQL.AUTH_BADGE_BTN,
      preAction: preIntroStep,
      action: async (ctx) => {
        // Create the Demo env in React state via the window bridge (reliable, no DOM fragility)
        await ensureEnvReady(ctx);
        // Open the Env modal so the viewer can read the configured variables
        if (!document.querySelector(GQL.ENV_MODAL)) {
          await ctx.click(GQL.ENV_BADGE);
          await ctx.waitFor(GQL.ENV_MODAL, 5000);
        }
        await ctx.delay(1200); // leave open so viewer can read authToken + apiKey rows
        // Leave modal open — step 2's preAction will close it
      },
      verify: GQL.ENV_MODAL,
      pauseAfter: true,
    },

    // ── Step 2: Set up environment variables ─────────────────────────────────
    {
      id: 'gql6-env',
      title: 'Environment Variables — Secrets Out of Config Files',
      description:
        `The **Demo** environment is now active with two variables: \`authToken\` = \`${LESSON6_AUTH_TOKEN_VALUE}\` and \`apiKey\` = \`${LESSON6_API_KEY_VALUE}\`. Auth fields accept \`{{variableName}}\` placeholders — the real value lives here, in Env. When you execute, GraphQL Studio resolves \`{{authToken}}\` to \`${LESSON6_AUTH_TOKEN_VALUE}\` before the request leaves the client. The Metadata tab will confirm this: you'll see the literal resolved value, not the template. **Why env variables first?** Secrets never appear in your query files or auth configs — swap environments without touching the auth setup.`,
      highlight: GQL.ENV_BADGE,
      preAction: preEnvStep,
      action: async (ctx) => {
        await ensureEnvReady(ctx); // idempotent guard
        // Re-open modal to show the configured env is active
        if (!document.querySelector(GQL.ENV_MODAL)) {
          await ctx.click(GQL.ENV_BADGE);
          await ctx.waitFor(GQL.ENV_MODAL, 5000);
        }
        await ctx.delay(800); // leave open so viewer can read the variables
      },
      verify: GQL.ENV_MODAL,
      pauseAfter: true,
    },

    // ── Step 3: Bearer Token — configure ─────────────────────────────────────
    {
      id: 'gql6-bearer-config',
      title: 'Bearer Token — Configure',
      description:
        `Open the **Auth** bottom tab with **Bearer Token** selected. Type \`${LESSON6_BEARER_TEMPLATE}\` in the token field — the preview footer resolves it to \`Authorization: Bearer ${LESSON6_AUTH_TOKEN_VALUE}\` before you execute. **Why Bearer first?** It is the most common GraphQL auth scheme; env placeholders keep the JWT out of saved configs.`,
      highlight: GQL.AUTH_BEARER_INPUT,
      preAction: prepareBearerConfigReading,
      action: async (ctx) => {
        await selectAuthInPanel(ctx, 'bearer');
        await ctx.fill(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
        await ctx.delay(700);
      },
      verify: GQL.AUTH_BEARER_INPUT,
      pauseAfter: true,
    },

    // ── Step 4: Bearer Token — execute & verify Metadata ───────────────────
    {
      id: 'gql6-bearer-observe',
      title: 'Bearer Token — Verify in Metadata',
      description:
        `Click **Execute**, then open **Metadata → Request headers**. You should see \`Authorization: Bearer ${LESSON6_AUTH_TOKEN_VALUE}\` — the literal resolved token, not \`{{authToken}}\`. **This is your ground truth for debugging** — if a server rejects auth, Metadata shows exactly what was transmitted.`,
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareBearerObserveReading,
      action: async (ctx) => {
        await runAuthExecuteWithMetadata(ctx);
        markBearerDone();
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },

    // ── Step 5: API Key — configure ───────────────────────────────────────────
    {
      id: 'gql6-apikey-config',
      title: 'API Key — Configure',
      description:
        `Switch the **Auth** bottom tab to **API Key**. Set header name \`${LESSON6_API_KEY_HEADER}\` and value \`${LESSON6_API_KEY_TEMPLATE}\`. **Same env-variable pattern, different header name** — some services prefer a custom header over the standard \`Authorization\` scheme.`,
      highlight: GQL.AUTH_APIKEY_VAL,
      preAction: prepareApiKeyConfigReading,
      action: async (ctx) => {
        await selectAuthInPanel(ctx, 'apiKey');
        await ctx.fill(GQL.AUTH_APIKEY_NAME, LESSON6_API_KEY_HEADER);
        await ctx.delay(500);
        await ctx.fill(GQL.AUTH_APIKEY_VAL, LESSON6_API_KEY_TEMPLATE);
        await ctx.delay(700);
      },
      verify: GQL.AUTH_APIKEY_VAL,
      pauseAfter: true,
    },

    // ── Step 6: API Key — execute & verify Metadata ─────────────────────────
    {
      id: 'gql6-apikey-observe',
      title: 'API Key — Verify in Metadata',
      description:
        `Execute again and read **Metadata → Request headers**. The row updates to \`${LESSON6_API_KEY_HEADER}: ${LESSON6_API_KEY_VALUE}\` — the \`{{apiKey}}\` env variable resolved at send time.`,
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareApiKeyObserveReading,
      action: async (ctx) => {
        await runAuthExecuteWithMetadata(ctx);
        markApiKeyDone();
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },

    // ── Step 7: Basic Auth — configure ────────────────────────────────────────
    {
      id: 'gql6-basic-config',
      title: 'Basic Auth — Configure',
      description:
        `Switch to **Basic Auth** and fill username \`${LESSON6_BASIC_USER}\` and password \`${LESSON6_BASIC_PASS}\` directly (not via env vars — the auth system base64-encodes them before building the header). base64 is *encoding*, not *encryption* — requires HTTPS (**GQL-5**) to be safe in transit.`,
      highlight: GQL.AUTH_BASIC_USER,
      preAction: prepareBasicConfigReading,
      action: async (ctx) => {
        await selectAuthInPanel(ctx, 'basic');
        await ctx.fill(GQL.AUTH_BASIC_USER, LESSON6_BASIC_USER);
        await ctx.delay(500);
        await ctx.fill(GQL.AUTH_BASIC_PASS, LESSON6_BASIC_PASS);
        await ctx.delay(700);
      },
      verify: GQL.AUTH_BASIC_PASS,
      pauseAfter: true,
    },

    // ── Step 8: Basic Auth — execute & verify Metadata ────────────────────────
    {
      id: 'gql6-basic-observe',
      title: 'Basic Auth — Verify in Metadata',
      description:
        `Execute and open **Metadata**. The header becomes \`Authorization: Basic ZGVtbzpkZW1vLXBhc3M=\` — base64 for \`${LESSON6_BASIC_USER}:${LESSON6_BASIC_PASS}\`. Compare this row to the Bearer and API Key rows you saw earlier.`,
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareBasicObserveReading,
      action: async (ctx) => {
        await runAuthExecuteWithMetadata(ctx);
        markBasicDone();
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },

    // ── Step 9: OAuth 2.0 ───────────────────────────────────────────────────
    {
      id: 'gql6-oauth',
      title: 'OAuth 2.0 — Client Credentials',
      description:
        `Switch to **OAuth 2.0 (Client Credentials)**. Fill token URL \`${LESSON6_OAUTH_TOKEN_URL}\`, client ID \`${LESSON6_OAUTH_CLIENT_ID}\`, and client secret \`${LESSON6_OAUTH_CLIENT_SECRET}\` (store the real secret in **Env**, same pattern as Bearer). The preview shows \`Authorization: Bearer <token from ${LESSON6_OAUTH_TOKEN_URL}>\` — GraphQL Studio fetches the access token at execute time. **Why OAuth here?** Service-to-service APIs often issue short-lived tokens instead of static API keys.`,
      highlight: GQL.AUTH_PREVIEW,
      preAction: preOauthStep,
      action: async (ctx) => {
        await selectAuthInPanel(ctx, 'oauth2');
        await ctx.fill(GQL.AUTH_OAUTH_TOKEN_URL, LESSON6_OAUTH_TOKEN_URL);
        await ctx.delay(500);
        await ctx.fill(GQL.AUTH_OAUTH_CLIENT_ID, LESSON6_OAUTH_CLIENT_ID);
        await ctx.delay(500);
        await ctx.fill(GQL.AUTH_OAUTH_CLIENT_SECRET, LESSON6_OAUTH_CLIENT_SECRET);
        await ctx.delay(1200);
        await closeAuthPanelIfOpen(ctx);
        markOauthDone();
      },
      verify: GQL.AUTH_PREVIEW,
      pauseAfter: true,
    },

    // ── Step 10: Inherit — configure ────────────────────────────────────────
    {
      id: 'gql6-inherit-config',
      title: 'Inherit from Auth Profile — Configure',
      description:
        `Select **Inherit from Auth Profile** and choose **${LESSON6_GLOBAL_AUTH_PROFILE_NAME}** from the catalog — the same option WebSocket and SSE studios use. **Why inherit?** Update the catalog profile once in Environment Manager and every studio that references it picks up the new credential automatically.`,
      highlight: GQL.AUTH_PROFILE_SELECT,
      preAction: prepareInheritConfigReading,
      action: async (ctx) => {
        await selectInheritGlobalProfileInPanel(ctx);
        await ctx.delay(700);
      },
      verify: GQL.AUTH_PROFILE_SELECT,
      pauseAfter: true,
    },

    // ── Step 11: Inherit — execute & verify Metadata ─────────────────────────
    {
      id: 'gql6-inherit-observe',
      title: 'Inherit — Verify in Metadata',
      description:
        `Execute and read **Metadata → Request headers**. You should see \`Authorization: Bearer ${LESSON6_AUTH_TOKEN_VALUE}\` sourced from the **shared catalog**, not from Env variables on this tab.`,
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareInheritObserveReading,
      action: async (ctx) => {
        await runAuthExecuteWithMetadata(ctx);
        markInheritDone();
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },

    // ── Step 12: Save connection profile ──────────────────────────────────────
    {
      id: 'gql6-profile',
      title: 'Save a Connection Profile',
      description:
        `Click **Profiles** on the connection bar → enter name **${LESSON6_PROFILE_NAME}** → **Save**. This **connection profile** captures the endpoint \`${GQL_DEMO_HTTP}\` plus the current auth mode (inherit) as a named snapshot — distinct from the **global auth profile** you selected in the previous step. **Why connection profiles?** When you switch between dev, staging, and prod — each with different URLs and auth modes — load the right connection profile in one click instead of re-entering everything.`,
      highlight: GQL.PROFILE_BADGE,
      preAction: preProfileStep,
      action: async (ctx) => {
        await ctx.click(GQL.PROFILE_BADGE);
        await ctx.waitFor(GQL.PROFILE_MODAL, 5000);
        await ctx.delay(600);
        await ctx.fill(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
        await ctx.delay(400);
        await ctx.click(GQL.PROFILE_SAVE_BTN);
        await ctx.delay(800);
        if (document.querySelector(GQL.PROFILE_MODAL)) {
          await ctx.click(GQL.PROFILE_CLOSE_BTN);
          await ctx.delay(700);
        }
        markProfileDone();
      },
      verify: GQL.PROFILE_BADGE,
      pauseAfter: true,
    },

    // ── Step 13: Subscription auth — execute ─────────────────────────────────
    {
      id: 'gql6-subscription-exec',
      title: 'Auth Carries into Subscriptions — Execute',
      description:
        'The **🔒 Auth badge** configures credentials for the **active tab**. With one tab open, edits set the **page-level default** — the same resolved auth is used for HTTP queries **and** for WebSocket subscription handshakes (**GQL-7**). Saving a connection profile may reset auth mode, so we re-bind **Inherit** before executing.',
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareSubscriptionExecReading,
      action: async (ctx) => {
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    // ── Step 14: Subscription auth — Metadata verify ─────────────────────────
    {
      id: 'gql6-subscription-observe',
      title: 'Subscription Auth — Verify Metadata Headers',
      description:
        'Open **Response → Metadata → Request headers**. The inherit profile auth still appears — you do **not** configure auth separately for subscriptions. When you open a second tab (**GQL-14**), each tab can override auth independently while sharing the same endpoint URL.',
      highlight: GQL.RV_REQUEST_HEADERS,
      preAction: prepareSubscriptionObserveReading,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(800);
        await ctx.click(GQL.RV_TAB_METADATA);
        await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },
  ],
};

