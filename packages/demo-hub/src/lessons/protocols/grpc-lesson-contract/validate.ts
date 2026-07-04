/**
 * Phase 12A — validate shipped gRPC lessons and the canonical roster.
 */
import { GRPC } from '@shared/selectors';
import type { DemoLesson, DemoStep } from '../../../types';
import { GRPC_LESSON_ROSTER, GRPC_LESSON_ROSTER_BY_ID } from './roster';
import type {
  GrpcDemoLesson,
  GrpcLessonRosterEntry,
  GrpcLessonValidationIssue,
  GrpcLessonValidationResult,
} from './types';
import { assertRosterSchemaVersion } from './roster';
import { assertGrpcLessonMigrationsComplete } from './versioning';
import { buildGrpcContractMetaFromRoster, lessonShellDiffFromRoster } from './shell';

function collectGrpcSelectorStrings(): Set<string> {
  const values = new Set<string>();
  for (const value of Object.values(GRPC)) {
    if (typeof value === 'string') {
      values.add(value);
    }
  }
  return values;
}

const GRPC_SELECTOR_VALUES = collectGrpcSelectorStrings();
const GRPC_DYNAMIC_SELECTOR_PATTERNS = [
  /^\[data-testid="grpc-service-[a-z0-9-]+"\]$/,
  /^\[data-testid="grpc-method-[a-z0-9-]+"\]$/,
];

const LESSON_ID_PATTERN = /^grpc-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STEP_ID_PATTERN = /^grpc\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function issue(path: string, message: string): GrpcLessonValidationIssue {
  return { path, message };
}

function result(issues: GrpcLessonValidationIssue[]): GrpcLessonValidationResult {
  return { ok: issues.length === 0, issues };
}

function isGrpcDemoLesson(lesson: DemoLesson): lesson is GrpcDemoLesson {
  return lesson.category === 'grpc' && 'grpc' in lesson && lesson.grpc != null;
}

function selectorUsesGrpcNamespace(value: string | undefined, path: string, issues: GrpcLessonValidationIssue[]): void {
  if (!value) return;
  if (!value.includes('data-testid=')) return;
  if (!GRPC_SELECTOR_VALUES.has(value) && !GRPC_DYNAMIC_SELECTOR_PATTERNS.some((pattern) => pattern.test(value))) {
    issues.push(
      issue(
        path,
        `Selector "${value}" is not a GRPC.* constant from src/shared/selectors/grpc.ts`,
      ),
    );
  }
}

function validateStepContract(
  step: DemoStep,
  rosterNumber: number,
  issues: GrpcLessonValidationIssue[],
): void {
  const prefix = `steps[${step.id}]`;

  if (!STEP_ID_PATTERN.test(step.id)) {
    issues.push(
      issue(`${prefix}.id`, `Step id must match grpc{N}-slug (got "${step.id}")`),
    );
  } else if (!step.id.startsWith(`grpc${rosterNumber}-`)) {
    issues.push(
      issue(`${prefix}.id`, `Step id prefix must be grpc${rosterNumber}- (got "${step.id}")`),
    );
  }

  selectorUsesGrpcNamespace(step.highlight, `${prefix}.highlight`, issues);
  selectorUsesGrpcNamespace(step.verify, `${prefix}.verify`, issues);
}

function validateLessonMatchesRoster(
  lesson: DemoLesson,
  roster: GrpcLessonRosterEntry,
  issues: GrpcLessonValidationIssue[],
): void {
  const prefix = `lesson[${lesson.id}]`;

  for (const diff of lessonShellDiffFromRoster(lesson, roster)) {
    issues.push(
      issue(`${prefix}.${diff.field}`, `Must match roster (expected ${JSON.stringify(diff.expected)})`),
    );
  }
}

/** Validate a single shipped gRPC lesson wrapper against the frozen contract. */
export function validateGrpcDemoLesson(lesson: DemoLesson): GrpcLessonValidationResult {
  const issues: GrpcLessonValidationIssue[] = [];

  if (!isGrpcDemoLesson(lesson)) {
    issues.push(issue('grpc', 'Shipped gRPC lessons must include a `grpc` contract block'));
    return result(issues);
  }

  const roster = GRPC_LESSON_ROSTER_BY_ID[lesson.id];
  if (!roster) {
    issues.push(issue('id', `Unknown lesson id "${lesson.id}" — add roster entry before shipping`));
    return result(issues);
  }
  if (roster.implementationStatus !== 'shipped') {
    issues.push(issue('grpc.implementationStatus', 'Roster marks lesson as planned, not shipped'));
  }

  if (lesson.category !== 'grpc') {
    issues.push(issue('category', 'category must be "grpc"'));
  }
  if (lesson.domainId !== 'protocols') {
    issues.push(issue('domainId', 'domainId must be "protocols"'));
  }
  if (!lesson.setup || !lesson.cleanup) {
    issues.push(issue('lifecycle', 'Shipped gRPC lessons must define setup and cleanup'));
  }
  if (!LESSON_ID_PATTERN.test(lesson.id)) {
    issues.push(issue('id', `Lesson id must be kebab-case grpc-* (got "${lesson.id}")`));
  }
  if (lesson.grpc.implementationStatus !== 'shipped') {
    issues.push(issue('grpc.implementationStatus', 'Must be "shipped" for published wrappers'));
  }

  const expectedContract = buildGrpcContractMetaFromRoster(roster);
  if (JSON.stringify(lesson.grpc) !== JSON.stringify(expectedContract)) {
    issues.push(
      issue(
        'grpc',
        'grpc contract block must match buildGrpcContractMetaFromRoster(roster)',
      ),
    );
  }

  validateLessonMatchesRoster(lesson, roster, issues);

  const stepIds = new Set<string>();
  for (const step of lesson.steps) {
    if (stepIds.has(step.id)) {
      issues.push(issue(`steps[${step.id}]`, 'Duplicate step id'));
    }
    stepIds.add(step.id);
    validateStepContract(step, roster.number, issues);
  }

  const lastStep = lesson.steps[lesson.steps.length - 1];
  if (lastStep && !lastStep.verify) {
    issues.push(issue(`steps[${lastStep.id}].verify`, 'Final step must define verify for E2E smoke'));
  }

  const minMinutes = Math.max(1, Math.ceil(lesson.steps.length * 0.4));
  if (lesson.estimatedMinutes < minMinutes) {
    issues.push(
      issue(
        'estimatedMinutes',
        `estimatedMinutes (${lesson.estimatedMinutes}) is low for ${lesson.steps.length} steps (min ~${minMinutes})`,
      ),
    );
  }

  if (lesson.tag?.includes('🐳') && !lesson.dockerEndpoint && !lesson.dockerEndpoints?.length) {
    issues.push(issue('dockerEndpoint', 'Docker-tagged lessons must set dockerEndpoint or dockerEndpoints'));
  }

  return result(issues);
}

/** Validate fixture requirements align with prerequisite health probes. */
function validateRosterFixtureEndpoints(
  entry: GrpcLessonRosterEntry,
  issues: GrpcLessonValidationIssue[],
): void {
  const prefix = `roster[${entry.id}]`;
  const endpoints = [
    ...(entry.dockerEndpoints ?? []),
    ...(entry.dockerEndpoint ? [entry.dockerEndpoint] : []),
  ].join(' ');

  const hasDockerPrereqs = Boolean(entry.tag?.includes('🐳') || entry.dockerEndpoints?.length);
  const isStudioLesson = entry.initialTab === 'grpc-studio';

  if (entry.fixtures.requireGoEcho && hasDockerPrereqs && !endpoints.includes('50052')) {
    issues.push(
      issue(`${prefix}.dockerEndpoints`, 'requireGoEcho needs :50052 health in dockerEndpoints'),
    );
  }
  if (entry.fixtures.requireExpressProxy && isStudioLesson) {
    if (!endpoints.includes('3001')) {
      issues.push(
        issue(`${prefix}.dockerEndpoints`, 'requireExpressProxy studio lessons need :3001 health in dockerEndpoints'),
      );
    }
    if (!entry.dockerCommand?.includes('npm run server')) {
      issues.push(
        issue(`${prefix}.dockerCommand`, 'requireExpressProxy studio lessons must document npm run server'),
      );
    }
  }
  if (entry.fixtures.requireSpringBoot && hasDockerPrereqs && !endpoints.includes('9090')) {
    issues.push(
      issue(`${prefix}.dockerEndpoints`, 'requireSpringBoot needs :9090 health in dockerEndpoints'),
    );
  }
}

/** Validate the canonical 18-lesson roster (metadata contract). */
export function validateGrpcLessonRoster(): GrpcLessonValidationResult {
  const issues: GrpcLessonValidationIssue[] = [];
  try {
    assertRosterSchemaVersion();
    assertGrpcLessonMigrationsComplete();
  } catch (error) {
    issues.push(
      issue('roster', error instanceof Error ? error.message : 'Roster schema version assertion failed'),
    );
  }
  const ids = new Set<string>();
  const numbers = new Set<number>();

  const EXPECTED_ROSTER_SIZE = GRPC_LESSON_ROSTER.length;

  for (const entry of GRPC_LESSON_ROSTER) {
    const prefix = `roster[${entry.id}]`;

    if (ids.has(entry.id)) {
      issues.push(issue(`${prefix}.id`, 'Duplicate lesson id'));
    }
    ids.add(entry.id);

    if (numbers.has(entry.number)) {
      issues.push(issue(`${prefix}.number`, 'Duplicate lesson number'));
    }
    numbers.add(entry.number);

    if (entry.number < 1 || entry.number > EXPECTED_ROSTER_SIZE) {
      issues.push(issue(`${prefix}.number`, `number must be 1–${EXPECTED_ROSTER_SIZE}`));
    }
    const expectedIndex = entry.number - 1;
    const actualIndex = GRPC_LESSON_ROSTER.indexOf(entry);
    if (actualIndex !== expectedIndex) {
      issues.push(
        issue(
          `${prefix}.number`,
          `Roster array order must match lesson number (GRPC-${entry.number} expected at index ${expectedIndex}, found at ${actualIndex})`,
        ),
      );
    }
    if (!LESSON_ID_PATTERN.test(entry.id)) {
      issues.push(issue(`${prefix}.id`, 'id must match grpc-* kebab-case pattern'));
    }
    if (!entry.title.trim()) {
      issues.push(issue(`${prefix}.title`, 'title is required'));
    }
    if (!entry.keyConcept.trim()) {
      issues.push(issue(`${prefix}.keyConcept`, 'keyConcept is required'));
    }
    if (entry.phaseDependencies.length === 0) {
      issues.push(issue(`${prefix}.phaseDependencies`, 'At least one product phase dependency required'));
    }
    if (entry.introducedInSchemaVersion < 1) {
      issues.push(issue(`${prefix}.introducedInSchemaVersion`, 'Must be >= 1'));
    }
    if (entry.tag?.includes('🐳') && !entry.dockerEndpoint && !entry.dockerEndpoints?.length) {
      issues.push(issue(`${prefix}.dockerEndpoint`, 'Docker tag requires dockerEndpoint or dockerEndpoints'));
    }
    if ((entry.dockerEndpoints?.length ?? 0) > 1 && !entry.gateLabel?.trim()) {
      issues.push(issue(`${prefix}.gateLabel`, 'Multi-service lessons must define gateLabel'));
    }
    if (entry.implementationStatus === 'shipped' && !entry.initialTab) {
      issues.push(issue(`${prefix}.initialTab`, 'Shipped lessons must define initialTab'));
    }
    validateRosterFixtureEndpoints(entry, issues);
  }

  for (let n = 1; n <= EXPECTED_ROSTER_SIZE; n += 1) {
    if (!numbers.has(n)) {
      issues.push(issue('roster', `Missing roster entry for GRPC-${n}`));
    }
  }

  return result(issues);
}

/** Ensure every shipped roster row has a matching lesson export. */
export function validateGrpcLessonRegistry(lessons: readonly DemoLesson[]): GrpcLessonValidationResult {
  const issues: GrpcLessonValidationIssue[] = [];

  const rosterResult = validateGrpcLessonRoster();
  issues.push(...rosterResult.issues);

  const byId = new Map(lessons.map((l) => [l.id, l]));
  for (const entry of GRPC_LESSON_ROSTER) {
    if (entry.implementationStatus !== 'shipped') continue;
    const lesson = byId.get(entry.id);
    if (!lesson) {
      issues.push(issue(`registry`, `Missing shipped lesson wrapper for "${entry.id}"`));
      continue;
    }
    const lessonResult = validateGrpcDemoLesson(lesson);
    issues.push(...lessonResult.issues);
  }

  for (const lesson of lessons) {
    if (lesson.category !== 'grpc') continue;
    if (!GRPC_LESSON_ROSTER_BY_ID[lesson.id]) {
      issues.push(issue(`registry[${lesson.id}]`, 'Lesson not in canonical roster'));
    }
  }

  return result(issues);
}
