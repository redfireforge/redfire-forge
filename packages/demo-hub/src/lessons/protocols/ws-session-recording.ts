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
import { WS } from '@shared/selectors';
import {
  clearEvents,
  closeExtraConnectionTabs,
  disconnectWebSocket,
  fillControlledInput,
  firstVisibleEl,
  startMockServerQuiet,
  stopMockServerQuiet,
  switchToClientModeQuiet,
} from '../setup-helpers';
import { firstVisibleElement } from '../../utils/domVisibility';

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
    frame: {
      id: `demo-rec-${ms}-${dir}`,
      direction: dir,
      type: 'text' as const,
      data,
      size: data.length,
      timestamp: new Date(base + ms).toISOString(),
    },
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
  const input = firstVisibleElement<HTMLInputElement>(WS.REC_FILE_INPUT);
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
  // The Disconnect button is always in the DOM (just disabled when not connected),
  // so we must check !disabled rather than mere presence.
  const disconnectBtn = firstVisibleElement<HTMLButtonElement>(WS.DISCONNECT_BTN);
  const alreadyConnected = !!disconnectBtn && !disconnectBtn.disabled;
  if (!alreadyConnected) {
    await ctx.click(WS.LEFT_TAB_CONNECT);
    await ctx.waitFor(WS.URL_INPUT);
    await ctx.delay(200);
    await ctx.fill(WS.URL_INPUT, MOCK_URL);
    await ctx.delay(200);
    await ctx.click(WS.CONNECT_BTN);
    await ctx.delay(1200);
  }
}

/** Stop an active recording silently (no-op if not recording). */
async function ensureNotRecording(ctx: DemoActionContext): Promise<void> {
  const stopBtn = firstVisibleElement<HTMLElement>(WS.REC_STOP_BTN);
  if (stopBtn) {
    stopBtn.click();
    await ctx.delay(500);
  }
}

/** Exit replay mode silently (no-op if not replaying). */
async function ensureNotReplaying(ctx: DemoActionContext): Promise<void> {
  const exitBtn = firstVisibleElement<HTMLElement>(WS.REPLAY_EXIT);
  if (exitBtn) {
    exitBtn.click();
    await ctx.delay(400);
  }
}

/** Quietly reset Connect wire settings without Mock/Client mode tours. */
async function resetConnectWireSettingsQuiet(ctx: DemoActionContext): Promise<void> {
  await switchToClientModeQuiet(ctx);
  firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
  await ctx.delay(60);
  const sub = firstVisibleEl<HTMLInputElement>(WS.SUBPROTOCOLS_INPUT);
  if (sub && sub.value !== '') fillControlledInput(sub, '');
  // Only open the protocol menu when it is not already Raw (avoids a dropdown flash).
  const wrapper = firstVisibleEl<HTMLElement>(WS.PROTOCOL_SELECT);
  const label = wrapper?.querySelector('.cs-trigger')?.textContent?.trim().toLowerCase() ?? '';
  if (label !== 'raw') {
    await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
    await ctx.delay(40);
  }
}

// ── Setup / Cleanup ─────────────────────────────────────────────

/**
 * Quiet setup — REST mock + Client/Connect. Must not open Mock mode during
 * setup: Live view is already visible and that tour flashes step 1.
 */
async function recordingSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(WS.CONN_TAB_BAR);
  const disconnectBtn = firstVisibleEl<HTMLButtonElement>(WS.DISCONNECT_BTN);
  if (disconnectBtn && !disconnectBtn.disabled) {
    disconnectBtn.click();
    await ctx.delay(40);
  }
  // Close extras from prior lessons (e.g. ws-power-user) — quiet DOM closes only.
  await closeExtraConnectionTabs(ctx);
  await startMockServerQuiet(ctx, 9876);
  await resetConnectWireSettingsQuiet(ctx);
}

async function recordingCleanup(ctx: DemoActionContext): Promise<void> {
  await ensureNotReplaying(ctx);
  await ensureNotRecording(ctx);
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  await stopMockServerQuiet(ctx, 9876);
  await switchToClientModeQuiet(ctx);
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

In the Events toolbar, click **● Rec** to start recording. The button turns into a pulsing red **■ Stop**. Every message that flows through the connection is captured with its direction, payload, and precise timing. When you click Stop, the recording is saved as a JSON file that you can share with teammates.

**Import & Replay**

Click **Import** to load a previously saved recording. The **▶ Play** button appears — click it to start replaying messages at their original pace. A replay bar shows:
- **⏸ / ▶** — pause and resume
- **Speed** — 1×, 2×, 5×, 10×, or Max (instant)
- **Progress** — events replayed out of total
- **✕ Exit** — stop replay and clear the log

During replay, the **Send** panel is hidden since you're watching a recording, not interacting live.

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
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 430" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="sr-arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
      <path d="M1,1.5 L7,4 L1,6.5 Z" fill="#3b4a60"/>
    </marker>
    <marker id="sr-arr-green" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
      <path d="M1,1.5 L7,4 L1,6.5 Z" fill="#22c55e"/>
    </marker>
    <filter id="sr-shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>
    </filter>
    <filter id="sr-glow-red">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="sr-glow-green">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- ═══════════════════════════════════════
       STEP LABELS (top)
  ═══════════════════════════════════════ -->
  <!-- Step 1 badge -->
  <circle cx="105" cy="16" r="11" fill="#3b82f6"/>
  <text x="105" y="20" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">1</text>
  <text x="122" y="20" font-size="11" font-weight="600" fill="#f1f5f9">Idle — Ready to Record</text>

  <!-- Step 2 badge -->
  <circle cx="275" cy="16" r="11" fill="#ef4444"/>
  <text x="275" y="20" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">2</text>
  <text x="292" y="20" font-size="11" font-weight="600" fill="#f1f5f9">Recording Active</text>

  <!-- Step 3 badge -->
  <circle cx="540" cy="16" r="11" fill="#22c55e"/>
  <text x="540" y="20" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">3</text>
  <text x="557" y="20" font-size="11" font-weight="600" fill="#f1f5f9">Import &amp; Replay</text>

  <!-- ═══════════════════════════════════════
       PANEL 1 — IDLE / REC BUTTON
  ═══════════════════════════════════════ -->
  <rect x="1" y="33" width="208" height="238" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5" filter="url(#sr-shadow)"/>

  <!-- Panel 1 header: Events Toolbar -->
  <rect x="1" y="33" width="208" height="26" rx="8" fill="#0a1118"/>
  <rect x="1" y="47" width="208" height="12" fill="#0a1118"/>
  <text x="14" y="50" font-size="9.5" font-weight="700" fill="#a8b8cc" letter-spacing="0.3">EVENTS TOOLBAR</text>

  <!-- Toolbar buttons row -->
  <rect x="9" y="65" width="190" height="28" rx="4" fill="#131c28" stroke="#3b4a60" stroke-width="1"/>
  <text x="17" y="83" font-size="9" fill="#a8b8cc">Filters</text>
  <text x="51" y="83" font-size="9" fill="#a8b8cc">Compare</text>
  <text x="95" y="83" font-size="9" fill="#a8b8cc">Clear</text>
  <text x="121" y="83" font-size="9" fill="#a8b8cc">Export</text>

  <!-- ● Rec button — highlighted -->
  <rect x="151" y="69" width="34" height="19" rx="3" fill="#1a0808" stroke="#ef4444" stroke-width="1.2"/>
  <circle cx="159" cy="78" r="4" fill="#ef4444"/>
  <text x="165" y="82" font-size="9.5" font-weight="700" fill="#ef4444">Rec</text>

  <!-- Import button -->
  <rect x="189" y="69" width="1" height="19" fill="#3b4a60"/>
  <!-- (fits in same row, small) -->

  <!-- Annotation arrow pointing to Rec -->
  <line x1="168" y1="88" x2="168" y2="110" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3,2" marker-end="url(#sr-arr)"/>
  <rect x="94" y="112" width="148" height="26" rx="4" fill="#1a0808" stroke="#ef4444" stroke-width="1" stroke-opacity="0.5"/>
  <text x="168" y="124" text-anchor="middle" font-size="9.5" fill="#ef4444" font-weight="500">Click to start recording</text>
  <text x="168" y="136" text-anchor="middle" font-size="8.5" fill="#a8b8cc">captures every message +</text>

  <!-- JSON format preview -->
  <rect x="9" y="148" width="190" height="114" rx="5" fill="#0a1118" stroke="#3b4a60" stroke-width="1"/>
  <text x="18" y="163" font-size="8.5" font-weight="600" fill="#3b4a60">ws-recording-v1 format</text>
  <text x="18" y="178" font-size="8" fill="#3b4a60" font-family="'SF Mono','Fira Code',monospace">{</text>
  <text x="26" y="191" font-size="8" fill="#3b4a60" font-family="'SF Mono','Fira Code',monospace">"version": "ws-recording-v1",</text>
  <text x="26" y="204" font-size="8" fill="#3b4a60" font-family="'SF Mono','Fira Code',monospace">"url": "ws://localhost:9876",</text>
  <text x="26" y="217" font-size="8" fill="#3b4a60" font-family="'SF Mono','Fira Code',monospace">"events": [ … ]</text>
  <text x="18" y="230" font-size="8" fill="#3b4a60" font-family="'SF Mono','Fira Code',monospace">}</text>
  <text x="18" y="253" font-size="8.5" fill="#a8b8cc" font-style="italic">saved to JSON on Stop</text>

  <!-- ═══════════════════════════════════════
       ARROW 1 → 2
  ═══════════════════════════════════════ -->
  <line x1="213" y1="152" x2="253" y2="152" stroke="#3b4a60" stroke-width="2" marker-end="url(#sr-arr)"/>
  <text x="233" y="146" text-anchor="middle" font-size="8.5" fill="#a8b8cc">● Rec</text>

  <!-- ═══════════════════════════════════════
       PANEL 2 — RECORDING ACTIVE
  ═══════════════════════════════════════ -->
  <rect x="257" y="33" width="220" height="238" rx="8" fill="#0d1520" stroke="#ef4444" stroke-width="1.5" filter="url(#sr-shadow)"/>

  <!-- Panel 2 header -->
  <rect x="257" y="33" width="220" height="26" rx="8" fill="#1a0808"/>
  <rect x="257" y="47" width="220" height="12" fill="#1a0808"/>
  <!-- Pulsing red dot -->
  <circle cx="272" cy="46" r="6" fill="#ef4444" opacity="0.25" filter="url(#sr-glow-red)"/>
  <circle cx="272" cy="46" r="4" fill="#ef4444"/>
  <text x="282" y="50" font-size="9.5" font-weight="700" fill="#ef4444" letter-spacing="0.3">RECORDING</text>
  <text x="353" y="50" font-size="9" fill="#a8b8cc">live capture</text>

  <!-- Toolbar with ■ Stop -->
  <rect x="265" y="65" width="204" height="28" rx="4" fill="#131c28" stroke="#ef4444" stroke-width="1" stroke-opacity="0.5"/>
  <text x="273" y="83" font-size="9" fill="#a8b8cc">Filters</text>
  <text x="307" y="83" font-size="9" fill="#a8b8cc">Compare</text>
  <text x="351" y="83" font-size="9" fill="#a8b8cc">Clear</text>
  <text x="377" y="83" font-size="9" fill="#a8b8cc">Export</text>
  <!-- ■ Stop button -->
  <rect x="408" y="69" width="34" height="19" rx="3" fill="#ef4444"/>
  <rect x="415" y="75" width="7" height="7" fill="#fff"/>
  <text x="425" y="82" font-size="9.5" font-weight="700" fill="#fff">Stop</text>

  <!-- Message stream list -->
  <rect x="265" y="100" width="204" height="148" rx="5" fill="#090f18" stroke="#3b4a60" stroke-width="1"/>
  <text x="274" y="115" font-size="8.5" font-weight="600" fill="#a8b8cc">Messages captured:</text>

  <!-- Message rows -->
  <!-- ↑ sent -->
  <rect x="265" y="119" width="204" height="18" fill="#0d1a12"/>
  <text x="273" y="131" font-size="9" fill="#3b82f6">↑</text>
  <text x="283" y="131" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#f1f5f9">{"action":"hello"}</text>
  <text x="438" y="131" text-anchor="end" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#3b4a60">0 ms</text>
  <text x="457" y="131" font-size="8" fill="#3b82f6">sent</text>

  <!-- ↓ received -->
  <rect x="265" y="137" width="204" height="18" fill="#0d1520"/>
  <text x="273" y="149" font-size="9" fill="#22c55e">↓</text>
  <text x="283" y="149" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#f1f5f9">{"action":"hello"}</text>
  <text x="438" y="149" text-anchor="end" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#3b4a60">50 ms</text>
  <text x="453" y="149" font-size="8" fill="#22c55e">recv</text>

  <!-- ↑ sent -->
  <rect x="265" y="155" width="204" height="18" fill="#0d1a12"/>
  <text x="273" y="167" font-size="9" fill="#3b82f6">↑</text>
  <text x="283" y="167" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#f1f5f9">{"action":"ping"}</text>
  <text x="430" y="167" text-anchor="end" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#3b4a60">1 000 ms</text>
  <text x="457" y="167" font-size="8" fill="#3b82f6">sent</text>

  <!-- ↓ received -->
  <rect x="265" y="173" width="204" height="18" fill="#0d1520"/>
  <text x="273" y="185" font-size="9" fill="#22c55e">↓</text>
  <text x="283" y="185" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#f1f5f9">{"action":"ping"}</text>
  <text x="430" y="185" text-anchor="end" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#3b4a60">1 050 ms</text>
  <text x="453" y="185" font-size="8" fill="#22c55e">recv</text>

  <!-- ↑ sent -->
  <rect x="265" y="191" width="204" height="18" fill="#0d1a12"/>
  <text x="273" y="203" font-size="9" fill="#3b82f6">↑</text>
  <text x="283" y="203" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#f1f5f9">{"action":"status"}</text>
  <text x="430" y="203" text-anchor="end" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#3b4a60">1 800 ms</text>
  <text x="457" y="203" font-size="8" fill="#3b82f6">sent</text>

  <!-- Fade-out gradient for more rows below -->
  <rect x="265" y="210" width="204" height="20" fill="#090f18"/>
  <text x="367" y="225" text-anchor="middle" font-size="9" fill="#3b4a60">· · · more events · · ·</text>

  <!-- Save indicator -->
  <rect x="265" y="234" width="204" height="24" rx="0" fill="#0a1118"/>
  <rect x="265" y="247" width="204" height="11" rx="0" fill="#0a1118"/>
  <rect x="265" y="234" width="204" height="24" rx="5" fill="#0d1a12" stroke="#f59e0b" stroke-width="1" stroke-opacity="0.6"/>
  <text x="367" y="251" text-anchor="middle" font-size="9.5" fill="#f59e0b">■ Stop → saves  demo-session.json</text>

  <!-- ═══════════════════════════════════════
       ARROW 2 → 3
  ═══════════════════════════════════════ -->
  <line x1="481" y1="152" x2="521" y2="152" stroke="#3b4a60" stroke-width="2" marker-end="url(#sr-arr)"/>
  <text x="501" y="146" text-anchor="middle" font-size="8.5" fill="#a8b8cc">Import</text>

  <!-- ═══════════════════════════════════════
       PANEL 3 — IMPORT & REPLAY
  ═══════════════════════════════════════ -->
  <rect x="525" y="33" width="174" height="238" rx="8" fill="#0d1520" stroke="#22c55e" stroke-width="1.5" filter="url(#sr-shadow)"/>

  <!-- Panel 3 header -->
  <rect x="525" y="33" width="174" height="26" rx="8" fill="#071e12"/>
  <rect x="525" y="47" width="174" height="12" fill="#071e12"/>
  <text x="538" y="50" font-size="9.5" font-weight="700" fill="#22c55e" letter-spacing="0.3">REPLAY MODE</text>

  <!-- Import button area -->
  <rect x="533" y="65" width="158" height="28" rx="4" fill="#131c28" stroke="#3b4a60" stroke-width="1"/>
  <text x="541" y="83" font-size="9" fill="#a8b8cc">Filters  Compare  Clear  Export</text>
  <!-- Play button -->
  <rect x="660" y="68" width="28" height="20" rx="3" fill="#22c55e"/>
  <polygon points="666,73 666,83 676,78" fill="#fff"/>

  <!-- Replay annotation -->
  <text x="612" y="105" text-anchor="middle" font-size="9" fill="#22c55e">▶ Play appears after Import</text>

  <!-- Replay control bar -->
  <rect x="533" y="113" width="158" height="36" rx="5" fill="#071e12" stroke="#22c55e" stroke-width="1.2"/>
  <text x="542" y="127" font-size="8.5" font-weight="600" fill="#a8b8cc">Replay Bar</text>

  <!-- Pause button -->
  <rect x="533" y="128" width="22" height="20" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <rect x="539" y="133" width="3" height="10" fill="#a8b8cc"/>
  <rect x="545" y="133" width="3" height="10" fill="#a8b8cc"/>

  <!-- Speed pill -->
  <rect x="558" y="128" width="28" height="20" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="572" y="141" text-anchor="middle" font-size="9.5" font-weight="700" fill="#f1f5f9">2×</text>

  <!-- Progress indicator -->
  <rect x="589" y="128" width="60" height="20" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="619" y="141" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#22c55e">3 / 8</text>
  <text x="619" y="143" text-anchor="middle" font-size="0" fill="transparent">events</text>

  <!-- Exit button -->
  <rect x="652" y="128" width="38" height="20" rx="3" fill="#1a0808" stroke="#ef4444" stroke-width="1" stroke-opacity="0.6"/>
  <text x="671" y="141" text-anchor="middle" font-size="9.5" fill="#ef4444">✕ Exit</text>

  <!-- Speed options -->
  <text x="533" y="162" font-size="8.5" fill="#a8b8cc">speed:</text>
  <!-- Speed pills -->
  <rect x="560" y="154" width="20" height="14" rx="2" fill="#1e2a1e" stroke="#22c55e" stroke-width="1"/>
  <text x="570" y="164" text-anchor="middle" font-size="8" font-weight="600" fill="#22c55e">1×</text>
  <rect x="583" y="154" width="20" height="14" rx="2" fill="#22c55e" opacity="0.85"/>
  <text x="593" y="164" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">2×</text>
  <rect x="606" y="154" width="20" height="14" rx="2" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="616" y="164" text-anchor="middle" font-size="8" fill="#a8b8cc">5×</text>
  <rect x="629" y="154" width="24" height="14" rx="2" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="641" y="164" text-anchor="middle" font-size="8" fill="#a8b8cc">Max</text>

  <!-- Event progress bar -->
  <text x="533" y="183" font-size="8.5" fill="#a8b8cc">progress:</text>
  <rect x="533" y="187" width="158" height="6" rx="3" fill="#1e293b"/>
  <rect x="533" y="187" width="60" height="6" rx="3" fill="#22c55e" opacity="0.8"/>
  <text x="612" y="197" text-anchor="middle" font-size="8" fill="#22c55e">3 of 8 events replayed</text>

  <!-- Send panel hidden note -->
  <rect x="533" y="207" width="158" height="30" rx="4" fill="#0a0d14" stroke="#3b4a60" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="612" y="219" text-anchor="middle" font-size="8.5" fill="#3b4a60">Send panel hidden</text>
  <text x="612" y="230" text-anchor="middle" font-size="8" fill="#3b4a60">watching replay only</text>

  <text x="612" y="258" text-anchor="middle" font-size="8" fill="#3b4a60" font-style="italic">no live server required</text>

  <!-- ═══════════════════════════════════════
       BOTTOM: CAPTURES INFO STRIP
  ═══════════════════════════════════════ -->
  <rect x="1" y="285" width="698" height="136" rx="8" fill="#0a0d14" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="350" y="303" text-anchor="middle" font-size="10" font-weight="700" fill="#a8b8cc" letter-spacing="0.5">WHAT GETS CAPTURED IN EVERY RECORDING</text>
  <line x1="20" y1="308" x2="680" y2="308" stroke="#3b4a60" stroke-width="1"/>

  <!-- 3 feature columns -->
  <!-- Messages -->
  <rect x="14" y="316" width="208" height="96" rx="6" fill="#0d1520" stroke="#3b82f6" stroke-width="1.2"/>
  <rect x="14" y="316" width="208" height="24" rx="6" fill="#07101e"/>
  <rect x="14" y="328" width="208" height="12" fill="#07101e"/>
  <circle cx="27" cy="328" r="4" fill="#3b82f6" opacity="0.8"/>
  <text x="37" y="332" font-size="9.5" font-weight="700" fill="#3b82f6" letter-spacing="0.3">MESSAGES</text>
  <text x="22" y="352" font-size="9" fill="#f1f5f9">Direction</text>
  <text x="78" y="352" font-size="9" fill="#a8b8cc">sent ↑ or received ↓</text>
  <text x="22" y="368" font-size="9" fill="#f1f5f9">Payload</text>
  <text x="70" y="368" font-size="9" fill="#a8b8cc">full message body + size</text>
  <text x="22" y="384" font-size="9" fill="#f1f5f9">Timestamp</text>
  <text x="84" y="384" font-size="9" fill="#a8b8cc">ms since session start</text>
  <text x="22" y="402" font-size="9" fill="#f1f5f9">Frame type</text>
  <text x="84" y="402" font-size="9" fill="#a8b8cc">text or binary</text>

  <!-- State Changes -->
  <rect x="246" y="316" width="208" height="96" rx="6" fill="#0d1520" stroke="#f59e0b" stroke-width="1.2"/>
  <rect x="246" y="316" width="208" height="24" rx="6" fill="#1a1408"/>
  <rect x="246" y="328" width="208" height="12" fill="#1a1408"/>
  <circle cx="259" cy="328" r="4" fill="#f59e0b" opacity="0.8"/>
  <text x="269" y="332" font-size="9.5" font-weight="700" fill="#f59e0b" letter-spacing="0.3">STATE CHANGES</text>
  <text x="254" y="352" font-size="9" fill="#f1f5f9">connected</text>
  <text x="310" y="352" font-size="9" fill="#a8b8cc">URL + protocol recorded</text>
  <text x="254" y="368" font-size="9" fill="#f1f5f9">disconnected</text>
  <text x="318" y="368" font-size="9" fill="#a8b8cc">with close code + reason</text>
  <text x="254" y="384" font-size="9" fill="#f1f5f9">error events</text>
  <text x="314" y="384" font-size="9" fill="#a8b8cc">captured for debugging</text>

  <!-- Replay Fidelity -->
  <rect x="478" y="316" width="208" height="96" rx="6" fill="#0d1520" stroke="#22c55e" stroke-width="1.2"/>
  <rect x="478" y="316" width="208" height="24" rx="6" fill="#071e12"/>
  <rect x="478" y="328" width="208" height="12" fill="#071e12"/>
  <circle cx="491" cy="328" r="4" fill="#22c55e" opacity="0.8"/>
  <text x="501" y="332" font-size="9.5" font-weight="700" fill="#22c55e" letter-spacing="0.3">REPLAY FIDELITY</text>
  <text x="486" y="352" font-size="9" fill="#f1f5f9">1× speed</text>
  <text x="530" y="352" font-size="9" fill="#a8b8cc">exact original timing</text>
  <text x="486" y="368" font-size="9" fill="#f1f5f9">2× / 5× / 10×</text>
  <text x="548" y="368" font-size="9" fill="#a8b8cc">accelerated playback</text>
  <text x="486" y="384" font-size="9" fill="#f1f5f9">Max speed</text>
  <text x="536" y="384" font-size="9" fill="#a8b8cc">instant — all events at once</text>
  <text x="486" y="402" font-size="9" fill="#f1f5f9">no server</text>
  <text x="527" y="402" font-size="9" fill="#a8b8cc">works fully offline</text>
</svg>`,
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
      },
      action: async (ctx: DemoActionContext) => {
        // Keep the first step instructional and visible: connect + show toolbar.
        await ensureConnected(ctx);
        await ctx.delay(700);
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(700);
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
        const alreadyRecording = !!firstVisibleElement(WS.REC_STOP_BTN);
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
        const isRecording = !!firstVisibleElement(WS.REC_STOP_BTN);
        if (!isRecording) {
          await ensureNotReplaying(ctx);
          await ensureConnected(ctx);
          await ctx.click(WS.RIGHT_TAB_EVENTS);
          await ctx.delay(200);
          const startBtn = firstVisibleElement<HTMLElement>(WS.REC_START_BTN);
          if (startBtn) {
            startBtn.click();
            await ctx.delay(600);
          }
        }
        // Switch to Send tab and pre-fill the message
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(200);
        await ctx.fill(WS.MESSAGE_INPUT, '{"action":"demo","seq":1}');
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        // The message input clears after each send, so we must re-fill before every click.
        for (let i = 1; i <= 3; i++) {
          await ctx.fill(WS.MESSAGE_INPUT, `{"action":"demo","seq":${i}}`);
          await ctx.delay(150);
          await ctx.click(WS.SEND_BTN);
          await ctx.delay(600);
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
        'Clicking **■ Stop** ends the recording. RedfireForge saves the session as a JSON file that downloads automatically. The file contains metadata (URL, protocol, duration, message count) and the full array of timestamped events. You can share this file with teammates — they can replay it without needing the original server.',
      highlight: WS.REC_STOP_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Ensure recording is active so the Stop button is visible
        const isRecording = !!firstVisibleElement(WS.REC_STOP_BTN);
        if (!isRecording) {
          await ensureNotReplaying(ctx);
          await ensureConnected(ctx);
          await ctx.click(WS.RIGHT_TAB_EVENTS);
          await ctx.delay(200);
          const startBtn = firstVisibleElement<HTMLElement>(WS.REC_START_BTN);
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
        const playBtn = firstVisibleElement(WS.REPLAY_START_BTN);
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
        // By the time this step starts, the 4.9-second replay from rec-play may
        // have already completed. Ensure a replay is active and paused so the
        // ✕ Exit button remains visible throughout the entire reading phase.
        const exitBtn = firstVisibleElement(WS.REPLAY_EXIT);
        if (!exitBtn) {
          // Replay has auto-completed (or was never started).
          await ensureNotRecording(ctx);
          // After auto-completion, loadedRecording is cleared → Play button is gone.
          // Inject a fresh recording so Play reappears.
          let playBtn = firstVisibleElement<HTMLElement>(WS.REPLAY_START_BTN);
          if (!playBtn) {
            await injectRecordingFile(ctx);
            await ctx.delay(400);
            playBtn = firstVisibleElement<HTMLElement>(WS.REPLAY_START_BTN);
          }
          if (playBtn) {
            playBtn.click();
            // Wait for the replay bar to mount, then pause immediately.
            // We just started replay so it is guaranteed to be playing.
            await ctx.waitFor(WS.REPLAY_BAR);
            await ctx.delay(200);
            const pauseBtn = firstVisibleElement<HTMLElement>(WS.REPLAY_PLAYPAUSE);
            if (pauseBtn) {
              pauseBtn.click();
              await ctx.delay(300);
            }
          }
        } else {
          // Replay is still active from step 6. Pause if currently playing.
          // Use includes('▶') — the paused state — rather than exact '⏸' comparison
          // to avoid any Unicode encoding mismatch across source files.
          const playpauseBtn = firstVisibleElement<HTMLElement>(WS.REPLAY_PLAYPAUSE);
          if (playpauseBtn && !playpauseBtn.textContent?.includes('▶')) {
            playpauseBtn.click();
            await ctx.delay(300);
          }
        }
      },
      action: async (ctx: DemoActionContext) => {
        // Exit replay if still active (may have finished naturally in long demos)
        const exitBtn = firstVisibleElement<HTMLElement>(WS.REPLAY_EXIT);
        if (exitBtn) {
          await ctx.click(WS.REPLAY_EXIT);
          await ctx.delay(600);
        }
      },
    },
  ],
};
