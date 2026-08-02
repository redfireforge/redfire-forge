/**
 * Lesson K10: Workflow — Consume & Wait Nodes
 *
 * Extends the Kafka Produce Demo workflow with kafkaConsume and kafkaWait nodes.
 * Shows how to configure consume settings, bind output variables, set up correlation,
 * and use a sample payload so Quick Test can resolve the Wait without a live event.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { ensureKafkaConnected, kafkaCleanup } from '../setup-helpers';
import { showSpotlightRing } from '../../demoRipple';
import {
  clickWfConfigControl,
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  collapseWfDemoAppSidebar,
  ensureLessonWorkflowShown,
  ensureWfNodeConfigModalOpen,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigDemo,
  scrollWfConfigFieldIntoView,
  scrollWfConfigModalToTop,
  waitForWfConfigPanel,
} from '../wf-demo-helpers';
import { deleteWorkflowByName, seedNamedWorkflow, selectWorkflowByName } from '../../adapters';
import { WF, KAFKA } from '@shared/selectors';

const DEMO_WF_NAME = 'Kafka Consume & Wait Demo';

// ── Seeded workflow factory ────────────────────────────────────────

function createKafkaConsumeWaitWorkflow(): Record<string, unknown> {
  const startId = crypto.randomUUID();
  const produceId = crypto.randomUUID();
  const consumeId = crypto.randomUUID();
  const waitId = crypto.randomUUID();
  const endId = crypto.randomUUID();
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: DEMO_WF_NAME,
    schemaVersion: 6,
    variables: { topic: 'orders.created', orderId: 'ORDER-001' },
    services: [],
    hostProfiles: [],
    authProfiles: [],
    nodes: [
      {
        id: startId,
        type: 'start',
        position: { x: 250, y: 30 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: produceId,
        type: 'kafkaProduce',
        position: { x: 250, y: 130 },
        data: {
          label: 'Produce Order',
          clusterId: 'demo-cluster',
          topic: '{{topic}}',
          keyTemplate: '{{orderId}}',
          partition: undefined,
          headers: [],
          bodyTemplate: '{"orderId":"{{orderId}}","status":"PLACED"}',
          ackMode: 'leader',
          timeoutMs: 10000,
          outputBindings: [],
        },
      },
      {
        id: consumeId,
        type: 'kafkaConsume',
        position: { x: 250, y: 240 },
        data: {
          label: 'Consume Orders',
          clusterId: 'demo-cluster',
          topic: '{{topic}}',
          keyRegex: '',
          headerFilters: [],
          jsonPathFilters: [],
          timeoutMs: 5000,
          maxMessages: 1,
          startPosition: 'earliest',
          loadTestBehavior: { mode: 'wait-for-real' },
          // Metadata bindings only: topic | partition | offset | timestamp | key
          outputBindings: [
            { id: 'b1', source: 'key', targetVariable: 'consumedKey', enabled: true },
          ],
        },
      },
      {
        id: waitId,
        type: 'kafkaWait',
        position: { x: 250, y: 350 },
        data: {
          label: 'Wait for Confirmation',
          clusterId: 'demo-cluster',
          topic: 'payments.confirmed',
          // Practical use of Consume's output binding: wait for a payment whose
          // body.orderId equals the Kafka key we just consumed into consumedKey.
          correlationIdExpression: '{{consumedKey}}',
          correlationSource: 'body',
          correlationJsonPath: '$.orderId',
          extractVariables: [{ name: 'confirmedAmount', jsonPath: '$.amount' }],
          timeoutMs: 60000,
          headerFilters: [],
          samplePayload: '{"orderId":"{{orderId}}","status":"CONFIRMED","amount":99.99}',
          loadTestBehavior: {
            mode: 'auto-resume',
          },
        },
      },
      {
        id: endId,
        type: 'end',
        position: { x: 250, y: 460 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: crypto.randomUUID(), source: startId, target: produceId },
      { id: crypto.randomUUID(), source: produceId, target: consumeId },
      { id: crypto.randomUUID(), source: consumeId, target: waitId },
      { id: crypto.randomUUID(), source: waitId, target: endId },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

// ── Setup / Cleanup ────────────────────────────────────────────────

async function kafkaWorkflowConsumeWaitSetup(ctx: DemoActionContext): Promise<void> {
  try { await ensureKafkaConnected(); } catch { /* server may not be running */ }

  await seedNamedWorkflow(ctx, DEMO_WF_NAME, createKafkaConsumeWaitWorkflow(), {
    deleteDelayMs: 0,
    insertPreDelayMs: 100,
    insertDelayMs: 0,
  });

  ctx.navigateToTab('workflow');
  await ctx.delay(900);

  await closeWfConsoleIfOpen(ctx);
  await closeWfConfigModalIfOpen(ctx);

  const fitBtn = document.querySelector('button[title="Fit view"]') as HTMLElement | null;
  if (fitBtn) { fitBtn.click(); await ctx.delay(400); }
  await collapseWfDemoAppSidebar(ctx);
}

async function kafkaWorkflowConsumeWaitCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalIfOpen(ctx);
  await closeWfConsoleIfOpen(ctx);

  deleteWorkflowByName(DEMO_WF_NAME);
  await kafkaCleanup(ctx);
}

/** Quietly ensure the demo workflow is on the canvas — no sidebar flash. */
async function ensureConsumeWaitWorkflowQuiet(ctx: DemoActionContext): Promise<void> {
  const state = await ensureLessonWorkflowShown(ctx, DEMO_WF_NAME);
  if (state === 'missing') {
    selectWorkflowByName(DEMO_WF_NAME);
    await ctx.delay(300);
  }
  await collapseWfDemoAppSidebar(ctx);
}

async function ensureConsumeConfigOpen(ctx: DemoActionContext): Promise<void> {
  await ensureConsumeWaitWorkflowQuiet(ctx);
  await ensureWfNodeConfigModalOpen(ctx, {
    nodeSelector: KAFKA.NODE_CONSUME,
    panelSelector: KAFKA.CONSUME_CONFIG,
  });
}

async function ensureWaitConfigOpen(ctx: DemoActionContext): Promise<void> {
  await ensureConsumeWaitWorkflowQuiet(ctx);
  await ensureWfNodeConfigModalOpen(ctx, {
    nodeSelector: KAFKA.NODE_WAIT,
    panelSelector: KAFKA.WAIT_CONFIG,
  });
}

/** Spotlight a config field/section; hold so the viewer can read it. */
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
    await ctx.delay(holdMs);
  } finally {
    dispose();
  }
}

/** Find a KafkaCard by its title text and spotlight it. */
async function spotlightKafkaCard(
  ctx: DemoActionContext,
  titleText: string,
  pauseMs = 1000,
): Promise<void> {
  const cards = document.querySelectorAll<HTMLElement>('.wf-kafka-card');
  let card: HTMLElement | null = null;
  for (const c of cards) {
    const titleEl = c.querySelector('.wf-kafka-card-title-text');
    if (titleEl?.textContent?.toLowerCase().includes(titleText.toLowerCase())) {
      card = c;
      break;
    }
  }
  if (!card) return;
  await scrollWfConfigFieldIntoView(ctx, card);
  const dispose = showSpotlightRing(card);
  try {
    await ctx.delay(pauseMs);
  } finally {
    dispose();
  }
  await ctx.delay(200);
}

function findConsoleLine(substring: string): HTMLElement | null {
  const lines = document.querySelectorAll<HTMLElement>('.wf-cl-line');
  for (const line of lines) {
    if (line.textContent?.includes(substring)) return line;
  }
  return null;
}

export const kafkaWorkflowConsumeWaitLesson: DemoLesson = {
  id: 'kafka-workflow-consume-wait',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Workflow: Consume & Wait',
  description:
    'Add kafkaConsume and kafkaWait nodes to a workflow, bind consumed message metadata, configure correlation matching, and use a Quick Test sample so the Wait resolves without a live event.',
  estimatedMinutes: 6,

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',
  tag: '🐳 Docker',

  setup: kafkaWorkflowConsumeWaitSetup,
  cleanup: kafkaWorkflowConsumeWaitCleanup,

  concept: {
    title: 'Consume and Wait: Inbound Kafka Nodes',
    body: `While \`kafkaProduce\` sends messages, \`kafkaConsume\` and \`kafkaWait\` are the **inbound** half of the event-driven round-trip.

**kafkaConsume** — reads a bounded batch
- Fetches up to \`maxMessages\` from a topic starting at a configurable position
- Returns immediately when the batch is full or the timeout expires
- **Output bindings** map message metadata (\`topic\`, \`partition\`, \`offset\`, \`timestamp\`, \`key\`) into workflow variables
- In this demo: \`key → consumedKey\`, then **kafkaWait** correlates with \`{{consumedKey}}\`

**kafkaWait** — blocks until a correlated message arrives
- Stays open, consuming the topic, until a message matches the **ID expression**
- Correlation source can be: message key, a header value, or a JSONPath in the body
- **Extract Variables** pull fields from the matched message into the variable map
- If the message never arrives, the node fails after \`timeoutMs\`

**Quick Test sample** (Load test mode \`Auto resume\`):
During load tests or Quick Test, a real correlated event may never arrive. Setting a sample message body plus **Auto resume** makes the Wait resolve immediately using the sample — without hanging the test run.`,
    keyTerms: [
      {
        term: 'kafkaConsume',
        definition:
          'A workflow node that reads up to N messages from a Kafka topic and returns. Unlike Stream Mode, it is bounded and returns control to the workflow when the batch is complete or the timeout fires.',
      },
      {
        term: 'kafkaWait',
        definition:
          'A workflow node that blocks execution until a message matching a correlation expression arrives on a Kafka topic. Used to model event-driven "wait for response" patterns.',
      },
      {
        term: 'Correlation Matching',
        definition:
          'The Wait card that defines ID expression, Source (body / header / key), and optional JSONPath — used to identify the matching inbound message.',
      },
      {
        term: 'Quick Test sample',
        definition:
          'A JSON message body configured on kafkaWait that is used instead of a real broker message during Quick Test or load tests (when mode is Auto resume). It prevents the workflow from hanging.',
      },
    ],
    diagram: `<svg viewBox="0 0 260 280" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="130" cy="22" rx="38" ry="16" fill="var(--success,#a6e3a1)" opacity="0.3" stroke="var(--success,#a6e3a1)" stroke-width="1.3"/>
  <text x="130" y="27" text-anchor="middle" fill="var(--text)" font-size="10">Start</text>
  <line x1="130" y1="38" x2="130" y2="56" stroke="var(--border)" stroke-width="1.3" marker-end="url(#cw-a)"/>
  <!-- Produce -->
  <rect x="60" y="58" width="140" height="42" rx="5" fill="var(--primary)" opacity="0.2" stroke="var(--primary)" stroke-width="1.3"/>
  <text x="130" y="76" text-anchor="middle" fill="var(--text)" font-size="10">kafkaProduce</text>
  <text x="130" y="90" text-anchor="middle" fill="var(--text-muted)" font-size="8">→ orders.created</text>
  <line x1="130" y1="100" x2="130" y2="118" stroke="var(--border)" stroke-width="1.3" marker-end="url(#cw-a)"/>
  <!-- Consume -->
  <rect x="60" y="120" width="140" height="42" rx="5" fill="var(--accent)" opacity="0.2" stroke="var(--accent)" stroke-width="1.3"/>
  <text x="130" y="138" text-anchor="middle" fill="var(--text)" font-size="10">kafkaConsume</text>
  <text x="130" y="152" text-anchor="middle" fill="var(--text-muted)" font-size="8">key → consumedKey</text>
  <line x1="130" y1="162" x2="130" y2="180" stroke="var(--border)" stroke-width="1.3" marker-end="url(#cw-a)"/>
  <!-- Wait -->
  <rect x="60" y="182" width="140" height="52" rx="5" fill="var(--warning,#fab387)" opacity="0.2" stroke="var(--warning,#fab387)" stroke-width="1.3"/>
  <text x="130" y="200" text-anchor="middle" fill="var(--text)" font-size="10">kafkaWait</text>
  <text x="130" y="214" text-anchor="middle" fill="var(--text-muted)" font-size="8">$.orderId == {{"{{"}}consumedKey{{"}}"}}</text>
  <text x="130" y="227" text-anchor="middle" fill="var(--text-muted)" font-size="8">sample payload ✓</text>
  <line x1="130" y1="234" x2="130" y2="252" stroke="var(--border)" stroke-width="1.3" marker-end="url(#cw-a)"/>
  <ellipse cx="130" cy="264" rx="38" ry="16" fill="var(--error,#f38ba8)" opacity="0.2" stroke="var(--error,#f38ba8)" stroke-width="1.3"/>
  <text x="130" y="269" text-anchor="middle" fill="var(--text)" font-size="10">End</text>
  <defs>
    <marker id="cw-a" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="var(--border)" stroke-width="1.3"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // Step 1: Intro
    {
      id: 'cw-intro',
      title: 'Consume and Wait Nodes',
      description:
        '**⚠️ Prerequisite:** To run Quick Test, ensure the Redpanda stack is running: `cd docker/kafka/plaintext && docker compose up -d`\n\n' +
        'The **Kafka Consume & Wait Demo** workflow shows the complete event-driven round-trip: produce an order → consume from the same topic → wait for a payment confirmation. Next we\'ll open each inbound node and walk its config.',
      preAction: async (ctx) => {
        await ensureConsumeWaitWorkflowQuiet(ctx);
        (document.activeElement as HTMLElement | null)?.blur?.();
      },
      action: async (ctx) => {
        await ctx.delay(700);
      },
    },

    // Step 2: Open kafkaConsume — visible dblclick/open, then tour cards
    {
      id: 'cw-consume-node',
      title: 'Open kafkaConsume',
      description:
        'Double-click the **kafkaConsume** node to open its configuration panel. Watch each section get highlighted: **Connection**, **Filters**, **Consumption**, **Output bindings**, and **Schema Registry**.',
      highlight: KAFKA.NODE_CONSUME,
      preAction: async (ctx) => {
        await ensureConsumeWaitWorkflowQuiet(ctx);
        await closeWfConsoleIfOpen(ctx);
        // Leave closed so the action opens it visibly.
        if (document.querySelector(KAFKA.CONSUME_CONFIG)) {
          await closeWfConfigModalIfOpen(ctx);
        } else if (document.querySelector(WF.NODE_CONFIG)) {
          await closeWfConfigModalIfOpen(ctx);
        }
      },
      action: async (ctx) => {
        await openWfNodeConfigModal(ctx, { nodeSelector: KAFKA.NODE_CONSUME });
        await waitForWfConfigPanel(ctx, KAFKA.CONSUME_CONFIG);

        await scrollWfConfigModalToTop(ctx);
        await spotlightKafkaCard(ctx, 'Connection', 900);
        await spotlightKafkaCard(ctx, 'Filters', 900);
        await spotlightKafkaCard(ctx, 'Consumption', 900);
        await spotlightKafkaCard(ctx, 'Output bindings', 900);
        await spotlightKafkaCard(ctx, 'Schema Registry', 900);
      },
      verify: KAFKA.CONSUME_CONFIG,
    },

    // Step 3: Output binding — must be a visible action (not preAction-only)
    {
      id: 'cw-consume-binding',
      title: 'Output Binding: key → consumedKey',
      description:
        'Scroll to **Output bindings**. This demo maps message **`key`** → workflow variable **`consumedKey`** (Produce set the key from `{{orderId}}`). ' +
        'The next **kafkaWait** step uses `{{consumedKey}}` as its correlation ID — so the key we just consumed drives which payment confirmation to wait for. ' +
        'Bindings only fire when **On** is checked. Sources are metadata only: `topic`, `partition`, `offset`, `timestamp`, or `key`.',
      highlight: KAFKA.OUTPUT_BINDINGS_SECTION,
      preAction: async (ctx) => {
        await ensureConsumeConfigOpen(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(KAFKA.OUTPUT_BINDINGS_SECTION, 5000);
        await scrollWfConfigFieldIntoView(ctx, KAFKA.OUTPUT_BINDINGS_SECTION);
        await spotlightConfigField(ctx, KAFKA.OUTPUT_BINDINGS_SECTION, 700);

        const row = document.querySelector<HTMLElement>(
          `${KAFKA.OUTPUT_BINDINGS_SECTION} .wf-kafka-bindings-row`,
        );
        if (row) {
          const dispose = showSpotlightRing(row);
          await ctx.delay(900);
          dispose();
        }

        const checkbox = document.querySelector<HTMLInputElement>(
          `${KAFKA.OUTPUT_BINDINGS_SECTION} .wf-kafka-bindings-col-on input[type="checkbox"]`,
        );
        if (checkbox) {
          const toggleWrap = checkbox.closest<HTMLElement>('.wf-kafka-bindings-col-on') ?? checkbox;
          const disposeToggle = showSpotlightRing(toggleWrap);
          await ctx.delay(400);
          disposeToggle();
          if (!checkbox.checked) {
            checkbox.click();
            await ctx.delay(200);
          }
          checkbox.click();
          await ctx.delay(350);
          checkbox.click();
          await ctx.delay(350);
        }

        await ctx.delay(200);
      },
      verify: KAFKA.OUTPUT_BINDINGS_SECTION,
    },

    // Step 4: Open kafkaWait — visible open
    {
      id: 'cw-wait-node',
      title: 'Open kafkaWait',
      description:
        'Close the Consume panel, then double-click the **kafkaWait** node. It listens on `payments.confirmed` and waits until a message matches the correlation rules you\'ll inspect next.',
      highlight: KAFKA.NODE_WAIT,
      preAction: async (ctx) => {
        await ensureConsumeWaitWorkflowQuiet(ctx);
        await closeWfConfigModalIfOpen(ctx);
      },
      action: async (ctx) => {
        await openWfNodeConfigModal(ctx, { nodeSelector: KAFKA.NODE_WAIT });
        await waitForWfConfigPanel(ctx, KAFKA.WAIT_CONFIG);
        await scrollWfConfigModalToTop(ctx);
        await spotlightKafkaCard(ctx, 'Connection', 800);
        await ctx.delay(300);
      },
      verify: KAFKA.WAIT_CONFIG,
    },

    // Step 5: Correlation Matching — visible scroll + field spotlights
    {
      id: 'cw-wait-config',
      title: 'Correlation Matching',
      description:
        'Open the **Correlation Matching** card. **ID expression** is `{{consumedKey}}` — the variable filled by Consume\'s output binding. ' +
        '**Source** is **Body (JSONPath)**. **JSONPath** is `$.orderId`. Together: wait on `payments.confirmed` until the body\'s `orderId` equals the Kafka key we just consumed.',
      highlight: KAFKA.WAIT_CORRELATION_SECTION,
      preAction: async (ctx) => {
        await ensureWaitConfigOpen(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(KAFKA.WAIT_CORRELATION_SECTION, 5000);
        await scrollWfConfigFieldIntoView(ctx, KAFKA.WAIT_CORRELATION_SECTION);
        await spotlightConfigField(ctx, KAFKA.WAIT_CORRELATION_SECTION, 1000);

        // Spotlight the three correlation controls inside the card.
        const card = document.querySelector(KAFKA.WAIT_CORRELATION_SECTION);
        const rows = card?.querySelectorAll<HTMLElement>('.wf-kafka-form-row') ?? [];
        for (const row of Array.from(rows).slice(0, 3)) {
          const dispose = showSpotlightRing(row);
          await ctx.delay(700);
          dispose();
          await ctx.delay(150);
        }

        // Show Extract Variables briefly — confirmedAmount ← $.amount
        await spotlightKafkaCard(ctx, 'Extract Variables', 1100);
      },
      verify: KAFKA.WAIT_CORRELATION_SECTION,
    },

    // Step 6: Quick Test sample payload — visible
    {
      id: 'cw-sample-payload',
      title: 'Quick Test Sample',
      description:
        'Scroll to the **Quick Test** card. The **Message body (JSON)** is the sample the Wait uses instead of a live broker message during Quick Test. It includes `orderId`, `status`, and `amount` so correlation and **Extract Variables** (`confirmedAmount`) both succeed.',
      highlight: KAFKA.WAIT_SAMPLE_TEXTAREA,
      preAction: async (ctx) => {
        await ensureWaitConfigOpen(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(KAFKA.WAIT_SAMPLE_TEXTAREA, 5000);
        await scrollWfConfigFieldIntoView(ctx, KAFKA.WAIT_SAMPLE_TEXTAREA);
        await spotlightKafkaCard(ctx, 'Quick Test', 900);
        await spotlightConfigField(ctx, KAFKA.WAIT_SAMPLE_TEXTAREA, 1200);
      },
      verify: KAFKA.WAIT_SAMPLE_TEXTAREA,
    },

    // Step 7: Load test mode — visible click
    {
      id: 'cw-load-mode',
      title: 'Load Test Mode',
      description:
        'In the **Load test** card, **Mode** is set to **Auto resume** — the Wait resolves with the sample on every Quick Test / load iteration. **Wait for real** would block until a live correlated message arrives (better for integration tests, not load tests).',
      highlight: KAFKA.WAIT_LOAD_MODE_SELECT,
      preAction: async (ctx) => {
        await ensureWaitConfigOpen(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(KAFKA.WAIT_LOAD_MODE_SELECT, 5000);
        await scrollWfConfigFieldIntoView(ctx, KAFKA.WAIT_LOAD_MODE_SELECT);
        await spotlightKafkaCard(ctx, 'Load test', 800);
        await spotlightConfigField(ctx, KAFKA.WAIT_LOAD_MODE_SELECT, 600);
        // Open the dropdown so the viewer sees the mode labels, then dismiss.
        await clickWfConfigControl(ctx, KAFKA.WAIT_LOAD_MODE_SELECT);
        await ctx.delay(800);
        const openMenu = document.querySelector('.cs-menu');
        if (openMenu) {
          // Click the trigger again to close (keeps Auto resume selected).
          await ctx.click(KAFKA.WAIT_LOAD_MODE_SELECT);
          await ctx.delay(300);
        }
      },
      verify: KAFKA.WAIT_LOAD_MODE_SELECT,
    },

    // Step 8: Close config + open Console
    {
      id: 'cw-open-console',
      title: 'Open the Console',
      description:
        'Close the Wait config panel, then open the **Console** via the Console badge in the status bar. It opens in **Floating** mode beside the canvas. Open it *before* Quick Test so the full execution log is captured.',
      highlight: WF.CONSOLE_BADGE,
      preAction: async (ctx) => {
        await closeWfConfigModalIfOpen(ctx);
      },
      action: async (ctx) => {
        await openWfConsoleIfClosed(ctx);
        await ctx.delay(350);
      },
      verify: WF.CONSOLE,
    },

    // Step 9: Quick Test
    {
      id: 'cw-quicktest',
      title: 'Quick Test the Full Chain',
      description:
        'Click **Quick Test** to run the full chain. With **Auto resume** and the sample body, the Wait resolves immediately. Watch the **Console** fill with each node\'s result — produce, consume, then wait with `confirmedAmount` extracted from the sample.',
      highlight: WF.QUICK_TEST_BTN,
      preAction: async (ctx) => {
        await closeWfConfigModalIfOpen(ctx);
        await openWfConsoleIfClosed(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WF.QUICK_TEST_BTN);
        await ctx.waitFor('.wf-status-bar', 5000);
        await ctx.delay(3000);
      },
    },

    // Step 10: Read console — do NOT close here (description says look at results)
    {
      id: 'cw-console',
      title: 'Console: Full Chain Results',
      description:
        'Read the **Console** log. Look for **CONSUME** (message batch) and **WAIT** resolving from the sample. The extracted `confirmedAmount` appears in the variable output when the Wait finishes.',
      highlight: '.wf-console-body',
      preAction: async (ctx) => {
        await openWfConsoleIfClosed(ctx);
      },
      action: async (ctx) => {
        const body = document.querySelector<HTMLElement>('.wf-console-body');
        if (body) {
          const d = showSpotlightRing(body);
          await ctx.delay(800);
          d();
        }

        const consumeLine = findConsoleLine('CONSUME')
          ?? findConsoleLine('Consume')
          ?? findConsoleLine('orders.created');
        if (consumeLine) {
          consumeLine.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          await ctx.delay(300);
          const d = showSpotlightRing(consumeLine);
          await ctx.delay(1100);
          d();
        }

        const waitLine = findConsoleLine('WAIT')
          ?? findConsoleLine('sample')
          ?? findConsoleLine('confirmedAmount')
          ?? findConsoleLine('RESOLVED');
        if (waitLine) {
          waitLine.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          await ctx.delay(300);
          const d = showSpotlightRing(waitLine);
          await ctx.delay(1100);
          d();
        }

        await pauseWfConfigDemo(ctx, 'afterClick');
      },
      verify: '.wf-console-body',
    },

    // Step 11: Summary — close console quietly
    {
      id: 'cw-summary',
      title: 'Consume & Wait Summary',
      description:
        'You now have the complete Kafka workflow toolkit: Produce → Consume → Wait. Combine these with HTTP and WebSocket nodes for end-to-end event-driven test workflows. Next up: configure a **Secure Cluster** with SASL/SCRAM authentication.',
      preAction: async (ctx) => {
        await closeWfConfigModalIfOpen(ctx);
        await closeWfConsoleIfOpen(ctx);
      },
      action: async (ctx) => {
        await ctx.delay(600);
      },
    },
  ],
};
