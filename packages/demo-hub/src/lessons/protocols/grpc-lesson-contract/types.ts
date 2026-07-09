/**
 * Phase 12A — frozen gRPC Demo Hub lesson contract types.
 * Bump `GRPC_LESSON_SCHEMA_VERSION` only with a migration entry in `versioning.ts`.
 */
import type { DemoLesson } from '../../../types';

/** Current schema version for all gRPC lesson definitions. */
export const GRPC_LESSON_SCHEMA_VERSION = 1;

export type GrpcLessonImplementationStatus = 'shipped' | 'planned';

/** Product phase gates referenced by roster `phaseDependencies`. */
export type GrpcLessonProductPhase = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 9 | 10 | 11 | 12;

/** Docker / proxy fixtures a lesson requires at runtime. */
export interface GrpcLessonFixtureRequirements {
  /** Go echo server on :50051 with :50052 health (docker/grpc). */
  requireGoEcho?: boolean;
  /** Spring Boot gRPC server on :9090 (Netty) and :8081 (servlet/actuator) — GRPC-15. */
  requireSpringBoot?: boolean;
  /** Express webhook server on :3001 for /api/grpc proxy (browser mode). */
  requireExpressProxy?: boolean;
  /**
   * Lesson requires the Tauri desktop runtime.
   * When true, the lesson is marked desktopOnly and blocked on web via
   * isLessonDesktopOnlyBlocked() in lessonPlatform.ts.
   */
  requiresTauri?: boolean;
}

/**
 * Canonical roster row for GRPC-1…GRPC-15.
 * `id` is immutable once published — never rename; add `successorId` in a migration if needed.
 */
export interface GrpcLessonRosterEntry {
  number: number;
  id: string;
  title: string;
  keyConcept: string;
  phaseDependencies: readonly GrpcLessonProductPhase[];
  fixtures: GrpcLessonFixtureRequirements;
  implementationStatus: GrpcLessonImplementationStatus;
  /** Schema version when this lesson id first appeared in the roster. */
  introducedInSchemaVersion: number;
  dockerEndpoint?: string;
  dockerEndpoints?: readonly string[];
  dockerCommand?: string;
  initialTab?: string;
  allowedTabs?: readonly string[];
  estimatedMinutes?: number;
  tag?: string;
  /** PrerequisiteGate title when dockerEndpoints are set. */
  gateLabel?: string;
}

/** gRPC-specific metadata attached to shipped `DemoLesson` wrappers. */
export interface GrpcLessonContractMeta {
  schemaVersion: number;
  rosterNumber: number;
  phaseDependencies: readonly GrpcLessonProductPhase[];
  fixtures: GrpcLessonFixtureRequirements;
  implementationStatus: 'shipped';
}

/** Shipped gRPC demo lesson — `DemoLesson` plus frozen roster metadata. */
export type GrpcDemoLesson = DemoLesson & {
  category: 'grpc';
  grpc: GrpcLessonContractMeta;
};

export interface GrpcLessonValidationIssue {
  path: string;
  message: string;
}

export interface GrpcLessonValidationResult {
  ok: boolean;
  issues: GrpcLessonValidationIssue[];
}
