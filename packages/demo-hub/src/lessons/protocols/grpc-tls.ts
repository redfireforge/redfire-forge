/**
 * Lesson GRPC-5: TLS, mTLS & Certificate Configuration
 *
 * Covers the TLS badge workflow, all three channel modes (Plaintext / TLS / mTLS),
 * pasting PEM-encoded certificates into the secret-vault fields, running the local
 * TLS validation test, live calls over TLS and mTLS, the server name override field,
 * and the secret-vault guarantee that certificate material never appears in exports.
 *
 *   grpc5-intro          — TLS badge tour: three channel modes
 *   grpc5-plaintext-fail — Target :50443 + Reflect in Plaintext → connection error
 *   grpc5-configure-tls  — Switch TLS mode → paste CA cert → test → save
 *   grpc5-send-tls       — Send Echo over TLS → OK, TLS badge shows active mode
 *   grpc5-server-name    — Server name override (SNI) field walkthrough
 *   grpc5-configure-mtls — Target :50444, mTLS mode, paste client cert + key → save
 *   grpc5-send-mtls      — Send Echo over the mutual-TLS channel → OK
 *   grpc5-secret-vault   — Secret vault protection + cleanup
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
  ensureEchoMethodSelected,
  ensureGrpcStudioSubNavQuiet,
  ensureGrpcTarget,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import { scrollDemoTargetIntoView } from '../../demoSpotlightUtils';
import { patchGrpcActiveTabExportContext } from '../../adapters';

const GRPC5_ROSTER = getGrpcLessonRosterEntry('grpc-tls')!;

// TLS fixture targets (Phase 12D Docker fixtures).
const GRPC_TLS_TARGET = 'localhost:50443';
const GRPC_MTLS_TARGET = 'localhost:50444';
/** Matches docker/grpc/certs/ CN/SAN — used for the SNI override demo. */
const DEMO_SNI_HOSTNAME = 'localhost';

// File paths for grpcurl --cacert / --cert / --key (relative to project root).
const DEMO_CA_CERT_PATH = './docker/grpc/certs/ca.crt';
const DEMO_CLIENT_CERT_PATH = './docker/grpc/certs/client.crt';
const DEMO_CLIENT_KEY_PATH = './docker/grpc/certs/client.key';

// PEM certificates from docker/grpc/certs/ — used for live TLS demonstrations.
const DEMO_CA_CERT = `-----BEGIN CERTIFICATE-----
MIID1zCCAr+gAwIBAgIUeWV10ywbmXfhPn+yIB/pBzsBrgwwDQYJKoZIhvcNAQEL
BQAwezELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMQ4wDAYDVQQHDAVMb2NhbDEV
MBMGA1UECgwMUmVkZmlyZUZvcmdlMRYwFAYDVQQLDA1nUlBDIEZpeHR1cmVzMSAw
HgYDVQQDDBdyZWRmaXJlLWdycGMtZml4dHVyZS1jYTAeFw0yNjA3MDQwMjA2MzBa
Fw0zNjA3MDEwMjA2MzBaMHsxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTEOMAwG
A1UEBwwFTG9jYWwxFTATBgNVBAoMDFJlZGZpcmVGb3JnZTEWMBQGA1UECwwNZ1JQ
QyBGaXh0dXJlczEgMB4GA1UEAwwXcmVkZmlyZS1ncnBjLWZpeHR1cmUtY2EwggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCq+CkTU3pS7UfdaGAwQ4l7GhNA
JNo2/JMr2IPgwxdPMSswyV2VNItplBclx17s9gs1z5CMdAOIwlVEPFNtfvuOX2Zb
FzwlqJRy7cxRyOgepBte9KXu+MaBtbm+j15DpRYktQIu5YZqipHlLQO8M3wLnQf4
gUfaY4Tlt/7GoVLDDYGm9L0PNQaezJBfGNzw4bc9ghDl3ejnI+i9wLGiZ7xv4r4f
od4TDEbwkA9JHxIRBG8zwoN0MmJi/qxy/S8OBmDOLabGNb7Za7tLcuzAJqdp1mJv
IGL3ktOjaIubBxaFpOo7J18K/ZgxZMg0UsZ1mVkDRLq4bOYa9pK9WY7vqnmLAgMB
AAGjUzBRMB0GA1UdDgQWBBT2BIcuiuv0PcOdUk5yKFup9psjCTAfBgNVHSMEGDAW
gBT2BIcuiuv0PcOdUk5yKFup9psjCTAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
DQEBCwUAA4IBAQBF9JzPRbFqax1KTdNc0WygUTaSTAQuVq497/oAZp0SvGpupeZY
46ockE80Z8gHZME2fuUF1R4i2nrym75+KaDwSYik14PO/HBGp5T9bGey84GKO1yA
n4PDmf3G+Si7vJzjTvBhmX0Qgr8m6FuVtBw7aQUucOTzdGZDRcSkpAMI+paoUBHn
uTjnuaZLhfbo8J5R38r/c3DtYN6pFgWneS6gEvXsDfFs2Wox/KtL5TcNsTknD5vn
bqbcwlv/q0iyzFJcEWm2MNOvCX4E20oyTqzhAiN5uDGjao01CRt4LU+NqLM9W1oK
MrLMchCrC9Dr02PvyGxmU7R1vxpPcx12em0X
-----END CERTIFICATE-----`;

const DEMO_CLIENT_CERT = `-----BEGIN CERTIFICATE-----
MIID1zCCAr+gAwIBAgIUUgck4I2cE93ngffCHzQnpWOFyXQwDQYJKoZIhvcNAQEL
BQAwezELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMQ4wDAYDVQQHDAVMb2NhbDEV
MBMGA1UECgwMUmVkZmlyZUZvcmdlMRYwFAYDVQQLDA1nUlBDIEZpeHR1cmVzMSAw
HgYDVQQDDBdyZWRmaXJlLWdycGMtZml4dHVyZS1jYTAeFw0yNjA3MDQwMjA2MzBa
Fw0zNjA3MDEwMjA2MzBaMHcxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTEOMAwG
A1UEBwwFTG9jYWwxFTATBgNVBAoMDFJlZGZpcmVGb3JnZTEWMBQGA1UECwwNZ1JQ
QyBGaXh0dXJlczEcMBoGA1UEAwwTZ3JwYy1maXh0dXJlLWNsaWVudDCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBALo0iITQ/5LUr29OGqVdUmVJeLDXaJGe
icv9Ar3GiWORnPg2U2+2FUmsmqMcVd8L+lgH7XSC6hDox5pWHUezucKVLxQkbQU7
qxBNbCeMuVNLEO3YXAbDyhwHtriOKOzYFA/c98X+IDKCti6UQjP9qauvUI0NVUjm
D8uySaGUHpew/AY2v4W2Yty2u0eJBWvfs/xzHpwoV5/3WVfnPF5DIZVzwQh+sD5b
42pL5frjvT2j1rnCVV3g+OBxuWIH4olzaoMvOdBQUW8N61n0x48YcypY8NScmrav
fF5ugBw4pjBrR1KtRNNRbehFxYSIC+9pIzIQi50cLBxhkC+WRwtSXv8CAwEAAaNX
MFUwEwYDVR0lBAwwCgYIKwYBBQUHAwIwHQYDVR0OBBYEFMfG5+n9fXafuI2y+vyd
ESCTOaNnMB8GA1UdIwQYMBaAFPYEhy6K6/Q9w51STnIoW6n2myMJMA0GCSqGSIb3
DQEBCwUAA4IBAQBFYyqIvDSWYo5ng4dINgDZDwOBkj5L8fI0rhaI8aO9zRpl3DgL
xj7rRbZvdG4zIpCSoYayGkk0kWaM2+PGOIxi+hp0cRKeW4Lso5y53/QNnNXw9v3W
3rmUKqtLyIRZXjuq/NYXZCfrQ/NL3tsdI4Vf1pG/dKDru8Vv3pVd6WX6B1ZXESRf
N1OiXLyoNo3/DfZptetWNpYnKuZUWZsR/UNxT/DrOHEBaOpeCfXY+hfeIxZDkgPF
rTl6DRgBN+MpGKOcLo0bByki9ol0raNmt7u9BaXEQ8sY8b7r4S4NPU9o2A87xGVI
jKeBcU4+nhOo1Npr8aa0Vtx8QeR/SOZKWZ3i
-----END CERTIFICATE-----`;

const DEMO_CLIENT_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC6NIiE0P+S1K9v
ThqlXVJlSXiw12iRnonL/QK9xoljkZz4NlNvthVJrJqjHFXfC/pYB+10guoQ6Mea
Vh1Hs7nClS8UJG0FO6sQTWwnjLlTSxDt2FwGw8ocB7a4jijs2BQP3PfF/iAygrYu
lEIz/amrr1CNDVVI5g/LskmhlB6XsPwGNr+FtmLctrtHiQVr37P8cx6cKFef91lX
5zxeQyGVc8EIfrA+W+NqS+X64709o9a5wlVd4PjgcbliB+KJc2qDLznQUFFvDetZ
9MePGHMqWPDUnJq2r3xeboAcOKYwa0dSrUTTUW3oRcWEiAvvaSMyEIudHCwcYZAv
lkcLUl7/AgMBAAECggEAQgqX0ON/gchFYKjG8peivaHNWItN3zfnj53w9vYPjGz8
y1wZQ6nE6xh40Bkgq7dH1ykYoxY7hjvJb4fTYrbvz3+x7ubsc8qx5VpQXcafhFc/
bdwq54tRh5eEyvhAs5//nZC1oFd9e+y4SNT0lhQFtYq8ewqbkPtn5ssZKmGqaAoW
tbJat0W7+Rzjt/0OLRbXH1h+vYNLQEUk7r8a8ifrx68Aq6UyuY+VxhWu2j1UBl9g
7xJDoj6MsqzkXRmf+SYFeZoKZgSBkFT9RuUyiHye+J9xIb0q5TO3BJoQg9k8s3jw
doyTD9kTdkaBrn8PGzx9FZ8/+GGYTA5pI6B727FyYQKBgQDdT3M49BqqzefWBgPF
EB2w2OcQZFnYH7Yea/1/dDIo1xKzeFRXENF7huYx9OHmRy3u3GWPyy1nxUnQ9Drh
LnVHipk/BEFN1M70BCeERlr7DjuwymVOEIU8KwLoqHbhzLIWs29fzcKt4HKS3nth
0t0EOniO/23l07YP+PjYnAnRkwKBgQDXZGoXObb/N+bDi29rry+HdEJJGLnUAIls
CxpmPtbi/DNoo3DPK0//PaBq2Zkvg+z+Cobm6qdrYc015gwflxrgDnx44U4PfOvz
MgCdUA/9LzUQcrtSymSe04CBUNi2owLwC0BumVCCRgISelbg489M5IO0SF/OZMp1
OKrq7jCQZQKBgGXE2E5zaiPrZdX0lB01qQGe7LqL+wi4pG3e6QaIL1y6cj4XcmlL
MZmlUgvc+ViEmOnDbeyu2OVkQuqUtNLCI2pPoOLqmQEqgDSUCHv6QnI6fFZy7Bz2
2d3uRXsppOl20NpBj1C19PUyRl2lc4Vrivkbzj6r1SSfs5QqwHwTXSyDAoGAK7zc
PjMeEd1MItEhowBD6oGVJDq9IWuqfCIVDkYcZKNJ3SmzMp5c9DuTY58kGB319fA1
TJbBwHBvt04rkA6jCnRmmjVGIKcBUrUIoukrFgKMB/cESt+GZyoToi7EkvGvGwdt
4geH7axBp3boRWp9IeQVSnqX2dVltz/2lRYhDnECgYBi9S5RLihebimK10oG+FMJ
cXU+h6IsPc2LFMqBt8ONnVK7A2LvwSvChPyvtmpr7FhJ2NZKEgzxlo5tYpS+/7lJ
ul4kg4VgDr3IfVIycEY8m5VyGJxf26oAV191b1dZARM+G4RbWzAW3zM3UFl/To6c
1Ig+1y68JDAR+npXpAhhWQ==
-----END PRIVATE KEY-----`;

type LessonCtx = Parameters<NonNullable<GrpcDemoLesson['steps'][number]['action']>>[0];
type PreCtx = Parameters<NonNullable<GrpcDemoLesson['steps'][number]['preAction']>>[0];

// spotlightAndPause / spotlightElementAndPause moved to grpc-lesson-helpers.ts (GRPC-19)
// for reuse across lessons — re-imported above.

// ---------------------------------------------------------------------------
// TLS modal helpers
// ---------------------------------------------------------------------------

/**
 * Detect the currently applied TLS mode by reading the connection-bar TLS
 * badge label — WITHOUT opening the modal. This lets `preAction` guards decide
 * whether any (visible) reconfiguration is needed, so normal sequential
 * playback keeps the "Preparing" phase invisible and instant.
 */
function currentTlsBadgeMode(): 'disabled' | 'tls' | 'mtls' | 'unknown' {
  const badge = document.querySelector<HTMLElement>(GRPC.TLS_BADGE);
  const text = (badge?.textContent ?? '').toLowerCase();
  if (!text) return 'unknown';
  if (text.includes('mtls')) return 'mtls';
  if (text.includes('tls')) return 'tls';
  if (text.includes('plaintext')) return 'disabled';
  return 'unknown';
}

/** Open the TLS config modal via the TLS badge. No-op if already open. */
async function openTlsModalQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  if (document.querySelector(GRPC.TLS_MODAL_BODY)) return;
  const badge = document.querySelector<HTMLButtonElement>(GRPC.TLS_BADGE);
  if (!badge || badge.disabled) return;
  badge.click();
  try {
    await ctx.waitFor(GRPC.TLS_MODAL_BODY, 5_000);
  } catch {
    // Best-effort — modal may not open in all runtime stubs.
  }
  await ctx.delay(250);
}

/** Close TLS modal via its Close button. No-op if not open. */
async function closeTlsModalQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  const closeBtn = document.querySelector<HTMLElement>(GRPC.TLS_MODAL_CLOSE);
  if (closeBtn) {
    closeBtn.click();
    await ctx.delay(350);
  }
}

/** Save the modal if the Save button is enabled (dirty); otherwise Close it. */
async function saveOrCloseTlsModalQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  const saveBtn = document.querySelector<HTMLButtonElement>(GRPC.TLS_MODAL_SAVE);
  if (saveBtn && !saveBtn.disabled) {
    saveBtn.click();
    await ctx.delay(300);
  } else {
    await closeTlsModalQuiet(ctx);
  }
}

/**
 * Reset TLS to Plaintext (disabled) quietly.
 * Skips entirely (no modal flash) when the badge already reads Plaintext.
 */
async function resetTlsToPlaintextQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  const modalOpen = Boolean(document.querySelector(GRPC.TLS_MODAL_BODY));
  if (!modalOpen && currentTlsBadgeMode() === 'disabled') return; // already plaintext.

  await openTlsModalQuiet(ctx);
  if (!document.querySelector(GRPC.TLS_MODAL_BODY)) return; // Modal didn't open.

  await selectTlsModeQuiet(ctx, 'disabled');
  await saveOrCloseTlsModalQuiet(ctx);
}

/**
 * Scroll a TLS PEM field (label + textarea) into the center of the modal body
 * so viewers can see paste actions — especially client key at the bottom.
 */
async function scrollTlsFieldIntoView(
  ctx: LessonCtx | PreCtx,
  selector: string,
  holdMs = 450,
): Promise<void> {
  const field = document.querySelector<HTMLElement>(selector);
  if (!field) return;
  const scrollTarget = (field.closest('.ws-tls-field') ?? field) as HTMLElement;
  scrollDemoTargetIntoView(scrollTarget, { block: 'center' });
  await ctx.delay(holdMs);
}

/**
 * Fill a PEM textarea using the React-compatible native setter so that React
 * state updates correctly (direct `.value =` assignment bypasses React).
 */
async function fillPemTextarea(ctx: LessonCtx | PreCtx, testId: string, content: string): Promise<void> {
  const selector = `[data-testid="${testId}"]`;
  const textarea = document.querySelector<HTMLTextAreaElement>(selector);
  if (!textarea || textarea.disabled) return;

  await scrollTlsFieldIntoView(ctx, selector, 400);

  textarea.focus();
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  if (nativeSet?.set) {
    nativeSet.set.call(textarea, content);
  } else {
    textarea.value = content;
  }
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));

  // Re-center after long PEM content — focus can push the field below the footer.
  await scrollTlsFieldIntoView(ctx, selector, 350);
}

/** Click a TLS mode button only if it is not already active. */
async function selectTlsModeQuiet(
  ctx: LessonCtx | PreCtx,
  mode: 'disabled' | 'tls' | 'mtls',
): Promise<void> {
  const btn = document.querySelector<HTMLButtonElement>(GRPC.TLS_MODE(mode));
  if (!btn || btn.disabled) return;
  if (btn.getAttribute('aria-pressed') === 'true') return;
  btn.click();
  await ctx.delay(300);
}

/**
 * Fill a target input field using native event dispatch (React-compatible).
 * Skips the fill if the field already contains the expected value.
 */
async function fillTargetQuiet(ctx: LessonCtx | PreCtx, target: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT);
  if (!input) return;
  if (input.value.trim() === target) return;

  input.focus();
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (nativeSet?.set) {
    nativeSet.set.call(input, target);
  } else {
    input.value = target;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
  await ctx.delay(350);
}

/**
 * Quietly ensure TLS mode is 'tls' with the demo CA cert in place and saved.
 * Skips (no modal flash) when the badge already reads TLS — the common case
 * during sequential playback after the configure-TLS step.
 */
async function ensureTlsConfiguredQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  if (currentTlsBadgeMode() === 'tls') return;

  await openTlsModalQuiet(ctx);
  if (!document.querySelector(GRPC.TLS_MODAL_BODY)) return;

  await selectTlsModeQuiet(ctx, 'tls');
  const caTextarea = document.querySelector<HTMLTextAreaElement>('[data-testid="grpc-tls-server-ca"]');
  if (caTextarea && !caTextarea.value.trim()) {
    await fillPemTextarea(ctx, 'grpc-tls-server-ca', DEMO_CA_CERT);
  }
  await saveOrCloseTlsModalQuiet(ctx);
}

/**
 * Quietly ensure mTLS mode is configured (CA + client cert + key) and saved.
 * Skips (no modal flash) when the badge already reads mTLS.
 */
async function ensureMtlsConfiguredQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  if (currentTlsBadgeMode() === 'mtls') return;

  await openTlsModalQuiet(ctx);
  if (!document.querySelector(GRPC.TLS_MODAL_BODY)) return;

  await selectTlsModeQuiet(ctx, 'mtls');
  const fills: Array<[string, string]> = [
    ['grpc-tls-server-ca', DEMO_CA_CERT],
    ['grpc-tls-client-cert', DEMO_CLIENT_CERT],
    ['grpc-tls-client-key', DEMO_CLIENT_KEY],
  ];
  for (const [testId, pem] of fills) {
    const field = document.querySelector<HTMLTextAreaElement>(`[data-testid="${testId}"]`);
    if (field && !field.value.trim()) {
      await fillPemTextarea(ctx, testId, pem);
    }
  }
  await saveOrCloseTlsModalQuiet(ctx);
}

/** Ensure the message field has demo content (React-safe). */
async function ensureMessageFilledQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
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

/**
 * Reflect and select Echo on the **current** target.
 * Caller must set the target and TLS mode first — changing the target clears
 * the descriptor cache and method binding in gRPC Studio.
 */
async function reflectAndSelectEchoQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
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
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL);
    if (serviceBtn) {
      serviceBtn.click();
      await ctx.delay(350);
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
}

/** Visible reflect + Echo selection for send steps (with spotlight pacing). */
async function reflectAndSelectEchoVisible(ctx: LessonCtx): Promise<void> {
  await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 700);
  await ctx.click(GRPC.REFLECT_BTN);
  try {
    await ctx.waitFor(GRPC.EXPLORER_TREE, 12_000);
  } catch {
    await ctx.delay(1_500);
  }
  await ctx.delay(500);
  await spotlightAndPause(ctx, GRPC.EXPLORER_TREE, 600);

  if (!document.querySelector(GRPC.PROTO_FORM)) {
    if (document.querySelector(GRPC_ECHO_SERVICE_SEL)) {
      await spotlightAndPause(ctx, GRPC_ECHO_SERVICE_SEL, 600);
      await ctx.click(GRPC_ECHO_SERVICE_SEL);
      await ctx.delay(400);
    }
    await spotlightAndPause(ctx, GRPC_ECHO_METHOD_SEL, 600);
    await ctx.click(GRPC_ECHO_METHOD_SEL);
    try {
      await ctx.waitFor(GRPC.PROTO_FORM, 8_000);
    } catch {
      await ctx.delay(400);
    }
  }
  await ensureMessageFilledQuiet(ctx);
}

/** Quietly prepare TLS target + config + reflection + Echo for send steps. */
async function ensureTlsEchoReadyQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  await fillTargetQuiet(ctx, GRPC_TLS_TARGET);
  await ensureTlsConfiguredQuiet(ctx);
  await reflectAndSelectEchoQuiet(ctx);
  await ensureMessageFilledQuiet(ctx);
}

/** Quietly prepare mTLS target + config + reflection + Echo for send steps. */
async function ensureMtlsEchoReadyQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  await fillTargetQuiet(ctx, GRPC_MTLS_TARGET);
  await ensureMtlsConfiguredQuiet(ctx);
  await reflectAndSelectEchoQuiet(ctx);
  await ensureMessageFilledQuiet(ctx);
}

/** Minimal nav guard: navigate to gRPC Studio, close overlays, ensure studio sub-nav. */
async function ensureStudioNav(ctx: LessonCtx | PreCtx): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeTlsModalQuiet(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export const grpcTlsLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC5_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Connect to TLS-protected gRPC servers, configure mutual TLS with client certificates, ' +
    'validate the handshake locally, and learn how RedfireForge keeps PEM material in a session vault.',

  setup: grpcFirstCallSetup,
  cleanup: async (ctx) => {
    await resetTlsToPlaintextQuiet(ctx);
    await fillTargetQuiet(ctx, GRPC_DEMO_TARGET);
    await grpcFirstCallCleanup(ctx);
  },

  grpc: buildGrpcContractMetaFromRoster(GRPC5_ROSTER),

  concept: {
    title: 'TLS & mTLS in gRPC Studio',
    body: `gRPC runs over HTTP/2. By default the channel is **plaintext** — no encryption. In production, you almost always need **TLS** (server authentication) or **mTLS** (mutual authentication).

**Three channel modes — click the TLS badge (🔒) in the connection bar to choose:**

| Mode | Icon | What it does |
|---|---|---|
| **Plaintext** | 🔓 | No encryption — cleartext HTTP/2. Default. |
| **TLS** | 🔒 | Server presents a certificate; client verifies it. Optional custom CA cert. |
| **mTLS** | 🛡 | Both sides present certificates — server also verifies the client's identity. |

**Certificate fields (PEM paste):**
- **CA Certificate** — paste a custom root CA to trust self-signed or private PKI server certs
- **Client Certificate** + **Client Private Key** (mTLS only) — prove your identity to the server
- **Server Name Override (SNI)** — fix hostname mismatches between the target IP and the cert's CN/SAN

**Secret vault:** PEM content is held in an in-session secret vault. It is **never** written to localStorage, never included in collection/History exports, and stripped from grpcurl output. A "Set" badge appears on the field; a "Clear stored" button removes it.

**TLS connection test:** Click **Test TLS Connection** in the modal to run local PEM validation before sending a call — it checks that your cert and key are syntactically valid PEM but does not make a live network probe.

**What you will do in this lesson:**
1. **Tour** the TLS badge and three channel modes.
2. **See** Plaintext **Reflect** fail against the TLS-only server (:50443).
3. **Configure TLS** — switch mode, paste CA cert, run the local test, save.
4. **Reflect + Send** an Echo call over the encrypted channel.
5. **Server name override** — the SNI field for hostname mismatches.
6. **Configure mTLS** — switch mode, paste client cert + private key, save.
7. **Reflect + Send** over the mutual-auth channel (:50444).
8. **Secret vault** — learn how certs stay out of exports, then clean up.`,
    keyTerms: [
      {
        term: 'TLS (Transport Layer Security)',
        definition:
          'Encrypts the gRPC channel. The server presents a certificate; the client verifies it against a trusted CA. Prevents eavesdropping and impersonation.',
      },
      {
        term: 'Mutual TLS (mTLS)',
        definition:
          'Both client and server present certificates. The server additionally verifies the client\'s identity — used for zero-trust service-to-service auth.',
      },
      {
        term: 'CA Certificate',
        definition:
          'The Certificate Authority cert that signed the server\'s certificate. Required when the server uses a private or self-signed CA not in the system trust store.',
      },
      {
        term: 'Server name override (SNI)',
        definition:
          'Overrides the hostname used for TLS certificate verification. Use when the gRPC target is an IP address but the certificate CN/SAN uses a DNS name.',
      },
      {
        term: 'Secret vault',
        definition:
          'An in-session, in-memory store that holds PEM content. Material never lands in localStorage, collection exports, or History. A "Clear stored" button wipes it.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc5-arr-b" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc5-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpc5-arr-r" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#ef4444"/>
    </marker>
  </defs>

  <!-- Window chrome -->
  <rect x="1" y="1" width="698" height="255" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5"/>
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc">gRPC Studio — TLS Configuration</text>

  <!-- Connection bar -->
  <rect x="1" y="31" width="698" height="38" fill="#0f172a"/>
  <rect x="12" y="39" width="190" height="22" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="22" y="53" font-family="monospace" font-size="10" fill="#f1f5f9">localhost:50443</text>
  <!-- TLS badge — active -->
  <rect x="212" y="39" width="58" height="22" rx="11" fill="#1c3a2a" stroke="#22c55e" stroke-width="1"/>
  <text x="241" y="53" text-anchor="middle" font-size="9" fill="#22c55e">🔒 TLS ▸</text>
  <text x="215" y="71" font-size="7" fill="#22c55e">TLS badge</text>
  <!-- Auth badge -->
  <rect x="280" y="39" width="52" height="22" rx="11" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="306" y="53" text-anchor="middle" font-size="8.5" fill="#64748b">None ▸</text>
  <!-- Gear -->
  <rect x="342" y="39" width="22" height="22" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="353" y="53" text-anchor="middle" font-size="12" fill="#a8b8cc">⚙</text>

  <!-- TLS modal body (right half) -->
  <rect x="370" y="34" width="320" height="220" rx="6" fill="#0f172a" stroke="#22c55e" stroke-width="1.2"/>
  <text x="380" y="53" font-size="9.5" fill="#22c55e">🔒 TLS / mTLS Configuration</text>

  <!-- Mode selector row -->
  <text x="380" y="70" font-size="8" fill="#a8b8cc">TLS mode</text>
  <!-- Plaintext button -->
  <rect x="380" y="75" width="84" height="34" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="422" y="91" text-anchor="middle" font-size="9" fill="#64748b">🔓</text>
  <text x="422" y="102" text-anchor="middle" font-size="7.5" fill="#64748b">Plaintext</text>
  <!-- TLS button — active -->
  <rect x="468" y="75" width="84" height="34" rx="4" fill="#1c3a2a" stroke="#22c55e" stroke-width="1.2"/>
  <text x="510" y="91" text-anchor="middle" font-size="9" fill="#22c55e">🔒</text>
  <text x="510" y="102" text-anchor="middle" font-size="7.5" fill="#22c55e">TLS</text>
  <!-- mTLS button -->
  <rect x="556" y="75" width="84" height="34" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="598" y="91" text-anchor="middle" font-size="9" fill="#64748b">🛡</text>
  <text x="598" y="102" text-anchor="middle" font-size="7.5" fill="#64748b">mTLS</text>

  <!-- CA cert section -->
  <text x="380" y="122" font-size="8.5" fill="#a8b8cc">CA Certificate  <tspan fill="#64748b">(Optional)</tspan></text>
  <rect x="380" y="127" width="298" height="52" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="388" y="141" font-family="monospace" font-size="7" fill="#22c55e">-----BEGIN CERTIFICATE-----</text>
  <text x="388" y="151" font-family="monospace" font-size="7" fill="#4ade80">MIID1zCCAr+gAwIBAgIUeWV1...</text>
  <text x="388" y="161" font-family="monospace" font-size="7" fill="#22c55e">-----END CERTIFICATE-----</text>
  <!-- Set badge -->
  <rect x="642" y="127" width="28" height="14" rx="7" fill="#1c3a2a" stroke="#22c55e" stroke-width="0.7"/>
  <text x="656" y="137" text-anchor="middle" font-size="7" fill="#22c55e">Set</text>
  <text x="380" y="191" font-size="7.5" fill="#64748b">🔒 PEM stored in session vault — not exported</text>

  <!-- SNI field -->
  <text x="380" y="207" font-size="8" fill="#a8b8cc">Server name override (SNI)</text>
  <rect x="380" y="211" width="200" height="18" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="388" y="223" font-family="monospace" font-size="8" fill="#64748b">grpc.example.com</text>

  <!-- Test / Save footer -->
  <rect x="380" y="234" width="126" height="16" rx="3" fill="#0f172a" stroke="#3b4a60"/>
  <text x="443" y="245" text-anchor="middle" font-size="7.5" fill="#a8b8cc">Test TLS Connection</text>
  <rect x="558" y="234" width="56" height="16" rx="3" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="586" y="245" text-anchor="middle" font-size="7.5" fill="#93c5fd">Save</text>
  <rect x="620" y="234" width="46" height="16" rx="3" fill="#0f172a" stroke="#3b4a60"/>
  <text x="643" y="245" text-anchor="middle" font-size="7.5" fill="#a8b8cc">Close</text>

  <!-- Left half — three-mode diagram -->
  <text x="20" y="60" font-size="10" fill="#a8b8cc">Channel modes</text>

  <!-- Plaintext row -->
  <rect x="20" y="68" width="322" height="44" rx="4" fill="#0f172a" stroke="#3b4a60"/>
  <text x="30" y="85" font-size="11" fill="#64748b">🔓</text>
  <text x="50" y="85" font-size="9" fill="#a8b8cc">Plaintext</text>
  <text x="50" y="97" font-size="7.5" fill="#64748b">No TLS — HTTP/2 cleartext (default)</text>
  <line x1="200" y1="90" x2="340" y2="90" stroke="#3b4a60" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="350" y="94" font-size="8" fill="#64748b">:50051</text>

  <!-- TLS row -->
  <rect x="20" y="118" width="322" height="44" rx="4" fill="#051a0d" stroke="#22c55e" stroke-width="0.8"/>
  <text x="30" y="135" font-size="11" fill="#22c55e">🔒</text>
  <text x="50" y="135" font-size="9" fill="#22c55e">TLS</text>
  <text x="50" y="147" font-size="7.5" fill="#4ade80">Encrypted — server cert verified (CA cert optional)</text>
  <line x1="200" y1="140" x2="280" y2="140" stroke="#22c55e" stroke-width="1.2" marker-end="url(#grpc5-arr-g)"/>
  <text x="285" y="144" font-size="8" fill="#22c55e">:50443</text>

  <!-- mTLS row -->
  <rect x="20" y="168" width="322" height="44" rx="4" fill="#1a0533" stroke="#a855f7" stroke-width="0.8"/>
  <text x="30" y="185" font-size="11" fill="#a855f7">🛡</text>
  <text x="50" y="185" font-size="9" fill="#a855f7">mTLS</text>
  <text x="50" y="197" font-size="7.5" fill="#c084fc">Mutual TLS — client cert + key required</text>
  <line x1="200" y1="190" x2="280" y2="190" stroke="#a855f7" stroke-width="1.2" marker-end="url(#grpc5-arr-b)"/>
  <text x="285" y="194" font-size="8" fill="#a855f7">:50444</text>

  <!-- Legend: bottom row -->
  <text x="350" y="285" text-anchor="middle" font-size="11" fill="#a8b8cc">Lesson flow</text>

  <circle cx="42" cy="316" r="10" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="42" y="320" text-anchor="middle" font-size="9" fill="#3b82f6">1</text>
  <text x="42" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Tour</text>
  <line x1="53" y1="316" x2="82" y2="316" stroke="#3b82f6" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="93" cy="316" r="10" fill="#3b0a0a" stroke="#ef4444"/>
  <text x="93" y="320" text-anchor="middle" font-size="9" fill="#ef4444">2</text>
  <text x="93" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Fail plain</text>
  <line x1="104" y1="316" x2="133" y2="316" stroke="#3b82f6" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="144" cy="316" r="10" fill="#052e16" stroke="#22c55e"/>
  <text x="144" y="320" text-anchor="middle" font-size="9" fill="#22c55e">3</text>
  <text x="144" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Config TLS</text>
  <line x1="155" y1="316" x2="184" y2="316" stroke="#22c55e" marker-end="url(#grpc5-arr-g)"/>

  <circle cx="195" cy="316" r="10" fill="#052e16" stroke="#22c55e"/>
  <text x="195" y="320" text-anchor="middle" font-size="9" fill="#22c55e">4</text>
  <text x="195" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Send TLS</text>
  <line x1="206" y1="316" x2="235" y2="316" stroke="#3b82f6" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="246" cy="316" r="10" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="246" y="320" text-anchor="middle" font-size="9" fill="#3b82f6">5</text>
  <text x="246" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">SNI</text>
  <line x1="257" y1="316" x2="286" y2="316" stroke="#a855f7" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="297" cy="316" r="10" fill="#1a0533" stroke="#a855f7"/>
  <text x="297" y="320" text-anchor="middle" font-size="9" fill="#a855f7">6</text>
  <text x="297" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Config mTLS</text>
  <line x1="308" y1="316" x2="337" y2="316" stroke="#a855f7" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="348" cy="316" r="10" fill="#1a0533" stroke="#a855f7"/>
  <text x="348" y="320" text-anchor="middle" font-size="9" fill="#a855f7">7</text>
  <text x="348" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Send mTLS</text>
  <line x1="359" y1="316" x2="388" y2="316" stroke="#64748b" marker-end="url(#grpc5-arr-b)"/>

  <circle cx="399" cy="316" r="10" fill="#1e293b" stroke="#64748b"/>
  <text x="399" y="320" text-anchor="middle" font-size="9" fill="#a8b8cc">8</text>
  <text x="399" y="336" text-anchor="middle" font-size="7" fill="#94a3b8">Vault</text>
</svg>`,
  },

  steps: [
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
        await ensureStudioNav(ctx);
        await ensureGrpcTarget(ctx);
        await ensureEchoMethodSelected(ctx);
        await resetTlsToPlaintextQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 900);
        await ctx.click(GRPC.TLS_BADGE);
        try {
          await ctx.waitFor(GRPC.TLS_MODAL_BODY, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(650); // modal opened — read the title

        // Spotlight each mode button once — the 800ms hold is the digest pause.
        for (const mode of ['disabled', 'tls', 'mtls'] as const) {
          await spotlightAndPause(ctx, GRPC.TLS_MODE(mode), 800);
        }
        await ctx.delay(400);
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
        'This is the failure you hit the first time you point gRPC Studio at a TLS-enforced server without configuring the channel. ' +
        'The fix: switch the TLS badge to **TLS** mode and provide a CA cert (next step).',
      highlight: GRPC.REFLECT_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await resetTlsToPlaintextQuiet(ctx);
        await fillTargetQuiet(ctx, GRPC_TLS_TARGET);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_TLS_TARGET);
        await ctx.delay(400);

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
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 700);
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
        'With the method loaded, clicking **Send** routes the call through TLS to `localhost:50443`. ' +
        'The call returns **OK** with the echoed body.\n\n' +
        'The **TLS badge** stays lit 🔒 **TLS** in the connection bar. TLS settings are per-tab.',
      highlight: GRPC.REFLECT_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await ensureTlsEchoReadyQuiet(ctx);
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
        await ctx.delay(600);

        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 1_100);
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 700);
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
        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 700);
        await ctx.click(GRPC.TLS_BADGE);
        try {
          await ctx.waitFor(GRPC.TLS_MODAL_BODY, 5_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(600);

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
        await ctx.delay(600);

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
        'select **Echo**, then **Send**.\n\n' +
        'The server validates the client certificate before returning **OK** with the echoed body. ' +
        'Without a valid client cert, Reflect or Send would fail during the handshake.\n\n' +
        'The connection-bar badge stays 🛡 **mTLS** for this tab.',
      highlight: GRPC.REFLECT_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await ensureMtlsEchoReadyQuiet(ctx);
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

        await spotlightAndPause(ctx, GRPC.RESPONSE_PANEL, 1_100);
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
          await spotlightElementAndPause(ctx, badge, 650);
        }

        // Spotlight a "Clear stored" control if present.
        const clearBtn = document.querySelector<HTMLElement>('[data-testid="grpc-tls-server-ca-clear"]');
        if (clearBtn) {
          await spotlightElementAndPause(ctx, clearBtn, 800);
        }

        // Reset to Defaults (→ Plaintext) and persist.
        await spotlightAndPause(ctx, GRPC.TLS_MODAL_RESET, 800);
        const resetBtn = document.querySelector<HTMLButtonElement>(GRPC.TLS_MODAL_RESET);
        if (resetBtn && !resetBtn.disabled) {
          resetBtn.click();
          await ctx.delay(500);
        }
        await selectTlsModeQuiet(ctx, 'disabled');
        await saveOrCloseTlsModalQuiet(ctx);
        await ctx.delay(400);

        // Restore the default echo target.
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 600);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_DEMO_TARGET);
        await ctx.delay(400);

        await spotlightAndPause(ctx, GRPC.TLS_BADGE, 800); // back to Plaintext
      },
      verify: GRPC.CONNECTION_BAR,
    },
  ],
};
