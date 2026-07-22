/** Lesson K3: Consume Studio — fetch messages from a topic and inspect results */
import type { DemoLesson } from '../../types';
import { kafkaPublishSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '@shared/selectors';
import { dispatchKafkaOperation } from '@shared/kafka/kafkaClient';

/**
 * Unique topic per lesson session — prevents duplicate messages from accumulating
 * across multiple lesson runs (Kafka topics are append-only).
 */
let sessionTopic = '';
function getDemoTopic(): string {
  if (!sessionTopic) sessionTopic = `orders.consume-demo-${Date.now()}`;
  return sessionTopic;
}

/** Resolve the currently connected cluster ID from the Kafka server status. */
async function getActiveClusterId(): Promise<string | null> {
  try {
    const status = await dispatchKafkaOperation<{ state: string; clusterId?: string }>('status');
    if (status.data?.state === 'connected' && status.data.clusterId) {
      return status.data.clusterId;
    }
  } catch { /* server not running */ }
  return null;
}

/** Clear all filter inputs so leftover values from other lessons don't hide results. */
async function clearAllFilters(ctx: { fill: (sel: string, val: string) => Promise<void>; delay: (ms: number) => Promise<void> }): Promise<void> {
  await ctx.fill(KAFKA.CON_GROUP_INPUT, '');
  await ctx.fill(KAFKA.CON_KEY_FILTER_INPUT, '');
  await ctx.fill(KAFKA.CON_HEADER_FILTER_INPUT, '');
  await ctx.fill(KAFKA.CON_JSONPATH_INPUT, '');
  await ctx.fill(KAFKA.CON_JSONVAL_INPUT, '');
  await ctx.delay(100);
}

/** Prevents duplicate seeding across setup + preAction calls within one lesson run. */
let seeded = false;

/** Reset the seed flag (call from setup before seeding). */
function resetSeedFlag(): void { seeded = false; }

/**
 * Pre-seed 5 varied messages so each result row shows distinct data.
 * Idempotent per lesson run — only produces once to avoid duplicates.
 */
async function seedDemoMessages(): Promise<void> {
  if (seeded) return;
  const clusterId = await getActiveClusterId();
  if (!clusterId) return; // not connected — nothing to seed

  const messages = [
    {
      key: 'user-alice',
      value: JSON.stringify({
        orderId: 'ORD-7001',
        customer: 'Alice Chen',
        status: 'CREATED',
        items: [{ sku: 'WIDGET-A', qty: 2, price: 24.99 }],
        total: 49.98,
        region: 'us-east',
        priority: 'standard',
      }),
      headers: { traceId: 'trc-a1b2c3', source: 'web-checkout', env: 'production' },
    },
    {
      key: 'user-bob',
      value: JSON.stringify({
        orderId: 'ORD-7002',
        customer: 'Bob Smith',
        status: 'SHIPPED',
        items: [{ sku: 'GADGET-X', qty: 1, price: 129.00 }],
        total: 129.00,
        region: 'eu-west',
        priority: 'express',
        trackingId: 'TRK-88421',
      }),
      headers: { traceId: 'trc-d4e5f6', source: 'fulfillment-svc', env: 'production' },
    },
    {
      key: 'user-carol',
      value: JSON.stringify({
        orderId: 'ORD-7003',
        customer: 'Carol Davis',
        status: 'DELIVERED',
        items: [
          { sku: 'SENSOR-M', qty: 3, price: 18.50 },
          { sku: 'CABLE-USB', qty: 1, price: 12.00 },
        ],
        total: 67.50,
        region: 'ap-south',
        priority: 'standard',
        deliveredAt: '2026-07-20T14:32:00Z',
      }),
      headers: { traceId: 'trc-g7h8i9', source: 'delivery-svc', env: 'production' },
    },
    {
      key: 'user-dan',
      value: JSON.stringify({
        orderId: 'ORD-7004',
        customer: 'Dan Park',
        status: 'REFUNDED',
        items: [{ sku: 'MONITOR-27', qty: 1, price: 349.00 }],
        total: 349.00,
        region: 'us-west',
        priority: 'express',
        refundReason: 'defective pixel cluster',
      }),
      headers: { traceId: 'trc-j0k1l2', source: 'returns-portal', env: 'production', refundApprover: 'auto' },
    },
    {
      key: 'user-eve',
      value: JSON.stringify({
        orderId: 'ORD-7005',
        customer: 'Eve Lopez',
        status: 'PROCESSING',
        items: [
          { sku: 'KEYBOARD-K2', qty: 1, price: 89.00 },
          { sku: 'MOUSEPAD-XL', qty: 1, price: 19.99 },
        ],
        total: 108.99,
        region: 'eu-central',
        priority: 'standard',
      }),
      headers: { traceId: 'trc-m3n4o5', source: 'mobile-app', env: 'staging' },
    },
  ];

  // Produce all in a single batch call for speed
  try {
    await dispatchKafkaOperation('produce', {
      clusterId,
      topic: getDemoTopic(),
      messages,
    });
    seeded = true;
  } catch {
    // Broker may not be running — fail silently; lesson will show empty results
  }
}

/** Ensure the Consume tab has results — navigate, clear filters, seed, and consume if needed. */
async function ensureConsumeResults(ctx: { click: (sel: string) => Promise<void>; fill: (sel: string, val: string) => Promise<void>; delay: (ms: number) => Promise<void>; waitFor: (sel: string, timeout: number) => Promise<void> }): Promise<void> {
  await ctx.click(KAFKA.CONSUME_TAB);
  await ctx.delay(200);
  if (!document.querySelector(KAFKA.CON_RESULTS_ZONE)) {
    const topicInput = document.querySelector<HTMLInputElement>(KAFKA.CON_TOPIC_INPUT);
    if (topicInput && (!topicInput.value || topicInput.value.trim() === '')) {
      await ctx.fill(KAFKA.CON_TOPIC_INPUT, getDemoTopic());
    }
    await clearAllFilters(ctx);
    await seedDemoMessages();
    await ctx.delay(200);
    await ctx.click(KAFKA.CON_CONSUME_BTN);
    try { await ctx.waitFor(KAFKA.CON_RESULTS_ZONE, 15000); } catch { /* */ }
    await ctx.delay(300);
  }
}

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
  tag: '🐳 Docker',

  setup: async (ctx) => {
    // Generate a fresh topic each run so no stale duplicates accumulate
    sessionTopic = `orders.consume-demo-${Date.now()}`;
    resetSeedFlag();
    await kafkaPublishSetup(ctx);
    // Pre-seed sample messages so the consume step always finds data
    await seedDemoMessages();
    await ctx.delay(300);
  },
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
      preAction: async (ctx) => {
        // Switch to the Consume tab first so the form is visible.
        await ctx.click(KAFKA.CONSUME_TAB);
        await ctx.delay(300);
        // Ensure "Consume Once" mode is active — if the user previously switched
        // to Stream mode, con-consume-btn won't be in the DOM and the consume
        // step would silently fail.
        await ctx.click(KAFKA.CON_MODE_ONCE);
        await ctx.delay(200);
        // Clear stale filters left by prior lessons (e.g. K4 Headers & Filters
        // leaves JSONPath $.status = CREATED which silently filters out results)
        await clearAllFilters(ctx);
      },
    },

    // ── Step 2: Set the topic ────────────────────────────────────────────────
    {
      id: 'con-topic',
      title: 'Set the Topic',
      description:
        'Type the demo topic name — the topic our setup pre-seeded with varied order events. The Consume Studio will read messages from this topic.',
      highlight: KAFKA.CON_TOPIC_INPUT,
      action: async (ctx) => {
        await ctx.fill(KAFKA.CON_TOPIC_INPUT, getDemoTopic());
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
        // Spotlight the Start Position dropdown
        const posSelect = document.querySelector<HTMLElement>(KAFKA.CON_POSITION_SELECT);
        if (posSelect) {
          posSelect.scrollIntoView({ block: 'nearest' });
          posSelect.style.outline = '2px solid var(--primary)';
          posSelect.style.outlineOffset = '2px';
          posSelect.style.borderRadius = '6px';
          await ctx.delay(800);

          // Open the dropdown
          const trigger = posSelect.querySelector<HTMLElement>('.cs-trigger');
          if (trigger) trigger.click();
          await ctx.delay(600);

          // Click "Earliest" option
          const items = posSelect.querySelectorAll<HTMLElement>('.cs-item');
          for (const item of items) {
            if (item.textContent?.includes('Earliest')) {
              item.style.outline = '2px solid var(--primary)';
              item.style.outlineOffset = '1px';
              item.style.borderRadius = '4px';
              await ctx.delay(600);
              item.click();
              item.style.outline = '';
              item.style.outlineOffset = '';
              item.style.borderRadius = '';
              break;
            }
          }
          await ctx.delay(600);

          posSelect.style.outline = '';
          posSelect.style.outlineOffset = '';
          posSelect.style.borderRadius = '';
        }
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
        'Click **Consume Once** to pull messages from the broker. Watch the button switch to **Consuming…** while the request is in flight — results appear as a table once the broker responds.',
      highlight: KAFKA.CON_CONSUME_BTN,
      preAction: async (ctx) => {
        // Guard: ensure topic + Earliest are set even if the user skipped steps
        const topicInput = document.querySelector<HTMLInputElement>(KAFKA.CON_TOPIC_INPUT);
        if (topicInput && (!topicInput.value || topicInput.value.trim() === '')) {
          await ctx.fill(KAFKA.CON_TOPIC_INPUT, getDemoTopic());
        }
        // Clear consumer group + all filters — leftover values from a prior lesson
        // (e.g. K4 Headers & Filters) would silently filter out results or cause
        // committed-offset skips
        await clearAllFilters(ctx);
        // Ensure Start Position is "Earliest" so we see seeded messages
        const posSelect = document.querySelector<HTMLElement>(KAFKA.CON_POSITION_SELECT);
        if (posSelect) {
          const currentValue = posSelect.querySelector('.cs-trigger')?.textContent?.trim();
          if (currentValue !== 'Earliest') {
            const trigger = posSelect.querySelector<HTMLElement>('.cs-trigger');
            if (trigger) trigger.click();
            await ctx.delay(200);
            const items = posSelect.querySelectorAll<HTMLElement>('.cs-item');
            for (const item of items) {
              if (item.textContent?.includes('Earliest')) { item.click(); break; }
            }
            await ctx.delay(200);
          }
        }
        // Seed messages again in case setup didn't run or broker was slow
        await seedDemoMessages();
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.CON_CONSUME_BTN);
        // Wait for results or error — give the broker time to respond
        await ctx.waitFor(KAFKA.CON_RESULTS_ZONE, 15000);
        await ctx.delay(700);
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
      preAction: async (ctx) => {
        await ensureConsumeResults(ctx);
      },
    },

    // ── Step 7: Click a row → Message Detail modal ─────────────────────────
    {
      id: 'con-row',
      title: 'Click a Row',
      description:
        'Click a result row to open the **Message Detail** modal — it shows the full pretty-printed payload, metadata (offset, partition, timestamp, topic), key, and headers. Use **Copy Key** / **Copy Payload** or **Use as Workflow Input** to forward data.',
      highlight: KAFKA.CON_RESULTS_ZONE,
      preAction: async (ctx) => {
        await ensureConsumeResults(ctx);
        // Close any existing modal so we get a fresh open
        const closeBtn = document.querySelector<HTMLElement>(KAFKA.CON_DETAIL_CLOSE);
        if (closeBtn) { closeBtn.click(); await ctx.delay(200); }
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        await ctx.click('[data-testid="con-row-0"]');
        await ctx.waitFor(KAFKA.CON_DETAIL_MODAL, 3000);
        await ctx.delay(600);

        // 1. Spotlight Key
        const keyEl = document.querySelector<HTMLElement>('[data-testid="kmd-key"]');
        if (keyEl) {
          keyEl.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(keyEl);
          await ctx.delay(1200);
          rm();
        }

        // 2. Spotlight Headers table
        const headersEl = document.querySelector<HTMLElement>('[data-testid="kmd-headers"]');
        if (headersEl) {
          headersEl.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(headersEl);
          await ctx.delay(1200);
          rm();
        }

        // 3. Spotlight Message Body
        const bodyEl = document.querySelector<HTMLElement>('[data-testid="kmd-body"]');
        if (bodyEl) {
          bodyEl.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(bodyEl);
          await ctx.delay(1500);
          rm();
        }

        // Close the modal and deselect the row so the highlight clears
        const closeBtn = document.querySelector<HTMLElement>(KAFKA.CON_DETAIL_CLOSE);
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(400);
        }
      },
    },

    // ── Step 9: Export the result set ───────────────────────────────────────
    {
      id: 'con-export',
      title: 'Export the Result Set',
      description:
        'Click **Export Result Set** to download the full result set as a JSON file. Every row — offset, partition, key, value, headers — is included. Ideal for sharing evidence or feeding into other tools.',
      highlight: KAFKA.CON_EXPORT_BTN,
      preAction: async (ctx) => {
        await ensureConsumeResults(ctx);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.CON_EXPORT_BTN);
        await ctx.delay(400);
      },
    },
  ],
};
