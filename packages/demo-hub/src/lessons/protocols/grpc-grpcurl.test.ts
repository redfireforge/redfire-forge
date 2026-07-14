/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { validateGrpcDemoLesson, getGrpcLessonRosterEntry } from './grpc-lesson-contract';
import { grpcGrpcurlLesson } from './grpc-grpcurl';

describe('grpc-grpcurl lesson', () => {
  it('registers GRPC-22 metadata and 8 steps', () => {
    expect(grpcGrpcurlLesson.id).toBe('grpc-grpcurl');
    expect(grpcGrpcurlLesson.category).toBe('grpc');
    expect(grpcGrpcurlLesson.grpc.rosterNumber).toBe(22);
    expect(grpcGrpcurlLesson.steps).toHaveLength(8);
    expect(grpcGrpcurlLesson.initialTab).toBe('grpc-studio');
    expect(grpcGrpcurlLesson.allowedTabs).toContain('demo-hub');
  });

  it('passes Phase 12A lesson contract validation', () => {
    const result = validateGrpcDemoLesson(grpcGrpcurlLesson);
    expect(result.ok, result.issues.map((i) => `${i.path}: ${i.message}`).join('\n')).toBe(true);
  });

  it('final step teaches secret filtering in exported grpcurl commands', () => {
    const last = grpcGrpcurlLesson.steps.at(-1)!;
    expect(last.id).toBe('grpc22-secret-filtering');
    expect(last.description.toLowerCase()).toContain('auth');
  });

  it('id and title stay in sync with roster', () => {
    const roster = getGrpcLessonRosterEntry('grpc-grpcurl')!;
    expect(grpcGrpcurlLesson.name).toBe(roster.title);
    expect(roster.number).toBe(22);
  });
});
