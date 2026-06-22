/** Lesson GQL-6: Mutations — Create, Order, Delete & Idempotency */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_CREATE_ORDER_MUTATION,
  GQL_CREATE_ORDER_VARS,
  GQL_CREATE_USER_MUTATION,
  GQL_CREATE_USER_VARS,
  GQL_DELETE_USER_MUTATION,
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  configureDemoTabEndpointOverride,
  prepareGql3IntroReading,
  prepareGql3EndpointReading,
  prepareGql3IntrospectReading,
  runGql3IntrospectOnlyAction,
  prepareGql3SchemaMutationsReading,
  runGql3SchemaMutationsAction,
  prepareGql3WriteCreateReading,
  prepareGql3SetCreateVarsReading,
  prepareGql3ExecCreateReading,
  prepareGql3ObserveCreateReading,
  prepareGql3WriteOrderReading,
  prepareGql3SetOrderVarsReading,
  prepareGql3ExecOrderReading,
  prepareGql3ObserveOrderReading,
  prepareGql3WriteDeleteReading,
  prepareGql3WireDeleteVarReading,
  prepareGql3ExecDeleteReading,
  prepareGql3IdempotencyReading,
  ensureVariablesPanelOpen,
  fillGqlEditor,
  fillGqlVariables,
  getLesson3CreatedUserId,
  gqlMutationsLessonCleanup,
  gqlMutationsLessonSetup,
  openResponseBodyTab,
  parseCreatedUserIdFromResponse,
  storeCreatedUserIdFromResponse,
  storeFirstDeleteExecuted,
  storeOrderExecuted,
} from './graphql-lesson-helpers';

export const gqlMutationsLesson: DemoLesson = {
  id: 'gql-mutations',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Mutations — Create, Update, Delete',
  description:
    'Write GraphQL mutations to create a user, create an order with an input object type, and delete the user — observing idempotent delete semantics on the test server.',
  estimatedMinutes: 8,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlMutationsLessonSetup,
  cleanup: gqlMutationsLessonCleanup,

  concept: {
    title: 'GraphQL Mutations — Writing Data',
    body: `**Mutations** are GraphQL operations that modify server-side data. The GraphQL spec deliberately separates reads (\`query\`) from writes (\`mutation\`) so clients, servers, and tooling all know whether a request has side effects. When your editor contains a \`mutation\` block, the active tab badge flips from blue **Q** to amber **M** — a visible reminder that the next Execute will write data.

**Why variables, not string interpolation?** In REST, it's tempting to build URLs like \`POST /users?name=Carol\`. In GraphQL, you never interpolate values directly into the query string — you declare variables in the signature (\`$name: String!\`) and pass them in a separate JSON block. This design makes **SQL / NoSQL injection structurally impossible**: the server always knows which part of the request is code and which is data.

**Two argument styles demonstrated here:**
- **Scalar arguments** (\`createUser(name: $name, email: $email)\`) — one variable per field, ideal for simple objects
- **Input object types** (\`createOrder(input: $input)\`) — groups all fields under a single \`$input\` variable, defined in the schema as \`input OrderInput { ... }\`. Cleaner for complex, nested payloads.

**Idempotent delete semantics:** The test server's \`deleteUser\` returns \`{ success: Boolean! }\`. The first delete removes the record and returns \`success: true\`. The second delete with the same id finds nothing and returns \`success: false\` — no 404, no exception. This idempotent pattern is intentional: CI teardown pipelines can safely retry cleanup without the run failing if a previous iteration already deleted the row.

**What you'll build:** A complete create → inspect → delete → **re-delete** cycle using Carol as the test user. The lesson captures Carol's server-assigned id from the create response and passes it automatically to the delete mutation.`,
    keyTerms: [
      {
        term: 'Mutation',
        definition:
          'A GraphQL operation that modifies server-side data. Declared with `mutation OperationName($var: Type!) { ... }`. The Studio tab bar shows an amber **M** badge to distinguish it from queries.',
      },
      {
        term: 'Input type',
        definition:
          'A named schema object that bundles multiple fields into one argument. e.g. `input OrderInput { customerId: ID!, items: [String!]! }`. Passed as `$input: OrderInput!` — keeps complex mutations clean and validates every nested field on the server.',
      },
      {
        term: 'DeleteResult',
        definition:
          'The return type of `deleteUser` — `{ success: Boolean! }`. Returns `true` when a row was removed, `false` when the id was already absent. Avoids throwing a 404 on a re-delete, making teardown scripts safe to retry.',
      },
      {
        term: 'Idempotency',
        definition:
          'An operation is idempotent when executing it multiple times with the same input produces the same result as executing it once. `deleteUser` twice with the same id: first returns `success: true`, second returns `success: false` — no server error either time. Critical for CI pipeline resilience.',
      },
      {
        term: 'Variable injection safety',
        definition:
          'GraphQL variables travel in a separate JSON field alongside the query string. The server parser never interpolates them into the query text — making injection attacks structurally impossible regardless of what the variable values contain.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- ── Window chrome ─────────────────────────────────────────────────────── -->
  <rect x="0" y="0" width="700" height="430" rx="10" fill="var(--bg)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Title bar -->
  <rect x="0" y="0" width="700" height="32" rx="10" fill="var(--surface)"/>
  <rect x="0" y="22" width="700" height="10" fill="var(--surface)"/>
  <circle cx="18" cy="16" r="5" fill="#ff5f57"/>
  <circle cx="34" cy="16" r="5" fill="#febc2e"/>
  <circle cx="50" cy="16" r="5" fill="#28c840"/>
  <text x="350" y="21" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">GraphQL Studio — Mutations</text>

  <!-- ── Connection bar ────────────────────────────────────────────────────── -->
  <rect x="8" y="38" width="684" height="28" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="16" y="43" width="280" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="24" y="55" fill="var(--text-muted)" font-size="9" font-family="monospace">localhost:4010/graphql</text>
  <rect x="306" y="43" width="68" height="18" rx="9" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="340" y="55" text-anchor="middle" font-size="8.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <rect x="560" y="43" width="72" height="18" rx="4" fill="var(--primary)"/>
  <text x="596" y="55" text-anchor="middle" font-size="9.5" font-weight="700" fill="white">▶ Execute</text>

  <!-- ── Tab bar ───────────────────────────────────────────────────────────── -->
  <rect x="8" y="72" width="684" height="24" fill="var(--bg)" rx="0"/>
  <line x1="8" y1="96" x2="692" y2="96" stroke="var(--border)" stroke-width="1"/>

  <!-- Tab 1: CreateUser — ACTIVE, amber M badge -->
  <rect x="12" y="74" width="122" height="20" rx="4" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="96" y="77" width="15" height="14" rx="3" fill="#f59e0b"/>
  <text x="103.5" y="87.5" text-anchor="middle" font-size="7.5" font-weight="800" fill="white">M</text>
  <text x="54" y="88" text-anchor="middle" font-size="8.5" fill="var(--text)" font-weight="500">CreateUser</text>

  <!-- Tab 2: CreateOrder — inactive amber M -->
  <rect x="140" y="74" width="122" height="20" rx="4" fill="var(--bg)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="224" y="77" width="14" height="14" rx="3" fill="#f59e0b" opacity="0.45"/>
  <text x="231" y="87.5" text-anchor="middle" font-size="7.5" font-weight="800" fill="white">M</text>
  <text x="182" y="88" text-anchor="middle" font-size="8.5" fill="var(--text-muted)">CreateOrder</text>

  <!-- Tab 3: DeleteUser — inactive amber M -->
  <rect x="268" y="74" width="108" height="20" rx="4" fill="var(--bg)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="343" y="77" width="14" height="14" rx="3" fill="#f59e0b" opacity="0.45"/>
  <text x="350" y="87.5" text-anchor="middle" font-size="7.5" font-weight="800" fill="white">M</text>
  <text x="309" y="88" text-anchor="middle" font-size="8.5" fill="var(--text-muted)">DeleteUser</text>

  <!-- ── Editor pane (left 54%) ─────────────────────────────────────────────── -->
  <rect x="8" y="96" width="380" height="186" fill="var(--bg)" stroke="none"/>
  <line x1="388" y1="96" x2="388" y2="282" stroke="var(--border)" stroke-width="1"/>

  <!-- Mode buttons -->
  <rect x="16" y="101" width="48" height="15" rx="3" fill="color-mix(in srgb, var(--primary) 15%, var(--surface))" stroke="var(--primary)" stroke-width="0.8"/>
  <text x="40" y="112" text-anchor="middle" font-size="8" fill="var(--primary)" font-weight="600">Editor</text>
  <rect x="68" y="101" width="48" height="15" rx="3" fill="var(--bg)"/>
  <text x="92" y="112" text-anchor="middle" font-size="8" fill="var(--text-muted)">Builder</text>

  <!-- Line numbers -->
  <text x="16" y="128" fill="var(--text-muted)" font-size="8.5" opacity="0.4" font-family="monospace">1</text>
  <text x="16" y="142" fill="var(--text-muted)" font-size="8.5" opacity="0.4" font-family="monospace">2</text>
  <text x="16" y="156" fill="var(--text-muted)" font-size="8.5" opacity="0.4" font-family="monospace">3</text>
  <text x="16" y="170" fill="var(--text-muted)" font-size="8.5" opacity="0.4" font-family="monospace">4</text>
  <text x="16" y="184" fill="var(--text-muted)" font-size="8.5" opacity="0.4" font-family="monospace">5</text>
  <text x="16" y="198" fill="var(--text-muted)" font-size="8.5" opacity="0.4" font-family="monospace">6</text>
  <text x="16" y="212" fill="var(--text-muted)" font-size="8.5" opacity="0.4" font-family="monospace">7</text>
  <text x="16" y="226" fill="var(--text-muted)" font-size="8.5" opacity="0.4" font-family="monospace">8</text>
  <text x="16" y="240" fill="var(--text-muted)" font-size="8.5" opacity="0.4" font-family="monospace">9</text>

  <!-- Mutation code -->
  <text x="32" y="128" fill="#86efac" font-size="9" font-family="monospace">mutation</text>
  <text x="79" y="128" fill="var(--text)" font-size="9" font-family="monospace"> CreateUser(</text>
  <text x="40" y="142" fill="#c4b5fd" font-size="9" font-family="monospace">$name</text>
  <text x="76" y="142" fill="var(--text)" font-size="9" font-family="monospace">: </text>
  <text x="86" y="142" fill="#7dd3fc" font-size="9" font-family="monospace">String!</text>
  <text x="130" y="142" fill="var(--text-muted)" font-size="9" font-family="monospace">,</text>
  <text x="40" y="156" fill="#c4b5fd" font-size="9" font-family="monospace">$email</text>
  <text x="78" y="156" fill="var(--text)" font-size="9" font-family="monospace">: </text>
  <text x="88" y="156" fill="#7dd3fc" font-size="9" font-family="monospace">String!</text>
  <text x="132" y="156" fill="var(--text)" font-size="9" font-family="monospace">) {</text>
  <text x="32" y="170" fill="#86efac" font-size="9" font-family="monospace">  createUser</text>
  <text x="102" y="170" fill="var(--text)" font-size="9" font-family="monospace">(name: </text>
  <text x="143" y="170" fill="#c4b5fd" font-size="9" font-family="monospace">$name</text>
  <text x="175" y="170" fill="var(--text)" font-size="9" font-family="monospace">,</text>
  <text x="48" y="184" fill="var(--text)" font-size="9" font-family="monospace">       email: </text>
  <text x="130" y="184" fill="#c4b5fd" font-size="9" font-family="monospace">$email</text>
  <text x="164" y="184" fill="var(--text)" font-size="9" font-family="monospace">) {</text>
  <text x="48" y="198" fill="var(--text-muted)" font-size="9" font-family="monospace">  id  name  email</text>
  <text x="32" y="212" fill="var(--text)" font-size="9" font-family="monospace">  }</text>
  <text x="32" y="226" fill="var(--text)" font-size="9" font-family="monospace">}</text>

  <!-- ── Response pane (right 46%) ──────────────────────────────────────────── -->
  <rect x="390" y="96" width="302" height="186" fill="var(--bg)"/>

  <!-- Response header -->
  <rect x="390" y="96" width="302" height="22" fill="var(--surface)" stroke="none"/>
  <line x1="390" y1="118" x2="692" y2="118" stroke="var(--border)" stroke-width="1"/>
  <text x="400" y="111" font-size="9" font-weight="600" fill="var(--text)">Response</text>
  <rect x="466" y="99" width="34" height="14" rx="7" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="0.8"/>
  <text x="483" y="110" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">200</text>
  <text x="510" y="111" font-size="7.5" fill="var(--text-muted)">34ms · POST</text>

  <!-- JSON response -->
  <text x="402" y="136" fill="var(--text)" font-size="8.5" font-family="monospace">{</text>
  <text x="402" y="149" fill="var(--text-muted)" font-size="8.5" font-family="monospace">  "data": {</text>
  <text x="402" y="162" fill="var(--text-muted)" font-size="8.5" font-family="monospace">    "createUser": {</text>
  <text x="402" y="175" fill="var(--text-muted)" font-size="8.5" font-family="monospace">      "id": </text>
  <text x="449" y="175" fill="#7dd3fc" font-size="8.5" font-family="monospace">"usr-1"</text>
  <text x="402" y="188" fill="var(--text-muted)" font-size="8.5" font-family="monospace">      "name": </text>
  <text x="455" y="188" fill="#86efac" font-size="8.5" font-family="monospace">"Carol"</text>
  <text x="402" y="201" fill="var(--text-muted)" font-size="8.5" font-family="monospace">      "email": </text>
  <text x="456" y="201" fill="#7dd3fc" font-size="8.5" font-family="monospace">"carol@demo.local"</text>
  <text x="402" y="214" fill="var(--text-muted)" font-size="8.5" font-family="monospace">    }  }  }</text>

  <!-- id captured callout -->
  <rect x="540" y="168" width="144" height="28" rx="4" fill="color-mix(in srgb, #7dd3fc 10%, var(--surface))" stroke="#7dd3fc" stroke-width="1"/>
  <text x="612" y="180" text-anchor="middle" fill="#7dd3fc" font-size="8" font-weight="600">id captured</text>
  <text x="612" y="191" text-anchor="middle" fill="#7dd3fc" font-size="7.5">→ used by deleteUser</text>
  <line x1="540" y1="182" x2="487" y2="182" stroke="#7dd3fc" stroke-width="0.8" stroke-dasharray="3 2"/>

  <!-- ── Variables bottom panel ─────────────────────────────────────────────── -->
  <rect x="8" y="282" width="684" height="64" fill="var(--surface)" stroke="var(--border)" stroke-width="1" rx="0"/>
  <line x1="8" y1="282" x2="692" y2="282" stroke="var(--border)" stroke-width="1"/>
  <rect x="16" y="286" width="62" height="16" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="47" y="297" text-anchor="middle" font-size="8" fill="var(--text)" font-weight="600">Variables</text>
  <rect x="82" y="286" width="54" height="16" rx="3" fill="var(--bg)"/>
  <text x="109" y="297" text-anchor="middle" font-size="8" fill="var(--text-muted)">Headers</text>
  <text x="16" y="318" fill="var(--text)" font-size="8.5" font-family="monospace">{ </text>
  <text x="28" y="318" fill="#7dd3fc" font-size="8.5" font-family="monospace">"name"</text>
  <text x="68" y="318" fill="var(--text)" font-size="8.5" font-family="monospace">: </text>
  <text x="78" y="318" fill="#86efac" font-size="8.5" font-family="monospace">"Carol"</text>
  <text x="118" y="318" fill="var(--text)" font-size="8.5" font-family="monospace">, </text>
  <text x="130" y="318" fill="#7dd3fc" font-size="8.5" font-family="monospace">"email"</text>
  <text x="172" y="318" fill="var(--text)" font-size="8.5" font-family="monospace">: </text>
  <text x="182" y="318" fill="#86efac" font-size="8.5" font-family="monospace">"carol@demo.local"</text>
  <text x="310" y="318" fill="var(--text)" font-size="8.5" font-family="monospace"> }</text>
  <text x="16" y="334" fill="var(--text-muted)" font-size="7.5" opacity="0.7">Variables travel in a separate JSON field — never interpolated into the query (injection-safe by design)</text>

  <!-- ── Three-mutation legend (bottom) ─────────────────────────────────────── -->
  <line x1="8" y1="348" x2="692" y2="348" stroke="var(--border)" stroke-width="1"/>
  <rect x="8" y="348" width="684" height="76" fill="var(--bg)" rx="0"/>
  <text x="350" y="366" text-anchor="middle" font-size="9.5" font-weight="600" fill="var(--text-muted)">Three Mutations in This Lesson</text>

  <!-- createUser block -->
  <rect x="18" y="374" width="196" height="42" rx="5" fill="color-mix(in srgb, #28c840 12%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="116" y="389" text-anchor="middle" font-size="9" font-weight="700" fill="#28c840">createUser</text>
  <text x="116" y="401" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">scalar args → new id</text>
  <text x="116" y="411" text-anchor="middle" font-size="7.5" fill="var(--text-muted)" font-style="italic">(capture for deleteUser)</text>

  <!-- arrow 1 -->
  <line x1="214" y1="395" x2="238" y2="395" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql6-arr-a)"/>

  <!-- createOrder block -->
  <rect x="240" y="374" width="196" height="42" rx="5" fill="color-mix(in srgb, var(--primary) 12%, var(--surface))" stroke="var(--primary)" stroke-width="1"/>
  <text x="338" y="389" text-anchor="middle" font-size="9" font-weight="700" fill="var(--primary)">createOrder</text>
  <text x="338" y="401" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">input object type</text>
  <text x="338" y="411" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">($input: OrderInput!)</text>

  <!-- arrow 2 -->
  <line x1="436" y1="395" x2="460" y2="395" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#gql6-arr-b)"/>

  <!-- deleteUser block -->
  <rect x="462" y="374" width="224" height="42" rx="5" fill="color-mix(in srgb, #f59e0b 10%, var(--surface))" stroke="#f59e0b" stroke-width="1"/>
  <text x="574" y="389" text-anchor="middle" font-size="9" font-weight="700" fill="#f59e0b">deleteUser × 2</text>
  <text x="574" y="401" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">1st: success true</text>
  <text x="574" y="411" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">2nd: success false (idempotent)</text>

  <defs>
    <marker id="gql6-arr-a" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M1,1 L5,3 L1,5 Z" fill="var(--primary)"/>
    </marker>
    <marker id="gql6-arr-b" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M1,1 L5,3 L1,5 Z" fill="#f59e0b"/>
    </marker>
  </defs>
</svg>`,
  },

  steps: [
    // ── Step 1: Overview ────────────────────────────────────────────────────
    {
      id: 'gql3-intro',
      title: 'Mutation Operations',
      description:
        '**Mutations** are GraphQL operations that write to the server — unlike queries, which are always read-only. ' +
        'The separation matters: HTTP caches, CDNs, and persisted-query layers know never to cache a mutation. ' +
        'When your editor contains a `mutation` block, the tab badge flips from blue **Q** ' +
        'to amber **M** — a constant visual reminder that the next Execute will write data.\n\n' +
        'This lesson walks through three mutations on the port **4010** Docker test server:\n' +
        '- `createUser(name, email)` — scalar arguments, server returns a new `id`\n' +
        '- `createOrder(input: OrderInput!)` — a single structured **input object** variable\n' +
        '- `deleteUser(id)` × 2 — demonstrates **idempotent** delete: `success: false` on the second call, not an error\n\n' +
        'Watch the amber **M** tab badge throughout — it confirms every request in this lesson is a write.',
      highlight: GQL.TAB_BAR,
      pauseAfter: true,
      preAction: prepareGql3IntroReading,
    },

    // ── Step 2: Set endpoint ────────────────────────────────────────────────
    {
      id: 'gql3-endpoint',
      title: 'Connect to the Mutations Server',
      description:
        `Enter \`${GQL_DEMO_HTTP}\` in the endpoint field. This Docker test server exposes a full write-capable API: ` +
        '`createUser`, `createOrder`, and `deleteUser` mutations — plus the familiar `user` and `health` queries.\n\n' +
        'Notice the **Introspect** button activates as soon as a valid URL is entered. ' +
        'Introspection is how the Studio downloads the server\'s schema — including the **Mutation** type with all its write operations. ' +
        'Without introspection, the editor has no autocomplete for mutation field names.',
      highlight: GQL.ENDPOINT_INPUT,
      preAction: prepareGql3EndpointReading,
      action: async (ctx) => {
        await configureDemoTabEndpointOverride(ctx, GQL_DEMO_HTTP);
      },
      pauseAfter: true,
    },

    // ── Step 3: Introspect ──────────────────────────────────────────────────
    {
      id: 'gql3-introspect',
      title: 'Load the Schema',
      description:
        'Click **Introspect** to send the GraphQL built-in `__schema` query. ' +
        'The server responds with a full type map — every Query field, every Mutation field, every custom type.\n\n' +
        'Watch the green **Schema loaded** badge appear with a **non-zero** type count (e.g. `12 types`). ' +
        'A count of `(0)` means something went wrong — wrong port, server not running, or CORS blocked the request. ' +
        'Once loaded, the editor gains full autocomplete for mutation names, argument names, and return fields.',
      highlight: GQL.INTROSPECT_BTN,
      preAction: prepareGql3IntrospectReading,
      action: runGql3IntrospectOnlyAction,
      verify: GQL.SCHEMA_BADGE_OK,
      pauseAfter: true,
    },

    // ── Step 4: Browse Mutation type in schema explorer ─────────────────────
    {
      id: 'gql3-schema-mutations',
      title: 'Explore the Mutation Type',
      description:
        'The **Schema** tab opens on the right, showing every type the server exposes. Find and click **Mutation** in the type list — ' +
        'it expands to show `createUser`, `createOrder`, and `deleteUser` with their full signatures.\n\n' +
        'This is why introspection matters: the editor uses this type data to power autocomplete, flag missing required arguments, and highlight type mismatches before you click Execute. ' +
        'Notice the return types — `createUser` returns a `User` object, while `deleteUser` returns `DeleteResult { success: Boolean! }` instead of the full user.',
      highlight: GQL.SCHEMA_TYPE_MUTATION,
      preAction: prepareGql3SchemaMutationsReading,
      action: runGql3SchemaMutationsAction,
      verify: GQL.SCHEMA_TYPE_MUTATION,
      pauseAfter: true,
    },

    // ── Step 5: Write createUser ────────────────────────────────────────────
    {
      id: 'gql3-write-create',
      title: 'Write the createUser Mutation',
      description:
        'Replace the placeholder `query { }` with a **createUser** mutation:\n\n' +
        '`mutation CreateUser($name: String!, $email: String!) { createUser(name: $name, email: $email) { id name email } }`\n\n' +
        'Watch what happens as you type: the tab badge flips from blue **Q** to amber **M** the moment the editor parses the `mutation` keyword — no button press needed, just a live syntax analysis. ' +
        'The variable tokens `$name` and `$email` appear in purple, distinct from field names in green. ' +
        'The `!` after each type means **non-nullable** — the server will reject the request if either value is missing or null.',
      highlight: GQL.EDITOR,
      preAction: prepareGql3WriteCreateReading,
      action: async (ctx) => {
        await ctx.click(GQL.MODE_EDITOR);
        await ctx.waitFor(`${GQL.EDITOR} .monaco-editor`, 8000);
        await ctx.delay(600);
        await fillGqlEditor(ctx, GQL_CREATE_USER_MUTATION);
        await ctx.delay(700);
      },
      verify: GQL.OP_SELECTOR,
      pauseAfter: true,
    },

    // ── Step 6: Set create vars ─────────────────────────────────────────────
    {
      id: 'gql3-set-create-vars',
      title: 'Provide Variables for Carol',
      description:
        'Open the **Variables** panel below the editor and enter Carol\'s data:\n\n' +
        '`{ "name": "Carol", "email": "carol@demo.local" }`\n\n' +
        'Variable keys match the mutation signature **without** the `$` prefix — `"name"` in JSON maps to `$name` in the mutation. ' +
        'This separation is fundamental: your code never builds a string like `mutation { createUser(name: "${name}") }`. ' +
        'The server always receives code (the query) and data (variables) in separate fields — making injection impossible regardless of what Carol\'s values contain. ' +
        'Missing or null values for `String!` args will be caught before the request is sent.',
      highlight: GQL.VARS_PANEL,
      preAction: prepareGql3SetCreateVarsReading,
      action: async (ctx) => {
        await ensureVariablesPanelOpen(ctx);
        await ctx.delay(400);
        await fillGqlVariables(ctx, GQL_CREATE_USER_VARS, { openPanel: false });
        await ctx.delay(500);
      },
      verify: GQL.VARS_PANEL,
      pauseAfter: true,
    },

    // ── Step 7: Execute create ──────────────────────────────────────────────
    {
      id: 'gql3-exec-create',
      title: 'Execute the Create Mutation',
      description:
        'Click **Execute** — the mutation and Carol\'s variables are both loaded. ' +
        'Under the hood this is a standard HTTP **POST** to `/graphql` with a JSON body containing `{ query, variables }`. ' +
        'The server validates types, runs the write, and returns the new record fields you requested.\n\n' +
        'Watch the **Response** panel appear on the right after the request completes. ' +
        'The amber **M** tab badge confirms this was a write operation. ' +
        'Notice the server echoes back exactly the fields you asked for — `id`, `name`, and `email` — nothing more, nothing less.',
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareGql3ExecCreateReading,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        storeCreatedUserIdFromResponse();
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    // ── Step 8: Observe create response ────────────────────────────────────
    {
      id: 'gql3-observe-create',
      title: 'Read the Create Response',
      description:
        'The **Response** body shows `data.createUser` with the three fields you requested: `id`, `name`, and `email`. ' +
        'The server-assigned `id` (e.g. `"usr-1"`) is the key artifact — it\'s the only stable reference to this record.\n\n' +
        'The lesson automatically captures Carol\'s `id` from this response. You\'ll pass it to `deleteUser` in step 12 without any copy-paste. ' +
        'In production, your client code does the same: extract the returned `id` from the mutation response, store it, and use it for all subsequent operations on that record.',
      highlight: GQL.RESPONSE_DATA_CREATE_USER,
      preAction: prepareGql3ObserveCreateReading,
      action: async (ctx) => {
        await openResponseBodyTab(ctx);
        await ctx.waitFor(GQL.RESPONSE_DATA_CREATE_USER, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_DATA_CREATE_USER,
      pauseAfter: true,
    },

    // ── Step 9: Write createOrder mutation ──────────────────────────────────
    {
      id: 'gql3-write-order-mutation',
      title: 'Input Object Types — createOrder',
      description:
        'Carol\'s **createUser** response is still visible on the right. Now load the **createOrder** mutation into the editor:\n\n' +
        '`mutation CreateOrder($input: OrderInput!) { createOrder(input: $input) { id status customerId } }`\n\n' +
        '**Why an input object instead of scalar args?** `OrderInput` bundles `customerId` and `items` into one structured variable. ' +
        'Compare: `createUser(name: $name, email: $email)` uses two scalars, while `createOrder(input: $input)` uses one named object. ' +
        'Input object types are preferable when mutations have many fields, nested structures, or when you want validation rules defined once in the schema rather than per-call.',
      highlight: GQL.EDITOR,
      preAction: prepareGql3WriteOrderReading,
      action: async (ctx) => {
        await fillGqlEditor(ctx, GQL_CREATE_ORDER_MUTATION);
        await ctx.delay(700);
      },
      pauseAfter: true,
    },

    // ── Step 10: Set createOrder variables ───────────────────────────────────
    {
      id: 'gql3-set-order-vars',
      title: 'Provide the OrderInput Variable',
      description:
        'Fill the **Variables** panel with the nested `input` object:\n\n' +
        '`{ "input": { "customerId": "cust-demo", "items": ["widget", "gadget"] } }`\n\n' +
        'The top-level key `"input"` maps directly to the `$input` variable in the mutation signature. ' +
        'Inside, `customerId` and `items` are validated against the `OrderInput` schema definition — ' +
        'the server will reject the request if `customerId` is missing (`ID!` is non-nullable) or if `items` is not an array of strings. ' +
        'This centralized validation is why input types are preferred over many scalar args for complex payloads.',
      highlight: GQL.VARS_PANEL,
      preAction: prepareGql3SetOrderVarsReading,
      action: async (ctx) => {
        await ensureVariablesPanelOpen(ctx);
        await ctx.delay(400);
        await fillGqlVariables(ctx, GQL_CREATE_ORDER_VARS, { openPanel: false });
        await ctx.delay(500);
      },
      verify: GQL.VARS_PANEL,
      pauseAfter: true,
    },

    // ── Step 11: Execute createOrder ─────────────────────────────────────────
    {
      id: 'gql3-exec-order',
      title: 'Execute createOrder',
      description:
        'Click **Execute** — the `createOrder` mutation and the nested `input` variable are loaded. ' +
        'The server creates the order and returns `{ id, status, customerId }` — the three fields you requested.\n\n' +
        'Compare the two mutations so far: `createUser` used two separate scalar variables (`$name`, `$email`), ' +
        'while `createOrder` uses one structured `$input` object. Same amber **M** badge, same POST mechanism — ' +
        'just a different way to package the arguments. The response body shows the same selection-set pattern: you get exactly what you asked for, nothing extra.',
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareGql3ExecOrderReading,
      action: async (ctx) => {
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        storeOrderExecuted();
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    // ── Step 12: Observe createOrder response ───────────────────────────────
    {
      id: 'gql3-observe-order',
      title: 'Read the createOrder Response',
      description:
        'The **Response** body shows `data.createOrder` with `id`, `status`, and `customerId` — exactly the selection set you declared. ' +
        'Compare to the **createUser** response above: same amber **M** badge and POST transport, but the payload used a nested `$input` object instead of separate scalar variables.\n\n' +
        'In production, you would persist the returned `id` if downstream mutations or workflows need to reference this order.',
      highlight: GQL.RESPONSE_BODY,
      preAction: prepareGql3ObserveOrderReading,
      action: async (ctx) => {
        await openResponseBodyTab(ctx);
        await ctx.waitFor(GQL.RESPONSE_BODY, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },

    // ── Step 13: Write deleteUser mutation ──────────────────────────────────
    {
      id: 'gql3-write-delete',
      title: 'Write the deleteUser Mutation',
      description:
        'The **createOrder** response is visible on the right. Load the **deleteUser** mutation into the editor:\n\n' +
        '`mutation DeleteUser($id: ID!) { deleteUser(id: $id) { success } }`\n\n' +
        'Notice the return type is `DeleteResult { success: Boolean! }` — not the full User object. ' +
        'This is a deliberate schema design: once a record is deleted you can\'t meaningfully return its fields, so the server returns a simple boolean status instead. ' +
        'The `ID!` argument type accepts the `"usr-1"` string captured from Carol\'s create response.',
      highlight: GQL.EDITOR,
      preAction: prepareGql3WriteDeleteReading,
      action: async (ctx) => {
        await fillGqlEditor(ctx, GQL_DELETE_USER_MUTATION);
        await ctx.delay(700);
      },
      pauseAfter: true,
    },

    // ── Step 13: Wire delete variable ───────────────────────────────────────
    {
      id: 'gql3-wire-delete-var',
      title: 'Wire the $id Variable',
      description:
        'The **Variables** panel shows an `"id"` placeholder. ' +
        'The lesson auto-fills Carol\'s `id` captured from the createUser response in step 7 — ' +
        'no manual copy-paste from the Response body required.\n\n' +
        'This mirrors a real client flow: your application stores the `id` from the create response in state, then passes it to any subsequent mutation that targets the same record. ' +
        'The `ID!` type is opaque to the client — you treat it as a string and pass it back verbatim.',
      highlight: GQL.VARS_PANEL,
      preAction: prepareGql3WireDeleteVarReading,
      action: async (ctx) => {
        await ensureVariablesPanelOpen(ctx);
        await ctx.delay(400);
        const userId = getLesson3CreatedUserId() || parseCreatedUserIdFromResponse() || '';
        if (userId) {
          await fillGqlVariables(ctx, JSON.stringify({ id: userId }, null, 2), { openPanel: false });
        }
        await ctx.delay(700);
      },
      verify: GQL.VARS_PANEL,
      pauseAfter: true,
    },

    // ── Step 14: Execute delete (first time) ────────────────────────────────
    {
      id: 'gql3-exec-delete',
      title: 'First Delete — success: true',
      description:
        'Click **Execute** — the `deleteUser` mutation and Carol\'s `$id` are both loaded. ' +
        'The server finds Carol\'s record, removes it, and returns `{ "deleteUser": { "success": true } }`.\n\n' +
        'Notice the response is minimal: just `{ success: true }`. This is the `DeleteResult` type in action — the server confirms the deletion without returning any now-gone user data. ' +
        'Keep the same variables loaded. The next step will click Execute **again** with the same `$id` to observe idempotent delete semantics.',
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareGql3ExecDeleteReading,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        storeFirstDeleteExecuted();
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    // ── Step 15: Idempotent second delete ───────────────────────────────────
    {
      id: 'gql3-idempotency',
      title: 'Second Delete — Idempotency in Action',
      description:
        'The Response above shows `success: true` from the first delete. Now click **Execute** again with the exact same `$id`.\n\n' +
        'Carol\'s record is already gone — but the server returns `success: false` instead of a 404 or an exception. ' +
        'This is **idempotent** delete semantics: the server treats "delete something that no longer exists" as a graceful no-op, not an error.\n\n' +
        'Why does this matter? In CI teardown pipelines, test fixtures are deleted after every run. If a previous run\'s cleanup already removed the record, a naive implementation would throw — causing a false CI failure. ' +
        'An idempotent delete lets you safely retry cleanup scripts without adding `if (exists) { delete }` boilerplate. `success: false` tells you the operation was a no-op, not that something broke.',
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareGql3IdempotencyReading,
      action: async (ctx) => {
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },
  ],
};
