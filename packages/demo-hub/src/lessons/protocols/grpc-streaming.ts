/**
 * Lesson GRPC-17: Streaming RPCs — All Four Patterns
 *
 * Covers all four gRPC streaming call types using echo.EchoService:
 *   grpc17-intro          — call-type badges + overview
 *   grpc17-server-select  — select ServerStream method
 *   grpc17-server-fill    — fill StreamRequest fields + start stream
 *   grpc17-server-status  — inspect message log + Ended status
 *   grpc17-client-select  — select ClientStream method
 *   grpc17-client-queue   — queue 3 pending messages
 *   grpc17-client-send    — start stream, send all, end
 *   grpc17-bidi-select    — select BidiStream method
 *   grpc17-bidi-exchange  — start bidi stream + interactive exchange
 *   grpc17-cancel         — cancel stream mid-flight
 *   grpc17-export         — export stream log as JSON
 */
import { GRPC } from '@shared/selectors';
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import {
  GRPC_DEMO_TARGET,
  GRPC_ECHO_SERVICE_SEL,
  GRPC_STREAM_MESSAGE,
  GRPC_STREAM_REPEAT_COUNT,
  GRPC_STREAM_INTERVAL_MS,
  GRPC_SERVER_STREAM_SEL,
  GRPC_CLIENT_STREAM_SEL,
  GRPC_BIDI_STREAM_SEL,
  cancelActiveStreamQuiet,
  closeGrpcSettingsDrawerQuiet,
  ensureGrpcStudioSubNavQuiet,
  ensureStreamingMethodSelected,
  fillServerStreamRequest,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  guardBidiStreamActiveQuiet,
  guardBidiStreamSelectedQuiet,
  guardClientStreamQueuedQuiet,
  guardClientStreamSelectedQuiet,
  guardGrpcReflectedQuiet,
  guardServerStreamExecutedQuiet,
  guardServerStreamFormQuiet,
  runClientStreamSendLifecycle,
  seedBidiStreamLogQuiet,
  spotlightAndPause,
  startAndExchangeBidiStream,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';

const GRPC17_ROSTER = getGrpcLessonRosterEntry('grpc-streaming')!;

const CLIENT_STREAM_QUEUE_MESSAGES = ['client-msg-1', 'client-msg-2', 'client-msg-3'] as const;

const CALL_TYPE_TABS = ['unary', 'server_streaming', 'client_streaming', 'bidi_streaming'] as const;

async function waitForStreamStatusText(
  ctx: Parameters<NonNullable<GrpcDemoLesson['steps'][number]['action']>>[0],
  expected: RegExp,
  timeoutMs = 3_000,
): Promise<boolean> {
  const maxIter = Math.ceil(timeoutMs / 200);
  for (let i = 0; i < maxIter; i++) {
    const statusText = document.querySelector<HTMLElement>(GRPC.STREAM_STATUS_BADGE)?.textContent ?? '';
    if (expected.test(statusText)) {
      return true;
    }
    await ctx.delay(200);
  }
  return false;
}

async function spotlightCallTypeBadges(
  ctx: Parameters<NonNullable<GrpcDemoLesson['steps'][number]['action']>>[0],
): Promise<void> {
  await spotlightAndPause(ctx, GRPC.CALL_TYPE_SELECTOR, 850);
  for (const tab of CALL_TYPE_TABS) {
    const tabSel = GRPC.CALL_TYPE_TAB(tab);
    if (document.querySelector(tabSel)) {
      await spotlightAndPause(ctx, tabSel, 650);
    }
  }
}

async function spotlightServerStreamComposer(
  ctx: Parameters<NonNullable<GrpcDemoLesson['steps'][number]['action']>>[0],
): Promise<void> {
  await spotlightAndPause(ctx, GRPC.REQUEST_TAB_FORM, 700);
  await spotlightAndPause(ctx, GRPC.PROTO_FIELD_INPUT('message'), 750);
  await spotlightAndPause(ctx, GRPC.PROTO_FIELD_INPUT('repeat_count'), 700);
  await spotlightAndPause(ctx, GRPC.PROTO_FIELD_INPUT('interval_ms'), 700);
}

export const grpcStreamingLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC17_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Walk through the three gRPC streaming patterns (server, client, bidirectional) using echo.EchoService, plus stream controls and cancel/export. Unary is introduced for context — live-demoed in the first gRPC lesson.',

  setup: grpcFirstCallSetup,
  cleanup: grpcFirstCallCleanup,

  grpc: buildGrpcContractMetaFromRoster(GRPC17_ROSTER),

  concept: {
    title: 'gRPC Streaming: Four Patterns',
    body: `gRPC supports four call types. Three use streaming; unary is the simple request–response pattern:

| Badge | Pattern | Data flow | Use case |
|---|---|---|---|
| **U** | Unary | 1 request → 1 response | REST-like RPCs, lookups |
| **SS** | Server streaming | 1 request → N responses | Feeds, progress events, large dataset reads |
| **CS** | Client streaming | N requests → 1 response | Batch uploads, aggregation |
| **BD** | Bidirectional | N requests ↔ N responses | Chat, real-time collaboration |

All four are available on **echo.EchoService** in the local Docker fixture on \`${GRPC_DEMO_TARGET}\`. This lesson live-demos **SS**, **CS**, and **BD** only.

**What you will do in this lesson:**
1. **Server streaming** — fill \`message\` and \`repeat_count: ${GRPC_STREAM_REPEAT_COUNT}\`, start the stream, and watch ${GRPC_STREAM_REPEAT_COUNT} messages arrive in the log.
2. **Client streaming** — queue ${3} messages in the pending panel, start the stream, flush with Send all, and end.
3. **Bidirectional** — start a bidi stream, send two messages, and read the server echoes interleaved in the log.
4. **Cancel** — stop the bidi stream mid-flight and observe the **Cancelled** badge.
5. **Export** — download the stream session as a JSON transcript.

The **stream status bar** shows lifecycle transitions: **Streaming** → **Ending…** → **Ended** (or **Cancelled**). The **message log** (↓ = inbound from server, ↑ = outbound from client) records every message in both directions.

**Quick troubleshooting checks:**
- If no methods appear, run **Reflect** and reselect \`echo.EchoService\`.
- If stream logs stay empty, confirm target is \`${GRPC_DEMO_TARGET}\` and click **Start** again.
- If a stream is stuck open, click **Cancel** before switching method.`,
    keyTerms: [
      {
        term: 'Server streaming',
        definition:
          'The server sends a sequence of messages after one client request. Ideal for feeds, large dataset reads, or progress updates. Finishes when the server closes the stream.',
      },
      {
        term: 'Client streaming',
        definition:
          'The client sends a sequence of messages; the server responds once after the client ends. Ideal for batch uploads or aggregation.',
      },
      {
        term: 'Bidirectional streaming',
        definition:
          'Both sides send messages independently over a single HTTP/2 stream. Ideal for real-time chat, collaborative editing, or ping-pong patterns.',
      },
      {
        term: 'Message log',
        definition:
          'The live pane showing every message in both directions: ↓ marks server-sent (inbound) messages, ↑ marks client-sent (outbound) messages.',
      },
      {
        term: 'Pending queue',
        definition:
          'A staging area for client streaming. Add messages before or after starting the stream. Click Send all to flush them through the open channel.',
      },
      {
        term: 'Stream status',
        definition:
          'Lifecycle badge in the status bar: Streaming (messages flowing), Ending… (client half-closed, waiting for server), Ended (both sides closed), Cancelled (stopped mid-flight), Error (transport failure).',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 460" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc3-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc3-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpc3-arr-o" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#f59e0b"/>
    </marker>
    <marker id="grpc3-arr-v" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#c084fc"/>
    </marker>
  </defs>

  <!-- Window chrome -->
  <rect x="1" y="1" width="698" height="288" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5"/>
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc">gRPC Studio — Streaming: Four Patterns</text>

  <!-- Panel: Unary (reference) -->
  <rect x="12" y="38" width="153" height="238" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <rect x="20" y="46" width="30" height="16" rx="8" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="35" y="57" text-anchor="middle" font-size="9" font-weight="700" fill="#93c5fd">U</text>
  <text x="60" y="57" font-size="9.5" fill="#a8b8cc">Unary</text>
  <line x1="30" y1="72" x2="153" y2="72" stroke="#1e293b"/>
  <text x="20" y="88" font-size="8" fill="#64748b">Client → Server</text>
  <line x1="30" y1="100" x2="145" y2="100" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#grpc3-arr)"/>
  <text x="88" y="96" text-anchor="middle" font-size="7.5" fill="#60a5fa">request</text>
  <line x1="145" y1="115" x2="30" y2="115" stroke="#22c55e" stroke-width="1.5" marker-end="url(#grpc3-arr-g)"/>
  <text x="88" y="111" text-anchor="middle" font-size="7.5" fill="#4ade80">response</text>
  <text x="20" y="136" font-size="7.5" fill="#475569">1 req → 1 resp</text>
  <text x="20" y="148" font-size="7.5" fill="#475569">simple lookups</text>
  <!-- Message log (empty for unary) -->
  <rect x="20" y="162" width="137" height="100" rx="3" fill="#0a1118" stroke="#1e293b"/>
  <text x="88" y="213" text-anchor="middle" font-size="8" fill="#334155">single body</text>
  <text x="88" y="225" text-anchor="middle" font-size="7" fill="#334155">in response panel</text>

  <!-- Panel: Server Streaming -->
  <rect x="175" y="38" width="153" height="238" rx="5" fill="#0f172a" stroke="#22c55e" stroke-width="1.2"/>
  <rect x="183" y="46" width="30" height="16" rx="8" fill="#052e16" stroke="#22c55e"/>
  <text x="198" y="57" text-anchor="middle" font-size="8" font-weight="700" fill="#4ade80">SS</text>
  <text x="222" y="57" font-size="9.5" fill="#a8b8cc">Server Stream</text>
  <line x1="183" y1="72" x2="320" y2="72" stroke="#1e293b"/>
  <text x="183" y="88" font-size="8" fill="#64748b">1 req → N resp</text>
  <line x1="193" y1="100" x2="308" y2="100" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#grpc3-arr)"/>
  <text x="250" y="96" text-anchor="middle" font-size="7.5" fill="#60a5fa">request (repeat_count=5)</text>
  <line x1="308" y1="112" x2="193" y2="112" stroke="#22c55e" stroke-width="1" marker-end="url(#grpc3-arr-g)"/>
  <line x1="308" y1="121" x2="193" y2="121" stroke="#22c55e" stroke-width="1" marker-end="url(#grpc3-arr-g)"/>
  <line x1="308" y1="130" x2="193" y2="130" stroke="#22c55e" stroke-width="1" marker-end="url(#grpc3-arr-g)"/>
  <text x="250" y="143" text-anchor="middle" font-size="7.5" fill="#4ade80">↓ msg ×5</text>
  <!-- Message log -->
  <rect x="183" y="155" width="137" height="107" rx="3" fill="#0a1118" stroke="#22c55e" stroke-width="0.8"/>
  <text x="191" y="168" font-size="7.5" fill="#4ade80">↓ stream-demo (1/5)</text>
  <text x="191" y="181" font-size="7.5" fill="#4ade80">↓ stream-demo (2/5)</text>
  <text x="191" y="194" font-size="7.5" fill="#4ade80">↓ stream-demo (3/5)</text>
  <text x="191" y="207" font-size="7.5" fill="#4ade80">↓ stream-demo (4/5)</text>
  <text x="191" y="220" font-size="7.5" fill="#4ade80">↓ stream-demo (5/5)</text>
  <rect x="183" y="232" width="137" height="18" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="0.8"/>
  <text x="251" y="244" text-anchor="middle" font-size="7.5" fill="#4ade80">Ended · 5 inbound</text>

  <!-- Panel: Client Streaming -->
  <rect x="338" y="38" width="153" height="238" rx="5" fill="#0f172a" stroke="#f59e0b" stroke-width="1.2"/>
  <rect x="346" y="46" width="30" height="16" rx="8" fill="#451a03" stroke="#f59e0b"/>
  <text x="361" y="57" text-anchor="middle" font-size="8" font-weight="700" fill="#fbbf24">CS</text>
  <text x="385" y="57" font-size="9.5" fill="#a8b8cc">Client Stream</text>
  <line x1="346" y1="72" x2="483" y2="72" stroke="#1e293b"/>
  <text x="346" y="88" font-size="8" fill="#64748b">N req → 1 resp</text>
  <line x1="356" y1="100" x2="471" y2="100" stroke="#f59e0b" stroke-width="1" marker-end="url(#grpc3-arr-o)"/>
  <line x1="356" y1="109" x2="471" y2="109" stroke="#f59e0b" stroke-width="1" marker-end="url(#grpc3-arr-o)"/>
  <line x1="356" y1="118" x2="471" y2="118" stroke="#f59e0b" stroke-width="1" marker-end="url(#grpc3-arr-o)"/>
  <text x="413" y="131" text-anchor="middle" font-size="7.5" fill="#fbbf24">↑ msg ×3</text>
  <line x1="471" y1="142" x2="356" y2="142" stroke="#22c55e" stroke-width="1.5" marker-end="url(#grpc3-arr-g)"/>
  <text x="413" y="138" text-anchor="middle" font-size="7.5" fill="#4ade80">aggregated response</text>
  <!-- Pending queue -->
  <rect x="346" y="155" width="137" height="107" rx="3" fill="#0a1118" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="354" y="168" font-size="7.5" fill="#fbbf24">Queue · 3 pending</text>
  <text x="354" y="181" font-size="7" fill="#94a3b8">#1 client-msg-1</text>
  <text x="354" y="193" font-size="7" fill="#94a3b8">#2 client-msg-2</text>
  <text x="354" y="205" font-size="7" fill="#94a3b8">#3 client-msg-3</text>
  <rect x="354" y="214" width="60" height="14" rx="3" fill="#451a03" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="384" y="223" text-anchor="middle" font-size="7" fill="#fbbf24">▶ Send all</text>
  <rect x="420" y="214" width="55" height="14" rx="3" fill="#1e293b" stroke="#334155"/>
  <text x="447" y="223" text-anchor="middle" font-size="7" fill="#94a3b8">End stream</text>
  <rect x="346" y="232" width="137" height="18" rx="3" fill="#1e293b" stroke="#334155"/>
  <text x="414" y="244" text-anchor="middle" font-size="7.5" fill="#94a3b8">Ended · 3 outbound</text>

  <!-- Panel: Bidirectional -->
  <rect x="501" y="38" width="186" height="238" rx="5" fill="#0f172a" stroke="#c084fc" stroke-width="1.2"/>
  <rect x="509" y="46" width="30" height="16" rx="8" fill="#1f1736" stroke="#c084fc"/>
  <text x="524" y="57" text-anchor="middle" font-size="8" font-weight="700" fill="#d8b4fe">BD</text>
  <text x="548" y="57" font-size="9.5" fill="#a8b8cc">Bidirectional</text>
  <line x1="509" y1="72" x2="679" y2="72" stroke="#1e293b"/>
  <text x="509" y="88" font-size="8" fill="#64748b">N req ↔ N resp</text>
  <line x1="519" y1="100" x2="634" y2="100" stroke="#c084fc" stroke-width="1" marker-end="url(#grpc3-arr-v)"/>
  <text x="576" y="96" text-anchor="middle" font-size="7" fill="#d8b4fe">↑ bidi-hello</text>
  <line x1="634" y1="110" x2="519" y2="110" stroke="#22c55e" stroke-width="1" marker-end="url(#grpc3-arr-g)"/>
  <text x="576" y="106" text-anchor="middle" font-size="7" fill="#4ade80">↓ echo: bidi-hello</text>
  <line x1="519" y1="122" x2="634" y2="122" stroke="#c084fc" stroke-width="1" marker-end="url(#grpc3-arr-v)"/>
  <text x="576" y="118" text-anchor="middle" font-size="7" fill="#d8b4fe">↑ bidi-world</text>
  <line x1="634" y1="132" x2="519" y2="132" stroke="#22c55e" stroke-width="1" marker-end="url(#grpc3-arr-g)"/>
  <text x="576" y="128" text-anchor="middle" font-size="7" fill="#4ade80">↓ echo: bidi-world</text>
  <line x1="519" y1="142" x2="634" y2="144" stroke="#ef4444" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="576" y="138" text-anchor="middle" font-size="7" fill="#f87171">— Cancel ✕</text>
  <!-- Log -->
  <rect x="509" y="155" width="168" height="97" rx="3" fill="#0a1118" stroke="#c084fc" stroke-width="0.8"/>
  <text x="517" y="168" font-size="7.5" fill="#c084fc">↑ bidi-hello</text>
  <text x="517" y="180" font-size="7.5" fill="#4ade80">↓ bidi-hello</text>
  <text x="517" y="192" font-size="7.5" fill="#c084fc">↑ bidi-world</text>
  <text x="517" y="204" font-size="7.5" fill="#4ade80">↓ bidi-world</text>
  <text x="517" y="216" font-size="7.5" fill="#f87171">× Cancelled</text>
  <text x="517" y="228" font-size="7" fill="#475569">↑ client  ↓ server</text>
  <rect x="509" y="254" width="168" height="18" rx="3" fill="#1f1736" stroke="#c084fc" stroke-width="0.8"/>
  <text x="593" y="266" text-anchor="middle" font-size="7.5" fill="#d8b4fe">Cancelled · Export log ↓</text>

  <!-- Step legend -->
  <text x="350" y="310" text-anchor="middle" font-size="11" fill="#a8b8cc">Lesson flow</text>

  <circle cx="84" cy="338" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="84" y="342" text-anchor="middle" font-size="9" fill="#3b82f6">1</text>
  <text x="84" y="358" text-anchor="middle" font-size="8" fill="#94a3b8">Intro +</text>
  <text x="84" y="369" text-anchor="middle" font-size="8" fill="#94a3b8">badges</text>
  <line x1="96" y1="338" x2="146" y2="338" stroke="#22c55e" marker-end="url(#grpc3-arr-g)"/>

  <circle cx="158" cy="338" r="11" fill="#052e16" stroke="#22c55e"/>
  <text x="158" y="342" text-anchor="middle" font-size="9" fill="#22c55e">2</text>
  <text x="158" y="358" text-anchor="middle" font-size="8" fill="#94a3b8">Server</text>
  <text x="158" y="369" text-anchor="middle" font-size="8" fill="#94a3b8">stream</text>
  <line x1="170" y1="338" x2="220" y2="338" stroke="#f59e0b" marker-end="url(#grpc3-arr-o)"/>

  <circle cx="232" cy="338" r="11" fill="#451a03" stroke="#f59e0b"/>
  <text x="232" y="342" text-anchor="middle" font-size="9" fill="#f59e0b">3</text>
  <text x="232" y="358" text-anchor="middle" font-size="8" fill="#94a3b8">Client</text>
  <text x="232" y="369" text-anchor="middle" font-size="8" fill="#94a3b8">stream</text>
  <line x1="244" y1="338" x2="294" y2="338" stroke="#c084fc" marker-end="url(#grpc3-arr-v)"/>

  <circle cx="306" cy="338" r="11" fill="#1f1736" stroke="#c084fc"/>
  <text x="306" y="342" text-anchor="middle" font-size="9" fill="#c084fc">4</text>
  <text x="306" y="358" text-anchor="middle" font-size="8" fill="#94a3b8">Bidi</text>
  <text x="306" y="369" text-anchor="middle" font-size="8" fill="#94a3b8">stream</text>
  <line x1="318" y1="338" x2="368" y2="338" stroke="#ef4444" marker-end="url(#grpc3-arr)"/>

  <circle cx="380" cy="338" r="11" fill="#450a0a" stroke="#ef4444"/>
  <text x="380" y="342" text-anchor="middle" font-size="9" fill="#ef4444">5</text>
  <text x="380" y="358" text-anchor="middle" font-size="8" fill="#94a3b8">Cancel</text>
  <line x1="392" y1="338" x2="442" y2="338" stroke="#3b82f6" marker-end="url(#grpc3-arr)"/>

  <circle cx="454" cy="338" r="11" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="454" y="342" text-anchor="middle" font-size="9" fill="#3b82f6">6</text>
  <text x="454" y="358" text-anchor="middle" font-size="8" fill="#94a3b8">Export</text>
  <text x="454" y="369" text-anchor="middle" font-size="8" fill="#94a3b8">log</text>
</svg>`,
  },

  steps: [
    // -------------------------------------------------------------------------
    // Step 1 — Intro: call type overview
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-intro',
      title: 'Four Streaming Patterns',
      description:
        'The call-type selector shows the four gRPC patterns side by side:\n\n' +
        '- **U** — unary: one request, one response (like HTTP)\n' +
        '- **SS** — server streaming: one request triggers a live feed of responses\n' +
        '- **CS** — client streaming: you send multiple messages; server responds once at the end\n' +
        '- **BD** — bidirectional: both sides stream messages concurrently over one HTTP/2 connection\n\n' +
        'gRPC defines **four call types** total; **three are streaming** (**SS**, **CS**, **BD**). ' +
        'This lesson live-demos those three on **echo.EchoService** at `localhost:50051`. ' +
        'Unary (**U**) appears in the selector for context — see the first gRPC lesson for a unary walkthrough.',
      highlight: GRPC.CALL_TYPE_SELECTOR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
        await ensureGrpcStudioSubNavQuiet(ctx);
        await guardGrpcReflectedQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, 800);
        await spotlightCallTypeBadges(ctx);
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 900);
        await spotlightAndPause(ctx, GRPC_ECHO_SERVICE_SEL, 750);
        await spotlightAndPause(ctx, GRPC.STREAM_PANEL, 850);
      },
      verify: GRPC.CALL_TYPE_SELECTOR,
    },

    // -------------------------------------------------------------------------
    // Step 2 — Server streaming: select method
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-server-select',
      title: 'Server Streaming: Select ServerStream',
      description:
        'Expand **echo.EchoService** in the Services panel and click **ServerStream** — badge **SS**. ' +
        'Once a method is selected, the call-type selector row from step 1 disappears — the streaming mode is now fixed by the schema. ' +
        'The panel switches to the **server streaming layout**: a **Start stream** button appears along with the message log area. ' +
        'The header reads **Server streaming RPC · echo.StreamRequest → echo.EchoResponse**.',
      highlight: GRPC_SERVER_STREAM_SEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcReflectedQuiet(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 800);
        await spotlightAndPause(ctx, GRPC_ECHO_SERVICE_SEL, 750);
        await spotlightAndPause(ctx, GRPC_SERVER_STREAM_SEL, 850);
        await ensureStreamingMethodSelected(ctx, 'ServerStream');
        await spotlightAndPause(ctx, GRPC.CALL_METHOD_NAME, 750);
        await spotlightAndPause(ctx, GRPC.METHOD_CALL_TYPE, 700);
        await spotlightAndPause(ctx, GRPC.STREAM_PANEL, 800);
        await spotlightAndPause(ctx, GRPC.STREAM_START_BTN, 900);
      },
      verify: GRPC.STREAM_START_BTN,
    },

    // -------------------------------------------------------------------------
    // Step 3 — Server streaming: fill form and start
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-server-fill',
      title: 'Server Streaming: Fill and Start',
      description:
        `Fill the request form: set **message** to \`${GRPC_STREAM_MESSAGE}\`, **repeat_count** to \`${GRPC_STREAM_REPEAT_COUNT}\`, and **interval_ms** to \`${GRPC_STREAM_INTERVAL_MS}\`. ` +
        `Then click **Start stream**. The server pushes **${GRPC_STREAM_REPEAT_COUNT} echo messages** back, one every ${GRPC_STREAM_INTERVAL_MS} ms. ` +
        'Watch them land **one by one** in the message log — each row shows **↓** (server → client), the payload, and a sequence number. ' +
        'The ↓/↑ direction legend in the log toolbar tells you which side sent each message.',
      highlight: GRPC.STREAM_MESSAGE_LOG,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardServerStreamFormQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightServerStreamComposer(ctx);
        await fillServerStreamRequest(ctx);
        await ctx.delay(500);
        await spotlightAndPause(ctx, GRPC.STREAM_START_BTN, 850);
        const startBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_START_BTN);
        if (startBtn && !startBtn.disabled) {
          await ctx.click(GRPC.STREAM_START_BTN);
        }
        await spotlightAndPause(ctx, GRPC.STREAM_MESSAGE_LOG, 900);
        try {
          await ctx.waitFor(GRPC.STREAM_LOG_LIST, 4_000);
        } catch {
          // Stream log may render asynchronously; proceed anyway.
        }
        if (document.querySelector(GRPC.STREAM_DIRECTION_LEGEND)) {
          await spotlightAndPause(ctx, GRPC.STREAM_DIRECTION_LEGEND, 750);
        }
        await spotlightAndPause(ctx, GRPC.STREAM_LOG_LIST, 1_500);
      },
      verify: GRPC.STREAM_MESSAGE_LOG,
    },

    // -------------------------------------------------------------------------
    // Step 4 — Server streaming: read status
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-server-status',
      title: 'Server Streaming: Ended Status',
      description:
        'Look at the **stream status bar** above the message log. ' +
        'While messages were arriving the badge showed **Streaming**; now that the server has sent all ' +
        `${GRPC_STREAM_REPEAT_COUNT} messages and closed its side it reads **Ended**. ` +
        'The **↓ inbound count chip** shows the total received. ' +
        'This is the defining trait of server streaming: the client sends nothing after the initial request — ' +
        'data flows strictly one-way, server → client, until the server decides it is done.',
      highlight: GRPC.STREAM_STATUS_BAR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardServerStreamExecutedQuiet(ctx);
        await waitForStreamStatusText(ctx, /(finished|ended|complete)/i, 5_000);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.STREAM_STATUS_BAR, 850);
        await spotlightAndPause(ctx, GRPC.STREAM_STATUS_BADGE, 900);
        if (document.querySelector(GRPC.STREAM_INBOUND_COUNT)) {
          await spotlightAndPause(ctx, GRPC.STREAM_INBOUND_COUNT, 800);
        }
        await spotlightAndPause(ctx, GRPC.STREAM_MESSAGE_LOG, 850);
        await spotlightAndPause(ctx, GRPC.STREAM_LOG_LIST, 950);
        await waitForStreamStatusText(ctx, /(finished|ended|complete)/i, 2_000);
      },
      verify: GRPC.STREAM_STATUS_BAR,
    },

    // -------------------------------------------------------------------------
    // Step 5 — Client streaming: select method
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-client-select',
      title: 'Client Streaming: Select ClientStream',
      description:
        'Click **ClientStream** — badge **CS** — in the Service Explorer. ' +
        'The call panel switches to the **client streaming layout**: a **Pending messages** panel on the left with **+ Add to queue**, **Send all**, and **End stream** controls grouped together. ' +
        'Client streaming is the inverse of server streaming — you send multiple messages; the server accumulates them and replies **once** when you signal end-of-stream. ' +
        'The pending queue lets you stage messages locally before the stream even opens.',
      highlight: GRPC_CLIENT_STREAM_SEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcReflectedQuiet(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 800);
        await spotlightAndPause(ctx, GRPC_CLIENT_STREAM_SEL, 850);
        await ensureStreamingMethodSelected(ctx, 'ClientStream');
        await spotlightAndPause(ctx, GRPC.CALL_METHOD_NAME, 750);
        await spotlightAndPause(ctx, GRPC.STREAM_PENDING_PANEL, 850);
        await spotlightAndPause(ctx, GRPC.STREAM_ADD_QUEUE_BTN, 900);
      },
      verify: GRPC.STREAM_ADD_QUEUE_BTN,
    },

    // -------------------------------------------------------------------------
    // Step 6 — Client streaming: queue messages
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-client-queue',
      title: 'Client Streaming: Queue Three Messages',
      description:
        'Type each value in the **message** field, then click **+ Add to queue** at the bottom of the **Pending messages** panel:\n\n' +
        '1. `client-msg-1` → Add to queue\n' +
        '2. `client-msg-2` → Add to queue\n' +
        '3. `client-msg-3` → Add to queue\n\n' +
        'The **3 queued** badge in the panel header updates as items are staged. ' +
        'All three entries appear in the **Pending messages** panel with an index and payload preview. ' +
        'You can remove any item before opening the stream. ' +
        'The queue keeps your messages staged until you are ready to flush them.',
      highlight: GRPC.STREAM_PENDING_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardClientStreamSelectedQuiet(ctx);
      },
      action: async (ctx) => {
        if (document.querySelector(GRPC.STREAM_PENDING_ITEM(0))) {
          await spotlightAndPause(ctx, GRPC.STREAM_PENDING_PANEL, 850);
          await spotlightAndPause(ctx, GRPC.STREAM_PENDING_LIST, 800);
          if (document.querySelector(GRPC.STREAM_PENDING_CHIP)) {
            await spotlightAndPause(ctx, GRPC.STREAM_PENDING_CHIP, 750);
          }
          return;
        }

        await spotlightAndPause(ctx, GRPC.PROTO_FIELD_INPUT('message'), 750);
        await spotlightAndPause(ctx, GRPC.STREAM_ADD_QUEUE_BTN, 800);

        for (const msg of CLIENT_STREAM_QUEUE_MESSAGES) {
          await ctx.fill(GRPC.PROTO_FIELD_INPUT('message'), msg);
          await ctx.delay(450);
          await ctx.click(GRPC.STREAM_ADD_QUEUE_BTN);
          await ctx.delay(500);
        }

        await spotlightAndPause(ctx, GRPC.STREAM_PENDING_PANEL, 850);
        await spotlightAndPause(ctx, GRPC.STREAM_PENDING_LIST, 800);
        if (document.querySelector(GRPC.STREAM_PENDING_CHIP)) {
          await spotlightAndPause(ctx, GRPC.STREAM_PENDING_CHIP, 800);
        }
      },
      verify: GRPC.STREAM_PENDING_PANEL,
    },

    // -------------------------------------------------------------------------
    // Step 7 — Client streaming: start, send all, end
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-client-send',
      title: 'Client Streaming: Start, Send All, End',
      description:
        'Three controls drive the full client stream lifecycle. Watch the spotlight ' +
        'step through each one **in order** — it pauses on each control so you can ' +
        'follow along:\n\n' +
        '1. **Start stream** — opens the HTTP/2 channel; the server waits for your messages.\n' +
        '2. **▶ Send all** — flushes all 3 staged messages at once. Watch three **↑** entries appear in the log.\n' +
        '3. **End stream** — signals half-close (client is done writing). The server returns one aggregated echo and both sides close.\n\n' +
        'The status bar walks through **Streaming → Ending… → Ended**. The log ends with 3 outbound (↑) and 1 inbound (↓).',
      highlight: GRPC.STREAM_PENDING_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardClientStreamQueuedQuiet(ctx);
        await cancelActiveStreamQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.STREAM_PENDING_PANEL, 800);
        await runClientStreamSendLifecycle(ctx);
        await spotlightAndPause(ctx, GRPC.STREAM_MESSAGE_LOG, 850);
        await spotlightAndPause(ctx, GRPC.STREAM_STATUS_BAR, 850);
        await spotlightAndPause(ctx, GRPC.STREAM_STATUS_BADGE, 900);
        await waitForStreamStatusText(ctx, /(finished|ended|complete)/i, 2_600);
      },
      verify: GRPC.STREAM_STATUS_BAR,
    },

    // -------------------------------------------------------------------------
    // Step 8 — Bidi streaming: select method
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-bidi-select',
      title: 'Bidirectional: Select BidiStream',
      description:
        'Click **BidiStream** — badge **BD** — in the Service Explorer. ' +
        'The call panel shows a **message compose area** (type + Send message) alongside the live message log. ' +
        'Bidirectional streaming is the most powerful pattern: **both client and server stream messages independently** over the same persistent HTTP/2 connection. ' +
        'This enables real-time chat, live collaboration feeds, and request-response ping-pong — without opening a new connection for each exchange.',
      highlight: GRPC_BIDI_STREAM_SEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcReflectedQuiet(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 800);
        await spotlightAndPause(ctx, GRPC_BIDI_STREAM_SEL, 850);
        await ensureStreamingMethodSelected(ctx, 'BidiStream');
        await spotlightAndPause(ctx, GRPC.CALL_METHOD_NAME, 750);
        await spotlightAndPause(ctx, GRPC.PROTO_FIELD_INPUT('message'), 750);
        await spotlightAndPause(ctx, GRPC.STREAM_SEND_MESSAGE_BTN, 800);
        await spotlightAndPause(ctx, GRPC.STREAM_MESSAGE_LOG, 850);
        await spotlightAndPause(ctx, GRPC.STREAM_START_BTN, 900);
      },
      verify: GRPC.STREAM_START_BTN,
    },

    // -------------------------------------------------------------------------
    // Step 9 — Bidi streaming: interactive exchange
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-bidi-exchange',
      title: 'Bidirectional: Interactive Exchange',
      description:
        'Click **Start stream** to open the bidi channel. Compose each message in the **Form Input** field on the left, then click **↑ Send message** in the action bar directly below the form:\n\n' +
        '1. Type `bidi-hello` → **↑ Send message** — the server echoes it back as a **↓** entry immediately.\n' +
        '2. Type `bidi-world` → **↑ Send message** — another echo arrives.\n\n' +
        'When finished gracefully, click **End stream** (same bar). Use **Cancel stream** in the top send bar only to abort mid-flight.\n\n' +
        'Watch the **message log**: ↑ rows are your sends, ↓ rows are the server echoes, interleaved in real time. ' +
        'This is the ping-pong pattern — both sides talking over one persistent HTTP/2 stream.',
      highlight: GRPC.STREAM_MESSAGE_LOG,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardBidiStreamSelectedQuiet(ctx);
      },
      action: async (ctx) => {
        await startAndExchangeBidiStream(ctx);
        if (document.querySelector(GRPC.STREAM_DIRECTION_LEGEND)) {
          await spotlightAndPause(ctx, GRPC.STREAM_DIRECTION_LEGEND, 750);
        }
        await spotlightAndPause(ctx, GRPC.STREAM_MESSAGE_LOG, 900);
        await spotlightAndPause(ctx, GRPC.STREAM_LOG_LIST, 1_000);
      },
      verify: GRPC.STREAM_MESSAGE_LOG,
    },

    // -------------------------------------------------------------------------
    // Step 10 — Cancel mid-stream
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-cancel',
      title: 'Cancel Mid-Stream',
      description:
        'The bidi stream is still open. Click **Cancel** — gRPC sends an HTTP/2 **RST_STREAM** frame that immediately tells the server to stop. ' +
        'The status badge transitions to **Cancelled**. ' +
        'This is safe and instant: unlike closing a TCP socket, RST_STREAM is protocol-level — the server handles it cleanly and releases resources right away. ' +
        'Use Cancel any time you need to abort a long-running or stale stream.',
      highlight: GRPC.STREAM_CANCEL_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardBidiStreamActiveQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.STREAM_CANCEL_BTN, 900);
        const cancelBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_CANCEL_BTN);
        if (cancelBtn && !cancelBtn.disabled) {
          await ctx.click(GRPC.STREAM_CANCEL_BTN);
        }
        await spotlightAndPause(ctx, GRPC.STREAM_STATUS_BAR, 850);
        await spotlightAndPause(ctx, GRPC.STREAM_STATUS_BADGE, 950);
        await waitForStreamStatusText(ctx, /(cancelled|canceled)/i, 2_400);
      },
      verify: GRPC.STREAM_STATUS_BAR,
    },

    // -------------------------------------------------------------------------
    // Step 11 — Export log
    // -------------------------------------------------------------------------
    {
      id: 'grpc17-export',
      title: 'Export the Stream Log',
      description:
        'Click **Export log** in the message log toolbar. ' +
        'RedfireForge downloads a structured JSON file — an array of entries each containing **direction** (inbound/outbound), **payload**, and **timestamp**. ' +
        'The transcript covers the entire session: every ↑ send, every ↓ echo, and the final Cancelled status. ' +
        'Use it for regression tests, sharing stream behavior without live server access, or feeding raw payloads into other tools.',
      highlight: GRPC.STREAM_EXPORT_LOG_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardBidiStreamSelectedQuiet(ctx);
        if (!document.querySelector(GRPC.STREAM_LOG_LIST)) {
          await seedBidiStreamLogQuiet(ctx);
          await cancelActiveStreamQuiet(ctx);
        }
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.STREAM_MESSAGE_LOG, 800);
        await spotlightAndPause(ctx, GRPC.STREAM_LOG_LIST, 850);
        await spotlightAndPause(ctx, GRPC.STREAM_EXPORT_LOG_BTN, 900);
        const exportBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_EXPORT_LOG_BTN);
        if (exportBtn && !exportBtn.disabled) {
          await ctx.click(GRPC.STREAM_EXPORT_LOG_BTN);
        }
        await ctx.delay(800);
      },
      verify: GRPC.STREAM_EXPORT_LOG_BTN,
    },
  ],
};
