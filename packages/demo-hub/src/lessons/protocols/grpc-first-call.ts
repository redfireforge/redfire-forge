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
  ensureGrpcTarget,
  ensureUnaryExecuted,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';

const GRPC1_ROSTER = getGrpcLessonRosterEntry('grpc-first-call')!;

export const grpcFirstCallLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC1_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Connect to a gRPC server, discover services with reflection, send a unary Echo RPC, read the response, and find the call in History.',

  setup: grpcFirstCallSetup,
  cleanup: grpcFirstCallCleanup,

  grpc: buildGrpcContractMetaFromRoster(GRPC1_ROSTER),

  concept: {
    title: 'gRPC in RedfireForge',
    body: `**gRPC Studio** is RedfireForge's workspace for typed RPC calls over HTTP/2. Unlike REST — where each resource has its own URL and verb — gRPC exposes **services** and **methods** described by **Protocol Buffers**. You pick a method, fill a structured request form, and send a single unary call (or start a stream).

**The five-step workflow in this lesson:**
1. **Target** — set the server address (e.g. \`${GRPC_DEMO_TARGET}\`) in the connection bar. The green status badge confirms the address is valid.
2. **Reflect** — download the server's service catalog via **gRPC reflection** so the Service Explorer lists every RPC without importing .proto files manually.
3. **Select** — pick **echo.EchoService / Echo** (a unary RPC) from the explorer tree. The request form builds fields from the schema.
4. **Invoke** — click **Send**; the response panel shows status, latency, and JSON body.
5. **History** — every call is auto-saved under **History** so you can replay or inspect it later.

This lesson uses the local Docker echo server on port **50051** and the Express gRPC proxy on port **3001**. Start both with the commands in the prerequisite gate before proceeding.`,
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
        term: 'History',
        definition:
          'An auto-populated log of past invocations with target, method, request body, and response — replayable from the History panel.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 280" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc1-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
  </defs>
  <rect x="1" y="1" width="638" height="200" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5"/>
  <text x="320" y="24" text-anchor="middle" font-size="11" fill="#a8b8cc">gRPC Studio — connection bar + explorer + response</text>
  <rect x="12" y="38" width="200" height="24" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="22" y="54" font-family="monospace" font-size="10" fill="#f1f5f9">${GRPC_DEMO_TARGET}</text>
  <rect x="220" y="39" width="72" height="22" rx="11" fill="#052e16" stroke="#22c55e" stroke-width="1"/>
  <text x="256" y="54" text-anchor="middle" font-size="9" fill="#22c55e">✓ Target</text>
  <rect x="300" y="39" width="76" height="22" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1"/>
  <text x="338" y="54" text-anchor="middle" font-size="9.5" fill="#3b82f6">Reflect</text>
  <rect x="384" y="39" width="56" height="22" rx="4" fill="#3b82f6"/>
  <text x="412" y="54" text-anchor="middle" font-size="9.5" fill="#fff">Send</text>
  <rect x="12" y="72" width="180" height="118" rx="4" fill="#0f172a" stroke="#3b4a60"/>
  <text x="22" y="90" font-size="9" fill="#a8b8cc">echo.EchoService</text>
  <text x="32" y="108" font-size="9" fill="#22d3ee">Echo (U)</text>
  <text x="32" y="124" font-size="8.5" fill="#64748b">ServerStream …</text>
  <rect x="200" y="72" width="220" height="118" rx="4" fill="#0f172a" stroke="#3b4a60"/>
  <text x="212" y="92" font-size="9" fill="#a8b8cc">message:</text>
  <text x="260" y="92" font-family="monospace" font-size="9" fill="#4ade80">"${GRPC_DEMO_MESSAGE}"</text>
  <rect x="428" y="72" width="200" height="118" rx="4" fill="#0f172a" stroke="#22c55e" stroke-width="1"/>
  <text x="440" y="92" font-size="9" fill="#22c55e">OK · ~8ms</text>
  <text x="440" y="112" font-family="monospace" font-size="8.5" fill="#a8b8cc">{ "message": "…" }</text>
  <text x="320" y="230" text-anchor="middle" font-size="10" fill="#a8b8cc">TARGET → REFLECT → SELECT → SEND → HISTORY</text>
  <circle cx="80" cy="250" r="12" fill="#1e3a5f" stroke="#3b82f6"/><text x="80" y="254" text-anchor="middle" font-size="9" fill="#3b82f6">①</text>
  <line x1="94" y1="250" x2="136" y2="250" stroke="#3b82f6" marker-end="url(#grpc1-arr)"/>
  <circle cx="150" cy="250" r="12" fill="#1e3a5f" stroke="#3b82f6"/><text x="150" y="254" text-anchor="middle" font-size="9" fill="#3b82f6">②</text>
  <line x1="164" y1="250" x2="206" y2="250" stroke="#3b82f6" marker-end="url(#grpc1-arr)"/>
  <circle cx="220" cy="250" r="12" fill="#1e293b" stroke="#3b82f6"/><text x="220" y="254" text-anchor="middle" font-size="9" fill="#3b82f6">③</text>
  <line x1="234" y1="250" x2="276" y2="250" stroke="#3b82f6" marker-end="url(#grpc1-arr)"/>
  <circle cx="290" cy="250" r="12" fill="#1e3a5f" stroke="#3b82f6"/><text x="290" y="254" text-anchor="middle" font-size="9" fill="#3b82f6">④</text>
  <line x1="304" y1="250" x2="346" y2="250" stroke="#3b82f6" marker-end="url(#grpc1-arr)"/>
  <circle cx="360" cy="250" r="12" fill="#052e16" stroke="#22c55e"/><text x="360" y="254" text-anchor="middle" font-size="9" fill="#22c55e">⑤</text>
</svg>`,
  },

  steps: [
    {
      id: 'grpc1-intro',
      title: 'gRPC Studio',
      description:
        'Welcome to **gRPC Studio**. The **connection bar** at the top holds the target address, **Reflect**, and transport badges. ' +
        'The **Service Explorer** on the left lists discovered RPCs; the **call panel** in the centre builds your request; the **response panel** on the right shows results. ' +
        'Unary calls are the simplest pattern — one request, one response — and that is what this lesson demonstrates.',
      highlight: GRPC.CONNECTION_BAR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
    },

    {
      id: 'grpc1-target',
      title: 'Set the Server Target',
      description:
        `Type \`${GRPC_DEMO_TARGET}\` into the **target** field. This is the host:port of the Docker echo server (plaintext gRPC on port **50051**). ` +
        'Watch for the green **target OK** badge — it confirms the address format is valid before you reflect or send.',
      highlight: GRPC.TARGET_INPUT,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await ensureGrpcTarget(ctx);
        await ctx.delay(800);
      },
      verify: GRPC.TARGET_STATUS_OK,
    },

    {
      id: 'grpc1-reflect',
      title: 'Discover Services with Reflection',
      description:
        'Click **Reflect** to query the server\'s reflection API. RedfireForge downloads every service and method descriptor and populates the **Service Explorer** tree. ' +
        'You should see **echo.EchoService** with unary **Echo** plus streaming methods — no local .proto import required for this server.',
      highlight: GRPC.REFLECT_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureGrpcTarget(ctx);
      },
      action: async (ctx) => {
        await ensureGrpcReflected(ctx);
        await ctx.delay(1000);
      },
      verify: GRPC.EXPLORER_TREE,
    },

    {
      id: 'grpc1-select-method',
      title: 'Select the Echo Method',
      description:
        'Expand **echo.EchoService** if needed, then click **Echo** — a **Unary** RPC (badge **U**). ' +
        'The call panel opens a schema-driven form for the request message. Pay attention to the **message** field — that is what the server echoes back.',
      highlight: GRPC.SERVICE_EXPLORER,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureGrpcReflected(ctx);
      },
      action: async (ctx) => {
        await ensureEchoMethodSelected(ctx);
        await ctx.delay(800);
      },
      verify: GRPC.PROTO_FORM,
    },

    {
      id: 'grpc1-fill-message',
      title: 'Fill the Request Message',
      description:
        `Enter \`${GRPC_DEMO_MESSAGE}\` in the **message** field. The proto form enforces types from the reflected schema — strings stay strings, numbers stay numbers. ` +
        'You can switch to the JSON tab later for power-user editing; the form is the fastest path for unary calls.',
      highlight: GRPC.PROTO_FIELD_INPUT_MESSAGE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoMethodSelected(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(GRPC.PROTO_FIELD_INPUT_MESSAGE, 10_000);
        await ctx.fill(GRPC.PROTO_FIELD_INPUT_MESSAGE, GRPC_DEMO_MESSAGE);
        await ctx.delay(600);
      },
    },

    {
      id: 'grpc1-send',
      title: 'Send the Unary Call',
      description:
        'Click **Send** to invoke **echo.EchoService/Echo**. RedfireForge routes the call through the Express proxy (browser mode) to the Docker server. ' +
        'The response panel shows **OK** status, round-trip time, and the echoed JSON body.',
      highlight: GRPC.SEND_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureEchoMethodSelected(ctx);
        const field = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
        if (!field?.value.trim()) {
          await ctx.fill(GRPC.PROTO_FIELD_INPUT_MESSAGE, GRPC_DEMO_MESSAGE);
          await ctx.delay(400);
        }
      },
      action: async (ctx) => {
        await ensureUnaryExecuted(ctx);
        await ctx.delay(1000);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    {
      id: 'grpc1-response',
      title: 'Read the Response',
      description:
        `The response body should contain your message echoed back: \`"${GRPC_DEMO_MESSAGE}"\`. ` +
        'Check the status line for **OK** and the duration in milliseconds. Headers and trailers tabs show gRPC metadata when present.',
      highlight: GRPC.RESPONSE_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureUnaryExecuted(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(GRPC.RESPONSE_BODY, 10_000);
        await ctx.delay(1000);
      },
    },

    {
      id: 'grpc1-history',
      title: 'Find It in History',
      description:
        'Open the **History** sub-nav tab. Every unary invocation is saved automatically with target, service, method, and response snapshot. ' +
        'You can replay a history row back into the studio or copy a grpcurl command — no need to retype the request.',
      highlight: GRPC.SUB_NAV_HISTORY,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureUnaryExecuted(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.SUB_NAV_HISTORY);
        await ctx.waitFor(GRPC.HISTORY_PANEL, 10_000);
        await ctx.waitFor(GRPC.HISTORY_LIST, 10_000);
        await ctx.delay(1000);
      },
      verify: GRPC.HISTORY_LIST,
    },
  ],
};
