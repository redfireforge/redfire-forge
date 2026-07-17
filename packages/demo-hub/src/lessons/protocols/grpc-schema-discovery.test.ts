/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { validateGrpcDemoLesson, getGrpcLessonRosterEntry } from './grpc-lesson-contract';
import { grpcSchemaDiscoveryLesson } from './grpc-schema-discovery';

describe('grpc-schema-discovery lesson', () => {
  it('registers GRPC-16 metadata and 15 steps', () => {
    expect(grpcSchemaDiscoveryLesson.id).toBe('grpc-schema-discovery');
    expect(grpcSchemaDiscoveryLesson.category).toBe('grpc');
    expect(grpcSchemaDiscoveryLesson.grpc.rosterNumber).toBe(16);
    expect(grpcSchemaDiscoveryLesson.steps).toHaveLength(15);
    expect(grpcSchemaDiscoveryLesson.initialTab).toBe('grpc-studio');
  });

  it('passes Phase 12A lesson contract validation', () => {
    const result = validateGrpcDemoLesson(grpcSchemaDiscoveryLesson);
    expect(result.ok, result.issues.map((i) => `${i.path}: ${i.message}`).join('\n')).toBe(true);
  });

  it('step IDs match grpcd-* convention', () => {
    const ids = grpcSchemaDiscoveryLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'grpc16-intro',
      'grpc16-target',
      'grpc16-reflect',
      'grpc16-source',
      'grpc16-manage-open',
      'grpc16-tabs',
      'grpc16-proto-files',
      'grpc16-proto-load',
      'grpc16-schema-browser',
      'grpc16-copy-grpcurl',
      'grpc16-open-method',
      'grpc16-protoset',
      'grpc16-url',
      'grpc16-bsr',
      'grpc16-drift',
    ]);
  });

  it('copy-grpcurl step highlights the copy button before open-in-tab step', () => {
    const copyStep = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-copy-grpcurl')!;
    const openStep = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-open-method')!;
    expect(copyStep.highlight).toContain('grpc-schema-copy-grpcurl-btn');
    expect(openStep.highlight).toContain('grpc-schema-open-tab-btn');
  });

  it('open-method step verifies unary response is rendered', () => {
    const openMethod = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-open-method')!;
    expect(openMethod.verify).toContain('grpc-response-body');
  });

  it('protoset step verifies protoset dropzone is rendered', () => {
    const protosetStep = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-protoset')!;
    expect(protosetStep.verify).toContain('grpc-proto-protoset-zone');
  });

  it('url and bsr steps verify their concrete input fields', () => {
    const urlStep = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-url')!;
    const bsrStep = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-bsr')!;
    expect(urlStep.verify).toContain('grpc-proto-url-input');
    expect(bsrStep.verify).toContain('grpc-explorer-source');
  });

  it('schema-browser step verifies schema browser is rendered', () => {
    const browserStep = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-schema-browser')!;
    expect(browserStep.verify).toContain('grpc-schema-browser');
  });

  it('reflect step verifies explorer tree', () => {
    const reflectStep = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-reflect')!;
    expect(reflectStep.verify).toContain('grpc-explorer-tree');
  });

  it('references concrete samples for all four ingest tabs', () => {
    const tabsStep = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-tabs')!;
    const protoFilesStep = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-proto-files')!;
    const protoLoadStep = grpcSchemaDiscoveryLesson.steps.find((s) => s.id === 'grpc16-proto-load')!;
    // The root-aware ingest concept (protoRoots / collision) folds into the merged upload step.
    expect(protoFilesStep.description).toContain('protoRoots');
    expect(protoFilesStep.description).toContain('collision');
    expect(tabsStep.description).toContain('examples/grpc/schema-discovery/protoset/echo.protoset');
    expect(tabsStep.description).toContain('http://localhost:5173/grpc-samples/url/echo.proto');
    expect(tabsStep.description).toContain('buf.build/connectrpc/eliza');
    expect(protoFilesStep.description).toContain('examples/grpc/schema-discovery/proto-files/api/service.proto');
    expect(protoFilesStep.description).toContain('examples/grpc/schema-discovery/proto-files/shared/common.proto');
    // Root selection + canonical path review fold into the merged load step.
    expect(protoLoadStep.description).toContain('Click the **shared** virtual root');
    expect(protoLoadStep.description).toContain('Canonical paths');
  });

  it('stays aligned with roster title', () => {
    expect(grpcSchemaDiscoveryLesson.name).toBe(
      getGrpcLessonRosterEntry('grpc-schema-discovery')!.title,
    );
  });

  it('declares docker endpoints for the Go echo fixture', () => {
    expect(grpcSchemaDiscoveryLesson.dockerEndpoints?.some((u) => u.includes('50052'))).toBe(true);
    expect(grpcSchemaDiscoveryLesson.dockerEndpoints?.some((u) => u.includes('3001'))).toBe(true);
    expect(grpcSchemaDiscoveryLesson.gateLabel).toBe('🐳 Local setup required');
  });
});
