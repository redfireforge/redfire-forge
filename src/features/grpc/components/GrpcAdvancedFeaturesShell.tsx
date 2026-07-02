import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import { GrpcLoadTestPanel } from './GrpcLoadTestPanel';
import { GrpcMockServerPanel } from './GrpcMockServerPanel';
import { GrpcRpcStatisticsPanel } from './GrpcRpcStatisticsPanel';
import { GrpcSchemaDiffPanel } from './GrpcSchemaDiffPanel';
import type { GrpcAdvancedFeatureTab } from '../grpcStudioAdvancedTypes';

export interface GrpcAdvancedFeaturesShellProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

const ADVANCED_TABS: Array<{ id: GrpcAdvancedFeatureTab; label: string }> = [
  { id: 'load_test', label: 'Load testing' },
  { id: 'mock_server', label: 'Mock server' },
  { id: 'schema_diff', label: 'Schema diff' },
  { id: 'rpc_statistics', label: 'RPC statistics' },
];

export function GrpcAdvancedFeaturesShell({ advanced }: GrpcAdvancedFeaturesShellProps) {
  return (
    <div className="grpc-advanced-shell" data-testid="grpc-advanced-shell">
      <div className="grpc-advanced-nav" data-testid="grpc-advanced-nav" role="tablist" aria-label="Advanced features">
        {ADVANCED_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`grpc-advanced-nav__tab${advanced.activeFeatureTab === tab.id ? ' grpc-advanced-nav__tab--active' : ''}`}
            data-testid={`grpc-advanced-tab-${tab.id}`}
            aria-selected={advanced.activeFeatureTab === tab.id}
            onClick={() => advanced.setActiveFeatureTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grpc-advanced-content">
        {advanced.activeFeatureTab === 'load_test' && (
          <GrpcLoadTestPanel advanced={advanced} />
        )}
        {advanced.activeFeatureTab === 'mock_server' && (
          <GrpcMockServerPanel advanced={advanced} />
        )}
        {advanced.activeFeatureTab === 'schema_diff' && (
          <GrpcSchemaDiffPanel advanced={advanced} />
        )}
        {advanced.activeFeatureTab === 'rpc_statistics' && (
          <GrpcRpcStatisticsPanel advanced={advanced} />
        )}
      </div>
    </div>
  );
}
