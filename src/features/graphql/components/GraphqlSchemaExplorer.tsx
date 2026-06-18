/**
 * GraphqlSchemaExplorer.tsx  —  Phase 1B
 *
 * Schema Explorer UI rendered in the right pane (Schema tab).
 *
 * Layout (schema-loaded state):
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │  Left column                │  Right column (detail)               │
 *   │  ─────────────────────────  │  ─────────────────────────────────── │
 *   │  Types (42)  [⟳] [↓ SDL]   │  ┌──────────────────────────────┐   │
 *   │  🔍 Filter types…           │  │ Order             Object Type │   │
 *   │  [All][Obj][If][Un][I][E][S]│  │ Represents a customer order… │   │
 *   │  ──────────────────────     │  │ Implements: Node, Timestamped │   │
 *   │  T Order         12 fields  │  ├──────────────────┬───────────┤   │
 *   │  T OrderItem      8 fields  │  │ Fields (12) │ SDL│           │   │
 *   │  I OrderInput     5 fields  │  ├──────────────────┴───────────┤   │
 *   │  E OrderStatus    5 values  │  │ Field │ Type │ Args │ Desc   │   │
 *   │  …                          │  │ id    │ ID!  │ —    │ UUID   │   │
 *   │                             │  └──────────────────────────────┘   │
 *   ├─────────────────────────────┴──────────────────────────────────────┤
 *   │  Schema: 42 types • 156 fields • 8 inputs • 5 enums                │
 *   └────────────────────────────────────────────────────────────────────┘
 */

import { useEffect, useMemo, useState } from 'react';
import type { GraphqlSchemaInfo, GraphqlTypeNode } from '../../../shared/types/graphql';
import { KIND_ABBR, KIND_CSS, KIND_LABEL, fieldCountText } from '../utils/schemaExplorerUtils';
import { TypeDetail, type DetailTab } from './explorer/TypeDetail';
import { SchemaIdleState, SchemaLoadingState, SchemaIntrospectionDisabledState, SchemaErrorState } from './explorer/SchemaEmptyStates';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphqlSchemaExplorerProps {
  schemaInfo: GraphqlSchemaInfo | null;
  status: 'idle' | 'loading' | 'loaded' | 'error' | 'introspection-disabled';
  errorMessage?: string | null;
  onIntrospect?: () => void;
  introspecting?: boolean;
  /** Optional: insert a field into the active query editor (powers "Try →" buttons) */
  onInsertField?: (fieldName: string, fieldType: string, hasArgs: boolean) => void;
}

type TypeKind = GraphqlTypeNode['kind'];
type KindFilter = TypeKind | 'ALL';

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_ORDER: TypeKind[] = ['OBJECT', 'INTERFACE', 'UNION', 'INPUT_OBJECT', 'ENUM', 'SCALAR'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeMatchesSearch(type: GraphqlTypeNode, q: string): boolean {
  const lower = q.toLowerCase();
  if (type.name.toLowerCase().includes(lower)) return true;
  if (type.description?.toLowerCase().includes(lower)) return true;
  if (type.fields?.some((f) => f.name.toLowerCase().includes(lower))) return true;
  if (type.enumValues?.some((v) => v.toLowerCase().includes(lower))) return true;
  return false;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphqlSchemaExplorer({
  schemaInfo,
  status,
  errorMessage,
  onIntrospect,
  introspecting = false,
  onInsertField,
}: GraphqlSchemaExplorerProps) {
  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeName, setSelectedTypeName] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('fields');

  // ── Filtered type list ─────────────────────────────────────────────────────
  const filteredTypes = useMemo<GraphqlTypeNode[]>(() => {
    if (!schemaInfo) return [];
    const q = searchQuery.trim().toLowerCase();
    return schemaInfo.types.filter((t) => {
      if (kindFilter !== 'ALL' && t.kind !== kindFilter) return false;
      if (q) return typeMatchesSearch(t, q);
      return true;
    });
  }, [schemaInfo, kindFilter, searchQuery]);

  const allKindMatchCount = useMemo(() => {
    if (!schemaInfo || kindFilter === 'ALL' || !searchQuery.trim()) return 0;
    const q = searchQuery.trim().toLowerCase();
    return schemaInfo.types.filter((t) => typeMatchesSearch(t, q)).length;
  }, [schemaInfo, kindFilter, searchQuery]);

  const selectedType = useMemo(
    () => schemaInfo?.types.find((t) => t.name === selectedTypeName) ?? null,
    [schemaInfo, selectedTypeName],
  );

  // Clear selection when the selected type disappears from the filtered list
  useEffect(() => {
    if (!selectedTypeName) return;
    const stillVisible = filteredTypes.some((t) => t.name === selectedTypeName);
    if (!stillVisible) setSelectedTypeName(null);
  }, [filteredTypes, selectedTypeName]);

  // ── Schema stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!schemaInfo) return null;
    const inputs = schemaInfo.types.filter((t) => t.kind === 'INPUT_OBJECT').length;
    const enums = schemaInfo.types.filter((t) => t.kind === 'ENUM').length;
    const totalFields = schemaInfo.types.reduce((s, t) => s + (t.fields?.length ?? 0), 0);
    return { total: schemaInfo.types.length, inputs, enums, totalFields, fetchedAt: schemaInfo.fetchedAt };
  }, [schemaInfo]);

  // ── Navigable type names ──────────────────────────────────────────────────
  const navigableTypes = useMemo<Set<string>>(
    () => new Set(schemaInfo?.types.map((t) => t.name) ?? []),
    [schemaInfo],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleExportSDL = () => {
    if (!schemaInfo?.sdl) return;
    const blob = new Blob([schemaInfo.sdl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.graphql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 150);
  };

  const handleSelectType = (name: string) => {
    setSelectedTypeName(name);
    setDetailTab('fields');
    const targetKind = schemaInfo?.types.find((t) => t.name === name)?.kind;
    if (kindFilter !== 'ALL' && targetKind && targetKind !== kindFilter) {
      setKindFilter('ALL');
    }
  };

  const handleKindFilter = (k: KindFilter) => {
    setKindFilter(k);
    if (k !== 'ALL' && selectedTypeName) {
      const selectedKind = schemaInfo?.types.find((t) => t.name === selectedTypeName)?.kind;
      if (selectedKind !== k) setSelectedTypeName(null);
    }
  };

  // ── Non-loaded states ─────────────────────────────────────────────────────
  if (status === 'idle') {
    return <SchemaIdleState onIntrospect={onIntrospect} introspecting={introspecting} />;
  }
  if (status === 'loading') {
    return <SchemaLoadingState />;
  }
  if (status === 'introspection-disabled') {
    return (
      <SchemaIntrospectionDisabledState
        errorMessage={errorMessage}
        onIntrospect={onIntrospect}
        introspecting={introspecting}
      />
    );
  }
  if (status === 'error') {
    return (
      <SchemaErrorState
        errorMessage={errorMessage}
        onIntrospect={onIntrospect}
        introspecting={introspecting}
      />
    );
  }
  if (!schemaInfo) return null;

  // ── Schema loaded ─────────────────────────────────────────────────────────
  return (
    <div className="gql-se-root" data-testid="gql-schema-explorer">
      <div className="gql-se-body">

        {/* Left: type list column */}
        <div className="gql-se-list-col">
          <div className="gql-se-list-header">
            <span id="gql-se-list-title" className="gql-se-list-title">
              Types ({schemaInfo.types.length})
            </span>
            <div className="gql-se-list-actions">
              {onIntrospect && (
                <button
                  type="button"
                  className="gql-se-icon-btn"
                  onClick={onIntrospect}
                  disabled={introspecting}
                  title="Re-introspect schema"
                  aria-label={introspecting ? 'Re-introspecting…' : 'Re-introspect schema'}
                  data-testid="gql-se-reintrospect-btn"
                >
                  {introspecting
                    ? <span className="gql-se-btn-spinner" aria-hidden="true" />
                    : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                    )
                  }
                </button>
              )}
              <button
                type="button"
                className="gql-se-icon-btn"
                onClick={handleExportSDL}
                disabled={!schemaInfo?.sdl}
                title={schemaInfo?.sdl ? 'Export full schema as schema.graphql' : 'No SDL available to export'}
                aria-label={schemaInfo?.sdl ? 'Export schema SDL' : 'Export SDL (unavailable — no schema loaded)'}
                data-testid="gql-se-export-sdl-btn"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                SDL
              </button>
            </div>
          </div>

          <div className="gql-se-list-search-wrap">
            <input
              type="search"
              className="gql-se-list-search gql-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter types…"
              aria-label="Search schema types and fields"
              data-testid="gql-se-search"
            />
          </div>

          <div className="gql-se-filter-chips" role="group" aria-label="Filter by type kind">
            <button
              type="button"
              className={`gql-se-filter-chip${kindFilter === 'ALL' ? ' gql-se-filter-chip--active' : ''}`}
              onClick={() => handleKindFilter('ALL')}
              aria-pressed={kindFilter === 'ALL'}
            >
              All
            </button>
            {KIND_ORDER.map((k) => {
              const count = schemaInfo.types.filter((t) => t.kind === k).length;
              if (count === 0) return null;
              return (
                <button
                  key={k}
                  type="button"
                  className={`gql-se-filter-chip${kindFilter === k ? ' gql-se-filter-chip--active' : ''}`}
                  onClick={() => handleKindFilter(k)}
                  aria-pressed={kindFilter === k}
                  title={`${KIND_LABEL[k]} (${count})`}
                >
                  {KIND_LABEL[k]}
                </button>
              );
            })}
          </div>

          <div className="gql-se-type-entries" role="list" aria-labelledby="gql-se-list-title" data-testid="gql-se-type-list">
            {filteredTypes.length === 0 ? (
              <div className="gql-se-no-results">
                {searchQuery && kindFilter !== 'ALL' && allKindMatchCount > 0 ? (
                  <>
                    <div>No {KIND_LABEL[kindFilter as TypeKind]} types match.</div>
                    <button
                      type="button"
                      className="gql-se-no-results-link"
                      onClick={() => handleKindFilter('ALL')}
                    >
                      Show all {allKindMatchCount} matching type{allKindMatchCount === 1 ? '' : 's'}
                    </button>
                  </>
                ) : searchQuery ? (
                  `No types match "${searchQuery}"`
                ) : (
                  'No types'
                )}
              </div>
            ) : (
              filteredTypes.map((type) => {
                const isSelected = selectedTypeName === type.name;
                const countText = fieldCountText(type);
                return (
                  <div key={type.name} role="listitem">
                    <button
                      type="button"
                      className={`gql-se-type-entry${isSelected ? ' gql-se-type-entry--selected' : ''}`}
                      onClick={() => handleSelectType(type.name)}
                      aria-pressed={isSelected}
                      data-testid={`gql-se-type-${type.name}`}
                    >
                      <span
                        className={`gql-se-type-icon ${KIND_CSS[type.kind]}`}
                        aria-hidden="true"
                        title={KIND_LABEL[type.kind]}
                      >
                        {KIND_ABBR[type.kind]}
                      </span>
                      <span className="gql-se-type-info">
                        <span className="gql-se-type-name">{type.name}</span>
                        {type.description && (
                          <span className="gql-se-type-desc">{type.description}</span>
                        )}
                      </span>
                      {countText && (
                        <span className="gql-se-type-count" aria-label={countText}>
                          {countText}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="gql-se-detail-panel" data-testid="gql-se-detail-panel">
          {selectedType ? (
            <TypeDetail
              key={selectedType.name}
              type={selectedType}
              detailTab={detailTab}
              onTabChange={setDetailTab}
              navigableTypes={navigableTypes}
              onSelectType={handleSelectType}
              onInsertField={onInsertField}
            />
          ) : (
            <div className="gql-se-detail-placeholder">
              <div className="gql-se-empty-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div className="gql-se-empty-title gql-se-empty-title--sm">Select a type</div>
              <div className="gql-se-empty-desc">
                Click any type in the list to explore its fields and SDL definition.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats footer */}
      {stats && (
        <div className="gql-se-stats-footer" data-testid="gql-se-stats-footer">
          <span>
            Schema: {stats.total} types
            {' '}•{' '}{stats.totalFields} fields
            {stats.inputs > 0 && <>{' '}•{' '}{stats.inputs} input{stats.inputs === 1 ? '' : 's'}</>}
            {stats.enums > 0 && <>{' '}•{' '}{stats.enums} enum{stats.enums === 1 ? '' : 's'}</>}
          </span>
          <span className="gql-se-stats-time">
            {(() => {
              const d = new Date(stats.fetchedAt);
              const isToday = d.toDateString() === new Date().toDateString();
              const formatted = isToday
                ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
                  ' ' +
                  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return `Last introspected: ${formatted}`;
            })()}
          </span>
        </div>
      )}
    </div>
  );
}
