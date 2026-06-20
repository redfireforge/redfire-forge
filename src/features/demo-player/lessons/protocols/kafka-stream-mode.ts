/** Lesson K8: Stream Mode — watch Kafka messages arrive in real time */
import type { DemoLesson, DemoActionContext } from '../../types';
import { kafkaPublishSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '../../../../shared/selectors';

/** Topic used for the live stream demo — same topic K2 published to. */
const STREAM_TOPIC = 'orders.created';

/**
 * Stream mode setup: ensure cluster is connected, then publish a test message
 * so the results table is non-empty when the stream starts from `earliest`.
 */
async function kafkaStreamModeSetup(ctx: DemoActionContext): Promise<void> {
  await kafkaPublishSetup(ctx);
  // Publish one test message so the stream immediately shows a row.
  await ctx.click(KAFKA.PUBLISH_TAB);
  await ctx.delay(200);
  await ctx.fill(KAFKA.PUB_TOPIC_INPUT, STREAM_TOPIC);
  await ctx.delay(100);
  await ctx.fill(KAFKA.PUB_BODY_TEXTAREA, '{"streamDemo":true}');
  await ctx.delay(100);
  await ctx.click(KAFKA.PUB_SEND_BTN);
  await ctx.waitFor(KAFKA.PUB_RESULT, 5000);
  await ctx.delay(300);
  // Return to Consume tab for the lesson start.
  await ctx.click(KAFKA.CONSUME_TAB);
  await ctx.delay(300);
}

export const kafkaStreamModeLesson: DemoLesson = {
  id: 'kafka-stream-mode',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Stream Mode',
  description:
    'Switch the Consume Studio to live-stream mode, watch messages arrive in real time with the LIVE badge, then stop and export the captured session.',
  estimatedMinutes: 4,
  initialTab: 'kafka-message-studio',
  allowedTabs: ['kafka-settings'],

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',

  setup: kafkaStreamModeSetup,
  cleanup: kafkaCleanup,

  concept: {
    title: 'Consume Once vs. Stream Mode',
    body: `The Consume Studio has two modes accessible via the **mode tabs** at the top of the Consume panel:

**Consume Once (bounded)**
Fetches a fixed batch of up to _N_ messages starting at the configured position, then stops. Ideal for spot-checking recent messages, replaying a batch for debugging, or verifying that a specific message was produced.

**Stream Mode (unbounded)**
Opens a long-lived consumer that receives messages as they arrive — similar to \`kafka-console-consumer --from-latest\`. Use this to:
- Watch a trigger topic in real time while exercising your producer
- Observe live traffic patterns during a load test
- Capture a message sample for export to JSON

Key UI elements in Stream mode:
| Element | Meaning |
|---|---|
| **LIVE badge** | Green pulsing dot — stream is active and receiving |
| **Counter** | Messages received in the current stream session |
| **Auto-scroll** | Table scrolls to newest message; scrolling up pauses it |
| **Cursor gap badge** | Shows offset gap since stream started (how many messages you may have missed at startup) |
| **Stop** | Stops the consumer; all captured messages remain in the table |
| **Export** | Downloads captured messages as a JSON file |`,
    keyTerms: [
      {
        term: 'Stream Mode',
        definition:
          'An unbounded Kafka consumer that receives messages as they are produced. Unlike Consume Once, it does not stop after a fixed batch — it runs until you explicitly stop it.',
      },
      {
        term: 'LIVE Badge',
        definition:
          'A pulsing green indicator shown when the stream is active and connected to the broker. It disappears when the stream is stopped or the connection drops.',
      },
      {
        term: 'Cursor Gap',
        definition:
          'The number of messages between the stream start offset and the topic\'s current high-water mark. A large gap means messages were produced before streaming started and are not captured.',
      },
      {
        term: 'Auto-scroll',
        definition:
          'Automatic scrolling of the results table to show the newest message. Scrolling up temporarily pauses auto-scroll; it resumes when you scroll back to the bottom.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 140" xmlns="http://www.w3.org/2000/svg">
  <!-- Consume Once box -->
  <rect x="8" y="20" width="130" height="100" rx="5" fill="var(--surface2,#1e1e2e)" stroke="var(--border,#45475a)" stroke-width="1.2"/>
  <text x="73" y="38" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">Consume Once</text>
  <text x="73" y="52" text-anchor="middle" fill="var(--text-muted)" font-size="8">Fetch N msgs</text>
  <text x="73" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="8">→ display table</text>
  <text x="73" y="76" text-anchor="middle" fill="var(--text-muted)" font-size="8">→ stop</text>
  <rect x="22" y="86" width="92" height="24" rx="3" fill="var(--primary)" opacity="0.2"/>
  <text x="68" y="101" text-anchor="middle" fill="var(--text)" font-size="8">DONE (bounded)</text>
  <!-- vs -->
  <text x="165" y="80" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="bold">vs</text>
  <!-- Stream Mode box -->
  <rect x="188" y="20" width="224" height="100" rx="5" fill="var(--surface2,#1e1e2e)" stroke="var(--success,#a6e3a1)" stroke-width="1.5"/>
  <text x="300" y="38" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">Stream Mode</text>
  <text x="300" y="52" text-anchor="middle" fill="var(--text-muted)" font-size="8">Long-lived consumer</text>
  <circle cx="215" cy="68" r="5" fill="var(--success,#a6e3a1)" opacity="0.8"/>
  <text x="300" y="72" text-anchor="middle" fill="var(--success,#a6e3a1)" font-size="9">LIVE • 42 messages</text>
  <text x="300" y="86" text-anchor="middle" fill="var(--text-muted)" font-size="8">Auto-scroll ↓ newest</text>
  <rect x="196" y="96" width="100" height="16" rx="3" fill="var(--error,#f38ba8)" opacity="0.2"/>
  <text x="246" y="107" text-anchor="middle" fill="var(--text)" font-size="8">⏹ Stop + Export</text>
</svg>`,
  },

  steps: [
    // Step 1: Navigate to Consume tab and show the form
    {
      id: 'sm-intro',
      title: 'Stream Mode',
      description:
        'The **Consume** tab has a shared form at the top for Topic, Consumer Group, Start Position, and filters. Scroll to the bottom of the form to find two mode buttons: **Consume Once** (a bounded batch fetch) and **Stream** (an unbounded live consumer). Stream mode is the diagnostic superpower — use it whenever you need to watch messages arrive in real time.',
      highlight: KAFKA.CONSUME_TAB,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.CONSUME_TAB);
        await ctx.delay(300);
      },
    },

    // Step 2: Switch to Stream mode, fill topic, set position
    {
      id: 'sm-topic',
      title: 'Switch to Stream Mode & Set Topic',
      description:
        `Scroll down to the mode strip and click **Stream**. Then set **Topic** to \`${STREAM_TOPIC}\` and **Start Position** to **Earliest** — this replays any previously published messages immediately when the stream opens, so you see real rows right away.`,
      highlight: KAFKA.CON_MODE_TABS,
      preAction: async (ctx) => {
        // Switch to stream mode
        await ctx.click(KAFKA.CON_MODE_STREAM);
        await ctx.delay(300);
        // Fill topic and set earliest position
        await ctx.fill(KAFKA.CON_TOPIC_INPUT, STREAM_TOPIC);
        await ctx.delay(200);
        await ctx.selectOption(KAFKA.CON_POSITION_SELECT, 'earliest');
        await ctx.delay(200);
      },
    },

    // Step 3: Start the stream
    {
      id: 'sm-start',
      title: 'Start Stream',
      description:
        'Scroll down past the mode strip and click **Start Stream**. The consumer connects to the broker and the **LIVE badge** appears — a pulsing green dot that confirms messages are being received. Any messages produced to this topic will appear in the table below.',
      highlight: KAFKA.STREAM_ACTION_ROW,
      action: async (ctx) => {
        await ctx.click(KAFKA.STREAM_START_BTN);
        // Wait for LIVE badge — confirms broker connection established
        await ctx.waitFor(KAFKA.STREAM_LIVE_BADGE, 8000);
        await ctx.delay(500);
      },
    },

    // Step 4: LIVE badge and counter
    {
      id: 'sm-live',
      title: 'LIVE Badge & Counter',
      description:
        'The **LIVE** badge pulses green while the stream is active. Next to it, a counter shows how many messages have arrived since the stream started. Because setup published a message to `orders.created`, you should see at least **1 message** already in the table below.',
      highlight: KAFKA.STREAM_LIVE_BADGE,
    },

    // Step 5: Auto-scroll behaviour
    {
      id: 'sm-scroll',
      title: 'Auto-Scroll',
      description:
        'The results table below the LIVE badge **auto-scrolls** to the newest row as messages arrive. Scrolling up pauses auto-scroll so you can read earlier messages — a scroll-to-bottom button appears. Scroll back down (or click it) to resume.',
      highlight: KAFKA.STREAM_RESULTS_ZONE,
    },

    // Step 6: Click a message row
    {
      id: 'sm-row',
      title: 'Inspect a Streamed Message',
      description:
        'The stream table already has the message published during setup. Click any **row** to open the **Detail Pane** on the right — showing partition, offset, timestamp, key, headers, and formatted payload. The stream continues running in the background while you read.',
      highlight: KAFKA.STREAM_RESULTS_ZONE,
      preAction: async (ctx) => {
        // Ensure stream mode is active — re-apply in case earlier steps were skipped
        const streamBtn = document.querySelector<HTMLElement>(KAFKA.CON_MODE_STREAM);
        if (streamBtn && !streamBtn.classList.contains('active')) {
          streamBtn.click();
          await ctx.delay(300);
        }
        // Scroll stream results zone into view
        const zone = document.querySelector<HTMLElement>(KAFKA.STREAM_RESULTS_ZONE);
        if (zone) zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await ctx.delay(400);
      },
      action: async (ctx) => {
        // Click first available stream row
        const row = document.querySelector<HTMLElement>(
          `${KAFKA.STREAM_RESULTS_ZONE} tbody tr`,
        );
        if (row) {
          row.click();
          await ctx.delay(500);
        }
      },
      verify: KAFKA.CON_DETAIL_PANE,
    },

    // Step 7: Stop the stream
    {
      id: 'sm-stop',
      title: 'Stop Stream',
      description:
        'Click **Stop Stream** to close the consumer. All messages captured during the session remain in the table — you can keep reading, clicking rows, and filtering. The LIVE badge disappears and the **Export Stream** button becomes available.',
      highlight: KAFKA.STREAM_STOP_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.STREAM_STOP_BTN);
        await ctx.delay(600);
      },
    },

    // Step 8: Export the captured session
    {
      id: 'sm-export',
      title: 'Export Stream',
      description:
        'Click **Export Stream** to download the captured session as a JSON file — each entry has partition, offset, timestamp, key, headers, and payload. Import it into any analytics tool or share it with your team for offline analysis.',
      highlight: KAFKA.STREAM_EXPORT_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.STREAM_EXPORT_BTN);
        await ctx.delay(400);
      },
    },
  ],
};
