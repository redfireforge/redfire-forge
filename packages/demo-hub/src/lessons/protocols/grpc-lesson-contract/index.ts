export {
  GRPC_LESSON_SCHEMA_VERSION,
  type GrpcDemoLesson,
  type GrpcLessonContractMeta,
  type GrpcLessonFixtureRequirements,
  type GrpcLessonProductPhase,
  type GrpcLessonRosterEntry,
  type GrpcLessonValidationIssue,
  type GrpcLessonValidationResult,
} from './types';

export {
  GRPC_LESSON_ROSTER,
  GRPC_LESSON_ROSTER_BY_ID,
  assertRosterSchemaVersion,
  getGrpcLessonRosterEntry,
  shippedGrpcLessonRosterEntries,
} from './roster';

export {
  validateGrpcDemoLesson,
  validateGrpcLessonRegistry,
  validateGrpcLessonRoster,
} from './validate';

export {
  createGrpcLessonProgress,
  isGrpcLessonProgressCompatible,
  migrateGrpcLessonProgress,
  assertGrpcLessonMigrationsComplete,
  type GrpcLessonMigrationResult,
  type GrpcLessonStoredProgress,
} from './versioning';

export {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  lessonShellDiffFromRoster,
  type GrpcLessonShellFields,
} from './shell';

export * from './runtime';
