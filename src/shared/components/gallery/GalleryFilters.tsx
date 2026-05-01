import { useState } from 'react';
import type { GalleryDifficulty, GalleryDomain } from '../../../data/galleries/types';
import type { GalleryDomainConfig } from '../../../data/galleries/registry';
import type { TrainingPath } from '../../../data/galleries/trainingPaths';

export type GalleryMode = 'samples' | 'paths';

export interface GalleryFilterState {
  domain: GalleryDomain | 'all';
  category: string;
  difficulty: GalleryDifficulty | 'all';
  liveApi: string;
  tag: string;
  search: string;
}

interface GalleryFiltersProps {
  domains: GalleryDomainConfig[];
  /** All unique categories across the currently visible entries. */
  categories: string[];
  /** All unique live-API hostnames across the currently visible entries. */
  liveApis: string[];
  /** All unique tags across the currently visible entries. */
  tags: string[];
  value: GalleryFilterState;
  onChange: (next: GalleryFilterState) => void;
  /** Current gallery mode. */
  mode: GalleryMode;
  /** Called when the user switches modes. */
  onModeChange: (mode: GalleryMode) => void;
  /** Training paths to render in the sidebar. */
  trainingPaths: TrainingPath[];
  /** Currently selected training path ID (if any). */
  activePathId?: string;
  /** Called when a training path is clicked in the sidebar. */
  onSelectPath?: (pathId: string) => void;
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
  tags,
  value,
  onChange,
  mode,
  onModeChange,
  trainingPaths,
  activePathId,
  onSelectPath,
}: GalleryFiltersProps) {
  const set = <K extends keyof GalleryFilterState>(key: K, v: GalleryFilterState[K]) =>
    onChange({ ...value, [key]: v });

  const handleDomainClick = (domainKey: GalleryDomain | 'all') => {
    onChange({ ...value, domain: domainKey, tag: '' });
    onModeChange('samples');
  };

  const handlePathClick = (pathId: string) => {
    onSelectPath?.(pathId);
    onModeChange('paths');
  };

  const filtersDisabled = mode === 'paths';

  return (
    <aside className="gallery-filters">
      {/* Domain selector */}
      <div className="gallery-filter-section">
        <div className="gallery-filter-heading">Domains</div>
        <button
          className={`gallery-domain-btn${value.domain === 'all' && mode === 'samples' ? ' active' : ''}`}
          onClick={() => handleDomainClick('all')}
          type="button"
        >
          📦 All
        </button>
        {domains.map(d => (
          <button
            key={d.key}
            className={`gallery-domain-btn${value.domain === d.key && mode === 'samples' ? ' active' : ''}`}
            onClick={() => handleDomainClick(d.key)}
            type="button"
          >
            {d.icon} {d.label}
          </button>
        ))}
      </div>

      {/* Training Paths */}
      <div className="gallery-filter-section">
        <div className="gallery-filter-divider" />
        <div className="gallery-filter-heading">Training Paths</div>
        {trainingPaths.map(tp => {
          const totalManuals = tp.phases.reduce((s, p) => s + p.manuals.length, 0);
          return (
            <button
              key={tp.id}
              className={`gallery-training-btn${activePathId === tp.id ? ' active' : ''}`}
              onClick={() => handlePathClick(tp.id)}
              type="button"
            >
              <span className="gallery-training-icon">{tp.icon}</span>
              <span className="gallery-training-label">{tp.name}</span>
              <span className="gallery-training-progress">
                {tp.comingSoon ? 'soon' : totalManuals}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters (dimmed in paths mode) */}
      <div className={`gallery-filter-controls${filtersDisabled ? ' gallery-filter-controls-dimmed' : ''}`}>
        <div className="gallery-filter-divider" />

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

      {/* Tag (searchable) */}
      {tags.length > 0 && (
        <div className="gallery-filter-section">
          <div className="gallery-filter-heading">Tag</div>
          <TagCombobox
            tags={tags}
            value={value.tag}
            onChange={v => set('tag', v)}
          />
        </div>
      )}

      </div>{/* end gallery-filter-controls */}

    </aside>
  );
}

/** Searchable tag list — always visible, scrollable, with search input to filter. */
function TagCombobox({ tags, value, onChange }: { tags: string[]; value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState('');

  const filtered = query
    ? tags.filter(t => t.toLowerCase().includes(query.toLowerCase()))
    : tags;

  const select = (tag: string) => {
    onChange(tag === value ? '' : tag);
  };

  return (
    <div className="gallery-tag-combobox">
      {value && (
        <div className="gallery-tag-combobox-selected">
          <span className="gallery-tag-combobox-pill">#{value}</span>
          <button
            className="gallery-tag-combobox-clear"
            onClick={() => { onChange(''); setQuery(''); }}
            type="button"
            aria-label="Clear tag filter"
          >×</button>
        </div>
      )}
      <input
        className="gallery-tag-combobox-input"
        type="text"
        placeholder="Search tags…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="Search tags"
      />
      <ul className="gallery-tag-combobox-list">
        {filtered.map(t => (
          <li key={t}>
            <button
              className={`gallery-tag-combobox-option${t === value ? ' active' : ''}`}
              onClick={() => select(t)}
              type="button"
            >
              #{t}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="gallery-tag-combobox-more">No matching tags</li>
        )}
      </ul>
    </div>
  );
}

/** Default (empty) filter state. */
export function defaultFilterState(): GalleryFilterState {
  return { domain: 'all', category: '', difficulty: 'all', liveApi: '', tag: '', search: '' };
}

/** Extract hostname from a URL string, with fallback. */
export function apiHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}
