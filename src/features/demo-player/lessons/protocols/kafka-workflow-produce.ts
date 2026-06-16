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
import { kafkaPublishSetup, kafkaCleanup } from '../setup-helpers';
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
    variables: { topic: 'orders.created' },
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
          clusterId: '',
          topic: '{{topic}}',
          keyTemplate: '',
          partition: undefined,
          headers: [],
          bodyTemplate: '{"demo":"workflow","runId":"{{runId}}"}',
          ackMode: 'all',
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
  // Ensure cluster is created and connected first
  await kafkaPublishSetup(ctx);

  // Seed the demo workflow (delete stale copy first)
  const win = window as unknown as Record<string, unknown>;
  const wfDelete = win.__wfDeleteByName as ((name: string) => void) | undefined;
  const wfInsert = win.__wfInsertWorkflow as ((wf: Record<string, unknown>) => void) | undefined;
  if (wfDelete) wfDelete('Kafka Produce Demo');
  if (wfInsert) {
    await ctx.delay(100);
    wfInsert(createKafkaProduceDemoWorkflow());
  }

  // Navigate to workflow designer
  ctx.navigateToTab('workflow');
  await ctx.delay(700);
}

async function kafkaWorkflowProduceCleanup(ctx: DemoActionContext): Promise<void> {
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

/** Click the kafkaProduce node on the canvas and wait for the config panel. */
async function openProduceNodeConfig(ctx: DemoActionContext): Promise<void> {
  const node = document.querySelector<HTMLElement>(KAFKA.NODE_PRODUCE);
  if (node) {
    node.click();
    await ctx.delay(400);
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
        'You\'re in the **Workflow Designer**. The sidebar on the left lists all saved workflows. The canvas shows a workflow graph — nodes connected by edges. Kafka nodes let you produce and consume messages as part of automated test sequences.',
      highlight: WF.CANVAS,
      preAction: async (ctx) => {
        // Select the seeded workflow if not already shown
        await selectKafkaProduceDemoWorkflow(ctx);
      },
    },

    // Step 2: Show the canvas with the seeded workflow
    {
      id: 'wp-canvas',
      title: 'The Produce Demo Workflow',
      description:
        'The **Kafka Produce Demo** workflow is a three-node chain: Start → kafkaProduce → End. The `kafkaProduce` node in the middle is the one you\'ll configure. Double-click it to open the config panel.',
      highlight: KAFKA.NODE_PRODUCE,
    },

    // Step 3: Open the palette
    {
      id: 'wp-palette',
      title: 'Node Palette',
      description:
        'New nodes come from the **Palette** — the collapsible panel on the right edge of the canvas. It groups nodes by category: HTTP, WebSocket, Kafka, Control Flow, and more. Search for "kafka" to filter to Kafka-specific nodes.',
      highlight: WF.PALETTE,
      preAction: async (ctx) => {
        // Open the palette panel if it has a toggle
        const paletteToggle = document.querySelector<HTMLElement>('[data-testid="palette-toggle"], [title="Add node"]');
        if (paletteToggle) {
          paletteToggle.click();
          await ctx.delay(300);
        }
      },
    },

    // Step 4: Click the produce node to open config
    {
      id: 'wp-config',
      title: 'Open Node Config',
      description:
        'Click the **kafkaProduce** node on the canvas to open its configuration panel. The panel slides in from the right with all fields: Cluster, Topic, Key, Ack Mode, Headers, Body Template, and Output Bindings.',
      highlight: KAFKA.NODE_PRODUCE,
      action: async (ctx) => {
        await openProduceNodeConfig(ctx);
        await ctx.delay(400);
      },
    },

    // Step 5: Show config fields
    {
      id: 'wp-fields',
      title: 'Config Fields',
      description:
        'The **Cluster** dropdown lists your configured Kafka clusters. **Topic** and **Body Template** support `{{variable}}` syntax — these are resolved from the workflow\'s variable map at run time. The `{{topic}}` variable is pre-set to `orders.created` in this demo.',
      highlight: KAFKA.NODE_TOPIC_INPUT,
    },

    // Step 6: Output bindings
    {
      id: 'wp-bindings',
      title: 'Output Bindings',
      description:
        '**Output Bindings** extract values from the produce result and store them as variables. This demo binds `partition` → `sentPartition`, making the partition number available to downstream nodes. You could bind `offset` to verify the message was consumed later.',
      highlight: KAFKA.NODE_BINDING_ADD_BTN,
    },

    // Step 7: Quick Test
    {
      id: 'wp-quicktest',
      title: 'Quick Test',
      description:
        'Click **Quick Test** (▶ in the toolbar) to run the workflow once. The Designer executes each node in sequence, showing a real-time progress indicator on each node. Quick Test requires a connected cluster — if the cluster isn\'t set, configure it in the node\'s Cluster dropdown first.',
      highlight: WF.QUICK_TEST_BTN,
      action: async (ctx) => {
        await ctx.click(WF.QUICK_TEST_BTN);
        await ctx.delay(1500);
      },
    },

    // Step 8: Console output
    {
      id: 'wp-result',
      title: 'Read the Console',
      description:
        'The **Console** at the bottom shows the execution log. For a produce node you\'ll see: cluster, topic, message key, partition, offset, and the `sentPartition` variable value. If the cluster isn\'t connected, the error is also shown here with a clear message.',
      highlight: WF.CONSOLE,
    },

    // Step 9: Summary
    {
      id: 'wp-summary',
      title: 'Produce Node Summary',
      description:
        'You now know how to: add a `kafkaProduce` node, configure it with `{{variable}}` topic and body templates, bind the output partition to a variable, and Quick Test the workflow. In the next lesson, you\'ll add `kafkaConsume` and `kafkaWait` nodes to complete the event-driven round-trip.',
      highlight: WF.CANVAS,
    },
  ],
};
