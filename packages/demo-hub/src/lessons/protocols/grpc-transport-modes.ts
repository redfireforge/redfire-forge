/**
 * Lesson GRPC-19: Transport Modes — Express, gRPC-Web & Spring Servlet
 *
 * Covers why browsers cannot speak raw HTTP/2 gRPC, the four transport modes
 * gRPC Studio offers (Express Proxy, Tauri Native, gRPC-Web, Spring Servlet),
 * a live browser-direct call through an Envoy gRPC-Web sidecar, the graceful
 * "Retry with Express Proxy" fallback when browser-direct dispatch fails,
 * per-call gzip compression, and that transport configuration is per-tab.
 *
 *   grpc19-intro               — Transport panel tour: four mode cards, spotlighted in turn
 *   grpc19-express-baseline    — Express Proxy (default) — send the control-case call
 *   grpc19-grpc-web-live       — Switch to gRPC-Web, target the Envoy sidecar (:50055), send
 *   grpc19-grpc-web-fallback   — Same mode against :50051 fails → Retry with Express Proxy
 *   grpc19-spring-servlet-intro— Brief Spring Servlet mention (full walkthrough in Lesson 15)
 *   grpc19-compression         — Enable gzip request compression, inspect the live preview
 *   grpc19-per-tab             — Prove transport mode is configured independently per tab
 *   grpc19-tauri-native        — The fourth mode: Tauri Native (desktop only)
 */
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
  GRPC_ECHO_METHOD_SEL,
  GRPC_ECHO_SERVICE_SEL,
  closeGrpcSettingsDrawerQuiet,
  closeExtraGrpcTabsQuiet,
  ensureEchoMethodSelected,
  ensureGrpcStudioSubNavQuiet,
  ensureGrpcTarget,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  openGrpcSettingsDrawerQuiet,
  setGrpcTargetQuiet,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import type { DemoActionContext } from '../../types';

const GRPC19_ROSTER = getGrpcLessonRosterEntry('grpc-transport-modes')!;

/** Envoy gRPC-Web sidecar fixture (Phase 12D) — transcodes grpc-web ⇄ HTTP/2 for :50051. */
const GRPC_ENVOY_TARGET = 'localhost:50055';

type TransportMode = 'express' | 'tauri' | 'grpc-web' | 'spring-servlet';
const TRANSPORT_MODE_ORDER: TransportMode[] = ['express', 'tauri', 'grpc-web', 'spring-servlet'];

// ---------------------------------------------------------------------------
// Transport panel helpers (quiet — used from preAction guards)
// ---------------------------------------------------------------------------

/** True when `mode`'s card shows `aria-pressed="true"`. Caller must have the Transport panel open. */
function isTransportModeActive(mode: TransportMode): boolean {
  const btn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE(mode));
  return btn?.getAttribute('aria-pressed') === 'true';
}

/**
 * Quietly select `mode` in the Transport panel. Opens the settings drawer only
 * if the mode is not already active, and closes it again afterwards — so
 * sequential playback never flashes the drawer, and rapid-Next/restart
 * recovery gets exactly the state a step's preAction requires.
 */
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

/** Quietly disable compression (back to identity) if it is currently enabled. */
async function resetCompressionQuiet(ctx: DemoActionContext): Promise<void> {
  await openGrpcSettingsDrawerQuiet(ctx, 'compression');
  if (!document.querySelector(GRPC.COMPRESSION_PANEL)) return;
  const toggle = document.querySelector<HTMLButtonElement>(GRPC.COMPRESSION_ENABLED);
  if (toggle && toggle.getAttribute('aria-checked') === 'true') {
    toggle.click();
    await ctx.delay(200);
  }
  await closeGrpcSettingsDrawerQuiet(ctx);
}

/** Minimal nav guard: navigate to gRPC Studio, close overlays, ensure studio sub-nav. */
async function ensureStudioNav(ctx: DemoActionContext): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}

/** Quietly restore the well-known lesson baseline: Express, default target, no compression. */
async function resetTransportBaselineQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureStudioNav(ctx);
  await resetCompressionQuiet(ctx);
  await ensureTransportModeQuiet(ctx, 'express');
  await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
}

// ---------------------------------------------------------------------------
// Reflect + Echo selection on the *current* target (does not force the
// default target — required once the lesson points Studio at :50055/back).
// ---------------------------------------------------------------------------

async function ensureMessageFilledQuiet(ctx: DemoActionContext): Promise<void> {
  const field = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
  if (!field || field.value.trim()) return;
  field.focus();
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (nativeSet?.set) {
    nativeSet.set.call(field, GRPC_DEMO_MESSAGE);
  } else {
    field.value = GRPC_DEMO_MESSAGE;
  }
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await ctx.delay(150);
}

async function reflectAndSelectEchoQuiet(ctx: DemoActionContext): Promise<void> {
  const hasTree = Boolean(document.querySelector(GRPC.EXPLORER_TREE));
  if (!hasTree) {
    const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
    if (reflectBtn && !reflectBtn.disabled) {
      reflectBtn.click();
    }
    try {
      await ctx.waitFor(GRPC.EXPLORER_TREE, 12_000);
    } catch {
      // Best-effort — infra may be down in test stubs.
    }
    await ctx.delay(400);
  }

  if (!document.querySelector(GRPC.PROTO_FORM)) {
    // A fresh reflect on a new target/descriptor auto-expands every service, so
    // only click to expand when the method row is not already visible — an
    // unconditional click here would instead COLLAPSE an already-open group.
    if (!document.querySelector(GRPC_ECHO_METHOD_SEL)) {
      const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL);
      if (serviceBtn) {
        serviceBtn.click();
        await ctx.delay(350);
      }
    }
    const methodBtn = document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL);
    if (methodBtn) {
      methodBtn.click();
      try {
        await ctx.waitFor(GRPC.PROTO_FORM, 8_000);
      } catch {
        await ctx.delay(400);
      }
    }
  }
  await ensureMessageFilledQuiet(ctx);
}

/** Visible reflect + Echo selection (with spotlight pacing) for steps that re-teach it. */
async function reflectAndSelectEchoVisible(ctx: DemoActionContext): Promise<void> {
  await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 700);
  await ctx.click(GRPC.REFLECT_BTN);
  try {
    await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
  } catch {
    await ctx.delay(1_500);
  }
  await ctx.delay(500);
  await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 700);

  if (!document.querySelector(GRPC.PROTO_FORM)) {
    // Same "already expanded after fresh reflect" guard as the quiet variant —
    // only click the service row when the method row isn't visible yet.
    if (!document.querySelector(GRPC_ECHO_METHOD_SEL) && document.querySelector(GRPC_ECHO_SERVICE_SEL)) {
      await spotlightAndPause(ctx, GRPC_ECHO_SERVICE_SEL, 600);
      await ctx.click(GRPC_ECHO_SERVICE_SEL);
      try {
        await ctx.waitFor(GRPC_ECHO_METHOD_SEL, 5_000);
      } catch {
        await ctx.delay(400);
      }
    }
    if (document.querySelector(GRPC_ECHO_METHOD_SEL)) {
      await spotlightAndPause(ctx, GRPC_ECHO_METHOD_SEL, 600);
      await ctx.click(GRPC_ECHO_METHOD_SEL);
      try {
        await ctx.waitFor(GRPC.PROTO_FORM, 8_000);
      } catch {
        await ctx.delay(400);
      }
    }
  }
  await ensureMessageFilledQuiet(ctx);
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export const grpcTransportModesLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC19_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Discover why browsers cannot open a raw HTTP/2 gRPC channel, then compare all four ' +
    'RedfireForge transport modes: the universal Express Proxy, browser-direct gRPC-Web through ' +
    'an Envoy sidecar, Spring Servlet, and desktop-only Tauri Native — including the graceful ' +
    '"Retry with Express Proxy" fallback and per-tab transport isolation.',

  setup: async (ctx) => {
    await grpcFirstCallSetup(ctx);
    await resetTransportBaselineQuiet(ctx);
  },
  cleanup: async (ctx) => {
    await closeExtraGrpcTabsQuiet(ctx);
    await resetTransportBaselineQuiet(ctx);
    await grpcFirstCallCleanup(ctx);
  },

  grpc: buildGrpcContractMetaFromRoster(GRPC19_ROSTER),

  concept: {
    title: 'Transport Modes in gRPC Studio',
    body: `Browsers cannot open a raw HTTP/2 gRPC channel — the Fetch and XHR APIs don't expose the trailer frames and binary framing gRPC needs. RedfireForge solves this with **four transport modes**, chosen per gRPC Studio tab:

| Mode | How it works | Call types | Platform |
|---|---|---|---|
| 🌐 **Express Proxy** | Local Node.js server relays calls via \`@grpc/grpc-js\` — real HTTP/2 gRPC | Unary, server/client/bidi streaming | Web + Desktop |
| 🦀 **Tauri Native** | Rust \`tonic\` client — true HTTP/2, no Node hop | Unary, server/client/bidi streaming | Desktop only |
| 🌍 **gRPC-Web** | Browser \`fetch\` with grpc-web framing — needs a grpc-web-aware server or proxy (e.g. Envoy) | Unary, server streaming | Web (browser-direct) |
| 🌿 **Spring Servlet** | Browser \`fetch\` with an HTTP/1.1 POST to \`/echo.EchoService/Echo\` | Unary, server streaming | Web (browser-direct) |

**Why it matters:** Express Proxy always works, but browser-direct modes (gRPC-Web, Spring Servlet) skip the Node hop entirely — useful when the browser must reach a gRPC-Web-fronted service directly (e.g. through an ingress/sidecar) without running RedfireForge's own Node server.

**The safety net:** if a browser-direct call fails because the target doesn't actually support that framing, gRPC Studio offers **Retry with Express Proxy** right in the response panel — one click switches the tab back to the universal proxy and resends the call.

**Per-tab, not global:** transport mode lives on the gRPC Studio *tab*, exactly like the target address and TLS mode. Two tabs connected to different servers can use two different transports at the same time.

**What you will do in this lesson:**
1. **Tour** the Transport panel — four mode cards, one at a time.
2. **Send** the control-case call over Express Proxy (the default).
3. **Switch** to gRPC-Web and call the Envoy sidecar (\`:50055\`) — browser-direct, no Node hop.
4. **See it fail** against the raw gRPC port (\`:50051\`), then **Retry with Express Proxy**.
5. **Meet** Spring Servlet — a one-sentence introduction (full walkthrough in Lesson 15).
6. **Enable gzip** request compression and read the live header preview.
7. **Prove** transport is per-tab — a second tab keeps its own mode independently.
8. **Meet** the fourth mode, Tauri Native — desktop-only, full walkthrough in Lesson 15.`,
    keyTerms: [
      {
        term: 'Express Proxy',
        definition:
          'The default transport. RedfireForge\'s local Node.js server makes the real HTTP/2 gRPC call via @grpc/grpc-js and relays the result back to the browser. Works for every call type, on web and desktop.',
      },
      {
        term: 'gRPC-Web',
        definition:
          'A browser-compatible subset of the gRPC wire protocol. The browser sends a fetch request with grpc-web framing; the server (or a proxy like Envoy) must understand that framing to respond correctly.',
      },
      {
        term: 'Spring Servlet transport',
        definition:
          'A browser-direct mode that POSTs JSON to /ServiceName/MethodName (e.g. /echo.EchoService/Echo) over plain HTTP/1.1 — matches how Spring Boot gRPC servers behave in servlet mode.',
      },
      {
        term: 'Retry with Express Proxy',
        definition:
          'A button that appears in the response panel when a browser-direct call (gRPC-Web/Spring Servlet) fails in a way that suggests the target doesn\'t support that framing. Switches the tab to Express Proxy and resends automatically.',
      },
      {
        term: 'Tauri Native',
        definition:
          'Desktop-only transport using Rust tonic for a true native HTTP/2 gRPC channel with no Node.js process in between. Grayed out with a "Desktop only" reason in the web app.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 340" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc19-arr-b" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc19-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpc19-arr-p" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#a855f7"/>
    </marker>
  </defs>

  <text x="20" y="24" font-size="12" fill="#f1f5f9">Browser (gRPC Studio)</text>
  <rect x="14" y="34" width="180" height="270" rx="8" fill="#0f172a" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="104" y="56" text-anchor="middle" font-size="10" fill="#a8b8cc">Studio tab</text>
  <rect x="30" y="66" width="148" height="26" rx="5" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="104" y="83" text-anchor="middle" font-size="9" fill="#93c5fd">🌐 Express Proxy</text>
  <rect x="30" y="100" width="148" height="26" rx="5" fill="#1e293b" stroke="#3b4a60"/>
  <text x="104" y="117" text-anchor="middle" font-size="9" fill="#64748b">🦀 Tauri Native</text>
  <rect x="30" y="134" width="148" height="26" rx="5" fill="#052e16" stroke="#22c55e"/>
  <text x="104" y="151" text-anchor="middle" font-size="9" fill="#4ade80">🌍 gRPC-Web</text>
  <rect x="30" y="168" width="148" height="26" rx="5" fill="#1a0533" stroke="#a855f7"/>
  <text x="104" y="185" text-anchor="middle" font-size="9" fill="#d8b4fe">🌿 Spring Servlet</text>
  <text x="30" y="220" font-size="7.5" fill="#64748b">Fetch cannot open raw</text>
  <text x="30" y="232" font-size="7.5" fill="#64748b">HTTP/2 gRPC — every mode</text>
  <text x="30" y="244" font-size="7.5" fill="#64748b">above works around that.</text>

  <!-- Express path -->
  <line x1="194" y1="79" x2="330" y2="79" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc19-arr-b)"/>
  <text x="200" y="72" font-size="7.5" fill="#93c5fd">HTTP/2 (@grpc/grpc-js)</text>
  <rect x="332" y="60" width="150" height="38" rx="6" fill="#0d1520" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="407" y="76" text-anchor="middle" font-size="9" fill="#93c5fd">Node.js Express</text>
  <text x="407" y="90" text-anchor="middle" font-size="8" fill="#64748b">local proxy :3001</text>
  <line x1="482" y1="79" x2="560" y2="79" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc19-arr-b)"/>

  <!-- gRPC-Web path -->
  <line x1="194" y1="147" x2="330" y2="147" stroke="#22c55e" stroke-width="1.4" marker-end="url(#grpc19-arr-g)"/>
  <text x="200" y="140" font-size="7.5" fill="#4ade80">fetch + grpc-web framing</text>
  <rect x="332" y="128" width="150" height="38" rx="6" fill="#031a0d" stroke="#22c55e" stroke-width="1.2"/>
  <text x="407" y="144" text-anchor="middle" font-size="9" fill="#4ade80">Envoy sidecar</text>
  <text x="407" y="158" text-anchor="middle" font-size="8" fill="#64748b">grpc-web transcode :50055</text>
  <line x1="482" y1="147" x2="560" y2="147" stroke="#22c55e" stroke-width="1.4" marker-end="url(#grpc19-arr-g)"/>

  <!-- Spring Servlet path -->
  <line x1="194" y1="181" x2="330" y2="181" stroke="#a855f7" stroke-width="1.4" marker-end="url(#grpc19-arr-p)"/>
  <text x="200" y="200" font-size="7.5" fill="#d8b4fe">HTTP/1.1 POST /svc/method</text>
  <rect x="332" y="196" width="150" height="34" rx="6" fill="#1a0533" stroke="#a855f7" stroke-width="1"/>
  <text x="407" y="217" text-anchor="middle" font-size="8.5" fill="#d8b4fe">Spring Boot servlet</text>

  <!-- Target -->
  <rect x="562" y="60" width="120" height="106" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="622" y="80" text-anchor="middle" font-size="9.5" fill="#f1f5f9">echo.EchoService</text>
  <text x="622" y="96" text-anchor="middle" font-size="8" fill="#64748b">Go gRPC server</text>
  <text x="622" y="112" text-anchor="middle" font-size="8" fill="#64748b">:50051</text>

  <!-- Retry fallback callout -->
  <rect x="330" y="248" width="330" height="70" rx="6" fill="#2b1206" stroke="#f59e0b" stroke-width="1.2"/>
  <text x="345" y="266" font-size="9" fill="#fbbf24">⚠ gRPC-Web → :50051 (no grpc-web support)</text>
  <text x="345" y="282" font-size="8" fill="#fcd34d">Browser fetch fails — protocol mismatch</text>
  <rect x="345" y="290" width="180" height="18" rx="4" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="435" y="303" text-anchor="middle" font-size="8" fill="#93c5fd">Retry with Express Proxy</text>

  <text x="350" y="24" text-anchor="middle" font-size="11" fill="#a8b8cc">One target, three ways in — plus the Express safety net</text>
</svg>`,
  },

  steps: [
    // -------------------------------------------------------------------------
    // Step 1 — Transport panel tour
    // -------------------------------------------------------------------------
    {
      id: 'grpc19-intro',
      title: 'Why Browsers Need a Transport Mode',
      description:
        'Browsers cannot open a raw HTTP/2 gRPC channel — `fetch` and `XMLHttpRequest` don\'t expose the trailer ' +
        'frames gRPC relies on. Every RedfireForge transport mode works around that limitation differently.\n\n' +
        'Open **Session settings → Transport** to see all four. Each card is spotlighted in turn below:\n\n' +
        '- 🌐 **Express Proxy** — the local Node.js server makes the real call (default, works everywhere)\n' +
        '- 🦀 **Tauri Native** — desktop-only, grayed out here in the web app\n' +
        '- 🌍 **gRPC-Web** — the browser talks directly to a grpc-web-aware server or proxy\n' +
        '- 🌿 **Spring Servlet** — the browser POSTs directly to a Spring Boot servlet endpoint\n\n' +
        'gRPC-Web and Spring Servlet skip the Node hop entirely, but only support **unary and server-streaming** ' +
        'calls — client and bidi streaming still need Express Proxy or Tauri Native.',
      highlight: GRPC.CONNECTION_SETTINGS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await ensureGrpcTarget(ctx);
        await ensureEchoMethodSelected(ctx);
        await resetTransportBaselineQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 800);
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
        await ctx.delay(500); // panel opened — read the section intro

        // Spotlight each of the four mode cards, one at a time — the hold on
        // each is the digest pause the viewer needs before the next card.
        for (const mode of TRANSPORT_MODE_ORDER) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE(mode), 850);
        }

        // Land back on the default before closing.
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 700);
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(500);
      },
      verify: GRPC.CONNECTION_BAR,
    },

    // -------------------------------------------------------------------------
    // Step 2 — Express Proxy baseline
    // -------------------------------------------------------------------------
    {
      id: 'grpc19-express-baseline',
      title: 'Express Proxy: the Universal Default',
      description:
        'Open **Session settings → Transport** and confirm **Express Proxy** is selected — the card explains that ' +
        'RedfireForge\'s local Node.js server relays every call via `@grpc/grpc-js` (real HTTP/2 gRPC).\n\n' +
        'With that mode active, sending Echo to `localhost:50051` routes through that Node hop and returns the ' +
        'result here. This is the **control case** — Express Proxy works against any gRPC server, with any call ' +
        'type, on both web and desktop. Keep this response in mind: the next steps repeat the same call over ' +
        'different transports.',
      highlight: GRPC.TRANSPORT_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
        await reflectAndSelectEchoQuiet(ctx);
      },
      action: async (ctx) => {
        // Make Express Proxy visible before Send — viewers need time to read the card copy.
        await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 700);
        await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
        try {
          await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(600);

        await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), 700);
        await ctx.click(GRPC.SETTINGS_NAV_ITEM('transport'));
        try {
          await ctx.waitFor(GRPC.SETTINGS_PANEL('transport'), 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(500);

        if (!isTransportModeActive('express')) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 800);
          await ctx.click(GRPC.TRANSPORT_MODE('express'));
          await ctx.delay(450);
        }
        // Hold on the selected card so the viewer can read the Node.js relay explanation.
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 1_200);
        if (document.querySelector(GRPC.TRANSPORT_MODE_REASON('express'))) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE_REASON('express'), 900);
        }

        await spotlightAndPause(ctx, GRPC.SETTINGS_CLOSE, 600);
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(700);

        await ensureMessageFilledQuiet(ctx);
        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 12_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 15_000);
        }
        await ctx.delay(600);

        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 900);
        await spotlightAndPause(ctx, GRPC.RESPONSE_TARGET, 800);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 3 — gRPC-Web live call through the Envoy sidecar
    // -------------------------------------------------------------------------
    {
      id: 'grpc19-grpc-web-live',
      title: 'gRPC-Web: Browser-Direct via Envoy',
      description:
        'Switch **Transport** to **gRPC-Web**, then point the target at `localhost:50055` — an Envoy sidecar that ' +
        'transcodes grpc-web framing to the real backend at `:50051`.\n\n' +
        'Changing the target **clears the service tree**, so gRPC Studio needs **Reflect** again before Echo can ' +
        'run (reflection itself always travels through Express, regardless of the selected transport — only the ' +
        '**call** dispatch uses gRPC-Web here).\n\n' +
        'Click **Send**. The call succeeds — but this time the browser opened the connection itself; there is no ' +
        'Node.js process in the path at all.',
      highlight: GRPC.TRANSPORT_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
      },
      action: async (ctx) => {
        // Switch transport visibly — viewers need to see gRPC-Web selected before the target change.
        await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 700);
        await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
        try {
          await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(600);

        await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), 700);
        await ctx.click(GRPC.SETTINGS_NAV_ITEM('transport'));
        try {
          await ctx.waitFor(GRPC.SETTINGS_PANEL('transport'), 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(500);

        if (!isTransportModeActive('grpc-web')) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('grpc-web'), 800);
          await ctx.click(GRPC.TRANSPORT_MODE('grpc-web'));
          await ctx.delay(450);
        }
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('grpc-web'), 900); // active card — read before closing
        await spotlightAndPause(ctx, GRPC.SETTINGS_CLOSE, 600);
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(700);

        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_ENVOY_TARGET);
        await ctx.delay(800); // target change clears the tree — let connection + invalidation settle

        await reflectAndSelectEchoVisible(ctx);

        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 15_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 20_000);
        }
        await ctx.delay(600);

        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 900);
        await spotlightAndPause(ctx, GRPC.RESPONSE_TARGET, 900);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 4 — gRPC-Web fails on a non-grpc-web server → Retry with Express
    // -------------------------------------------------------------------------
    {
      id: 'grpc19-grpc-web-fallback',
      title: 'Graceful Degradation: Retry with Express Proxy',
      description:
        'Still in **gRPC-Web** mode, switch the target back to `localhost:50051` — the raw gRPC port, with no ' +
        'grpc-web support. Reflect succeeds (it always goes through Express), so the service tree loads normally.\n\n' +
        'Click **Send**. This time the browser\'s `fetch` cannot complete a grpc-web handshake against a plain ' +
        'HTTP/2 gRPC port, so the call fails. gRPC Studio recognizes this as a **browser transport failure** and ' +
        'shows a **Retry with Express Proxy** button right in the response panel, along with a hint explaining why ' +
        'the mismatch happened.\n\n' +
        'Click **Retry with Express Proxy** — the tab switches to Express Proxy and resends automatically. The ' +
        'exact same Echo call now succeeds. This is the safety net: browser-direct modes are opt-in, never a dead end.',
      highlight: GRPC.RETRY_EXPRESS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await ensureTransportModeQuiet(ctx, 'grpc-web');
        await setGrpcTargetQuiet(ctx, GRPC_ENVOY_TARGET);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_DEMO_TARGET);
        await ctx.delay(450);

        await reflectAndSelectEchoVisible(ctx);

        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        await ctx.click(GRPC.SEND_BTN);
        // A grpc-web fetch() against a plain HTTP/2 gRPC port doesn't fail fast — it
        // rides out the full 30s default call timeout before the browser transport
        // failure is classified and rendered. Wait comfortably past that.
        await ctx.waitFor(`${GRPC.RESPONSE_ERROR_PANEL}, ${GRPC.RETRY_EXPRESS_BTN}`, 35_000);
        await ctx.delay(500);

        // Read the failure, then the transport-specific hint explaining why.
        await spotlightAndPause(ctx, GRPC.RESPONSE_ERROR_MESSAGE, 1_000);
        if (document.querySelector(GRPC.RESPONSE_BROWSER_TRANSPORT_HINT)) {
          await spotlightAndPause(ctx, GRPC.RESPONSE_BROWSER_TRANSPORT_HINT, 1_000);
        }

        // The retry button can lag slightly behind the error panel/message — give it
        // its own short grace window rather than a single point-in-time check.
        if (!document.querySelector(GRPC.RETRY_EXPRESS_BTN)) {
          await ctx.waitFor(GRPC.RETRY_EXPRESS_BTN, 8_000);
        }

        // The safety net — spotlight, then click.
        if (document.querySelector(GRPC.RETRY_EXPRESS_BTN)) {
          await spotlightAndPause(ctx, GRPC.RETRY_EXPRESS_BTN, 900);
          await ctx.click(GRPC.RETRY_EXPRESS_BTN);
          await ctx.waitFor(GRPC.RESPONSE_BODY, 15_000);
          await ctx.delay(600);
          await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 1_100);
        }
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 5 — Spring Servlet: brief introduction (full lesson is L15)
    // -------------------------------------------------------------------------
    {
      id: 'grpc19-spring-servlet-intro',
      title: 'Spring Servlet: One More Browser-Direct Option',
      description:
        'The fourth browser-reachable mode is **Spring Servlet** — instead of grpc-web framing, the browser sends ' +
        'a plain HTTP/1.1 `POST` to `/echo.EchoService/Echo` (path pattern: `/ServiceName/MethodName`), matching how a Spring Boot gRPC server behaves in ' +
        'servlet mode. Like gRPC-Web, it supports unary and server-streaming calls without a Node.js hop.\n\n' +
        'This lesson only introduces the option — connecting to a live Spring Boot server, enabling reflection in ' +
        '`application.yml`, and comparing Netty vs. Servlet transport is the full subject of **Lesson 15**.',
      highlight: GRPC.TRANSPORT_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
      },
      action: async (ctx) => {
        await openGrpcSettingsDrawerQuiet(ctx, 'transport');
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('spring-servlet'), 900);
        await ctx.click(GRPC.TRANSPORT_MODE('spring-servlet'));
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('spring-servlet'), 900); // now active
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(500);
      },
      verify: GRPC.CONNECTION_BAR,
    },

    // -------------------------------------------------------------------------
    // Step 6 — gzip compression
    // -------------------------------------------------------------------------
    {
      id: 'grpc19-compression',
      title: 'Compression: gzip Request Encoding',
      description:
        'Open **Session settings → Compression**. Toggling **Enable compression** on reveals the algorithm picker ' +
        '— select **gzip**.\n\n' +
        'The **Effective headers** preview updates immediately to `grpc-encoding: gzip`, showing exactly what the ' +
        'next call will send — no need to guess or inspect network traffic to confirm it.\n\n' +
        'This is switched back to Express Proxy first, because compression is negotiated at the HTTP/2 gRPC layer ' +
        '— it is most reliably demonstrated over the proxy that speaks real gRPC end to end.',
      highlight: GRPC.COMPRESSION_PREVIEW,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
        await reflectAndSelectEchoQuiet(ctx);
      },
      action: async (ctx) => {
        await openGrpcSettingsDrawerQuiet(ctx, 'compression');
        await spotlightAndPause(ctx, GRPC.COMPRESSION_ENABLED, 700);
        const toggle = document.querySelector<HTMLButtonElement>(GRPC.COMPRESSION_ENABLED);
        if (toggle && toggle.getAttribute('aria-checked') !== 'true') {
          await ctx.click(GRPC.COMPRESSION_ENABLED);
          await ctx.delay(600); // form reveals the algorithm picker
        }

        await spotlightAndPause(ctx, GRPC.COMPRESSION_ALGORITHM, 600);
        await ctx.selectOption(GRPC.COMPRESSION_ALGORITHM, 'gzip');
        await ctx.delay(450);

        await spotlightAndPause(ctx, GRPC.COMPRESSION_PREVIEW, 1_100); // the payoff — read the header

        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(500);

        await ensureMessageFilledQuiet(ctx);
        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 12_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 15_000);
        }
        await ctx.delay(600);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 900);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 7 — Transport is per-tab
    // -------------------------------------------------------------------------
    {
      id: 'grpc19-per-tab',
      title: 'Transport Is Configured Per Tab',
      description:
        'Transport mode lives on the **tab**, exactly like the target address. Confirm tab 1 still shows ' +
        '**Express Proxy**, then click **+ New tab**.\n\n' +
        'On the new tab, switch **Transport** to **gRPC-Web** — this only affects the new tab.\n\n' +
        'Switch back to the **first tab** and reopen **Transport**: it still reads **Express Proxy**, completely ' +
        'unaffected by the second tab\'s setting. Two tabs, two independent transport configurations, one Studio ' +
        'window. The extra tab is then closed to keep the workspace tidy for the next step.',
      highlight: GRPC.ADD_TAB,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await closeExtraGrpcTabsQuiet(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
      },
      action: async (ctx) => {
        // Confirm tab 1's baseline before branching.
        await openGrpcSettingsDrawerQuiet(ctx, 'transport');
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 800);
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(500);

        const tabBar = document.querySelector<HTMLElement>(GRPC.TAB_BAR);
        const firstTabId = tabBar
          ?.querySelector<HTMLElement>('[role="tab"]')
          ?.getAttribute('data-testid') ?? null;

        // Add the second tab.
        await spotlightAndPause(ctx, GRPC.ADD_TAB, 800);
        const addBtn = document.querySelector<HTMLButtonElement>(GRPC.ADD_TAB);
        if (addBtn && !addBtn.disabled) {
          await ctx.click(GRPC.ADD_TAB);
          await ctx.delay(400);
        }

        const tabsAfterAdd = tabBar ? Array.from(tabBar.querySelectorAll<HTMLElement>('[role="tab"]')) : [];
        const secondTab = tabsAfterAdd.find(
          (tab) => tab.getAttribute('data-testid') !== firstTabId,
        ) ?? null;
        if (secondTab) {
          await spotlightElementAndPause(ctx, secondTab, 700);
        }

        // Switch the new tab to gRPC-Web.
        await openGrpcSettingsDrawerQuiet(ctx, 'transport');
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('grpc-web'), 800);
        await ctx.click(GRPC.TRANSPORT_MODE('grpc-web'));
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('grpc-web'), 800); // now active on tab 2
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(500);

        // Switch back to tab 1 and reveal it kept its own setting.
        if (firstTabId) {
          await spotlightAndPause(ctx, GRPC.TAB(firstTabId), 700);
          await ctx.click(GRPC.TAB(firstTabId));
          await ctx.delay(400);
        }
        await openGrpcSettingsDrawerQuiet(ctx, 'transport');
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 1_100); // the reveal
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(500);

        // Tidy up — close the second tab so the workspace returns to one tab.
        if (secondTab) {
          const secondTabId = secondTab.getAttribute('data-testid');
          if (secondTabId) {
            await spotlightAndPause(ctx, GRPC.TAB_CLOSE(secondTabId), 700);
            const closeBtn = document.querySelector<HTMLButtonElement>(GRPC.TAB_CLOSE(secondTabId));
            if (closeBtn && !closeBtn.disabled) {
              await ctx.click(GRPC.TAB_CLOSE(secondTabId));
              await ctx.delay(350);
            }
          }
        }
      },
      verify: GRPC.TAB_BAR,
    },

    // -------------------------------------------------------------------------
    // Step 8 — The fourth mode: Tauri Native (desktop only)
    // -------------------------------------------------------------------------
    {
      id: 'grpc19-tauri-native',
      title: 'The Fourth Mode: Tauri Native (Desktop)',
      description:
        'One mode is left: **Tauri Native**. It uses Rust `tonic` for a true native HTTP/2 gRPC channel with no ' +
        'Node.js process at all — the fastest option, but only available in the desktop app.\n\n' +
        'In the web app the card is grayed out with a **"Desktop only"** reason label — that is expected, not a ' +
        'bug. In the desktop (Tauri) build the same card is selectable like any other mode.\n\n' +
        'A full walkthrough — channel diagnostics, native streaming, and the Mock Network Listener — is in ' +
        '**Lesson 15 (Tauri Desktop)**. That closes the tour: four transports, one universal safety net.',
      highlight: GRPC.TRANSPORT_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
        await ensureTransportModeQuiet(ctx, 'express');
      },
      action: async (ctx) => {
        await openGrpcSettingsDrawerQuiet(ctx, 'transport');
        const tauriBtn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('tauri'));

        if (tauriBtn && !tauriBtn.disabled) {
          // Desktop (Tauri) — the card is selectable; show it going active, then restore Express.
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('tauri'), 900);
          await ctx.click(GRPC.TRANSPORT_MODE('tauri'));
          await ctx.delay(400);
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('tauri'), 1_000);
          await ctx.click(GRPC.TRANSPORT_MODE('express'));
          await ctx.delay(400);
        } else {
          // Web — spotlight the disabled card, then its "Desktop only" reason label.
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('tauri'), 900);
          if (document.querySelector(GRPC.TRANSPORT_MODE_REASON('tauri'))) {
            await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE_REASON('tauri'), 1_000);
          }
        }

        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(500);
      },
      verify: GRPC.CONNECTION_BAR,
    },
  ],
};
