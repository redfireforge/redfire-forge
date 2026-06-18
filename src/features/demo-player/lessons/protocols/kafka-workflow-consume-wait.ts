/**
 * Lesson K10: Workflow — Consume & Wait Nodes
 *
 * Extends the Kafka Produce Demo workflow with kafkaConsume and kafkaWait nodes.
 * Shows how to configure consume settings, bind output variables, set up correlation,
 * and use a sample payload so Quick Test can resolve the Wait without a live event.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { kafkaPublishSetup, kafkaCleanup } from '../setup-helpers';
import { WF, KAFKA } from '../../../../shared/selectors';

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
    name: 'Kafka Consume & Wait Demo',
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
          clusterId: '',
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
          clusterId: '',
          topic: '{{topic}}',
          keyRegex: '',
          headerFilters: [],
          jsonPathFilters: [],
          timeoutMs: 5000,
          maxMessages: 1,
          startPosition: 'earliest',
          loadTestBehavior: { mode: 'wait-for-real' },
          outputBindings: [{ source: 'firstMessageBody', targetVariable: 'firstOrder' }],
        },
      },
      {
        id: waitId,
        type: 'kafkaWait',
        position: { x: 250, y: 350 },
        data: {
          label: 'Wait for Confirmation',
          clusterId: '',
          topic: 'payments.confirmed',
          correlationIdExpression: '{{orderId}}',
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
  await kafkaPublishSetup(ctx);

  const win = window as unknown as Record<string, unknown>;
  const wfDelete = win.__wfDeleteByName as ((name: string) => void) | undefined;
  const wfInsert = win.__wfInsertWorkflow as ((wf: Record<string, unknown>) => void) | undefined;
  if (wfDelete) wfDelete('Kafka Consume & Wait Demo');
  if (wfInsert) {
    await ctx.delay(100);
    wfInsert(createKafkaConsumeWaitWorkflow());
  }

  ctx.navigateToTab('workflow');
  await ctx.delay(900);
  const fitBtn = document.querySelector('button[title="Fit view"]') as HTMLElement | null;
  if (fitBtn) { fitBtn.click(); await ctx.delay(400); }
}

async function kafkaWorkflowConsumeWaitCleanup(ctx: DemoActionContext): Promise<void> {
  const win = window as unknown as Record<string, unknown>;
  const wfDelete = win.__wfDeleteByName as ((name: string) => void) | undefined;
  if (wfDelete) wfDelete('Kafka Consume & Wait Demo');
  await kafkaCleanup(ctx);
}

/** Close any open workflow config modal by finding the "Close" button by text. */
async function closeConfigModal(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector<HTMLElement>('.wf-config-modal');
  if (!modal) return;
  const btns = Array.from(modal.querySelectorAll('button'));
  const closeBtn = btns.find(b => b.textContent?.trim() === 'Close');
  if (closeBtn) {
    closeBtn.click();
    await ctx.delay(400);
  }
}

/** Select the seeded workflow from the sidebar. */
async function selectConsumeWaitWorkflow(ctx: DemoActionContext): Promise<void> {
  const items = Array.from(document.querySelectorAll('.wf-sidebar-item, [data-testid="wf-sidebar-item"], .wf-workflow-item'));
  const target = items.find((el) => el.textContent?.includes('Kafka Consume & Wait Demo')) as HTMLElement | undefined;
  if (target) {
    target.click();
    await ctx.delay(500);
  }
}

export const kafkaWorkflowConsumeWaitLesson: DemoLesson = {
  id: 'kafka-workflow-consume-wait',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Workflow: Consume & Wait',
  description:
    'Add kafkaConsume and kafkaWait nodes to a workflow, bind consumed message variables, configure correlation matching, and use a sample payload so Quick Test resolves the Wait instantly.',
  estimatedMinutes: 6,

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',

  setup: kafkaWorkflowConsumeWaitSetup,
  cleanup: kafkaWorkflowConsumeWaitCleanup,

  concept: {
    title: 'Consume and Wait: Inbound Kafka Nodes',
    body: `While \`kafkaProduce\` sends messages, \`kafkaConsume\` and \`kafkaWait\` are the **inbound** half of the event-driven round-trip.

**kafkaConsume** — reads a bounded batch
- Fetches up to \`maxMessages\` from a topic starting at a configurable position
- Returns immediately when the batch is full or the timeout expires
- Output bindings extract data from the first message, all messages, or counts

**kafkaWait** — blocks until a correlated message arrives
- Stays open, consuming the topic, until a message matches the **correlation expression**
- Correlation can match on: message key, a header value, or a JSONPath expression in the body
- The \`{{variable}}\` in the correlation expression is resolved from the workflow's variable map
- If the message never arrives, the node fails after \`timeoutMs\`

**Sample Payload** (load test mode \`auto-resume\`):
During load tests or Quick Test, a real correlated event may never arrive. Setting a sample payload plus \`auto-resume\` mode makes the Wait node resolve immediately using the sample — without hanging the test run.`,
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
        term: 'Correlation Expression',
        definition:
          'The expression used by kafkaWait to identify the matching message. It can check the message key, a specific header, or a JSONPath field in the body against a workflow variable.',
      },
      {
        term: 'Sample Payload',
        definition:
          'A JSON string configured on kafkaWait that is used instead of a real message during Quick Test or load tests (when load mode is `auto-resume`). It prevents the workflow from hanging.',
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
  <text x="130" y="152" text-anchor="middle" fill="var(--text-muted)" font-size="8">→ firstOrder</text>
  <line x1="130" y1="162" x2="130" y2="180" stroke="var(--border)" stroke-width="1.3" marker-end="url(#cw-a)"/>
  <!-- Wait -->
  <rect x="60" y="182" width="140" height="52" rx="5" fill="var(--warning,#fab387)" opacity="0.2" stroke="var(--warning,#fab387)" stroke-width="1.3"/>
  <text x="130" y="200" text-anchor="middle" fill="var(--text)" font-size="10">kafkaWait</text>
  <text x="130" y="214" text-anchor="middle" fill="var(--text-muted)" font-size="8">$.orderId == {{"{{"}}orderId{{"}}"}}</text>
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
        'The **Kafka Consume & Wait Demo** workflow shows the complete event-driven round-trip: produce an order → consume from the same topic → wait for a payment confirmation. Open the workflow to explore each node.',
      highlight: WF.CANVAS,
      preAction: async (ctx) => {
        await selectConsumeWaitWorkflow(ctx);
      },
    },

    // Step 2: kafkaConsume node — double-click to open config modal
    {
      id: 'cw-consume-node',
      title: 'kafkaConsume Node',
      description:
        'The **kafkaConsume** node reads a batch of messages from a topic. **Double-click** it to open the config modal and inspect the settings: Topic, Max Messages (1), Timeout (5 s), Start Position (Earliest), and the Output Binding that stores the first message body in `firstOrder`.',
      highlight: KAFKA.NODE_CONSUME,
      preAction: async (ctx) => {
        await closeConfigModal(ctx);
      },
      action: async (ctx) => {
        const node = document.querySelector<HTMLElement>(KAFKA.NODE_CONSUME);
        if (node) {
          // Node config requires a double-click — single click only selects the node.
          node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
          await ctx.delay(600);
        }
      },
      verify: '.wf-config-modal',
    },

    // Step 3: Output binding on consume (config modal is open from step 2)
    {
      id: 'cw-consume-binding',
      title: 'Output Binding: firstMessageBody',
      description:
        'The **Output Binding** maps `firstMessageBody` → `firstOrder`. This makes the first consumed message\'s body available to all downstream nodes as `{{firstOrder}}`. You could also bind `messageCount`, `allMessages`, or `lastMessageBody`.',
      highlight: KAFKA.NODE_BINDING_ADD_BTN,
      preAction: async (ctx) => {
        // Ensure the consume config modal is open
        if (!document.querySelector('.wf-config-modal')) {
          const node = document.querySelector<HTMLElement>(KAFKA.NODE_CONSUME);
          if (node) {
            node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            await ctx.delay(600);
          }
        }
      },
    },

    // Step 4: kafkaWait node — double-click to open config modal
    {
      id: 'cw-wait-node',
      title: 'kafkaWait Node',
      description:
        'The **kafkaWait** node blocks execution until a message matching the correlation expression arrives. **Double-click** it to see its config: it listens on `payments.confirmed` and waits for a message where `$.orderId` equals `{{orderId}}`.',
      highlight: KAFKA.NODE_WAIT,
      preAction: async (ctx) => {
        await closeConfigModal(ctx);
      },
      action: async (ctx) => {
        const node = document.querySelector<HTMLElement>(KAFKA.NODE_WAIT);
        if (node) {
          // Node config requires a double-click — single click only selects the node.
          node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
          await ctx.delay(600);
        }
      },
      verify: '.wf-config-modal',
    },

    // Step 5: Correlation expression (wait modal is open from step 4)
    {
      id: 'cw-wait-config',
      title: 'Correlation Expression',
      description:
        'The **Correlation Expression** is `{{orderId}}` — the value of the `orderId` workflow variable. The **Correlation Source** is `body`, and the **JSONPath** is `$.orderId`. This means: "wait for a message on `payments.confirmed` where the body\'s `orderId` field matches the current order."',
      highlight: '.wf-config-modal',
      preAction: async (ctx) => {
        // Ensure the wait config modal is open
        if (!document.querySelector(KAFKA.WAIT_CONFIG)) {
          const node = document.querySelector<HTMLElement>(KAFKA.NODE_WAIT);
          if (node) {
            node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            await ctx.delay(600);
          }
        }
      },
    },

    // Step 6: Sample payload (wait modal is open from step 4/5)
    {
      id: 'cw-sample-payload',
      title: 'Sample Payload for Quick Test',
      description:
        'The **Sample Payload** is a JSON string that the Wait node uses instead of a real broker message during Quick Test (and load tests in `auto-resume` mode). It prevents the workflow from hanging. Set it once and Quick Test always resolves the Wait instantly.',
      highlight: KAFKA.WAIT_SAMPLE_TEXTAREA,
      preAction: async (ctx) => {
        if (!document.querySelector(KAFKA.WAIT_CONFIG)) {
          const node = document.querySelector<HTMLElement>(KAFKA.NODE_WAIT);
          if (node) {
            node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            await ctx.delay(600);
          }
        }
      },
    },

    // Step 7: Load test mode (wait modal is open)
    {
      id: 'cw-load-mode',
      title: 'Load Test Behavior',
      description:
        'The **Load Test Behavior** dropdown controls what happens during high-concurrency load tests. `auto-resume` resolves the Wait using the sample payload on every iteration — keeping throughput high. `wait-for-real` blocks until a real correlated message arrives — useful for integration tests but unsuitable for load tests.',
      highlight: KAFKA.WAIT_LOAD_MODE_SELECT,
      preAction: async (ctx) => {
        if (!document.querySelector(KAFKA.WAIT_CONFIG)) {
          const node = document.querySelector<HTMLElement>(KAFKA.NODE_WAIT);
          if (node) {
            node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            await ctx.delay(600);
          }
        }
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.WAIT_LOAD_MODE_SELECT);
        await ctx.delay(400);
      },
    },

    // Step 8: Quick Test (close modal first)
    {
      id: 'cw-quicktest',
      title: 'Quick Test the Full Chain',
      description:
        'Click **Quick Test** to run the full four-node chain. The sample payload means the Wait resolves immediately. The Console shows each node\'s result: produce offset, consumed messages, and the `confirmedAmount` variable extracted from the sample payload.',
      highlight: WF.QUICK_TEST_BTN,
      preAction: async (ctx) => {
        await closeConfigModal(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WF.QUICK_TEST_BTN);
        await ctx.delay(1500);
      },
    },

    // Step 9: Console
    {
      id: 'cw-console',
      title: 'Console: Full Chain Results',
      description:
        'The **Console** shows the complete execution log. Look for the CONSUME entry with `messageCount` and the WAIT entry showing `RESOLVED (sample)` — confirming the sample payload was used. The `confirmedAmount` variable is also visible in the variable table.',
      highlight: WF.CONSOLE,
    },

    // Step 10: Summary
    {
      id: 'cw-summary',
      title: 'Consume & Wait Summary',
      description:
        'You now have the complete Kafka workflow toolkit: Produce → Consume → Wait. Combine these with HTTP and WebSocket nodes for full end-to-end event-driven test workflows. In the next lesson, you\'ll configure a **Secure Cluster** with SASL/SCRAM authentication.',
      highlight: WF.CANVAS,
    },
  ],
};
