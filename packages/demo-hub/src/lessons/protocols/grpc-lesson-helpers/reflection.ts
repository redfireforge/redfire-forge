import type { DemoActionContext } from '../../../types';
import { GRPC } from '@shared/selectors';
import { captureGrpcActiveDescriptorKey } from '../../../adapters';
import { grpcLessonSession } from './constants';
import { setGrpcLessonRunFlag } from '../grpc-lesson-contract/runtime';
import { ensureGrpcTarget, resetGrpcConnectionSettingsQuiet } from './connection';

export async function ensureGrpcReflected(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcTarget(ctx);
  const hasExplorerReflectionData = () =>
    Boolean(document.querySelector(GRPC.EXPLORER_TREE) || document.querySelector(GRPC.EXPLORER_SOURCE));

  if (grpcLessonSession.reflected && hasExplorerReflectionData()) {
    return;
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
