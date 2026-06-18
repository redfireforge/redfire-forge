/**
 * Lesson K9: Workflow — Kafka Produce Node
 *
 * Shows how to configure a kafkaProduce node in the Workflow Designer:
 * select cluster, set topic + body template, add output bindings, and run Quick Test.
 *
 * Setup seeds a minimal Start → kafkaProduce → End workflow so the lesson
 * lands on a pre-populated canvas ready to explore.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { ensureKafkaConnected, kafkaCleanup } from '../setup-helpers';
import { WF, KAFKA } from '../../../../shared/selectors';

// ── Seeded workflow factory ────────────────────────────────────────

function createKafkaProduceDemoWorkflow(): Record<string, unknown> {
  const startId = crypto.randomUUID();
  const produceId = crypto.randomUUID();
  const endId = crypto.randomUUID();
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: 'Kafka Produce Demo',
    schemaVersion: 6,
    variables: { topic: 'orders.created', runId: 'demo-run-1' },
    services: [],
    hostProfiles: [],
    authProfiles: [],
    nodes: [
      {
        id: startId,
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: produceId,
        type: 'kafkaProduce',
        position: { x: 250, y: 160 },
        data: {
          label: 'Kafka Produce',
          clusterId: 'demo-plaintext',
          topic: '{{topic}}',
          keyTemplate: '',
          partition: undefined,
          headers: [],
          bodyTemplate: '{"demo":"workflow","runId":"{{runId}}"}',
          ackMode: 'leader',
          timeoutMs: 10000,
          outputBindings: [{ source: 'partition', targetVariable: 'sentPartition' }],
        },
      },
      {
        id: endId,
        type: 'end',
        position: { x: 250, y: 280 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: crypto.randomUUID(), source: startId, target: produceId },
      { id: crypto.randomUUID(), source: produceId, target: endId },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

// ── Setup / Cleanup ────────────────────────────────────────────────

async function kafkaWorkflowProduceSetup(ctx: DemoActionContext): Promise<void> {
  try { await ensureKafkaConnected(); } catch { /* server may not be running */ }

  // Seed the demo workflow (delete stale copy first)
  const win = window as unknown as Record<string, unknown>;
  const wfDelete = win.__wfDeleteByName as ((name: string) => void) | undefined;
  const wfInsert = win.__wfInsertWorkflow as ((wf: Record<string, unknown>) => void) | undefined;
  if (wfDelete) wfDelete('Kafka Produce Demo');
  if (wfInsert) {
    await ctx.delay(100);
    wfInsert(createKafkaProduceDemoWorkflow());
  }

  ctx.navigateToTab('workflow');
  await ctx.delay(900);

  // Close console if open so it doesn't obstruct the canvas
  const consolePanel = document.querySelector<HTMLElement>('.wf-console-panel');
  if (consolePanel) {
    const badge = document.querySelector<HTMLElement>('.wf-console-badge');
    if (badge) { badge.click(); await ctx.delay(300); }
  }

  const fitBtn = document.querySelector('button[title="Fit view"]') as HTMLElement | null;
  if (fitBtn) { fitBtn.click(); await ctx.delay(400); }
}

async function kafkaWorkflowProduceCleanup(ctx: DemoActionContext): Promise<void> {
  // Close console so it doesn't carry over into the next lesson
  const consolePanel = document.querySelector<HTMLElement>('.wf-console-panel');
  if (consolePanel) {
    const badge = document.querySelector<HTMLElement>('.wf-console-badge');
    if (badge) { badge.click(); await ctx.delay(300); }
  }

  const win = window as unknown as Record<string, unknown>;
  const wfDelete = win.__wfDeleteByName as ((name: string) => void) | undefined;
  if (wfDelete) wfDelete('Kafka Produce Demo');
  await kafkaCleanup(ctx);
}

// ── Helpers ────────────────────────────────────────────────────────

/** Select the "Kafka Produce Demo" workflow from the sidebar. */
async function selectKafkaProduceDemoWorkflow(ctx: DemoActionContext): Promise<void> {
  const items = Array.from(document.querySelectorAll('.wf-sidebar-item, [data-testid="wf-sidebar-item"], .wf-workflow-item'));
  const target = items.find((el) => el.textContent?.includes('Kafka Produce Demo')) as HTMLElement | undefined;
  if (target) {
    target.click();
    await ctx.delay(500);
  }
}

/** Double-click the kafkaProduce node on the canvas to open its config modal. */
async function openProduceNodeConfig(ctx: DemoActionContext): Promise<void> {
  const node = document.querySelector<HTMLElement>(KAFKA.NODE_PRODUCE);
  if (node) {
    // Node config requires a double-click — single click only selects the node.
    node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    await ctx.delay(600);
  }
}

export const kafkaWorkflowProduceLesson: DemoLesson = {
  id: 'kafka-workflow-produce',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Workflow: Produce Node',
  description:
    'Add a kafkaProduce node to a workflow, configure cluster + topic + body template with {{variables}}, add output bindings, and run a Quick Test.',
  estimatedMinutes: 5,
  // No initialTab — setup navigates to workflow directly

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',

  setup: kafkaWorkflowProduceSetup,
  cleanup: kafkaWorkflowProduceCleanup,

  concept: {
    title: 'Kafka Nodes in the Workflow Designer',
    body: `The **Workflow Designer** lets you compose Kafka operations into reusable, parameterised sequences. Where the Studio tabs are for ad-hoc testing, workflow nodes are for **automated, repeatable flows** you can run from the Test Harness.

The **kafkaProduce** node publishes one message per execution. Key fields:
| Field | Purpose |
|---|---|
| **Cluster** | Which configured Kafka cluster to use (dropdown populated from Settings) |
| **Topic** | Topic name — supports \`{{variable}}\` substitution |
| **Key** | Optional message key — determines partition assignment |
| **Body Template** | JSON (or raw string) body — \`{{variable}}\` placeholders are resolved at run time |
| **Headers** | Additional key-value pairs attached to the message envelope |
| **Ack Mode** | \`all\` = wait for all ISRs; \`leader\` = only leader; \`none\` = fire-and-forget |

**Output Bindings** extract values from the produce result and store them as variables:
- \`partition\` → the partition the message landed in
- \`offset\` → the message's log offset
- \`timestamp\` → server-side timestamp

These variables flow into subsequent nodes — e.g., a \`kafkaConsume\` node can filter by offset to verify the message was actually consumed.`,
    keyTerms: [
      {
        term: 'Body Template',
        definition:
          'The message body with optional `{{variable}}` placeholders. At run time, the workflow engine substitutes variable values — enabling data-driven produce patterns.',
      },
      {
        term: 'Output Binding',
        definition:
          'A mapping from a produce result field (partition, offset, timestamp) to a named variable. The variable is then available to all downstream nodes in the workflow.',
      },
      {
        term: 'Ack Mode',
        definition:
          'Controls how many broker replicas must acknowledge the produce before the node returns success. `all` is safest; `none` has the lowest latency but risks data loss.',
      },
      {
        term: 'Quick Test',
        definition:
          'A single-execution test run within the Workflow Designer. It runs the workflow once, shows the node-by-node execution log in the Console, and discards the result (no history saved).',
      },
    ],
    diagram: `<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Start node -->
  <ellipse cx="150" cy="28" rx="40" ry="18" fill="var(--success,#a6e3a1)" opacity="0.3" stroke="var(--success,#a6e3a1)" stroke-width="1.5"/>
  <text x="150" y="33" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">Start</text>
  <!-- Arrow -->
  <line x1="150" y1="46" x2="150" y2="72" stroke="var(--border,#45475a)" stroke-width="1.5" marker-end="url(#wp-arr)"/>
  <!-- kafkaProduce node -->
  <rect x="70" y="74" width="160" height="64" rx="6" fill="var(--primary)" opacity="0.18" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="150" y="93" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">kafkaProduce</text>
  <text x="150" y="107" text-anchor="middle" fill="var(--text-muted)" font-size="9">cluster: local-plaintext</text>
  <text x="150" y="119" text-anchor="middle" fill="var(--text-muted)" font-size="9">topic: {{"{{"}}topic{{"}}"}}</text>
  <text x="150" y="131" text-anchor="middle" fill="var(--text-muted)" font-size="9">→ sentPartition</text>
  <!-- Arrow -->
  <line x1="150" y1="138" x2="150" y2="162" stroke="var(--border,#45475a)" stroke-width="1.5" marker-end="url(#wp-arr)"/>
  <!-- End node -->
  <ellipse cx="150" cy="176" rx="40" ry="18" fill="var(--error,#f38ba8)" opacity="0.2" stroke="var(--error,#f38ba8)" stroke-width="1.5"/>
  <text x="150" y="181" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">End</text>
  <defs>
    <marker id="wp-arr" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="var(--border,#45475a)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // Step 1: Intro — show the workflow canvas
    {
      id: 'wp-intro',
      title: 'Kafka Produce Node',
      description:
        '**⚠️ Prerequisite:** To run Quick Test, ensure the Redpanda stack is running: `cd docker/kafka/plaintext && docker compose up -d`\n\n' +
        'You\'re in the **Workflow Designer**. The sidebar on the left lists all saved workflows. The canvas shows a workflow graph — nodes connected by edges. Kafka nodes let you produce and consume messages as part of automated test sequences.',
      highlight: '.wf-canvas-area',
      preAction: async (ctx) => {
        await selectKafkaProduceDemoWorkflow(ctx);
      },
    },

    // Step 2: Show the canvas with the seeded workflow
    {
      id: 'wp-canvas',
      title: 'The Produce Demo Workflow',
      description:
        'The **Kafka Produce Demo** workflow is a three-node chain: **Start → Kafka Produce → End**. The `Kafka Produce` node in the middle is the one we\'ll explore — its Cluster ID, Topic, Body Template, and Output Bindings are already pre-configured by setup.',
      highlight: KAFKA.NODE_PRODUCE,
    },

    // Step 3: Open the palette
    {
      id: 'wp-palette',
      title: 'Node Palette',
      description:
        'New nodes come from the **Blocks Palette** — the panel on the **left sidebar** of the canvas. It groups nodes by category: Triggers, Actions, and Connections. Scroll down to the **Actions** section to find Kafka-specific nodes: **Kafka Produce**, **Kafka Consume**, **Kafka Wait**.',
      highlight: '.wf-palette',
    },

    // Step 4: Double-click the produce node to open config modal
    {
      id: 'wp-config',
      title: 'Open Node Config',
      description:
        'The **Kafka Produce** node is double-clicked to open its configuration panel. The panel appears on the right with tabs: **Config**, **Input**, **Output**, and **Logs**. The Config tab shows all fields: Label, Cluster ID, Topic, Key Template, Headers, Body Template, Ack Mode, and Output Bindings.',
      highlight: '.wf-config-modal-scroll',
      preAction: async (ctx) => {
        await openProduceNodeConfig(ctx);
      },
      verify: '.wf-config-modal',
    },

    // Step 5: Show config fields (config modal is open from step 4)
    {
      id: 'wp-fields',
      title: 'Config Fields',
      description:
        'The **Cluster ID** field is set to `demo-plaintext` — the cluster created during setup. **Topic** uses `{{topic}}` syntax which resolves to `orders.created` at run time. The **Body Template** also uses `{{variable}}` placeholders: `{{runId}}` is resolved from the workflow\'s variable map.',
      highlight: 'input[placeholder="cluster-a"]',
    },

    // Step 6: Output bindings — scroll down in config
    {
      id: 'wp-bindings',
      title: 'Output Bindings',
      description:
        'Scroll down in the Config panel to find **Output Bindings**. They extract values from the produce result and store them as workflow variables. This demo binds `partition` → `sentPartition`, making the partition number available to downstream nodes. Click **+ Add Binding** to add more (e.g., `offset`, `timestamp`).',
      highlight: '[data-testid="output-bindings-section"]',
      preAction: async (ctx) => {
        const section = document.querySelector<HTMLElement>('[data-testid="output-bindings-section"]');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await ctx.delay(400);
      },
    },

    // Step 7: Close config modal and open Console
    {
      id: 'wp-open-console',
      title: 'Open the Console',
      description:
        'The config panel is closed. Before running Quick Test, open the **Console** by clicking the Console badge in the status bar at the bottom. The Console must be open *before* execution so it captures the full log — opening it afterwards shows an empty panel.',
      highlight: '.wf-console-badge',
      preAction: async (ctx) => {
        const footer = document.querySelector<HTMLElement>('.wf-config-modal-footer-actions');
        const closeBtn = footer?.querySelector<HTMLElement>('.btn-ghost');
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(600);
        }
      },
      action: async (ctx) => {
        const panel = document.querySelector<HTMLElement>('.wf-console-panel');
        if (!panel) {
          const badge = document.querySelector<HTMLElement>('.wf-console-badge');
          if (badge) {
            badge.click();
            await ctx.delay(500);
          }
        }
      },
    },

    // Step 8: Quick Test
    {
      id: 'wp-quicktest',
      title: 'Quick Test',
      description:
        'Click **Quick Test** (▶ in the toolbar) to run the workflow once. The Designer executes each node in sequence, showing a real-time progress indicator on each node. Watch the **Console** — it fills with the execution log in real time. The status bar at the bottom shows pass/fail and duration.',
      highlight: WF.QUICK_TEST_BTN,
      action: async (ctx) => {
        await ctx.click(WF.QUICK_TEST_BTN);
        await ctx.waitFor('.wf-status-bar', 5000);
        await ctx.delay(3000);
      },
    },

    // Step 9: Console output
    {
      id: 'wp-result',
      title: 'Read the Console',
      description:
        'The **Console** now shows the execution log. For a produce node you\'ll see: cluster, topic, message key, partition, offset, and the `sentPartition` variable value. If the cluster isn\'t connected, the error is also shown here with a clear message.',
      highlight: '.wf-console-body',
    },

    // Step 10: Summary
    {
      id: 'wp-summary',
      title: 'Produce Node Summary',
      description:
        'You now know how to: add a `kafkaProduce` node, configure it with `{{variable}}` topic and body templates, bind the output partition to a variable, and Quick Test the workflow. In the next lesson, you\'ll add `kafkaConsume` and `kafkaWait` nodes to complete the event-driven round-trip.',
      highlight: '.wf-canvas-area',
      preAction: async (ctx) => {
        const panel = document.querySelector<HTMLElement>('.wf-console-panel');
        if (panel) {
          const badge = document.querySelector<HTMLElement>('.wf-console-badge');
          if (badge) { badge.click(); await ctx.delay(400); }
        }
      },
    },
  ],
};
