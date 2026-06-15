/**
 * Lesson 16: Session Recording & Replay
 *
 * Demonstrates the full recording lifecycle:
 *  - Start recording a live session
 *  - Capture sent/received messages with timestamps
 *  - Stop and save the recording as JSON
 *  - Import a recording file
 *  - Replay with original timing, speed control, and exit
 *
 * No Docker required — uses the built-in mock echo server.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WS } from '../../../../shared/selectors';
import { wsSetup, wsCleanup } from '../setup-helpers';

// ── Constants ──────────────────────────────────────────────────
const MOCK_URL = 'ws://localhost:9876';

/**
 * Build a synthetic ws-recording-v1 JSON recording.
 * Events are spaced 400–500 ms apart so the replay completes in ~5 s
 * at 1× speed — fast enough for a demo viewer to follow without waiting.
 */
function buildDemoRecording(): string {
  const now = new Date().toISOString();
  const base = Date.now();
  const msg = (ms: number, dir: 'sent' | 'received', data: string) => ({
    type: 'message' as const,
    relativeMs: ms,
    frame: { direction: dir, data, timestamp: base + ms, size: data.length, opcode: 1 },
  });
  return JSON.stringify({
    _format: 'ws-recording-v1',
    metadata: {
      url: MOCK_URL,
      protocol: 'raw',
      startedAt: now,
      durationMs: 5000,
      messageCount: 12,
    },
    events: [
      msg(0,    'sent',     '{"action":"hello","seq":1}'),
      msg(400,  'received', '{"action":"hello","seq":1}'),
      msg(900,  'sent',     '{"action":"ping","seq":2}'),
      msg(1300, 'received', '{"action":"ping","seq":2}'),
      msg(1800, 'sent',     '{"action":"status","seq":3}'),
      msg(2200, 'received', '{"action":"status","seq":3}'),
      msg(2700, 'sent',     '{"action":"metrics","seq":4}'),
      msg(3100, 'received', '{"action":"metrics","seq":4}'),
      msg(3600, 'sent',     '{"action":"health","seq":5}'),
      msg(4000, 'received', '{"action":"health","seq":5}'),
      msg(4500, 'sent',     '{"action":"bye","seq":6}'),
      msg(4900, 'received', '{"action":"bye","seq":6}'),
    ],
  });
}

/**
 * Programmatically inject a recording file into the hidden file input.
 * Uses DataTransfer to create a synthetic FileList.
 * We cannot click the Import button directly because it opens an OS file
 * picker — this helper injects straight to the hidden <input type="file">.
 */
async function injectRecordingFile(ctx: DemoActionContext): Promise<void> {
  const input = document.querySelector(WS.REC_FILE_INPUT) as HTMLInputElement | null;
  if (!input) return;

  const json = buildDemoRecording();
  const blob = new Blob([json], { type: 'application/json' });
  const file = new File([blob], 'demo-recording.json', { type: 'application/json' });

  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  } catch {
    // DataTransfer may not be available in test environments;
    // fall back to defineProperty on the input
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: true,
      configurable: true,
    });
  }
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await ctx.delay(800);
}

// ── Internal guard helpers ───────────────────────────────────────

/** Ensure the WebSocket is connected (no-op if already connected). */
async function ensureConnected(ctx: DemoActionContext): Promise<void> {
  const alreadyConnected = !!document.querySelector(WS.DISCONNECT_BTN);
  if (!alreadyConnected) {
    await ctx.click(WS.LEFT_TAB_CONNECT);
    await ctx.delay(300);
    await ctx.fill(WS.URL_INPUT, MOCK_URL);
    await ctx.delay(200);
    await ctx.click(WS.CONNECT_BTN);
    await ctx.delay(1200);
  }
}

/** Stop an active recording silently (no-op if not recording). */
async function ensureNotRecording(ctx: DemoActionContext): Promise<void> {
  const stopBtn = document.querySelector(WS.REC_STOP_BTN) as HTMLElement | null;
  if (stopBtn) {
    stopBtn.click();
    await ctx.delay(500);
  }
}

/** Exit replay mode silently (no-op if not replaying). */
async function ensureNotReplaying(ctx: DemoActionContext): Promise<void> {
  const exitBtn = document.querySelector(WS.REPLAY_EXIT) as HTMLElement | null;
  if (exitBtn) {
    exitBtn.click();
    await ctx.delay(400);
  }
}

// ── Setup / Cleanup ─────────────────────────────────────────────

async function recordingSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(400);
  await wsSetup(ctx);
  await ctx.delay(200);
  // Clear stale protocol state
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
  await ctx.delay(200);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
  await ctx.delay(200);
}

async function recordingCleanup(ctx: DemoActionContext): Promise<void> {
  // Exit replay if active
  await ensureNotReplaying(ctx);
  await wsCleanup(ctx);
}

// ── Lesson ──────────────────────────────────────────────────────

export const wsSessionRecordingLesson: DemoLesson = {
  id: 'ws-session-recording',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Session Recording & Replay',
  description: 'Record a live session, save the file, import it later, and replay messages at the original pace.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',

  setup: recordingSetup,
  cleanup: recordingCleanup,

  concept: {
    title: 'Session Recording & Replay',
    body: `RedfireForge can record an entire WebSocket session — every message sent and received, with millisecond-accurate timestamps — and replay it later without a running server.

**Recording**

In the Events toolbar, click **● Rec** to start recording. The button turns into a pulsing red **■ Stop**. Every message that flows through the connection is captured with its direction, payload, and precise timing. When you click Stop, the recording is saved as a JSON file (\`ws-recording-v1\` format) that you can share with teammates.

**Import & Replay**

Click **Import** to load a previously saved recording. The **▶ Play** button appears — click it to start replaying messages at their original pace. A replay bar shows:
- **⏸ / ▶** — pause and resume
- **Speed** — 1×, 2×, 5×, 10×, or Max (instant)
- **Progress** — events replayed out of total
- **✕ Exit** — stop replay and clear the log

During replay, the Compose panel is hidden since you're watching a recording, not interacting live.

| Feature | What it captures |
|---|---|
| Messages | Direction (sent/received), payload, size, timestamp |
| State changes | Connection/disconnection events with URLs |
| Timing | Relative milliseconds from session start |`,
    keyTerms: [
      {
        term: 'ws-recording-v1',
        definition: 'The JSON format for session recordings. Contains metadata (URL, protocol, duration, message count) and an array of timestamped events.',
      },
      {
        term: 'Replay Speed',
        definition: 'Controls how fast events are replayed. 1× = original pace, 2×/5×/10× = faster, Max = all events dumped instantly.',
      },
      {
        term: 'Recording Event',
        definition: 'Either a "message" event (with frame data) or a "state-change" event (connection/disconnection). Both carry relativeMs timing.',
      },
    ],
    diagram: `<pre>┌──────────────────────────────────────────────────────────┐
│  Events Toolbar                                          │
│  Filters  Compare  Clear  Export  ● Rec  Import          │
│                                    ▲                     │
│                                    │                     │
│                          Click to start recording        │
├──────────────────────────────────────────────────────────┤
│  Recording Active (red pulse)                            │
│  Filters  Compare  Clear  Export  ■ Stop                 │
│                                    ▲                     │
│                                    │                     │
│  Messages captured with timestamps │                     │
│  ↑ {"action":"hello"}  0ms         │                     │
│  ↓ {"action":"hello"}  50ms        │                     │
│  ↑ {"action":"ping"}   1000ms      │                     │
│  ↓ {"action":"ping"}   1050ms      │                     │
│                                    │                     │
│  Click Stop → saves JSON file      │                     │
├──────────────────────────────────────────────────────────┤
│  After Import → ▶ Play appears                           │
│  Replay Bar:  ⏸  │ 2×  │ 3/8 events │ ✕ Exit           │
└──────────────────────────────────────────────────────────┘</pre>`,
  },

  steps: [
    // ── 1. The Rec Button ─────────────────────────────────
    {
      id: 'rec-intro',
      title: 'The Rec Button',
      description:
        'In the Events toolbar — after Filters, Compare, Clear, and Export — you\'ll see the **● Rec** button. This starts a session recording that captures every message with millisecond-accurate timestamps. Next to it is **Import** for loading a saved recording. Let\'s start recording.',
      highlight: WS.REC_START_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Ensure recording/replay state is clean before connecting
        await ensureNotReplaying(ctx);
        await ensureNotRecording(ctx);
        // Connect if not already connected
        await ensureConnected(ctx);
        // Switch to Events tab so the Rec button is visible
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(400);
      },
    },

    // ── 2. Start Recording ────────────────────────────────
    {
      id: 'rec-start',
      title: 'Start Recording',
      description:
        'Clicking **● Rec** starts the recording. The button transforms into a pulsing red **■ Stop** — a clear indicator that every message is being captured. The recording includes direction (sent/received), payload data, size, and precise relative timestamps.',
      highlight: WS.REC_START_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // If already recording, we're good — nothing to do
        const alreadyRecording = !!document.querySelector(WS.REC_STOP_BTN);
        if (alreadyRecording) return;
        // Stop any active replay first
        await ensureNotReplaying(ctx);
        // Ensure connected and on Events tab
        await ensureConnected(ctx);
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.REC_START_BTN);
        await ctx.delay(800);
      },
    },

    // ── 3. Send During Recording ──────────────────────────
    {
      id: 'rec-capture',
      title: 'Send During Recording',
      description:
        'While recording is active (red ■ Stop pulsing), the demo sends three messages to the echo server. Each sent message and its echoed response is captured with a relative timestamp. The recording file will contain all six events (3 sent + 3 received) when we stop.',
      highlight: WS.SEND_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Ensure recording is active
        const isRecording = !!document.querySelector(WS.REC_STOP_BTN);
        if (!isRecording) {
          await ensureNotReplaying(ctx);
          await ensureConnected(ctx);
          await ctx.click(WS.RIGHT_TAB_EVENTS);
          await ctx.delay(200);
          const startBtn = document.querySelector(WS.REC_START_BTN) as HTMLElement | null;
          if (startBtn) {
            startBtn.click();
            await ctx.delay(600);
          }
        }
        // Switch to Compose tab and pre-fill the message
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.delay(200);
        await ctx.fill(WS.MESSAGE_INPUT, '{"action":"demo","seq":1}');
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        for (let i = 0; i < 3; i++) {
          await ctx.click(WS.SEND_BTN);
          await ctx.delay(400);
        }
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(800);
      },
    },

    // ── 4. Stop & Save ────────────────────────────────────
    {
      id: 'rec-stop',
      title: 'Stop & Save',
      description:
        'Clicking **■ Stop** ends the recording. RedfireForge saves the session as a JSON file (`ws-recording-v1` format) that downloads automatically. The file contains metadata (URL, protocol, duration, message count) and the full array of timestamped events. You can share this file with teammates — they can replay it without needing the original server.',
      highlight: WS.REC_STOP_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Ensure recording is active so the Stop button is visible
        const isRecording = !!document.querySelector(WS.REC_STOP_BTN);
        if (!isRecording) {
          await ensureNotReplaying(ctx);
          await ensureConnected(ctx);
          await ctx.click(WS.RIGHT_TAB_EVENTS);
          await ctx.delay(200);
          const startBtn = document.querySelector(WS.REC_START_BTN) as HTMLElement | null;
          if (startBtn) {
            startBtn.click();
            await ctx.delay(600);
          }
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.REC_STOP_BTN);
        await ctx.delay(800);
      },
    },

    // ── 5. Import a Recording ─────────────────────────────
    {
      id: 'rec-import',
      title: 'Import a Recording',
      description:
        'The **Import** button loads a previously saved recording file. Once loaded successfully, the ● Rec and Import buttons disappear and a **▶ Play** button takes their place — you\'re ready to replay. The demo loads a sample recording with 12 message events spanning 5 seconds.',
      highlight: WS.REC_IMPORT_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Stop recording if active
        await ensureNotRecording(ctx);
        // Exit replay if active
        await ensureNotReplaying(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await injectRecordingFile(ctx);
        await ctx.delay(600);
      },
    },

    // ── 6. Replay at Original Pace ────────────────────────
    {
      id: 'rec-play',
      title: 'Replay at Original Pace',
      description:
        'Clicking **▶ Play** starts the replay. Messages appear in the Events log at their original timing — sent and received messages interleave just like the live session. The **replay bar** below the toolbar shows a pause button (⏸), speed selector (1×/2×/5×/10×/Max), progress counter, and an Exit button.',
      highlight: WS.REPLAY_START_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // If the Play button is already visible, we're ready
        const playBtn = document.querySelector(WS.REPLAY_START_BTN);
        if (playBtn) return;
        // Exit any active replay first
        await ensureNotReplaying(ctx);
        // Stop any active recording
        await ensureNotRecording(ctx);
        // Inject the sample recording so the Play button appears
        await injectRecordingFile(ctx);
        await ctx.delay(400);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.REPLAY_START_BTN);
        // Allow 4 s of replay so the viewer watches several events stream in
        await ctx.delay(4000);
      },
    },

    // ── 7. Exit Replay ────────────────────────────────────
    {
      id: 'rec-exit',
      title: 'Exit Replay',
      description:
        'Clicking **✕ Exit** stops the replay and clears the message log — a clean slate. The ● Rec and Import buttons reappear, ready for another session. You can also let a replay finish naturally — when all events have played, it returns to idle automatically.',
      highlight: WS.REPLAY_EXIT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // By the time this step starts the 4.9-second replay from rec-play will
        // often have already completed (reading + action of that step takes ~32 s).
        // Inject a fresh recording and start a new replay if needed, then
        // immediately pause it — this keeps the ✕ Exit button visible throughout
        // the entire reading phase so the spotlight is never empty.
        const exitBtn = document.querySelector(WS.REPLAY_EXIT);
        if (!exitBtn) {
          await ensureNotRecording(ctx);
          await injectRecordingFile(ctx);
          await ctx.delay(300);
          const playBtn = document.querySelector(WS.REPLAY_START_BTN) as HTMLElement | null;
          if (playBtn) {
            playBtn.click();
            await ctx.delay(500); // Let a couple of events stream in
          }
        }
        // Pause so the replay bar (and ✕ Exit) stays visible during reading
        const playpauseBtn = document.querySelector(WS.REPLAY_PLAYPAUSE) as HTMLElement | null;
        if (playpauseBtn && playpauseBtn.textContent?.trim() === '⏸') {
          playpauseBtn.click();
          await ctx.delay(300);
        }
      },
      action: async (ctx: DemoActionContext) => {
        // Exit replay if still active (may have finished naturally in long demos)
        const exitBtn = document.querySelector(WS.REPLAY_EXIT) as HTMLElement | null;
        if (exitBtn) {
          await ctx.click(WS.REPLAY_EXIT);
          await ctx.delay(600);
        }
      },
    },
  ],
};
