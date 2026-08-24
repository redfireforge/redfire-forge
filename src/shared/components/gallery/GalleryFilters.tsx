import { useState } from 'react';
import { CustomSelect } from '../CustomSelect';
import type { GalleryDifficulty, GalleryDomain } from '../../../data/galleries/types';
import type { GalleryDomainConfig } from '../../../data/galleries/registry';
import type { TrainingPath } from '../../../data/galleries/trainingPaths';
import type { GalleryFilterState, GalleryMode } from './galleryFiltersUtils';

interface GalleryFiltersProps {
  domains: GalleryDomainConfig[];
  categories: string[];
  liveApis: string[];
  tags: string[];
  value: GalleryFilterState;
  onChange: (next: GalleryFilterState) => void;
  mode: GalleryMode;
  onModeChange: (mode: GalleryMode) => void;
  trainingPaths: TrainingPath[];
  activePathId?: string;
  onSelectPath?: (pathId: string) => void;
  width?: number;
}

const DIFFICULTY_OPTIONS: Array<{ value: GalleryDifficulty | 'all'; label: string }> = [
  { value: 'all', label: 'All Levels' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'advanced', label: 'Advanced' },
];

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
  width,
}: GalleryFiltersProps) {
  const set = <K extends keyof GalleryFilterState>(key: K, v: GalleryFilterState[K]) =>
    onChange({ ...value, [key]: v });

  const handleDomainClick = (domainKey: GalleryDomain | 'all') => {
    onChange({ ...value, domain: domainKey, category: '', liveApi: '', tag: '' });
    onModeChange('samples');
  };

  const handlePathClick = (pathId: string) => {
    onSelectPath?.(pathId);
    onModeChange('paths');
  };

  const filtersDisabled = mode === 'paths';

  return (
    <aside className="gallery-filters" style={width ? { width } : undefined}>
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
            data-testid={`gallery-domain-${d.key}`}
            onClick={() => handleDomainClick(d.key)}
            type="button"
          >
            {d.icon} {d.label}
          </button>
        ))}
      </div>

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

      <div className={`gallery-filter-controls${filtersDisabled ? ' gallery-filter-controls-dimmed' : ''}`}>
        <div className="gallery-filter-divider" />

      <div className="gallery-filter-section">
        <div className="gallery-filter-heading">Category</div>
        <CustomSelect
          className="gallery-filter-select"
          value={value.category}
          onChange={(v) => set('category', v)}
          options={[
            { value: '', label: 'All Categories' },
            ...categories.map(c => ({ value: c, label: c })),
          ]}
          aria-label="Filter by category"
        />
      </div>

      <div className="gallery-filter-section">
        <div className="gallery-filter-heading">Difficulty</div>
        <CustomSelect
          className="gallery-filter-select"
          value={value.difficulty}
          onChange={(v) => set('difficulty', v as GalleryDifficulty | 'all')}
          options={DIFFICULTY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          aria-label="Filter by difficulty"
        />
      </div>

      {liveApis.length > 0 && (
        <div className="gallery-filter-section">
          <div className="gallery-filter-heading">Live API</div>
          <CustomSelect
            className="gallery-filter-select"
            value={value.liveApi}
            onChange={(v) => set('liveApi', v)}
            options={[
              { value: '', label: 'All APIs' },
              ...liveApis.map(a => ({ value: a, label: a })),
            ]}
            aria-label="Filter by live API"
          />
        </div>
      )}

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

      </div>

    </aside>
  );
}

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
