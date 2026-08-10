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
 *   grpc19-express-baseline    — Express Proxy (default) — fill Form Input, send control-case call
 *   grpc19-grpc-web-live       — Switch to gRPC-Web, target Envoy sidecar (:50055), reflect, fill Form Input, send
 *   grpc19-grpc-web-fallback   — Same mode against :50051 fails → Retry with Express Proxy
 *   grpc19-spring-servlet-intro— Brief Spring Servlet mention (full walkthrough in Lesson 7)
 *   grpc19-compression         — Enable gzip request compression, inspect live preview, send from Form Input
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
import { grpcTransportModesConcept } from './grpc-transport-modes.content';
import {
  GRPC_DEMO_MESSAGE,
  GRPC_DEMO_TARGET,
  GRPC_ECHO_METHOD_SEL,
  GRPC_ECHO_SERVICE_SEL,
  closeGrpcSettingsDrawerQuiet,
  closeExtraGrpcTabsQuiet,
  ensureGrpcRequestFormTabQuiet,
  ensureGrpcStudioSubNavQuiet,
  fillGrpcEchoMessage,
  grpcEchoComposerFieldSelector,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  isGrpcEchoComposerReady,
  isGrpcHybridComposerActive,
  openGrpcSettingsDrawerQuiet,
  setGrpcTargetQuiet,
  setInputValueAndDispatch,
  spotlightAndPause,
  spotlightElementAndPause,
  spotlightGrpcRequestComposer,
  spotlightResponseJsonContentTight,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import { ensureMessageFilledQuiet } from './grpc-spring-boot-helpers';
import { resetGrpcActiveTabTransport } from '../../adapters';
import type { DemoActionContext } from '../../types';

const GRPC19_ROSTER = getGrpcLessonRosterEntry('grpc-transport-modes')!;

/** Envoy gRPC-Web sidecar fixture (Phase 12D) — transcodes grpc-web ⇄ HTTP/2 for :50051. */
const GRPC_ENVOY_TARGET = 'localhost:50055';

// Human-speed pacing for this lesson so viewers can track each visual beat.
const GRPC19_SPOTLIGHT_MS = 1_000;
const GRPC19_SWITCH_MS = 850;
const GRPC19_SETTLE_MS = 700;
const GRPC19_PAYOFF_MS = 1_200;

type TransportMode = 'express' | 'tauri' | 'grpc-web' | 'spring-servlet';

// ---------------------------------------------------------------------------
// Transport panel helpers (quiet — used from preAction guards)
// ---------------------------------------------------------------------------

/** True when `mode`'s card shows `aria-pressed="true"`. Caller must have the Transport panel open. */
function isTransportModeActive(mode: TransportMode): boolean {
  const btn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE(mode));
  return btn?.getAttribute('aria-pressed') === 'true';
}

/** Minimal nav guard: navigate to gRPC Studio, close overlays, ensure studio sub-nav. */
async function ensureStudioNav(ctx: DemoActionContext): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}

/** Quietly restore the well-known lesson baseline: Express, default target, no compression.
 * Opens the settings drawer only once — batching compression and transport resets so the
 * drawer never flickers on screen more than one time during preAction setup.
 */
async function resetTransportBaselineQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureStudioNav(ctx);

  // Fast path: if the connection-bar transport badge already reads Express, the
  // demo tab is at baseline and there is nothing to reset.
  const transportBadge = document.querySelector<HTMLElement>(GRPC.TRANSPORT_BADGE);
  if (transportBadge?.className.includes('grpc-connection-transport-badge--express')) {
    await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
    return;
  }

  // Programmatic path: patch transport + compression via the bridge so we never
  // open the Session Settings drawer.  The drawer open/close cycle is exactly the
  // "quick unnecessary modal popup" the viewer sees flashing before narration.
  if (resetGrpcActiveTabTransport('express')) {
    await ctx.delay(200);
    await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
    return;
  }

  // Fallback (bridge unavailable): open the drawer once and do both resets.
  await openGrpcSettingsDrawerQuiet(ctx, 'compression');
  if (document.querySelector(GRPC.COMPRESSION_PANEL)) {
    const toggle = document.querySelector<HTMLButtonElement>(GRPC.COMPRESSION_ENABLED);
    if (toggle && toggle.getAttribute('aria-checked') === 'true') {
      toggle.click();
      await ctx.delay(200);
    }
  }
  const transportNavBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('transport'));
  if (transportNavBtn) {
    transportNavBtn.click();
    try {
      await ctx.waitFor(GRPC.SETTINGS_PANEL('transport'), 3_000);
    } catch { /* fall through */ }
    await ctx.delay(200);
    if (!isTransportModeActive('express')) {
      const btn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('express'));
      if (btn && !btn.disabled) {
        btn.click();
        await ctx.delay(250);
      }
    }
  }
  await closeGrpcSettingsDrawerQuiet(ctx);
  await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
}

// ---------------------------------------------------------------------------
// Silent reflect + Echo selection — plain DOM clicks, no viewer ripple.
//
// The shared `ensureEchoMethodSelected` and `ensureGrpcReflected` both use
// `ctx.click()` which draws demo ripples. In a preAction those ripples are
// the "quick unnecessary highlights" the viewer sees flashing before the
// narration. This local helper does the exact same work with plain DOM
// `.click()` calls, and short-circuits when the composer is already ready
// (the common sequential-playback case).
// ---------------------------------------------------------------------------

async function reflectAndSelectEchoSilent(ctx: DemoActionContext): Promise<void> {
  // Already ready — fast path for sequential playback.
  if (isGrpcEchoComposerReady()) {
    await ensureGrpcRequestFormTabQuiet(ctx);
    return;
  }

  // Reflect if the service tree is not populated.
  if (!document.querySelector(GRPC.EXPLORER_TREE) && !document.querySelector(GRPC.EXPLORER_SOURCE)) {
    const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
    if (reflectBtn && !reflectBtn.disabled) {
      reflectBtn.click();
    }
    try {
      await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_SOURCE}`, 12_000);
    } catch { /* remain navigable */ }
    await ctx.delay(200);
  }

  // Expand service if needed, then select the Echo method.
  if (!document.querySelector(GRPC_ECHO_METHOD_SEL)) {
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL);
    if (serviceBtn) {
      serviceBtn.click();
      await ctx.delay(200);
    }
  }
  const methodBtn = document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL);
  if (methodBtn) {
    methodBtn.click();
    try {
      await ctx.waitFor(GRPC.REQUEST_FORM_SCROLL, 8_000);
      await ctx.waitFor(grpcEchoComposerFieldSelector(), 8_000);
    } catch { /* best effort */ }
    await ctx.delay(200);
  }

  await ensureGrpcRequestFormTabQuiet(ctx);

  // Fill the Echo message if not already present.
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(grpcEchoComposerFieldSelector());
  if (field && !field.value.trim()) {
    setInputValueAndDispatch(field, isGrpcHybridComposerActive()
      ? JSON.stringify({ message: GRPC_DEMO_MESSAGE }, null, 2)
      : GRPC_DEMO_MESSAGE);
    await ctx.delay(150);
  }
}

/** Visible reflect + Echo selection (with spotlight pacing) for steps that re-teach it. */
/** Visible Session settings → Transport (spotlight each beat before interacting). */
async function openTransportPanelVisible(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GRPC.SETTINGS_DRAWER)) {
    await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, GRPC19_SPOTLIGHT_MS);
    await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
    try {
      await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
    } catch {
      await ctx.delay(GRPC19_SETTLE_MS);
    }
    await ctx.delay(GRPC19_SETTLE_MS);
  }

  await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), GRPC19_SWITCH_MS);
  const transportNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('transport'));
  if (transportNav) {
    transportNav.click();
    try {
      await ctx.waitFor(GRPC.SETTINGS_PANEL('transport'), 3_000);
    } catch {
      await ctx.delay(GRPC19_SETTLE_MS);
    }
  }
  await ctx.delay(GRPC19_SETTLE_MS);
  // No whole-panel spotlight here — the nav tab spotlight already oriented the
  // viewer, and the caller spotlights individual mode cards next. A ring around
  // the entire Transport section is redundant and visually noisy.
}

/** Visible Session settings → Compression (spotlight each beat before interacting). */
async function openCompressionPanelVisible(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GRPC.SETTINGS_DRAWER)) {
    await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, GRPC19_SPOTLIGHT_MS);
    await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
    try {
      await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
    } catch {
      await ctx.delay(GRPC19_SETTLE_MS);
    }
    await ctx.delay(GRPC19_SETTLE_MS);
  }

  await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('compression'), GRPC19_SWITCH_MS);
  const compressionNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('compression'));
  if (compressionNav) {
    compressionNav.click();
    try {
      await ctx.waitFor(GRPC.SETTINGS_PANEL('compression'), 3_000);
    } catch {
      await ctx.delay(GRPC19_SETTLE_MS);
    }
  }
  await ctx.delay(GRPC19_SETTLE_MS);
}

async function closeSettingsDrawerVisible(ctx: DemoActionContext): Promise<void> {
  await spotlightAndPause(ctx, GRPC.SETTINGS_CLOSE, GRPC19_SWITCH_MS);
  await ctx.click(GRPC.SETTINGS_CLOSE);
  await ctx.delay(GRPC19_SETTLE_MS);
}

async function reflectAndSelectEchoVisible(ctx: DemoActionContext): Promise<void> {
  const treeReady = Boolean(document.querySelector(GRPC.EXPLORER_TREE));
  const composerReady = isGrpcEchoComposerReady();

  await spotlightAndPause(ctx, GRPC.REFLECT_BTN, GRPC19_SPOTLIGHT_MS);

  if (!treeReady) {
    await ctx.click(GRPC.REFLECT_BTN);
    try {
      await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
    } catch {
      await ctx.delay(GRPC19_SETTLE_MS);
    }
    await ctx.delay(GRPC19_SETTLE_MS);
  }

  await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, GRPC19_SPOTLIGHT_MS);

  if (!composerReady) {
    if (!document.querySelector(GRPC_ECHO_METHOD_SEL) && document.querySelector(GRPC_ECHO_SERVICE_SEL)) {
      await spotlightAndPause(ctx, GRPC_ECHO_SERVICE_SEL, GRPC19_SWITCH_MS);
      await ctx.click(GRPC_ECHO_SERVICE_SEL);
      try {
        await ctx.waitFor(GRPC_ECHO_METHOD_SEL, 5_000);
      } catch {
        await ctx.delay(GRPC19_SETTLE_MS);
      }
    }
    if (document.querySelector(GRPC_ECHO_METHOD_SEL)) {
      await spotlightAndPause(ctx, GRPC_ECHO_METHOD_SEL, GRPC19_SWITCH_MS);
      await ctx.click(GRPC_ECHO_METHOD_SEL);
      try {
        await ctx.waitFor(GRPC.REQUEST_FORM_SCROLL, 8_000);
        await ctx.waitFor(grpcEchoComposerFieldSelector(), 8_000);
      } catch {
        await ctx.delay(GRPC19_SETTLE_MS);
      }
    }
    await ensureGrpcRequestFormTabQuiet(ctx);
  } else {
    await ensureGrpcRequestFormTabQuiet(ctx);
    if (document.querySelector(GRPC_ECHO_METHOD_SEL)) {
      await spotlightAndPause(ctx, GRPC_ECHO_METHOD_SEL, GRPC19_SWITCH_MS);
    }
  }

  await fillGrpcEchoMessage(ctx);
  // Wait for React to settle after method selection + fill.  Auto-reflection
  // or a deferred re-render from the method click can clobber the fill.
  // Retry up to 3 times so the spotlight never lands on an empty body.
  for (let attempt = 0; attempt < 3; attempt++) {
    await ctx.delay(400);
    const textarea = document.querySelector<HTMLTextAreaElement>(GRPC.REQUEST_JSON);
    if (textarea && textarea.value.includes(GRPC_DEMO_MESSAGE)) break;
    await fillGrpcEchoMessage(ctx);
  }
  await spotlightGrpcRequestComposer(ctx);
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
    // Skip the Manage Schemas draft reset — this lesson only covers transport
    // modes, never schema sources. Running it would open/close the Manage Schemas
    // modal (cycling Proto Files/Protoset/URL/BSR sub-tabs) for every tab, which
    // the viewer sees as a burst of modals flashing on and off before step 1.
    await grpcFirstCallSetup(ctx, { resetSchemaDrafts: false });
    await resetTransportBaselineQuiet(ctx);
  },
  cleanup: async (ctx) => {
    await closeExtraGrpcTabsQuiet(ctx);
    await resetTransportBaselineQuiet(ctx);
    await grpcFirstCallCleanup(ctx);
  },

  grpc: buildGrpcContractMetaFromRoster(GRPC19_ROSTER),

  concept: grpcTransportModesConcept,

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
        'Open **Session settings → Transport** to see all four. This step spotlights only the key cards:\n\n' +
        '- 🌐 **Express Proxy** — the local Node.js server makes the real call (default, works everywhere)\n' +
        '- 🦀 **Tauri Native** — desktop-only, grayed out here in the web app\n' +
        '- 🌍 **gRPC-Web** — the browser talks directly to a grpc-web-aware server or proxy\n' +
        '- 🌿 **Spring Servlet** — the browser POSTs directly to a Spring Boot servlet endpoint\n\n' +
        'gRPC-Web and Spring Servlet skip the Node hop entirely, but only support **unary and server-streaming** ' +
        'calls — client and bidi streaming still need Express Proxy or Tauri Native.',
      highlight: GRPC.CONNECTION_SETTINGS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Setup already normalizes transport baseline; keep intro guard minimal.
        await ensureStudioNav(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 1_150);
        await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
        try {
          await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
        } catch {
          await ctx.delay(GRPC19_SETTLE_MS);
        }
        await ctx.delay(850);

        await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), 1_050);
        await ctx.click(GRPC.SETTINGS_NAV_ITEM('transport'));
        try {
          await ctx.waitFor(GRPC.SETTINGS_PANEL('transport'), 3_000);
        } catch {
          await ctx.delay(GRPC19_SETTLE_MS);
        }
        await ctx.delay(800);

        // Spotlight each mode card individually — never the whole panel container.
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 1_200);
        await ctx.delay(250);
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('grpc-web'), 1_200);
        await ctx.delay(250);
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('spring-servlet'), 1_100);
        if (document.querySelector(GRPC.TRANSPORT_MODE_REASON('tauri'))) {
          await ctx.delay(250);
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE_REASON('tauri'), 1_000);
        }

        await ctx.delay(250);
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 1_000);
        await closeSettingsDrawerVisible(ctx);
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
        'With that mode active, fill the Echo request on **Form Input** — in **Compact** density you\'ll see compact JSON (`"message": "..."`), ' +
        'while **Comfortable** density shows the typed **message** row — then send to `localhost:50051`. The call routes through the Node hop and returns the ' +
        'result here. This is the **control case** — Express Proxy works against any gRPC server, with any call ' +
        'type, on both web and desktop. Keep this response in mind: the next steps repeat the same call over ' +
        'different transports.',
      highlight: GRPC.CONNECTION_SETTINGS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
        await reflectAndSelectEchoSilent(ctx);
      },
      action: async (ctx) => {
        await openTransportPanelVisible(ctx);

        if (!isTransportModeActive('express')) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), GRPC19_SPOTLIGHT_MS);
          await ctx.click(GRPC.TRANSPORT_MODE('express'));
          await ctx.delay(GRPC19_SETTLE_MS);
        }
        // Hold on the selected card so the viewer can read the Node.js relay explanation.
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), GRPC19_PAYOFF_MS);
        if (document.querySelector(GRPC.TRANSPORT_MODE_REASON('express'))) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE_REASON('express'), GRPC19_PAYOFF_MS);
        }

        await closeSettingsDrawerVisible(ctx);
        await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, GRPC19_SWITCH_MS);

        await fillGrpcEchoMessage(ctx);
        await spotlightGrpcRequestComposer(ctx);
        await spotlightAndPause(ctx, GRPC.SEND_BTN, GRPC19_SWITCH_MS);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 12_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 15_000);
        }
        await ctx.delay(GRPC19_SETTLE_MS);

        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, GRPC19_SWITCH_MS);
        await spotlightResponseJsonContentTight(ctx, GRPC19_PAYOFF_MS);
        await spotlightAndPause(ctx, GRPC.RESPONSE_TARGET, GRPC19_SPOTLIGHT_MS);
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
        'Re-select **Echo**, confirm the **Form Input** composer shows your message, then click **Send**. The call succeeds — but this time the browser opened the connection itself; there is no ' +
        'Node.js process in the path at all.',
      highlight: GRPC.CONNECTION_SETTINGS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
      },
      action: async (ctx) => {
        await openTransportPanelVisible(ctx);

        if (!isTransportModeActive('grpc-web')) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('grpc-web'), GRPC19_SPOTLIGHT_MS);
          await ctx.click(GRPC.TRANSPORT_MODE('grpc-web'));
          await ctx.delay(GRPC19_SETTLE_MS);
        }
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('grpc-web'), GRPC19_PAYOFF_MS);
        await closeSettingsDrawerVisible(ctx);

        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, GRPC19_SPOTLIGHT_MS);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_ENVOY_TARGET);
        await ctx.delay(GRPC19_SETTLE_MS);
        if (document.querySelector(GRPC.TARGET_STATUS_OK)) {
          await spotlightAndPause(ctx, GRPC.TARGET_STATUS_OK, GRPC19_SWITCH_MS);
        }

        await reflectAndSelectEchoVisible(ctx);
        await ctx.delay(400);
        await ensureMessageFilledQuiet(ctx);

        await spotlightAndPause(ctx, GRPC.SEND_BTN, GRPC19_SWITCH_MS);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 15_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 20_000);
        }
        await ctx.delay(GRPC19_SETTLE_MS);

        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, GRPC19_SWITCH_MS);
        await spotlightResponseJsonContentTight(ctx, GRPC19_PAYOFF_MS);
        await spotlightAndPause(ctx, GRPC.RESPONSE_TARGET, GRPC19_SPOTLIGHT_MS);
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
        'Confirm **Form Input** still holds your Echo message, then click **Send**. This time the browser\'s `fetch` cannot complete a grpc-web handshake against a plain ' +
        'HTTP/2 gRPC port, so the call fails. gRPC Studio recognizes this as a **browser transport failure** and ' +
        'shows a **Retry with Express Proxy** button right in the response panel, along with a hint explaining why ' +
        'the mismatch happened.\n\n' +
        'Click **Retry with Express Proxy** — the tab switches to Express Proxy and resends automatically. The ' +
        'exact same Echo call now succeeds. This is the safety net: browser-direct modes are opt-in, never a dead end.',
      highlight: GRPC.TARGET_INPUT,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_ENVOY_TARGET);

        // Fast path: step 3 already left gRPC-Web active. If the transport badge
        // confirms gRPC-Web, skip opening the settings drawer entirely — opening
        // it just to set transport + call deadline is the "quick unnecessary modal"
        // the viewer sees flashing before the narration starts.
        const badge = document.querySelector<HTMLElement>(GRPC.TRANSPORT_BADGE);
        if (badge?.className.includes('grpc-connection-transport-badge--grpc-web')) {
          return;
        }

        // Slow path (direct step entry / restart): open drawer once, set grpc-web
        // + call deadline, then close.
        await openGrpcSettingsDrawerQuiet(ctx, 'transport');
        if (!isTransportModeActive('grpc-web')) {
          const btn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('grpc-web'));
          if (btn && !btn.disabled) { btn.click(); await ctx.delay(150); }
        }
        const callNavBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('call'));
        if (callNavBtn) {
          callNavBtn.click();
          try { await ctx.waitFor(GRPC.SETTINGS_PANEL('call'), 2_000); } catch { await ctx.delay(150); }
          const input = document.querySelector<HTMLInputElement>(GRPC.CALL_SETTINGS_TIMEOUT);
          if (input && Number(input.value) !== 5_000) {
            const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            if (nativeSet?.set) nativeSet.set.call(input, '5000');
            else input.value = '5000';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            await ctx.delay(100);
          }
        }
        await closeGrpcSettingsDrawerQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, GRPC19_SPOTLIGHT_MS);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_DEMO_TARGET);
        await ctx.delay(GRPC19_SETTLE_MS);
        if (document.querySelector(GRPC.TARGET_STATUS_OK)) {
          await spotlightAndPause(ctx, GRPC.TARGET_STATUS_OK, GRPC19_SWITCH_MS);
        }

        await reflectAndSelectEchoVisible(ctx);
        await ctx.delay(GRPC19_SETTLE_MS);

        // Guard: re-fill message right before Send. When the target switches
        // from Envoy (:50055) to :50051, auto-reflection can reset the form
        // body after reflectAndSelectEchoVisible already filled it.
        await fillGrpcEchoMessage(ctx);
        await ctx.delay(400);
        // Verify the fill actually stuck — auto-reflection may have clobbered
        // it between the fill and the delay.
        await ensureMessageFilledQuiet(ctx);

        await spotlightAndPause(ctx, GRPC.SEND_BTN, GRPC19_SWITCH_MS);
        await ctx.click(GRPC.SEND_BTN);
        await ctx.waitFor(`${GRPC.RESPONSE_ERROR_PANEL}, ${GRPC.RETRY_EXPRESS_BTN}`, 12_000);
        await ctx.delay(GRPC19_SETTLE_MS);

        if (document.querySelector(GRPC.RESPONSE_ERROR_SUMMARY)) {
          await spotlightAndPause(ctx, GRPC.RESPONSE_ERROR_SUMMARY, GRPC19_SWITCH_MS);
        }
        await spotlightAndPause(ctx, GRPC.RESPONSE_ERROR_MESSAGE, GRPC19_PAYOFF_MS);
        if (document.querySelector(GRPC.RESPONSE_BROWSER_TRANSPORT_HINT)) {
          await spotlightAndPause(ctx, GRPC.RESPONSE_BROWSER_TRANSPORT_HINT, GRPC19_PAYOFF_MS);
        }

        if (!document.querySelector(GRPC.RETRY_EXPRESS_BTN)) {
          await ctx.waitFor(GRPC.RETRY_EXPRESS_BTN, 8_000);
        }

        if (document.querySelector(GRPC.RETRY_EXPRESS_BTN)) {
          await spotlightAndPause(ctx, GRPC.RETRY_EXPRESS_BTN, GRPC19_PAYOFF_MS);
          await ctx.click(GRPC.RETRY_EXPRESS_BTN);
          await ctx.waitFor(GRPC.RESPONSE_BODY, 15_000);
          await ctx.delay(GRPC19_SETTLE_MS);
          await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, GRPC19_SWITCH_MS);
          await spotlightResponseJsonContentTight(ctx, GRPC19_PAYOFF_MS);
          await spotlightAndPause(ctx, GRPC.RESPONSE_TARGET, GRPC19_SPOTLIGHT_MS);
        }
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 5 — Spring Servlet: brief introduction (full lesson is L7)
    // -------------------------------------------------------------------------
    {
      id: 'grpc19-spring-servlet-intro',
      title: 'Spring Servlet: One More Browser-Direct Option',
      description:
        'The fourth browser-reachable mode is **Spring Servlet** — instead of grpc-web framing, the browser sends ' +
        'a plain HTTP/1.1 `POST` to `/echo.EchoService/Echo` (path pattern: `/ServiceName/MethodName`), matching how a Spring Boot gRPC server behaves in ' +
        'servlet mode. Like gRPC-Web, it supports unary and server-streaming calls without a Node.js hop.\n\n' +
        'This lesson only introduces the option — connecting to a live Spring Boot server, enabling reflection in ' +
        '`application.yml`, and comparing Netty vs. Servlet transport is the full subject of **Lesson 7**.',
      highlight: GRPC.CONNECTION_SETTINGS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
      },
      action: async (ctx) => {
        await openTransportPanelVisible(ctx);
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('spring-servlet'), GRPC19_PAYOFF_MS);
        await ctx.click(GRPC.TRANSPORT_MODE('spring-servlet'));
        await ctx.delay(GRPC19_SETTLE_MS);
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('spring-servlet'), GRPC19_PAYOFF_MS);
        if (document.querySelector(GRPC.TRANSPORT_MODE_REASON('spring-servlet'))) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE_REASON('spring-servlet'), GRPC19_PAYOFF_MS);
        }
        await closeSettingsDrawerVisible(ctx);
        await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, GRPC19_SWITCH_MS);
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
        '— it is most reliably demonstrated over the proxy that speaks real gRPC end to end. Confirm **Form Input** ' +
        'still holds your Echo message, then send.',
      highlight: GRPC.CONNECTION_SETTINGS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
        await reflectAndSelectEchoSilent(ctx);
        // Step 5 may leave Spring Servlet selected — reset transport + compression quietly.
        await resetTransportBaselineQuiet(ctx);
        await reflectAndSelectEchoSilent(ctx);
      },
      action: async (ctx) => {
        // preAction already reset transport to Express and compression off, so go
        // straight to Compression — no redundant Transport panel detour that the
        // viewer sees as a second "modal popup" open/close cycle.
        await openCompressionPanelVisible(ctx);
        await spotlightAndPause(ctx, GRPC.COMPRESSION_ENABLED, GRPC19_SWITCH_MS);
        const toggle = document.querySelector<HTMLButtonElement>(GRPC.COMPRESSION_ENABLED);
        if (toggle && toggle.getAttribute('aria-checked') !== 'true') {
          await ctx.click(GRPC.COMPRESSION_ENABLED);
          await ctx.delay(GRPC19_SETTLE_MS);
        }

        await spotlightAndPause(ctx, GRPC.COMPRESSION_ALGORITHM, GRPC19_SWITCH_MS);
        await ctx.selectOption(GRPC.COMPRESSION_ALGORITHM, 'gzip');
        await ctx.delay(GRPC19_SETTLE_MS);

        await spotlightAndPause(ctx, GRPC.COMPRESSION_PREVIEW, GRPC19_PAYOFF_MS);

        await closeSettingsDrawerVisible(ctx);

        await fillGrpcEchoMessage(ctx);
        await spotlightGrpcRequestComposer(ctx);
        await spotlightAndPause(ctx, GRPC.SEND_BTN, GRPC19_SWITCH_MS);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 12_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 15_000);
        }
        await ctx.delay(GRPC19_SETTLE_MS);
        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, GRPC19_SWITCH_MS);
        await spotlightResponseJsonContentTight(ctx, GRPC19_PAYOFF_MS);
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
        'window. The extra tab stays open briefly so you can see both tabs, then is cleaned up at the start of the next step.',
      highlight: GRPC.ADD_TAB,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await closeExtraGrpcTabsQuiet(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
      },
      action: async (ctx) => {
        await openTransportPanelVisible(ctx);
        if (!isTransportModeActive('express')) {
          const modeBtn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('express'));
          if (modeBtn && !modeBtn.disabled) {
            await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), GRPC19_SPOTLIGHT_MS);
            modeBtn.click();
            await ctx.delay(GRPC19_SETTLE_MS);
          }
        }
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), GRPC19_PAYOFF_MS);
        await closeSettingsDrawerVisible(ctx);
        await spotlightAndPause(ctx, GRPC.TAB_BAR, GRPC19_SWITCH_MS);

        const tabBar = document.querySelector<HTMLElement>(GRPC.TAB_BAR);
        const firstTabId = tabBar
          ?.querySelector<HTMLElement>('[role="tab"]')
          ?.getAttribute('data-testid') ?? null;

        await spotlightAndPause(ctx, GRPC.ADD_TAB, GRPC19_SPOTLIGHT_MS);
        const addBtn = document.querySelector<HTMLButtonElement>(GRPC.ADD_TAB);
        if (addBtn && !addBtn.disabled) {
          await ctx.click(GRPC.ADD_TAB);
          await ctx.delay(GRPC19_SETTLE_MS);
        }

        const tabsAfterAdd = tabBar ? Array.from(tabBar.querySelectorAll<HTMLElement>('[role="tab"]')) : [];
        const secondTab = tabsAfterAdd.find(
          (tab) => tab.getAttribute('data-testid') !== firstTabId,
        ) ?? null;
        if (secondTab) {
          await spotlightElementAndPause(ctx, secondTab, GRPC19_SPOTLIGHT_MS);
        }

        await openTransportPanelVisible(ctx);
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('grpc-web'), GRPC19_SPOTLIGHT_MS);
        await ctx.click(GRPC.TRANSPORT_MODE('grpc-web'));
        await ctx.delay(GRPC19_SETTLE_MS);
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('grpc-web'), GRPC19_PAYOFF_MS);
        await closeSettingsDrawerVisible(ctx);

        if (firstTabId) {
          await spotlightAndPause(ctx, GRPC.TAB(firstTabId), GRPC19_SPOTLIGHT_MS);
          await ctx.click(GRPC.TAB(firstTabId));
          await ctx.delay(GRPC19_SETTLE_MS);
        }
        await openTransportPanelVisible(ctx);
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), GRPC19_PAYOFF_MS);
        await closeSettingsDrawerVisible(ctx);

        if (firstTabId) {
          await spotlightAndPause(ctx, GRPC.TAB(firstTabId), GRPC19_SWITCH_MS);
        }
        if (secondTab) {
          const secondTabId = secondTab.getAttribute('data-testid');
          if (secondTabId) {
            await spotlightAndPause(ctx, GRPC.TAB(secondTabId), GRPC19_SWITCH_MS);
          }
        }
        await ctx.delay(GRPC19_SETTLE_MS);
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
      highlight: GRPC.CONNECTION_SETTINGS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await closeExtraGrpcTabsQuiet(ctx);
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
      },
      action: async (ctx) => {
        await openTransportPanelVisible(ctx);
        const tauriBtn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('tauri'));

        if (tauriBtn && !tauriBtn.disabled) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('tauri'), GRPC19_SPOTLIGHT_MS);
          await ctx.click(GRPC.TRANSPORT_MODE('tauri'));
          await ctx.delay(GRPC19_SETTLE_MS);
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('tauri'), GRPC19_PAYOFF_MS);
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), GRPC19_SWITCH_MS);
          await ctx.click(GRPC.TRANSPORT_MODE('express'));
          await ctx.delay(GRPC19_SETTLE_MS);
        } else {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('tauri'), GRPC19_PAYOFF_MS);
          if (document.querySelector(GRPC.TRANSPORT_MODE_REASON('tauri'))) {
            await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE_REASON('tauri'), GRPC19_PAYOFF_MS);
          }
        }

        await closeSettingsDrawerVisible(ctx);
        await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, GRPC19_SWITCH_MS);
      },
      verify: GRPC.CONNECTION_BAR,
    },
  ],
};
