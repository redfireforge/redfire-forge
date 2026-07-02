import { describe, expect, it } from 'vitest';
import {
  createInitialGrpcTabAdvancedFeaturesUiState,
  DEFAULT_GRPC_LOAD_TEST_CONFIG,
  GRPC_ADVANCED_FEATURE_TABS,
  GRPC_MOCK_WORKSPACE_DEFAULT_RULES_JSON,
  GRPC_SCHEMA_DIFF_UI_LIST_CAP,
} from './grpcStudioAdvancedTypes';

describe('grpcStudioAdvancedTypes coverage gaps', () => {
  it('exports advanced feature tab constants and defaults', () => {
    expect(GRPC_ADVANCED_FEATURE_TABS).toEqual(['load_test', 'mock_server', 'schema_diff', 'rpc_statistics']);
    expect(GRPC_SCHEMA_DIFF_UI_LIST_CAP).toBeGreaterThan(0);
    expect(GRPC_MOCK_WORKSPACE_DEFAULT_RULES_JSON).toContain('"rules"');
    expect(DEFAULT_GRPC_LOAD_TEST_CONFIG.concurrency).toBeGreaterThan(0);
  });

  it('createInitialGrpcTabAdvancedFeaturesUiState returns idle runtime and defaults', () => {
    const state = createInitialGrpcTabAdvancedFeaturesUiState();
    expect(state.activeFeatureTab).toBe('load_test');
    expect(state.runtime.loadTest.status).toBe('idle');
    expect(state.runtime.mockRuntime.status).toBe('idle');
    expect(state.runtime.schemaDiff.status).toBe('idle');
    expect(state.loadTest.config).toEqual(DEFAULT_GRPC_LOAD_TEST_CONFIG);
    expect(state.mockServer.rulesJson).toBe(GRPC_MOCK_WORKSPACE_DEFAULT_RULES_JSON);
    expect(state.schemaDiff.severityFilter).toBe('all');
    expect(state.schemaDiff.hideAcknowledged).toBe(false);
  });
});
