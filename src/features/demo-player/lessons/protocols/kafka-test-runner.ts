/**
 * Lesson K13: Run Kafka Workflow in Harness
 *
 * Demonstrates the Workflow Runner by running the "Kafka Produce Demo" workflow
 * against the live Redpanda stack and then navigating to the Results Dashboard
 * to inspect the workflow run results including PRODUCE badges.
 *
 * Setup:
 *   - Seeds "Kafka Produce Demo" workflow (Start → kafkaProduce → End)
 *   - Navigates to workflow-runner tab
 *
 * NOTE: initialTab intentionally NOT set — the demo navigates from
 * workflow-runner → results, so setting initialTab would trigger auto-exit.
 * allowedTabs includes 'results' to prevent exit when navigating there.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { ensureKafkaConnected } from '../setup-helpers';
import { deleteWorkflowByName, seedNamedWorkflow } from '../../adapters';

// ── Kafka Produce Demo Workflow Factory ────────────────────────────

function createKafkaHarnessDemoWorkflow(): Record<string, unknown> {
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
          bodyTemplate: '{"demo":"harness","runId":"{{runId}}"}',
          ackMode: 'leader',
          timeoutMs: 10000,
          outputBindings: [],
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

async function kafkaHarnessRunSetup(ctx: DemoActionContext): Promise<void> {
  // Connect to the plaintext broker via API (bypasses UI state issues)
  await ensureKafkaConnected();

  await seedNamedWorkflow(ctx, 'Kafka Produce Demo', createKafkaHarnessDemoWorkflow(), {
    deleteDelayMs: 0,
    insertPreDelayMs: 100,
    insertDelayMs: 0,
  });

  ctx.navigateToTab('workflow-runner');
  await ctx.delay(600);
}

async function kafkaHarnessRunCleanup(ctx: DemoActionContext): Promise<void> {
  deleteWorkflowByName('Kafka Produce Demo');
  ctx.navigateToTab('workflow-runner');
  await ctx.delay(300);
}

// ── Helpers ────────────────────────────────────────────────────────

/** Open the workflow picker and select "Kafka Produce Demo". */
async function selectKafkaProduceDemo(ctx: DemoActionContext): Promise<void> {
  await ctx.click('[data-testid="workflow-select"]');
  await ctx.waitFor('.wfp-dropdown-panel');
  await ctx.delay(400);
  const items = Array.from(document.querySelectorAll('.wfp-dropdown-item'));
  const target = items.find((el) => el.textContent?.includes('Kafka Produce Demo')) as HTMLElement | undefined;
  if (target) {
    target.click();
    await ctx.delay(700);
  }
}

/** Click Run Workflow and wait for the completion section to appear. */
async function runKafkaWorkflow(ctx: DemoActionContext): Promise<void> {
  await ctx.click('.config-form .form-actions .btn-primary');
  for (let i = 0; i < 30; i++) {
    await ctx.delay(500);
    if (document.querySelector('.completion-section')) break;
  }
  document.querySelector('.completion-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await ctx.delay(600);
}

// ── Lesson Definition ──────────────────────────────────────────────

export const kafkaTestRunnerLesson: DemoLesson = {
  id: 'kafka-test-runner',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Harness: Run Kafka Workflow',
  description:
    'Select the Kafka Produce Demo workflow in the Workflow Runner, set iterations, run it, and navigate to the Results Dashboard to inspect PRODUCE badges.',
  estimatedMinutes: 4,
  // initialTab intentionally omitted — navigates workflow-runner → results
  allowedTabs: ['results'],

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',

  setup: kafkaHarnessRunSetup,
  cleanup: kafkaHarnessRunCleanup,

  concept: {
    title: 'Running Kafka Workflows in the Test Harness',
    body: `The **Workflow Runner** turns a visual workflow into a tracked test run. Unlike Quick Test (which runs inside the Designer and discards the result), the Workflow Runner:

- **Saves every result** to the Results Dashboard with timestamps and timing data
- **Supports iterations** — run the same workflow N times (sequentially or concurrently) to generate load
- **Supports variable overrides** — change variables per-run without touching the workflow definition
- **Shows PRODUCE badges** in Results — every Kafka produce node that ran appears as a \`PRODUCE\` badge in the results table

**Workflow: Kafka Produce Demo**

The demo workflow is a minimal Start → kafkaProduce → End chain:
- Variable \`topic\` defaults to \`orders.created\` (override here to target a different topic)
- The body template includes \`{{runId}}\` — automatically filled with the harness run identifier
- Each iteration produces one message to the Kafka topic

**After running:**
Navigate to the **Results Dashboard** to inspect the run. Kafka-specific runs show:
| Column | Value |
|---|---|
| Method | \`PRODUCE\` |
| Target | Topic name |
| Status | \`OK\` / \`ERROR\` |
| Latency | Time from send to broker ack |`,
    keyTerms: [
      {
        term: 'Workflow Runner',
        definition:
          'The Test Harness tab that executes visual workflows as tracked, persisted test runs with configurable iterations and concurrency.',
      },
      {
        term: 'Iterations',
        definition:
          'How many times the workflow executes in a single run. Each iteration is an independent execution — useful for generating a controlled message load.',
      },
      {
        term: 'PRODUCE Badge',
        definition:
          'The method badge shown in the Results Dashboard for rows generated by a kafkaProduce node. Analogous to HTTP method badges (GET, POST) but for Kafka produce operations.',
      },
      {
        term: 'runId',
        definition:
          'A built-in workflow variable automatically set to a unique identifier for each run. Useful for embedding a unique trace ID in every produced message body.',
      },
    ],
    diagram: `<svg viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="150" rx="8" fill="#1e1e2e" />

  <!-- Step 1: Workflow Picker -->
  <rect x="10" y="20" width="90" height="110" rx="4" fill="#2a2a3a" stroke="#60a5fa" stroke-width="1" />
  <text x="55" y="38" text-anchor="middle" fill="#60a5fa" font-size="8" font-weight="bold">Workflow</text>
  <text x="55" y="50" text-anchor="middle" fill="#60a5fa" font-size="8" font-weight="bold">Picker</text>
  <rect x="18" y="56" width="74" height="15" rx="2" fill="#1e3a5f" />
  <text x="55" y="67" text-anchor="middle" fill="#93c5fd" font-size="7">Kafka Produce ▾</text>
  <rect x="18" y="76" width="74" height="36" rx="2" fill="#16213e" />
  <text x="55" y="88" text-anchor="middle" fill="#888" font-size="6.5">topic =</text>
  <text x="55" y="99" text-anchor="middle" fill="#a78bfa" font-size="6">orders.created</text>
  <text x="55" y="117" text-anchor="middle" fill="#888" font-size="6.5">3 iterations</text>

  <!-- Arrow 1 -->
  <path d="M103,75 L120,75" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#kr-a1)" />

  <!-- Step 2: Run -->
  <rect x="122" y="20" width="80" height="110" rx="4" fill="#2a2a3a" stroke="#4ade80" stroke-width="1" />
  <text x="162" y="38" text-anchor="middle" fill="#4ade80" font-size="8" font-weight="bold">▶ Run</text>
  <rect x="130" y="50" width="64" height="18" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="0.5" />
  <text x="162" y="62" text-anchor="middle" fill="#4ade80" font-size="7">Iter 1: PRODUCE ✓</text>
  <rect x="130" y="72" width="64" height="18" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="0.5" />
  <text x="162" y="84" text-anchor="middle" fill="#4ade80" font-size="7">Iter 2: PRODUCE ✓</text>
  <rect x="130" y="94" width="64" height="18" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="0.5" />
  <text x="162" y="106" text-anchor="middle" fill="#4ade80" font-size="7">Iter 3: PRODUCE ✓</text>
  <text x="162" y="124" text-anchor="middle" fill="#888" font-size="6.5">→ orders.created</text>

  <!-- Arrow 2 -->
  <path d="M205,75 L222,75" stroke="#4ade80" stroke-width="1.5" marker-end="url(#kr-a2)" />

  <!-- Step 3: Completion -->
  <rect x="224" y="20" width="80" height="48" rx="4" fill="#2a2a3a" stroke="#f59e0b" stroke-width="1" />
  <text x="264" y="38" text-anchor="middle" fill="#f59e0b" font-size="8" font-weight="bold">Completion</text>
  <text x="264" y="52" text-anchor="middle" fill="#888" font-size="6.5">3 requests · OK</text>
  <text x="264" y="62" text-anchor="middle" fill="#888" font-size="6.5">p50 12ms</text>

  <!-- Arrow 3 -->
  <path d="M264,70 L264,86" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#kr-a3)" />

  <!-- Step 4: Results -->
  <rect x="224" y="88" width="80" height="42" rx="4" fill="#2a2a3a" stroke="#a78bfa" stroke-width="1" />
  <text x="264" y="105" text-anchor="middle" fill="#a78bfa" font-size="8" font-weight="bold">Results</text>
  <text x="264" y="117" text-anchor="middle" fill="#a78bfa" font-size="7">PRODUCE badges</text>
  <text x="264" y="126" text-anchor="middle" fill="#888" font-size="6.5">× 3 rows</text>

  <!-- Kafka broker -->
  <rect x="318" y="20" width="72" height="110" rx="4" fill="#2a2a3a" stroke="#38bdf8" stroke-width="1" stroke-dasharray="4,3" />
  <text x="354" y="38" text-anchor="middle" fill="#38bdf8" font-size="7" font-weight="bold">Redpanda</text>
  <text x="354" y="50" text-anchor="middle" fill="#38bdf8" font-size="7" font-weight="bold">:19092</text>
  <text x="354" y="66" text-anchor="middle" fill="#888" font-size="6.5">orders.created</text>
  <text x="354" y="80" text-anchor="middle" fill="#4ade80" font-size="7">✓ msg ×3</text>
  <line x1="204" y1="84" x2="317" y2="70" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="3,2" />

  <defs>
    <marker id="kr-a1" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa"/></marker>
    <marker id="kr-a2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4ade80"/></marker>
    <marker id="kr-a3" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // Step 1: Workflow Runner tab
    {
      id: 'kr-intro',
      title: 'Kafka Workflow in Harness',
      description:
        '**⚠️ Prerequisite:** This demo requires a running Kafka broker. Start the Redpanda stack first:\n\n' +
        '```bash\ncd docker/kafka/plaintext && docker compose up -d\n```\n\n' +
        'You\'re in the **Workflow Runner** — the Harness tab for running visual workflows as tracked test executions. Every run here is saved to the Results Dashboard. You\'ll run the **Kafka Produce Demo** workflow and see the PRODUCE badges it generates.',
      highlight: '[data-testid="workflow-select"]',
    },

    // Step 2: Select the workflow
    {
      id: 'kr-pick',
      title: 'Select the Workflow',
      description:
        'Click the **Workflow** dropdown and select **Kafka Produce Demo**. The Initial Variables panel loads the workflow\'s variables — in this case just `topic` (defaulting to `orders.created`). You can override it here without touching the workflow definition.',
      highlight: '[data-testid="workflow-select"]',
      action: async (ctx) => {
        await selectKafkaProduceDemo(ctx);
      },
    },

    // Step 3: Inspect variables
    {
      id: 'kr-vars',
      title: 'Inspect Variables',
      description:
        'The **Initial Variables** row shows `topic = orders.created`. Try changing it to `payments.events` to produce to a different topic — the workflow definition stays untouched. Change it back to `orders.created` before running.',
      highlight: '.wfp-var-row, [data-testid="var-row"]',
    },

    // Step 4: Set iterations
    {
      id: 'kr-iterations',
      title: 'Set Iterations',
      description:
        'Set **Iterations** to **3** and **Concurrency** to **1**. This will produce 3 messages sequentially — enough to see multiple result rows in the dashboard without flooding the topic.',
      // Iterations is the 2nd .resilience-field child in the .resilience-row
      // (Concurrency is 1st, Iterations is 2nd, then a divider, then Timeout, etc.)
      highlight: '.resilience-row .resilience-field:nth-child(2)',
      preAction: async (ctx) => {
        // Fill via label lookup — no data-testid on these inputs
        const fillLabeledInput = (labelText: string, value: string) => {
          const field = Array.from(document.querySelectorAll('.resilience-field'))
            .find((el) => el.querySelector('label')?.textContent?.trim() === labelText);
          const input = field?.querySelector<HTMLInputElement>('input');
          if (!input) return;
          const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          nativeSet?.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        };
        fillLabeledInput('Iterations', '3');
        await ctx.delay(200);
        fillLabeledInput('Concurrency', '1');
        await ctx.delay(200);
      },
    },

    // Step 5: Run the workflow
    {
      id: 'kr-run',
      title: 'Run the Kafka Workflow',
      description:
        'Click **▶ Run Workflow**. The harness executes 3 iterations sequentially. Each iteration runs Start → kafkaProduce (produce one message to `orders.created`) → End. A progress indicator shows each node completing.',
      highlight: '.config-form .form-actions .btn-primary',
      action: async (ctx) => {
        await runKafkaWorkflow(ctx);
      },
    },

    // Step 6: Completion banner
    {
      id: 'kr-results',
      title: 'Completion Banner',
      description:
        'The **Completion Banner** shows total requests, overall status, and timing.\n\n' +
        '**Success (0% Error Rate):** All 3 iterations produced messages. The broker is healthy.\n\n' +
        '**Failure (100% Error Rate):** The Kafka broker is not reachable. Verify:\n' +
        '1. Docker is running: `docker ps | grep redpanda`\n' +
        '2. Start the stack if needed: `cd docker/kafka/plaintext && docker compose up -d`\n' +
        '3. Go to **Kafka Settings** → click **Connect** to reconnect\n' +
        '4. Re-run the workflow after the broker is up',
      highlight: '.completion-section, .wfp-completion-banner',
    },

    // Step 7: Navigate to Results Dashboard
    {
      id: 'kr-dashboard',
      title: 'View Results Dashboard',
      description:
        'Click **View Full Results →** (or navigate to the **Results** tab). The dashboard automatically filters to this workflow run. You\'ll see 3 rows — one per iteration — each showing the PRODUCE method badge.',
      highlight: '.completion-section a, .wfp-view-results-btn',
      action: async (ctx) => {
        // Try clicking the "View Full Results" link first
        const link = document.querySelector<HTMLElement>('.wfp-view-results-btn, .completion-section a, [data-testid="view-results-btn"]');
        if (link) {
          link.click();
          await ctx.delay(600);
        } else {
          ctx.navigateToTab('results');
          await ctx.delay(600);
        }
      },
    },

    // Step 8: PRODUCE badges
    {
      id: 'kr-badges',
      title: 'PRODUCE Badges',
      description:
        'Click the **Request Details** tab to see individual result rows. Each row has a **PRODUCE** method badge — the Kafka equivalent of HTTP\'s GET/POST badges. The URL column shows the topic name (`kafka://orders.created`).\n\n' +
        '**On success:** Click any row to see the partition, offset, and body that was produced. This is your audit trail for every Kafka message sent during the test.\n\n' +
        '**On failure:** The status shows ERROR and the row contains the error message (e.g., "Connection refused", "Broker not available"). Check that Docker/Redpanda is running and retry.',
      // Highlight the whole table row so the spotlight is large enough to see
      highlight: '.clickable-row',
      preAction: async (ctx) => {
        // 1. Switch to Request Details tab
        const requestDetailsTab = Array.from(
          document.querySelectorAll<HTMLElement>('.results-view-tab'),
        ).find((el) => el.textContent?.trim() === 'Request Details');
        if (requestDetailsTab) {
          requestDetailsTab.click();
          await ctx.delay(400);
        }
        // 2. Switch to flat view (groupBy = "test") so rows render immediately
        //    without needing to expand collapsed groups.
        const groupBySelect = document.querySelector<HTMLSelectElement>('.group-by-controls select');
        if (groupBySelect) {
          const nativeSet = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
          nativeSet?.call(groupBySelect, 'test');
          groupBySelect.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(400);
        }
      },
    },
  ],
};
