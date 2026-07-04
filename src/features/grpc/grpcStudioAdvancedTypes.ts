import type { GrpcDescriptor } from '../../shared/grpc/contracts';
import type {
  GrpcAdvancedFeatureRuntimeState,
  GrpcLoadTestConfig,
  GrpcLoadTestRunCounts,
} from '../../shared/grpc/grpcAdvancedFeatureContracts';
import type { GrpcMockConfigSource } from '../../shared/grpc/grpcMockConfigResolution';
import type { GrpcAdvancedFeatureSourceMetadata } from '../../shared/grpc/grpcAdvancedFeatureExport';
import type { GrpcMockLatencyPolicy } from '../../shared/grpc/grpcMockLatencySimulation';
import type { GrpcMockListenerStatus } from '../../shared/grpc/grpcMockListenerContracts';
import type { GrpcLoadTestRunSummaryExport } from '../../shared/grpc/grpcLoadTestMetrics';
import type {
  GrpcSchemaDiffReport,
  GrpcSchemaDiffSeverity,
} from '../../shared/grpc/grpcSchemaDiffContracts';

export const GRPC_ADVANCED_FEATURE_TABS = [
  'load_test',
  'mock_server',
  'schema_diff',
  'rpc_statistics',
  'native_diagnostics',
] as const;

export type GrpcAdvancedFeatureTab = (typeof GRPC_ADVANCED_FEATURE_TABS)[number];

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
  /** When true (default), Start also binds a dialable 127.0.0.1:port listener (web companion server). */
  exposeNetworkEndpoint?: boolean;
  listenerStatus?: GrpcMockListenerStatus;
}

export type GrpcSchemaDiffSeverityFilter = 'all' | GrpcSchemaDiffSeverity;

export interface GrpcTabSchemaDiffUiState {
  baselineDescriptor?: GrpcDescriptor;
  baselineCapturedAt?: string;
  severityFilter: GrpcSchemaDiffSeverityFilter;
  hideAcknowledged: boolean;
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
      exposeNetworkEndpoint: true,
    },
    schemaDiff: {
      severityFilter: 'all',
      hideAcknowledged: false,
    },
  };
}
