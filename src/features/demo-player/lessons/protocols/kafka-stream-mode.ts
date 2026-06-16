/** Lesson K8: Stream Mode — watch Kafka messages arrive in real time */
import type { DemoLesson } from '../../types';
import { kafkaPublishSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '../../../../shared/selectors';

/** Topic used for the live stream demo. */
const STREAM_TOPIC = 'redfireforge.debug.consume';

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

  setup: kafkaPublishSetup,
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
    // Step 1: Navigate to Consume tab and show mode selector
    {
      id: 'sm-intro',
      title: 'Stream Mode',
      description:
        'In the **Consume** tab you\'ll find two mode buttons at the top: **Consume Once** (a bounded batch fetch) and **Stream** (an unbounded live consumer). Stream mode is the diagnostic superpower — use it whenever you need to watch messages arrive in real time.',
      highlight: KAFKA.CON_MODE_TABS,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.CONSUME_TAB);
        await ctx.delay(300);
      },
    },

    // Step 2: Select Stream mode and set topic
    {
      id: 'sm-topic',
      title: 'Set the Topic',
      description:
        `Click **Stream** to switch mode. Set the topic to \`${STREAM_TOPIC}\` and the start position to **Latest** — you'll only see new messages from this point forward, which keeps the view clean during live debugging.`,
      highlight: KAFKA.CON_TOPIC_INPUT,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.CON_MODE_STREAM);
        await ctx.delay(300);
        await ctx.fill(KAFKA.CON_TOPIC_INPUT, STREAM_TOPIC);
        await ctx.delay(200);
        await ctx.selectOption(KAFKA.CON_POSITION_SELECT, 'latest');
        await ctx.delay(200);
      },
    },

    // Step 3: Start the stream
    {
      id: 'sm-start',
      title: 'Start Stream',
      description:
        'Click **Start Stream**. The consumer connects to the broker and the **LIVE badge** appears — a pulsing green dot that confirms messages are being received. Any messages produced to this topic now will appear in the table.',
      highlight: KAFKA.STREAM_START_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.STREAM_START_BTN);
        await ctx.delay(800);
      },
    },

    // Step 4: LIVE badge and counter
    {
      id: 'sm-live',
      title: 'LIVE Badge & Counter',
      description:
        'The **LIVE** badge pulses while the stream is active. Next to it, a counter shows how many messages have arrived since the stream started. The counter updates in real time — no refresh needed.',
      highlight: KAFKA.STREAM_LIVE_BADGE,
    },

    // Step 5: Auto-scroll behaviour
    {
      id: 'sm-scroll',
      title: 'Auto-Scroll',
      description:
        'The results table **auto-scrolls** to the newest row as messages arrive. Scrolling up pauses auto-scroll so you can read earlier messages — a scroll-to-bottom button appears. Scroll back down (or click it) to resume.',
      highlight: KAFKA.STREAM_RESULTS_ZONE,
    },

    // Step 6: Click a message row
    {
      id: 'sm-row',
      title: 'Inspect a Streamed Message',
      description:
        'Click any row to open the **Detail Pane** — the same pane as Consume Once. You get partition, offset, timestamp, key, headers, and formatted payload. The stream continues running in the background while you read.',
      highlight: KAFKA.STREAM_RESULTS_ZONE,
      action: async (ctx) => {
        const row = document.querySelector<HTMLElement>(
          `${KAFKA.STREAM_RESULTS_ZONE} tr:not([class*="header"]):first-child, ${KAFKA.STREAM_RESULTS_ZONE} [data-testid="stream-row"]:first-child, ${KAFKA.STREAM_RESULTS_ZONE} tbody tr:first-child`,
        );
        if (row) {
          row.click();
        } else {
          await ctx.click(KAFKA.STREAM_RESULTS_ZONE);
        }
        await ctx.delay(500);
      },
    },

    // Step 7: Stop the stream
    {
      id: 'sm-stop',
      title: 'Stop Stream',
      description:
        'Click **Stop Stream** to close the consumer. All messages captured during the session remain in the table — you can continue reading, clicking rows, and filtering. The LIVE badge disappears.',
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
        'Click **Export Stream** to download the full captured session as a JSON file — each entry has partition, offset, timestamp, key, headers, and payload. Import it into any analytics tool or share it with your team for offline analysis.',
      highlight: KAFKA.STREAM_EXPORT_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.STREAM_EXPORT_BTN);
        await ctx.delay(400);
      },
    },
  ],
};
