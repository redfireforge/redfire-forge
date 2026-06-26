/** Lesson GQL-13: Mock Server */
import type { DemoLesson } from '../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_STUDIO_LESSON_ALLOWED_TABS,
  GQL_DEMO_HTTP,
  GQL_MOCK_HTTP,
  LESSON13_HEALTH_OVERRIDE,
  LESSON13_MOCK_HEALTH_FIXED,
  LESSON13_MOCK_HEALTH_RESOLVER,
  prepareLesson13MockFixedValueSpotlight,
  prepareLesson13MockHealthSpotlight,
  prepareLesson13MockLatencySpotlight,
  prepareLesson13MockResolversListSpotlight,
  prepareLesson13MockResponseSpotlight,
  prepareLesson13MockSchemaSourceSpotlight,
  prepareLesson13MockToggleSpotlight,
  prepareLesson13ReadLiveSpotlight,
  ensureLesson13FixedValueSet,
  ensureLesson13LatencyExecute,
  ensureLesson13LatencySliderOnly,
  ensureLesson13LiveEndpointOnly,
  ensureLesson13MockDisabledOnly,
  ensureLesson13MockEnabled,
  ensureLesson13MockEndpointSet,
  ensureLesson13MockExecuted,
  ensureLesson13MockIntrospectOnly,
  ensureLesson13MockPanelOpen,
  ensureLesson13ResolverFixedSelect,
  gqlMockServerLessonCleanup,
  gqlMockServerLessonSetup,
} from './graphql-lesson-helpers';

export const gqlMockServerLesson: DemoLesson = {
  id: 'gql-mock-server',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Mock Server',
  description:
    'Enable the desktop GraphQL mock proxy, override `Query.health`, simulate latency, and restore the live Docker endpoint.',
  estimatedMinutes: 8,
  initialTab: 'graphql-studio',
  allowedTabs: GQL_STUDIO_LESSON_ALLOWED_TABS,
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker · 🖥 Desktop',
  desktopOnly: true,

  setup: gqlMockServerLessonSetup,
  cleanup: gqlMockServerLessonCleanup,

  concept: {
    title: 'Mock Server — Test Without a Live Backend',
    body: `GraphQL Studio's desktop Mock Server runs a local GraphQL proxy inside the Tauri process (port **3001**). It intercepts your queries, validates them against the introspected schema, and returns responses from your configured resolver rules — with no live backend required.

**Why a local mock proxy instead of a shared test server?**
Shared test servers are flaky — they get reset by other developers, have inconsistent data, and can't be configured per-developer. A local proxy is deterministic: only your changes affect it, it starts in milliseconds, and it never goes down because of someone else's deploy. Frontend engineers can start building and testing UI flows against a stable API contract hours or days before the backend is ready.

**Why you must introspect a live server first?**
The mock proxy doesn't invent schema types — it needs the contract (type names, field names, argument signatures) before it can validate requests and generate responses. The introspection runs once against the live Docker server; after that you can disconnect from Docker entirely and work only through the mock. The schema is stored in-process and reused until you re-introspect.

**Why resolver types matter — Random / Fixed / Script / Error?**
- **Random** — zero configuration; the proxy generates a random value of the correct scalar type on every request. Good for rapid UI scaffolding where the exact value doesn't matter.
- **Fixed** — deterministic; the proxy always returns the same JSON value. Essential for writing assertions or testing UI state tied to a specific value (e.g. "show a warning when \`health\` returns \`"degraded"\`").
- **Error** — the resolver throws a GraphQL error. Use this to test error boundaries, retry logic, and user-facing error messages without modifying the real server.
- **Script** — a JS expression that runs for every request. Enables conditional logic, incrementing counters, or reading request variables to build dynamic responses.

**Why latency simulation is non-negotiable?**
Development environments are fast; production is not. A query that returns in 5 ms locally might take 800 ms in production — and your loading spinner, skeleton screen, or debounce logic was never tested at that speed. The latency slider adds a global artificial delay so you can verify that your UI handles slow responses gracefully before users encounter them.

**Why the mock is desktop-only?**
The proxy binds a real TCP socket on \`localhost:3001\`. Browsers cannot open listening TCP sockets due to security sandboxing — that is a capability only native processes have. The Tauri desktop app owns the socket; the embedded WebView makes standard HTTP requests to it just like any other GraphQL endpoint.`,
    keyTerms: [
      {
        term: 'Mock mode',
        definition:
          'Desktop proxy mode that serves GraphQL responses from your configured SDL + resolver overrides instead of forwarding to a live upstream. Activated via the Mock activity panel toggle.',
      },
      {
        term: 'Resolver override',
        definition:
          'Per-field behavior rule: Random (auto-generated scalar), Fixed (deterministic JSON value), Error (throws a GraphQL error), or Script (JS expression evaluated per request). This lesson sets `Query.health` to Fixed → `"mock-ok"`.',
      },
      {
        term: 'Schema source',
        definition:
          'The SDL the mock server uses to validate incoming operations and generate type-conformant responses. Defaults to the latest introspected schema from the live server. Can be overridden with a custom SDL in the mock panel.',
      },
      {
        term: 'Latency simulation',
        definition:
          'Global artificial delay (0–5000 ms) added by the proxy before returning a response. Lets you test loading states, skeleton screens, and debounce logic against realistic production-like timing.',
      },
      {
        term: 'Mock endpoint',
        definition:
          `The local URL \`${GQL_MOCK_HTTP}\` served by the Tauri process. Point the Studio connection bar here to execute queries against the mock proxy instead of the live server.`,
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <defs>
    <marker id="gql13-arr" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto">
      <path d="M1,1 L4,2.5 L1,4 Z" fill="#3b82f6"/>
    </marker>
  </defs>

  <!-- Window chrome -->
  <rect x="0" y="0" width="700" height="430" rx="10" fill="#0f172a" stroke="#3b4a60" stroke-width="1.5"/>
  <rect x="0" y="0" width="700" height="32" rx="10" fill="#1e293b"/>
  <rect x="0" y="22" width="700" height="10" fill="#1e293b"/>
  <circle cx="18" cy="16" r="5" fill="#ff5f57"/>
  <circle cx="34" cy="16" r="5" fill="#febc2e"/>
  <circle cx="50" cy="16" r="5" fill="#28c840"/>
  <text x="350" y="21" text-anchor="middle" fill="#a8b8cc" font-size="11" font-weight="500">GraphQL Studio — Mock Server</text>

  <!-- Connection bar -->
  <rect x="8" y="38" width="684" height="30" rx="5" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <circle cx="18" cy="53" r="3" fill="#28c840"/>
  <rect x="26" y="42" width="248" height="22" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="34" y="57" fill="#3b82f6" font-size="8.5" font-family="monospace" font-weight="600">localhost:3001/api/graphql/mock</text>
  <rect x="282" y="42" width="68" height="22" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="316" y="57" text-anchor="middle" fill="#a8b8cc" font-size="8.5">⟳ Introspect</text>
  <rect x="358" y="42" width="68" height="22" rx="3" fill="#3b82f6"/>
  <text x="392" y="57" text-anchor="middle" fill="white" font-size="9" font-weight="700">▶ Execute</text>
  <rect x="434" y="42" width="92" height="22" rx="3" fill="color-mix(in srgb, #28c840 14%, #1e293b)" stroke="#28c840" stroke-width="1"/>
  <text x="480" y="57" text-anchor="middle" fill="#28c840" font-size="8.5" font-weight="600">✓ Schema loaded (9)</text>

  <!-- Studio activity bar -->
  <rect x="0" y="72" width="34" height="318" fill="#1e293b" stroke="#3b4a60" stroke-width="0.5"/>
  <rect x="4" y="82" width="26" height="26" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="0.5"/>
  <circle cx="17" cy="95" r="6" fill="none" stroke="#a8b8cc" stroke-width="1.2" opacity="0.45"/>
  <polyline points="17,92 17,95 19,97" fill="none" stroke="#a8b8cc" stroke-width="1.2" opacity="0.45"/>
  <rect x="4" y="114" width="26" height="26" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="0.5"/>
  <line x1="8" y1="122" x2="26" y2="122" stroke="#a8b8cc" stroke-width="1.2" opacity="0.35"/>
  <line x1="8" y1="127" x2="26" y2="127" stroke="#a8b8cc" stroke-width="1.2" opacity="0.35"/>
  <line x1="8" y1="132" x2="26" y2="132" stroke="#a8b8cc" stroke-width="1.2" opacity="0.35"/>
  <rect x="4" y="146" width="26" height="26" rx="4" fill="color-mix(in srgb, #3b82f6 14%, #1e293b)" stroke="#3b82f6" stroke-width="1.2"/>
  <rect x="9" y="151" width="16" height="11" rx="1.5" fill="none" stroke="#3b82f6" stroke-width="1.2"/>
  <line x1="13" y1="167" x2="21" y2="167" stroke="#3b82f6" stroke-width="1.2"/>
  <line x1="17" y1="162" x2="17" y2="167" stroke="#3b82f6" stroke-width="1.2"/>

  <!-- Mock panel -->
  <rect x="34" y="72" width="228" height="318" fill="#0f172a" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="46" y="90" font-size="10" font-weight="700" fill="#f1f5f9">Mock server</text>
  <text x="46" y="102" font-size="7.5" fill="#a8b8cc">In-process GraphQL proxy for offline testing</text>

  <!-- Toggle card (ON) -->
  <rect x="42" y="110" width="212" height="34" rx="7" fill="color-mix(in srgb, #3b82f6 8%, #0f172a)" stroke="color-mix(in srgb, #3b82f6 45%, #3b4a60)" stroke-width="1"/>
  <rect x="52" y="121" width="34" height="18" rx="9" fill="#3b82f6"/>
  <circle cx="68" cy="130" r="6" fill="#0f172a"/>
  <text x="94" y="131" font-size="8.5" font-weight="600" fill="#f1f5f9">Mock mode ON</text>

  <!-- Status row -->
  <rect x="46" y="150" width="58" height="14" rx="7" fill="color-mix(in srgb, #a6e3a1 16%, #1e293b)" stroke="color-mix(in srgb, #a6e3a1 35%, #3b4a60)" stroke-width="0.8"/>
  <text x="75" y="160" text-anchor="middle" font-size="7" fill="#a6e3a1" font-weight="600">Mock active</text>
  <rect x="108" y="150" width="52" height="14" rx="7" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="134" y="160" text-anchor="middle" font-size="7" fill="#a8b8cc">1 override</text>
  <rect x="164" y="150" width="38" height="14" rx="7" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="183" y="160" text-anchor="middle" font-size="7" fill="#a8b8cc">650ms</text>

  <!-- Schema source card -->
  <rect x="42" y="170" width="212" height="72" rx="7" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="50" y="184" font-size="7" fill="#a8b8cc" font-weight="600" letter-spacing="0.4">SCHEMA SOURCE</text>
  <rect x="50" y="190" width="196" height="22" rx="5" fill="color-mix(in srgb, #3b82f6 8%, #0f172a)" stroke="#3b82f6" stroke-width="1"/>
  <text x="58" y="200" font-size="7.5" font-weight="600" fill="#f1f5f9">Introspected schema</text>
  <text x="58" y="209" font-size="6.5" fill="#a8b8cc">Reuse SDL from the last introspection</text>
  <rect x="50" y="216" width="196" height="20" rx="5" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="58" y="229" font-size="7.5" fill="#a8b8cc">Custom SDL</text>

  <!-- Response timing card -->
  <rect x="42" y="248" width="212" height="58" rx="7" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="50" y="262" font-size="7" fill="#a8b8cc" font-weight="600" letter-spacing="0.4">RESPONSE TIMING</text>
  <!-- Latency row (two-tone) -->
  <rect x="50" y="268" width="52" height="16" rx="3" fill="#0f172a"/>
  <text x="54" y="279" font-size="7" fill="#a8b8cc">Latency</text>
  <rect x="102" y="268" width="144" height="16" rx="3" fill="#1e293b"/>
  <rect x="108" y="274" width="88" height="3" rx="1.5" fill="#3b4a60"/>
  <rect x="108" y="274" width="28" height="3" rx="1.5" fill="#3b82f6"/>
  <circle cx="136" cy="275.5" r="4.5" fill="#3b82f6" stroke="#1e293b" stroke-width="1.5"/>
  <text x="232" y="279" text-anchor="end" font-size="7" fill="#3b82f6" font-weight="700">650 ms</text>
  <!-- Jitter row -->
  <rect x="50" y="286" width="52" height="16" rx="3" fill="#0f172a"/>
  <text x="54" y="297" font-size="7" fill="#a8b8cc">Jitter</text>
  <rect x="102" y="286" width="144" height="16" rx="3" fill="#1e293b"/>
  <rect x="108" y="290" width="18" height="8" rx="2" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="112" y="297" font-size="6.5" fill="#a8b8cc">0</text>
  <text x="132" y="297" font-size="6.5" fill="#a8b8cc">± ms around latency</text>

  <!-- Panel tabs -->
  <rect x="42" y="312" width="212" height="20" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <rect x="44" y="314" width="52" height="16" rx="3" fill="color-mix(in srgb, #3b82f6 12%, #0f172a)"/>
  <text x="70" y="325" text-anchor="middle" font-size="7" fill="#3b82f6" font-weight="600">Resolvers</text>
  <text x="118" y="325" text-anchor="middle" font-size="7" fill="#a8b8cc">Scenarios</text>
  <text x="162" y="325" text-anchor="middle" font-size="7" fill="#a8b8cc">Scalars</text>
  <text x="214" y="325" text-anchor="middle" font-size="7" fill="#a8b8cc">Request log</text>

  <!-- Resolver tree -->
  <rect x="42" y="336" width="212" height="18" rx="3" fill="color-mix(in srgb, #3b82f6 5%, #0f172a)"/>
  <text x="50" y="348" font-size="7.5" font-weight="600" fill="#f1f5f9">▾ Query</text>
  <text x="228" y="348" text-anchor="end" font-size="6.5" fill="#3b82f6">1</text>
  <rect x="42" y="354" width="212" height="24" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="54" y="368" font-size="7.5" fill="#f1f5f9" font-family="monospace">health</text>
  <text x="92" y="368" font-size="6.5" fill="#a8b8cc" font-family="monospace">String</text>
  <rect x="128" y="360" width="38" height="12" rx="2" fill="color-mix(in srgb, #28c840 10%, #1e293b)" stroke="#28c840" stroke-width="0.8"/>
  <text x="147" y="369" text-anchor="middle" font-size="6.5" fill="#28c840" font-weight="600">Fixed</text>
  <rect x="170" y="360" width="76" height="12" rx="2" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="176" y="369" font-size="6.5" fill="#3b82f6" font-family="monospace">"mock-ok"</text>

  <!-- Editor pane -->
  <rect x="262" y="72" width="196" height="318" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <rect x="262" y="72" width="196" height="22" fill="#0f172a" stroke="#3b4a60" stroke-width="0.5"/>
  <rect x="268" y="76" width="44" height="14" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="290" y="86" text-anchor="middle" font-size="7.5" fill="#f1f5f9" font-weight="600">Editor</text>
  <text x="332" y="86" font-size="7.5" fill="#a8b8cc">Builder</text>
  <rect x="262" y="94" width="196" height="296" fill="#0f172a"/>
  <text x="272" y="112" fill="#a8b8cc" font-size="8" opacity="0.45">1</text>
  <text x="286" y="112" fill="#a78bfa" font-size="9" font-family="monospace">query</text>
  <text x="322" y="112" fill="#f1f5f9" font-size="9" font-family="monospace"> {</text>
  <text x="272" y="128" fill="#a8b8cc" font-size="8" opacity="0.45">2</text>
  <text x="294" y="128" fill="#34d399" font-size="9" font-family="monospace">  health</text>
  <text x="272" y="144" fill="#a8b8cc" font-size="8" opacity="0.45">3</text>
  <text x="286" y="144" fill="#f1f5f9" font-size="9" font-family="monospace">}</text>

  <!-- Response pane -->
  <rect x="458" y="72" width="234" height="318" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <rect x="458" y="72" width="234" height="22" fill="#0f172a" stroke="#3b4a60" stroke-width="0.5"/>
  <rect x="464" y="76" width="54" height="14" rx="3" fill="color-mix(in srgb, #3b82f6 12%, #0f172a)"/>
  <text x="491" y="86" text-anchor="middle" font-size="7.5" fill="#3b82f6" font-weight="600">Response</text>
  <text x="536" y="86" font-size="7.5" fill="#a8b8cc">Schema</text>
  <rect x="458" y="94" width="234" height="296" fill="#0f172a"/>
  <rect x="466" y="100" width="28" height="12" rx="2" fill="color-mix(in srgb, #28c840 14%, #1e293b)" stroke="#28c840" stroke-width="0.6"/>
  <text x="480" y="109" text-anchor="middle" font-size="6.5" fill="#28c840" font-weight="600">200 OK</text>
  <rect x="500" y="100" width="42" height="12" rx="2" fill="color-mix(in srgb, #3b82f6 12%, #1e293b)" stroke="#3b82f6" stroke-width="0.6"/>
  <text x="521" y="109" text-anchor="middle" font-size="6.5" fill="#3b82f6" font-weight="600">650 ms</text>
  <text x="470" y="128" fill="#f1f5f9" font-size="8.5" font-family="monospace">{</text>
  <text x="478" y="142" fill="#a8b8cc" font-size="8.5" font-family="monospace">  "data": {</text>
  <text x="486" y="156" fill="#a8b8cc" font-size="8.5" font-family="monospace">    "health":</text>
  <text x="548" y="156" fill="#3b82f6" font-size="8.5" font-family="monospace"> "mock-ok"</text>
  <text x="478" y="170" fill="#a8b8cc" font-size="8.5" font-family="monospace">  }</text>
  <text x="470" y="184" fill="#f1f5f9" font-size="8.5" font-family="monospace">}</text>
  <rect x="536" y="148" width="118" height="16" rx="3" fill="#1a2740" stroke="#3b82f6" stroke-width="0.8"/>
  <text x="595" y="159" text-anchor="middle" font-size="7" fill="#3b82f6" font-weight="600">← Fixed resolver value</text>

  <!-- Bottom workflow legend -->
  <line x1="0" y1="396" x2="700" y2="396" stroke="#3b4a60" stroke-width="1"/>
  <rect x="0" y="396" width="700" height="34" fill="#0f172a"/>
  <text x="38" y="412" text-anchor="middle" font-size="8" font-weight="600" fill="#f1f5f9">Enable</text>
  <text x="38" y="422" text-anchor="middle" font-size="7" fill="#a8b8cc">mock on</text>
  <line x1="66" y1="414" x2="90" y2="414" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql13-arr)"/>
  <text x="126" y="412" text-anchor="middle" font-size="8" font-weight="600" fill="#f1f5f9">Introspect</text>
  <text x="126" y="422" text-anchor="middle" font-size="7" fill="#a8b8cc">schema source</text>
  <line x1="160" y1="414" x2="184" y2="414" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql13-arr)"/>
  <text x="224" y="412" text-anchor="middle" font-size="8" font-weight="600" fill="#f1f5f9">Override</text>
  <text x="224" y="422" text-anchor="middle" font-size="7" fill="#a8b8cc">resolver → Fixed</text>
  <line x1="258" y1="414" x2="284" y2="414" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql13-arr)"/>
  <text x="322" y="412" text-anchor="middle" font-size="8" font-weight="600" fill="#f1f5f9">Execute</text>
  <text x="322" y="422" text-anchor="middle" font-size="7" fill="#3b82f6">"mock-ok"</text>
  <line x1="352" y1="414" x2="376" y2="414" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql13-arr)"/>
  <text x="418" y="412" text-anchor="middle" font-size="8" font-weight="600" fill="#3b82f6">+ 650 ms</text>
  <text x="418" y="422" text-anchor="middle" font-size="7" fill="#a8b8cc">Response timing</text>
  <line x1="448" y1="414" x2="474" y2="414" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql13-arr)"/>
  <text x="520" y="412" text-anchor="middle" font-size="8" font-weight="600" fill="#28c840">Restore</text>
  <text x="520" y="422" text-anchor="middle" font-size="7" fill="#a8b8cc">live :4010</text>
  <line x1="554" y1="414" x2="578" y2="414" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql13-arr)"/>
  <text x="624" y="412" text-anchor="middle" font-size="8" font-weight="600" fill="#28c840">Verify</text>
  <text x="624" y="422" text-anchor="middle" font-size="7" fill="#a8b8cc">"ok" returns</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Open Mock Panel ─────────────────────────────────────────────
    {
      id: 'gql13-open-mock',
      title: 'Open the Mock Panel',
      description:
        'Click the **⬡ Mock** icon in the left activity bar. In the desktop app this opens the GraphQL mock proxy controls; in the web build you will see a "desktop-only" guard banner instead.\n\n' +
        '**Why does Mock have its own activity panel?** The mock proxy has a fundamentally different workflow from executing queries — you configure resolver rules, set latency, choose a schema source. Placing it in a dedicated activity panel keeps the main editor clean and makes the mock lifecycle explicit: you always know whether you are in mock mode or talking to a real server.',
      highlight: GQL.ACTIVITY_MOCK,
      preAction: async (ctx) => {
        await ctx.waitFor(GQL.ACTIVITY_MOCK, 5000);
      },
      action: async (ctx) => {
        await ensureLesson13MockPanelOpen(ctx);
      },
      verify: `${GQL.MOCK_PANEL}, ${GQL.MOCK_GUARD}`,
      pauseAfter: true,
    },

    // ── Step 2: Enable Mock Mode ────────────────────────────────────────────
    {
      id: 'gql13-enable-mock',
      title: 'Enable Mock Mode',
      description:
        'Toggle **Mock mode ON**. The mock proxy binds port **3001** and starts listening. A **Mock active** badge appears below the toggle.\n\n' +
        '**Why a toggle instead of just switching endpoints?** The toggle is the source of truth — it controls whether the proxy process is running. Without it, switching the endpoint URL would just point to a port with nothing listening. The toggle lets you enable/disable the mock without touching your endpoint input, so you can compare mock vs. live responses by toggling alone.',
      highlight: GQL.MOCK_TOGGLE_CARD,
      preAction: ensureLesson13MockPanelOpen,
      action: async (ctx) => {
        await ensureLesson13MockEnabled(ctx);
      },
      verify: `${GQL.MOCK_STATUS_ROW}, ${GQL.MOCK_GUARD}`,
      pauseAfter: true,
    },

    // ── Step 3: Review Schema Source [NEW] ─────────────────────────────────
    {
      id: 'gql13-schema-source',
      title: 'Review the Schema Source',
      description:
        'Notice the **Schema source** row showing **Introspected SDL**. This tells you the mock is using the schema it fetched from the live Docker server during setup — the same types, fields, and argument signatures.\n\n' +
        '**Why does the mock need a schema source?** The proxy validates every incoming operation against the schema before responding. Without a schema it could not catch a query that references a non-existent field, generate a type-conformant random value, or know which resolver override applies. The "Introspected SDL" source means you can swap the live server out entirely and the mock will faithfully enforce the same contract.',
      highlight: GQL.MOCK_SCHEMA_SOURCE,
      preAction: prepareLesson13MockSchemaSourceSpotlight,
      action: async (ctx) => {
        await ctx.delay(900);
      },
      verify: `${GQL.MOCK_PANEL}, ${GQL.MOCK_GUARD}`,
      pauseAfter: true,
    },

    // ── Step 4: Point Editor at Mock URL ───────────────────────────────────
    {
      id: 'gql13-mock-endpoint',
      title: 'Point the Editor at the Mock URL',
      description:
        `Type \`${GQL_MOCK_HTTP}\` into the connection bar. The spotlight stays on the **endpoint field** so you can see the URL change — this is the address every Execute will target while mock mode is on.\n\n` +
        '**Why change the endpoint even though the mock is ON?** The mock proxy is a real HTTP server. The Studio editor is just a client — it sends requests to whatever URL is in the connection bar. Pointing it at the mock URL routes all your queries through the proxy. Introspection comes in the **next step** so you can watch each change land one at a time.',
      highlight: GQL.ENDPOINT_INPUT,
      preAction: ensureLesson13MockEnabled,
      action: async (ctx) => {
        await ensureLesson13MockEndpointSet(ctx);
      },
      verify: GQL.ENDPOINT_INPUT,
      pauseAfter: true,
    },

    // ── Step 5: Introspect the Mock Endpoint ───────────────────────────────
    {
      id: 'gql13-mock-introspect',
      title: 'Introspect the Mock Endpoint',
      description:
        'Click **Introspect** so the Studio loads schema metadata from the mock proxy. Watch for the green schema badge — that confirms the mock is reachable and contract-aware.\n\n' +
        '**Why introspect after changing the URL?** The mock validates operations against a schema. Introspection fetches that contract from the proxy itself (not Docker) so schema browsing and resolver overrides stay in sync with mock traffic.',
      highlight: GQL.INTROSPECT_BTN,
      preAction: ensureLesson13MockEndpointSet,
      action: async (ctx) => {
        await ensureLesson13MockIntrospectOnly(ctx);
      },
      verify: GQL.SCHEMA_BADGE_OK,
      pauseAfter: true,
    },

    // ── Step 6: Choose Fixed Resolver ────────────────────────────────────
    {
      id: 'gql13-resolver-fixed',
      title: 'Set Query.health to Fixed',
      description:
        'In the **Resolvers** section, expand **Query** and change the `health` field from **Random** to **Fixed**. The spotlight stays on the **resolver dropdown** on that row — not the whole list.\n\n' +
        '**Why split resolver type from the value?** Picking **Fixed** reveals the value input. Showing the dropdown first lets you see the mode change before typing anything.',
      highlight: LESSON13_MOCK_HEALTH_RESOLVER,
      preAction: prepareLesson13MockHealthSpotlight,
      action: async (ctx) => {
        await ensureLesson13ResolverFixedSelect(ctx);
      },
      verify: LESSON13_MOCK_HEALTH_FIXED,
      pauseAfter: true,
    },

    // ── Step 7: Enter Fixed Value ────────────────────────────────────────
    {
      id: 'gql13-fixed-value',
      title: 'Enter the Fixed Value',
      description:
        `Type \`"${LESSON13_HEALTH_OVERRIDE}"\` into the **Fixed value** input that appeared for \`health\`. The spotlight follows the text field so you can read the sentinel value clearly.\n\n` +
        '**Why Fixed instead of Random?** Random resolvers produce a different value every request — impossible for UI assertions. Fixed gives a deterministic contract: every execute returns exactly `"mock-ok"`, distinct from Docker\'s `"ok"`.',
      highlight: LESSON13_MOCK_HEALTH_FIXED,
      preAction: prepareLesson13MockFixedValueSpotlight,
      action: async (ctx) => {
        await ensureLesson13FixedValueSet(ctx);
      },
      verify: LESSON13_MOCK_HEALTH_FIXED,
      pauseAfter: true,
    },

    // ── Step 8: Explore Resolver Types ────────────────────────────────────
    {
      id: 'gql13-resolver-types',
      title: 'Explore Resolver Types',
      description:
        'Scan the **Resolvers** list — `health` is **Fixed** while other fields may still be **Random**. The full menu on each row includes **Random**, **Fixed**, **Error**, and **Script**.\n\n' +
        '**Why four resolver types?** Each covers a distinct testing scenario:\n' +
        '- **Random** — generate valid-shaped values instantly (prototyping)\n' +
        '- **Fixed** — return a known value every time (assertions, UI state)\n' +
        '- **Error** — throw a GraphQL error (test error boundaries, retry logic)\n' +
        '- **Script** — evaluate a JS expression per-request (dynamic responses, reading variables)\n\n' +
        'Together they let you simulate any backend behavior from zero-config prototyping to precise contract testing — without modifying a single line of server code.',
      highlight: GQL.MOCK_RESOLVERS_LIST,
      preAction: prepareLesson13MockResolversListSpotlight,
      action: async (ctx) => {
        await ctx.delay(1100);
      },
      verify: `${GQL.MOCK_RESOLVERS_LIST}, ${GQL.MOCK_GUARD}`,
      pauseAfter: true,
    },

    // ── Step 9: Execute Against Mock ──────────────────────────────────────
    {
      id: 'gql13-execute-mock',
      title: 'Execute Against the Mock',
      description:
        'Press **▶ Execute** to run `query { health }` against the mock endpoint. The response comes from the proxy — not the Docker server.\n\n' +
        '**Why execute at this point (not earlier)?** This is the proof step — it confirms the entire chain: mock ON → endpoint updated → resolver overridden → Execute pressed → response received. Each previous step set up a piece of the pipeline; this step demonstrates it is working end-to-end. The execute button highlights because the user action (clicking Execute) is what drives the demo.',
      highlight: GQL.EXECUTE_BTN,
      preAction: ensureLesson13FixedValueSet,
      action: async (ctx) => {
        await ensureLesson13MockExecuted(ctx);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },

    // ── Step 10: Observe the Mock Response ───────────────────────────────
    {
      id: 'gql13-observe-response',
      title: 'Read the Mock Response',
      description:
        'Look at the **Response** panel — it shows `"health": "mock-ok"` instead of the live server\'s `"health": "ok"`. The status is **200**, the response is valid JSON, and the experience is identical to calling a real server.\n\n' +
        '**Why is this the key proof point?** The value `"mock-ok"` could only come from the Fixed resolver you configured — the Docker live server always returns `"ok"`. Seeing the different value here proves the query went through the mock proxy, not the live server. This is exactly the kind of differentiator you would set in a real testing workflow: a known "this is mock traffic" sentinel value that your test assertions can check.',
      highlight: GQL.RESPONSE_BODY,
      preAction: prepareLesson13MockResponseSpotlight,
      action: async (ctx) => {
        await ctx.delay(1100);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },

    // ── Step 11: Raise Latency Slider ─────────────────────────────────────
    {
      id: 'gql13-latency-slider',
      title: 'Raise the Latency Slider',
      description:
        'Drag the **Latency (ms)** slider to about **650 ms**. The spotlight stays on the slider so you can see the delay value change before any new request runs.\n\n' +
        '**Why adjust latency before executing?** Production queries are often 10–100× slower than localhost. Setting the slider first lets you predict the wait — then the next step shows whether the response metadata reflects it.',
      highlight: GQL.MOCK_LATENCY_SLIDER,
      preAction: prepareLesson13MockLatencySpotlight,
      action: async (ctx) => {
        await ensureLesson13LatencySliderOnly(ctx);
      },
      verify: GQL.MOCK_LATENCY_VALUE,
      pauseAfter: true,
    },

    // ── Step 12: Observe Slow Response ────────────────────────────────────
    {
      id: 'gql13-observe-latency',
      title: 'Execute and Read the Latency',
      description:
        'Press **▶ Execute** again. The body still shows `"mock-ok"`, but watch the **latency badge** in the response bar climb to ~650 ms after the request completes.\n\n' +
        '**Why test latency at all?** Loading spinners, skeleton screens, debounce timers, and cancellation logic were probably never tested at realistic speeds. This step proves the mock honors the delay — so you can verify your UI handles slow responses gracefully.',
      highlight: GQL.RESPONSE_LATENCY,
      preAction: ensureLesson13LatencySliderOnly,
      action: async (ctx) => {
        await ensureLesson13LatencyExecute(ctx);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_LATENCY,
      pauseAfter: true,
    },

    // ── Step 13: Disable Mock Mode ────────────────────────────────────────
    {
      id: 'gql13-disable-mock',
      title: 'Turn Mock Mode Off',
      description:
        'Toggle **Mock mode OFF**. The **Mock active** badge disappears and the proxy stops intercepting traffic.\n\n' +
        '**Why disable before changing the endpoint?** Mock mode and the live server are separate concerns. Turning the proxy off first makes it obvious you are leaving mock territory — the next step switches the connection bar back to Docker.',
      highlight: GQL.MOCK_TOGGLE_CARD,
      preAction: prepareLesson13MockToggleSpotlight,
      action: async (ctx) => {
        await ensureLesson13MockDisabledOnly(ctx);
      },
      verify: `${GQL.MOCK_PANEL}, ${GQL.MOCK_GUARD}`,
      pauseAfter: true,
    },

    // ── Step 14: Restore Live Endpoint ────────────────────────────────────
    {
      id: 'gql13-restore-endpoint',
      title: 'Restore the Live Endpoint',
      description:
        `Set the connection bar back to \`${GQL_DEMO_HTTP}\`, click **Introspect**, and execute once more. The spotlight follows the **endpoint field** while the live URL is restored.\n\n` +
        '**Why restore the endpoint explicitly?** Disabling mock stops interception, but the editor still pointed at port 3001. Switching back to Docker reconnects you to the real test server — same workflow you used at the start of the lesson.',
      highlight: GQL.INTROSPECT_BTN,
      preAction: ensureLesson13MockDisabledOnly,
      action: async (ctx) => {
        await ensureLesson13LiveEndpointOnly(ctx);
      },
      verify: GQL.INTROSPECT_BTN,
      pauseAfter: true,
    },

    // ── Step 15: Read Live Response ───────────────────────────────────────
    {
      id: 'gql13-read-live',
      title: 'Read the Live Response',
      description:
        'Look at the **Response** panel — `"health"` is back to `"ok"` from Docker, not `"mock-ok"` from the mock. That contrast is the closing proof.\n\n' +
        '**Why end on the live value?** It shows mock and live are cleanly separated: no residual mock config leaks into the next lesson. You have seen the full round-trip — mock sentinel (`"mock-ok"`) versus live (`"ok"`).',
      highlight: GQL.RESPONSE_BODY,
      preAction: prepareLesson13ReadLiveSpotlight,
      action: async (ctx) => {
        await ctx.delay(1200);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },
  ],
};
