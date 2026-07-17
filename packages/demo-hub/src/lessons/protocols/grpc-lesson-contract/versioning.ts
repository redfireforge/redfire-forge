/**
 * Phase 12A — lesson schema versioning and progress migration policy.
 *
 * Policy:
 * - Lesson `id` is immutable once published (e.g. `grpc-first-call`).
 * - Bump `GRPC_LESSON_SCHEMA_VERSION` when roster metadata or step contracts change incompatibly.
 * - Add a migration function per version bump; keep no-op migrations for documentation.
 * - Stored demo progress keyed by lesson id resets step index when schema version increases
 *   unless a migration preserves completion state explicitly.
 */
import { GRPC_LESSON_SCHEMA_VERSION } from './types';

export interface GrpcLessonStoredProgress {
  lessonId: string;
  schemaVersion: number;
  completedStepIds: string[];
  completed: boolean;
}

export interface GrpcLessonMigrationResult {
  progress: GrpcLessonStoredProgress;
  migrated: boolean;
  fromVersion: number;
  toVersion: number;
}

type MigrationFn = (progress: GrpcLessonStoredProgress) => GrpcLessonStoredProgress;

const MIGRATIONS: Record<number, MigrationFn> = {
  // v1: initial schema — identity migration documents baseline.
  1: (p) => p,
};

/** Returns true when stored progress can run on the current schema without reset. */
export function isGrpcLessonProgressCompatible(
  storedSchemaVersion: number | undefined,
): boolean {
  if (storedSchemaVersion == null) return true;
  return storedSchemaVersion === GRPC_LESSON_SCHEMA_VERSION;
}

/**
 * Migrate stored lesson progress to the current schema version.
 * Unknown versions reset completion (safe default per 12C isolation policy).
 */
export function migrateGrpcLessonProgress(
  progress: GrpcLessonStoredProgress,
): GrpcLessonMigrationResult {
  const fromVersion = progress.schemaVersion ?? 1;
  if (fromVersion === GRPC_LESSON_SCHEMA_VERSION) {
    return {
      progress: { ...progress, schemaVersion: GRPC_LESSON_SCHEMA_VERSION },
      migrated: false,
      fromVersion,
      toVersion: GRPC_LESSON_SCHEMA_VERSION,
    };
  }

  if (fromVersion > GRPC_LESSON_SCHEMA_VERSION) {
    return {
      progress: {
        lessonId: progress.lessonId,
        schemaVersion: GRPC_LESSON_SCHEMA_VERSION,
        completedStepIds: [],
        completed: false,
      },
      migrated: true,
      fromVersion,
      toVersion: GRPC_LESSON_SCHEMA_VERSION,
    };
  }

  let current = { ...progress, schemaVersion: fromVersion };
  for (let v = fromVersion; v < GRPC_LESSON_SCHEMA_VERSION; v += 1) {
    const nextVersion = v + 1;
    const migrate = MIGRATIONS[nextVersion];
    if (!migrate) {
      current = {
        lessonId: current.lessonId,
        schemaVersion: GRPC_LESSON_SCHEMA_VERSION,
        completedStepIds: [],
        completed: false,
      };
      break;
    }
    current = { ...migrate(current), schemaVersion: nextVersion };
  }

  return {
    progress: { ...current, schemaVersion: GRPC_LESSON_SCHEMA_VERSION },
    migrated: true,
    fromVersion,
    toVersion: GRPC_LESSON_SCHEMA_VERSION,
  };
}

/** Create fresh progress record for a lesson at the current schema version. */
export function createGrpcLessonProgress(lessonId: string): GrpcLessonStoredProgress {
  return {
    lessonId,
    schemaVersion: GRPC_LESSON_SCHEMA_VERSION,
    completedStepIds: [],
    completed: false,
  };
}

/** Gate helper — every schema version up to the current one must have a migration fn. */
export function assertGrpcLessonMigrationsComplete(): void {
  for (let version = 1; version <= GRPC_LESSON_SCHEMA_VERSION; version += 1) {
    if (!MIGRATIONS[version]) {
      throw new Error(
        `Missing gRPC lesson migration for schema version ${version} (GRPC_LESSON_SCHEMA_VERSION=${GRPC_LESSON_SCHEMA_VERSION})`,
      );
    }
  }
}
