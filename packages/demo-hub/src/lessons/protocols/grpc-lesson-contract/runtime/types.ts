/**
 * Phase 12B — gRPC lesson runtime types (in-memory run session).
 */
import { GRPC_LESSON_SCHEMA_VERSION } from '../types';

/** Live lesson run lifecycle — `locked` is enforced by 12F dependency gating. */
export type GrpcLessonRuntimeStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'locked';

export type GrpcLessonDescriptorSource = 'reflection' | 'proto-import' | 'protoset';
export type GrpcLessonCallType = 'unary' | 'server-stream' | 'client-stream' | 'bidi';
export type GrpcLessonTransportMode = 'express' | 'tauri';

/** Progress flags advanced by step checkpoints (extended per lesson in 12H). */
export interface GrpcLessonRunFlags {
  targetSet: boolean;
  reflected: boolean;
  methodSelected: boolean;
  messageFilled: boolean;
  executed: boolean;
}

export const EMPTY_GRPC_LESSON_RUN_FLAGS: GrpcLessonRunFlags = {
  targetSet: false,
  reflected: false,
  methodSelected: false,
  messageFilled: false,
  executed: false,
};

/** Immutable scenario bound at run start — never mutate after `Object.freeze`. */
export interface GrpcLessonScenarioSnapshot {
  lessonId: string;
  schemaVersion: number;
  /** Stable hash of scenario fields (excludes run metadata). */
  fingerprint: string;
  target: string;
  descriptorSource: GrpcLessonDescriptorSource;
  service: string;
  method: string;
  callType: GrpcLessonCallType;
  requestPayload: Readonly<Record<string, unknown>>;
  expectedStatus: 'OK';
  transportMode: GrpcLessonTransportMode;
  fixtureFingerprint: string;
}

/** Maps a lesson step to runtime flag expectations after successful verify. */
export interface GrpcLessonStepCheckpoint {
  stepId: string;
  setsFlags: Partial<GrpcLessonRunFlags>;
  verifySelector?: string;
}

export interface GrpcLessonRunState {
  status: GrpcLessonRuntimeStatus;
  lessonId: string;
  runId: string;
  snapshot: GrpcLessonScenarioSnapshot;
  stepIndex: number;
  flags: GrpcLessonRunFlags;
  startedAt: number;
  lockReason?: string;
  lastError?: string;
}

export type GrpcLessonRuntimeEvent =
  | { type: 'start'; lessonId: string; snapshot: GrpcLessonScenarioSnapshot }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'complete' }
  | { type: 'fail'; error: string }
  | { type: 'reset'; lessonId: string; snapshot: GrpcLessonScenarioSnapshot }
  | { type: 'lock'; lessonId: string; reason: string; snapshot: GrpcLessonScenarioSnapshot }
  | { type: 'step-advance'; stepIndex: number; flags?: Partial<GrpcLessonRunFlags> };

export const GRPC_LESSON_RUNTIME_SCHEMA_VERSION = GRPC_LESSON_SCHEMA_VERSION;
