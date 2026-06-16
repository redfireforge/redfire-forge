/** Lesson K4: Headers & Filters — annotate messages with headers and consume selectively */
import type { DemoLesson } from '../../types';
import { kafkaPublishSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '../../../../shared/selectors';

/** Topic used throughout this lesson. */
const DEMO_TOPIC = 'headers.demo';
/** Key used on the published message — also used in the keyEquals filter. */
const DEMO_KEY = 'HDR-001';
/** Message body. */
const DEMO_BODY = '{"orderId":"HDR-001","status":"CREATED","region":"us-east"}';
/** Header key — a correlation / trace field. */
const HEADER_KEY = 'traceId';
/** Header value. */
const HEADER_VALUE = 'abc-001';

// ── File-private selectors ────────────────────────────────────────────────────
/** First header row key input — added after clicking "+ Add". */
const HEADER_ROW_KEY = '.kafka-ms-kv-row:first-child input[placeholder="key"]';
/** First header row value input. */
const HEADER_ROW_VAL = '.kafka-ms-kv-row:first-child input[placeholder="value"]';

export const kafkaHeadersFiltersLesson: DemoLesson = {
  id: 'kafka-headers-filters',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Headers & Filters',
  description:
    'Annotate messages with custom headers for traceability, then consume selectively using Key, Header-Match, and JSONPath filters.',
  estimatedMinutes: 4,
  initialTab: 'kafka-message-studio',
  allowedTabs: ['kafka-settings'],

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',

  setup: kafkaPublishSetup,
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
  <rect x="290" y="38" width="120" height="84" rx="6" fill="var(--success,#22c55e)" opacity="0.12" stroke="var(--success,#22c55e)" stroke-width="1.5"/>
  <text x="350" y="58" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">Consumer</text>
  <text x="350" y="72" text-anchor="middle" fill="var(--text-muted)" font-size="8">key = HDR-001</text>
  <text x="350" y="84" text-anchor="middle" fill="var(--text-muted)" font-size="8">traceId=abc-001</text>
  <text x="350" y="96" text-anchor="middle" fill="var(--text-muted)" font-size="8">$.status = CREATED</text>
  <text x="350" y="112" text-anchor="middle" fill="var(--text-muted)" font-size="8">→ detail pane</text>
  <defs>
    <marker id="hf-a1" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
    <marker id="hf-a2" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--success,#22c55e)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // ── Step 1: Intro — what headers are ───────────────────────────────────
    {
      id: 'hf-headers-intro',
      title: 'Adding Message Headers',
      description:
        'Headers are key-value pairs attached to a message **outside the body**. They are great for correlation IDs, source tags, or environment markers — the broker stores and forwards them without touching the payload. The **Headers** section in the Publish panel is where you add them.',
      highlight: KAFKA.PUB_HEADER_ADD_BTN,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.PUBLISH_TAB);
        await ctx.delay(300);
      },
    },

    // ── Step 2: Click "+ Add" to create a header row ───────────────────────
    {
      id: 'hf-add-header',
      title: '+ Add a Header Row',
      description:
        'Click **+ Add** to create a new header row. A key input and a value input appear — one row per header. You can add as many as you need.',
      highlight: KAFKA.PUB_HEADER_ADD_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.PUB_HEADER_ADD_BTN);
        await ctx.delay(400);
      },
    },

    // ── Step 3: Fill header key + value + topic + key + body ──────────────
    {
      id: 'hf-fill-header',
      title: 'Fill Header, Topic, Key, and Body',
      description:
        `The header key is set to \`${HEADER_KEY}\` and the value to \`${HEADER_VALUE}\` — a trace correlation ID. The topic is \`${DEMO_TOPIC}\`, the message key is \`${DEMO_KEY}\` (used for partition routing), and the body carries the order event.`,
      highlight: KAFKA.PUB_BODY_TEXTAREA,
      preAction: async (ctx) => {
        // Fill header row first (silently, before reading phase)
        await ctx.fill(HEADER_ROW_KEY, HEADER_KEY);
        await ctx.delay(200);
        await ctx.fill(HEADER_ROW_VAL, HEADER_VALUE);
        await ctx.delay(200);
        // Fill message fields
        await ctx.fill(KAFKA.PUB_TOPIC_INPUT, DEMO_TOPIC);
        await ctx.delay(200);
        await ctx.fill(KAFKA.PUB_KEY_INPUT, DEMO_KEY);
        await ctx.delay(200);
        await ctx.fill(KAFKA.PUB_BODY_TEXTAREA, DEMO_BODY);
        await ctx.delay(300);
      },
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
    },

    // ── Step 5: Switch to Consume tab ─────────────────────────────────────
    {
      id: 'hf-filter-intro',
      title: 'Consume Filters',
      description:
        'Switch to the **Consume** tab. Below the basic fields you will find four filter inputs: **Key Equals**, **Header Match**, **JSONPath**, and **JSONPath Equals**. These let you narrow the batch to only the messages you care about — filtering happens server-side, so you never download what you don\'t need.',
      highlight: KAFKA.CON_TOPIC_INPUT,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.CONSUME_TAB);
        await ctx.delay(300);
      },
    },

    // ── Step 6: Key filter ─────────────────────────────────────────────────
    {
      id: 'hf-key-filter',
      title: 'Filter by Key',
      description:
        `**Key Equals** returns only messages whose key matches \`${DEMO_KEY}\` exactly. Set the topic to \`${DEMO_TOPIC}\`, position to **Earliest**, and key filter to \`${DEMO_KEY}\`, then click **Consume Once**. Only messages with that key are returned.`,
      highlight: KAFKA.CON_KEY_FILTER_INPUT,
      preAction: async (ctx) => {
        await ctx.fill(KAFKA.CON_TOPIC_INPUT, DEMO_TOPIC);
        await ctx.delay(200);
        await ctx.selectOption(KAFKA.CON_POSITION_SELECT, 'earliest');
        await ctx.delay(200);
        await ctx.fill(KAFKA.CON_KEY_FILTER_INPUT, DEMO_KEY);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.CON_CONSUME_BTN);
        await ctx.waitFor(KAFKA.CON_RESULTS_ZONE, 10000);
        await ctx.delay(800);
      },
    },

    // ── Step 7: JSONPath filter ────────────────────────────────────────────
    {
      id: 'hf-jsonpath',
      title: 'JSONPath Filter',
      description:
        '**JSONPath** lets you filter by a field inside the message body. Clear the key filter, set **JSONPath** to `$.status` and **JSONPath Equals** to `CREATED`, then click **Consume Once**. Only messages where `status == "CREATED"` are returned — no body parsing needed in your app.',
      highlight: KAFKA.CON_JSONPATH_INPUT,
      preAction: async (ctx) => {
        // Clear key filter, set JSONPath filters
        await ctx.fill(KAFKA.CON_KEY_FILTER_INPUT, '');
        await ctx.delay(200);
        await ctx.fill(KAFKA.CON_JSONPATH_INPUT, '$.status');
        await ctx.delay(200);
        await ctx.fill(KAFKA.CON_JSONVAL_INPUT, 'CREATED');
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.CON_CONSUME_BTN);
        await ctx.waitFor(KAFKA.CON_RESULTS_ZONE, 10000);
        await ctx.delay(800);
      },
    },

    // ── Step 8: Click a result row to show headers in detail pane ─────────
    {
      id: 'hf-detail',
      title: 'Headers in the Detail Pane',
      description:
        'Click any result row to open the **Detail Pane**. Scroll down past the payload to see the **Headers** section — `traceId: abc-001` is listed there. Headers travel with the message end-to-end and are always available to the consumer.',
      highlight: KAFKA.CON_DETAIL_PANE,
      action: async (ctx) => {
        // Click the first result row to open the detail pane
        await ctx.click(`${KAFKA.CON_RESULTS_ZONE} tr:first-child`);
        await ctx.waitFor(KAFKA.CON_DETAIL_PANE, 3000);
        await ctx.delay(600);
      },
    },
  ],
};
