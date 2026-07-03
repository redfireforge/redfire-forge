/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  GRPC_LESSON_ROSTER,
  assertRosterSchemaVersion,
  getGrpcLessonRosterEntry,
  shippedGrpcLessonRosterEntries,
} from './roster';
import { createGrpcLessonProgress } from './versioning';
import {
  validateGrpcDemoLesson,
  validateGrpcLessonRegistry,
} from './validate';
import { lessonShellDiffFromRoster } from './shell';
import { grpcFirstCallLesson } from '../grpc-first-call';
import type { DemoLesson } from '../../../types';

describe('grpc lesson roster helpers', () => {
  it('looks up roster entries by id', () => {
    expect(getGrpcLessonRosterEntry('grpc-first-call')?.number).toBe(1);
    expect(getGrpcLessonRosterEntry('missing')).toBeUndefined();
  });

  it('lists shipped lessons only', () => {
    const shipped = shippedGrpcLessonRosterEntries();
    expect(shipped.every((e) => e.implementationStatus === 'shipped')).toBe(true);
    expect(shipped.some((e) => e.id === 'grpc-first-call')).toBe(true);
  });

  it('assertRosterSchemaVersion passes for current roster', () => {
    expect(() => assertRosterSchemaVersion()).not.toThrow();
    expect(GRPC_LESSON_ROSTER.length).toBe(17);
  });
});

describe('validateGrpcDemoLesson edge cases', () => {
  it('rejects lessons without grpc contract block', () => {
    const bare: DemoLesson = {
      ...grpcFirstCallLesson,
      category: 'grpc',
    };
    delete (bare as { grpc?: unknown }).grpc;
    const result = validateGrpcDemoLesson(bare);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'grpc')).toBe(true);
  });

  it('rejects duplicate step ids', () => {
    const dup = {
      ...grpcFirstCallLesson,
      steps: [
        ...grpcFirstCallLesson.steps,
        { ...grpcFirstCallLesson.steps[0] },
      ],
    };
    const result = validateGrpcDemoLesson(dup);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('Duplicate'))).toBe(true);
  });

  it('rejects inline selectors not in GRPC namespace', () => {
    const bad = {
      ...grpcFirstCallLesson,
      steps: grpcFirstCallLesson.steps.map((s) =>
        s.id === 'grpc1-history'
          ? { ...s, verify: '[data-testid="not-in-grpc-namespace"]' }
          : s,
      ),
    };
    const result = validateGrpcDemoLesson(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes('verify'))).toBe(true);
  });

  it('rejects fixture metadata drift from roster', () => {
    const drifted = {
      ...grpcFirstCallLesson,
      grpc: {
        ...grpcFirstCallLesson.grpc,
        fixtures: { requireGoEcho: true },
      },
    };
    const result = validateGrpcDemoLesson(drifted);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'grpc')).toBe(true);
  });

  it('rejects shipped lessons missing setup/cleanup', () => {
    const noSetup = { ...grpcFirstCallLesson, setup: undefined };
    const result = validateGrpcDemoLesson(noSetup);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'lifecycle')).toBe(true);
  });

  it('detects shell field drift via lessonShellDiffFromRoster', () => {
    const entry = getGrpcLessonRosterEntry('grpc-first-call')!;
    const drifted = { ...grpcFirstCallLesson, name: 'Wrong title' };
    const diffs = lessonShellDiffFromRoster(drifted, entry);
    expect(diffs.some((d) => d.field === 'name')).toBe(true);
    const result = validateGrpcDemoLesson(drifted);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes('.name'))).toBe(true);
  });
});

describe('validateGrpcLessonRegistry edge cases', () => {
  it('flags lessons missing from roster', () => {
    const orphan: DemoLesson = {
      ...grpcFirstCallLesson,
      id: 'grpc-orphan',
      grpc: {
        ...grpcFirstCallLesson.grpc,
        rosterNumber: 99,
      },
    };
    const result = validateGrpcLessonRegistry([orphan]);
    expect(result.ok).toBe(false);
  });
});

describe('validateGrpcLessonRoster fixture probes', () => {
  it('requires express proxy health for shipped browser lessons', () => {
    const grpc1 = getGrpcLessonRosterEntry('grpc-first-call')!;
    expect(grpc1.dockerEndpoints?.some((u) => u.includes('3001'))).toBe(true);
    expect(grpc1.dockerCommand).toContain('npm run server');
    expect(grpc1.gateLabel).toBeTruthy();
  });

  it('spring lesson documents docker + express proxy', () => {
    const spring = getGrpcLessonRosterEntry('grpc-spring-boot')!;
    expect(spring.dockerEndpoints?.some((u) => u.includes('9090'))).toBe(true);
    expect(spring.dockerCommand).toContain('npm run server');
    expect(spring.dockerCommand).toContain('--profile spring');
  });
});

describe('createGrpcLessonProgress', () => {
  it('creates empty progress at current schema version', () => {
    const p = createGrpcLessonProgress('grpc-first-call');
    expect(p.lessonId).toBe('grpc-first-call');
    expect(p.completedStepIds).toEqual([]);
    expect(p.completed).toBe(false);
    expect(p.schemaVersion).toBeGreaterThanOrEqual(1);
  });
});
