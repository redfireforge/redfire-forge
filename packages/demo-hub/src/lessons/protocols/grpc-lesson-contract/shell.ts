/**
 * Phase 12A — map canonical roster metadata onto DemoLesson shell fields.
 * Shipped lesson wrappers should spread this to avoid roster drift.
 */
import type { DemoLesson } from '../../../types';
import type { GrpcLessonContractMeta, GrpcLessonRosterEntry } from './types';
import { GRPC_LESSON_SCHEMA_VERSION } from './types';

export type GrpcLessonShellFields = Pick<
  DemoLesson,
  | 'id'
  | 'name'
  | 'estimatedMinutes'
  | 'initialTab'
  | 'allowedTabs'
  | 'dockerEndpoint'
  | 'dockerEndpoints'
  | 'dockerCommand'
  | 'gateLabel'
  | 'tag'
>;

/** Copy roster-authored shell fields for a gRPC lesson wrapper. */
export function buildGrpcLessonShellFromRoster(entry: GrpcLessonRosterEntry): GrpcLessonShellFields {
  return {
    id: entry.id,
    name: entry.title,
    estimatedMinutes: entry.estimatedMinutes ?? 4,
    initialTab: entry.initialTab,
    allowedTabs: entry.allowedTabs ? [...entry.allowedTabs] : undefined,
    dockerEndpoint: entry.dockerEndpoint,
    dockerEndpoints: entry.dockerEndpoints ? [...entry.dockerEndpoints] : undefined,
    dockerCommand: entry.dockerCommand,
    gateLabel: entry.gateLabel,
    tag: entry.tag,
  };
}

/** Copy roster-authored `grpc` metadata for a shipped lesson wrapper. */
export function buildGrpcContractMetaFromRoster(entry: GrpcLessonRosterEntry): GrpcLessonContractMeta {
  return {
    schemaVersion: GRPC_LESSON_SCHEMA_VERSION,
    rosterNumber: entry.number,
    phaseDependencies: [...entry.phaseDependencies],
    fixtures: { ...entry.fixtures },
    implementationStatus: 'shipped',
  };
}

const SHELL_FIELD_KEYS: (keyof GrpcLessonShellFields)[] = [
  'id',
  'name',
  'estimatedMinutes',
  'initialTab',
  'allowedTabs',
  'dockerEndpoint',
  'dockerEndpoints',
  'dockerCommand',
  'gateLabel',
  'tag',
];

/** Compare lesson shell fields to roster-authored expectations. */
export function lessonShellDiffFromRoster(
  lesson: DemoLesson,
  entry: GrpcLessonRosterEntry,
): Array<{ field: keyof GrpcLessonShellFields; expected: unknown; actual: unknown }> {
  const expected = buildGrpcLessonShellFromRoster(entry);
  const diffs: Array<{ field: keyof GrpcLessonShellFields; expected: unknown; actual: unknown }> = [];
  for (const field of SHELL_FIELD_KEYS) {
    const exp = expected[field];
    const act = lesson[field];
    if (JSON.stringify(exp) !== JSON.stringify(act)) {
      diffs.push({ field, expected: exp, actual: act });
    }
  }
  return diffs;
}
