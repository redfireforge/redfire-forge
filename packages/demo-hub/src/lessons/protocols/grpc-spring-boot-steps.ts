/** GRPC-15 Spring Boot — lesson steps */
import { GRPC } from '@shared/selectors';
import { upsertWorkspaceDefaults } from '../../adapters';
import {
  GRPC_ECHO_METHOD_SEL,
  openGrpcSettingsDrawerQuiet,
  resetGrpcConnectionSettingsQuiet,
  setGrpcTargetQuiet,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import {
  DEMO_BEARER_TOKEN,
  DEMO_GRPC_HOST_VAR,
  GRPC_SECURE_ECHO_SEL,
  GRPC_SPRING_NETTY_TARGET,
  GRPC_SPRING_SERVLET_TARGET,
  bearerTokenFieldValue,
  ensureManageModalClosed,
  ensureManageModalOpen,
  ensureStudioNav,
  ensureTransportModeQuiet,
  fillBearerTokenField,
  isTransportModeActive,
  openAuthTabQuiet,
  reflectQuiet,
  resetSpringBaselineQuiet,
  selectAuthTypeQuiet,
  selectMethodQuiet,
  selectMethodVisible,
} from './grpc-spring-boot-helpers';
import type { GrpcDemoLesson } from './grpc-lesson-contract';

export const grpcSpringBootSteps: GrpcDemoLesson['steps'] = 
[
    // -------------------------------------------------------------------------
    // Step 1 — One JVM, two transports
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-intro',
      title: 'One Spring Boot JVM, Two Doors In',
      description:
        'This fixture runs a **single** Spring Boot process exposing the same `echo.EchoService` on two ports:\n\n' +
        '- `localhost:9090` — a real Netty gRPC server from the `net.devh` starter (HTTP/2)\n' +
        '- `localhost:8081` — an HTTP/1.1 servlet bridge for the same service, reached via the **Spring Servlet** ' +
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
        'Watch the **connection bar** for the Netty target, then **Session settings → Transport** to confirm ' +
        '**Express Proxy** is selected — RedfireForge\'s local Node.js relay is how the browser reaches real HTTP/2 ' +
        'gRPC on `:9090`.\n\n' +
        'No `application.yml` change was needed — the `net.devh` gRPC starter auto-registers ' +
        '`grpc.reflection.v1alpha.ServerReflection` (and the standard `grpc.health.v1.Health` service) the moment ' +
        'the `grpc-services` artifact is on the classpath. The Service Explorer populates with **four** services: ' +
        '`echo.EchoService`, this fixture\'s custom `health.v1.Health`, the standard `grpc.health.v1.Health`, and ' +
        'the reflection service itself.',
      highlight: GRPC.CONNECTION_BAR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await resetGrpcConnectionSettingsQuiet(ctx);
        await ensureTransportModeQuiet(ctx, 'express');
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, 800);
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 1_000);

        // Make Express Proxy readable — the narration calls it out before Reflect.
        await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 800);
        await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
        try {
          await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(600);

        await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), 800);
        await ctx.click(GRPC.SETTINGS_NAV_ITEM('transport'));
        try {
          await ctx.waitFor(GRPC.SETTINGS_PANEL('transport'), 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(500);

        if (!isTransportModeActive('express')) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 900);
          await ctx.click(GRPC.TRANSPORT_MODE('express'));
          await ctx.delay(450);
        }
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 1_200);
        if (document.querySelector(GRPC.TRANSPORT_MODE_REASON('express'))) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE_REASON('express'), 900);
        }

        await spotlightAndPause(ctx, GRPC.SETTINGS_CLOSE, 600);
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(700);

        await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 800);
        if (!document.querySelector(GRPC.EXPLORER_TREE)) {
          await ctx.click(GRPC.REFLECT_BTN);
          try {
            await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
          } catch {
            await ctx.delay(400);
          }
        }
        await ctx.delay(600);

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
    // Step 8 — Spring Servlet transport on :8081
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-spring-servlet',
      title: 'Same JVM, Second Door: Spring Servlet on :8081',
      description:
        'Open **Session settings → Transport** and switch to **Spring Servlet**. Change the target to ' +
        '`localhost:8081` — the same JVM\'s servlet port. No new **Reflect** is needed: the method schema stays ' +
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
];
