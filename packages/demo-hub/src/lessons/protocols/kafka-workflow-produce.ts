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
import {
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  collapseWfDemoAppSidebar,
  ensureLessonWorkflowShown,
  ensureWfNodeConfigModalOpen,
  getWfConfigDemoTiming,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  scrollWfConfigFieldIntoView,
  scrollWfConfigModalToTop,
  selectWorkflowFromAppSidebar,
  setWfConfigDemoTiming,
  waitForWfConfigPanel,
  WF_CONFIG_DEMO_TIMING_BRISK,
} from '../wf-demo-helpers';
import { deleteWorkflowByName, seedNamedWorkflow } from '../../adapters';
import { showSpotlightRing } from '../../demoRipple';
import { WF, KAFKA } from '@shared/selectors';

const DEMO_WF_NAME = 'Kafka Produce Demo';

// ── Seeded workflow factory ────────────────────────────────────────

function createKafkaProduceDemoWorkflow(): Record<string, unknown> {
  const startId = crypto.randomUUID();
  const produceId = crypto.randomUUID();
  const endId = crypto.randomUUID();
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: DEMO_WF_NAME,
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
          clusterId: 'demo-cluster',
          topic: '{{topic}}',
          keyTemplate: '',
          partition: undefined,
          headers: [],
          bodyTemplate: [
            '{',
            '  "demo": "workflow",',
            '  "runId": "{{runId}}"',
            '}',
          ].join('\n'),
          ackMode: 'leader',
          timeoutMs: 10000,
          outputBindings: [{ id: 'b1', source: 'partition', targetVariable: 'sentPartition', enabled: true }],
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

  await seedNamedWorkflow(ctx, DEMO_WF_NAME, createKafkaProduceDemoWorkflow(), {
    deleteDelayMs: 0,
    insertPreDelayMs: 100,
    insertDelayMs: 0,
  });

  ctx.navigateToTab('workflow');
  await ctx.delay(450);

  await closeWfConsoleIfOpen(ctx);
  await closeWfConfigModalIfOpen(ctx);
  await collapseWfDemoAppSidebar(ctx);
}

async function kafkaWorkflowProduceCleanup(ctx: DemoActionContext): Promise<void> {
  await closeDefaultsModalIfOpen(ctx);
  await closeWfConfigModalIfOpen(ctx);
  await closeWfConsoleIfOpen(ctx);

  deleteWorkflowByName(DEMO_WF_NAME);
  await kafkaCleanup(ctx);
}

// ── Helpers ────────────────────────────────────────────────────────

/** Select the "Kafka Produce Demo" workflow from the sidebar. */
async function selectKafkaProduceDemoWorkflow(ctx: DemoActionContext): Promise<void> {
  await selectWorkflowFromAppSidebar(ctx, DEMO_WF_NAME);
}

/** Close the Workflow Variables (defaults) modal via Cancel when open. */
async function closeDefaultsModalIfOpen(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector<HTMLElement>(WF.DEFAULTS_MODAL);
  if (!modal) return;
  const cancel = modal.querySelector<HTMLElement>('.btn-ghost');
  cancel?.click();
  await ctx.delay(300);
}

/** Find an existing variable row in the Variables modal by key name. */
function findDefaultsVarRow(key: string): HTMLElement | null {
  const rows = document.querySelectorAll<HTMLElement>(
    `${WF.DEFAULTS_MODAL} .wf-config-kv-row-vars:not(.wf-config-kv-header)`,
  );
  for (const row of rows) {
    const input = row.querySelector<HTMLInputElement>('.wf-var-key-input');
    if (input?.value === key) return row;
  }
  return null;
}

/** Spotlight a variable row (key + value) inside the Variables modal. */
async function spotlightDefaultsVarRow(
  ctx: DemoActionContext,
  key: string,
  holdMs = 700,
): Promise<void> {
  const row = findDefaultsVarRow(key);
  if (!row) return;
  row.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  const dispose = showSpotlightRing(row);
  try {
    await ctx.delay(holdMs);
  } finally {
    dispose();
  }
}

/** Double-click the kafkaProduce node on the canvas to open its config modal. */
async function openProduceNodeConfig(ctx: DemoActionContext): Promise<void> {
  await closeDefaultsModalIfOpen(ctx);
  await openWfNodeConfigModal(ctx, { nodeSelector: KAFKA.NODE_PRODUCE });
  await waitForWfConfigPanel(ctx, KAFKA.PRODUCE_CONFIG);
}

/** Keep / reopen Produce config for field-tour steps (idempotent). */
async function ensureProduceConfigOpen(ctx: DemoActionContext): Promise<void> {
  const state = await ensureLessonWorkflowShown(ctx, DEMO_WF_NAME);
  if (state === 'selected') {
    await collapseWfDemoAppSidebar(ctx);
  }
  await closeDefaultsModalIfOpen(ctx);
  await ensureWfNodeConfigModalOpen(ctx, {
    nodeSelector: KAFKA.NODE_PRODUCE,
    panelSelector: KAFKA.PRODUCE_CONFIG,
  });
}

/** Spotlight a config field, hold so the viewer can read the value, then clear. */
async function spotlightConfigField(
  ctx: DemoActionContext,
  selector: string,
  holdMs = 700,
): Promise<void> {
  await ctx.waitFor(selector, 5000);
  await scrollWfConfigFieldIntoView(ctx, selector);
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  const dispose = showSpotlightRing(el);
  try {
    el.focus?.();
    await ctx.delay(holdMs);
  } finally {
    dispose();
  }
}

export const kafkaWorkflowProduceLesson: DemoLesson = {
  id: 'kafka-workflow-produce',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Workflow: Produce Node',
  description:
    'Add a kafkaProduce node to a workflow, define workflow Variables (topic / runId), configure cluster + topic + body templates with {{variables}}, add output bindings, and run a Quick Test.',
  estimatedMinutes: 6,
  // No initialTab — setup navigates to workflow directly

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',
  tag: '🐳 Docker',

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
      // No canvas-wide reading highlight — the pulsing ring feels like flashing chrome.
      preAction: async (ctx) => {
        await selectKafkaProduceDemoWorkflow(ctx);
        await closeDefaultsModalIfOpen(ctx);
        await closeWfConfigModalIfOpen(ctx);
      },
      action: async (ctx) => {
        const fitBtn = document.querySelector<HTMLElement>('button[title="Fit view"]');
        if (fitBtn) {
          fitBtn.click();
          await ctx.delay(120);
        }
        await ctx.delay(300);
      },
    },

    // Step 2: Show the canvas with the seeded workflow
    {
      id: 'wp-canvas',
      title: 'The Produce Demo Workflow',
      description:
        'The **Kafka Produce Demo** workflow is a three-node chain: **Start → Kafka Produce → End**. The middle node is pre-configured — next we\'ll see the workflow **Variables** that feed its `{{topic}}` and `{{runId}}` placeholders, then open the Produce config.',
      highlight: KAFKA.NODE_PRODUCE,
      preAction: async (ctx) => {
        await ensureLessonWorkflowShown(ctx, DEMO_WF_NAME);
        await closeDefaultsModalIfOpen(ctx);
        await closeWfConfigModalIfOpen(ctx);
        await collapseWfDemoAppSidebar(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(KAFKA.NODE_PRODUCE, 5000);
        const produce = document.querySelector<HTMLElement>(KAFKA.NODE_PRODUCE);
        if (produce) {
          const dispose = showSpotlightRing(produce);
          await ctx.delay(700);
          dispose();
        }
        await ctx.delay(200);
      },
      verify: KAFKA.NODE_PRODUCE,
    },

    // Step 3: Introduce workflow Variables (topic + runId) before using {{…}} in config
    {
      id: 'wp-variables',
      title: 'Workflow Variables',
      description:
        'Open **Variables** in the toolbar (badge **2**). This demo defines two workflow-level values available everywhere as `{{name}}`:\n\n' +
        '- `topic` → `orders.created`\n' +
        '- `runId` → `demo-run-1`\n\n' +
        'The Produce node will reference these as `{{topic}}` and `{{runId}}` — change a variable once, and every placeholder updates at run time.',
      highlight: WF.VARIABLES_BTN,
      preAction: async (ctx) => {
        await ensureLessonWorkflowShown(ctx, DEMO_WF_NAME);
        await closeWfConfigModalIfOpen(ctx);
        await collapseWfDemoAppSidebar(ctx);
        // Leave Variables closed so the action opens it visibly.
        await closeDefaultsModalIfOpen(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(WF.VARIABLES_BTN, 5000);
        const varsBtn = document.querySelector<HTMLElement>(WF.VARIABLES_BTN);
        if (varsBtn) {
          const dispose = showSpotlightRing(varsBtn);
          await ctx.delay(500);
          dispose();
        }

        await ctx.click(WF.VARIABLES_BTN);
        await ctx.waitFor(WF.DEFAULTS_MODAL, 5000);
        await ctx.delay(450);

        await spotlightDefaultsVarRow(ctx, 'topic', 750);
        await ctx.delay(180);
        await spotlightDefaultsVarRow(ctx, 'runId', 750);
        await ctx.delay(250);

        // Close without saving — values are already seeded; Cancel dismisses cleanly.
        await closeDefaultsModalIfOpen(ctx);
        await ctx.delay(250);

        // Re-spotlight the toolbar badge so the viewer connects modal ↔ Variables (2).
        const badgeBtn = document.querySelector<HTMLElement>(WF.VARIABLES_BTN);
        if (badgeBtn) {
          const dispose = showSpotlightRing(badgeBtn);
          await ctx.delay(450);
          dispose();
        }
      },
      verify: WF.VARIABLES_BTN,
    },

    // Step 4: Open the palette and search for Kafka nodes
    {
      id: 'wp-palette',
      title: 'Node Palette',
      description:
        'New nodes come from the **Blocks Palette** — the panel on the **left sidebar** of the canvas. Type **kafka** in the search box to instantly filter to Kafka-specific nodes: **Kafka Trigger**, **Kafka Produce**, **Kafka Consume**, and **Kafka Wait**.',
      highlight: WF.PAL_SEARCH,
      preAction: async (ctx) => {
        await closeDefaultsModalIfOpen(ctx);
        await closeWfConfigModalIfOpen(ctx);
        const search = document.querySelector<HTMLInputElement>(WF.PAL_SEARCH);
        if (search && search.value !== '') {
          search.value = '';
          search.dispatchEvent(new Event('input', { bubbles: true }));
          await ctx.delay(80);
        }
      },
      action: async (ctx) => {
        await ctx.waitFor(WF.PAL_SEARCH, 3000);
        await ctx.fill(WF.PAL_SEARCH, 'kafka');
        await ctx.delay(250);

        // Highlight all Kafka node cards with one combined ring.
        const kafkaPaletteSelectors = [
          WF.PAL_KAFKA_TRIGGER,
          WF.PAL_KAFKA_PRODUCE,
          WF.PAL_KAFKA_CONSUME,
          WF.PAL_KAFKA_WAIT,
        ];
        const nodes = kafkaPaletteSelectors
          .map((selector) => document.querySelector<HTMLElement>(selector))
          .filter((node): node is HTMLElement => Boolean(node));

        if (nodes.length > 0) {
          const rects = nodes.map((node) => node.getBoundingClientRect());
          const left = Math.min(...rects.map((rect) => rect.left));
          const top = Math.min(...rects.map((rect) => rect.top));
          const right = Math.max(...rects.map((rect) => rect.right));
          const bottom = Math.max(...rects.map((rect) => rect.bottom));

          const groupAnchor = document.createElement('div');
          groupAnchor.style.position = 'fixed';
          groupAnchor.style.left = `${left}px`;
          groupAnchor.style.top = `${top}px`;
          groupAnchor.style.width = `${Math.max(0, right - left)}px`;
          groupAnchor.style.height = `${Math.max(0, bottom - top)}px`;
          groupAnchor.style.pointerEvents = 'none';
          groupAnchor.style.opacity = '0';
          document.body.appendChild(groupAnchor);

          const disposeGroupSpotlight = showSpotlightRing(groupAnchor);
          await ctx.delay(500);
          disposeGroupSpotlight();
          groupAnchor.remove();
        } else {
          await ctx.delay(500);
        }

        // Scroll the first kafka node into view if possible
        const produce = document.querySelector<HTMLElement>(WF.PAL_KAFKA_PRODUCE);
        if (produce && typeof produce.scrollIntoView === 'function') {
          produce.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        await ctx.delay(300);
      },
      verify: WF.PAL_KAFKA_PRODUCE,
    },

    // Step 5: Double-click the produce node to open config modal — leave it open
    {
      id: 'wp-config',
      title: 'Open Node Config',
      description:
        'Double-click the **Kafka Produce** node to open its configuration panel. The panel appears with tabs: **Config**, **Input**, **Output**, and **Logs**. Keep this panel open — next we\'ll connect the Variables you just saw to Topic and Body Template.',
      highlight: KAFKA.NODE_PRODUCE,
      preAction: async (ctx) => {
        await ensureLessonWorkflowShown(ctx, DEMO_WF_NAME);
        await collapseWfDemoAppSidebar(ctx);
        await closeDefaultsModalIfOpen(ctx);
        // Close only if a *different* config is open so the visible open is a clean Produce open.
        if (document.querySelector(WF.NODE_CONFIG) && !document.querySelector(KAFKA.PRODUCE_CONFIG)) {
          await closeWfConfigModalIfOpen(ctx);
        }
      },
      action: async (ctx) => {
        if (document.querySelector(KAFKA.PRODUCE_CONFIG)) {
          await waitForWfConfigPanel(ctx, KAFKA.PRODUCE_CONFIG);
        } else {
          // Use brisk modal pacing only for this step so Acting doesn't linger.
          const priorTiming = getWfConfigDemoTiming();
          setWfConfigDemoTiming(WF_CONFIG_DEMO_TIMING_BRISK);
          try {
            await openProduceNodeConfig(ctx);
          } finally {
            setWfConfigDemoTiming(priorTiming);
          }
        }
        await scrollWfConfigModalToTop(ctx);
        // Keep this step snappy while still showing that config is ready.
        await ctx.delay(220);
      },
      verify: KAFKA.PRODUCE_CONFIG,
    },

    // Step 6: Tour Cluster / Topic / Body — modal must stay open
    {
      id: 'wp-fields',
      title: 'Config Fields',
      description:
        'Watch the highlighted fields. **Cluster ID** is `demo-cluster`. **Topic** is `{{topic}}` — the same `topic` variable from the Variables panel (`orders.created` at run time). **Body Template** embeds `{{runId}}` from that same map. The **Available variables** section at the bottom of the panel also lists those two names.',
      highlight: KAFKA.PRODUCE_CLUSTER_INPUT,
      preAction: async (ctx) => {
        await ensureProduceConfigOpen(ctx);
        await scrollWfConfigModalToTop(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(KAFKA.PRODUCE_CONFIG, 5000);
        await scrollWfConfigModalToTop(ctx);

        await spotlightConfigField(ctx, KAFKA.PRODUCE_CLUSTER_INPUT, 700);
        await pauseWfConfigSection(ctx);

        await spotlightConfigField(ctx, KAFKA.PRODUCE_TOPIC_INPUT, 700);
        await pauseWfConfigSection(ctx);

        await spotlightConfigField(ctx, KAFKA.PRODUCE_BODY_TEXTAREA, 800);
        // Keep modal open for the bindings step.
        await ctx.delay(250);
      },
      verify: KAFKA.PRODUCE_BODY_TEXTAREA,
    },

    // Step 7: Output bindings — scroll down, spotlight On checkbox, toggle to demonstrate
    {
      id: 'wp-bindings',
      title: 'Output Bindings',
      description:
        'Scroll down to **Output Bindings**. Each binding has an **On** checkbox — the binding only fires when it is **checked**. This demo has `partition` → `sentPartition` already on. Watch the **On** checkbox toggle off then back on to see how it controls the binding.',
      highlight: KAFKA.OUTPUT_BINDINGS_SECTION,
      preAction: async (ctx) => {
        await ensureProduceConfigOpen(ctx);
        // Ensure the binding checkbox starts checked so the toggle demo is meaningful.
        const checkbox = document.querySelector<HTMLInputElement>(
          `${KAFKA.OUTPUT_BINDINGS_SECTION} .wf-kafka-bindings-col-on input[type="checkbox"]`,
        );
        if (checkbox && !checkbox.checked) {
          checkbox.click();
          await ctx.delay(80);
        }
      },
      action: async (ctx) => {
        await ctx.waitFor(KAFKA.OUTPUT_BINDINGS_SECTION, 5000);
        await scrollWfConfigFieldIntoView(ctx, KAFKA.OUTPUT_BINDINGS_SECTION);
        await spotlightConfigField(ctx, KAFKA.OUTPUT_BINDINGS_SECTION, 600);

        const checkbox = document.querySelector<HTMLInputElement>(
          `${KAFKA.OUTPUT_BINDINGS_SECTION} .wf-kafka-bindings-col-on input[type="checkbox"]`,
        );
        if (checkbox) {
          // Spotlight the checkbox itself so the viewer sees it.
          const toggleWrap = checkbox.closest<HTMLElement>('.wf-kafka-bindings-col-on') ?? checkbox;
          const disposeToggle = showSpotlightRing(toggleWrap);
          await ctx.delay(450);
          disposeToggle();

          // Uncheck — viewer sees a disabled (off) binding.
          checkbox.click();
          await ctx.delay(350);

          // Re-check — binding is active again.
          checkbox.click();
          await ctx.delay(350);
        }

        // Keep modal open until the console step closes it.
        await ctx.delay(150);
      },
      verify: KAFKA.OUTPUT_BINDINGS_SECTION,
    },

    // Step 8: Close config modal and open Console
    {
      id: 'wp-open-console',
      title: 'Open the Console',
      description:
        'Close the config panel, then open the **Console** via the Console badge in the status bar. It docks so you can watch the execution log. Open it *before* Quick Test so it captures the full run — opening afterwards shows an empty panel.',
      highlight: WF.CONSOLE_BADGE,
      preAction: async (ctx) => {
        await closeDefaultsModalIfOpen(ctx);
        await closeWfConfigModalIfOpen(ctx);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await openWfConsoleIfClosed(ctx);
        await ctx.delay(350);
      },
      verify: WF.CONSOLE,
    },

    // Step 9: Quick Test
    {
      id: 'wp-quicktest',
      title: 'Quick Test',
      description:
        'Click **Quick Test** (▶ in the toolbar) to run the workflow once. The Designer resolves `{{topic}}` / `{{runId}}` from Variables, then executes each node. Watch the **Console** — it fills with the execution log in real time. The status bar shows pass/fail and duration.',
      highlight: WF.QUICK_TEST_BTN,
      preAction: async (ctx) => {
        await closeDefaultsModalIfOpen(ctx);
        await closeWfConfigModalIfOpen(ctx);
        await openWfConsoleIfClosed(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WF.QUICK_TEST_BTN);
        await ctx.waitFor('.wf-status-bar', 5000);
        await ctx.delay(1500);
      },
    },

    // Step 10: Console output — spotlight the two lines showing resolved variables
    {
      id: 'wp-result',
      title: 'Read the Console',
      description:
        'The **Console** shows the execution log. Find **`PRODUCE orders.created`** — that\'s `{{topic}}` resolved from Variables. Find **`Body: {...,"runId":"demo-run-1"}`** — that\'s `{{runId}}` resolved. Watch as those two lines are highlighted to confirm that variable substitution happened at run time.',
      highlight: '.wf-console-body',
      preAction: async (ctx) => {
        await openWfConsoleIfClosed(ctx);
      },
      action: async (ctx) => {
        // Helper: find the first .wf-cl-line whose text content includes a substring.
        function findConsoleLine(substring: string): HTMLElement | null {
          const lines = document.querySelectorAll<HTMLElement>('.wf-cl-line');
          for (const line of lines) {
            if (line.textContent?.includes(substring)) return line;
          }
          return null;
        }

        // 1. Spotlight the whole console body so the viewer orients.
        const body = document.querySelector<HTMLElement>('.wf-console-body');
        if (body) {
          const d = showSpotlightRing(body);
          await ctx.delay(800);
          d();
        }

        // 2. Spotlight the "PRODUCE orders.created" line — {{topic}} resolved.
        const produceLine = findConsoleLine('PRODUCE orders.created')
          ?? findConsoleLine('orders.created');
        if (produceLine) {
          produceLine.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          await ctx.delay(300);
          const d = showSpotlightRing(produceLine);
          await ctx.delay(1200);
          d();
        }

        // 3. Spotlight the "Body" line — {{runId}} resolved.
        const bodyLine = findConsoleLine('runId')
          ?? findConsoleLine('Body:');
        if (bodyLine) {
          bodyLine.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          await ctx.delay(300);
          const d = showSpotlightRing(bodyLine);
          await ctx.delay(1200);
          d();
        }
      },
    },

    // Step 11: Summary
    {
      id: 'wp-summary',
      title: 'Produce Node Summary',
      description:
        'You now know how to: define workflow **Variables** (`topic`, `runId`), wire them into a `kafkaProduce` node as `{{topic}}` / `{{runId}}`, bind the output partition to a variable, and Quick Test the workflow. In the next lesson, you\'ll add `kafkaConsume` and `kafkaWait` nodes to complete the event-driven round-trip.',
      // No canvas-wide pulse on the last step either.
      preAction: async (ctx) => {
        await closeDefaultsModalIfOpen(ctx);
        await closeWfConfigModalIfOpen(ctx);
        await closeWfConsoleIfOpen(ctx);
      },
      action: async (ctx) => {
        await ctx.delay(350);
      },
    },
  ],
};
