/**
 * Pure fault + delay preview (side-effect-free twin of apiMockFaultExecutor).
 */
import type { ApiMockBehaviorV1, ApiMockFaultKind, ApiMockResponseVariantV1 } from './contracts';
import { clampTimeoutHoldMs, HARD_CEILINGS } from './defaults';

export interface VirtualDelayPreview {
  baseMs: number;
  jitterMs: number;
  totalMs: number;
}

export interface FaultTimelineStep {
  atMs: number;
  label: string;
}

export interface FaultPreview {
  fault: ApiMockFaultKind;
  deliveryOutcome: 'matched' | 'fault';
  httpCompleted: boolean;
  effectiveStatus: number;
  effectiveBody: string;
  /** Bytes that actually leave the socket (dribble chunks). Same as effectiveBody when complete. */
  wireBody: string;
  timeline: FaultTimelineStep[];
}

function seededInt(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return min + ((hash & 0x7fffffff) % (max - min + 1));
}

export function resolveMaxDelayMs(maxDelayMs: number): number {
  return maxDelayMs > 0 ? maxDelayMs : HARD_CEILINGS.maxDelayMs;
}

/** Virtual delay with optional seeded jitter (reproducible simulation traces). */
export function computeVirtualDelayMs(
  variant: ApiMockResponseVariantV1 | undefined,
  maxDelayMs: number,
  seed?: string,
): VirtualDelayPreview {
  if (!variant) return { baseMs: 0, jitterMs: 0, totalMs: 0 };
  const cap = resolveMaxDelayMs(maxDelayMs);
  const baseMs = Math.min(Math.max(0, variant.behavior.delayMs ?? 0), cap);
  const jitterCap = Math.min(Math.max(0, variant.behavior.jitterMs ?? 0), cap);
  if (jitterCap <= 0) return { baseMs, jitterMs: 0, totalMs: baseMs };
  const delta = seed
    ? seededInt(`${seed}:jitter`, -jitterCap, jitterCap)
    : Math.floor(Math.random() * (jitterCap * 2 + 1)) - jitterCap;
  const totalMs = Math.max(0, Math.min(cap, baseMs + delta));
  return { baseMs, jitterMs: delta, totalMs };
}

/** Preview connection-level fault delivery without touching a socket. */
export function previewFaultDelivery(
  fault: ApiMockFaultKind | undefined,
  behavior: ApiMockBehaviorV1,
  rendered: { status: number; body: string },
  longRunningMaxMs: number,
): FaultPreview {
  const kind: ApiMockFaultKind = fault && fault !== 'none' ? fault : 'none';

  if (kind === 'none') {
    return {
      fault: 'none',
      deliveryOutcome: 'matched',
      httpCompleted: true,
      effectiveStatus: rendered.status,
      effectiveBody: rendered.body,
      wireBody: rendered.body,
      timeline: [{ atMs: 0, label: 'Write status + body' }],
    };
  }

  if (kind === 'timeout') {
    const holdMs = clampTimeoutHoldMs(behavior.longRunningMs, longRunningMaxMs);
    return {
      fault: kind,
      deliveryOutcome: 'fault',
      httpCompleted: false,
      effectiveStatus: 0,
      effectiveBody: '',
      wireBody: '',
      timeline: [
        { atMs: 0, label: 'Hold socket open (no HTTP response)' },
        { atMs: holdMs, label: 'Destroy socket (timeout)' },
      ],
    };
  }

  if (kind === 'reset') {
    return {
      fault: kind,
      deliveryOutcome: 'fault',
      httpCompleted: false,
      effectiveStatus: 0,
      effectiveBody: '',
      wireBody: '',
      timeline: [{ atMs: 0, label: 'Socket destroy (TCP reset)' }],
    };
  }

  if (kind === 'close') {
    return {
      fault: kind,
      deliveryOutcome: 'fault',
      httpCompleted: false,
      effectiveStatus: 0,
      effectiveBody: '',
      wireBody: '',
      timeline: [{ atMs: 0, label: 'Abrupt end without status line' }],
    };
  }

  if (kind === 'malformed') {
    return {
      fault: kind,
      deliveryOutcome: 'fault',
      httpCompleted: false,
      effectiveStatus: 0,
      effectiveBody: '',
      wireBody: '',
      timeline: [{ atMs: 0, label: 'Write invalid bytes + destroy' }],
    };
  }

  // dribble
  const schedule = behavior.chunkSchedule?.length
    ? behavior.chunkSchedule
    : [
      { afterMs: 20, body: rendered.body.slice(0, Math.ceil(rendered.body.length / 2)) },
      { afterMs: 40, body: rendered.body.slice(Math.ceil(rendered.body.length / 2)) },
    ];
  let cursor = 0;
  const timeline: FaultTimelineStep[] = [
    { atMs: 0, label: 'Write headers (Transfer-Encoding: chunked)' },
  ];
  for (const chunk of schedule) {
    cursor += Math.max(0, chunk.afterMs);
    timeline.push({
      atMs: cursor,
      label: `Chunk ${JSON.stringify(chunk.body.slice(0, 48))}${chunk.body.length > 48 ? '…' : ''}`,
    });
  }
  timeline.push({ atMs: cursor, label: 'End stream' });
  const wireBody = schedule.map(chunk => chunk.body).join('');
  return {
    fault: 'dribble',
    deliveryOutcome: 'fault',
    httpCompleted: true,
    effectiveStatus: rendered.status,
    effectiveBody: rendered.body,
    wireBody,
    timeline,
  };
}
