/** Lesson K4: Headers & Filters — annotate messages with headers and consume selectively */
import type { DemoLesson } from '../../types';
import { fillControlledInput, kafkaPublishSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '@shared/selectors';
import { dispatchKafkaOperation } from '@shared/kafka/kafkaClient';

/**
 * Unique topic per lesson session — prevents duplicate messages from accumulating
 * across multiple lesson runs (Kafka topics are append-only).
 */
let sessionTopic = '';
function getDemoTopic(): string {
  if (!sessionTopic) sessionTopic = `headers.demo-${Date.now()}`;
  return sessionTopic;
}
/** Key used on the published message — also used in the keyEquals filter. */
const DEMO_KEY = 'HDR-001';
/** Message body (minified for produce; pretty-printed in the demo via the Pretty Format button). */
const DEMO_BODY = JSON.stringify({ orderId: 'HDR-001', status: 'CREATED', region: 'us-east' });
/** Header key — a correlation / trace field. */
const HEADER_KEY = 'traceId';
/** Header value. */
const HEADER_VALUE = 'abc-001';

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

/** Prevents duplicate seeding across setup + preAction calls within one lesson run. */
let headerSeeded = false;

/** Reset the seed flag (call from setup). */
function resetHeaderSeedFlag(): void { headerSeeded = false; }

/**
 * Pre-seed a message with the header so consume steps always find data.
 * Idempotent per lesson run — only produces once to avoid duplicates.
 */
async function seedHeaderMessage(): Promise<void> {
  if (headerSeeded) return;
  const clusterId = await getActiveClusterId();
  if (!clusterId) return;
  try {
    await dispatchKafkaOperation('produce', {
      clusterId,
      topic: getDemoTopic(),
      messages: [{
        key: DEMO_KEY,
        value: DEMO_BODY,
        headers: { [HEADER_KEY]: HEADER_VALUE },
      }],
    });
    headerSeeded = true;
  } catch {
    // Broker may not be running — fail silently
  }
}

/**
 * Select "Earliest" in the Start Position CustomSelect.
 * Menu is portaled to `document.body` (not inside the select wrapper) — query `.cs-menu`
 * after opening the trigger. `ctx.selectOption` does not work with CustomSelect.
 */
async function selectEarliestPosition(ctx: {
  delay: (ms: number) => Promise<void>;
  click?: (sel: string) => Promise<void>;
  waitFor?: (sel: string, timeoutMs?: number) => Promise<void>;
}): Promise<void> {
  const posSelect = document.querySelector<HTMLElement>(KAFKA.CON_POSITION_SELECT);
  if (!posSelect) return;
  const currentValue = posSelect.querySelector('.cs-trigger')?.textContent?.trim() ?? '';
  if (currentValue.includes('Earliest')) return;

  const trigger = posSelect.querySelector<HTMLElement>('.cs-trigger');
  if (!trigger) return;
  if (ctx.click) {
    await ctx.click(`${KAFKA.CON_POSITION_SELECT} .cs-trigger`);
  } else {
    trigger.click();
  }
  if (ctx.waitFor) {
    try { await ctx.waitFor('.cs-menu', 2000); } catch { /* menu may already be open */ }
  } else {
    await ctx.delay(200);
  }
  await ctx.delay(150);

  const menu = document.querySelector<HTMLElement>('body > .cs-menu, .cs-menu');
  if (!menu) return;
  const items = Array.from(menu.querySelectorAll<HTMLElement>('.cs-item, [role="option"]'));
  for (const item of items) {
    if (item.textContent?.includes('Earliest')) {
      item.click();
      await ctx.delay(200);
      return;
    }
  }
}

// ── File-private selectors ────────────────────────────────────────────────────
// Use :last-child — the "+ Add" button always appends, so the newest row is
// always last. This is robust even if old rows remain (e.g. on a repeat run).
/** Newest header row key input — placeholder must match KafkaPublishStudio. */
const HEADER_ROW_KEY = '.kafka-ms-kv-row:last-child input[placeholder="header-key"]';
/** Newest header row value input. */
const HEADER_ROW_VAL = '.kafka-ms-kv-row:last-child input[placeholder="value"]';
/** Delete button selector — used to clear any rows left over from previous runs. */
const HEADER_REMOVE_BTN = '.kafka-ms-remove-btn';
/** The Filters section container — used as a highlight target. */
const FILTERS_SECTION = '.kafka-ms-con-filters';

const CONSUME_FILTER_SELECTORS = [
  KAFKA.CON_KEY_FILTER_INPUT,
  KAFKA.CON_HEADER_FILTER_INPUT,
  KAFKA.CON_JSONPATH_INPUT,
  KAFKA.CON_JSONVAL_INPUT,
  KAFKA.CON_BODY_CONTAINS_INPUT,
] as const;

/**
 * Clear all consume filters without visible ripples/focus.
 * Visible `ctx.fill` on Body Contains during Key/Header steps left that field
 * looking like it was spotlighted (focus + leftover rings).
 */
function clearConsumeFiltersQuiet(): void {
  for (const sel of CONSUME_FILTER_SELECTORS) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      fillControlledInput(el, '');
    }
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

export const kafkaHeadersFiltersLesson: DemoLesson = {
  id: 'kafka-headers-filters',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Headers & Filters',
  description:
    'Annotate messages with custom headers for traceability, then consume selectively using Key, Header-Match, JSONPath, and Body Contains filters.',
  estimatedMinutes: 5,
  initialTab: 'kafka-message-studio',
  allowedTabs: ['kafka-settings'],

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',
  tag: '🐳 Docker',

  setup: async (ctx) => {
    // Generate a fresh topic each run so no stale duplicates accumulate
    sessionTopic = `headers.demo-${Date.now()}`;
    resetHeaderSeedFlag();
    await kafkaPublishSetup(ctx);
    // Pre-seed a message with header so consume steps always find data
    await seedHeaderMessage();
    await ctx.delay(300);
  },
  cleanup: kafkaCleanup,

  concept: {
    title: 'Headers, Keys, and Selective Consumption',
    body: `Kafka messages carry two types of metadata beyond the body: the **key** and **headers**.

**Message Key** routes the message to a deterministic partition and is useful for entity-level ordering. In a consuming filter, **Key Equals** returns only messages whose key matches exactly — perfect for fetching all events for a single entity.

**Headers** are arbitrary key-value pairs attached outside the message body. They are never serialised into the payload, so consumers can inspect them without deserialising the value. Common uses:
- \`traceId\` / \`correlationId\` — distributed tracing
- \`source\` — origin service or system
- \`env\` — staging / production segregation

**Consume Filters** in the Studio let you narrow a batch fetch to exactly the events you care about:
| Filter | Matches when… |
|---|---|
| **Key Equals** | message key == provided string |
| **Header Match** | header \`key=value\` is present on the message |
| **JSONPath** | a JSON field path exists in the value |
| **JSONPath Equals** | that field's value == expected string |
| **Body Contains** | message body includes the search text (case-insensitive) |

Filters are applied server-side before messages are returned — you never download messages you don't need.`,
    keyTerms: [
      {
        term: 'Message Header',
        definition:
          'A key-value pair attached to a Kafka message at the envelope level, outside the payload. Headers are stored and forwarded by the broker but never parsed by it.',
      },
      {
        term: 'Key Equals Filter',
        definition:
          'A consume filter that returns only messages whose message key exactly matches the provided string. Useful for fetching all events belonging to one entity.',
      },
      {
        term: 'Header Match Filter',
        definition:
          'A consume filter expressed as "key=value". Returns only messages that carry that header key with that exact value.',
      },
      {
        term: 'JSONPath Filter',
        definition:
          'A consume filter using a JSONPath expression (e.g. $.status). Combined with JSONPath Equals, it returns only messages whose body contains that field with the expected value.',
      },
      {
        term: 'Body Contains Filter',
        definition:
          'A free-text consume filter. Returns only messages whose raw body includes the search string (case-insensitive). Ideal for quickly finding messages mentioning a specific ID, keyword, or error code.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 160" xmlns="http://www.w3.org/2000/svg">
  <!-- Producer -->
  <rect x="8" y="55" width="90" height="50" rx="6" fill="var(--primary)" opacity="0.18" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="53" y="76" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">Producer</text>
  <text x="53" y="90" text-anchor="middle" fill="var(--text-muted)" font-size="8">key: HDR-001</text>
  <text x="53" y="101" text-anchor="middle" fill="var(--text-muted)" font-size="8">traceId: abc-001</text>
  <!-- Arrow Producer → Broker -->
  <line x1="98" y1="80" x2="140" y2="80" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#hf-a1)"/>
  <!-- Broker / Topic -->
  <rect x="140" y="30" width="110" height="100" rx="6" fill="var(--accent)" opacity="0.12" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="195" y="52" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">headers.demo</text>
  <rect x="150" y="60" width="90" height="16" rx="3" fill="var(--accent)" opacity="0.25"/>
  <text x="195" y="71" text-anchor="middle" fill="var(--text)" font-size="8">P0: [key][headers][body]</text>
  <rect x="150" y="82" width="90" height="16" rx="3" fill="var(--accent)" opacity="0.15"/>
  <text x="195" y="93" text-anchor="middle" fill="var(--text)" font-size="8">P1: …</text>
  <rect x="150" y="104" width="90" height="16" rx="3" fill="var(--accent)" opacity="0.08"/>
  <text x="195" y="115" text-anchor="middle" fill="var(--text)" font-size="8">P2: …</text>
  <!-- Arrow Broker → Consumer -->
  <line x1="250" y1="80" x2="290" y2="80" stroke="var(--success,#22c55e)" stroke-width="1.5" marker-end="url(#hf-a2)"/>
  <text x="270" y="73" text-anchor="middle" fill="var(--text-muted)" font-size="8">filtered</text>
  <!-- Consumer / Filters -->
  <rect x="290" y="30" width="120" height="100" rx="6" fill="var(--success,#22c55e)" opacity="0.12" stroke="var(--success,#22c55e)" stroke-width="1.5"/>
  <text x="350" y="50" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">Consumer</text>
  <text x="350" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="8">key = HDR-001</text>
  <text x="350" y="76" text-anchor="middle" fill="var(--text-muted)" font-size="8">traceId=abc-001</text>
  <text x="350" y="88" text-anchor="middle" fill="var(--text-muted)" font-size="8">$.status = CREATED</text>
  <text x="350" y="100" text-anchor="middle" fill="var(--text-muted)" font-size="8">body ∋ "us-east"</text>
  <text x="350" y="122" text-anchor="middle" fill="var(--text-muted)" font-size="8">→ detail modal</text>
  <defs>
    <marker id="hf-a1" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
    <marker id="hf-a2" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--success,#22c55e)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // ── Step 1: Fill everything — Topic, Key, Body, then Headers ─────────
    {
      id: 'hf-fill-all',
      title: 'Fill Header, Topic, Key, and Body',
      description:
        'Prepare a message with all its metadata:\n\n' +
        '- **Topic**: a demo topic — the destination\n' +
        `- **Key**: \`${DEMO_KEY}\` — routes the message to a partition\n` +
        '- **Body**: the JSON order event payload\n' +
        `- **Header**: \`${HEADER_KEY}: ${HEADER_VALUE}\` — a trace correlation ID attached **outside** the body\n\n` +
        'Headers are key-value pairs the broker stores and forwards without touching the payload. ' +
        'They are ideal for correlation IDs, source tags, and environment markers.',
      highlight: KAFKA.PUB_HEADER_ADD_BTN,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.PUBLISH_TAB);
        await ctx.delay(300);
        // Clear any header rows left over from a previous lesson run.
        await ctx.click(HEADER_REMOVE_BTN);
        await ctx.delay(150);
        await ctx.click(HEADER_REMOVE_BTN);
        await ctx.delay(150);
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // ── 1. Topic ────────────────────────────────────────
        const topicInput = document.querySelector<HTMLElement>(KAFKA.PUB_TOPIC_INPUT);
        if (topicInput) {
          topicInput.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(topicInput);
          await ctx.delay(800);
          rm();
        }
        await ctx.fill(KAFKA.PUB_TOPIC_INPUT, getDemoTopic());
        await ctx.delay(600);

        // ── 2. Key ──────────────────────────────────────────
        const keyInput = document.querySelector<HTMLElement>(KAFKA.PUB_KEY_INPUT);
        if (keyInput) {
          keyInput.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(keyInput);
          await ctx.delay(800);
          rm();
        }
        await ctx.fill(KAFKA.PUB_KEY_INPUT, DEMO_KEY);
        await ctx.delay(600);

        // ── 3. Message Body ─────────────────────────────────
        const bodyEl = document.querySelector<HTMLElement>(KAFKA.PUB_BODY_TEXTAREA);
        if (bodyEl) {
          bodyEl.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(bodyEl);
          await ctx.delay(800);
          rm();
        }
        await ctx.fill(KAFKA.PUB_BODY_TEXTAREA, DEMO_BODY);
        await ctx.delay(600);

        // Click Pretty Format so the viewer sees readable JSON
        const prettyBtn = document.querySelector<HTMLElement>('[data-testid="pub-pretty-format-badge"]');
        if (prettyBtn) {
          prettyBtn.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(prettyBtn);
          await ctx.delay(500);
          rm();
          await ctx.click('[data-testid="pub-pretty-format-badge"]');
          await ctx.delay(800);
        }

        // ── 4. Headers — + Add, then fill key & value ───────
        const addBtn = document.querySelector<HTMLElement>(KAFKA.PUB_HEADER_ADD_BTN);
        if (addBtn) {
          addBtn.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(addBtn);
          await ctx.delay(800);
          rm();
        }
        await ctx.click(KAFKA.PUB_HEADER_ADD_BTN);
        await ctx.delay(500);

        // Spotlight & fill header key
        const hKeyInput = document.querySelector<HTMLElement>(HEADER_ROW_KEY);
        if (hKeyInput) {
          hKeyInput.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(hKeyInput);
          await ctx.delay(600);
          rm();
        }
        await ctx.fill(HEADER_ROW_KEY, HEADER_KEY);
        await ctx.delay(500);

        // Spotlight & fill header value
        const hValInput = document.querySelector<HTMLElement>(HEADER_ROW_VAL);
        if (hValInput) {
          hValInput.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(hValInput);
          await ctx.delay(600);
          rm();
        }
        await ctx.fill(HEADER_ROW_VAL, HEADER_VALUE);
        await ctx.delay(1000);
      },
      verify: HEADER_ROW_VAL,
    },

    // ── Step 4: Send the message ───────────────────────────────────────────
    {
      id: 'hf-send-header',
      title: 'Send with Header',
      description:
        'Click **Send Once**. The message is published with the `traceId` header attached. The result panel confirms the partition and offset where the message landed.',
      highlight: KAFKA.PUB_SEND_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.PUB_SEND_BTN);
        await ctx.waitFor(KAFKA.PUB_RESULT, 8000);
        await ctx.delay(800);
      },
      // Key demo moment — hold on the partition/offset confirmation.
      pauseAfter: true,
    },

    // ── Step 3: Switch to Consume tab ─────────────────────────────────────
    {
      id: 'hf-filter-intro',
      title: 'Consume Filters',
      description:
        'Now on the **Consume** tab. Scroll down below the basic fields to find the **Filters** section with five inputs: **Key Equals**, **Header Match**, **JSONPath / JSONPath Equals**, and the new **Body Contains**. These narrow a batch fetch to only the messages you care about — filtering happens server-side, so you never download what you don\'t need.',
      highlight: FILTERS_SECTION,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.CONSUME_TAB);
        await ctx.delay(300);
        // Reset to "Consume Once" mode — if the user visited Stream mode earlier,
        // con-consume-btn is not rendered and all consume steps would silently fail.
        await ctx.click(KAFKA.CON_MODE_ONCE);
        await ctx.delay(200);
        // Set topic + Earliest position so consume steps find our seeded message
        await ctx.fill(KAFKA.CON_TOPIC_INPUT, getDemoTopic());
        await ctx.delay(100);
        await selectEarliestPosition(ctx);
        // Clear the group ID so each consume step generates a fresh random group.
        await ctx.fill(KAFKA.CON_GROUP_INPUT, '');
        await ctx.delay(100);
        // Set maxMessages=1 so the consumer settles immediately after finding the
        // first match instead of waiting the full 10-second timeout.
        await ctx.fill(KAFKA.CON_MAX_INPUT, '1');
        await ctx.delay(100);
        // Clear every filter input before the filter steps begin (quiet — no Body Contains flash).
        clearConsumeFiltersQuiet();
        await ctx.delay(100);
      },
    },

    // ── Step 4: Key filter ─────────────────────────────────────────────────
    {
      id: 'hf-key-filter',
      title: 'Filter by Key',
      description:
        `Type \`${DEMO_KEY}\` in **Key Equals**, then click **Consume Once**. Only messages whose key matches exactly are returned — watch the result appear below.`,
      highlight: KAFKA.CON_KEY_FILTER_INPUT,
      preAction: async (ctx) => {
        const { purgeAllSpotlightRings } = await import('../../demoRipple');
        purgeAllSpotlightRings();

        await ctx.fill(KAFKA.CON_TOPIC_INPUT, getDemoTopic());
        await ctx.delay(100);
        await selectEarliestPosition(ctx);
        await ctx.fill(KAFKA.CON_GROUP_INPUT, '');
        await ctx.delay(100);
        clearConsumeFiltersQuiet();
        await ctx.delay(100);
        await seedHeaderMessage();
        await ctx.delay(100);
        // Clear old results so waitFor detects genuinely new results
        const clearBtn = document.querySelector<HTMLElement>(KAFKA.CON_CLEAR_BTN);
        if (clearBtn) { clearBtn.click(); await ctx.delay(200); }
      },
      action: async (ctx) => {
        const { showSpotlightRing, purgeAllSpotlightRings } = await import('../../demoRipple');
        purgeAllSpotlightRings();

        try {
          // Ensure Earliest + only the key filter — Latest ignores the pre-seeded message
          await selectEarliestPosition(ctx);
          clearConsumeFiltersQuiet();

          // Only spotlight Key Equals — never Body Contains / Consume Once / other filters
          const keyInput = document.querySelector<HTMLElement>(KAFKA.CON_KEY_FILTER_INPUT);
          if (keyInput) {
            keyInput.scrollIntoView({ block: 'nearest' });
            const rm = showSpotlightRing(keyInput);
            try {
              await ctx.delay(800);
              await ctx.fill(KAFKA.CON_KEY_FILTER_INPUT, DEMO_KEY);
              await ctx.delay(700);
            } finally {
              rm();
            }
          } else {
            await ctx.fill(KAFKA.CON_KEY_FILTER_INPUT, DEMO_KEY);
            await ctx.delay(600);
          }

          await ctx.click(KAFKA.CON_CONSUME_BTN);
          await ctx.waitFor(KAFKA.CON_RESULTS_ZONE, 15000);
          await ctx.delay(500);

          const results = document.querySelector<HTMLElement>(KAFKA.CON_RESULTS_ZONE);
          if (results) {
            results.scrollIntoView({ block: 'nearest' });
            const rm = showSpotlightRing(results);
            try {
              await ctx.delay(1500);
            } finally {
              rm();
            }
          }
        } finally {
          purgeAllSpotlightRings();
        }
      },
      pauseAfter: true,
    },

    // ── Step 5: Header Match filter ───────────────────────────────────────
    {
      id: 'hf-header-filter',
      title: 'Filter by Header',
      description:
        `Key filter cleared. Type \`${HEADER_KEY}=${HEADER_VALUE}\` in **Header Match**, then **Consume Once**. Only messages carrying that exact header are returned.`,
      highlight: KAFKA.CON_HEADER_FILTER_INPUT,
      preAction: async (ctx) => {
        const { purgeAllSpotlightRings } = await import('../../demoRipple');
        purgeAllSpotlightRings();

        await ctx.fill(KAFKA.CON_TOPIC_INPUT, getDemoTopic());
        await ctx.delay(100);
        await selectEarliestPosition(ctx);
        await ctx.fill(KAFKA.CON_GROUP_INPUT, '');
        await ctx.delay(100);
        clearConsumeFiltersQuiet();
        await ctx.delay(100);
        await seedHeaderMessage();
        await ctx.delay(100);
        // Clear old results
        const clearBtn = document.querySelector<HTMLElement>(KAFKA.CON_CLEAR_BTN);
        if (clearBtn) { clearBtn.click(); await ctx.delay(200); }
      },
      action: async (ctx) => {
        const { showSpotlightRing, purgeAllSpotlightRings } = await import('../../demoRipple');
        purgeAllSpotlightRings();

        try {
          await selectEarliestPosition(ctx);
          clearConsumeFiltersQuiet();

          // Only spotlight Header Match — never Body Contains / Consume Once
          const headerInput = document.querySelector<HTMLElement>(KAFKA.CON_HEADER_FILTER_INPUT);
          if (headerInput) {
            headerInput.scrollIntoView({ block: 'nearest' });
            const rm = showSpotlightRing(headerInput);
            try {
              await ctx.delay(800);
              await ctx.fill(KAFKA.CON_HEADER_FILTER_INPUT, `${HEADER_KEY}=${HEADER_VALUE}`);
              await ctx.delay(700);
            } finally {
              rm();
            }
          } else {
            await ctx.fill(KAFKA.CON_HEADER_FILTER_INPUT, `${HEADER_KEY}=${HEADER_VALUE}`);
            await ctx.delay(600);
          }

          await ctx.click(KAFKA.CON_CONSUME_BTN);
          await ctx.waitFor(KAFKA.CON_RESULTS_ZONE, 15000);
          await ctx.delay(500);

          const results = document.querySelector<HTMLElement>(KAFKA.CON_RESULTS_ZONE);
          if (results) {
            results.scrollIntoView({ block: 'nearest' });
            const rm = showSpotlightRing(results);
            try {
              await ctx.delay(1500);
            } finally {
              rm();
            }
          }
        } finally {
          purgeAllSpotlightRings();
        }
      },
      pauseAfter: true,
    },

    // ── Step 6: JSONPath filter ────────────────────────────────────────────
    {
      id: 'hf-jsonpath',
      title: 'JSONPath Filter',
      description:
        'All other filters cleared. Set **JSONPath** to `$.status` and **JSONPath Equals** to `CREATED`, then **Consume Once**. Only messages where `status == "CREATED"` are returned.',
      // Spotlight the path+equals pair only — never Body Contains below it.
      highlight: KAFKA.CON_JSONPATH_PAIR,
      preAction: async (ctx) => {
        const { purgeAllSpotlightRings } = await import('../../demoRipple');
        purgeAllSpotlightRings();

        await ctx.fill(KAFKA.CON_TOPIC_INPUT, getDemoTopic());
        await ctx.delay(100);
        await selectEarliestPosition(ctx);
        await ctx.fill(KAFKA.CON_GROUP_INPUT, '');
        await ctx.delay(100);
        clearConsumeFiltersQuiet();
        await ctx.delay(100);
        await seedHeaderMessage();
        await ctx.delay(100);
        // Clear old results
        const clearBtn = document.querySelector<HTMLElement>(KAFKA.CON_CLEAR_BTN);
        if (clearBtn) { clearBtn.click(); await ctx.delay(200); }
      },
      action: async (ctx) => {
        const { showSpotlightRing, purgeAllSpotlightRings } = await import('../../demoRipple');
        purgeAllSpotlightRings();

        try {
          await selectEarliestPosition(ctx);
          clearConsumeFiltersQuiet();

          // One ring on the JSONPath pair while both fields fill — keeps the
          // spotlight off Body Contains (immediately below this tall row).
          const pair = document.querySelector<HTMLElement>(KAFKA.CON_JSONPATH_PAIR);
          if (pair) {
            pair.scrollIntoView({ block: 'nearest' });
            const rm = showSpotlightRing(pair);
            try {
              await ctx.delay(800);
              await ctx.fill(KAFKA.CON_JSONPATH_INPUT, '$.status');
              await ctx.delay(600);
              await ctx.fill(KAFKA.CON_JSONVAL_INPUT, 'CREATED');
              await ctx.delay(800);
            } finally {
              rm();
            }
          } else {
            await ctx.fill(KAFKA.CON_JSONPATH_INPUT, '$.status');
            await ctx.delay(500);
            await ctx.fill(KAFKA.CON_JSONVAL_INPUT, 'CREATED');
            await ctx.delay(600);
          }

          await ctx.click(KAFKA.CON_CONSUME_BTN);
          await ctx.waitFor(KAFKA.CON_RESULTS_ZONE, 15000);
          await ctx.delay(500);

          const results = document.querySelector<HTMLElement>(KAFKA.CON_RESULTS_ZONE);
          if (results) {
            results.scrollIntoView({ block: 'nearest' });
            const rm = showSpotlightRing(results);
            try {
              await ctx.delay(1500);
            } finally {
              rm();
            }
          }
        } finally {
          purgeAllSpotlightRings();
        }
      },
      pauseAfter: true,
    },

    // ── Step 7: Body Contains filter ─────────────────────────────────────────
    {
      id: 'hf-body-contains',
      title: 'Body Contains Filter',
      description:
        'All other filters cleared. Type `us-east` in **Body Contains**, then **Consume Once**. ' +
        'Only messages whose raw body includes that text (case-insensitive) are returned — ' +
        'perfect for quickly finding messages by any keyword, ID, or error code without writing a JSONPath.',
      highlight: KAFKA.CON_BODY_CONTAINS_INPUT,
      preAction: async (ctx) => {
        const { purgeAllSpotlightRings } = await import('../../demoRipple');
        purgeAllSpotlightRings();

        await ctx.fill(KAFKA.CON_TOPIC_INPUT, getDemoTopic());
        await ctx.delay(100);
        await selectEarliestPosition(ctx);
        await ctx.fill(KAFKA.CON_GROUP_INPUT, '');
        await ctx.delay(100);
        clearConsumeFiltersQuiet();
        await ctx.delay(100);
        await seedHeaderMessage();
        await ctx.delay(100);
        // Clear old results
        const clearBtn = document.querySelector<HTMLElement>(KAFKA.CON_CLEAR_BTN);
        if (clearBtn) { clearBtn.click(); await ctx.delay(200); }
      },
      action: async (ctx) => {
        const { showSpotlightRing, purgeAllSpotlightRings } = await import('../../demoRipple');
        purgeAllSpotlightRings();

        try {
          // 1. Spotlight and fill Body Contains (this step's teaching field)
          const bodyInput = document.querySelector<HTMLElement>(KAFKA.CON_BODY_CONTAINS_INPUT);
          if (bodyInput) {
            bodyInput.scrollIntoView({ block: 'nearest' });
            const rm = showSpotlightRing(bodyInput);
            try {
              await ctx.delay(800);
              await ctx.fill(KAFKA.CON_BODY_CONTAINS_INPUT, 'us-east');
              await ctx.delay(700);
            } finally {
              rm();
            }
          } else {
            await ctx.fill(KAFKA.CON_BODY_CONTAINS_INPUT, 'us-east');
            await ctx.delay(600);
          }

          await ctx.click(KAFKA.CON_CONSUME_BTN);
          await ctx.waitFor(KAFKA.CON_RESULTS_ZONE, 15000);
          await ctx.delay(500);

          const results = document.querySelector<HTMLElement>(KAFKA.CON_RESULTS_ZONE);
          if (results) {
            results.scrollIntoView({ block: 'nearest' });
            const rm = showSpotlightRing(results);
            try {
              await ctx.delay(1500);
            } finally {
              rm();
            }
          }
        } finally {
          purgeAllSpotlightRings();
        }
      },
      pauseAfter: true,
    },

    // ── Step 8: Click a result row to show headers in detail modal ─────────
    {
      id: 'hf-detail',
      title: 'Headers in the Message Detail',
      description:
        'Click the first result row to open the **Message Detail** modal. Offset, partition, timestamp, key, pretty-printed body, and **headers** — everything in one view. `traceId: abc-001` is listed in the Headers table.',
      highlight: '[data-testid="con-row-0"]',
      preAction: async (ctx) => {
        // Guard: if the user skipped step 6, run a consume so results exist
        if (!document.querySelector('[data-testid="con-row-0"]')) {
          await ctx.fill(KAFKA.CON_TOPIC_INPUT, getDemoTopic());
          await ctx.delay(100);
          await selectEarliestPosition(ctx);
          await ctx.fill(KAFKA.CON_GROUP_INPUT, '');
          await ctx.delay(100);
          // Clear all filters for a plain consume — we just need any result row
          await ctx.fill(KAFKA.CON_KEY_FILTER_INPUT, '');
          await ctx.delay(50);
          await ctx.fill(KAFKA.CON_HEADER_FILTER_INPUT, '');
          await ctx.delay(50);
          await ctx.fill(KAFKA.CON_JSONPATH_INPUT, '');
          await ctx.delay(50);
          await ctx.fill(KAFKA.CON_JSONVAL_INPUT, '');
          await ctx.delay(50);
          await ctx.fill(KAFKA.CON_BODY_CONTAINS_INPUT, '');
          await ctx.delay(50);
          await seedHeaderMessage();
          await ctx.delay(200);
          await ctx.click(KAFKA.CON_CONSUME_BTN);
          try { await ctx.waitFor('[data-testid="con-row-0"]', 15000); } catch { /* */ }
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        await ctx.waitFor('[data-testid="con-row-0"]', 15000);
        await ctx.click('[data-testid="con-row-0"]');
        await ctx.waitFor(KAFKA.CON_DETAIL_MODAL, 5000);
        await ctx.delay(600);

        // Spotlight Key
        const keyEl = document.querySelector<HTMLElement>('[data-testid="kmd-key"]');
        if (keyEl) {
          keyEl.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(keyEl);
          await ctx.delay(1200);
          rm();
        }

        // Spotlight Headers table
        const headersEl = document.querySelector<HTMLElement>('[data-testid="kmd-headers"]');
        if (headersEl) {
          headersEl.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(headersEl);
          await ctx.delay(1200);
          rm();
        }

        // Spotlight Message Body
        const bodyEl = document.querySelector<HTMLElement>('[data-testid="kmd-body"]');
        if (bodyEl) {
          bodyEl.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(bodyEl);
          await ctx.delay(1500);
          rm();
        }
      },
      pauseAfter: true,
    },
  ],
};
