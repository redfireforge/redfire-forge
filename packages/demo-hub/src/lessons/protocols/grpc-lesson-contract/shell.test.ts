/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { getGrpcLessonRosterEntry } from './roster';
import { buildGrpcContractMetaFromRoster, buildGrpcLessonShellFromRoster } from './shell';
import { GRPC_LESSON_SCHEMA_VERSION } from './types';

describe('buildGrpcLessonShellFromRoster', () => {
  it('maps GRPC-1 roster metadata onto lesson shell fields', () => {
    const entry = getGrpcLessonRosterEntry('grpc-first-call')!;
    const shell = buildGrpcLessonShellFromRoster(entry);
    expect(shell.id).toBe('grpc-first-call');
    expect(shell.name).toBe(entry.title);
    expect(shell.dockerEndpoints).toEqual([...entry.dockerEndpoints!]);
    expect(shell.gateLabel).toBe('🐳 Local setup required');
    expect(shell.initialTab).toBe('grpc-studio');
  });

  it('maps express-only roster rows without docker tag', () => {
    // grpc-mock-server is an express-proxy-only lesson (no Docker echo fixture).
    const mock = getGrpcLessonRosterEntry('grpc-mock-server')!;
    const shell = buildGrpcLessonShellFromRoster(mock);
    expect(shell.tag).toBeUndefined();
    expect(shell.dockerEndpoints?.some((u) => u.includes('3001'))).toBe(true);
    expect(shell.dockerCommand).toBe('npm run server');
  });

  it('maps go-echo docker rows with docker tag for grpc-tls', () => {
    const tls = getGrpcLessonRosterEntry('grpc-tls')!;
    const shell = buildGrpcLessonShellFromRoster(tls);
    expect(shell.tag).toBe('🐳 Docker');
    expect(shell.dockerEndpoints?.some((u) => u.includes('3001'))).toBe(true);
    expect(shell.gateLabel).toBe('🐳 Local setup required');
  });

  it('buildGrpcContractMetaFromRoster copies roster grpc metadata for shipped lessons', () => {
    const entry = getGrpcLessonRosterEntry('grpc-first-call')!;
    const meta = buildGrpcContractMetaFromRoster(entry);
    expect(meta).toEqual({
      schemaVersion: GRPC_LESSON_SCHEMA_VERSION,
      rosterNumber: 1,
      phaseDependencies: [1],
      fixtures: entry.fixtures,
      implementationStatus: 'shipped',
    });
  });
});
