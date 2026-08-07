import type { DemoActionContext } from '../../../types';
import { GRPC } from '@shared/selectors';
import { captureGrpcActiveDescriptorKey } from '../../../adapters';
import { grpcLessonSession } from './constants';
import { setGrpcLessonRunFlag } from '../grpc-lesson-contract/runtime';
import {
  ensureGrpcPlaintextChannelReady,
  ensureGrpcTarget,
  resetGrpcConnectionSettingsQuiet,
} from './connection';
import { GRPC_DEMO_TARGET } from './constants';

function isPlaintextDemoTargetAddress(): boolean {
  const value = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT)?.value.trim() ?? '';
  if (!value || value === GRPC_DEMO_TARGET) return true;
  // Common loopback forms of the plaintext fixture.
  return /(?:localhost|127\.0\.0\.1):50051\b/i.test(value);
}

export async function ensureGrpcReflected(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcTarget(ctx);
  const hasExplorerReflectionData = () =>
    Boolean(document.querySelector(GRPC.EXPLORER_TREE) || document.querySelector(GRPC.EXPLORER_SOURCE));

  if (grpcLessonSession.reflected && hasExplorerReflectionData()) {
    return;
  }

  // Plaintext echo fixture (:50051) rejects TLS handshakes with HTTP 503.
  // Always clear sticky TLS/mTLS (and wait for the demo bridge) before Reflect.
  if (isPlaintextDemoTargetAddress()) {
    await ensureGrpcPlaintextChannelReady(ctx);
  }

  let reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
  if (reflectBtn?.disabled) {
    await resetGrpcConnectionSettingsQuiet(ctx);
    reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
  }

  if (reflectBtn && !reflectBtn.disabled) {
    await ctx.click(GRPC.REFLECT_BTN);
  }

  const reflectionLoadTimeoutMs = reflectBtn?.disabled ? 3_500 : 12_000;
  try {
    await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_SOURCE}`, reflectionLoadTimeoutMs);
  } catch {
    // Demo lessons should remain navigable even when local reflection infra
    // is unavailable or temporarily unhealthy.
  }

  if (hasExplorerReflectionData()) {
    captureGrpcActiveDescriptorKey();
    await ctx.delay(500);
    setGrpcLessonRunFlag('reflected', true);
  }
}

export async function guardGrpcReflectedQuiet(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GRPC.EXPLORER_TREE) || document.querySelector(GRPC.EXPLORER_SOURCE)) {
    setGrpcLessonRunFlag('reflected', true);
    return;
  }
  await ensureGrpcReflected(ctx);
}
