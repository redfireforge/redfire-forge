import type { GrpcDescriptor } from '../../shared/grpc/contracts';
import type {
  GrpcAdvancedFeatureRuntimeState,
  GrpcLoadTestConfig,
  GrpcLoadTestRunCounts,
} from '../../shared/grpc/grpcAdvancedFeatureContracts';
import type { GrpcMockConfigSource } from '../../shared/grpc/grpcMockConfigResolution';
import type { GrpcAdvancedFeatureSourceMetadata } from '../../shared/grpc/grpcAdvancedFeatureExport';
import type { GrpcMockLatencyPolicy } from '../../shared/grpc/grpcMockLatencySimulation';
import type { GrpcLoadTestRunSummaryExport } from '../../shared/grpc/grpcLoadTestMetrics';
import type {
  GrpcSchemaDiffReport,
  GrpcSchemaDiffSeverity,
} from '../../shared/grpc/grpcSchemaDiffContracts';

export const GRPC_ADVANCED_FEATURE_TABS = [
  'load_test',
  'mock_server',
  'schema_diff',
] as const;

export type GrpcAdvancedFeatureTab = (typeof GRPC_ADVANCED_FEATURE_TABS)[number];

export const GRPC_SCHEMA_DIFF_UI_LIST_CAP = 500;

export const GRPC_MOCK_WORKSPACE_DEFAULT_RULES_JSON = '{\n  "rules": []\n}';

export const DEFAULT_GRPC_LOAD_TEST_CONFIG: GrpcLoadTestConfig = {
  concurrency: 10,
  totalCalls: 100,
};

export interface GrpcTabLoadTestLiveProgress {
  counts: GrpcLoadTestRunCounts;
  progressPercent?: number;
}

export interface GrpcTabLoadTestUiState {
  config: GrpcLoadTestConfig;
  lastSummary?: GrpcLoadTestRunSummaryExport;
  lastExportSource?: GrpcAdvancedFeatureSourceMetadata;
  live?: GrpcTabLoadTestLiveProgress;
}

export interface GrpcTabMockServerUiState {
  rulesJson: string;
  mockConfigOverride?: GrpcMockConfigSource;
  latencyPolicy?: GrpcMockLatencyPolicy;
  parseError?: string;
}

export type GrpcSchemaDiffSeverityFilter = 'all' | GrpcSchemaDiffSeverity;

export interface GrpcTabSchemaDiffUiState {
  baselineDescriptor?: GrpcDescriptor;
  baselineCapturedAt?: string;
  severityFilter: GrpcSchemaDiffSeverityFilter;
  lastReport?: GrpcSchemaDiffReport;
}

export interface GrpcTabAdvancedFeaturesUiState {
  activeFeatureTab: GrpcAdvancedFeatureTab;
  runtime: GrpcAdvancedFeatureRuntimeState;
  loadTest: GrpcTabLoadTestUiState;
  mockServer: GrpcTabMockServerUiState;
  schemaDiff: GrpcTabSchemaDiffUiState;
}

export function createInitialGrpcTabAdvancedFeaturesUiState(): GrpcTabAdvancedFeaturesUiState {
  return {
    activeFeatureTab: 'load_test',
    runtime: {
      loadTest: { status: 'idle', cancellationRequested: false },
      mockRuntime: { status: 'idle', cancellationRequested: false },
      schemaDiff: { status: 'idle', cancellationRequested: false },
    },
    loadTest: {
      config: { ...DEFAULT_GRPC_LOAD_TEST_CONFIG },
    },
    mockServer: {
      rulesJson: GRPC_MOCK_WORKSPACE_DEFAULT_RULES_JSON,
    },
    schemaDiff: {
      severityFilter: 'all',
    },
  };
}
