/** Lesson GRPC-1: Your First gRPC Call — target, reflect, unary invoke, response, history */
import { GRPC } from '@shared/selectors';
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import {
  GRPC_DEMO_MESSAGE,
  GRPC_DEMO_TARGET,
  closeGrpcSettingsDrawerQuiet,
  ensureEchoMethodSelected,
  ensureGrpcReflected,
  ensureGrpcRequestFormTabQuiet,
  ensureGrpcTarget,
  ensureUnaryExecuted,
  fillGrpcEchoMessage,
  grpcEchoComposerFieldSelector,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  guardEchoMethodQuiet,
  guardGrpcReflectedQuiet,
  guardGrpcTargetQuiet,
  guardUnaryExecutedQuiet,
  isGrpcHybridComposerActive,
  openFirstGrpcHistoryEntry,
  openGrpcHistoryPanelQuiet,
  spotlightAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';

const GRPC1_ROSTER = getGrpcLessonRosterEntry('grpc-first-call')!;
const GRPC_ECHO_METHOD_SEL = GRPC.METHOD('echo.EchoService', 'Echo');

async function spotlightEchoComposer(ctx: Parameters<typeof spotlightAndPause>[0]): Promise<void> {
  await spotlightAndPause(ctx, GRPC.REQUEST_TAB_FORM, 750);
  if (isGrpcHybridComposerActive()) {
    await spotlightAndPause(ctx, GRPC.REQUEST_JSON_COMPACT, 800);
    await spotlightAndPause(ctx, GRPC.REQUEST_JSON, 900);
  } else {
    await spotlightAndPause(ctx, GRPC.PROTO_FORM, 750);
    await spotlightAndPause(ctx, GRPC.PROTO_FIELD_INPUT_MESSAGE, 900);
  }
}

export const grpcFirstCallLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC1_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Set a gRPC target, discover RPCs with reflection, execute a unary Echo call, inspect response metadata, and confirm the invocation in History.',

  setup: (ctx) => grpcFirstCallSetup(ctx, { resetSchemaDrafts: false }),
  cleanup: grpcFirstCallCleanup,

  grpc: buildGrpcContractMetaFromRoster(GRPC1_ROSTER),

  concept: {
    title: 'gRPC in RedfireForge',
    body: `**gRPC Studio** is RedfireForge's workspace for typed RPC calls over HTTP/2. Instead of REST-style URLs and verbs, gRPC uses **services** and **methods** from Protocol Buffers.

**What you will do in this lesson:**
1. **Target** — set the server address (\`${GRPC_DEMO_TARGET}\`) in the connection bar and confirm target validation.
2. **Reflect** — pull descriptors via **gRPC reflection** so Service Explorer can list services and methods without local .proto files.
3. **Select + Fill** — open **echo.EchoService / Echo** (unary) and populate the request on the **Form Input** tab.
4. **Invoke + Inspect** — send the call, then read status, timing, body, and where to look for headers/trailers.
5. **History** — verify the invocation is persisted for replay and troubleshooting.

This lesson uses the local Docker echo server on **50051** and the Express gRPC proxy on **3001**. If reflection fails, check prerequisite health endpoints, then retry **Reflect**.`,
    keyTerms: [
      {
        term: 'Unary RPC',
        definition:
          'A single request → single response call. The simplest gRPC pattern — like a function call over the network. Echo in this lesson is unary.',
      },
      {
        term: 'Server reflection',
        definition:
          'A built-in gRPC API that returns the server\'s protobuf descriptors at runtime. RedfireForge uses it to populate the Service Explorer without local .proto files.',
      },
      {
        term: 'Service / Method',
        definition:
          'gRPC organizes RPCs as methods on services (e.g. echo.EchoService.Echo). The explorer tree mirrors that hierarchy.',
      },
      {
        term: 'Form Input',
        definition:
          'The schema-driven request composer on the call panel. Unary methods may show compact JSON or typed proto fields depending on your workspace mode.',
      },
      {
        term: 'History',
        definition:
          'An auto-populated log of past invocations with target, method, request body, and response — replayable from the History panel.',
      },
      {
        term: 'Session settings',
        definition:
          'The gear button in the connection row opens per-tab gRPC session settings (TLS, auth, call options, and transport controls) without leaving Studio.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 430" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc1-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc1-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
  </defs>

  <rect x="1" y="1" width="698" height="282" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5"/>
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc">gRPC Studio - First Unary Call</text>

  <rect x="1" y="31" width="698" height="40" fill="#0f172a"/>
  <rect x="12" y="39" width="230" height="24" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="22" y="55" font-family="monospace" font-size="10" fill="#f1f5f9">${GRPC_DEMO_TARGET}</text>
  <circle cx="242" cy="39" r="8" fill="#3b82f6"/><text x="242" y="43" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">1</text>
  <rect x="255" y="40" width="76" height="22" rx="11" fill="#052e16" stroke="#22c55e" stroke-width="1"/>
  <text x="293" y="55" text-anchor="middle" font-size="9" fill="#22c55e">Target OK</text>
  <rect x="340" y="40" width="74" height="22" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1"/>
  <text x="377" y="55" text-anchor="middle" font-size="10" fill="#3b82f6">Reflect</text>
  <circle cx="414" cy="39" r="8" fill="#3b82f6"/><text x="414" y="43" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">2</text>
  <rect x="423" y="40" width="58" height="22" rx="4" fill="#3b82f6"/>
  <text x="452" y="55" text-anchor="middle" font-size="10" fill="#fff">Send</text>
  <circle cx="481" cy="39" r="8" fill="#3b82f6"/><text x="481" y="43" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">4</text>

  <rect x="12" y="84" width="205" height="188" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="24" y="103" font-size="10" fill="#a8b8cc">Service Explorer (reflected)</text>
  <rect x="24" y="113" width="180" height="146" rx="4" fill="#0a1118" stroke="#334155"/>
  <text x="35" y="132" font-size="9.5" fill="#22d3ee">echo.EchoService</text>
  <text x="45" y="149" font-size="9" fill="#f1f5f9">Echo (Unary)</text>
  <text x="45" y="166" font-size="8.5" fill="#64748b">ServerStream</text>
  <text x="45" y="182" font-size="8.5" fill="#64748b">ClientStream</text>
  <text x="45" y="198" font-size="8.5" fill="#64748b">BidiStream</text>
  <circle cx="198" cy="149" r="8" fill="#3b82f6"/><text x="198" y="153" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">3</text>

  <rect x="229" y="84" width="227" height="188" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="241" y="103" font-size="10" fill="#a8b8cc">Call Panel</text>
  <rect x="241" y="113" width="203" height="65" rx="4" fill="#0a1118" stroke="#334155"/>
  <text x="252" y="132" font-size="9" fill="#a8b8cc">message</text>
  <text x="252" y="150" font-family="monospace" font-size="9" fill="#4ade80">"${GRPC_DEMO_MESSAGE}"</text>
  <rect x="241" y="184" width="203" height="75" rx="4" fill="#0a1118" stroke="#22c55e" stroke-width="1"/>
  <text x="252" y="203" font-size="9" fill="#22c55e">Status: OK</text>
  <text x="252" y="220" font-size="9" fill="#a8b8cc">Duration: ~8ms</text>
  <text x="252" y="237" font-family="monospace" font-size="8.5" fill="#a8b8cc">{ "message": "Hello from gRPC Studio" }</text>

  <rect x="468" y="84" width="220" height="188" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="480" y="103" font-size="10" fill="#a8b8cc">Transport + Persistence</text>
  <rect x="480" y="113" width="94" height="58" rx="4" fill="#0a1118" stroke="#3b82f6"/>
  <text x="527" y="134" text-anchor="middle" font-size="9" fill="#3b82f6">Express</text>
  <text x="527" y="148" text-anchor="middle" font-size="9" fill="#3b82f6">gRPC Proxy</text>
  <rect x="592" y="113" width="84" height="58" rx="4" fill="#0a1118" stroke="#22c55e"/>
  <text x="634" y="134" text-anchor="middle" font-size="9" fill="#22c55e">Echo Server</text>
  <text x="634" y="148" text-anchor="middle" font-size="8.5" fill="#22c55e">localhost:50051</text>
  <rect x="480" y="184" width="196" height="75" rx="4" fill="#0a1118" stroke="#334155"/>
  <text x="492" y="204" font-size="9" fill="#a8b8cc">History row</text>
  <text x="492" y="220" font-size="8.5" fill="#cbd5e1">target: localhost:50051</text>
  <text x="492" y="236" font-size="8.5" fill="#cbd5e1">method: echo.EchoService/Echo</text>
  <text x="492" y="252" font-size="8.5" fill="#cbd5e1">status: OK</text>
  <circle cx="666" cy="184" r="8" fill="#22c55e"/><text x="666" y="188" text-anchor="middle" font-size="9" font-weight="700" fill="#052e16">5</text>

  <line x1="415" y1="59" x2="120" y2="120" stroke="#3b82f6" stroke-width="1.2" stroke-dasharray="3,2" marker-end="url(#grpc1-arr)"/>
  <line x1="204" y1="149" x2="240" y2="149" stroke="#3b82f6" stroke-width="1.2" marker-end="url(#grpc1-arr)"/>
  <line x1="445" y1="146" x2="480" y2="142" stroke="#3b82f6" stroke-width="1.2" marker-end="url(#grpc1-arr)"/>
  <line x1="575" y1="142" x2="592" y2="142" stroke="#22c55e" stroke-width="1.2" marker-end="url(#grpc1-arr-g)"/>
  <line x1="634" y1="171" x2="634" y2="184" stroke="#22c55e" stroke-width="1.2" marker-end="url(#grpc1-arr-g)"/>

  <text x="350" y="317" text-anchor="middle" font-size="11" fill="#a8b8cc">First-call lifecycle</text>
  <circle cx="120" cy="344" r="13" fill="#1e3a5f" stroke="#3b82f6"/><text x="120" y="348" text-anchor="middle" font-size="10" fill="#3b82f6">1</text>
  <text x="120" y="366" text-anchor="middle" font-size="9" fill="#cbd5e1">Set target</text>
  <line x1="134" y1="344" x2="178" y2="344" stroke="#3b82f6" marker-end="url(#grpc1-arr)"/>

  <circle cx="192" cy="344" r="13" fill="#1e3a5f" stroke="#3b82f6"/><text x="192" y="348" text-anchor="middle" font-size="10" fill="#3b82f6">2</text>
  <text x="192" y="366" text-anchor="middle" font-size="9" fill="#cbd5e1">Reflect</text>
  <line x1="206" y1="344" x2="250" y2="344" stroke="#3b82f6" marker-end="url(#grpc1-arr)"/>

  <circle cx="264" cy="344" r="13" fill="#1e3a5f" stroke="#3b82f6"/><text x="264" y="348" text-anchor="middle" font-size="10" fill="#3b82f6">3</text>
  <text x="264" y="366" text-anchor="middle" font-size="9" fill="#cbd5e1">Open Echo</text>
  <line x1="278" y1="344" x2="322" y2="344" stroke="#3b82f6" marker-end="url(#grpc1-arr)"/>

  <circle cx="336" cy="344" r="13" fill="#1e3a5f" stroke="#3b82f6"/><text x="336" y="348" text-anchor="middle" font-size="10" fill="#3b82f6">4</text>
  <text x="336" y="366" text-anchor="middle" font-size="9" fill="#cbd5e1">Send call</text>
  <line x1="350" y1="344" x2="394" y2="344" stroke="#22c55e" marker-end="url(#grpc1-arr-g)"/>

  <circle cx="408" cy="344" r="13" fill="#052e16" stroke="#22c55e"/><text x="408" y="348" text-anchor="middle" font-size="10" fill="#22c55e">5</text>
  <text x="408" y="366" text-anchor="middle" font-size="9" fill="#cbd5e1">Inspect + history</text>
</svg>`,
  },

  steps: [
    {
      id: 'grpc1-intro',
      title: 'gRPC Studio',
      description:
        'Welcome to **gRPC Studio**. This lesson walks three regions: the **connection row** (target + Reflect + Send), the **Service Explorer** on the left, and the **call workspace** on the right where **Form Input** and the response live.',
      highlight: GRPC.CONNECTION_BAR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, 850);
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 900);
        await spotlightAndPause(ctx, GRPC.CALL_PANEL, 900);
      },
    },

    {
      id: 'grpc1-target',
      title: 'Set the Server Target',
      description:
        `Type \`${GRPC_DEMO_TARGET}\` into the **target** field in the connection row. ` +
        'Watch the field fill, then pause on the green **Target OK** badge so the address is validated before moving on.',
      highlight: GRPC.TARGET_INPUT,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await ensureGrpcTarget(ctx);
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 800);
        await spotlightAndPause(ctx, GRPC.TARGET_STATUS_OK, 900);
      },
      verify: GRPC.TARGET_STATUS_OK,
    },

    {
      id: 'grpc1-reflect',
      title: 'Discover Services with Reflection',
      description:
        'Click **Reflect** to query the server\'s reflection API. RedfireForge downloads every service and method descriptor and populates the **Service Explorer** tree. ' +
        'You should see **echo.EchoService** with unary **Echo** and the streaming methods listed beneath it.',
      highlight: GRPC.REFLECT_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcTargetQuiet(ctx);
      },
      action: async (ctx) => {
        await ensureGrpcReflected(ctx);
        await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 750);
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 900);
        await spotlightAndPause(ctx, GRPC.EXPLORER_TREE, 850);
        await spotlightAndPause(ctx, GRPC_ECHO_METHOD_SEL, 900);
      },
      verify: GRPC.EXPLORER_TREE,
    },

    {
      id: 'grpc1-select-method',
      title: 'Select the Echo Method',
      description:
        'Expand **echo.EchoService** if needed, then click **Echo** — a **Unary** RPC (badge **U**). ' +
        'The **Form Input** tab opens the request composer for this method. Watch the method name, the **Form Input** tab, then the editable **message** field (typed row or compact JSON).',
      highlight: GRPC_ECHO_METHOD_SEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcReflectedQuiet(ctx);
      },
      action: async (ctx) => {
        await ensureEchoMethodSelected(ctx);
        await spotlightAndPause(ctx, GRPC_ECHO_METHOD_SEL, 750);
        await spotlightAndPause(ctx, GRPC.CALL_METHOD_NAME, 800);
        await spotlightEchoComposer(ctx);
      },
      verify: GRPC.REQUEST_FORM_SCROLL,
    },

    {
      id: 'grpc1-fill-message',
      title: 'Fill the Request Message',
      description:
        `Enter \`${GRPC_DEMO_MESSAGE}\` in the **message** field on **Form Input**. ` +
        'In **Compact** density, Form Input may show compact JSON (`"message": "..."`); in **Comfortable** density, it shows typed fields. Both stay schema-synced.',
      highlight: GRPC.REQUEST_FORM_SCROLL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardEchoMethodQuiet(ctx);
      },
      action: async (ctx) => {
        await ensureGrpcRequestFormTabQuiet(ctx);
        // The composer was already introduced in the previous step, so this step
        // stays on a single focal target: the highlighted Form Input box. Fill the
        // message inside it and pause — no competing inner spotlight rings that
        // would flash "other parts" while the step's box keeps showing.
        await fillGrpcEchoMessage(ctx, GRPC_DEMO_MESSAGE);
        await ctx.delay(900);
      },
    },

    {
      id: 'grpc1-send',
      title: 'Send the Unary Call',
      description:
        'Click **Send** to invoke **echo.EchoService/Echo**. RedfireForge routes the call through the Express proxy (browser mode) to the Docker server. ' +
        'Pause on **Send**, then shift to **OK** status and the echoed JSON body when the response arrives.',
      highlight: GRPC.SEND_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardEchoMethodQuiet(ctx);
        const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          grpcEchoComposerFieldSelector(),
        );
        const expected = isGrpcHybridComposerActive()
          ? JSON.stringify({ message: GRPC_DEMO_MESSAGE }, null, 2).trim()
          : GRPC_DEMO_MESSAGE;
        if (!field?.value.trim()) {
          await fillGrpcEchoMessage(ctx, GRPC_DEMO_MESSAGE);
        } else if (field.value.trim() !== expected) {
          await fillGrpcEchoMessage(ctx, GRPC_DEMO_MESSAGE);
        }
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.SEND_BTN, 800);
        await ensureUnaryExecuted(ctx);
        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 800);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 950);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    {
      id: 'grpc1-response',
      title: 'Read the Response',
      description:
        `The response body should contain your message echoed back: \`"${GRPC_DEMO_MESSAGE}"\`. ` +
        'Check the status line for **OK** and duration. Then open **Headers** and **Trailers** so you know where transport metadata lives.',
      highlight: GRPC.RESPONSE_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardUnaryExecutedQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(GRPC.RESPONSE_BODY, 8_000);
        await spotlightAndPause(ctx, GRPC.RESPONSE_HEADER, 750);
        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 850);
        await spotlightAndPause(ctx, GRPC.RESPONSE_DURATION, 750);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 950);
        await spotlightAndPause(ctx, GRPC.RESPONSE_TAB_HEADERS, 700);
        await spotlightAndPause(ctx, GRPC.RESPONSE_HEADERS, 800);
        await spotlightAndPause(ctx, GRPC.RESPONSE_TAB_TRAILERS, 700);
        await spotlightAndPause(ctx, GRPC.RESPONSE_TRAILERS, 800);
      },
    },

    {
      id: 'grpc1-history-tab',
      title: 'Open Call History',
      description:
        'Switch to the **Call History** sub-nav. Pause on the tab label, click it, then pause on the history list so viewers see where replay begins.',
      highlight: GRPC.SUB_NAV_HISTORY,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardUnaryExecutedQuiet(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(GRPC.SUB_NAV_HISTORY, 8_000);
        await spotlightAndPause(ctx, GRPC.SUB_NAV_HISTORY, 800);
        const historyBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_HISTORY);
        if (historyBtn && historyBtn.getAttribute('aria-selected') !== 'true') {
          historyBtn.click();
          await ctx.delay(400);
        }
        await ctx.waitFor(GRPC.HISTORY_PANEL, 5_000);
        await spotlightAndPause(ctx, GRPC.HISTORY_PANEL, 850);
        await spotlightAndPause(ctx, GRPC.HISTORY_LIST, 800);
      },
      verify: GRPC.HISTORY_PANEL,
    },

    {
      id: 'grpc1-history',
      title: 'Replay from History',
      description:
        'Click the latest **echo.EchoService/Echo** row in the History list. Pause on **Replay**, then click it to restore the saved request back into Studio.',
      highlight: GRPC.HISTORY_REPLAY_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        if (!document.querySelector(GRPC.HISTORY_REPLAY_BTN)) {
          await openGrpcHistoryPanelQuiet(ctx);
        }
      },
      action: async (ctx) => {
        await openFirstGrpcHistoryEntry(ctx, { ensureExecuted: false });
        await ctx.waitFor(GRPC.HISTORY_REPLAY_BTN, 8_000);
        await spotlightAndPause(ctx, GRPC.HISTORY_ENTRY_ROW, 800);
        await spotlightAndPause(ctx, GRPC.HISTORY_DETAIL, 750);
        await spotlightAndPause(ctx, GRPC.HISTORY_REPLAY_BTN, 900);
        const replayBtn = document.querySelector<HTMLButtonElement>(GRPC.HISTORY_REPLAY_BTN);
        if (replayBtn && !replayBtn.disabled) {
          replayBtn.click();
          await ctx.delay(500);
        }
        await spotlightAndPause(ctx, GRPC.SEND_BTN, 800);
      },
      verify: GRPC.SEND_BTN,
    },

    {
      id: 'grpc1-replay',
      title: 'Send Unary After Replay',
      description:
        'Back on Studio, pause on **Send Unary**, click it, then pause on the fresh **OK** status and echoed body so the replay result is easy to read.',
      highlight: GRPC.SEND_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        try {
          await ctx.waitFor(GRPC.SEND_BTN, 5_000);
        } catch {
          // Keep lesson stable when replay transitions are delayed.
        }
      },
      action: async (ctx) => {
        try {
          await ctx.waitFor(GRPC.SEND_BTN, 5_000);
          await spotlightAndPause(ctx, GRPC.SEND_BTN, 900);
          const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            await ctx.waitFor(GRPC.RESPONSE_STATUS, 8_000);
            await ctx.waitFor(GRPC.RESPONSE_BODY, 5_000);
            await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 800);
            await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 950);
          }
        } catch {
          // Replay or send unavailable in some local runs — keep lesson stable.
        }
      },
      verify: GRPC.RESPONSE_BODY,
    },
  ],
};
