import { ProtocolEndpointPreview } from '@shared/components/ProtocolEndpointPreview';
import { computeGrpcStudioTargetPreview } from '@shared/grpc/grpcStudioTargetPreview';
import { GrpcStudioSubNav } from '../components/GrpcStudioSubNav';
import type { GrpcStudioPanelView } from '../hooks/useGrpcStudioReplayActions';
import type { GrpcStudioDensityMode } from './grpcStudioPageTypes';

export interface GrpcStudioPageHeaderProps {
  panelView: GrpcStudioPanelView;
  historyCount: number;
  onSelectPanelView: (view: GrpcStudioPanelView) => void;
  endpointPreviewDraft: string;
  tabInterpolationEnv: Record<string, string>;
  endpointProtocolStatus: ReturnType<typeof import('../../environments/utils/protocolEndpointUtils').getRowStatus> | undefined;
  densityMode: GrpcStudioDensityMode;
  onDensityModeChange: (mode: GrpcStudioDensityMode) => void;
}

export function GrpcStudioPageHeader({
  panelView,
  historyCount,
  onSelectPanelView,
  endpointPreviewDraft,
  tabInterpolationEnv,
  endpointProtocolStatus,
  densityMode,
  onDensityModeChange,
}: GrpcStudioPageHeaderProps) {
  return (
    <header className="grpc-studio-header grpc-studio-header--with-subnav">
      <div className="grpc-studio-header__left" data-testid="grpc-studio-header-left">
        <GrpcStudioSubNav
          activeView={panelView}
          historyCount={historyCount}
          onSelect={onSelectPanelView}
        />
      </div>
      <div className="grpc-studio-header__right" data-testid="grpc-studio-header-right">
        <ProtocolEndpointPreview
          draftUrl={endpointPreviewDraft}
          envVarMap={tabInterpolationEnv}
          protocolRowStatus={endpointProtocolStatus}
          computePreview={computeGrpcStudioTargetPreview}
          testId="grpc-endpoint-preview"
        />
        <div
          className="grpc-density-toggle"
          role="group"
          aria-label="Response layout density"
          data-testid="grpc-density-toggle"
        >
          <button
            type="button"
            className={`grpc-density-toggle__btn${densityMode === 'compact' ? ' grpc-density-toggle__btn--active' : ''}`}
            onClick={() => onDensityModeChange('compact')}
            data-testid="grpc-density-compact-btn"
            aria-pressed={densityMode === 'compact'}
          >
            Compact
          </button>
          <button
            type="button"
            className={`grpc-density-toggle__btn${densityMode === 'comfortable' ? ' grpc-density-toggle__btn--active' : ''}`}
            onClick={() => onDensityModeChange('comfortable')}
            data-testid="grpc-density-comfortable-btn"
            aria-pressed={densityMode === 'comfortable'}
          >
            Comfortable
          </button>
        </div>
      </div>
    </header>
  );
}
