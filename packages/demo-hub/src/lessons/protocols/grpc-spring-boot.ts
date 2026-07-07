/**
 * Lesson GRPC-15: Spring Boot & Spring gRPC Integration
 *
 * One Spring Boot fixture, one JVM, two doors in: a Netty gRPC server on `:9090`
 * (the `net.devh` starter, real HTTP/2) and an HTTP/1.1 servlet bridge on `:8080`
 * (RedfireForge's "Spring Servlet" transport). Covers reflection working out of the
 * box (no `application.yml` flag needed), the standard gRPC Health Check protocol
 * exposed under a Studio-friendly name, a bearer-token-gated RPC that mirrors a
 * Spring Security interceptor, and target-field environment-variable interpolation.
 *
 *   grpc15-intro                — One JVM, two transports: Netty :9090 vs Servlet :8080
 *   grpc15-connect-netty        — Express Proxy → :9090 → Reflect (works out of the box)
 *   grpc15-execute-echo         — Select Echo, send, response via Express Proxy
 *   grpc15-health-check         — Settings → Health, Spring hint, Check (unary) → SERVING
 *   grpc15-health-watch         — Watch (stream) → periodic beats every 3s → Cancel
 *   grpc15-secure-echo-denied   — SecureEcho without auth → UNAUTHENTICATED
 *   grpc15-bearer-auth          — Auth tab → Bearer → demo-secret-token → SecureEcho succeeds
 *   grpc15-spring-servlet       — Switch to Spring Servlet, target :8080, resend Echo
 *   grpc15-target-interpolation — {{grpcHost}} in the target field, live preview
 *   grpc15-proto-stubs          — Manage Schemas → Schema Browser mirrors the Java service
 */
import { GRPC } from '@shared/selectors';
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import { upsertWorkspaceDefaults } from '../../adapters';
import {
  GRPC_DEMO_MESSAGE,
  GRPC_ECHO_SERVICE,
  GRPC_ECHO_SERVICE_SEL,
  GRPC_ECHO_METHOD_SEL,
  closeExtraGrpcTabsQuiet,
  closeGrpcSettingsDrawerQuiet,
  ensureGrpcStudioSubNavQuiet,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  openGrpcSettingsDrawerQuiet,
  resetGrpcConnectionSettingsQuiet,
  setGrpcTargetQuiet,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import type { DemoActionContext } from '../../types';

const GRPC15_ROSTER = getGrpcLessonRosterEntry('grpc-spring-boot')!;

/** One Spring Boot JVM, two ports — `net.devh` Netty gRPC and an HTTP/1.1 servlet bridge. */
const GRPC_SPRING_NETTY_TARGET = 'localhost:9090';
const GRPC_SPRING_SERVLET_TARGET = 'localhost:8080';

const GRPC_SECURE_ECHO_METHOD = 'SecureEcho';
const GRPC_SECURE_ECHO_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_SECURE_ECHO_METHOD);

/** Matches `BearerAuthServerInterceptor`'s `REQUIRED_BEARER_TOKEN` (Studio prepends "Bearer "). */
const DEMO_BEARER_TOKEN = 'demo-secret-token';
const DEMO_GRPC_HOST_VAR = '{{grpcHost}}';

type TransportMode = 'express' | 'tauri' | 'grpc-web' | 'spring-servlet';

// ---------------------------------------------------------------------------
// Navigation + baseline helpers
// ---------------------------------------------------------------------------

async function ensureStudioNav(ctx: DemoActionContext): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}

async function ensureMessageFilledQuiet(ctx: DemoActionContext, message = GRPC_DEMO_MESSAGE): Promise<void> {
  const field = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
  if (!field || field.value.trim() === message) return;
  field.focus();
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (nativeSet?.set) {
    nativeSet.set.call(field, message);
  } else {
    field.value = message;
  }
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await ctx.delay(150);
}

function isTransportModeActive(mode: TransportMode): boolean {
  const btn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE(mode));
  return btn?.getAttribute('aria-pressed') === 'true';
}

/** Quietly select `mode` in the Transport panel — opens/closes the drawer only if needed. */
async function ensureTransportModeQuiet(ctx: DemoActionContext, mode: TransportMode): Promise<void> {
  await openGrpcSettingsDrawerQuiet(ctx, 'transport');
  if (!document.querySelector(GRPC.TRANSPORT_PANEL)) return;
  if (!isTransportModeActive(mode)) {
    const btn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE(mode));
    if (btn && !btn.disabled) {
      btn.click();
      await ctx.delay(250);
    }
  }
  await closeGrpcSettingsDrawerQuiet(ctx);
}

// ---------------------------------------------------------------------------
// Reflect + method selection against an arbitrary Spring target (the shared
// grpc-lesson-helpers reflect/select helpers hard-code the Go echo target).
// ---------------------------------------------------------------------------

async function reflectQuiet(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GRPC.EXPLORER_TREE)) return;
  const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
  if (reflectBtn && !reflectBtn.disabled) {
    reflectBtn.click();
  }
  try {
    await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
  } catch {
    // Best-effort — infra may be temporarily unavailable in test stubs.
  }
  await ctx.delay(350);
}

async function selectMethodQuiet(ctx: DemoActionContext, methodSel: string): Promise<void> {
  await reflectQuiet(ctx);
  if (!document.querySelector(methodSel)) {
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL);
    if (serviceBtn) {
      serviceBtn.click();
      await ctx.delay(350);
    }
  }
  const methodBtn = document.querySelector<HTMLElement>(methodSel);
  if (methodBtn) {
    methodBtn.click();
    try {
      await ctx.waitFor(GRPC.PROTO_FORM, 8_000);
    } catch {
      await ctx.delay(400);
    }
  }
  await ensureMessageFilledQuiet(ctx);
}

/** Visible reflect + method selection (spotlight pacing) for steps that teach it. */
async function selectMethodVisible(
  ctx: DemoActionContext,
  methodSel: string,
  opts: { reflectFirst?: boolean } = {},
): Promise<void> {
  const { reflectFirst = true } = opts;
  if (reflectFirst) {
    await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 700);
    if (!document.querySelector(GRPC.EXPLORER_TREE)) {
      await ctx.click(GRPC.REFLECT_BTN);
      try {
        await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
      } catch {
        await ctx.delay(1_500);
      }
      await ctx.delay(400);
    }
    await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 700);
  }

  if (!document.querySelector(methodSel) && document.querySelector(GRPC_ECHO_SERVICE_SEL)) {
    await spotlightAndPause(ctx, GRPC_ECHO_SERVICE_SEL, 600);
    await ctx.click(GRPC_ECHO_SERVICE_SEL);
    try {
      await ctx.waitFor(methodSel, 5_000);
    } catch {
      await ctx.delay(400);
    }
  }
  if (document.querySelector(methodSel)) {
    await spotlightAndPause(ctx, methodSel, 700);
    await ctx.click(methodSel);
    try {
      await ctx.waitFor(GRPC.PROTO_FORM, 8_000);
    } catch {
      await ctx.delay(400);
    }
  }
  await ensureMessageFilledQuiet(ctx);
}

/** Restore the lesson baseline: Express Proxy, Netty target, Echo selected, auth none. */
async function resetSpringBaselineQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureStudioNav(ctx);
  await resetGrpcConnectionSettingsQuiet(ctx);
  await ensureTransportModeQuiet(ctx, 'express');
  await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
  await selectMethodQuiet(ctx, GRPC_ECHO_METHOD_SEL);
}

// ---------------------------------------------------------------------------
// Auth tab helpers (bearer-only — mirrors the pattern in grpc-metadata-auth.ts)
// ---------------------------------------------------------------------------

async function openAuthTabQuiet(ctx: DemoActionContext): Promise<void> {
  await closeGrpcSettingsDrawerQuiet(ctx);
  const authTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_AUTH);
  if (authTabBtn && !authTabBtn.disabled) {
    const authTabActive = authTabBtn.getAttribute('aria-pressed') === 'true';
    if (!authTabActive) {
      authTabBtn.click();
      await ctx.delay(150);
    }
  }
}

async function selectAuthTypeQuiet(ctx: DemoActionContext, type: 'none' | 'bearer'): Promise<void> {
  const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
  if (authSelect && authSelect.value !== type) {
    await ctx.selectOption(GRPC.AUTH_TYPE_SELECT, type);
  }
}

function bearerTokenFieldValue(): string {
  return document.querySelector<HTMLInputElement>('[data-testid="grpc-auth-bearer-token"]')?.value.trim() ?? '';
}

function fillBearerTokenField(value: string): void {
  const input = document.querySelector<HTMLInputElement>('[data-testid="grpc-auth-bearer-token"]');
  if (!input || input.disabled) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------------------------------------------------------------------------
// Manage Schemas modal helpers (mirrors grpc-schema-discovery.ts)
// ---------------------------------------------------------------------------

async function ensureManageModalOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) return;
  await ctx.waitFor(GRPC.MANAGE_SCHEMAS_BTN, 10_000);
  await ctx.click(GRPC.MANAGE_SCHEMAS_BTN);
  await ctx.waitFor(GRPC.PROTO_MANAGE_MODAL, 10_000);
  await ctx.delay(350);
}

async function ensureManageModalClosed(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GRPC.PROTO_MANAGE_MODAL)) return;
  await ctx.click(GRPC.PROTO_CANCEL_BTN);
  await ctx.delay(350);
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export const grpcSpringBootLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC15_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Connect gRPC Studio to a real Spring Boot server two different ways: the standard Netty gRPC port ' +
    '(`net.devh`, `:9090`) over Express Proxy, and the same JVM\'s HTTP/1.1 servlet bridge (`:8080`) over ' +
    'the Spring Servlet transport. Along the way: reflection that works with zero `application.yml` config, ' +
    'the standard gRPC Health Check protocol, a bearer-token-gated RPC mirroring a Spring Security ' +
    'interceptor, and environment-variable interpolation in the target field.',

  setup: async (ctx) => {
    await grpcFirstCallSetup(ctx);
    await resetSpringBaselineQuiet(ctx);
  },
  cleanup: async (ctx) => {
    upsertWorkspaceDefaults({ grpcHost: '' });
    await closeExtraGrpcTabsQuiet(ctx);
    await resetSpringBaselineQuiet(ctx);
    await grpcFirstCallCleanup(ctx);
  },

  grpc: buildGrpcContractMetaFromRoster(GRPC15_ROSTER),

  concept: {
    title: 'Spring Boot gRPC Integration',
    body: `A single Spring Boot fixture exposes the **same** \`echo.EchoService\` two different ways from one JVM:

| Port | Stack | RedfireForge transport | Call types |
|---|---|---|---|
| \`:9090\` | \`net.devh\` gRPC starter (Netty, real HTTP/2) | 🌐 Express Proxy | Unary, streaming — everything |
| \`:8080\` | Spring MVC servlet bridge (HTTP/1.1, same JVM) | 🌿 Spring Servlet | Unary only (this fixture) |

**Reflection works out of the box.** The \`net.devh\` starter auto-registers both \`grpc.reflection.v1alpha.ServerReflection\` and the standard \`grpc.health.v1.Health\` service the moment \`grpc-services\` is on the classpath — no \`application.yml\` flag required. This fixture also ships a **second**, differently-named health service, \`health.v1.Health\`, because gRPC Studio's own Health Check panel looks for that exact name rather than the gRPC-standard one.

**Authentication mirrors Spring Security.** The \`SecureEcho\` method is guarded by a \`ServerInterceptor\` that rejects any call missing \`authorization: Bearer demo-secret-token\` with \`UNAUTHENTICATED\` — the same shape a real Spring Security gRPC filter would produce.

**What you will do in this lesson:**
1. **Connect** to the Netty port over Express Proxy and Reflect — see both health services appear.
2. **Send** a plain Echo call — the control case.
3. **Probe health** — unary Check, then a live Watch stream every 3 seconds.
4. **Hit the auth gate** — call \`SecureEcho\` without a token (denied), then with one (accepted).
5. **Switch transports** — same JVM, same Echo method, now over Spring Servlet on \`:8080\`.
6. **Interpolate** the target with \`{{grpcHost}}\` and watch the live preview resolve it.
7. **Browse the schema** — the same message/enum types the Java code defines.`,
    keyTerms: [
      {
        term: 'net.devh starter',
        definition:
          '`grpc-server-spring-boot-starter` — the most common third-party Spring Boot gRPC integration. Starts a Netty gRPC server (default port `:9090`) and auto-registers reflection and the standard health service.',
      },
      {
        term: 'Spring Servlet transport',
        definition:
          'A RedfireForge browser-direct transport that POSTs gRPC-Web-framed bytes to `/ServiceName/MethodName` over plain HTTP/1.1 — matches a Spring MVC controller bridging gRPC calls onto the servlet port, with no gRPC/HTTP2 channel involved.',
      },
      {
        term: 'health.v1.Health',
        definition:
          'This fixture\'s custom health service name. gRPC Studio\'s Health Check panel specifically looks for a service named `health.v1.Health` — not the industry-standard `grpc.health.v1.Health` that `net.devh` also registers automatically.',
      },
      {
        term: 'Spring hint card',
        definition:
          'A contextual tip that appears in the Health panel when the selected method is `health.v1.Health/Check` or `/Watch`, explaining the service-name field and `ServingStatus` enum.',
      },
      {
        term: 'Bearer-gated RPC',
        definition:
          'A `ServerInterceptor` inspects the `authorization` metadata for one specific method (`SecureEcho`) and closes the call with `UNAUTHENTICATED` if the exact bearer token is missing — every other RPC on the service passes through untouched.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 360" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc15-arr-b" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc15-arr-p" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#a855f7"/>
    </marker>
  </defs>

  <text x="20" y="24" font-size="12" fill="#f1f5f9">gRPC Studio</text>
  <rect x="14" y="34" width="170" height="130" rx="8" fill="#0f172a" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="99" y="56" text-anchor="middle" font-size="10" fill="#a8b8cc">Studio tab</text>
  <rect x="28" y="66" width="142" height="26" rx="5" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="99" y="83" text-anchor="middle" font-size="9" fill="#93c5fd">🌐 Express Proxy</text>
  <rect x="28" y="100" width="142" height="26" rx="5" fill="#1a0533" stroke="#a855f7"/>
  <text x="99" y="117" text-anchor="middle" font-size="9" fill="#d8b4fe">🌿 Spring Servlet</text>
  <text x="28" y="146" font-size="7.5" fill="#64748b">Same tab, one target</text>
  <text x="28" y="157" font-size="7.5" fill="#64748b">field switches port.</text>

  <!-- Express -> Netty -->
  <line x1="184" y1="79" x2="330" y2="79" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc15-arr-b)"/>
  <text x="192" y="72" font-size="7.5" fill="#93c5fd">HTTP/2 (@grpc/grpc-js)</text>

  <!-- Servlet -> Tomcat -->
  <line x1="184" y1="113" x2="330" y2="200" stroke="#a855f7" stroke-width="1.4" marker-end="url(#grpc15-arr-p)"/>
  <text x="188" y="150" font-size="7.5" fill="#d8b4fe">HTTP/1.1 POST</text>
  <text x="188" y="161" font-size="7.5" fill="#d8b4fe">/echo.EchoService/Echo</text>

  <!-- Spring Boot JVM box -->
  <rect x="332" y="46" width="340" height="270" rx="10" fill="#0d1520" stroke="#22c55e" stroke-width="1.4"/>
  <text x="502" y="66" text-anchor="middle" font-size="10.5" fill="#4ade80">Spring Boot JVM (one process)</text>

  <rect x="350" y="78" width="150" height="76" rx="6" fill="#0f2b1a" stroke="#22c55e" stroke-width="1"/>
  <text x="425" y="96" text-anchor="middle" font-size="9" fill="#4ade80">Netty gRPC :9090</text>
  <text x="425" y="110" text-anchor="middle" font-size="7.5" fill="#86efac">echo.EchoService</text>
  <text x="425" y="122" text-anchor="middle" font-size="7.5" fill="#86efac">health.v1.Health</text>
  <text x="425" y="134" text-anchor="middle" font-size="7.5" fill="#86efac">grpc.health.v1.Health</text>
  <text x="425" y="146" text-anchor="middle" font-size="7.5" fill="#86efac">reflection (auto)</text>

  <rect x="510" y="78" width="146" height="76" rx="6" fill="#1a0533" stroke="#a855f7" stroke-width="1"/>
  <text x="583" y="96" text-anchor="middle" font-size="9" fill="#d8b4fe">Servlet bridge :8080</text>
  <text x="583" y="112" text-anchor="middle" font-size="7.5" fill="#e9d5ff">MVC controller</text>
  <text x="583" y="126" text-anchor="middle" font-size="7.5" fill="#e9d5ff">Echo only</text>
  <text x="583" y="140" text-anchor="middle" font-size="7.5" fill="#e9d5ff">gRPC-Web framing</text>

  <rect x="350" y="166" width="306" height="52" rx="6" fill="#1e1206" stroke="#f59e0b" stroke-width="1"/>
  <text x="503" y="184" text-anchor="middle" font-size="9" fill="#fbbf24">BearerAuthServerInterceptor</text>
  <text x="503" y="198" text-anchor="middle" font-size="7.5" fill="#fcd34d">guards SecureEcho — needs</text>
  <text x="503" y="210" text-anchor="middle" font-size="7.5" fill="#fcd34d">authorization: Bearer demo-secret-token</text>

  <rect x="350" y="230" width="306" height="70" rx="6" fill="#0d1520" stroke="#3b4a60" stroke-width="1"/>
  <text x="503" y="248" text-anchor="middle" font-size="9" fill="#f1f5f9">HealthFixtureGrpcService</text>
  <text x="503" y="264" text-anchor="middle" font-size="7.5" fill="#a8b8cc">Check → SERVING (unary)</text>
  <text x="503" y="278" text-anchor="middle" font-size="7.5" fill="#a8b8cc">Watch → SERVING every 3s (stream)</text>
  <text x="503" y="292" text-anchor="middle" font-size="7.5" fill="#a8b8cc">named health.v1.Health for the Health panel</text>

  <text x="350" y="336" text-anchor="middle" font-size="11" fill="#a8b8cc">One JVM, one service — two transports, one auth gate, two health names</text>
</svg>`,
  },

  steps: [
    // -------------------------------------------------------------------------
    // Step 1 — One JVM, two transports
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-intro',
      title: 'One Spring Boot JVM, Two Doors In',
      description:
        'This fixture runs a **single** Spring Boot process exposing the same `echo.EchoService` on two ports:\n\n' +
        '- `localhost:9090` — a real Netty gRPC server from the `net.devh` starter (HTTP/2)\n' +
        '- `localhost:8080` — an HTTP/1.1 servlet bridge for the same service, reached via the **Spring Servlet** ' +
        'transport\n\n' +
        'The **connection bar** below is where you switch between them — just a target address and a transport ' +
        'mode, exactly like any other gRPC Studio tab. The rest of this lesson walks both doors, plus the health ' +
        'check protocol and a bearer-token-gated call this fixture exposes on the Netty port.',
      highlight: GRPC.CONNECTION_BAR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await resetSpringBaselineQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, 900);
        await ctx.delay(200);
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 900);
      },
      verify: GRPC.CONNECTION_BAR,
    },

    // -------------------------------------------------------------------------
    // Step 2 — Connect + Reflect on the Netty port
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-connect-netty',
      title: 'Reflection Works Out of the Box',
      description:
        'With the target already set to `localhost:9090` and **Express Proxy** active, click **Reflect**.\n\n' +
        'No `application.yml` change was needed — the `net.devh` gRPC starter auto-registers ' +
        '`grpc.reflection.v1alpha.ServerReflection` (and the standard `grpc.health.v1.Health` service) the moment ' +
        'the `grpc-services` artifact is on the classpath. The Service Explorer populates with **four** services: ' +
        '`echo.EchoService`, this fixture\'s custom `health.v1.Health`, the standard `grpc.health.v1.Health`, and ' +
        'the reflection service itself.',
      highlight: GRPC.SERVICE_EXPLORER,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await resetGrpcConnectionSettingsQuiet(ctx);
        await ensureTransportModeQuiet(ctx, 'express');
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
        await ctx.delay(200);

        await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 700);
        if (!document.querySelector(GRPC.EXPLORER_TREE)) {
          await ctx.click(GRPC.REFLECT_BTN);
          try {
            await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
          } catch {
            await ctx.delay(1_500);
          }
        }
        await ctx.delay(500);

        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 1_100);

        // Point out the two differently-named health services, one at a time.
        const grpcHealthSel = GRPC.SERVICE('grpc.health.v1.Health');
        const fixtureHealthSel = GRPC.SERVICE('health.v1.Health');
        if (document.querySelector(fixtureHealthSel)) {
          await spotlightAndPause(ctx, fixtureHealthSel, 900);
        }
        if (document.querySelector(grpcHealthSel)) {
          await spotlightAndPause(ctx, grpcHealthSel, 900);
        }
      },
      verify: GRPC.EXPLORER_TREE,
    },

    // -------------------------------------------------------------------------
    // Step 3 — Execute Echo via Express Proxy
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-execute-echo',
      title: 'The Control Case: Echo over Express Proxy',
      description:
        'Select `echo.EchoService / Echo`, confirm the `message` field is filled, and click **Send**. The request ' +
        'routes through RedfireForge\'s local Express proxy to the Netty gRPC server — the same universal path ' +
        'every gRPC Studio lesson uses. Keep this response in mind: the last third of this lesson repeats the ' +
        'exact same call over the Spring Servlet transport instead.',
      highlight: GRPC.RESPONSE_BODY,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
        await selectMethodQuiet(ctx, GRPC_ECHO_METHOD_SEL);
      },
      action: async (ctx) => {
        await selectMethodVisible(ctx, GRPC_ECHO_METHOD_SEL, { reflectFirst: false });

        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 12_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 15_000);
        }
        await ctx.delay(600);

        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 800);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 1_000);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 4 — Health Check (unary)
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-health-check',
      title: 'Health Check: the Standard gRPC Probe',
      description:
        'Open **Session settings → Health**. Because the selected descriptor exposes `health.v1.Health`, a ' +
        '**Spring hint card** appears explaining the service-name field and `ServingStatus` enum — read it, then ' +
        'dismiss it.\n\n' +
        'Leave **Service name** empty (checks overall server health) and click **Check Health (Unary)**. The panel ' +
        'reports **SERVING** — a single request/response call to `health.v1.Health/Check`, no different from any ' +
        'other unary RPC, just with a well-known shape every gRPC server can implement.',
      highlight: GRPC.HEALTH_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
        await reflectQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 700);
        await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
        try {
          await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(500);

        await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('health'), 700);
        await ctx.click(GRPC.SETTINGS_NAV_ITEM('health'));
        try {
          await ctx.waitFor(GRPC.SETTINGS_PANEL('health'), 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(500);

        const hintSel = GRPC.SPRING_HINT('spring_health_actuator');
        if (document.querySelector(hintSel)) {
          await spotlightAndPause(ctx, hintSel, 1_200);
          const dismissBtn = document.querySelector<HTMLButtonElement>(GRPC.SPRING_HINT_DISMISS('spring_health_actuator'));
          if (dismissBtn) {
            await spotlightAndPause(ctx, GRPC.SPRING_HINT_DISMISS('spring_health_actuator'), 600);
            await ctx.click(GRPC.SPRING_HINT_DISMISS('spring_health_actuator'));
            await ctx.delay(400);
          }
        }

        await spotlightAndPause(ctx, GRPC.HEALTH_CHECK_BTN, 700);
        await ctx.click(GRPC.HEALTH_CHECK_BTN);
        try {
          await ctx.waitFor(GRPC.HEALTH_RESULT, 8_000);
        } catch {
          await ctx.delay(1_000);
        }
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.HEALTH_RESULT, 1_100);

        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(500);
      },
      verify: GRPC.CONNECTION_BAR,
    },

    // -------------------------------------------------------------------------
    // Step 5 — Health Watch (server streaming)
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-health-watch',
      title: 'Health Watch: a Live Streaming Probe',
      description:
        'Back in **Health**, click **Watch (Stream)**. Studio switches the tab to `health.v1.Health/Watch` and ' +
        'immediately opens a server-streaming call — no separate Start button needed. The fixture pushes a fresh ' +
        '**SERVING** event every 3 seconds; watch at least two arrive in the stream log before clicking **Cancel** ' +
        'to close the channel.\n\n' +
        'This is the same server-streaming mechanism used everywhere else in gRPC Studio — Watch is just a health ' +
        'probe wearing that shape.',
      highlight: GRPC.STREAM_LOG_LIST,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
        await reflectQuiet(ctx);
      },
      action: async (ctx) => {
        await openGrpcSettingsDrawerQuiet(ctx, 'health');
        await spotlightAndPause(ctx, GRPC.HEALTH_WATCH_BTN, 800);
        await ctx.click(GRPC.HEALTH_WATCH_BTN);
        // Clicking Watch closes the settings drawer itself and starts the stream immediately.
        await ctx.delay(500);

        try {
          await ctx.waitFor(GRPC.STREAM_LOG_LIST, 6_000);
        } catch {
          await ctx.delay(1_000);
        }
        await spotlightAndPause(ctx, GRPC.STREAM_LOG_LIST, 800);

        // Wait through two 3-second beats so the viewer sees the "live" cadence, not a one-shot.
        await ctx.delay(3_400);
        await spotlightAndPause(ctx, GRPC.STREAM_LOG_LIST, 900);
        await ctx.delay(3_400);
        await spotlightAndPause(ctx, GRPC.STREAM_LOG_LIST, 900);

        const cancelBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_CANCEL_BTN);
        if (cancelBtn && !cancelBtn.disabled) {
          await spotlightAndPause(ctx, GRPC.STREAM_CANCEL_BTN, 700);
          await ctx.click(GRPC.STREAM_CANCEL_BTN);
          await ctx.delay(500);
        }
      },
      verify: GRPC.STREAM_LOG_LIST,
    },

    // -------------------------------------------------------------------------
    // Step 6 — SecureEcho denied without a bearer token
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-secure-echo-denied',
      title: 'A Guarded RPC: SecureEcho Requires a Token',
      description:
        'Select `echo.EchoService / SecureEcho` — same request/response shape as Echo, but guarded by a ' +
        '`ServerInterceptor` on the server. With **Auth** still set to **none**, click **Send**.\n\n' +
        'The call fails with **UNAUTHENTICATED** — the response status badge shows the gRPC status code and the ' +
        'interceptor\'s message. This is exactly what a real Spring Security gRPC filter would produce for a ' +
        'protected endpoint: the call reaches the server, but is rejected before your handler code ever runs.',
      highlight: GRPC.RESPONSE_STATUS,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
        await resetGrpcConnectionSettingsQuiet(ctx);
        await selectMethodQuiet(ctx, GRPC_SECURE_ECHO_SEL);
      },
      action: async (ctx) => {
        await selectMethodVisible(ctx, GRPC_SECURE_ECHO_SEL, { reflectFirst: false });

        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 800);

        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 12_000);
        } catch {
          await ctx.delay(1_500);
        }
        await ctx.delay(500);

        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 1_300);
      },
      verify: GRPC.RESPONSE_STATUS,
    },

    // -------------------------------------------------------------------------
    // Step 7 — Bearer auth unlocks SecureEcho
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-bearer-auth',
      title: 'Bearer Token Unlocks SecureEcho',
      description:
        'Click the **Auth** tab, set the type to **Bearer Token**, and fill in `demo-secret-token` — RedfireForge ' +
        'adds the `Bearer ` prefix automatically, so the header sent is `authorization: Bearer demo-secret-token`, ' +
        'exactly what the interceptor requires.\n\n' +
        'Click **Send** again on the same `SecureEcho` call. This time it succeeds — the interceptor forwards the ' +
        'call once the token matches, and the response echoes your message back like any other unary RPC.',
      highlight: GRPC.REQUEST_TAB_AUTH,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
        await selectMethodQuiet(ctx, GRPC_SECURE_ECHO_SEL);
        await openAuthTabQuiet(ctx);
        if (bearerTokenFieldValue() !== DEMO_BEARER_TOKEN) {
          await selectAuthTypeQuiet(ctx, 'bearer');
          fillBearerTokenField(DEMO_BEARER_TOKEN);
        }
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 700);
        await openAuthTabQuiet(ctx);
        await ctx.delay(300);

        await spotlightAndPause(ctx, GRPC.AUTH_TYPE_SELECT, 700);
        await selectAuthTypeQuiet(ctx, 'bearer');
        await ctx.delay(400);

        const tokenSel = '[data-testid="grpc-auth-bearer-token"]';
        await ctx.waitFor(tokenSel, 4_000).catch(() => undefined);
        const tokenEl = document.querySelector<HTMLElement>(tokenSel);
        if (tokenEl) {
          await spotlightElementAndPause(ctx, tokenEl, 600);
        }
        if (bearerTokenFieldValue() !== DEMO_BEARER_TOKEN) {
          fillBearerTokenField(DEMO_BEARER_TOKEN);
          await ctx.delay(350);
        }
        if (tokenEl) {
          await spotlightElementAndPause(ctx, tokenEl, 700);
        }

        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 12_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 15_000);
        }
        await ctx.delay(600);

        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 900);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 1_000);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 8 — Spring Servlet transport on :8080
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-spring-servlet',
      title: 'Same JVM, Second Door: Spring Servlet on :8080',
      description:
        'Open **Session settings → Transport** and switch to **Spring Servlet**. Change the target to ' +
        '`localhost:8080` — the same JVM\'s servlet port. No new **Reflect** is needed: the method schema stays ' +
        'loaded from the earlier reflect against `:9090`.\n\n' +
        'Re-select **Echo** (this fixture\'s HTTP bridge only implements that one method) and click **Send**. The ' +
        'browser now POSTs gRPC-Web-framed bytes directly to `/echo.EchoService/Echo` over plain HTTP/1.1 — no ' +
        'Node.js proxy hop, no HTTP/2 channel, yet the exact same response comes back.',
      highlight: GRPC.TRANSPORT_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await resetGrpcConnectionSettingsQuiet(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
        await selectMethodQuiet(ctx, GRPC_ECHO_METHOD_SEL);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 700);
        await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
        try {
          await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(500);

        await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), 700);
        await ctx.click(GRPC.SETTINGS_NAV_ITEM('transport'));
        try {
          await ctx.waitFor(GRPC.SETTINGS_PANEL('transport'), 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(500);

        if (!isTransportModeActive('spring-servlet')) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('spring-servlet'), 900);
          await ctx.click(GRPC.TRANSPORT_MODE('spring-servlet'));
          await ctx.delay(450);
        }
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('spring-servlet'), 1_000);

        await spotlightAndPause(ctx, GRPC.SETTINGS_CLOSE, 600);
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(600);

        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_SPRING_SERVLET_TARGET);
        await ctx.delay(700); // target change clears the tree — no re-reflect needed for servlet dispatch

        await selectMethodVisible(ctx, GRPC_ECHO_METHOD_SEL, { reflectFirst: false });

        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 12_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 15_000);
        }
        await ctx.delay(600);

        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 900);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 1_000);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 9 — {{grpcHost}} interpolation in the target field
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-target-interpolation',
      title: 'Interpolated Targets: {{grpcHost}}',
      description:
        'Switch back to **Express Proxy**, then replace the target with `{{grpcHost}}` — a template variable, not ' +
        'a literal address. gRPC Studio resolves it against the workspace\'s environment values and shows a live ' +
        '**interpolation preview** right under the field: the template on one side, the resolved ' +
        '`localhost:9090` on the other.\n\n' +
        'Click **Reflect** — the resolved value connects exactly like the literal address did earlier. This is a ' +
        'preview of the full workflow; switching entire environments (dev/staging/prod) for this same variable is ' +
        'the complete subject of the **Environments & Variables** lesson.',
      highlight: GRPC.INTERPOLATION_PREVIEW_STRIP,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await resetGrpcConnectionSettingsQuiet(ctx);
        await ensureTransportModeQuiet(ctx, 'express');
        upsertWorkspaceDefaults({ grpcHost: GRPC_SPRING_NETTY_TARGET });
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
      },
      action: async (ctx) => {
        upsertWorkspaceDefaults({ grpcHost: GRPC_SPRING_NETTY_TARGET });
        await ctx.delay(150);

        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
        await ctx.fill(GRPC.TARGET_INPUT, DEMO_GRPC_HOST_VAR);
        await ctx.delay(600);

        try {
          await ctx.waitFor(GRPC.INTERPOLATION_PREVIEW_STRIP, 4_000);
        } catch {
          await ctx.delay(600);
        }
        if (document.querySelector(GRPC.INTERPOLATION_PREVIEW_STRIP)) {
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_STRIP, 1_100);
          if (document.querySelector(GRPC.INTERPOLATION_PREVIEW_TEMPLATE)) {
            await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_TEMPLATE, 700);
          }
          if (document.querySelector(GRPC.INTERPOLATION_PREVIEW_VALUE)) {
            await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_VALUE, 900);
          }
        }

        await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 700);
        await ctx.click(GRPC.REFLECT_BTN);
        try {
          await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
        } catch {
          await ctx.delay(1_500);
        }
        await ctx.delay(500);
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 900);
      },
      verify: GRPC.TARGET_INPUT,
    },

    // -------------------------------------------------------------------------
    // Step 10 — Proto stubs mirror the Java service in the Schema Browser
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-proto-stubs',
      title: 'Schema Browser Mirrors the Java Service',
      description:
        'Restore the plain address and click **Manage Schemas**, then switch to the **Schema Browser** tab. Every ' +
        'service, message, and enum from the reflected descriptor is listed here — search for **Health** to find ' +
        '`health.v1.Health / Check`, then inspect its request/response types in the detail panel.\n\n' +
        'The fields match the Java `.proto` definition exactly: the `HealthCheckResponse.ServingStatus` enum ' +
        '(`UNKNOWN`, `SERVING`, `NOT_SERVING`) is the same enum the Health panel displayed as a plain **SERVING** ' +
        'label earlier — Schema Browser just shows the underlying wire contract behind that friendly text.',
      highlight: GRPC.MANAGE_SCHEMAS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        upsertWorkspaceDefaults({ grpcHost: '' });
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
        await reflectQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        if (document.querySelector(GRPC.TARGET_INPUT) && (document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT)?.value.trim() !== GRPC_SPRING_NETTY_TARGET)) {
          await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 600);
          await ctx.fill(GRPC.TARGET_INPUT, GRPC_SPRING_NETTY_TARGET);
          await ctx.delay(500);
          await reflectQuiet(ctx);
        }

        await spotlightAndPause(ctx, GRPC.MANAGE_SCHEMAS_BTN, 800);
        await ensureManageModalOpen(ctx);

        await spotlightAndPause(ctx, GRPC.PROTO_TAB_SCHEMA_BROWSER, 700);
        await ctx.click(GRPC.PROTO_TAB_SCHEMA_BROWSER);
        try {
          await ctx.waitFor(GRPC.SCHEMA_BROWSER, 10_000);
          await ctx.waitFor(GRPC.SCHEMA_BROWSER_TREE, 10_000);
        } catch {
          await ctx.delay(800);
        }
        await ctx.delay(500);

        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER_SEARCH, 600);
        await ctx.fill(GRPC.SCHEMA_BROWSER_SEARCH, 'Health');
        await ctx.delay(500);

        const healthNodeSel = GRPC.SCHEMA_TREE_NODE('method', 'health.v1.Health', 'Check');
        try {
          await ctx.waitFor(healthNodeSel, 6_000);
          await spotlightAndPause(ctx, healthNodeSel, 700);
          await ctx.click(healthNodeSel);
          await ctx.delay(600);
        } catch {
          // Fallback: search Echo instead if the Health node did not resolve.
          await ctx.fill(GRPC.SCHEMA_BROWSER_SEARCH, 'Echo');
          const echoNodeSel = GRPC.SCHEMA_TREE_NODE('method', 'echo.EchoService', 'Echo');
          try {
            await ctx.waitFor(echoNodeSel, 4_000);
            await ctx.click(echoNodeSel);
            await ctx.delay(600);
          } catch {
            // Best-effort — Schema Browser stays navigable even if node selection lags.
          }
        }

        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER_DETAIL, 1_200);

        await ctx.click(GRPC.PROTO_CANCEL_BTN);
        await ctx.delay(400);
      },
      verify: GRPC.CONNECTION_BAR,
    },
  ],
};
