/** Lesson K2: Publish Studio — send a Kafka message and inspect partition + offset */
import type { DemoLesson } from '../../types';
import { kafkaPublishSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '../../../../shared/selectors';

/** Sample message body used throughout the lesson. */
const DEMO_BODY = '{"orderId":"DEMO-001","status":"CREATED","amount":99.99}';
/** Sample message key — demonstrates partition affinity. */
const DEMO_KEY = 'order-demo-001';
/** Topic to publish to. */
const DEMO_TOPIC = 'orders.created';

export const kafkaPublishLesson: DemoLesson = {
  id: 'kafka-publish',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Publish Studio',
  description:
    'Send a Kafka message and immediately see the partition, offset, and timestamp in the success panel.',
  estimatedMinutes: 4,
  initialTab: 'kafka-message-studio',
  // Setup navigates to kafka-settings to auto-create + connect the cluster —
  // declare it as allowed so useDemoShortcuts does not auto-exit during setup.
  allowedTabs: ['kafka-settings'],

  // Requires the plaintext Kafka broker (Redpanda Console health endpoint).
  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',

  setup: kafkaPublishSetup,
  cleanup: kafkaCleanup,

  concept: {
    title: 'Sending Messages with the Publish Studio',
    body: `The **Publish Studio** is your Kafka producer. It lets you hand-craft a message — topic, key, body, headers, ack level — and send it to a live broker with one click.

**Topics** are durable, append-only logs. Every message is written to exactly one partition inside the topic. Partition assignment is determined by the message key: same key → same partition → ordered delivery.

**Message Key** sets the routing hash. Leave it blank for round-robin distribution. Provide a key (e.g. \`order-demo-001\`) to pin all events for that entity to the same partition, guaranteeing order.

**Acknowledgements (acks)** control durability vs. speed:
- \`all (–1)\` — leader + all in-sync replicas acknowledge → maximum durability
- \`leader (1)\` — leader only acknowledges → faster, slight risk if leader fails
- \`none (0)\` — fire-and-forget → fastest, no delivery guarantee

**The result panel** shows you exactly what happened: \`sentCount\`, \`partition\`, \`offset\`, and optional timestamp — everything you need to trace the message downstream.`,
    keyTerms: [
      {
        term: 'Topic',
        definition:
          'A named, durable, append-only log. Messages are written to a topic and consumed from it. Topics are split into partitions for parallelism.',
      },
      {
        term: 'Partition',
        definition:
          'A numbered sub-log within a topic. All messages in a partition are strictly ordered. Partition assignment is determined by the message key.',
      },
      {
        term: 'Offset',
        definition:
          'A sequential integer assigned to each message in a partition. Offsets are immutable — they identify a message\'s exact position in the log forever.',
      },
      {
        term: 'Acks',
        definition:
          'How many broker replicas must acknowledge a write before the producer considers it successful. –1 = all replicas; 1 = leader only; 0 = none.',
      },
    ],
    diagram: `<svg viewBox="0 0 460 165" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="pub-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0.5 L7,4 L0,7.5" fill="none" stroke="var(--primary)" stroke-width="1.5"/>
    </marker>
    <marker id="pub-arr-g" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0.5 L7,4 L0,7.5" fill="none" stroke="var(--success,#22c55e)" stroke-width="1.5"/>
    </marker>
    <marker id="pub-arr-m" markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto">
      <path d="M7,0.5 L0,3.5 L7,6.5" fill="none" stroke="var(--text-muted)" stroke-width="1.2"/>
    </marker>
  </defs>

  <!-- Producer -->
  <rect x="12" y="52" width="96" height="48" rx="8" fill="var(--primary)" opacity="0.16" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="60" y="74" text-anchor="middle" fill="var(--text)" font-size="13" font-family="system-ui" font-weight="600">Producer</text>
  <text x="60" y="90" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">sends message</text>

  <!-- Arrow: Producer → Topic -->
  <line x1="108" y1="76" x2="155" y2="76" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#pub-arr)"/>
  <text x="131" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">key hash</text>

  <!-- Topic box -->
  <rect x="155" y="12" width="128" height="128" rx="8" fill="var(--accent)" opacity="0.12" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="219" y="34" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">orders.created</text>
  <!-- divider -->
  <line x1="163" y1="40" x2="275" y2="40" stroke="var(--accent)" stroke-width="1" opacity="0.4"/>
  <!-- Partition rows -->
  <rect x="165" y="46" width="98" height="22" rx="4" fill="var(--accent)" opacity="0.30"/>
  <text x="214" y="61" text-anchor="middle" fill="var(--text)" font-size="9.5" font-family="system-ui" letter-spacing="0.5">P0: 0  1  2  3 …</text>
  <rect x="165" y="72" width="98" height="22" rx="4" fill="var(--accent)" opacity="0.18"/>
  <text x="214" y="87" text-anchor="middle" fill="var(--text)" font-size="9.5" font-family="system-ui" letter-spacing="0.5">P1: 0  1  2 …</text>
  <rect x="165" y="98" width="98" height="22" rx="4" fill="var(--accent)" opacity="0.09"/>
  <text x="214" y="113" text-anchor="middle" fill="var(--text-muted)" font-size="9.5" font-family="system-ui" letter-spacing="0.5">P2: 0  1 …</text>

  <!-- Arrow: Topic → Consumer -->
  <line x1="283" y1="76" x2="330" y2="76" stroke="var(--success,#22c55e)" stroke-width="1.5" marker-end="url(#pub-arr-g)"/>

  <!-- Consumer -->
  <rect x="330" y="52" width="118" height="48" rx="8" fill="var(--success,#22c55e)" opacity="0.14" stroke="var(--success,#22c55e)" stroke-width="1.5"/>
  <text x="389" y="74" text-anchor="middle" fill="var(--text)" font-size="13" font-family="system-ui" font-weight="600">Consumer</text>
  <text x="389" y="90" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">reads offset</text>

  <!-- Dashed return: partition+offset back to producer -->
  <path d="M 219 140 C 219 155, 60 155, 60 138" fill="none" stroke="var(--text-muted)" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#pub-arr-m)"/>
  <text x="139" y="161" text-anchor="middle" fill="var(--text-muted)" font-size="8.5" font-family="system-ui">partition + offset returned to producer</text>
</svg>`,
  },

  steps: [
    {
      id: 'pub-intro',
      title: 'The Publish Tab',
      description:
        'The **Publish** tab is your Kafka producer. It has four key fields: **Topic** (the destination), **Key** (determines which partition), **Body** (the message payload), and **Acks** (durability guarantee). The next steps will walk through each one.',
      highlight: KAFKA.PUBLISH_TAB,
      // Navigate to the Publish tab before spotlighting it — setup returns to the
      // studio but doesn't guarantee the Publish tab is the active one.
      preAction: async (ctx) => {
        await ctx.click(KAFKA.PUBLISH_TAB);
        await ctx.delay(300);
      },
    },
    {
      id: 'pub-topic',
      title: 'Set the Topic',
      description:
        'Watch as the **Topic** field is filled with `orders.created`. Every message must target a specific topic — this is the channel where the message will land.',
      highlight: KAFKA.PUB_TOPIC_INPUT,
      action: async (ctx) => {
        await ctx.fill(KAFKA.PUB_TOPIC_INPUT, DEMO_TOPIC);
        await ctx.delay(400);
      },
    },
    {
      id: 'pub-body',
      title: 'Write the Message Body',
      description:
        'The **Message Body** is the event payload — any valid JSON. Here we send an order event with `orderId`, `status`, and `amount`. We will format and validate it in a moment.',
      highlight: KAFKA.PUB_BODY_TEXTAREA,
      action: async (ctx) => {
        await ctx.fill(KAFKA.PUB_BODY_TEXTAREA, DEMO_BODY);
        await ctx.delay(400);
      },
    },
    {
      id: 'pub-key',
      title: 'Add a Message Key',
      description:
        'The **Key** controls partition routing. All messages with the same key are always routed to the same partition — guaranteeing order for a given entity. Here we use `order-demo-001` so all events for this order land together.',
      highlight: KAFKA.PUB_KEY_INPUT,
      action: async (ctx) => {
        await ctx.fill(KAFKA.PUB_KEY_INPUT, DEMO_KEY);
        await ctx.delay(400);
      },
    },
    {
      id: 'pub-acks',
      title: 'Choose Ack Level',
      description:
        '**Acks** controls durability. `all (–1)` waits for the leader AND all in-sync replicas to confirm — maximum safety. `leader (1)` waits for the leader only — faster, slight risk. `none (0)` is fire-and-forget. Leave it at `all` for reliable production use.',
      highlight: KAFKA.PUB_ACKS_SELECT,
      // Informational — no action. Acks stays at default `all (–1)`.
    },
    {
      id: 'pub-format',
      title: 'Validate & Format JSON',
      description:
        'Click **Validate & Format JSON** to pretty-print the body and catch syntax errors before sending. Watch the payload reformat with proper indentation — much easier to read at a glance.',
      highlight: KAFKA.PUB_FORMAT_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.PUB_FORMAT_BTN);
        await ctx.delay(600);
      },
      // Pause long enough for viewers to see the reformatted JSON before moving on.
      pauseAfter: true,
    },
    {
      id: 'pub-send',
      title: 'Send Once',
      description:
        'Click **Send Once** to produce the message. Watch the button switch to **Sending…** while the broker processes the request, assigns it to a partition, and returns the **offset** — the message\'s permanent address in the log.',
      highlight: KAFKA.PUB_SEND_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.PUB_SEND_BTN);
        await ctx.delay(900);
      },
      verify: KAFKA.PUB_RESULT,
    },
    {
      id: 'pub-result',
      title: 'Inspect the Result',
      description:
        'The **result panel** shows exactly what happened: ✓ 1 message sent, the **partition** it landed in, and its **offset** within that partition. The offset is a permanent, immutable position — you can always replay from it.',
      highlight: KAFKA.PUB_RESULT,
      // Informational — result is already visible from step 7.
    },
    {
      id: 'pub-clear',
      title: 'Clear the Result',
      description:
        'Click **Clear** to reset the result panel. The message is still safely stored in Kafka — clearing only removes the UI feedback so you\'re ready to send the next message.',
      highlight: KAFKA.PUB_CLEAR_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.PUB_CLEAR_BTN);
        await ctx.delay(300);
      },
    },
  ],
};
