/**
 * Lesson K10: Workflow — Consume & Wait Nodes
 *
 * Extends the Kafka Produce Demo workflow with kafkaConsume and kafkaWait nodes.
 * Shows how to configure consume settings, bind output variables, set up correlation,
 * and use a sample payload so Quick Test can resolve the Wait without a live event.
 *
 * Viewer rules: one sustained step `highlight` + pause per beat — no flash rings.
 * Keep the Wait config modal open across correlation → sample → load-mode steps.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { ensureKafkaConnected, kafkaCleanup } from '../setup-helpers';
import {
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  collapseWfDemoAppSidebar,
  ensureLessonWorkflowShown,
  ensureWfNodeConfigModalOpen,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  setWfConfigDemoTiming,
  WF_CONFIG_DEMO_TIMING_BRISK,
  scrollWfConfigFieldIntoView,
  waitForWfConfigPanel,
} from '../wf-demo-helpers';
import {
  deleteWorkflowByName,
  fitWorkflowCanvasView,
  seedNamedWorkflow,
  selectWorkflowByName,
} from '../../adapters';
import { purgeAllSpotlightRings, showSpotlightRing } from '../../demoRipple';
import { WF, KAFKA } from '@shared/selectors';

const DEMO_WF_NAME = 'Kafka Consume & Wait Demo';
/** Hold so the step highlight / outcome can be read (no flash rings). */
const OUTCOME_PAUSE_MS = 650;

/** Scroll a config field into view and leave a sustained ring for reading + pauseAfter. */
async function holdConfigSpotlight(
  ctx: DemoActionContext,
  selector: string,
  holdMs = OUTCOME_PAUSE_MS,
): Promise<void> {
  await ctx.waitFor(selector, 5000);
  await scrollWfConfigFieldIntoView(ctx, selector);
  const el = document.querySelector<HTMLElement>(selector);
  if (el) {
    // Replace any prior imperative ring so preAction + action don't stack.
    purgeAllSpotlightRings();
    // Leave active — purged again when the next step starts.
    showSpotlightRing(el);
  }
  await ctx.delay(holdMs);
}

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
          // Match only the key produced in this run — skips any stale messages in
          // the topic that have a different or empty key.
          keyRegex: '{{orderId}}',
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
          // Concrete value — Quick Test injects samplePayload as a literal string
          // (no {{var}} interpolation) and skips live body↔correlation matching.
          // Use ORDER-001 so the sample's $.orderId matches the resolved {{consumedKey}}.
          samplePayload: '{"orderId":"ORDER-001","status":"CONFIRMED","amount":99.99}',
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

// ── Setup / cleanup ────────────────────────────────────────────────

/** Seed + select while Concept is still up — first Designer paint is the demo graph. */
async function kafkaWorkflowConsumeWaitPrepare(ctx: DemoActionContext): Promise<void> {
  await seedNamedWorkflow(ctx, DEMO_WF_NAME, createKafkaConsumeWaitWorkflow(), {
    deleteDelayMs: 0,
    insertPreDelayMs: 0,
    insertDelayMs: 0,
    selectAfterSeed: true,
  });
}

async function kafkaWorkflowConsumeWaitSetup(ctx: DemoActionContext): Promise<void> {
  setWfConfigDemoTiming(WF_CONFIG_DEMO_TIMING_BRISK);
  try { await ensureKafkaConnected(); } catch { /* server may not be running */ }

  if ((await ensureLessonWorkflowShown(ctx, DEMO_WF_NAME)) === 'missing') {
    selectWorkflowByName(DEMO_WF_NAME);
    await ctx.delay(80);
  }
  await closeWfConsoleIfOpen(ctx);
  await closeWfConfigModalIfOpen(ctx);
  await collapseWfDemoAppSidebar(ctx);
  fitWorkflowCanvasView({ duration: 0 });
  await ctx.delay(60);
}

async function kafkaWorkflowConsumeWaitCleanup(ctx: DemoActionContext): Promise<void> {
  setWfConfigDemoTiming(null);
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
    await ctx.delay(120);
  }
  await collapseWfDemoAppSidebar(ctx);
}

/** Idempotent: open Consume config only when it is not already showing. */
async function ensureConsumeConfigOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(KAFKA.CONSUME_CONFIG)) {
    await ctx.delay(30);
    return;
  }
  await ensureConsumeWaitWorkflowQuiet(ctx);
  await ensureWfNodeConfigModalOpen(ctx, {
    nodeSelector: KAFKA.NODE_CONSUME,
    panelSelector: KAFKA.CONSUME_CONFIG,
  });
}

/** Idempotent: open Wait config only when it is not already showing (keeps modal across steps). */
async function ensureWaitConfigOpen(ctx: DemoActionContext): Promise<void> {
  // Check first — before any sidebar/workflow operations that cause a React
  // re-render and briefly unmount the panel, triggering a spurious close+reopen.
  if (document.querySelector(KAFKA.WAIT_CONFIG)) {
    await ctx.delay(30);
    return;
  }
  await ensureConsumeWaitWorkflowQuiet(ctx);
  await ensureWfNodeConfigModalOpen(ctx, {
    nodeSelector: KAFKA.NODE_WAIT,
    panelSelector: KAFKA.WAIT_CONFIG,
  });
}

/** Scroll a field into view and pause on the step highlight (no flash ring). */
async function focusConfigField(
  ctx: DemoActionContext,
  selector: string,
  holdMs = OUTCOME_PAUSE_MS,
): Promise<void> {
  await ctx.waitFor(selector, 5000);
  await scrollWfConfigFieldIntoView(ctx, selector);
  await ctx.delay(holdMs);
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
  initialTab: 'workflow',
  allowedTabs: ['workflow'],
  /** Prevent expand→collapse reflow that slides canvas nodes before Reading. */
  collapseAppSidebarOnStart: true,

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',
  tag: '🐳 Docker',

  prepareBeforeNavigate: kafkaWorkflowConsumeWaitPrepare,
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
During load tests or Quick Test, a real correlated event may never arrive. Setting a sample message body plus **Auto resume** makes the Wait resolve immediately using the sample — without hanging the test run. The sample body is **not** template-interpolated and **does not** prove live \`$.orderId\` ↔ correlation matching; put a concrete id that matches \`{{consumedKey}}\`. To prove matching for real, switch Mode to **Wait for real** and publish to \`payments.confirmed\`.`,
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
    // ── 1. Intro ─────────────────────────────────────────────────
    {
      id: 'cw-intro',
      title: 'Consume and Wait Nodes',
      description:
        '**⚠️ Prerequisite:** To run Quick Test, ensure the Redpanda stack is running: `cd docker/kafka/plaintext && docker compose up -d`\n\n' +
        'The **Kafka Consume & Wait Demo** workflow is the full event-driven round-trip: produce an order → consume from the same topic → wait for a payment confirmation. ' +
        'Next we open **kafkaConsume**, then keep the **kafkaWait** panel open while we walk correlation, sample payload, and load-test mode.',
      highlight: KAFKA.NODE_CONSUME,
      preAction: async (ctx) => {
        await ensureConsumeWaitWorkflowQuiet(ctx);
        await closeWfConfigModalIfOpen(ctx);
        await closeWfConsoleIfOpen(ctx);
        (document.activeElement as HTMLElement | null)?.blur?.();
      },
      action: async (ctx) => {
        await ctx.waitFor(KAFKA.NODE_CONSUME, 5000);
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      pauseAfter: true,
    },

    // ── 2. Open kafkaConsume (leave open for binding step) ───────
    {
      id: 'cw-consume-node',
      title: 'Open kafkaConsume',
      description:
        'Double-click the **kafkaConsume** node to open its configuration. ' +
        'This node reads a bounded batch from `{{topic}}` (filtered by key `{{orderId}}`). ' +
        'The panel stays open for the next step — **Output bindings**.',
      highlight: KAFKA.NODE_CONSUME,
      preAction: async (ctx) => {
        await ensureConsumeWaitWorkflowQuiet(ctx);
        await closeWfConsoleIfOpen(ctx);
        // Leave closed so the action opens it visibly once.
        if (document.querySelector(WF.NODE_CONFIG)) {
          await closeWfConfigModalIfOpen(ctx);
        }
      },
      action: async (ctx) => {
        await openWfNodeConfigModal(ctx, { nodeSelector: KAFKA.NODE_CONSUME });
        await waitForWfConfigPanel(ctx, KAFKA.CONSUME_CONFIG);
        // Do not close — step advance must keep this panel open for Output bindings.
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      verify: KAFKA.CONSUME_CONFIG,
      pauseAfter: true,
    },

    // ── 3. Output binding (Consume modal already open) ───────────
    {
      id: 'cw-consume-binding',
      title: 'Output Binding: key → consumedKey',
      description:
        'Scroll to **Output bindings**. This demo maps message **`key`** → workflow variable **`consumedKey`** (Produce set the key from `{{orderId}}`). ' +
        'The next **kafkaWait** step uses `{{consumedKey}}` as its correlation ID. ' +
        'Bindings only fire when **On** is checked. Sources are metadata only: `topic`, `partition`, `offset`, `timestamp`, or `key`.',
      highlight: KAFKA.CONSUME_OUTPUT_BINDINGS,
      preAction: async (ctx) => {
        // Modal should still be open from the previous step — only reopen if missing.
        await ensureConsumeConfigOpen(ctx);
        // Scroll before reading so the step highlight can land on the bindings card.
        await scrollWfConfigFieldIntoView(ctx, KAFKA.CONSUME_OUTPUT_BINDINGS);
      },
      action: async (ctx) => {
        await focusConfigField(ctx, KAFKA.CONSUME_OUTPUT_BINDINGS, OUTCOME_PAUSE_MS);

        // Brief visible confirmation that On is enabled (no flash ring, no toggle churn).
        const checkbox = document.querySelector<HTMLInputElement>(
          `${KAFKA.CONSUME_OUTPUT_BINDINGS} .wf-kafka-bindings-col-on input[type="checkbox"]`,
        );
        if (checkbox && !checkbox.checked) {
          checkbox.click();
          await ctx.delay(150);
        }
        await ctx.delay(250);
      },
      verify: KAFKA.CONSUME_OUTPUT_BINDINGS,
      pauseAfter: true,
    },

    // ── 4. Switch to kafkaWait (leave open for correlation → sample → mode) ──
    {
      id: 'cw-wait-node',
      title: 'Open kafkaWait',
      description:
        'Close the Consume panel, then double-click the **kafkaWait** node. ' +
        'It listens on `payments.confirmed` and waits until a message matches the correlation rules. ' +
        'We keep this panel open for the next three steps.',
      highlight: KAFKA.NODE_WAIT,
      preAction: async (ctx) => {
        await ensureConsumeWaitWorkflowQuiet(ctx);
        // Close Consume only — do not leave this step with Wait already open
        // (action opens it once so the viewer sees the open).
        if (!document.querySelector(KAFKA.WAIT_CONFIG)) {
          await closeWfConfigModalIfOpen(ctx);
        }
      },
      action: async (ctx) => {
        if (!document.querySelector(KAFKA.WAIT_CONFIG)) {
          await openWfNodeConfigModal(ctx, { nodeSelector: KAFKA.NODE_WAIT });
          await waitForWfConfigPanel(ctx, KAFKA.WAIT_CONFIG);
        }
        // Sustained ring on the open Wait panel — do not close before Next.
        await holdConfigSpotlight(ctx, KAFKA.WAIT_CONFIG, OUTCOME_PAUSE_MS);
      },
      verify: KAFKA.WAIT_CONFIG,
      pauseAfter: true,
    },

    // ── 5. Correlation (Wait modal stays open) ───────────────────
    {
      id: 'cw-wait-config',
      title: 'Correlation Matching',
      description:
        'Focus the **Correlation Matching** card. **ID expression** is `{{consumedKey}}` — filled by Consume\'s output binding. ' +
        '**Source** is **Body (JSONPath)**. **JSONPath** is `$.orderId`. Together: wait until the body\'s `orderId` equals the Kafka key we just consumed.',
      highlight: KAFKA.WAIT_CORRELATION_SECTION,
      preAction: async (ctx) => {
        await ensureWaitConfigOpen(ctx);
        // Scroll + ring before reading — DemoSpotlight alone often misses
        // fields inside the modal scroll viewport.
        await holdConfigSpotlight(ctx, KAFKA.WAIT_CORRELATION_SECTION, 80);
      },
      action: async (ctx) => {
        await holdConfigSpotlight(ctx, KAFKA.WAIT_CORRELATION_SECTION, OUTCOME_PAUSE_MS + 200);
      },
      verify: KAFKA.WAIT_CORRELATION_SECTION,
      pauseAfter: true,
    },

    // ── 6. Sample payload (same Wait modal) ──────────────────────
    {
      id: 'cw-sample-payload',
      title: 'Quick Test Sample',
      description:
        'Scroll to the **Quick Test** sample. The **Message body (JSON)** is injected as a literal (no `{{var}}` expansion) instead of waiting on the broker. ' +
        'Use a concrete `orderId` that matches the resolved **`{{consumedKey}}`** (here `ORDER-001`). ' +
        'Quick Test does **not** re-run live body matching — it trusts this sample. Extract Variables still read `amount` → `confirmedAmount`.',
      highlight: KAFKA.WAIT_SAMPLE_TEXTAREA,
      preAction: async (ctx) => {
        await ensureWaitConfigOpen(ctx);
        await holdConfigSpotlight(ctx, KAFKA.WAIT_SAMPLE_TEXTAREA, 80);
      },
      action: async (ctx) => {
        await holdConfigSpotlight(ctx, KAFKA.WAIT_SAMPLE_TEXTAREA, OUTCOME_PAUSE_MS + 200);
      },
      verify: KAFKA.WAIT_SAMPLE_TEXTAREA,
      pauseAfter: true,
    },

    // ── 7. Load test mode, then close Wait once ──────────────────
    {
      id: 'cw-load-mode',
      title: 'Load Test Mode',
      description:
        'In **Load test**, **Mode** is **Auto resume** — the Wait resolves with the sample on every Quick Test / load iteration. ' +
        '**Wait for real** would block until a live correlated message arrives. After you read the Mode control, we close the panel.',
      highlight: KAFKA.WAIT_LOAD_MODE_SELECT,
      preAction: async (ctx) => {
        await ensureWaitConfigOpen(ctx);
        await holdConfigSpotlight(ctx, KAFKA.WAIT_LOAD_MODE_SELECT, 200);
      },
      action: async (ctx) => {
        await holdConfigSpotlight(ctx, KAFKA.WAIT_LOAD_MODE_SELECT, OUTCOME_PAUSE_MS + 800);
        // Close once at the end of the Wait-config tour (not between steps).
        await closeWfConfigModalIfOpen(ctx);
        await ctx.delay(240);
      },
      verify: WF.QUICK_TEST_BTN,
      pauseAfter: true,
    },

    // ── 8. Open Console ──────────────────────────────────────────
    {
      id: 'cw-open-console',
      title: 'Open the Console',
      description:
        'Open the **Console** via the Console badge in the status bar (Floating mode beside the canvas). ' +
        'Open it *before* Quick Test so the full execution log is captured.',
      highlight: WF.CONSOLE_BADGE,
      preAction: async (ctx) => {
        await closeWfConfigModalIfOpen(ctx);
      },
      action: async (ctx) => {
        await openWfConsoleIfClosed(ctx);
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      verify: WF.CONSOLE,
      pauseAfter: true,
    },

    // ── 9. Quick Test ────────────────────────────────────────────
    {
      id: 'cw-quicktest',
      title: 'Quick Test the Full Chain',
      description:
        'Click **Quick Test** to run the full chain. With **Auto resume** and the sample body, the Wait resolves immediately. ' +
        'Watch the **Console** fill with each node\'s result — produce, consume, then wait with `confirmedAmount` from the sample.',
      highlight: WF.QUICK_TEST_BTN,
      preAction: async (ctx) => {
        await closeWfConfigModalIfOpen(ctx);
        await openWfConsoleIfClosed(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WF.QUICK_TEST_BTN);
        await ctx.waitFor('.wf-status-bar', 5000);
        await ctx.delay(1500);
      },
      pauseAfter: true,
    },

    // ── 10. Read console (highlight body; scroll lines — no flash) ─
    {
      id: 'cw-console',
      title: 'Console: Full Chain Results',
      description:
        'Read the **Console** log. Look for **CONSUME** (message batch) and **WAIT** resolving from the sample. ' +
        'The extracted `confirmedAmount` appears in the variable output when the Wait finishes.',
      highlight: '.wf-console-body',
      preAction: async (ctx) => {
        await openWfConsoleIfClosed(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor('.wf-console-body', 5000);
        await ctx.delay(300);

        const consumeLine = findConsoleLine('CONSUME')
          ?? findConsoleLine('Consume')
          ?? findConsoleLine('orders.created');
        if (consumeLine) {
          consumeLine.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          await ctx.delay(OUTCOME_PAUSE_MS);
        }

        const waitLine = findConsoleLine('WAIT')
          ?? findConsoleLine('sample')
          ?? findConsoleLine('confirmedAmount')
          ?? findConsoleLine('RESOLVED');
        if (waitLine) {
          waitLine.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          await ctx.delay(OUTCOME_PAUSE_MS);
        }

        await closeWfConsoleIfOpen(ctx);
      },
      verify: '.wf-console-body',
      pauseAfter: true,
    },
  ],
};
