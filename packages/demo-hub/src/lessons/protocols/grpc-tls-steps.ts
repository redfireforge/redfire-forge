/** GRPC-5 TLS lesson — steps */
import { GRPC } from '@shared/selectors';
import type { GrpcDemoLesson } from './grpc-lesson-contract';
import { patchGrpcActiveTabExportContext } from '../../adapters';
import {
  GRPC_DEMO_TARGET,
  spotlightAndPause,
  spotlightElementAndPause,
  spotlightResponseJsonContentTight,
} from './grpc-lesson-helpers';
import {
  DEMO_CA_CERT,
  DEMO_CA_CERT_PATH,
  DEMO_CLIENT_CERT,
  DEMO_CLIENT_CERT_PATH,
  DEMO_CLIENT_KEY,
  DEMO_CLIENT_KEY_PATH,
  DEMO_SNI_HOSTNAME,
  GRPC_MTLS_TARGET,
  GRPC_TLS_TARGET,
  closeTlsModalQuiet,
  ensureMtlsConfiguredQuiet,
  ensureStudioNav,
  ensureTlsConfiguredQuiet,
  fillPemTextarea,
  fillTargetQuiet,
  reflectAndSelectEchoVisible,
  resetTlsToPlaintextQuiet,
  saveOrCloseTlsModalQuiet,
  scrollTlsFieldIntoView,
  selectTlsModeQuiet,
} from './grpc-tls-helpers';

export const grpcTlsSteps: GrpcDemoLesson['steps'] = [
    // -------------------------------------------------------------------------
    // Step 1 — TLS badge tour: three channel modes
    // -------------------------------------------------------------------------
    {
      id: 'grpc5-intro',
      title: 'TLS Badge & Channel Modes',
      description:
        'Every gRPC Studio tab shows a **TLS badge** (🔒) in the connection bar. ' +
        'Click it to open the **TLS / mTLS Configuration** modal — this is where you control channel encryption.\n\n' +
        'The modal has **three mode buttons**, spotlighted one at a time below:\n\n' +
        '- 🔓 **Plaintext** — no encryption (default, HTTP/2 cleartext)\n' +
        '- 🔒 **TLS** — server certificate verified against a CA; optional custom CA cert field\n' +
        '- 🛡 **mTLS** — mutual TLS; server also verifies a client certificate + private key\n\n' +
        '**Auth and TLS are separate:** the Auth badge (Bearer, Basic, API Key, OAuth2) controls _request credentials_; ' +
        'the TLS badge controls _channel encryption_. You can combine them — Bearer auth over a mTLS channel is common.',
      highlight: GRPC.TLS_BADGE,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Setup already lands on a clean gRPC Studio baseline for lesson start.
        await ensureStudioNav(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 900);
        await ctx.click(GRPC.TLS_BADGE);
        try {
          await ctx.waitFor(GRPC.TLS_MODAL_BODY, 5_000);
        } catch {
          await ctx.delay(400);
        }
        // Let the viewer read the modal content; the three mode buttons
        // (Plaintext / TLS / mTLS) are already described in the narration.
        await spotlightAndPause(ctx, GRPC.TLS_MODAL_BODY, 1_200);
        await closeTlsModalQuiet(ctx);
      },
      verify: GRPC.CONNECTION_BAR,
    },

    // -------------------------------------------------------------------------
    // Step 2 — Plaintext fails against a TLS-only server
    // -------------------------------------------------------------------------
    {
      id: 'grpc5-plaintext-fail',
      title: 'Plaintext Fails on a TLS Server',
      description:
        'Changing the gRPC target to `localhost:50443` **clears** the service tree — Studio must **Reflect** again on the new server before any call.\n\n' +
        'With **Plaintext** still active, click **Reflect**. The TLS-only fixture at `:50443` rejects the cleartext handshake, ' +
        'and the error appears in the **Services** panel (e.g. _14 UNAVAILABLE: No connection established_).\n\n' +
        'This is the failure you hit the first time you point gRPC Studio at a TLS-enforced server without configuring the channel.\n' +
        'The fix: switch the TLS badge to **TLS** mode and provide a CA cert (next step).',
      highlight: GRPC.TARGET_INPUT,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await resetTlsToPlaintextQuiet(ctx);
        await fillTargetQuiet(ctx, GRPC_TLS_TARGET);
      },
      action: async (ctx) => {
        // Guard against stale TLS state so this step always demonstrates
        // plaintext handshake failure exactly as described.
        await resetTlsToPlaintextQuiet(ctx);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_TLS_TARGET);
        await ctx.delay(220);
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);

        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 600);

        await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 700);
        await ctx.click(GRPC.REFLECT_BTN);

        try {
          await ctx.waitFor(GRPC.EXPLORER_ERROR, 5_000);
        } catch {
          await ctx.delay(700);
        }
        await ctx.delay(250);

        const errorEl = document.querySelector<HTMLElement>(GRPC.EXPLORER_ERROR);
        if (errorEl) {
          await spotlightElementAndPause(ctx, errorEl, 1_100);
        } else {
          await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 900);
        }
      },
      verify: GRPC.SERVICE_EXPLORER,
    },

    // -------------------------------------------------------------------------
    // Step 3 — Configure TLS: switch mode, paste CA cert, test, save
    // -------------------------------------------------------------------------
    {
      id: 'grpc5-configure-tls',
      title: 'Configure TLS: CA Certificate & Test',
      description:
        'Open the TLS modal and click **TLS** — a **CA Certificate** section slides in with a PEM textarea.\n\n' +
        'The demo pastes the fixture `ca.crt` (from `docker/grpc/certs/`). A **Set** badge appears on the field — ' +
        'the PEM is now held in the session vault.\n\n' +
        'Then **Test TLS Connection** runs a local validation pass: Studio confirms the PEM parses and that the ' +
        'mode/cert combination is consistent, showing _"TLS configuration passed local validation."_ below.\n\n' +
        'Finally **Save** commits the config and closes the modal — the connection-bar badge flips to 🔒 **TLS**.',
      highlight: GRPC.TLS_BADGE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await resetTlsToPlaintextQuiet(ctx);
        await fillTargetQuiet(ctx, GRPC_TLS_TARGET);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 1_000);
        await ctx.click(GRPC.TLS_BADGE);
        try {
          await ctx.waitFor(GRPC.TLS_MODAL_BODY, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(600); // modal opened

        // Switch to TLS mode → CA section appears.
        await spotlightAndPause(ctx, GRPC.TLS_MODE('tls'), 800);
        await selectTlsModeQuiet(ctx, 'tls');
        await ctx.delay(700);

        // Paste the CA cert.
        await spotlightAndPause(ctx, '[data-testid="grpc-tls-server-ca"]', 700);
        await fillPemTextarea(ctx, 'grpc-tls-server-ca', DEMO_CA_CERT);
        await ctx.delay(450);
        // Show the "Set" badge that confirms vault storage.
        await spotlightAndPause(ctx, '.ws-tls-field-set-badge', 700);

        // Run the local TLS validation test (power-user feature).
        await spotlightAndPause(ctx, GRPC.TLS_MODAL_TEST, 700);
        const testBtn = document.querySelector<HTMLButtonElement>(GRPC.TLS_MODAL_TEST);
        if (testBtn && !testBtn.disabled) testBtn.click();
        try {
          await ctx.waitFor(GRPC.TLS_TEST_RESULT, 3_000);
        } catch {
          await ctx.delay(400);
        }
        await spotlightAndPause(ctx, GRPC.TLS_TEST_RESULT, 1_100); // outcome

        // Save + close.
        await spotlightAndPause(ctx, GRPC.TLS_MODAL_SAVE, 600);
        await saveOrCloseTlsModalQuiet(ctx);
        await ctx.delay(400);

        // Set grpcurl export context so "Copy grpcurl" includes --cacert.
        patchGrpcActiveTabExportContext({
          tlsFilePaths: { caCertPath: DEMO_CA_CERT_PATH },
        });

        // Badge now reads TLS.
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 800);
      },
      verify: GRPC.TLS_BADGE,
    },

    // -------------------------------------------------------------------------
    // Step 4 — Send Echo over TLS
    // -------------------------------------------------------------------------
    {
      id: 'grpc5-send-tls',
      title: 'Reflect, Select Echo & Send Over TLS',
      description:
        'TLS is configured. Because the target changed to `:50443`, the service tree was cleared — click **Reflect** again ' +
        'to discover `echo.EchoService` over the encrypted channel, then select **Echo**.\n\n' +
        'With the method loaded, confirm **Form Input** holds your Echo message, then click **Send** — the call routes through TLS to `localhost:50443`. ' +
        'The call returns **OK** with the echoed body.\n\n' +
        'The **TLS badge** stays lit 🔒 **TLS** in the connection bar. TLS settings are per-tab.',
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await fillTargetQuiet(ctx, GRPC_TLS_TARGET);
        await ensureTlsConfiguredQuiet(ctx);
      },
      action: async (ctx) => {
        await reflectAndSelectEchoVisible(ctx);

        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 12_000);
        } catch {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 15_000);
        }
        await ctx.delay(800);

        await spotlightResponseJsonContentTight(ctx, 1_100);
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 1_000);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -------------------------------------------------------------------------
    // Step 5 — Server name override (SNI)
    // -------------------------------------------------------------------------
    {
      id: 'grpc5-server-name',
      title: 'Server Name Override (SNI)',
      description:
        'One more TLS field is worth knowing: **Server Name Override**. The demo opens the modal, types **`localhost`** into the ' +
        '**SNI hostname** field, and spotlights the filled value.\n\n' +
        'Use it when the gRPC target is an **IP address** (e.g. `127.0.0.1:50443`) but the server certificate was ' +
        'issued to a **hostname** (e.g. `localhost`).\n\n' +
        'Without the override, TLS fails with **x509: certificate is valid for localhost, not 127.0.0.1** — the ' +
        'client can\'t verify the server. Setting the override to `localhost` tells the TLS stack which name to ' +
        'verify against, while the socket still connects to the IP.\n\n' +
        '**Common scenario:** Kubernetes pods have dynamic IPs but the certificate CN/SAN names a service hostname.',
      highlight: GRPC.TLS_BADGE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await fillTargetQuiet(ctx, GRPC_TLS_TARGET);
        await ensureTlsConfiguredQuiet(ctx);
        if (document.querySelector(GRPC.TLS_MODAL_BODY)) {
          await closeTlsModalQuiet(ctx);
        }
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 1_000);
        await ctx.click(GRPC.TLS_BADGE);
        try {
          await ctx.waitFor(GRPC.TLS_MODAL_BODY, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(800);

        // Ensure TLS mode so the SNI section is visible.
        await selectTlsModeQuiet(ctx, 'tls');
        await ctx.delay(400);

        // Fill SNI hostname — the focal point of this step.
        await spotlightAndPause(ctx, GRPC.TLS_SERVER_NAME, 700);
        await ctx.waitFor(GRPC.TLS_SERVER_NAME, 3_000);
        await ctx.fill(GRPC.TLS_SERVER_NAME, DEMO_SNI_HOSTNAME);
        await ctx.delay(500); // viewer sees the typed value replace the placeholder

        await spotlightAndPause(ctx, GRPC.TLS_SERVER_NAME, 1_100); // highlight filled field

        // Save so the override is committed, then close.
        await spotlightAndPause(ctx, GRPC.TLS_MODAL_SAVE, 600);
        await saveOrCloseTlsModalQuiet(ctx);
        await ctx.delay(400);
      },
      verify: GRPC.TLS_BADGE,
    },

    // -------------------------------------------------------------------------
    // Step 6 — Configure mTLS with client certificate + key
    // -------------------------------------------------------------------------
    {
      id: 'grpc5-configure-mtls',
      title: 'Mutual TLS: Client Certificate & Private Key',
      description:
        'The fixture at `localhost:50444` enforces **mTLS** — it rejects clients that don\'t present a valid certificate.\n\n' +
        'The demo switches the target to `localhost:50444`, opens the modal, and selects **mTLS**. Two new **required** ' +
        'fields appear under **Client Identity**: **Client Certificate** and **Client Private Key**.\n\n' +
        'It pastes the fixture `client.crt` and `client.key`, each showing a **Set** badge. Combined with the CA cert ' +
        'carried over from TLS mode, this builds the full mutual-auth chain:\n\n' +
        '- CA cert validates the **server** ✓\n' +
        '- Client cert + key prove the **client** identity ✓\n\n' +
        '**Save** commits it — the badge flips to 🛡 **mTLS**. (We send the call in the next step.)',
      highlight: GRPC.TLS_BADGE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await fillTargetQuiet(ctx, GRPC_MTLS_TARGET);
        // No reset here: the action switches straight to mTLS (from TLS or plaintext),
        // avoiding a visible plaintext round-trip in the Preparing phase.
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_MTLS_TARGET);
        await ctx.delay(400);

        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 700);
        await ctx.click(GRPC.TLS_BADGE);
        try {
          await ctx.waitFor(GRPC.TLS_MODAL_BODY, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(800);

        // Select mTLS → Client Identity section appears.
        await spotlightAndPause(ctx, GRPC.TLS_MODE('mtls'), 800);
        await selectTlsModeQuiet(ctx, 'mtls');
        await ctx.delay(700);

        // CA cert (needed to trust the server) — fill if not carried over.
        const caTextarea = document.querySelector<HTMLTextAreaElement>(GRPC.TLS_SERVER_CA);
        if (caTextarea && !caTextarea.value.trim()) {
          await fillPemTextarea(ctx, 'grpc-tls-server-ca', DEMO_CA_CERT);
          await ctx.delay(400);
        }

        // Client certificate — scroll into view before the visible paste.
        await scrollTlsFieldIntoView(ctx, GRPC.TLS_CLIENT_CERT, 500);
        await spotlightAndPause(ctx, GRPC.TLS_CLIENT_CERT, 800);
        await fillPemTextarea(ctx, 'grpc-tls-client-cert', DEMO_CLIENT_CERT);
        await ctx.delay(450);

        // Client private key — scroll up so label + textarea are centered (not hidden by footer).
        await scrollTlsFieldIntoView(ctx, GRPC.TLS_CLIENT_KEY, 550);
        await spotlightAndPause(ctx, GRPC.TLS_CLIENT_KEY, 800);
        await fillPemTextarea(ctx, 'grpc-tls-client-key', DEMO_CLIENT_KEY);
        await ctx.delay(500);
        await scrollTlsFieldIntoView(ctx, GRPC.TLS_CLIENT_KEY, 450);
        await spotlightAndPause(ctx, GRPC.TLS_CLIENT_KEY, 1_000);

        // Save + close.
        await spotlightAndPause(ctx, GRPC.TLS_MODAL_SAVE, 600);
        await saveOrCloseTlsModalQuiet(ctx);
        await ctx.delay(400);

        // Set grpcurl export context so "Copy grpcurl" includes --cacert, --cert, --key.
        patchGrpcActiveTabExportContext({
          tlsFilePaths: {
            caCertPath: DEMO_CA_CERT_PATH,
            certPath: DEMO_CLIENT_CERT_PATH,
            keyPath: DEMO_CLIENT_KEY_PATH,
          },
        });

        // Badge now reads mTLS.
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 900);
      },
      verify: GRPC.TLS_BADGE,
    },

    // -------------------------------------------------------------------------
    // Step 7 — Send Echo over the mutual-TLS channel
    // -------------------------------------------------------------------------
    {
      id: 'grpc5-send-mtls',
      title: 'Reflect, Select Echo & Send Over mTLS',
      description:
        'With mTLS configured on `localhost:50444`, click **Reflect** to load the service tree over the mutual-auth channel, ' +
        'select **Echo**, confirm **Form Input**, then **Send**.\n\n' +
        'The server validates the client certificate before returning **OK** with the echoed body. ' +
        'Without a valid client cert, Reflect or Send would fail during the handshake.\n\n' +
        'The connection-bar badge stays 🛡 **mTLS** for this tab.',
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await fillTargetQuiet(ctx, GRPC_MTLS_TARGET);
        await ensureMtlsConfiguredQuiet(ctx);
      },
      action: async (ctx) => {
        await reflectAndSelectEchoVisible(ctx);

        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        await ctx.click(GRPC.SEND_BTN);
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 12_000);
        } catch {
          await ctx.waitFor(`${GRPC.RESPONSE_ERROR_SUMMARY}, ${GRPC.RESPONSE_STATUS}`, 8_000);
        }
        await ctx.delay(600);

        if (document.querySelector(GRPC.RESPONSE_BODY)) {
          await spotlightResponseJsonContentTight(ctx, 1_100);
        } else if (document.querySelector(GRPC.RESPONSE_ERROR_SUMMARY)) {
          await spotlightAndPause(ctx, GRPC.RESPONSE_ERROR_SUMMARY, 1_000);
        } else {
          await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 1_000);
        }
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 700);
      },
      verify: GRPC.RESPONSE_PANEL,
    },

    // -------------------------------------------------------------------------
    // Step 8 — Secret vault protection + cleanup
    // -------------------------------------------------------------------------
    {
      id: 'grpc5-secret-vault',
      title: 'Secret Vault & Cleanup',
      description:
        'The demo reopens the modal to highlight the **Set** badges: the PEM content lives in an **in-session ' +
        'secret vault**, never in localStorage.\n\n' +
        '**What the vault guarantees:**\n' +
        '- Certs are stripped from every collection export, History record, and grpcurl command\n' +
        '- Closing the browser tab wipes the vault — no PEM persists on disk\n' +
        '- **"Clear stored"** removes a cert from the vault immediately\n\n' +
        'Finally the demo clicks **Reset to Defaults** (back to **Plaintext**) and restores the target to ' +
        '`localhost:50051`, leaving a clean channel for the next lesson.',
      highlight: GRPC.TLS_BADGE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx); // closes any stray modal
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 700);
        await ctx.click(GRPC.TLS_BADGE);
        try {
          await ctx.waitFor(GRPC.TLS_MODAL_BODY, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(600);

        // Spotlight the "Set" badges — vault-backed cert fields.
        const setBadges = Array.from(document.querySelectorAll<HTMLElement>('.ws-tls-field-set-badge'));
        for (const badge of setBadges.slice(0, 3)) {
          await spotlightElementAndPause(ctx, badge, 1_200);
          await ctx.delay(250);
        }

        // Spotlight a "Clear stored" control if present.
        const clearBtn = document.querySelector<HTMLElement>('[data-testid="grpc-tls-server-ca-clear"]');
        if (clearBtn) {
          await spotlightElementAndPause(ctx, clearBtn, 1_200);
          await ctx.delay(250);
        }

        // Reset to Defaults (→ Plaintext) and persist.
        await spotlightAndPause(ctx, GRPC.TLS_MODAL_RESET, 1_100);
        const resetBtn = document.querySelector<HTMLButtonElement>(GRPC.TLS_MODAL_RESET);
        if (resetBtn && !resetBtn.disabled) {
          resetBtn.click();
          await ctx.delay(700);
        }
        await selectTlsModeQuiet(ctx, 'disabled');
        await saveOrCloseTlsModalQuiet(ctx);
        await ctx.delay(550);

        // Restore the default echo target.
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 900);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_DEMO_TARGET);
        await ctx.delay(550);

        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 1_100); // back to Plaintext
      },
      verify: GRPC.CONNECTION_BAR,
    },
  ];
