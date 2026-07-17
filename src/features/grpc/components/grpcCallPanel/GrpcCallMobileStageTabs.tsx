import type { GrpcMobileStage } from './grpcCallPanelTypes';

interface GrpcCallMobileStageTabsProps {
  mobileStage: GrpcMobileStage;
  onSwitchStage: (stage: GrpcMobileStage) => void;
}

export function GrpcCallMobileStageTabs({ mobileStage, onSwitchStage }: GrpcCallMobileStageTabsProps) {
  return (
    <div className="grpc-mobile-stage-tabs" data-testid="grpc-mobile-stage-tabs" role="tablist" aria-label="Mobile grpc panel stages">
      <button
        type="button"
        role="tab"
        aria-selected={mobileStage === 'request'}
        className={`grpc-mobile-stage-tab${mobileStage === 'request' ? ' grpc-mobile-stage-tab--active' : ''}`}
        data-testid="grpc-mobile-stage-request"
        onClick={() => onSwitchStage('request')}
      >
        Request
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mobileStage === 'response'}
        className={`grpc-mobile-stage-tab${mobileStage === 'response' ? ' grpc-mobile-stage-tab--active' : ''}`}
        data-testid="grpc-mobile-stage-response"
        onClick={() => onSwitchStage('response')}
      >
        Response
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mobileStage === 'metadata'}
        className={`grpc-mobile-stage-tab${mobileStage === 'metadata' ? ' grpc-mobile-stage-tab--active' : ''}`}
        data-testid="grpc-mobile-stage-metadata"
        onClick={() => onSwitchStage('metadata')}
      >
        Metadata
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mobileStage === 'auth'}
        className={`grpc-mobile-stage-tab${mobileStage === 'auth' ? ' grpc-mobile-stage-tab--active' : ''}`}
        data-testid="grpc-mobile-stage-auth"
        onClick={() => onSwitchStage('auth')}
      >
        Auth
      </button>
    </div>
  );
}
