type RunTypeFilter = 'all' | 'test' | 'workflow';

interface Props {
  runTypeFilter: RunTypeFilter;
  runCounts: {
    all: number;
    test: number;
    workflow: number;
  };
  onChange: (value: RunTypeFilter) => void;
}

export function ResultsRunTypeTabs({ runTypeFilter, runCounts, onChange }: Props) {
  return (
    <div className="results-run-filter-tabs">
      <button
        className={`run-filter-tab ${runTypeFilter === 'all' ? 'active' : ''}`}
        onClick={() => onChange('all')}
      >
        All Runs ({runCounts.all})
      </button>
      <button
        className={`run-filter-tab ${runTypeFilter === 'test' ? 'active' : ''}`}
        onClick={() => onChange('test')}
      >
        🧪 Test Runs ({runCounts.test})
      </button>
      <button
        className={`run-filter-tab ${runTypeFilter === 'workflow' ? 'active' : ''}`}
        onClick={() => onChange('workflow')}
      >
        ⚡ Workflow Runs ({runCounts.workflow})
      </button>
    </div>
  );
}
