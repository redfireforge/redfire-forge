/** Lesson GQL-14: Multi-Tab Workspaces */
import type { DemoLesson } from '../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_STUDIO_LESSON_ALLOWED_TABS,
  GQL_DEMO_HTTP,
  activateGqlTabByIndex,
  demonstrateLesson14PerTabAuth,
  demonstrateLesson14SaveProfiles,
  demonstrateLesson14LoadProfilesOnly,
  demonstrateLesson14ProfileAuthLink,
  demonstrateLesson14TabPolling,
  demonstrateLesson14TabResponseSwitch,
  ensureLesson14SwitchedToTab1,
  ensureLesson14Tab2BadgeHighlight,
  ensureLesson14TabsRenamed,
  ensureLesson14Tab1Configured,
  ensureLesson14Tab2Added,
  ensureLesson14Tab2Configured,
  ensureLesson14Tab2Executed,
  ensureLesson14TabProfileLinks,
  ensureLesson14ProfilesSaved,
  ensureLesson14ProfilesLinked,
  ensureLesson14PerTabAuthConfigured,
  ensureLesson14IntroReady,
  gqlMultiTabLessonCleanup,
  gqlMultiTabLessonSetup,
} from './graphql-lesson-helpers';

export const gqlMultiTabLesson: DemoLesson = {
  id: 'gql-multi-tab',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Multi-Tab Workspaces',
  description:
    'Open multiple independent GraphQL workspaces in one window — each with its own endpoint, schema, auth override, and response cache.',
  estimatedMinutes: 9,
  initialTab: 'graphql-studio',
  allowedTabs: GQL_STUDIO_LESSON_ALLOWED_TABS,
  /** Two demo tab slots — user workspace must stay untouched (§11.0). */
  tabBudget: 2,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlMultiTabLessonSetup,
  cleanup: gqlMultiTabLessonCleanup,

  concept: {
    title: 'Multi-Tab Workspaces — One Window, Many Environments',
    body: `Every GraphQL Studio tab is a fully **independent workspace**: it has its own endpoint override, its own introspected schema, its own response cache, and its own auth override. You can run queries against staging on Tab 1 while Tab 2 is live on production — without any context-switching, tool-switching, or re-configuration.

**Why tabs instead of separate browser windows or tools?**
Switching tools breaks your flow. Opening a second Postman/Insomnia window means two separate auth configurations, two separate header sets, and no shared history. A second browser window of the same Studio app would share state and overwrite each other's endpoint. Studio tabs solve this cleanly: one window, one history sidebar, one collection, but completely isolated per-tab execution contexts.

**Why per-tab endpoint isolation matters?**
Without isolation, changing the endpoint in a single-connection tool disconnects you from the previous server — you lose the introspected schema, the cached response, and the context of what you were testing. Tab isolation means you can keep a slow staging environment's response visible on Tab 1 while introspecting a brand-new production deployment on Tab 2, then switch back and compare with a single click.

**Why does the endpoint badge only appear on some tabs?**
When only one tab exists, filling the endpoint sets the **page-level default** — no badge appears (it is the baseline). When two or more tabs exist, each new tab starts with an **empty endpoint field** until you set one; a hostname badge appears once a tab has its own URL override so you always know at a glance which tab is talking to which server. This prevents the common mistake of accidentally running a mutation against production when you meant to target staging.

**Why this lesson comes after GQL-1..13?**
Multi-tab workspaces make the most sense after you have learned per-tab concerns independently: endpoint selection (GQL-1), schema introspection (GQL-3), authentication (GQL-4), and query history (GQL-9). GQL-14 combines all these into a parallel-server workflow that mirrors real team usage — developers who keep staging and production queries open side by side all day.`,
    keyTerms: [
      {
        term: 'Tab workspace',
        definition:
          'Each Studio tab is a self-contained environment with its own endpoint override, introspected schema, response cache, and auth override. Tabs share the page-level default endpoint but can individually override it.',
      },
      {
        term: 'Per-tab endpoint override',
        definition:
          'An endpoint URL set on a specific tab that differs from the page-level default. Creates a hostname badge on the tab. Changing one tab\'s endpoint never affects other tabs.',
      },
      {
        term: 'Endpoint badge',
        definition:
          'A small hostname label rendered on a tab when its endpoint is overridden from the page default. Lets you see at a glance which server each tab is targeting (e.g. `:4010`, `api.staging.com`). Absent on tabs that use the page default.',
      },
      {
        term: 'Response cache (per tab)',
        definition:
          'The last query response stored for each tab independently. Switching to a different tab restores its cached response — the previous tab\'s result is preserved until the tab is closed or re-executed.',
      },
      {
        term: 'Page-level default endpoint',
        definition:
          'The baseline endpoint URL inherited by all tabs that have not set a per-tab override. Set via the Environment Manager or the connection bar when only one tab is open. Changing it updates all non-overridden tabs simultaneously.',
      },
      {
        term: 'Per-tab auth override',
        definition:
          'When two or more tabs are open, auth edits on a tab store an explicit override on that tab only. Tab auth dots in the tab bar show which tabs diverge from workspace auth. Queries and subscriptions on the active tab use its resolved auth chain.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- ── Window chrome ────────────────────────────────────────────────────── -->
  <rect x="0" y="0" width="700" height="430" rx="10" fill="var(--bg)" stroke="var(--border)" stroke-width="1.5"/>
  <rect x="0" y="0" width="700" height="32" rx="10" fill="var(--surface)"/>
  <rect x="0" y="22" width="700" height="10" fill="var(--surface)"/>
  <circle cx="18" cy="16" r="5" fill="#ff5f57"/>
  <circle cx="34" cy="16" r="5" fill="#febc2e"/>
  <circle cx="50" cy="16" r="5" fill="#28c840"/>
  <text x="350" y="21" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">GraphQL Studio — Multi-Tab Workspaces</text>

  <!-- ── Connection bar (showing Tab 2 active endpoint) ───────────────────── -->
  <rect x="0" y="32" width="700" height="26" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="8" y="37" width="220" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="16" y="48" fill="var(--text)" font-size="8.5" font-family="monospace">localhost:4010/graphql</text>
  <rect x="238" y="37" width="50" height="16" rx="8" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="263" y="48" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <rect x="618" y="37" width="72" height="16" rx="4" fill="var(--primary)"/>
  <text x="654" y="48" text-anchor="middle" font-size="9" font-weight="700" fill="white">▶ Execute</text>

  <!-- ── GQL Tab Bar ───────────────────────────────────────────────────────── -->
  <rect x="0" y="58" width="700" height="32" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>

  <!-- Tab 1: Staging (not active, uses {{graphqlUrl}} env var) -->
  <rect x="4" y="62" width="160" height="24" rx="4" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="16" y="77" font-size="8.5" fill="var(--text-muted)">Staging</text>
  <!-- No badge on Tab 1 (inherits page default) -->
  <text x="68" y="77" font-size="7" fill="var(--text-muted)" opacity="0.5">{{graphqlUrl}}</text>
  <!-- Close button for Tab 1 -->
  <text x="152" y="77" font-size="8" fill="var(--text-muted)" opacity="0.6">✕</text>

  <!-- Tab 2: Production (active, has endpoint override badge) -->
  <rect x="168" y="62" width="170" height="24" rx="4" fill="var(--bg)" stroke="var(--primary)" stroke-width="1.5"/>
  <rect x="168" y="82" width="170" height="4" fill="var(--primary)"/>
  <text x="180" y="77" font-size="8.5" fill="var(--text)" font-weight="600">Production</text>
  <!-- Endpoint override badge: localhost:4010 -->
  <rect x="243" y="65" width="62" height="14" rx="3" fill="color-mix(in srgb, var(--primary) 12%, var(--surface))" stroke="var(--primary)" stroke-width="0.8"/>
  <text x="274" y="75" text-anchor="middle" font-size="7" fill="var(--primary)" font-weight="600">:4010</text>
  <!-- Close button for Tab 2 -->
  <text x="328" y="77" font-size="8" fill="var(--text-muted)" opacity="0.6">✕</text>

  <!-- Add tab button -->
  <rect x="342" y="66" width="24" height="20" rx="4" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="354" y="79" text-anchor="middle" font-size="12" fill="var(--text-muted)">+</text>

  <!-- Tab isolation annotation -->
  <rect x="420" y="62" width="268" height="24" rx="4" fill="color-mix(in srgb, var(--primary) 5%, var(--bg))" stroke="var(--border)" stroke-width="0.5"/>
  <text x="430" y="73" font-size="7.5" fill="var(--text-muted)">Each tab: own endpoint · schema · response cache</text>
  <text x="430" y="83" font-size="7" fill="var(--text-muted)" opacity="0.7">Switching tabs restores independent state</text>

  <!-- ── Left activity bar ─────────────────────────────────────────────────── -->
  <rect x="0" y="90" width="36" height="340" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="3" y="100" width="30" height="30" rx="4" fill="var(--bg)"/>
  <text x="18" y="119" text-anchor="middle" font-size="11" opacity="0.3">📋</text>

  <!-- ── Editor panel (left, ~240px) ──────────────────────────────────────── -->
  <rect x="36" y="90" width="240" height="340" fill="var(--bg)"/>
  <line x1="276" y1="90" x2="276" y2="430" stroke="var(--border)" stroke-width="1"/>

  <!-- Editor tab bar -->
  <rect x="36" y="90" width="240" height="22" fill="var(--bg)"/>
  <rect x="40" y="92" width="60" height="18" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="70" y="104" text-anchor="middle" font-size="7.5" fill="var(--text)">Query 1</text>
  <line x1="36" y1="112" x2="276" y2="112" stroke="var(--border)" stroke-width="1"/>

  <!-- Monaco editor content (Tab 2 = Production active) -->
  <text x="48" y="134" fill="#a78bfa" font-size="9" font-family="monospace">query</text>
  <text x="82" y="134" fill="var(--text)" font-size="9" font-family="monospace"> {</text>
  <text x="60" y="150" fill="#34d399" font-size="9" font-family="monospace">  health</text>
  <text x="48" y="166" fill="var(--text)" font-size="9" font-family="monospace">}</text>

  <!-- Annotation: "Tab 2 (Production) is active" -->
  <rect x="44" y="180" width="220" height="36" rx="4" fill="color-mix(in srgb, var(--primary) 8%, var(--surface))" stroke="var(--primary)" stroke-width="0.8"/>
  <text x="54" y="196" font-size="7.5" fill="var(--primary)" font-weight="600">Tab 2 — Production (active)</text>
  <text x="54" y="209" font-size="7" fill="var(--text-muted)">endpoint: localhost:4010/graphql</text>

  <!-- ── Response panel (right, ~424px) ────────────────────────────────────── -->
  <rect x="276" y="90" width="424" height="340" fill="var(--bg)"/>

  <!-- Response area split horizontally to show BOTH tab responses conceptually -->

  <!-- Tab 2 (Production) response - LEFT half of response area -->
  <rect x="276" y="90" width="210" height="22" fill="var(--bg)"/>
  <rect x="280" y="92" width="80" height="18" rx="3" fill="var(--primary)"/>
  <text x="320" y="104" text-anchor="middle" font-size="7.5" fill="white" font-weight="600">Production ▸ Response</text>
  <line x1="276" y1="112" x2="486" y2="112" stroke="var(--border)" stroke-width="1"/>
  <rect x="276" y="112" width="210" height="18" fill="color-mix(in srgb, #28c840 6%, var(--surface))"/>
  <line x1="276" y1="130" x2="486" y2="130" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="284" y="115" width="28" height="12" rx="2" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="0.5"/>
  <text x="298" y="124" text-anchor="middle" font-size="7" fill="#28c840" font-weight="600">200</text>
  <text x="320" y="124" font-size="7" fill="var(--text-muted)">32 ms</text>
  <rect x="276" y="130" width="210" height="120" fill="var(--bg)"/>
  <text x="288" y="152" fill="var(--text)" font-size="8" font-family="monospace">{</text>
  <text x="296" y="168" fill="var(--text-muted)" font-size="8" font-family="monospace">  "data": {</text>
  <text x="304" y="184" fill="var(--text-muted)" font-size="8" font-family="monospace">    "health":</text>
  <text x="374" y="184" fill="#a78bfa" font-size="8" font-family="monospace"> "ok"</text>
  <text x="296" y="200" fill="var(--text-muted)" font-size="8" font-family="monospace">  }</text>
  <text x="288" y="216" fill="var(--text)" font-size="8" font-family="monospace">}</text>

  <!-- Vertical separator between the two response panels -->
  <line x1="486" y1="90" x2="486" y2="430" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,3"/>

  <!-- Tab 1 (Staging) cached response - RIGHT half of response area -->
  <rect x="486" y="90" width="214" height="22" fill="var(--bg)"/>
  <rect x="490" y="92" width="86" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="533" y="104" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">Staging ▸ Cached</text>
  <line x1="486" y1="112" x2="700" y2="112" stroke="var(--border)" stroke-width="1"/>
  <rect x="486" y="112" width="214" height="18" fill="color-mix(in srgb, #28c840 4%, var(--surface))"/>
  <line x1="486" y1="130" x2="700" y2="130" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="494" y="115" width="28" height="12" rx="2" fill="color-mix(in srgb, #28c840 10%, var(--surface))" stroke="#28c840" stroke-width="0.5"/>
  <text x="508" y="124" text-anchor="middle" font-size="7" fill="#28c840" font-weight="600">200</text>
  <text x="530" y="124" font-size="7" fill="var(--text-muted)">45 ms</text>
  <rect x="486" y="130" width="214" height="120" fill="color-mix(in srgb, var(--surface) 40%, var(--bg))"/>
  <!-- Dimmed to show it's "cached/other tab" -->
  <text x="498" y="152" fill="var(--text-muted)" font-size="8" font-family="monospace" opacity="0.6">{</text>
  <text x="506" y="168" fill="var(--text-muted)" font-size="8" font-family="monospace" opacity="0.6">  "data": {</text>
  <text x="514" y="184" fill="var(--text-muted)" font-size="8" font-family="monospace" opacity="0.6">    "health":</text>
  <text x="584" y="184" fill="#a78bfa" font-size="8" font-family="monospace" opacity="0.6"> "ok"</text>
  <text x="506" y="200" fill="var(--text-muted)" font-size="8" font-family="monospace" opacity="0.6">  }</text>
  <text x="498" y="216" fill="var(--text-muted)" font-size="8" font-family="monospace" opacity="0.6">}</text>
  <!-- Cached indicator -->
  <rect x="560" y="134" width="126" height="16" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="623" y="145" text-anchor="middle" font-size="7" fill="var(--text-muted)">cached — Tab 1 isolated</text>

  <!-- ── Tab isolation visual callouts ─────────────────────────────────────── -->
  <!-- Arrow from Tab 1 down to Staging response -->
  <line x1="84" y1="86" x2="533" y2="112" stroke="var(--border)" stroke-width="0.8" stroke-dasharray="4,3" opacity="0.5"/>
  <!-- Arrow from Tab 2 down to Production response -->
  <line x1="253" y1="86" x2="320" y2="112" stroke="var(--primary)" stroke-width="0.8" stroke-dasharray="3,2" opacity="0.6"/>

  <!-- ── Bottom legend ─────────────────────────────────────────────────────── -->
  <line x1="0" y1="390" x2="700" y2="390" stroke="var(--border)" stroke-width="1"/>
  <rect x="0" y="390" width="700" height="40" fill="var(--bg)"/>
  <defs>
    <marker id="gql14-arr" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto">
      <path d="M1,1 L4,2.5 L1,4 Z" fill="var(--primary)"/>
    </marker>
  </defs>
  <text x="40" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Open Tab 2</text>
  <text x="40" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">click +</text>
  <line x1="76" y1="408" x2="104" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql14-arr)"/>
  <text x="148" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Set Endpoint</text>
  <text x="148" y="418" text-anchor="middle" font-size="7" fill="var(--primary)">override → badge</text>
  <line x1="194" y1="408" x2="224" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql14-arr)"/>
  <text x="268" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Introspect</text>
  <text x="268" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">per-tab schema</text>
  <line x1="304" y1="408" x2="334" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql14-arr)"/>
  <text x="378" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Execute</text>
  <text x="378" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">response cached</text>
  <line x1="410" y1="408" x2="440" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql14-arr)"/>
  <text x="490" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Switch Tabs</text>
  <text x="490" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">caches persist</text>
  <line x1="530" y1="408" x2="560" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql14-arr)"/>
  <text x="630" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="#28c840">Compare</text>
  <text x="630" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">staging vs prod</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Tour the Tab Bar ───────────────────────────────────────────
    {
      id: 'gql14-intro',
      title: 'Independent Tab Workspaces',
      description:
        'Look at the **tab bar** just below the connection bar. Right now there is one tab — your current workspace. Each tab you add becomes a completely independent environment with its own endpoint, introspected schema, and response cache.\n\n' +
        '**Why tabs instead of separate windows or tools?** A second browser window of the same Studio app would share state — changing the endpoint in one window would affect the other. A second tool (Postman, Insomnia) means double the configuration and no shared history. Studio tabs isolate execution context while sharing the sidebar, history, and collections. You can query staging on Tab 1 and production on Tab 2 with a single click to switch between them.',
      highlight: GQL.TAB_BAR,
      preAction: ensureLesson14IntroReady,
      action: async (ctx) => {
        await ctx.delay(1500);
      },
      verify: GQL.TAB_BAR,
      pauseAfter: true,
    },

    // ── Step 2: Tab 1 — Set First Endpoint ────────────────────────────────
    {
      id: 'gql14-tab1-endpoint',
      title: 'Tab 1 — Set First Endpoint',
      description:
        'On **Tab 1**, the endpoint field shows `{{graphqlUrl}}` once — inherited from the page-level default (the environment-managed value). Click **Introspect**, then run `query { health }`. The response is cached in Tab 1\'s workspace.\n\n' +
        '**Why inherit instead of typing it again?** `{{graphqlUrl}}` lives at the page level and resolves to whatever URL your Environment Manager has configured. Tab 1 does not store a duplicate per-tab copy, so you see a single clean value with no override badge. Later, when Tab 2 gets its own direct URL, that becomes a per-tab override and earns a badge. This distinction between page default and per-tab override is the core concept of multi-tab isolation.',
      highlight: GQL.ENDPOINT_INPUT,
      preAction: async (ctx) => {
        await ctx.waitFor(GQL.TAB_BAR, 5000);
      },
      action: async (ctx) => {
        await ensureLesson14Tab1Configured(ctx);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: 5500,
    },

    // ── Step 3: Add Second Tab ────────────────────────────────────────────
    {
      id: 'gql14-add-tab2',
      title: 'Add a Second Tab',
      description:
        'Click the **+** button at the right end of the tab bar. A new Tab 2 appears with an **empty endpoint field** — you choose the server for each tab independently. The workspace itself is also fresh: no cached response and no schema badge yet.\n\n' +
        '**Why does Tab 2 start empty?** Each tab is born without an introspected schema or response cache. The endpoint field is blank so you deliberately pick where this tab points — Tab 1 keeps its page-level default (`{{graphqlUrl}}`) without being copied into Tab 2. Studio waits for you to intentionally set the URL and introspect for each new workspace.',
      highlight: GQL.TAB_ADD_BTN,
      preAction: async (ctx) => {
        await ctx.waitFor(GQL.TAB_BAR, 5000);
      },
      action: async (ctx) => {
        await ensureLesson14Tab2Added(ctx);
        await ctx.delay(1200);
      },
      verify: GQL.LESSON14_TAB2,
      pauseAfter: true,
    },

    // ── Step 4: Tab 2 — Different Endpoint ───────────────────────────────
    {
      id: 'gql14-tab2-endpoint',
      title: 'Tab 2 — Override to a Different Endpoint',
      description:
        `On the newly active **Tab 2**, change the endpoint to \`${GQL_DEMO_HTTP}\` (a direct URL instead of the env variable). Click **Introspect** — Tab 2 now has its own independent schema loaded.\n\n` +
        '**Why is this a per-tab override now?** Because two tabs exist, changing the endpoint here only affects Tab 2 — the page-level default that Tab 1 uses remains unchanged. Tab 2\'s endpoint is now an **override**, signalled by a hostname badge that appears on the tab. Switching back to Tab 1 will show its original endpoint still intact. The schemas are completely separate — Tab 2\'s introspection does not cross-contaminate Tab 1\'s cached schema.',
      highlight: GQL.ENDPOINT_INPUT,
      preAction: ensureLesson14Tab2Added,
      action: async (ctx) => {
        await ensureLesson14Tab2Configured(ctx);
        await ctx.delay(1200);
      },
      verify: GQL.SCHEMA_BADGE_OK,
      pauseAfter: true,
    },

    // ── Step 5: Switch Tabs — Responses Persist ──────────────────────────
    {
      id: 'gql14-switch-responses',
      title: 'Switch Tabs — Cached Responses Persist',
      description:
        'Execute `query { health }` on **Tab 2**, then click **Tab 1** in the tab bar. Tab 1\'s response — from its own earlier execution — is restored instantly from cache. Tab 2\'s response stays in memory for when you switch back.\n\n' +
        '**Why cache responses per tab?** Without per-tab caching, switching tabs would blank the response panel — you would have to re-execute the query every time you switch back. With caching, the response panel preserves exactly what you saw before you switched. This makes side-by-side comparison practical: execute on Tab 2 (production), switch to Tab 1 (staging), compare the two results — both responses are visible in their respective tabs without re-running anything.',
      highlight: GQL.TAB_BAR,
      preAction: ensureLesson14Tab2Executed,
      action: async (ctx) => {
        await demonstrateLesson14TabResponseSwitch(ctx);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: 6000,
    },

    // ── Step 6: Tab Endpoint Badge ────────────────────────────────────────
    {
      id: 'gql14-tab-badge',
      title: 'Tab Endpoint Override Badge',
      description:
        'Look at the **second demo tab** in the tab bar (after your own tabs). Its title stays **Demo: Multi-Tab Workspaces**, and a **second line** underneath shows **`127.0.0.1:4010`** — that muted hostname line is the endpoint-override indicator. The first demo tab has **only one line** (no hostname underneath) because it still uses the page-level default.\n\n' +
        '**Why only show the hostname on overridden tabs?** If every tab showed that second line, the tab bar would be cluttered — most tabs use the page default. Showing the hostname **only** when the endpoint is overridden makes the exception visible, not the rule. In a team environment where someone accidentally pointed a tab at production, that extra line makes it immediately obvious. No second line means "page default"; a hostname line means "this tab is talking to something different — pay attention."',
      highlight: GQL.LESSON14_TAB2_BADGE,
      preAction: ensureLesson14Tab2BadgeHighlight,
      action: async (ctx) => {
        await ctx.delay(2000);
      },
      verify: GQL.LESSON14_TAB2_BADGE,
      pauseAfter: 5500,
    },

    // ── Step 7: Staging vs Production ────────────────────────────────────
    {
      id: 'gql14-real-world',
      title: 'Staging vs. Production — Side by Side',
      description:
        'Rename **Tab 1** to "Staging" and **Tab 2** to "Production". Switch between them — each tab still holds its own cached response and endpoint from the earlier steps, with no re-typing or re-execution needed.\n\n' +
        '**Why this workflow matters in practice?** A very common engineering task is validating that a new deployment did not break existing API behavior. With multi-tab: open Staging on Tab 1, open Production on Tab 2, run the same query on both, and compare responses side by side. Any difference in schema, response shape, or data is immediately visible. This replaces the error-prone workflow of running a query, copying the result, switching tools, running again, and manually comparing — all without leaving the Studio.',
      highlight: GQL.TAB_BAR,
      preAction: ensureLesson14SwitchedToTab1,
      action: async (ctx) => {
        await ensureLesson14TabsRenamed(ctx);
        await activateGqlTabByIndex(ctx, 1);
        await ctx.delay(1000);
        await activateGqlTabByIndex(ctx, 0);
        await ctx.delay(1200);
      },
      verify: GQL.TAB_BAR,
      pauseAfter: true,
    },

    // ── Step 8: Per-tab auth — same server, different credentials ─────────
    {
      id: 'gql14-per-tab-auth',
      title: 'Per-Tab Auth — Same Server, Different Credentials',
      description:
        'Both **Staging** and **Production** tabs target the same GraphQL server, but auth is **per-tab**. On **Staging** (Tab 1), open **Auth** and choose **No Auth** — an explicit override that sends no credentials. Switch to **Production** (Tab 2), set **Bearer** with a demo token, then **Execute** on each tab and compare **Metadata → Request headers**.\n\n' +
        '**Why per-tab auth matters?** Real teams often hit the same API gateway with different credentials per environment — a read-only public key on staging and a full-access token on production. Without per-tab auth you would constantly reconfigure the connection bar when switching tabs. Tab auth dots in the tab bar show at a glance which tabs carry an override.',
      highlight: GQL.BOTTOM_TAB_AUTH,
      preAction: ensureLesson14TabsRenamed,
      action: async (ctx) => {
        await demonstrateLesson14PerTabAuth(ctx);
      },
      verify: GQL.AUTH_PANEL,
      pauseAfter: 6500,
    },

    // ── Step 9 (7C): Save connection profiles ──────────────────────────────
    {
      id: 'gql14-profiles-save',
      title: 'Save Connection Profiles',
      description:
        'On **Staging** (Tab 1), click **Profiles** → name the preset **GQL-14 Staging** → **Save**. Switch to **Production** (Tab 2) and repeat as **GQL-14 Production**.\n\n' +
        'After each save, read the **Used by** row on the new profile — it says *Not linked to any tab*. **Saving does not connect the tab**; it only adds a reusable preset to the global catalog. The next step links each tab with **Load**.',
      highlight: GQL.PROFILE_BADGE,
      preAction: ensureLesson14PerTabAuthConfigured,
      action: async (ctx) => {
        await demonstrateLesson14SaveProfiles(ctx);
      },
      verify: GQL.PROFILE_MODAL,
      pauseAfter: 6000,
    },

    // ── Step 10 (7C): Load profiles onto tabs ───────────────────────────────
    {
      id: 'gql14-profiles-load',
      title: 'Load Profiles onto Tabs',
      description:
        'Switch to **Staging** (Tab 1), open **Profiles**, and click **Load** on **GQL-14 Staging**. The modal closes — reopen **Profiles** to read **Used by → Staging**. Switch to **Production** (Tab 2) and repeat with **GQL-14 Production**.\n\n' +
        '**Load** sets `connectionId` on the active tab — that is what populates **Used by**. The same profile can appear on multiple tabs if you **Load** it on each one. Saving only adds a catalog preset; **Load** is what wires a tab to that preset.',
      highlight: GQL.PROFILE_BADGE,
      preAction: ensureLesson14ProfilesSaved,
      action: async (ctx) => {
        await demonstrateLesson14LoadProfilesOnly(ctx);
      },
      verify: GQL.PROFILE_MODAL,
      pauseAfter: 6500,
    },

    // ── Step 11 (7C): Profile-linked auth editing ───────────────────────────
    {
      id: 'gql14-profile-auth',
      title: 'Profile-Linked Auth Editing',
      description:
        'On **Production** (Tab 2), open **Auth**. The panel shows **Editing profile GQL-14 Production** — auth edits on a linked tab update the shared preset, not a one-off tab override.\n\n' +
        '**Why does this matter?** Once a tab is linked via **Load**, endpoint and auth changes can flow back into the named profile so your team reuses the same Staging/Production presets across sessions. The inherit banner tells you which catalog entry owns the current auth fields.',
      highlight: GQL.AUTH_INHERIT_BANNER,
      preAction: ensureLesson14ProfilesLinked,
      action: async (ctx) => {
        await demonstrateLesson14ProfileAuthLink(ctx);
      },
      verify: GQL.AUTH_INHERIT_BANNER,
      pauseAfter: 6000,
    },

    // ── Step 12 (7C): Per-tab schema polling ───────────────────────────────
    {
      id: 'gql14-polling',
      title: 'Per-Tab Schema Polling',
      description:
        'On **Staging** (Tab 1), click the **auto-refresh** (polling) control next to the schema badge → enable **Enable polling** and set an interval (e.g. 60s). Switch to **Production** (Tab 2) and confirm polling is **off** — each tab stores its own polling override.\n\n' +
        '**Why per-tab polling?** Staging schemas change frequently during development; production introspection is expensive and should stay manual. Polling follows the **active** tab only — switching tabs swaps both the schema cache and the polling schedule. You are not forced to poll every server just because one tab needs it.',
      highlight: GQL.POLLING_POPOVER,
      preAction: ensureLesson14TabProfileLinks,
      action: async (ctx) => {
        await demonstrateLesson14TabPolling(ctx);
        await ctx.delay(1200);
      },
      verify: GQL.POLLING_POPOVER,
      pauseAfter: 5500,
    },
  ],
};
