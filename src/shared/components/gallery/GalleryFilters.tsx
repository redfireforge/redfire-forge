import type { GalleryDifficulty, GalleryDomain } from '../../../data/galleries/types';
import type { GalleryDomainConfig } from '../../../data/galleries/registry';

export interface GalleryFilterState {
  domain: GalleryDomain | 'all';
  category: string;
  difficulty: GalleryDifficulty | 'all';
  liveApi: string;
  search: string;
}

interface GalleryFiltersProps {
  domains: GalleryDomainConfig[];
  /** All unique categories across the currently visible entries. */
  categories: string[];
  /** All unique live-API hostnames across the currently visible entries. */
  liveApis: string[];
  value: GalleryFilterState;
  onChange: (next: GalleryFilterState) => void;
}

const DIFFICULTY_OPTIONS: Array<{ value: GalleryDifficulty | 'all'; label: string }> = [
  { value: 'all', label: 'All Levels' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'advanced', label: 'Advanced' },
];

/**
 * Gallery sidebar filters: domain tabs, category, difficulty, live-API, search.
 */
export function GalleryFilters({
  domains,
  categories,
  liveApis,
  value,
  onChange,
}: GalleryFiltersProps) {
  const set = <K extends keyof GalleryFilterState>(key: K, v: GalleryFilterState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <aside className="gallery-filters">
      {/* Domain selector */}
      <div className="gallery-filter-section">
        <div className="gallery-filter-heading">Domains</div>
        <button
          className={`gallery-domain-btn${value.domain === 'all' ? ' active' : ''}`}
          onClick={() => set('domain', 'all')}
          type="button"
        >
          📦 All
        </button>
        {domains.map(d => (
          <button
            key={d.key}
            className={`gallery-domain-btn${value.domain === d.key ? ' active' : ''}`}
            onClick={() => set('domain', d.key)}
            type="button"
          >
            {d.icon} {d.label}
          </button>
        ))}
      </div>

      {/* Category */}
      <div className="gallery-filter-section">
        <div className="gallery-filter-heading">Category</div>
        <select
          className="gallery-filter-select"
          value={value.category}
          onChange={e => set('category', e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Difficulty */}
      <div className="gallery-filter-section">
        <div className="gallery-filter-heading">Difficulty</div>
        <select
          className="gallery-filter-select"
          value={value.difficulty}
          onChange={e => set('difficulty', e.target.value as GalleryDifficulty | 'all')}
          aria-label="Filter by difficulty"
        >
          {DIFFICULTY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Live API */}
      {liveApis.length > 0 && (
        <div className="gallery-filter-section">
          <div className="gallery-filter-heading">Live API</div>
          <select
            className="gallery-filter-select"
            value={value.liveApi}
            onChange={e => set('liveApi', e.target.value)}
            aria-label="Filter by live API"
          >
            <option value="">All APIs</option>
            {liveApis.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      )}
    </aside>
  );
}

/** Default (empty) filter state. */
export function defaultFilterState(): GalleryFilterState {
  return { domain: 'all', category: '', difficulty: 'all', liveApi: '', search: '' };
}

/** Extract hostname from a URL string, with fallback. */
export function apiHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}
