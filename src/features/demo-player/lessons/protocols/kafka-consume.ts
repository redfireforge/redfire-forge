/** Lesson K3: Consume Studio — fetch messages from a topic and inspect results */
import type { DemoLesson } from '../../types';
import { kafkaPublishSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '../../../../shared/selectors';

/** Topic to consume from — same topic K2 published to. */
const DEMO_TOPIC = 'orders.created';

export const kafkaConsumeLesson: DemoLesson = {
  id: 'kafka-consume',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Consume Studio',
  description:
    'Read messages from a Kafka topic and inspect partition, offset, key, and payload in the detail pane.',
  estimatedMinutes: 4,
  initialTab: 'kafka-message-studio',
  allowedTabs: ['kafka-settings'],

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',

  setup: kafkaPublishSetup,
  cleanup: kafkaCleanup,

  concept: {
    title: 'Reading Messages with the Consume Studio',
    body: `The **Consume Studio** is your Kafka consumer. It lets you pull a bounded set of messages from any topic — no code, no consumer group boilerplate.

**Start Position** controls where in the partition log consumption begins:
- \`Earliest\` — reads from the very first stored message (offset 0)
- \`Latest\` — reads only messages arriving after the consume request

**Max Messages** caps how many rows are returned per request. Combined with a timeout, this gives you a fast bounded fetch: perfect for spot-checks and debugging.

**Consumer Group ID** is generated automatically per session so each demo consume starts fresh. In production, group IDs track commit offsets so multiple consumers can divide the workload.

**The result table** shows every fetched message: row number, \`Offset\`, \`Partition\`, \`Key\`, and a value preview. Click any row to open the **Detail Pane** — pretty-printed payload, copy buttons, and header inspection.`,
    keyTerms: [
      {
        term: 'Consumer Group',
        definition:
          'A named group of consumers that coordinate to read a topic. Each partition is assigned to exactly one consumer in the group at a time. Committed offsets let the group resume from where it left off.',
      },
      {
        term: 'Start Position',
        definition:
          'Controls where in the partition log consumption begins. "Earliest" reads from offset 0; "Latest" reads only new messages arriving after the request.',
      },
      {
        term: 'Bounded Consume',
        definition:
          'A fetch that stops after maxMessages or timeoutMs — whichever comes first. Ideal for debugging specific events without subscribing indefinitely.',
      },
      {
        term: 'Detail Pane',
        definition:
          'Slides in when you click a result row. Shows the full payload pretty-printed, message key, partition, offset, and any headers — everything needed to trace the message.',
      },
    ],
    diagram: `<svg viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg">
  <!-- Topic box -->
  <rect x="10" y="20" width="120" height="110" rx="6" fill="var(--accent)" opacity="0.12" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="70" y="40" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">orders.created</text>
  <!-- Partition rows -->
  <rect x="20" y="48" width="100" height="18" rx="3" fill="var(--accent)" opacity="0.25"/>
  <text x="70" y="60" text-anchor="middle" fill="var(--text)" font-size="9">P0: 0 1 2 3 4 …</text>
  <rect x="20" y="72" width="100" height="18" rx="3" fill="var(--accent)" opacity="0.15"/>
  <text x="70" y="84" text-anchor="middle" fill="var(--text)" font-size="9">P1: 0 1 2 …</text>
  <rect x="20" y="96" width="100" height="18" rx="3" fill="var(--accent)" opacity="0.08"/>
  <text x="70" y="108" text-anchor="middle" fill="var(--text)" font-size="9">P2: 0 1 …</text>
  <!-- Arrow: Topic → Consumer -->
  <line x1="130" y1="75" x2="175" y2="75" stroke="var(--success,#22c55e)" stroke-width="1.5" marker-end="url(#con-arrow)"/>
  <text x="152" y="67" text-anchor="middle" fill="var(--text-muted)" font-size="9">fetch</text>
  <!-- Consumer box -->
  <rect x="175" y="52" width="95" height="46" rx="6" fill="var(--success,#22c55e)" opacity="0.15" stroke="var(--success,#22c55e)" stroke-width="1.5"/>
  <text x="222" y="72" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">Consumer</text>
  <text x="222" y="88" text-anchor="middle" fill="var(--text-muted)" font-size="9">earliest → latest</text>
  <!-- Arrow: Consumer → Results -->
  <line x1="270" y1="75" x2="310" y2="75" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#con-arrow2)"/>
  <!-- Results table box -->
  <rect x="310" y="38" width="82" height="74" rx="6" fill="var(--primary)" opacity="0.12" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="351" y="58" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">Results</text>
  <text x="351" y="72" text-anchor="middle" fill="var(--text-muted)" font-size="8">offset · partition</text>
  <text x="351" y="84" text-anchor="middle" fill="var(--text-muted)" font-size="8">key · value</text>
  <text x="351" y="100" text-anchor="middle" fill="var(--text-muted)" font-size="8">→ detail pane</text>
  <defs>
    <marker id="con-arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--success,#22c55e)" stroke-width="1.5"/></marker>
    <marker id="con-arrow2" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // ── Step 1: Navigate to Consume tab ─────────────────────────────────────
    {
      id: 'con-intro',
      title: 'The Consume Tab',
      description:
        'The **Consume** tab is your Kafka consumer. Set a **Topic**, choose a **Start Position**, cap the batch with **Max Messages**, and click **Consume Once** to pull a snapshot of messages from the broker.',
      highlight: KAFKA.CONSUME_TAB,
      // preAction: silently switch to Consume tab before the step description shows
      // (must happen before any subsequent steps fill consume-form fields)
      preAction: async (ctx) => {
        await ctx.click(KAFKA.CONSUME_TAB);
        await ctx.delay(300);
      },
    },

    // ── Step 2: Set the topic ────────────────────────────────────────────────
    {
      id: 'con-topic',
      title: 'Set the Topic',
      description:
        'Type `orders.created` — the same topic K2 published to. The Consumer Studio will read messages from this topic.',
      highlight: KAFKA.CON_TOPIC_INPUT,
      action: async (ctx) => {
        await ctx.fill(KAFKA.CON_TOPIC_INPUT, DEMO_TOPIC);
        await ctx.delay(400);
      },
    },

    // ── Step 3: Set start position ───────────────────────────────────────────
    {
      id: 'con-position',
      title: 'Start from Earliest',
      description:
        '**Start Position** controls where reading begins in the partition log. `Earliest` starts from offset 0 — you will see every message ever written. `Latest` skips history and only reads new arrivals.',
      highlight: KAFKA.CON_POSITION_SELECT,
      action: async (ctx) => {
        await ctx.selectOption(KAFKA.CON_POSITION_SELECT, 'earliest');
        await ctx.delay(300);
      },
    },

    // ── Step 4: Set max messages ─────────────────────────────────────────────
    {
      id: 'con-max',
      title: 'Limit the Batch Size',
      description:
        '**Max Messages** caps how many rows are returned. Set it to `5` for a fast, focused fetch. The consumer stops as soon as it hits this limit or the timeout — whichever comes first.',
      highlight: KAFKA.CON_MAX_INPUT,
      action: async (ctx) => {
        await ctx.fill(KAFKA.CON_MAX_INPUT, '5');
        await ctx.delay(300);
      },
    },

    // ── Step 5: Consume Once ─────────────────────────────────────────────────
    {
      id: 'con-consume',
      title: 'Consume Once',
      description:
        'Click **Consume Once** to pull messages from the broker. The button spins while the request is in flight — results appear as a table once the broker responds.',
      highlight: KAFKA.CON_CONSUME_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.CON_CONSUME_BTN);
        await ctx.delay(400);
      },
      verify: KAFKA.CON_RESULTS_ZONE,
    },

    // ── Step 6: Inspect the results table ───────────────────────────────────
    {
      id: 'con-table',
      title: 'The Results Table',
      description:
        'Each row shows **#** (row number), **Offset**, **Partition**, **Key**, and a **Value** preview. The header shows total message count. Click any row to open the detail pane.',
      highlight: KAFKA.CON_RESULTS_ZONE,
      // Informational — no action.
    },

    // ── Step 7: Click the first row ──────────────────────────────────────────
    {
      id: 'con-row',
      title: 'Click a Row',
      description:
        'Click the first result row to open the **Detail Pane**. It slides in alongside the table — showing the full message payload, key, partition, offset, and any headers.',
      highlight: KAFKA.CON_RESULTS_ZONE,
      action: async (ctx) => {
        await ctx.click('[data-testid="con-row-0"]');
        await ctx.delay(400);
      },
    },

    // ── Step 8: Inspect the detail pane ─────────────────────────────────────
    {
      id: 'con-detail',
      title: 'The Detail Pane',
      description:
        'The **Detail Pane** shows the full pretty-printed payload alongside **Copy Key** and **Copy Payload** buttons. Use it to trace, debug, or forward message data without leaving the UI.',
      highlight: KAFKA.CON_DETAIL_PANE,
      // Informational — no action.
    },

    // ── Step 9: Export the result set ───────────────────────────────────────
    {
      id: 'con-export',
      title: 'Export the Result Set',
      description:
        'Click **Export** to download the full result set as a JSON file. Every row — offset, partition, key, value, headers — is included. Ideal for sharing evidence or feeding into other tools.',
      highlight: KAFKA.CON_EXPORT_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.CON_EXPORT_BTN);
        await ctx.delay(300);
      },
    },
  ],
};
