/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { validateGrpcLessonRegistry } from './grpc-lesson-contract';
import { grpcLessons, shippedGrpcLessonCount } from './grpc-lessons';

describe('grpcLessons registry', () => {
  it('passes Phase 12A contract validation', () => {
    const result = validateGrpcLessonRegistry(grpcLessons);
    expect(result.ok, result.issues.map((i) => `${i.path}: ${i.message}`).join('\n')).toBe(true);
  });

  it('exports only shipped roster lessons', () => {
    expect(shippedGrpcLessonCount()).toBe(grpcLessons.length);
  });
});
