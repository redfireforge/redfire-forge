import { describe, expect, it } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  FIXTURE_DESCRIPTOR,
  buildAdvancedMock,
  makeLoadTestSummary,
} from './grpcAdvancedPanel.testHelpers';

describe('grpcAdvancedPanel.testHelpers coverage gaps', () => {
  it('makeLoadTestSummary builds a stable summary export shape', () => {
    const summary = makeLoadTestSummary();

    expect(summary.kind).toBe('grpc_load_test_summary');
    expect(summary).toHaveProperty('metrics');
    expect(summary).toHaveProperty('config');
    expect(summary.metrics).toHaveProperty('statusDistribution');
  });

  it('buildAdvancedMock returns defaults and supports patch overrides', () => {
    const defaults = buildAdvancedMock();
    expect(defaults.activeFeatureTab).toBe('load_test');
    expect(defaults.activeTabId).toBe('tab-ui');
    expect(defaults.exportLoadTestCsv()).toContain('metric');
    expect(defaults.exportLoadTestJson()).toContain('grpc_load_test_summary');
    expect(defaults.exportSchemaDiffJson()).toContain('changes');
    expect(defaults.exportSchemaDiffMarkdown()).toContain('# diff');
    expect(defaults.exportMockRulesJson()).toContain('rules');

    defaults.setSelectedLoadTestProfileId('profile-1');
    defaults.loadLoadTestProfile('profile-1');
    defaults.patchLoadTestConfig({ concurrency: 3 });
    defaults.patchMockRulesJson('{"rules":[]}');
    defaults.patchMockLatency(50);
    defaults.patchMockExposeNetwork(true);
    defaults.setSchemaDiffSeverityFilter('breaking');
    defaults.setSchemaDiffHideAcknowledged(true);
    defaults.selectLoadTestRunSummary('run-1');
    defaults.startLoadTest();
    defaults.cancelLoadTest();
    defaults.resetLoadTestStatus();
    defaults.startMockServer();
    defaults.stopMockServer();
    defaults.resetMockStatus();
    defaults.captureSchemaBaseline();
    defaults.runSchemaDiff();
    defaults.clearSchemaBaseline();
    defaults.clearAdvancedExportError();
    defaults.resetMockRulesToDefault();
    defaults.resetRpcSessionStats();
    void defaults.saveLoadTestProfile('Smoke');
    void defaults.renameLoadTestProfile('profile-1', 'Smoke 2');
    void defaults.removeLoadTestProfile('profile-1');

    const patched = buildAdvancedMock({
      activeFeatureTab: 'schema_diff',
      activeTabId: 'tab-override',
      advancedExportError: 'boom',
    } as any);

    expect(patched.activeFeatureTab).toBe('schema_diff');
    expect(patched.activeTabId).toBe('tab-override');
    expect(patched.advancedExportError).toBe('boom');
  });

  it('re-exports FIXTURE_DESCRIPTOR for panel tests', () => {
    expect(FIXTURE_DESCRIPTOR.key).toBeTruthy();
    expect(FIXTURE_DESCRIPTOR.services.length).toBeGreaterThan(0);
  });
});
