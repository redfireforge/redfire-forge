/** Lesson K8: Stream Mode — watch Kafka messages arrive in real time */
import type { DemoLesson, DemoActionContext } from '../../types';
import { kafkaSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '@shared/selectors';
import { dispatchKafkaOperation } from '@shared/kafka/kafkaClient';
import { findScrollableParent } from '../../demoSpotlightUtils';
import { showSpotlightRing } from '../../demoRipple';

/** Topic used for the live stream demo — same topic K2 published to. */
const STREAM_TOPIC = 'orders.created';

/**
 * Select "Earliest" in the Start Position CustomSelect with visible pauses:
 * 1. Open trigger (ripple)
 * 2. Spotlight the open menu so the viewer can see the options
 * 3. Spotlight + pause on the "Earliest" item before clicking
 * 4. Click "Earliest", then spotlight the position select to confirm the new value
 *
 * The menu is portaled to `document.body` — query `.cs-menu` after opening.
 * `ctx.selectOption` does NOT work with CustomSelect components.
 */
async function selectEarliestPosition(ctx: {
  delay: (ms: number) => Promise<void>;
  click?: (sel: string) => Promise<void>;
  waitFor?: (sel: string, timeoutMs?: number) => Promise<void>;
}): Promise<void> {
  const posSelect = document.querySelector<HTMLElement>(KAFKA.CON_POSITION_SELECT);
  if (!posSelect) return;
  const currentText = posSelect.querySelector('.cs-trigger')?.textContent?.trim() ?? '';
  if (currentText.includes('Earliest')) return;

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

  // Spotlight the open menu so the viewer can read the options
  const disposeMenuSpotlight = showSpotlightRing(menu);
  await ctx.delay(600);
  disposeMenuSpotlight();

  // Find the "Earliest" item and spotlight it before clicking
  const items = Array.from(menu.querySelectorAll<HTMLElement>('.cs-item, [role="option"]'));
  const earliestItem = items.find((item) => item.textContent?.includes('Earliest'));
  if (!earliestItem) return;

  const disposeItemSpotlight = showSpotlightRing(earliestItem);
  await ctx.delay(500);
  disposeItemSpotlight();
  earliestItem.click();

  // Spotlight the position select to confirm the new value is displayed
  await ctx.delay(300);
  const disposeConfirmSpotlight = showSpotlightRing(posSelect);
  await ctx.delay(600);
  disposeConfirmSpotlight();
}

function setFieldValueQuiet(
  selector: string,
  value: string,
): void {
  const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
  if (!el) return;
  if (el.value === value) return;
  // Native setter so React controlled inputs pick up the change.
  const proto = el instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Quietly open the Consume tab (no demo ripple / tab-tour flash). */
async function ensureConsumeTabQuiet(ctx: DemoActionContext): Promise<void> {
  const already =
    document.querySelector<HTMLElement>(KAFKA.CONSUME_TAB)?.getAttribute('aria-selected') === 'true'
    || document.querySelector<HTMLElement>(KAFKA.CONSUME_TAB)?.classList.contains('active');
  if (!already) {
    document.querySelector<HTMLElement>(KAFKA.CONSUME_TAB)?.click();
    await ctx.delay(120);
  }
  // Drop any leftover focus ring on primary CTAs (reads as a second "spotlight").
  (document.activeElement as HTMLElement | null)?.blur?.();
}

/** Clear leftover filter values + scroll position from prior Kafka lessons. */
function calmConsumeFormSurface(): void {
  for (const sel of [
    KAFKA.CON_KEY_FILTER_INPUT,
    KAFKA.CON_HEADER_FILTER_INPUT,
    KAFKA.CON_JSONPATH_INPUT,
    KAFKA.CON_JSONVAL_INPUT,
    KAFKA.CON_BODY_CONTAINS_INPUT,
  ]) {
    setFieldValueQuiet(sel, '');
  }
  const modeTabs = document.querySelector<HTMLElement>(KAFKA.CON_MODE_TABS);
  const scrollParent = modeTabs ? findScrollableParent(modeTabs) : null;
  if (scrollParent) scrollParent.scrollTop = 0;
  (document.activeElement as HTMLElement | null)?.blur?.();
}

/** Produce N messages to the stream topic via REST (visible in LIVE table). */
async function produceStreamDemoMessages(
  count: number,
  label: string,
): Promise<void> {
  try {
    const status = await dispatchKafkaOperation<{ state: string; clusterId?: string }>('status');
    const clusterId = status.data?.state === 'connected' ? status.data.clusterId : undefined;
    if (!clusterId) return;
    const messages = Array.from({ length: count }, (_, i) => ({
      key: `${label}-${i + 1}`,
      value: JSON.stringify({ streamDemo: true, seq: `${label}-${i + 1}`, at: Date.now() + i }),
    }));
    await dispatchKafkaOperation('produce', {
      clusterId,
      topic: STREAM_TOPIC,
      messages,
    });
  } catch { /* broker may be down */ }
}

/**
 * Stream mode setup: quiet connect (no Settings UI tour under the live overlay),
 * seed one message via REST, land on Consume with a calm form surface.
 */
async function kafkaStreamModeSetup(ctx: DemoActionContext): Promise<void> {
  await kafkaSetup(ctx);
  await produceStreamDemoMessages(1, 'seed');
  await ensureConsumeTabQuiet(ctx);
  calmConsumeFormSurface();
  await ctx.delay(80);
}

/** Ensure Stream mode is active and the LIVE consumer is running. */
async function ensureStreamLive(ctx: DemoActionContext): Promise<void> {
  await ensureConsumeTabQuiet(ctx);
  const streamBtn = document.querySelector<HTMLElement>(KAFKA.CON_MODE_STREAM);
  if (streamBtn && !streamBtn.classList.contains('active')) {
    streamBtn.click();
    await ctx.delay(200);
  }
  setFieldValueQuiet(KAFKA.CON_TOPIC_INPUT, STREAM_TOPIC);
  calmConsumeFormSurface();
  if (!document.querySelector(KAFKA.STREAM_LIVE_BADGE)) {
    const startBtn = document.querySelector<HTMLButtonElement>(KAFKA.STREAM_START_BTN);
    if (startBtn && !startBtn.disabled) {
      startBtn.click();
      try {
        await ctx.waitFor(KAFKA.STREAM_LIVE_BADGE, 8000);
      } catch { /* broker may be down */ }
      await ctx.delay(300);
    }
  }
}

export const kafkaStreamModeLesson: DemoLesson = {
  id: 'kafka-stream-mode',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Stream Mode',
  description:
    'Switch the Consume Studio to live-stream mode, watch messages arrive in real time with the LIVE badge, then stop and export the captured session.',
  estimatedMinutes: 3,
  initialTab: 'kafka-message-studio',
  allowedTabs: ['kafka-settings'],

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',
  tag: '🐳 Docker',

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
    // Step 1 (combined): introduce Stream Mode and immediately switch to it.
    // The narration lands during the reading pause; the action then clicks
    // Stream and fills the topic — visible teaching beats, no pre-step flash.
    {
      id: 'sm-intro',
      title: 'Switch to Stream Mode',
      description:
        `The **Consume** tab has two mode buttons at the bottom of the form: **Consume Once** (a bounded batch fetch) and **Stream** (an unbounded live consumer). Click **Stream** to switch from batch mode to live streaming, then set **Topic** to \`${STREAM_TOPIC}\` — the same topic the Publish lesson wrote to.`,
      highlight: KAFKA.CON_MODE_STREAM,
      preAction: async (ctx) => {
        await ensureConsumeTabQuiet(ctx);
        calmConsumeFormSurface();
        await ctx.waitFor(KAFKA.CON_MODE_TABS, 3000);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.CON_MODE_STREAM);
        await ctx.delay(900);
        await ctx.fill(KAFKA.CON_TOPIC_INPUT, STREAM_TOPIC);
        await ctx.delay(500);
      },
    },

    // Step 3: Set Start Position to Earliest
    {
      id: 'sm-position',
      title: 'Set Start Position to Earliest',
      description:
        'Change **Start Position** to **Earliest** — this tells the consumer to replay all messages from the very beginning of the partition log. Since setup already published a message, you will see it appear the moment the stream opens.',
      highlight: KAFKA.CON_POSITION_SELECT,
      action: async (ctx) => {
        await selectEarliestPosition(ctx);
        await ctx.delay(400);
      },
    },

    // Step 3: Start the stream
    {
      id: 'sm-start',
      title: 'Start Stream',
      description:
        'Scroll down past the mode strip and click **Start Stream**. The consumer connects to the broker and the **LIVE badge** appears — a pulsing green dot that confirms messages are being received. Any messages produced to this topic will appear in the table below.',
      highlight: KAFKA.STREAM_START_BTN,
      preAction: async (ctx) => {
        // Quietly recover required state when users rapid-skip prior steps.
        const streamBtn = document.querySelector<HTMLElement>(KAFKA.CON_MODE_STREAM);
        if (streamBtn && !streamBtn.classList.contains('active')) {
          streamBtn.click();
        }
        setFieldValueQuiet(KAFKA.CON_TOPIC_INPUT, STREAM_TOPIC);
        await selectEarliestPosition(ctx);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.STREAM_START_BTN);
        // Wait for LIVE badge — confirms broker connection established
        await ctx.waitFor(KAFKA.STREAM_LIVE_BADGE, 8000);
        await ctx.delay(500);
        // Scroll down to reveal the results table in the scrollable pane
        const resultsZone = document.querySelector<HTMLElement>(KAFKA.STREAM_RESULTS_ZONE);
        if (resultsZone) {
          const scrollParent = findScrollableParent(resultsZone);
          if (scrollParent) {
            scrollParent.scrollTo({ top: scrollParent.scrollHeight, behavior: 'smooth' });
          } else {
            resultsZone.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        await ctx.delay(800);
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

    // Step 5: Auto-scroll behaviour — must show new rows, pause, and ↓ Newest
    {
      id: 'sm-scroll',
      title: 'Auto-Scroll',
      description:
        'The results table below the LIVE badge **auto-scrolls** to the newest row as messages arrive. ' +
        'Scrolling up pauses auto-scroll so you can read earlier messages — a **↓ Newest** button appears. ' +
        'Click it (or scroll back down) to resume following the live tip of the stream.',
      // Highlights the Newest button once it appears (after the action scrolls up).
      // Falls back gracefully during reading if the button is not yet visible.
      highlight: KAFKA.STREAM_SCROLL_BOTTOM_BTN,
      preAction: async (ctx) => {
        await ensureStreamLive(ctx);
      },
      action: async (ctx) => {
        const zone = document.querySelector<HTMLElement>(KAFKA.STREAM_RESULTS_ZONE);
        zone?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        await ctx.delay(500);

        // Beat 1: produce a burst so the table overflows and auto-scrolls to newest
        const rowsBefore = document.querySelectorAll(`${KAFKA.STREAM_RESULTS_ZONE} tbody tr`).length;
        await produceStreamDemoMessages(10, 'auto');
        for (let i = 0; i < 40; i++) {
          const n = document.querySelectorAll(`${KAFKA.STREAM_RESULTS_ZONE} tbody tr`).length;
          if (n >= rowsBefore + 3) break;
          await ctx.delay(150);
        }
        await ctx.delay(900);

        const tableWrap = document.querySelector<HTMLElement>(KAFKA.STREAM_TABLE_WRAP)
          ?? document.querySelector<HTMLElement>('.kafka-ms-stream-table-wrap');
        if (tableWrap && tableWrap.scrollHeight > tableWrap.clientHeight + 8) {
          // Beat 2: scroll up — pauses auto-scroll; ↓ Newest appears
          tableWrap.scrollTop = 0;
          tableWrap.dispatchEvent(new Event('scroll', { bubbles: true }));
          await ctx.delay(500);

          try {
            await ctx.waitFor(KAFKA.STREAM_SCROLL_BOTTOM_BTN, 3000);
          } catch { /* button may already be visible */ }

          const scrollBtn = document.querySelector<HTMLElement>(KAFKA.STREAM_SCROLL_BOTTOM_BTN);
          if (scrollBtn) {
            const dispose = showSpotlightRing(scrollBtn);
            await ctx.delay(1400);
            dispose();
            await ctx.click(KAFKA.STREAM_SCROLL_BOTTOM_BTN);
            await ctx.delay(1000);
          } else {
            // Fallback: resume by scrolling to bottom manually
            tableWrap.scrollTop = tableWrap.scrollHeight;
            tableWrap.dispatchEvent(new Event('scroll', { bubbles: true }));
            await ctx.delay(800);
          }
        } else {
          // Not enough rows for overflow — still pause so narration can land
          await ctx.delay(800);
        }

        // Beat 3: one more produce so the viewer sees auto-scroll resume
        await produceStreamDemoMessages(2, 'resume');
        await ctx.delay(1200);
      },
      pauseAfter: true,
    },

    // Step 6: Click a message row → Message Detail modal
    {
      id: 'sm-row',
      title: 'Inspect a Streamed Message',
      description:
        'Click any **row** in the stream table to open the **Message Detail** dialog — partition, offset, timestamp, key, headers, and a pretty-printed payload. The stream keeps running in the background while you inspect.',
      // Reading spotlight on the first row (not the whole results zone).
      highlight: KAFKA.STREAM_ROW_FIRST,
      preAction: async (ctx) => {
        await ensureStreamLive(ctx);
        // Close a leftover detail dialog so this step can open a fresh one.
        const closeBtn = document.querySelector<HTMLElement>(KAFKA.CON_DETAIL_CLOSE);
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(200);
        }
        // Scroll the TABLE WRAPPER to the top so the first row is fully visible
        // (not just nudged into view at the edge). Use smooth so the viewer
        // sees the table animate to the start position.
        const tableWrap = document.querySelector<HTMLElement>(KAFKA.STREAM_TABLE_WRAP)
          ?? document.querySelector<HTMLElement>('.kafka-ms-stream-table-wrap');
        if (tableWrap) {
          tableWrap.scrollTo({ top: 0, behavior: 'smooth' });
          await ctx.delay(400);
        }
        // Also make the results zone itself visible in the page.
        const zone = document.querySelector<HTMLElement>(KAFKA.STREAM_RESULTS_ZONE);
        zone?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await ctx.delay(400);
      },
      action: async (ctx) => {
        // After scrolling to top, the first row is now fully visible — pick it.
        const row =
          document.querySelector<HTMLElement>(KAFKA.STREAM_ROW_FIRST)
          ?? document.querySelector<HTMLElement>(`${KAFKA.STREAM_RESULTS_ZONE} tbody tr`);
        if (!row) return;

        // If this row is already selected, click once to clear, then open again.
        if (row.classList.contains('selected')) {
          row.click();
          await ctx.delay(200);
        }

        // Spotlight the row — it's already at the top of the visible table.
        const disposeRow = showSpotlightRing(row);
        await ctx.delay(900);
        disposeRow();

        row.click();
        await ctx.waitFor(KAFKA.CON_DETAIL_MODAL, 5000);
        await ctx.delay(500);

        const modal = document.querySelector<HTMLElement>(KAFKA.CON_DETAIL_MODAL);
        if (modal) {
          const disposeModal = showSpotlightRing(modal);
          await ctx.delay(2000);
          disposeModal();
        }
      },
      verify: KAFKA.CON_DETAIL_MODAL,
      pauseAfter: true,
    },

    // Step 7: Stop the stream
    {
      id: 'sm-stop',
      title: 'Stop Stream',
      description:
        'Click **Stop Stream** to close the consumer. All messages captured during the session remain in the table — you can keep reading, clicking rows, and filtering. The LIVE badge disappears and the **Export Stream** button becomes available.',
      highlight: KAFKA.STREAM_STOP_BTN,
      preAction: async (ctx) => {
        // Close detail dialog so Stop Stream is visible/clickable.
        const closeBtn = document.querySelector<HTMLElement>(KAFKA.CON_DETAIL_CLOSE);
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(250);
        }
      },
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
