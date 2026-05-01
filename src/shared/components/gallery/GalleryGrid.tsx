import { useState, useMemo, useCallback } from 'react';
import type { GalleryEntry } from '../../../data/galleries/types';
import type { GallerySampleStatus } from '../../../features/gallery/types';
import { galleryDomains } from '../../../data/galleries/registry';
import { trainingPaths } from '../../../data/galleries/trainingPaths';
import { GalleryCard } from './GalleryCard';
import { GalleryFilters, defaultFilterState, apiHostname, type GalleryFilterState, type GalleryMode } from './GalleryFilters';
import { GalleryDetailPanel } from './GalleryDetailPanel';
import { TrainingPathsView } from './TrainingPathsView';

type LabelProp<T> = string | ((entry: GalleryEntry<T>) => string | undefined);

interface GalleryGridProps<T = unknown> {
  /** All gallery entries to display (from one or many domains). */
  entries: GalleryEntry<T>[];
  /** Label for the detail-panel primary action button. String or per-entry function. */
  actionLabel?: LabelProp<T>;
  /** Label for the detail-panel secondary action button. String or per-entry function. */
  secondaryLabel?: LabelProp<T>;
  /** Called when the user clicks the primary action button. */
  onAction?: (entry: GalleryEntry<T>) => void;
  /** Called when the user clicks the secondary action button. */
  onSecondary?: (entry: GalleryEntry<T>) => void;
  /** Render prop for domain-specific preview in the detail panel. */
  renderPreview?: (entry: GalleryEntry<T>, onExpand: (label: string, content: string) => void) => React.ReactNode;
  /** Whether to show domain badges on cards. Default: true when entries span multiple domains. */
  showDomainBadges?: boolean;
  /** Optional search query coming from an external input. */
  externalSearch?: string;
  /** Items per page. */
  pageSize?: number;
  /** Map of gallery sample ID → import status for showing badges on cards. */
  sampleStatus?: Record<string, GallerySampleStatus>;
}

const DEFAULT_PAGE_SIZE = 12;

/**
 * Responsive gallery grid with integrated filters, pagination, and detail panel.
 *
 * Renders: search bar, filter sidebar, paginated card grid, and a detail panel.
 * Works with any `GalleryEntry<T>` — domain-specific concerns are handled
 * via `renderPreview` and action callbacks.
 */
export function GalleryGrid<T = unknown>({
  entries,
  actionLabel,
  secondaryLabel,
  onAction,
  onSecondary,
  renderPreview,
  showDomainBadges,
  externalSearch,
  pageSize = DEFAULT_PAGE_SIZE,
  sampleStatus,
}: GalleryGridProps<T>) {
  const [filters, setFilters] = useState<GalleryFilterState>(defaultFilterState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<GalleryMode>('samples');
  const [activePathId, setActivePathId] = useState<string | undefined>();

  // Derive unique categories and live-API hostnames for filter dropdowns
  const { categories, liveApiHosts, allTags } = useMemo(() => {
    const cats = new Set<string>();
    const apis = new Set<string>();
    const tgs = new Set<string>();
    for (const e of entries) {
      cats.add(e.category);
      for (const a of e.liveApis) apis.add(apiHostname(a));
      for (const t of e.tags) tgs.add(t);
    }
    return {
      categories: [...cats].sort(),
      liveApiHosts: [...apis].sort(),
      allTags: [...tgs].sort(),
    };
  }, [entries]);

  // Determine if entries span multiple domains
  const multiDomain = useMemo(() => {
    const doms = new Set(entries.map(e => e.domain));
    return doms.size > 1;
  }, [entries]);

  const doShowDomain = showDomainBadges ?? multiDomain;

  // Filter entries (reset page when filters change)
  const filtered = useMemo(() => {
    setPage(0);
    const search = (externalSearch ?? filters.search).toLowerCase();
    return entries.filter(e => {
      if (filters.domain !== 'all' && e.domain !== filters.domain) return false;
      if (filters.category && e.category !== filters.category) return false;
      if (filters.difficulty !== 'all' && e.difficulty !== filters.difficulty) return false;
      if (filters.liveApi) {
        const match = e.liveApis.some(a => apiHostname(a) === filters.liveApi);
        if (!match) return false;
      }
      if (filters.tag && !e.tags.includes(filters.tag)) return false;
      if (search) {
        const hay = `${e.name} ${e.description} ${e.tags.join(' ')} ${e.category}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [entries, filters, externalSearch]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Group paired entries (main + simulator) for rendering
  type EntryGroup = { key: string; main: GalleryEntry<T>; simulator?: GalleryEntry<T> };
  const groups = useMemo<EntryGroup[]>(() => {
    const pagedIds = new Set(paged.map(e => e.id));
    const consumed = new Set<string>();
    const out: EntryGroup[] = [];
    for (const entry of paged) {
      if (consumed.has(entry.id)) continue;
      if (entry.simulatorOf) {
        // Orphan simulator (main not on this page) → render solo
        if (!pagedIds.has(entry.simulatorOf)) {
          out.push({ key: entry.id, main: entry });
          consumed.add(entry.id);
        }
        continue;
      }
      const sim = paged.find(s => s.simulatorOf === entry.id);
      if (sim) {
        out.push({ key: entry.id, main: entry, simulator: sim });
        consumed.add(entry.id);
        consumed.add(sim.id);
      } else {
        out.push({ key: entry.id, main: entry });
        consumed.add(entry.id);
      }
    }
    return out;
  }, [paged]);

  const selected = useMemo(
    () => (selectedId ? filtered.find(e => e.id === selectedId) ?? null : null),
    [filtered, selectedId],
  );

  const handleCardClick = useCallback((entry: GalleryEntry<T>) => {
    setSelectedId(prev => (prev === entry.id ? null : entry.id));
  }, []);

  const handleModeChange = useCallback((newMode: GalleryMode) => {
    setMode(newMode);
    if (newMode === 'samples') {
      setActivePathId(undefined);
    }
  }, []);

  const handleSelectPath = useCallback((pathId: string) => {
    setActivePathId(pathId);
    setMode('paths');
  }, []);

  return (
    <div className="gallery-layout">
      <GalleryFilters
        domains={galleryDomains}
        categories={categories}
        liveApis={liveApiHosts}
        tags={allTags}
        value={filters}
        onChange={setFilters}
        mode={mode}
        onModeChange={handleModeChange}
        trainingPaths={trainingPaths}
        activePathId={activePathId}
        onSelectPath={handleSelectPath}
      />

      <div className="gallery-main">
        <div className="gallery-search-bar">
          {/* Mode Toggle */}
          <div className="gallery-mode-toggle">
            <button
              className={`gallery-mode-btn${mode === 'samples' ? ' gallery-mode-btn-active-samples' : ''}`}
              onClick={() => handleModeChange('samples')}
              type="button"
            >
              📦 Samples
            </button>
            <button
              className={`gallery-mode-btn${mode === 'paths' ? ' gallery-mode-btn-active-paths' : ''}`}
              onClick={() => { setMode('paths'); }}
              type="button"
            >
              📖 Training Paths
            </button>
          </div>
          <input
            className="gallery-search-input"
            type="search"
            placeholder={mode === 'samples' ? 'Search gallery...' : 'Search training paths...'}
            value={externalSearch ?? filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            readOnly={externalSearch !== undefined}
            aria-label="Search gallery"
          />
          <span className="gallery-result-count">
            {mode === 'samples' ? (
              <>
                {filtered.length} {filtered.length === 1 ? 'sample' : 'samples'}
                {sampleStatus && (() => {
                  const loadedCount = filtered.filter(e => sampleStatus[e.id]).length;
                  return loadedCount > 0 ? ` · ${loadedCount} loaded` : '';
                })()}
              </>
            ) : (
              <>{trainingPaths.filter(p => !p.comingSoon).length} paths available</>
            )}
          </span>
        </div>

        {mode === 'samples' ? (
          <div className="gallery-scroll-area">
            <div className="gallery-grid">
          {groups.map(group => {
            if (group.simulator) {
              return (
                <div key={group.key} className="gallery-pair-wrapper">
                  <div className="gallery-pair-header">
                    <span className="gallery-pair-icon">🔗</span>
                    <span className="gallery-pair-title">Paired Sample &amp; Simulator</span>
                  </div>
                  <div className="gallery-pair-body">
                    <GalleryCard
                      entry={group.main}
                      selected={group.main.id === selectedId}
                      showDomain={doShowDomain}
                      onClick={handleCardClick}
                      sampleStatus={sampleStatus?.[group.main.id]}
                    />
                    <span className="gallery-pair-arrow" aria-hidden>→</span>
                    <GalleryCard
                      entry={group.simulator}
                      selected={group.simulator.id === selectedId}
                      showDomain={doShowDomain}
                      onClick={handleCardClick}
                      sampleStatus={sampleStatus?.[group.simulator.id]}
                    />
                  </div>
                  <div className="gallery-pair-hint">
                    Run main first → it pauses → run simulator → main resumes
                  </div>
                </div>
              );
            }
            return (
              <GalleryCard
                key={group.key}
                entry={group.main}
                selected={group.main.id === selectedId}
                showDomain={doShowDomain}
                onClick={handleCardClick}
                sampleStatus={sampleStatus?.[group.main.id]}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="gallery-empty">
              No samples match the current filters.
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="gallery-pagination">
            <button
              className="gallery-page-btn"
              disabled={safePage === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              type="button"
              aria-label="Previous page"
            >
              ← Prev
            </button>
            <span className="gallery-page-info">
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              className="gallery-page-btn"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              type="button"
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        )}
          </div>
        ) : (
          <div className="gallery-scroll-area">
          <TrainingPathsView
            paths={trainingPaths}
            activePathId={activePathId}
            onImportSample={onAction ? (sampleId) => {
              const entry = entries.find(e => e.id === sampleId);
              if (entry) onAction(entry);
            } : undefined}
            sampleStatus={sampleStatus}
          />
          </div>
        )}
      </div>

      {selected && mode === 'samples' && (
        <GalleryDetailPanel
          entry={selected}
          actionLabel={typeof actionLabel === 'function' ? actionLabel(selected) : actionLabel}
          secondaryLabel={typeof secondaryLabel === 'function' ? secondaryLabel(selected) : secondaryLabel}
          onAction={onAction}
          onSecondary={onSecondary}
          onClose={() => setSelectedId(null)}
          renderPreview={renderPreview}
          sampleStatus={sampleStatus?.[selected.id]}
        />
      )}
    </div>
  );
}
