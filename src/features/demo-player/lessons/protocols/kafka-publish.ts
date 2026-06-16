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
    diagram: `<svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg">
  <!-- Producer -->
  <rect x="10" y="50" width="90" height="40" rx="6" fill="var(--primary)" opacity="0.18" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="55" y="73" text-anchor="middle" fill="var(--text)" font-size="12" font-family="system-ui">Producer</text>
  <!-- Arrow: Producer → Topic -->
  <line x1="100" y1="70" x2="145" y2="70" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#pub-arrow)"/>
  <text x="122" y="62" text-anchor="middle" fill="var(--text-muted)" font-size="9">key hash</text>
  <!-- Topic box -->
  <rect x="145" y="20" width="110" height="100" rx="6" fill="var(--accent)" opacity="0.12" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="200" y="42" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">orders.created</text>
  <!-- Partition rows inside topic -->
  <rect x="155" y="50" width="90" height="18" rx="3" fill="var(--accent)" opacity="0.25"/>
  <text x="200" y="62" text-anchor="middle" fill="var(--text)" font-size="9">P0: 0 1 2 3 …</text>
  <rect x="155" y="74" width="90" height="18" rx="3" fill="var(--accent)" opacity="0.15"/>
  <text x="200" y="86" text-anchor="middle" fill="var(--text)" font-size="9">P1: 0 1 2 …</text>
  <rect x="155" y="98" width="90" height="18" rx="3" fill="var(--accent)" opacity="0.08"/>
  <text x="200" y="110" text-anchor="middle" fill="var(--text)" font-size="9">P2: 0 1 …</text>
  <!-- Arrow: Topic → Consumer -->
  <line x1="255" y1="70" x2="295" y2="70" stroke="var(--success,#22c55e)" stroke-width="1.5" marker-end="url(#pub-arrow2)"/>
  <!-- Consumer -->
  <rect x="295" y="50" width="95" height="40" rx="6" fill="var(--success,#22c55e)" opacity="0.15" stroke="var(--success,#22c55e)" stroke-width="1.5"/>
  <text x="343" y="68" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">Consumer</text>
  <text x="343" y="82" text-anchor="middle" fill="var(--text-muted)" font-size="9">reads offset</text>
  <!-- Result label -->
  <text x="122" y="110" text-anchor="middle" fill="var(--text-muted)" font-size="9">partition + offset</text>
  <text x="122" y="122" text-anchor="middle" fill="var(--text-muted)" font-size="9">returned to producer</text>
  <defs>
    <marker id="pub-arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
    <marker id="pub-arrow2" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--success,#22c55e)" stroke-width="1.5"/></marker>
  </defs>
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
