/** GRPC-5 TLS lesson — helpers and fixture constants */
import { GRPC } from '@shared/selectors';
import {
  GRPC_ECHO_METHOD_SEL,
  GRPC_ECHO_SERVICE_SEL,
  closeGrpcSettingsDrawerQuiet,
  ensureGrpcRequestFormTabQuiet,
  ensureGrpcStudioSubNavQuiet,
  fillGrpcEchoMessage,
  grpcEchoComposerFieldSelector,
  isGrpcEchoComposerReady,
  spotlightAndPause,
  spotlightGrpcRequestComposer,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import { closeModalByButtonQuiet } from '../modal-close-helpers';
import { scrollDemoTargetIntoView } from '../../demoSpotlightUtils';
import type { GrpcDemoLesson } from './grpc-lesson-contract';

export type LessonCtx = Parameters<NonNullable<GrpcDemoLesson['steps'][number]['action']>>[0];
export type PreCtx = Parameters<NonNullable<GrpcDemoLesson['steps'][number]['preAction']>>[0];

// TLS fixture targets (Phase 12D Docker fixtures).
export const GRPC_TLS_TARGET = 'localhost:50443';
export const GRPC_MTLS_TARGET = 'localhost:50444';
/** Matches docker/grpc/certs/ CN/SAN — used for the SNI override demo. */
export const DEMO_SNI_HOSTNAME = 'localhost';

// File paths for grpcurl --cacert / --cert / --key (relative to project root).
export const DEMO_CA_CERT_PATH = './docker/grpc/certs/ca.crt';
export const DEMO_CLIENT_CERT_PATH = './docker/grpc/certs/client.crt';
export const DEMO_CLIENT_KEY_PATH = './docker/grpc/certs/client.key';

// PEM certificates from docker/grpc/certs/ — used for live TLS demonstrations.
export const DEMO_CA_CERT = `-----BEGIN CERTIFICATE-----
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

export const DEMO_CLIENT_CERT = `-----BEGIN CERTIFICATE-----
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

export const DEMO_CLIENT_KEY = `-----BEGIN PRIVATE KEY-----
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
export function currentTlsBadgeMode(): 'disabled' | 'tls' | 'mtls' | 'unknown' {
  const badge = document.querySelector<HTMLElement>(GRPC.TLS_BADGE);
  const text = (badge?.textContent ?? '').toLowerCase();
  if (!text) return 'unknown';
  // Order matters: badge copy often includes "TLS mode: Plaintext".
  if (text.includes('plaintext') || text.includes('disabled')) return 'disabled';
  if (text.includes('mtls') || text.includes('mutual tls')) return 'mtls';
  if (text.includes('tls')) return 'tls';
  return 'unknown';
}

/** Open the TLS config modal via the TLS badge. No-op if already open. */
export async function openTlsModalQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
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
export async function closeTlsModalQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
  await closeModalByButtonQuiet(ctx, GRPC.TLS_MODAL_CLOSE, 350);
}

/** Save the modal if the Save button is enabled (dirty); otherwise Close it. */
export async function saveOrCloseTlsModalQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
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
export async function resetTlsToPlaintextQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
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
export async function scrollTlsFieldIntoView(
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
export async function fillPemTextarea(ctx: LessonCtx | PreCtx, testId: string, content: string): Promise<void> {
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
export async function selectTlsModeQuiet(
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
export async function fillTargetQuiet(ctx: LessonCtx | PreCtx, target: string): Promise<void> {
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
export async function ensureTlsConfiguredQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
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
export async function ensureMtlsConfiguredQuiet(ctx: LessonCtx | PreCtx): Promise<void> {
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


/**
 * Visible reflect + Echo selection for send steps (with spotlight pacing).
 * Skips network reflect / method re-bind when `preAction` already prepared state —
 * avoids a duplicate TLS reflect round-trip and hybrid-mode PROTO_FORM waits.
 */
export async function reflectAndSelectEchoVisible(ctx: LessonCtx): Promise<void> {
  const treeReady = Boolean(document.querySelector(GRPC.EXPLORER_TREE));
  const composerReady = isGrpcEchoComposerReady();

  await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 700);

  if (!treeReady) {
    await ctx.click(GRPC.REFLECT_BTN);
    try {
      await ctx.waitFor(GRPC.EXPLORER_TREE, 12_000);
    } catch {
      await ctx.delay(400);
    }
    await ctx.delay(500);
  }

  await spotlightAndPause(ctx, GRPC.EXPLORER_TREE, 600);

  if (!composerReady) {
    if (document.querySelector(GRPC_ECHO_SERVICE_SEL) && !document.querySelector(GRPC_ECHO_METHOD_SEL)) {
      await spotlightAndPause(ctx, GRPC_ECHO_SERVICE_SEL, 600);
      await ctx.click(GRPC_ECHO_SERVICE_SEL);
      await ctx.delay(400);
    }
    if (document.querySelector(GRPC_ECHO_METHOD_SEL)) {
      await spotlightAndPause(ctx, GRPC_ECHO_METHOD_SEL, 600);
      await ctx.click(GRPC_ECHO_METHOD_SEL);
      try {
        await ctx.waitFor(GRPC.REQUEST_FORM_SCROLL, 8_000);
        await ctx.waitFor(grpcEchoComposerFieldSelector(), 8_000);
      } catch {
        await ctx.delay(400);
      }
    }
    await ensureGrpcRequestFormTabQuiet(ctx);
  } else {
    await ensureGrpcRequestFormTabQuiet(ctx);
    if (document.querySelector(GRPC_ECHO_METHOD_SEL)) {
      await spotlightAndPause(ctx, GRPC_ECHO_METHOD_SEL, 600);
    }
  }

  await fillGrpcEchoMessage(ctx);
  await spotlightGrpcRequestComposer(ctx);
}

/** Minimal nav guard: navigate to gRPC Studio, close overlays, ensure studio sub-nav. */
export async function ensureStudioNav(ctx: LessonCtx | PreCtx): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeTlsModalQuiet(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}
