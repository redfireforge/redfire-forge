interface TabIds {
  tab: string;
  panel: string;
}

interface Props {
  resultsViewTab: 'overview' | 'requests' | 'sla' | 'analysis';
  visibleBaselineCount: number;
  onChange: (tab: 'overview' | 'requests' | 'sla' | 'analysis') => void;
  tabIds: Record<'overview' | 'requests' | 'sla' | 'analysis', TabIds>;
}

export function ResultsViewTabs({ resultsViewTab, visibleBaselineCount, onChange, tabIds }: Props) {
  return (
    <div className="results-view-tabs" role="tablist" aria-label="Results view tabs">
      <button
        id={tabIds.overview.tab}
        role="tab"
        aria-selected={resultsViewTab === 'overview'}
        aria-controls={tabIds.overview.panel}
        className={`results-view-tab ${resultsViewTab === 'overview' ? 'active' : ''}`}
        onClick={() => onChange('overview')}
      >
        Overview
      </button>
      <button
        id={tabIds.requests.tab}
        role="tab"
        aria-selected={resultsViewTab === 'requests'}
        aria-controls={tabIds.requests.panel}
        className={`results-view-tab ${resultsViewTab === 'requests' ? 'active' : ''}`}
        onClick={() => onChange('requests')}
        data-testid="results-tab-requests"
      >
        Request Details
      </button>
      <button
        id={tabIds.sla.tab}
        role="tab"
        aria-selected={resultsViewTab === 'sla'}
        aria-controls={tabIds.sla.panel}
        className={`results-view-tab ${resultsViewTab === 'sla' ? 'active' : ''}`}
        onClick={() => onChange('sla')}
      >
        SLA
      </button>
      <button
        id={tabIds.analysis.tab}
        role="tab"
        aria-selected={resultsViewTab === 'analysis'}
        aria-controls={tabIds.analysis.panel}
        className={`results-view-tab results-view-tab-analysis ${resultsViewTab === 'analysis' ? 'active' : ''}`}
        onClick={() => onChange('analysis')}
      >
        Comparison & Trends{visibleBaselineCount > 0 ? ` (${visibleBaselineCount})` : ''}
      </button>
    </div>
  );
}
