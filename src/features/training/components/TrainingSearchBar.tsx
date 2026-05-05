import type { DifficultyFilter, StatusFilter } from '../hooks/useManualSearch';

interface Props {
  searchTerm: string;
  difficulty: DifficultyFilter;
  status: StatusFilter;
  matchCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (term: string) => void;
  onDifficultyChange: (difficulty: DifficultyFilter) => void;
  onStatusChange: (status: StatusFilter) => void;
  onClearFilters: () => void;
}

const DIFFICULTY_OPTIONS: { value: DifficultyFilter; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'advanced', label: 'Advanced' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export function TrainingSearchBar({
  searchTerm,
  difficulty,
  status,
  matchCount,
  totalCount,
  hasActiveFilters,
  onSearchChange,
  onDifficultyChange,
  onStatusChange,
  onClearFilters,
}: Props) {
  return (
    <div className="training-search-bar">
      <div className="training-search-row">
        <div className="training-search-input-wrapper">
          <span className="training-search-icon">🔍</span>
          <input
            type="text"
            className="training-search-input"
            placeholder="Search manuals..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search training manuals"
          />
          {searchTerm && (
            <button
              className="training-search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="training-filter-row">
        <div className="training-filter-group">
          <span className="training-filter-label">Difficulty:</span>
          <div className="training-filter-buttons">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`training-filter-btn ${difficulty === opt.value ? 'active' : ''}`}
                onClick={() => onDifficultyChange(opt.value)}
                aria-pressed={difficulty === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="training-filter-group">
          <span className="training-filter-label">Status:</span>
          <div className="training-filter-buttons">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`training-filter-btn ${status === opt.value ? 'active' : ''}`}
                onClick={() => onStatusChange(opt.value)}
                aria-pressed={status === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <button
            className="training-clear-filters-btn"
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="training-search-results">
          Showing {matchCount} of {totalCount} manuals
        </div>
      )}
    </div>
  );
}
