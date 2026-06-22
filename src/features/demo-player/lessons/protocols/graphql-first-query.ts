/** Lesson GQL-1: Your First GraphQL Query — endpoint, introspect, execute, history */
import type { DemoLesson } from '../../types';
import { EM, GQL, APP } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  GQL_DEMO_VAR,
  GQL_HEALTH_QUERY,
  fillActiveTabEndpoint,
  getEndpointInput,
  ensureDemoEndpoint,
  ensureExecuted,
  ensureHealthQuery,
  ensureIntrospected,
  fillGqlEditor,
  gqlFirstQueryCleanup,
  gqlFirstQuerySetup,
} from './graphql-lesson-helpers';
import {
  configureNamedGraphqlEndpoint,
  ensureDemoEnvironment,
  ensureDemoMicroservice,
  ensureGqlDemoEndpointConfigured,
  ensureGqlDemoProtocolReady,
  expandNamedMicroservice,
  GQL_DEMO_BASE_URL,
  GQL_DEMO_ENV_NAME,
  GQL_DEMO_GRAPHQL_PATH,
  GQL_DEMO_SVC_NAME,
  navigateToEnvironmentManager,
  navigateToGraphqlStudio,
  selectEnvInHeader,
  selectSvcInHeader,
} from '../env-manager-lesson-helpers';

export const gqlFirstQueryLesson: DemoLesson = {
  id: 'gql-first-query',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Your First GraphQL Query',
  description:
    'Connect to a GraphQL endpoint, introspect the schema, write a query, execute it, read the response body and metadata, and find the result in History.',
  estimatedMinutes: 7,
  initialTab: 'graphql-studio',
  allowedTabs: ['environments', 'graphql-studio'],
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlFirstQuerySetup,
  cleanup: gqlFirstQueryCleanup,

  concept: {
    title: 'GraphQL in RedfireForge',
    body: `**GraphQL Studio** is RedfireForge's dedicated workspace for working with GraphQL APIs. Unlike REST — where each resource lives at its own URL and you get all fields whether you need them or not — GraphQL exposes a **single endpoint** that accepts any operation you describe. You tell the server exactly which fields you want; it returns precisely those fields and nothing more.

**The five-step workflow:**
1. **Endpoint** — set the GraphQL HTTP URL (e.g. \`${GQL_DEMO_HTTP}\`) or use \`{{graphqlUrl}}\` to resolve it from the Environment Manager. The **↳ Resolved:** preview confirms the variable value before anything is sent.
2. **Introspect** — download the server's typed schema so the editor has full autocomplete and the Schema Explorer panel is populated. The green **✓ Schema** badge confirms success.
3. **Write** — compose a query in the Monaco editor (with autocomplete) or use the visual **Builder** to tick fields without typing.
4. **Execute** — send the request; the response arrives in milliseconds. Every GraphQL query is a plain **HTTP POST** — the JSON body travels inside a TLS tunnel just like any other API.
5. **Read & Save** — the Response panel shows status code, latency, and JSON body. Every execution is **auto-saved** to **History** so you can reload or re-run it at any time.

This lesson uses the local Docker test server on port **4010**. Start it with the command shown in the prerequisite gate before proceeding.`,
    keyTerms: [
      {
        term: 'Introspection',
        definition:
          'A built-in GraphQL query (`__schema`) that returns the server\'s entire type system — every type, field, argument, and directive. RedfireForge caches the result to power autocomplete, the Schema Explorer, and query validation.',
      },
      {
        term: 'Operation',
        definition:
          'A named or anonymous `query`, `mutation`, or `subscription` block sent to the server. This lesson uses a simple anonymous query. The operation type determines what the server is allowed to do.',
      },
      {
        term: 'Schema',
        definition:
          'The typed contract describing every query, mutation, and subscription the server accepts. Introspection downloads this contract; the Schema tab lets you browse and search it interactively.',
      },
      {
        term: 'History',
        definition:
          'An auto-populated log of every past execution. Each entry stores the full query text, variables, and response JSON so you can reload, re-run, or promote it to a saved Collection without retyping anything.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 430" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="gql1-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="gql1-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <linearGradient id="gql1-tab-active" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2d3a4d"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <filter id="gql1-shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- ══ STUDIO FRAME ════════════════════════════════════════════════════════ -->
  <rect x="1" y="1" width="698" height="278" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5" filter="url(#gql1-shadow)"/>

  <!-- title bar chrome -->
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc" font-family="system-ui,sans-serif">GraphQL Studio — RedfireForge</text>

  <!-- ══ CONNECTION BAR (y 31–70) ════════════════════════════════════════════ -->
  <rect x="1" y="31" width="698" height="39" fill="#0f172a"/>
  <line x1="1" y1="70" x2="698" y2="70" stroke="#3b4a60" stroke-width="1"/>

  <!-- Endpoint input (with {{graphqlUrl}}) + ① callout -->
  <rect x="10" y="38" width="375" height="24" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="20" y="54" font-family="'SF Mono','Fira Code',monospace" font-size="10.5" fill="#c084fc">{{</text>
  <text x="36" y="54" font-family="'SF Mono','Fira Code',monospace" font-size="10.5" fill="#f59e0b">graphqlUrl</text>
  <text x="100" y="54" font-family="'SF Mono','Fira Code',monospace" font-size="10.5" fill="#c084fc">}}</text>
  <circle cx="383" cy="38" r="9" fill="#3b82f6"/>
  <text x="383" y="42" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">①</text>

  <!-- Schema badge ✓ + ② callout -->
  <rect x="396" y="39" width="68" height="22" rx="11" fill="#052e16" stroke="#22c55e" stroke-width="1.2"/>
  <text x="430" y="54" text-anchor="middle" font-size="9.5" fill="#22c55e" font-family="system-ui,sans-serif">✓ Schema</text>
  <circle cx="461" cy="32" r="8" fill="#22c55e"/>
  <text x="461" y="36" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">②</text>

  <!-- Introspect button -->
  <rect x="470" y="39" width="82" height="22" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="511" y="54" text-anchor="middle" font-size="10" font-weight="500" fill="#3b82f6" font-family="system-ui,sans-serif">Introspect</text>

  <!-- Execute button + ④ callout -->
  <rect x="558" y="39" width="78" height="22" rx="4" fill="#3b82f6"/>
  <text x="597" y="54" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">▶ Execute</text>
  <circle cx="634" cy="32" r="8" fill="#3b82f6"/>
  <text x="634" y="36" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">④</text>

  <!-- ══ MODE TABS: Editor | Builder (y 70–96) ═══════════════════════════════ -->
  <rect x="1" y="70" width="698" height="26" fill="#0f172a"/>
  <rect x="8" y="73" width="64" height="20" rx="3" fill="url(#gql1-tab-active)" stroke="#3b4a60" stroke-width="1"/>
  <rect x="8" y="90" width="64" height="3" fill="#3b82f6"/>
  <text x="40" y="87" text-anchor="middle" font-size="10.5" font-weight="600" fill="#f1f5f9" font-family="system-ui,sans-serif">Editor</text>
  <text x="110" y="87" text-anchor="middle" font-size="10.5" fill="#a8b8cc" font-family="system-ui,sans-serif">Builder</text>

  <!-- ══ MAIN: editor pane (left) | right pane (right) ══════════════════════ -->
  <rect x="380" y="96" width="1" height="152" fill="#3b4a60"/>

  <!-- LEFT: Monaco editor (y 96–248) -->
  <rect x="1" y="96" width="379" height="152" fill="#0d1520"/>
  <!-- gutter -->
  <rect x="1" y="96" width="28" height="152" fill="#090f1a"/>
  <text x="15" y="113" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#3b4a60">1</text>
  <text x="15" y="128" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#3b4a60">2</text>
  <text x="15" y="143" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#3b4a60">3</text>
  <!-- query code + ③ callout -->
  <text x="38" y="113" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#c084fc">query</text>
  <text x="80" y="113" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f1f5f9"> {</text>
  <text x="50" y="128" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#22d3ee">  health</text>
  <text x="38" y="143" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f1f5f9">}</text>
  <rect x="90" y="132" width="1.5" height="12" fill="#f1f5f9" opacity="0.8"/>
  <circle cx="369" cy="105" r="9" fill="#3b82f6"/>
  <text x="369" y="109" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">③</text>

  <!-- RIGHT: right-pane tabs + response body (y 96–248) -->
  <rect x="381" y="96" width="318" height="152" fill="#0d1520"/>
  <rect x="381" y="96" width="318" height="26" fill="#0f172a"/>
  <!-- Response tab (active) -->
  <rect x="386" y="99" width="68" height="20" rx="3" fill="url(#gql1-tab-active)" stroke="#3b4a60" stroke-width="1"/>
  <rect x="386" y="117" width="68" height="2" fill="#3b82f6"/>
  <text x="420" y="113" text-anchor="middle" font-size="10" font-weight="600" fill="#f1f5f9" font-family="system-ui,sans-serif">Response</text>
  <text x="482" y="113" text-anchor="middle" font-size="10" fill="#a8b8cc" font-family="system-ui,sans-serif">Schema</text>
  <!-- response status bar -->
  <rect x="381" y="122" width="318" height="20" fill="#090f1a"/>
  <text x="391" y="135" font-size="9.5" fill="#22c55e" font-family="system-ui,sans-serif">200 OK</text>
  <text x="432" y="135" font-size="9" fill="#a8b8cc" font-family="system-ui,sans-serif">·</text>
  <text x="440" y="135" font-size="9.5" fill="#a8b8cc" font-family="system-ui,sans-serif">~12ms</text>
  <!-- ⑤ callout on the response pane -->
  <circle cx="690" cy="105" r="9" fill="#22c55e"/>
  <text x="690" y="109" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">⑤</text>
  <!-- response body JSON -->
  <text x="391" y="157" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#3b4a60">{</text>
  <text x="400" y="171" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#a8b8cc">  "data": {</text>
  <text x="410" y="185" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#a8b8cc">    "health":</text>
  <text x="482" y="185" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#4ade80"> "ok"</text>
  <text x="400" y="199" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#a8b8cc">  }</text>
  <text x="391" y="213" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#3b4a60">}</text>
  <!-- dashed highlight box around "ok" -->
  <rect x="480" y="176" width="36" height="14" rx="2" fill="none" stroke="#22c55e" stroke-width="1.2" stroke-dasharray="3,2" opacity="0.9"/>

  <!-- ══ BOTTOM PANEL (y 248–278) ═══════════════════════════════════════════ -->
  <line x1="1" y1="248" x2="698" y2="248" stroke="#3b4a60" stroke-width="1"/>
  <rect x="1" y="248" width="698" height="30" fill="#0f172a"/>
  <rect x="10" y="253" width="76" height="18" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="48" y="266" text-anchor="middle" font-size="10" fill="#a8b8cc" font-family="system-ui,sans-serif">Variables</text>
  <text x="100" y="266" text-anchor="middle" font-size="10" fill="#3b4a60" font-family="system-ui,sans-serif">Headers</text>

  <!-- ══ FLOW LEGEND (y 290–430) ════════════════════════════════════════════ -->
  <text x="230" y="305" text-anchor="middle" font-size="10" fill="#a8b8cc" letter-spacing="0.5" font-family="system-ui,sans-serif">THE 5-STEP GRAPHQL WORKFLOW</text>

  <!-- ① Endpoint -->
  <circle cx="50" cy="340" r="14" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="50" y="345" text-anchor="middle" font-size="11" font-weight="700" fill="#3b82f6" font-family="system-ui,sans-serif">①</text>
  <text x="50" y="363" text-anchor="middle" font-size="9.5" font-weight="600" fill="#f1f5f9" font-family="system-ui,sans-serif">Endpoint</text>
  <text x="50" y="375" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">Set URL /</text>
  <text x="50" y="386" text-anchor="middle" font-size="8.5" fill="#c084fc" font-family="'SF Mono','Fira Code',monospace">{{graphqlUrl}}</text>
  <line x1="65" y1="340" x2="109" y2="340" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql1-arr)"/>

  <!-- ② Introspect -->
  <circle cx="125" cy="340" r="14" fill="#052e16" stroke="#22c55e" stroke-width="1.5"/>
  <text x="125" y="345" text-anchor="middle" font-size="11" font-weight="700" fill="#22c55e" font-family="system-ui,sans-serif">②</text>
  <text x="125" y="363" text-anchor="middle" font-size="9.5" font-weight="600" fill="#f1f5f9" font-family="system-ui,sans-serif">Introspect</text>
  <text x="125" y="375" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">Download</text>
  <text x="125" y="386" text-anchor="middle" font-size="8.5" fill="#22c55e" font-family="system-ui,sans-serif">schema ✓</text>
  <line x1="140" y1="340" x2="184" y2="340" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql1-arr)"/>

  <!-- ③ Write -->
  <circle cx="200" cy="340" r="14" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="200" y="345" text-anchor="middle" font-size="11" font-weight="700" fill="#3b82f6" font-family="system-ui,sans-serif">③</text>
  <text x="200" y="363" text-anchor="middle" font-size="9.5" font-weight="600" fill="#f1f5f9" font-family="system-ui,sans-serif">Write</text>
  <text x="200" y="375" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">Query in</text>
  <text x="200" y="386" text-anchor="middle" font-size="8.5" fill="#22d3ee" font-family="'SF Mono','Fira Code',monospace">Monaco</text>
  <line x1="215" y1="340" x2="259" y2="340" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql1-arr)"/>

  <!-- ④ Execute -->
  <circle cx="275" cy="340" r="14" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="275" y="345" text-anchor="middle" font-size="11" font-weight="700" fill="#3b82f6" font-family="system-ui,sans-serif">④</text>
  <text x="275" y="363" text-anchor="middle" font-size="9.5" font-weight="600" fill="#f1f5f9" font-family="system-ui,sans-serif">Execute</text>
  <text x="275" y="375" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">HTTP POST</text>
  <text x="275" y="386" text-anchor="middle" font-size="8.5" fill="#3b82f6" font-family="system-ui,sans-serif">→ :4010</text>
  <line x1="290" y1="340" x2="334" y2="340" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql1-arr)"/>

  <!-- ⑤ Read -->
  <circle cx="350" cy="340" r="14" fill="#052e16" stroke="#22c55e" stroke-width="1.5"/>
  <text x="350" y="345" text-anchor="middle" font-size="11" font-weight="700" fill="#22c55e" font-family="system-ui,sans-serif">⑤</text>
  <text x="350" y="363" text-anchor="middle" font-size="9.5" font-weight="600" fill="#f1f5f9" font-family="system-ui,sans-serif">Read</text>
  <text x="350" y="375" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">Response +</text>
  <text x="350" y="386" text-anchor="middle" font-size="8.5" fill="#4ade80" font-family="'SF Mono','Fira Code',monospace">"health":"ok"</text>
  <!-- auto-save arrow to History -->
  <line x1="365" y1="340" x2="404" y2="340" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,2" marker-end="url(#gql1-arr)"/>

  <!-- History box -->
  <rect x="406" y="327" width="100" height="34" rx="5" fill="#1e293b" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="456" y="342" text-anchor="middle" font-size="10" font-weight="600" fill="#f1f5f9" font-family="system-ui,sans-serif">History</text>
  <text x="456" y="354" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">auto-saved ↗</text>

  <!-- GraphQL vs REST comparison callout -->
  <rect x="516" y="310" width="174" height="100" rx="6" fill="#111b28" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="603" y="328" text-anchor="middle" font-size="9.5" font-weight="700" fill="#3b82f6" font-family="system-ui,sans-serif">GraphQL vs REST</text>
  <line x1="525" y1="333" x2="682" y2="333" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="525" y="346" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">REST: GET /users   (all fields)</text>
  <text x="525" y="359" font-size="8.5" fill="#22c55e" font-family="system-ui,sans-serif">GQL: query { id name } (yours only)</text>
  <text x="525" y="375" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">REST: many endpoints, many RTTs</text>
  <text x="525" y="388" font-size="8.5" fill="#22c55e" font-family="system-ui,sans-serif">GQL: one endpoint, typed schema</text>
  <text x="525" y="401" font-size="8" fill="#3b82f6" font-family="system-ui,sans-serif">Always HTTP POST under the hood</text>

  <!-- caption -->
  <text x="350" y="422" text-anchor="middle" font-size="9" fill="#3b4a60" font-family="system-ui,sans-serif">Protocols → GraphQL → Your First GraphQL Query</text>
</svg>`,
  },

  steps: [
    // ── 1. Orientation ───────────────────────────────────────────
    {
      id: 'gql1-intro',
      title: 'GraphQL Studio',
      description:
        'Welcome to **GraphQL Studio**. Unlike REST — where every resource has its own URL — GraphQL uses a **single endpoint** for every operation. ' +
        'The **connection bar** at the top holds the endpoint field, the **Introspect** button, the **✓ Schema** badge, and the **Execute** button. ' +
        'The Monaco editor occupies the centre; the **Response** and **Schema** tabs are on the right. ' +
        'The **Variables** and **Headers** panels live in the bottom strip. Every query is also a plain **HTTP POST** — the Metadata tab lets you inspect those raw request headers.',
      highlight: GQL.CONNECTION_BAR,
      pauseAfter: true,
    },

    // ── 2. Add GraphQL protocol ──────────────────────────────────
    {
      id: 'gql1-add-protocol',
      title: 'Add GraphQL Protocol',
      description:
        `Open **Settings → Environments**, add an environment called **"${GQL_DEMO_ENV_NAME}"** and a microservice ` +
        `called **"${GQL_DEMO_SVC_NAME}"** — separate from your real configs. Expand the microservice — it starts with ` +
        `**no protocol tabs**. Click **+ Add protocol** and choose **GraphQL**. Only the **GraphQL** tab appears ` +
        `(HTTP is not added by default). Check the deploy box for **${GQL_DEMO_ENV_NAME}** so the environment is active on this service.`,
      highlight: EM.ADD_PROTOCOL_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureDemoEnvironment(ctx, GQL_DEMO_ENV_NAME);
        await ensureDemoMicroservice(ctx, GQL_DEMO_SVC_NAME);
        await navigateToEnvironmentManager(ctx);
        await expandNamedMicroservice(ctx, GQL_DEMO_SVC_NAME);
      },
      action: async (ctx) => {
        await ensureGqlDemoProtocolReady(ctx);
        await ctx.delay(800);
      },
    },

    // ── 3. Configure GraphQL endpoint ────────────────────────────
    {
      id: 'gql1-env-config',
      title: 'Configure GraphQL Endpoint',
      description:
        `On the **GraphQL** tab, click **Edit** on the **${GQL_DEMO_ENV_NAME}** row. Set the base URL to ` +
        `\`http://localhost:4010\` and the path to \`/graphql\`. Click **Save** — the status changes to **✓ set**. ` +
        `The derived-variables panel below shows \`{{graphqlUrl}}\` resolving to \`${GQL_DEMO_HTTP}\` for this microservice. ` +
        `Only the **GraphQL** tab is present — no HTTP tab.`,
      highlight: EM.PROTOCOL_TAB_GQL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureGqlDemoProtocolReady(ctx);
      },
      action: async (ctx) => {
        await configureNamedGraphqlEndpoint(
          ctx,
          GQL_DEMO_ENV_NAME,
          GQL_DEMO_BASE_URL,
          GQL_DEMO_GRAPHQL_PATH,
        );
        await ctx.waitFor(EM.DERIVED_VARS_GQL, 5000);
        await ctx.delay(1500);
      },
      verify: EM.DERIVED_VARS_GQL,
    },

    // ── 4. Header env/svc selection ─────────────────────────────
    {
      id: 'gql1-header-select',
      title: 'Select Environment & Service',
      description:
        `Endpoints live on a microservice, but **GraphQL Studio** resolves \`{{graphqlUrl}}\` from the **Environment** ` +
        `and **Service** dropdowns in the app header — not from the endpoint field alone. Choose **"${GQL_DEMO_ENV_NAME}"** ` +
        `for Environment and **"${GQL_DEMO_SVC_NAME}"** for Service. The protocol indicator beside them confirms the GraphQL ` +
        `address you just saved in the Environment Manager.`,
      highlight: APP.HEADER_SELECTORS,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Navigate to GraphQL Studio first — do not re-open Environment Manager when
        // the studio tab is simply not mounted yet (that made step 4 appear too early on EM).
        await navigateToGraphqlStudio(ctx);
        if (!document.querySelector(GQL.ENDPOINT_INPUT)) {
          await ensureGqlDemoEndpointConfigured(ctx);
          await navigateToGraphqlStudio(ctx);
        }
        await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
      },
      action: async (ctx) => {
        await selectEnvInHeader(ctx, GQL_DEMO_ENV_NAME);
        await ctx.delay(800);
        await selectSvcInHeader(ctx, GQL_DEMO_SVC_NAME);
        await ctx.delay(1500);
      },
    },

    // ── 5. Set endpoint variable ───────────────────────────────────
    {
      id: 'gql1-endpoint',
      title: 'Set the Endpoint Variable',
      description:
        `Type \`${GQL_DEMO_VAR}\` into the endpoint field instead of hardcoding \`${GQL_DEMO_HTTP}\`. ` +
        `RedfireForge resolves the variable from the **GraphQL** tab endpoint using the **${GQL_DEMO_ENV_NAME}** environment ` +
        `and **${GQL_DEMO_SVC_NAME}** service you selected. The next step shows the **↳ Resolved:** preview confirming the wiring.`,
      highlight: GQL.ENDPOINT_INPUT,
      preAction: async (ctx) => {
        await navigateToGraphqlStudio(ctx);
        await selectEnvInHeader(ctx, GQL_DEMO_ENV_NAME);
        await selectSvcInHeader(ctx, GQL_DEMO_SVC_NAME);
        await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
      },
      action: async (ctx) => {
        await fillActiveTabEndpoint(ctx, GQL_DEMO_VAR);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 6. Resolved endpoint preview ─────────────────────────────
    {
      id: 'gql1-endpoint-resolved',
      title: 'Confirm the Resolved URL',
      description:
        `Watch **↳ Resolved:** appear below the endpoint field — RedfireForge resolves \`{{graphqlUrl}}\` to ` +
        `\`${GQL_DEMO_HTTP}\` with a **✓** checkmark. This confirms the variable, environment, service, and GraphQL tab ` +
        `are all wired correctly before you introspect or execute. You can paste the literal URL directly, but using the variable ` +
        `means you never need to edit queries when the server address changes.`,
      highlight: GQL.ENDPOINT_PREVIEW,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGraphqlStudio(ctx);
        await selectEnvInHeader(ctx, GQL_DEMO_ENV_NAME);
        await selectSvcInHeader(ctx, GQL_DEMO_SVC_NAME);
        await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
        if (!(getEndpointInput()?.value ?? '').includes('graphqlUrl')) {
          await fillActiveTabEndpoint(ctx, GQL_DEMO_VAR);
        }
      },
      action: async (ctx) => {
        await ctx.waitFor(GQL.ENDPOINT_PREVIEW, 5000);
        await ctx.delay(1500);
      },
      verify: GQL.ENDPOINT_PREVIEW,
    },

    // ── 7. Introspect ────────────────────────────────────────────
    {
      id: 'gql1-introspect',
      title: 'Introspect the Schema',
      description:
        'Click **Introspect** to send the built-in `__schema` query to the server. ' +
        'This downloads the complete type system — every query, mutation, subscription, type, field, and argument the server exposes. ' +
        'RedfireForge caches this contract locally: autocomplete, the Schema Explorer, and inline validation all depend on it. ' +
        'Watch for the green **Schema loaded** badge in the connection bar, then the **Schema** tab on the right fills with the type list.',
      highlight: GQL.INTROSPECT_BTN,
      preAction: ensureDemoEndpoint,
      action: async (ctx) => {
        await ctx.click(GQL.INTROSPECT_BTN);
        await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
        await ctx.delay(800);
        await ctx.click(GQL.RIGHT_TAB_SCHEMA);
        await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
        await ctx.waitFor(GQL.SCHEMA_TYPE_LIST, 5000);
        await ctx.delay(1500);
      },
      verify: GQL.SCHEMA_BADGE_OK,
      pauseAfter: true,
    },

    // ── 5. Schema tab ────────────────────────────────────────────
    {
      id: 'gql1-schema',
      title: 'Explore the Schema',
      description:
        'Open the **Schema** tab on the right panel. The type tree is built from the introspection data you just downloaded. ' +
        'Expand **Query** to see every top-level field the server supports — including `health`, `user`, and `order`. ' +
        'Click any type to open its detail panel showing field names, argument types, and return types. ' +
        'For now just browse; **Lesson 4 (Schema Exploration)** goes deep into search, SDL export, and the Changelog tab.',
      highlight: GQL.RIGHT_TAB_SCHEMA,
      preAction: ensureIntrospected,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_SCHEMA);
        await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
        await ctx.waitFor(GQL.SCHEMA_TYPE_LIST, 5000);
        await ctx.delay(800);
      },
      verify: GQL.SCHEMA_TYPE_LIST,
      pauseAfter: true,
    },

    // ── 6. Write query ───────────────────────────────────────────
    {
      id: 'gql1-write-query',
      title: 'Write a Query',
      description:
        'Switch back to the **Response** tab on the right, then click **Editor** mode if it is not already active. ' +
        'Type the minimal query `query { health }` — the `query` keyword is the operation type, `{ health }` is the field selection set. ' +
        'Notice autocomplete suggesting `health` after you open the brace: this is powered by the introspected schema. ' +
        'The **Builder** mode (next to Editor) lets you tick fields visually without typing; try it in **Lesson 7 (Query Builder)**.',
      highlight: GQL.EDITOR,
      preAction: async (ctx) => {
        await ensureIntrospected(ctx);
        const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
        if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
          await ctx.click(GQL.MODE_EDITOR);
          await ctx.delay(200);
        }
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.click(GQL.MODE_EDITOR);
        await ctx.waitFor(`${GQL.EDITOR} .monaco-editor`, 8000);
        await ctx.delay(600);
        await fillGqlEditor(ctx, GQL_HEALTH_QUERY);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 7. Execute ───────────────────────────────────────────────
    {
      id: 'gql1-execute',
      title: 'Execute the Query',
      description:
        'Click **▶ Execute** (or press the keyboard shortcut shown in the tooltip). ' +
        'RedfireForge serialises the query as a JSON body, sends an **HTTP POST** to the endpoint, and streams the response back. ' +
        'While the request is in-flight the button changes to a **Cancel** spinner — useful for long-running queries. ' +
        'The response appears in the panel on the right — the next step examines it in detail.',
      highlight: GQL.EXECUTE_BTN,
      preAction: ensureHealthQuery,
      action: async (ctx) => {
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    // ── 8. Read response body (NEW — fixes spotlight mismatch from plan) ──────
    {
      id: 'gql1-read-response',
      title: 'Read the Response Body',
      description:
        'The **Response** panel shows three pieces of information in the status bar: **HTTP status** (200 OK), **latency** (~12ms), and **error count** (0 errors). ' +
        'Below the status bar the **JSON body** appears — you should see `"data": { "health": "ok" }`. ' +
        'GraphQL always returns `data` at the top level; field-level errors appear under a separate `errors` array and never cause a non-200 HTTP status. ' +
        'This is different from REST, where a 4xx/5xx status signals a problem. Watch for the latency badge — it reflects the full server round-trip time.',
      highlight: GQL.RESPONSE_BODY,
      preAction: ensureExecuted,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.waitFor(GQL.RESPONSE_BODY, 5000);
        await ctx.delay(1000);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },

    // ── 9. Metadata tab (NEW IDEA — GraphQL is just HTTP POST) ───
    {
      id: 'gql1-response-metadata',
      title: 'GraphQL is Just HTTP',
      description:
        'Click the **Metadata** tab in the Response panel. It reveals the raw HTTP request that was sent: **HTTP POST** method, `Content-Type: application/json`, and the serialised query body. ' +
        'This is a key insight: despite the schema, type system, and query language, every GraphQL operation travels over ordinary HTTP — no special protocol, no persistent connection (for queries and mutations). ' +
        'If your server requires an `Authorization` header or a custom `X-API-Key`, you add it in the **Headers** panel or the **Auth** popover — exactly as you would for any REST call. ' +
        '**Lesson 6 (Authentication & Headers)** covers this in detail.',
      highlight: GQL.RV_TAB_METADATA,
      preAction: ensureExecuted,
      action: async (ctx) => {
        await ctx.click(GQL.RV_TAB_METADATA);
        await ctx.waitFor(GQL.RV_METADATA, 5000);
        await ctx.delay(1200);
      },
      verify: GQL.RV_METADATA,
      pauseAfter: true,
    },

    // ── 10. History ──────────────────────────────────────────────
    {
      id: 'gql1-history',
      title: 'History Auto-Save',
      description:
        'Every successful execution is **automatically saved** to History — no manual action needed. ' +
        'Click the **History** icon in the left activity bar. Your `health` query appears with a timestamp, the endpoint, and the HTTP status. ' +
        'Single-click an entry to open the **preview panel** on the right: it shows the full query text, variables, and response body. ' +
        'From the preview you can **Load** the query back into the editor, **Run** it immediately, or **Save to Collection** to pin it permanently. ' +
        '**Lesson 8 (Collections & History)** goes deep into search, filters, and the full collection workflow.',
      highlight: GQL.ACTIVITY_HISTORY,
      preAction: ensureExecuted,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(300);
        await ctx.click(GQL.ACTIVITY_HISTORY);
        await ctx.waitFor(GQL.HISTORY_PANEL, 5000);
        await ctx.waitFor(GQL.HISTORY_ENTRY, 5000);
        await ctx.delay(700);
      },
      verify: GQL.HISTORY_ENTRY,
      pauseAfter: true,
    },
  ],
};
