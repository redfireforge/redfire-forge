/** Lesson GQL-18: GraphQL Mutation Node in Workflow */
import type { DemoLesson } from '../../types';
import { GQL, WF } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  LESSON18_WF_NAME,
  LESSON18_TEST_NAME_VAR,
  LESSON18_CREATED_USER_ID_VAR,
  LESSON18_FETCHED_USER_VAR,
  ensureLesson18WorkflowLoaded,
  ensureLesson18MutationConfigured,
  ensureLesson18MutationOutputBound,
  ensureLesson18QueryConfigured,
  ensureLesson18AssertConfigured,
  ensureLesson18QuickTestRun,
  ensureLesson18DeleteNodeAdded,
  gqlWorkflowMutationLessonSetup,
  gqlWorkflowMutationLessonCleanup,
} from './graphql-lesson-helpers';

export const gqlWorkflowMutationLesson: DemoLesson = {
  id: 'gql-workflow-mutation',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Mutation Node in Workflow',
  description:
    'Chain create → read-back → assert in the Workflow Designer using GraphQL Mutation and Query nodes — the standard integration-test pattern for verifying server-side persistence.',
  estimatedMinutes: 4,
  initialTab: 'workflow',
  allowedTabs: ['workflow', 'workflow-runner'],

  dockerEndpoint: GQL_DEMO_HTTP.replace('/graphql', '/health'),
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlWorkflowMutationLessonSetup,
  cleanup: gqlWorkflowMutationLessonCleanup,

  concept: {
    title: 'GraphQL Mutation Node — Write, Bind, Verify, Teardown',
    body: `GQL-16 showed how a **GraphQL Query node** turns a one-off Studio check into an automated latency guard. Real integration tests go further: they **write data**, **read it back**, **assert it persisted correctly**, and **clean up** — all in one workflow run. The **GraphQL Mutation node** is the write step in that chain.

**Why a dedicated Mutation node instead of a Query node with a mutation string?**
Both send HTTP POST requests, but the Mutation node is typed amber **M** on the canvas, validates mutation syntax at config time, and exposes the same **Extraction** and **Output** tabs as the Query node. Downstream nodes can reference \`${LESSON18_CREATED_USER_ID_VAR}\` by name — the binding is explicit and traceable in the Console log, not buried in a raw response body.

**Why bind the returned ID before the read-back query?**
The createUser mutation returns \`{ id, name }\` but only the \`id\` is needed downstream. Binding \`$.createUser.id\` → \`${LESSON18_CREATED_USER_ID_VAR}\` in the **Extraction** tab (analogous to Kafka produce output binding) makes the ID a first-class workflow variable. The Fetch User query then references \`{{${LESSON18_CREATED_USER_ID_VAR}}}\` in its Variables JSON — no hardcoded IDs, no copy-paste between nodes.

**Why read back with a separate Query node?**
Creating and verifying in the same mutation would only prove the server *returned* the right data — not that it *persisted* it. A separate \`user(id: $id)\` query hits a different resolver path and confirms the record survives beyond the mutation response. This is the same create-then-fetch pattern used in every serious integration test suite.

**Why teardown with deleteUser?**
Integration tests that create data without cleaning up pollute shared environments. A final **deleteUser** mutation wired to \`{{${LESSON18_CREATED_USER_ID_VAR}}}\` removes the test record so the next run starts from a clean slate — the same teardown pattern CI pipelines use with \`afterEach\` hooks.`,
    keyTerms: [
      {
        term: 'GraphQL Mutation node',
        definition:
          'Workflow node (amber M badge) that executes a GraphQL write operation — createUser, deleteUser, etc. — and exposes response fields for extraction and output binding.',
      },
      {
        term: 'Extraction rule',
        definition:
          'JSONPath expression (e.g. $.createUser.id) that pulls a nested field from the mutation response into a named workflow variable for downstream nodes.',
      },
      {
        term: 'Read-back query',
        definition:
          'A follow-up GraphQL Query node that fetches the record created by the mutation — proving the server persisted the data, not just returned it in the response.',
      },
      {
        term: 'Variable flow',
        definition:
          'The chain mutation → query → assert: createdUserId flows from Extraction, into query Variables, into assert Source — each node reads what the previous node wrote.',
      },
      {
        term: 'Teardown mutation',
        definition:
          'A final deleteUser mutation that removes test data after assertions pass — prevents shared-environment pollution across repeated runs.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- Window chrome -->
  <rect width="700" height="430" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
  <rect width="700" height="32" rx="10" fill="#1e293b"/>
  <rect y="22" width="700" height="10" fill="#1e293b"/>
  <circle cx="20" cy="16" r="5" fill="#ef4444" opacity="0.8"/>
  <circle cx="38" cy="16" r="5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="56" cy="16" r="5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="21" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="500">Workflow Designer — GraphQL User CRUD Demo</text>

  <!-- Toolbar -->
  <rect y="32" width="700" height="34" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <rect x="12" y="40" width="148" height="18" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="86" y="53" text-anchor="middle" fill="#94a3b8" font-size="9.5">GraphQL User CRUD Demo</text>
  <rect x="542" y="39" width="84" height="20" rx="5" fill="#3b82f6"/>
  <text x="556" y="53" fill="#fff" font-size="9">▶ Quick Test</text>

  <!-- Left palette -->
  <rect x="0" y="66" width="130" height="330" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <text x="65" y="85" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600" letter-spacing="0.5">ACTIONS</text>
  <!-- GraphQL Mutation (highlighted amber) -->
  <rect x="10" y="92" width="110" height="32" rx="5" fill="#451a03" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="65" y="108" text-anchor="middle" fill="#fcd34d" font-size="9" font-weight="600">GraphQL Mutation</text>
  <text x="65" y="119" text-anchor="middle" fill="#fbbf24" font-size="8">Write operations</text>
  <!-- GraphQL Query -->
  <rect x="10" y="130" width="110" height="32" rx="5" fill="#312e81" stroke="#6366f1" stroke-width="1"/>
  <text x="65" y="146" text-anchor="middle" fill="#a5b4fc" font-size="9" font-weight="600">GraphQL Query</text>
  <text x="65" y="157" text-anchor="middle" fill="#818cf8" font-size="8">Read operations</text>
  <!-- GraphQL Assert -->
  <text x="65" y="178" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600" letter-spacing="0.5">LOGIC</text>
  <rect x="10" y="185" width="110" height="32" rx="5" fill="#14532d" stroke="#22c55e" stroke-width="1"/>
  <text x="65" y="201" text-anchor="middle" fill="#86efac" font-size="9" font-weight="600">GraphQL Assert</text>
  <text x="65" y="212" text-anchor="middle" fill="#6ee7b7" font-size="8">Verify response</text>

  <!-- Canvas area -->
  <rect x="130" y="66" width="570" height="330" fill="#0f172a"/>
  <!-- Dot grid -->
  <circle cx="160" cy="100" r="1" fill="#1e293b"/><circle cx="190" cy="100" r="1" fill="#1e293b"/>
  <circle cx="160" cy="130" r="1" fill="#1e293b"/><circle cx="190" cy="130" r="1" fill="#1e293b"/>

  <!-- Start node -->
  <rect x="148" y="175" width="72" height="36" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
  <text x="184" y="197" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600">Start</text>

  <!-- Create User mutation node (amber, pass state) -->
  <rect x="248" y="163" width="96" height="60" rx="6" fill="#451a03" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="296" y="180" text-anchor="middle" fill="#fcd34d" font-size="8" font-weight="700">M Create User</text>
  <text x="296" y="193" text-anchor="middle" fill="#fbbf24" font-size="7">createUser(...)</text>
  <text x="296" y="206" text-anchor="middle" fill="#86efac" font-size="7">→ createdUserId</text>
  <rect x="258" y="212" width="76" height="10" rx="2" fill="#14532d"/>
  <text x="296" y="220" text-anchor="middle" fill="#86efac" font-size="6.5">✓ 42ms</text>

  <!-- Fetch User query node (purple, pass) -->
  <rect x="378" y="163" width="96" height="60" rx="6" fill="#312e81" stroke="#6366f1" stroke-width="1.5"/>
  <text x="426" y="180" text-anchor="middle" fill="#a5b4fc" font-size="8" font-weight="700">Q Fetch User</text>
  <text x="426" y="193" text-anchor="middle" fill="#818cf8" font-size="7">user(id: ...)</text>
  <text x="426" y="206" text-anchor="middle" fill="#86efac" font-size="7">→ fetchedUser</text>
  <rect x="388" y="212" width="76" height="10" rx="2" fill="#14532d"/>
  <text x="426" y="220" text-anchor="middle" fill="#86efac" font-size="6.5">✓ 18ms</text>

  <!-- Verify Assert node (green, pass) -->
  <rect x="508" y="163" width="96" height="60" rx="6" fill="#14532d" stroke="#22c55e" stroke-width="1.5"/>
  <text x="556" y="180" text-anchor="middle" fill="#86efac" font-size="8" font-weight="700">✓ Verify User</text>
  <text x="556" y="193" text-anchor="middle" fill="#6ee7b7" font-size="7">$.user.name</text>
  <text x="556" y="206" text-anchor="middle" fill="#6ee7b7" font-size="7">= {{testName}}</text>
  <rect x="518" y="212" width="76" height="10" rx="2" fill="#14532d"/>
  <text x="556" y="220" text-anchor="middle" fill="#86efac" font-size="6.5">✓ pass</text>

  <!-- Delete User mutation (teardown, below main chain) -->
  <rect x="508" y="268" width="96" height="52" rx="6" fill="#451a03" stroke="#f59e0b" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="556" y="285" text-anchor="middle" fill="#fcd34d" font-size="8" font-weight="700">M Delete User</text>
  <text x="556" y="298" text-anchor="middle" fill="#fbbf24" font-size="7">deleteUser(id)</text>
  <text x="556" y="311" text-anchor="middle" fill="#64748b" font-size="6.5">teardown</text>

  <!-- End node -->
  <rect x="628" y="175" width="56" height="36" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
  <text x="656" y="197" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600">End</text>

  <!-- Edges (main chain) -->
  <line x1="220" y1="193" x2="246" y2="193" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr18)"/>
  <line x1="344" y1="193" x2="376" y2="193" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr18)"/>
  <line x1="474" y1="193" x2="506" y2="193" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr18)"/>
  <line x1="604" y1="193" x2="626" y2="193" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr18)"/>
  <!-- Assert → Delete (teardown branch) -->
  <line x1="556" y1="223" x2="556" y2="266" stroke="#64748b" stroke-width="1" stroke-dasharray="4,3" marker-end="url(#arr18d)"/>
  <!-- Delete → End -->
  <line x1="604" y1="294" x2="656" y2="210" stroke="#64748b" stroke-width="1" stroke-dasharray="4,3"/>

  <!-- Variable flow annotation -->
  <rect x="140" y="340" width="420" height="44" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="350" y="356" text-anchor="middle" fill="#94a3b8" font-size="8" font-weight="600">Variable flow</text>
  <text x="350" y="372" text-anchor="middle" fill="#60a5fa" font-size="8">createUser.id → createdUserId → user(id) query → fetchedUser → assert $.user.name</text>

  <!-- Console panel (collapsed badge) -->
  <rect x="130" y="392" width="570" height="28" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <text x="148" y="410" fill="#64748b" font-size="8">Console</text>
  <circle cx="178" cy="406" r="4" fill="#22c55e"/>
  <text x="190" y="410" fill="#86efac" font-size="7.5">M createUser 200 · Q user 200 · ✓ assert pass · M deleteUser 200</text>

  <defs>
    <marker id="arr18" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
      <path d="M0,0 L5,2.5 L0,5 Z" fill="#3b82f6"/>
    </marker>
    <marker id="arr18d" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
      <path d="M0,0 L5,2.5 L0,5 Z" fill="#64748b"/>
    </marker>
  </defs>
</svg>`,
  },

  steps: [
    {
      id: 'gql18-intro',
      title: 'GraphQL Mutation Node — The Write Step',
      description:
        `The **GraphQL Mutation node** (amber **M** badge) is the workflow equivalent of Kafka's **produce node**: it writes data to the server and binds returned fields as variables for downstream nodes.\n\nUnlike the Query node (blue **Q**), the Mutation node validates write operations at config time and exposes the same **Extraction** and **Output** tabs for binding response fields. This lesson builds the standard integration-test chain: **create → read back → assert → delete**.\n\nPrerequisite: **GQL-16 Workflow Integration** showed the Query + Assert pattern. Here we extend it with a write step at the front and a teardown step at the end.\n\nThe seeded **${LESSON18_WF_NAME}** workflow is already loaded — four nodes wired on the canvas, ready to configure.`,
      highlight: WF.PAL_GQL_MUTATION,
      preAction: gqlWorkflowMutationLessonSetup,
      pauseAfter: true,
    },

    {
      id: 'gql18-canvas-tour',
      title: 'The Mutation Workflow Canvas',
      description:
        `The canvas shows the complete CRUD test chain:\n\n**Start** → **Create User** (Mutation) → **Fetch User** (Query) → **Verify User** (Assert) → **End**\n\nEach arrow represents data flowing left to right. The Mutation node writes a user and binds the returned \`id\`. The Query node reads that user back using the bound ID. The Assert node verifies the name matches. This is the same create-then-verify pattern every integration test suite uses — just visual instead of code.\n\nNotice the amber **M** badge on Create User and the purple **Q** on Fetch User — the color coding tells you at a glance which nodes write vs read.`,
      highlight: WF.CANVAS,
      preAction: ensureLesson18WorkflowLoaded,
      action: async (ctx) => {
        await ensureLesson18WorkflowLoaded(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_MUTATION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql18-config-mutation',
      title: 'Configure the createUser Mutation',
      description:
        `Double-click **Create User** to open its config panel. On the **Operation** tab:\n\n- **Endpoint:** \`${GQL_DEMO_HTTP}\`\n- **Mutation:** \`createUser(name: $name, email: $email) { id name }\`\n\nSwitch to the **Variables** tab and set:\n\`\`\`json\n{ "name": "{{${LESSON18_TEST_NAME_VAR}}}", "email": "demo@example.com" }\n\`\`\`\n\nThe \`{{${LESSON18_TEST_NAME_VAR}}}\` token resolves at runtime from the workflow's variable store (pre-set to "Demo User"). This means the same workflow can create different users per run without editing the mutation text — the same pattern as environment variables in CI.`,
      highlight: GQL.WF_MUTATION_PANEL,
      preAction: ensureLesson18WorkflowLoaded,
      action: async (ctx) => {
        await ensureLesson18MutationConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_MUTATION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql18-output-binding',
      title: 'Bind the Returned User ID',
      description:
        `Still in the **Create User** config, switch to the **Extraction** tab. Click **+ Add** and configure:\n\n- **JSONPath:** \`$.createUser.id\`\n- **Variable name:** \`${LESSON18_CREATED_USER_ID_VAR}\`\n\nSave.\n\nThis is the GraphQL equivalent of Kafka produce **output binding**: the mutation response field becomes a named workflow variable that every downstream node can reference as \`{{${LESSON18_CREATED_USER_ID_VAR}}}\`. Without this binding, the Query node would have no way to know which user ID to fetch — you'd be hardcoding IDs or parsing raw JSON manually.`,
      highlight: GQL.WF_EXTRACTION_TABLE,
      preAction: ensureLesson18MutationConfigured,
      action: async (ctx) => {
        await ensureLesson18MutationOutputBound(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_MUTATION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql18-config-query',
      title: 'Read Back the Created User',
      description:
        `Double-click **Fetch User** (the Query node). Configure:\n\n- **Endpoint:** \`${GQL_DEMO_HTTP}\`\n- **Query:** \`user(id: $id) { id name }\`\n- **Variables:** \`{ "id": "{{${LESSON18_CREATED_USER_ID_VAR}}}" }\`\n\nOn the **Output** tab, bind field \`data\` → variable \`${LESSON18_FETCHED_USER_VAR}\`.\n\nWhy a separate read-back query? The mutation response only proves the server *returned* the right data in that HTTP response — not that it *persisted* it to storage. A follow-up \`user(id:)\` query hits a different code path and confirms the record actually exists. This is the difference between a smoke test and a real integration test.`,
      highlight: GQL.WF_QUERY_PANEL,
      preAction: ensureLesson18MutationOutputBound,
      action: async (ctx) => {
        await ensureLesson18QueryConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_QUERY_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql18-assert',
      title: 'Assert the User Name Matches',
      description:
        `Double-click **Verify User** (Assert node). On the **Source** tab, set **Source variable** to \`${LESSON18_FETCHED_USER_VAR}\` — the query response bound in the previous step.\n\nOn the **Assertions** tab, add:\n- **JSONPath:** \`$.user.name\`\n- **Operator:** \`equals\`\n- **Expected:** \`{{${LESSON18_TEST_NAME_VAR}}}\`\n- **Description:** "Fetched user name matches testName"\n\nSave. The variable chain is now complete: Mutation writes \`${LESSON18_CREATED_USER_ID_VAR}\` → Query reads it into \`${LESSON18_FETCHED_USER_VAR}\` → Assert checks \`$.user.name\` equals the original \`${LESSON18_TEST_NAME_VAR}\`. If any link breaks, the assert fails with the GraphQL operation context visible — not just a bare comparison error.`,
      highlight: GQL.WF_ASSERT_PANEL,
      preAction: ensureLesson18QueryConfigured,
      action: async (ctx) => {
        await ensureLesson18AssertConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_ASSERT_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql18-quick-test',
      title: 'Quick Test — Full Chain Passes',
      description:
        `Click **▶ Quick Test**. Watch the canvas as each node executes in sequence:\n\n1. **Create User** turns green — mutation returns an \`id\`, \`${LESSON18_CREATED_USER_ID_VAR}\` is bound\n2. **Fetch User** turns green — query retrieves the user using that ID\n3. **Verify User** turns green — \`$.user.name\` equals \`{{${LESSON18_TEST_NAME_VAR}}}\`\n\nOpen the **Console** to see the full request/response log: mutation payload, query payload, extracted variables, and assertion result. All three nodes should show green badges with execution times under 100ms against the local Docker server.`,
      highlight: WF.QUICK_TEST_BTN,
      preAction: ensureLesson18AssertConfigured,
      action: async (ctx) => {
        await ensureLesson18QuickTestRun(ctx);
        await ctx.delay(800);
      },
      verify: WF.EXEC_SUMMARY,
      pauseAfter: true,
    },

    {
      id: 'gql18-cleanup',
      title: 'Teardown with deleteUser',
      description:
        `Integration tests must clean up after themselves. Click **GraphQL Mutation** in the palette again and add a **Delete User** node. Rewire: **Verify User → Delete User → End**.\n\nConfigure the delete mutation:\n- **Endpoint:** \`${GQL_DEMO_HTTP}\`\n- **Mutation:** \`deleteUser(id: $id) { success }\`\n- **Variables:** \`{ "id": "{{${LESSON18_CREATED_USER_ID_VAR}}}" }\`\n\nThis is the workflow equivalent of an \`afterEach\` teardown hook: every test run creates a user, verifies it, then deletes it — leaving the shared Docker server in the same state it started in. Re-run Quick Test to confirm all four nodes pass in sequence.`,
      highlight: WF.PAL_GQL_MUTATION,
      preAction: ensureLesson18QuickTestRun,
      action: async (ctx) => {
        await ensureLesson18DeleteNodeAdded(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_MUTATION_NODE,
      pauseAfter: true,
    },
  ],
};
