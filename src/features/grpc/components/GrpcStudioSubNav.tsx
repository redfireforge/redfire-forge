export interface GrpcStudioSubNavProps {
  activeView: 'studio' | 'collections' | 'history' | 'advanced';
  historyCount: number;
  onSelect: (view: 'studio' | 'collections' | 'history' | 'advanced') => void;
}

export function GrpcStudioSubNav({ activeView, historyCount, onSelect }: GrpcStudioSubNavProps) {
  return (
    <div className="grpc-studio-sub-nav" data-testid="grpc-studio-sub-nav" role="tablist" aria-label="gRPC Studio views">
      <button
        type="button"
        role="tab"
        className={`grpc-studio-sub-nav__tab${activeView === 'studio' ? ' grpc-studio-sub-nav__tab--active' : ''}`}
        data-testid="grpc-sub-nav-studio"
        aria-selected={activeView === 'studio'}
        onClick={() => onSelect('studio')}
      >
        Studio
      </button>
      <button
        type="button"
        role="tab"
        className={`grpc-studio-sub-nav__tab${activeView === 'collections' ? ' grpc-studio-sub-nav__tab--active' : ''}`}
        data-testid="grpc-sub-nav-collections"
        aria-selected={activeView === 'collections'}
        onClick={() => onSelect('collections')}
      >
        Collections
      </button>
      <button
        type="button"
        role="tab"
        className={`grpc-studio-sub-nav__tab${activeView === 'history' ? ' grpc-studio-sub-nav__tab--active' : ''}`}
        data-testid="grpc-sub-nav-history"
        aria-selected={activeView === 'history'}
        onClick={() => onSelect('history')}
      >
        Call History
        {historyCount > 0 && (
          <span className="grpc-studio-sub-nav__badge" data-testid="grpc-sub-nav-history-badge">
            {historyCount}
          </span>
        )}
      </button>
      <button
        type="button"
        role="tab"
        className={`grpc-studio-sub-nav__tab${activeView === 'advanced' ? ' grpc-studio-sub-nav__tab--active' : ''}`}
        data-testid="grpc-sub-nav-advanced"
        aria-selected={activeView === 'advanced'}
        onClick={() => onSelect('advanced')}
      >
        Advanced
      </button>
    </div>
  );
}
