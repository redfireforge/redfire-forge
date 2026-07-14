/** GRPC-15 Spring Boot — lesson steps */
import { GRPC } from '@shared/selectors';
import { getDemoBridgeWindow, upsertWorkspaceDefaults } from '../../adapters';
import {
  GRPC_DEMO_MESSAGE,
  GRPC_ECHO_METHOD_SEL,
  GRPC_ECHO_SERVICE,
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
  ensureMessageFilledQuiet,
  ensureSpringStudioReady,
  ensureStudioNav,
  ensureTransportModeQuiet,
  fillBearerTokenField,
  isTransportModeActive,
  openAuthTabQuiet,
  reflectQuiet,
  selectAuthTypeQuiet,
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
        // Step 1 only highlights the connection bar — skip reflect + method
        // selection to avoid a long Preparing wait. Step 2 handles that.
        await ensureStudioNav(ctx);
        await resetGrpcConnectionSettingsQuiet(ctx);
        await ensureTransportModeQuiet(ctx, 'express');
        await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
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
        await ensureSpringStudioReady(ctx, { resetAuth: true });
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
        await ctx.delay(400);

        await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), 800);
        await ctx.click(GRPC.SETTINGS_NAV_ITEM('transport'));
        try {
          await ctx.waitFor(GRPC.SETTINGS_PANEL('transport'), 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(350);

        if (!isTransportModeActive('express')) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 900);
          await ctx.click(GRPC.TRANSPORT_MODE('express'));
          await ctx.delay(400);
        }
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 800);
        if (document.querySelector(GRPC.TRANSPORT_MODE_REASON('express'))) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE_REASON('express'), 800);
        }

        await spotlightAndPause(ctx, GRPC.SETTINGS_CLOSE, 600);
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(500);

        await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 800);
        if (!document.querySelector(GRPC.EXPLORER_TREE)) {
          await ctx.click(GRPC.REFLECT_BTN);
          try {
            await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
          } catch {
            await ctx.delay(400);
          }
        }
        await ctx.delay(400);

        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 900);

        // Point out the two differently-named health services, one at a time.
        const grpcHealthSel = GRPC.SERVICE('grpc.health.v1.Health');
        const fixtureHealthSel = GRPC.SERVICE('health.v1.Health');
        if (document.querySelector(fixtureHealthSel)) {
          await spotlightAndPause(ctx, fixtureHealthSel, 800);
        }
        if (document.querySelector(grpcHealthSel)) {
          await spotlightAndPause(ctx, grpcHealthSel, 800);
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
        await ensureSpringStudioReady(ctx, { method: GRPC_ECHO_METHOD_SEL });
      },
      action: async (ctx) => {
        await selectMethodVisible(ctx, GRPC_ECHO_METHOD_SEL, { reflectFirst: false });
        await ensureMessageFilledQuiet(ctx);
        await spotlightAndPause(ctx, GRPC.REQUEST_JSON_COMPACT, 500);

        await spotlightAndPause(ctx, GRPC.SEND_BTN_ANY, 400);
        await ctx.click(GRPC.SEND_BTN_ANY);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 12_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 15_000);
        }
        await ctx.delay(200);

        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 500);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 600);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 4 — Reflection is transport-agnostic: Spring Servlet + :9090
    // -------------------------------------------------------------------------
    {
      id: 'grpc15-servlet-reflect',
      title: 'Reflection Is Transport-Agnostic: Spring Servlet + :9090',
      description:
        'Switch the transport to **Spring Servlet** — but leave the target on `:9090`. Click **Reflect**.\n\n' +
        'The service tree repopulates with the same four services. Schema discovery always runs through ' +
        "RedfireForge's server-side proxy using standard HTTP/2 gRPC, independent of the transport badge on " +
        'the connection bar. The badge controls *how calls are sent* once a method is selected — it has no ' +
        'effect on the reflect path.\n\n' +
        '**What if the app only exposed `:8081`?** gRPC Server Reflection is itself a gRPC service ' +
        '(`grpc.reflection.v1alpha.ServerReflection`) that only exists on a real Netty server. A servlet-only ' +
        'deployment has no reflection endpoint at all — reflection would fail regardless of which transport you ' +
        'choose. In that case you would need to load the schema manually: upload `.proto` files, a compiled ' +
        'protoset, or pull from a Buf Schema Registry.\n\n' +
        'This is the key to Step 9: switching to `localhost:8081` + Spring Servlet breaks reflection not because ' +
        'of the transport, but because `:8081` is a plain HTTP/1.1 servlet with no reflection service. ' +
        'The schema loaded here carries across to that step.',
      highlight: GRPC.SERVICE_EXPLORER,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureSpringStudioReady(ctx, { transport: 'spring-servlet' });
      },
      action: async (ctx) => {
        // Spotlight the Spring Servlet transport badge on the connection bar.
        await spotlightAndPause(ctx, '[data-testid="grpc-transport-badge"]', 900);

        // Open Transport panel so the viewer can read that Spring Servlet is selected.
        await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 600);
        await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
        try {
          await ctx.waitFor(GRPC.SETTINGS_DRAWER, 3_000);
        } catch {
          await ctx.delay(300);
        }
        await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), 500);
        await ctx.click(GRPC.SETTINGS_NAV_ITEM('transport'));
        try {
          await ctx.waitFor(GRPC.SETTINGS_PANEL('transport'), 2_000);
        } catch {
          await ctx.delay(300);
        }
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('spring-servlet'), 900);

        await spotlightAndPause(ctx, GRPC.SETTINGS_CLOSE, 400);
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(300);

        // Reflect — this fires a fresh server-reflection call through the proxy.
        await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 900);
        await ctx.click(GRPC.REFLECT_BTN);
        try {
          await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
        } catch {
          await ctx.delay(500);
        }
        await ctx.delay(400);

        // Spotlight the populated service tree.
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 900);
        if (document.querySelector(GRPC_ECHO_METHOD_SEL)) {
          await spotlightAndPause(ctx, GRPC_ECHO_METHOD_SEL, 700);
        }
      },
      verify: GRPC.EXPLORER_TREE,
    },

    // -------------------------------------------------------------------------
    // Step 5 — Health Check (unary)
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
        await ensureSpringStudioReady(ctx, { reflect: true });
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 700);
        await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
        try {
          await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(400);

        await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('health'), 700);
        await ctx.click(GRPC.SETTINGS_NAV_ITEM('health'));
        try {
          await ctx.waitFor(GRPC.SETTINGS_PANEL('health'), 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(400);

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
        await spotlightAndPause(ctx, GRPC.HEALTH_RESULT, 900);

        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(350);
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
        await ensureSpringStudioReady(ctx, { reflect: true });
        // Extend deadline so the streaming watch isn't killed before two beats arrive.
        const timeoutInput = document.querySelector<HTMLInputElement>(GRPC.CALL_TIMEOUT_INPUT);
        if (timeoutInput) {
          const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          nativeSet?.set?.call(timeoutInput, '20000');
          timeoutInput.dispatchEvent(new Event('input', { bubbles: true }));
          timeoutInput.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(100);
        }
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

        // Restore default deadline after the stream is closed.
        const timeoutInput = document.querySelector<HTMLInputElement>(GRPC.CALL_TIMEOUT_INPUT);
        if (timeoutInput) {
          const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          nativeSet?.set?.call(timeoutInput, '5000');
          timeoutInput.dispatchEvent(new Event('input', { bubbles: true }));
          timeoutInput.dispatchEvent(new Event('change', { bubbles: true }));
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
        await ensureSpringStudioReady(ctx, { resetAuth: true, method: GRPC_SECURE_ECHO_SEL });
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC_SECURE_ECHO_SEL, 100);
        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 150);
        await spotlightAndPause(ctx, GRPC.SEND_BTN_ANY, 100);
        await ctx.click(GRPC.SEND_BTN_ANY);
        try {
          await ctx.waitFor(GRPC.RESPONSE_ERROR_SUMMARY, 1_000);
        } catch {
          await ctx.delay(100);
        }
        await spotlightAndPause(ctx, GRPC.RESPONSE_ERROR_SUMMARY, 200);
      },
      verify: GRPC.RESPONSE_ERROR_SUMMARY,
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
        await ensureSpringStudioReady(ctx, { method: GRPC_SECURE_ECHO_SEL });
        await openAuthTabQuiet(ctx);
        if (bearerTokenFieldValue() !== DEMO_BEARER_TOKEN) {
          await selectAuthTypeQuiet(ctx, 'bearer');
          fillBearerTokenField(DEMO_BEARER_TOKEN);
        }
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 400);
        await openAuthTabQuiet(ctx);

        await spotlightAndPause(ctx, GRPC.AUTH_TYPE_SELECT, 400);
        await selectAuthTypeQuiet(ctx, 'bearer');

        const tokenSel = '[data-testid="grpc-auth-bearer-token"]';
        const tokenEl = document.querySelector<HTMLElement>(tokenSel);
        if (tokenEl) {
          await spotlightElementAndPause(ctx, tokenEl, 500);
        }
        if (bearerTokenFieldValue() !== DEMO_BEARER_TOKEN) {
          fillBearerTokenField(DEMO_BEARER_TOKEN);
          await ctx.delay(150);
        }

        await spotlightAndPause(ctx, GRPC.SEND_BTN_ANY, 400);
        await ctx.click(GRPC.SEND_BTN_ANY);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 5_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 3_000);
        }

        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 500);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 600);
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
        await ensureSpringStudioReady(ctx, { resetAuth: true, method: GRPC_ECHO_METHOD_SEL });
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 450);
        await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
        try {
          await ctx.waitFor(GRPC.SETTINGS_DRAWER, 2_000);
        } catch {
          await ctx.delay(200);
        }

        await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), 450);
        await ctx.click(GRPC.SETTINGS_NAV_ITEM('transport'));
        try {
          await ctx.waitFor(GRPC.SETTINGS_PANEL('transport'), 2_000);
        } catch {
          await ctx.delay(200);
        }

        if (!isTransportModeActive('spring-servlet')) {
          await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('spring-servlet'), 500);
          await ctx.click(GRPC.TRANSPORT_MODE('spring-servlet'));
          await ctx.delay(200);
        }
        await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('spring-servlet'), 400);

        await spotlightAndPause(ctx, GRPC.SETTINGS_CLOSE, 350);
        await ctx.click(GRPC.SETTINGS_CLOSE);
        await ctx.delay(200);

        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 500);
        const currentTarget = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT)?.value.trim();
        if (currentTarget !== GRPC_SPRING_SERVLET_TARGET) {
          // Use the demo bridge to atomically change target + preserve the descriptor.
          // Supplying `descriptorKey` in the same patch triggers the replay-connection-change
          // path in updateTab, so the schema stays loaded (service tree remains usable,
          // Send button stays enabled). Plain ctx.fill() would clear the schema.
          const bridge = getDemoBridgeWindow();
          const descriptorKey = bridge.__demoGetGrpcActiveDescriptorKey?.();
          if (descriptorKey) {
            (bridge as unknown as Record<string, (...args: unknown[]) => unknown>)['__demoPatchGrpcActiveTab']?.({
              target: GRPC_SPRING_SERVLET_TARGET,
              descriptorKey,
              service: GRPC_ECHO_SERVICE,
              method: 'Echo',
              body: { message: GRPC_DEMO_MESSAGE },
            });
            await ctx.delay(350);
          } else {
            await ctx.fill(GRPC.TARGET_INPUT, GRPC_SPRING_SERVLET_TARGET);
            await ctx.delay(300);
          }
        }

        await ensureMessageFilledQuiet(ctx);

        await spotlightAndPause(ctx, GRPC.SEND_BTN_ANY, 450);
        await ctx.click(GRPC.SEND_BTN_ANY);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 5_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 5_000);
        }
        await ctx.delay(200);

        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 450);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 550);
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
        await ensureSpringStudioReady(ctx, { resetAuth: true });
        upsertWorkspaceDefaults({ grpcHost: GRPC_SPRING_NETTY_TARGET });
      },
      action: async (ctx) => {
        upsertWorkspaceDefaults({ grpcHost: GRPC_SPRING_NETTY_TARGET });
        await ctx.delay(150);

        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
        await ctx.fill(GRPC.TARGET_INPUT, DEMO_GRPC_HOST_VAR);
        await ctx.delay(400);

        try {
          await ctx.waitFor(GRPC.INTERPOLATION_PREVIEW_STRIP, 4_000);
        } catch {
          await ctx.delay(500);
        }
        if (document.querySelector(GRPC.INTERPOLATION_PREVIEW_STRIP)) {
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_STRIP, 1_000);
          if (document.querySelector(GRPC.INTERPOLATION_PREVIEW_TEMPLATE)) {
            await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_TEMPLATE, 700);
          }
          // Click Resolved to show the resolved localhost:9090 value.
          const resolvedBtn = document.querySelector<HTMLButtonElement>(GRPC.INTERPOLATION_PREVIEW_RESOLVED);
          if (resolvedBtn) {
            await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_RESOLVED, 500);
            await ctx.click(GRPC.INTERPOLATION_PREVIEW_RESOLVED);
            await ctx.delay(200);
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
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 800);
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
        upsertWorkspaceDefaults({ grpcHost: '' });
        await ensureSpringStudioReady(ctx, { reflect: true });
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
        await ctx.delay(400);

        const healthNodeSel = GRPC.SCHEMA_TREE_NODE('method', 'health.v1.Health', 'Check');
        try {
          await ctx.waitFor(healthNodeSel, 6_000);
          await spotlightAndPause(ctx, healthNodeSel, 700);
          await ctx.click(healthNodeSel);
          await ctx.delay(400);
        } catch {
          // Fallback: search Echo instead if the Health node did not resolve.
          await ctx.fill(GRPC.SCHEMA_BROWSER_SEARCH, 'Echo');
          const echoNodeSel = GRPC.SCHEMA_TREE_NODE('method', 'echo.EchoService', 'Echo');
          try {
            await ctx.waitFor(echoNodeSel, 4_000);
            await ctx.click(echoNodeSel);
            await ctx.delay(400);
          } catch {
            // Best-effort — Schema Browser stays navigable even if node selection lags.
          }
        }

        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER_DETAIL, 1_000);

        await ctx.click(GRPC.PROTO_CANCEL_BTN);
        await ctx.delay(400);
      },
      verify: GRPC.CONNECTION_BAR,
    },
];
