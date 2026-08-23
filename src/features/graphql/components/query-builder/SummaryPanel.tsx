import React, { useCallback, useMemo, useState } from 'react';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { GraphqlSchemaInfo } from '@shared/types/graphql';
import type { BuilderFieldDirectives, BuilderFragment, BuilderState, FieldPath } from '../../hooks/useGraphqlQueryBuilder';
import {
  findType,
  getAncestorPaths,
  getRootTypeName,
  resolvePathFieldType,
  searchFields,
  stripTypeModifiers,
} from '../../utils/queryBuilderGenerator';

export interface SummaryPanelProps {
  selectedCount:  number;
  maxDepth:       number;
  argsCount:      number;
  variablesCount: number;
  aliasCount:     number;
  directiveCount: number;
  fragmentCount:  number;
  schemaInfo:     GraphqlSchemaInfo | null;
  state:          BuilderState;
  onSetSearch:    (q: string) => void;
  onSearchExpand: (paths: string[]) => void;
  onSetAlias:     (path: FieldPath, alias: string) => void;
  onSetDirective: (path: FieldPath, which: 'include' | 'skip', enabled: boolean, ifVar: string) => void;
  onAddFragment:  (fragment: BuilderFragment) => void;
  onUpdateFragment: (name: string, patch: Partial<Omit<BuilderFragment, 'name'>>) => void;
  onRemoveFragment: (name: string) => void;
  onToggleSpread: (name: string) => void;
}

export function SummaryPanel({
  selectedCount, maxDepth, argsCount, variablesCount,
  aliasCount, directiveCount, fragmentCount,
  schemaInfo, state, onSetSearch, onSearchExpand,
  onSetAlias, onSetDirective,
  onAddFragment, onUpdateFragment, onRemoveFragment, onToggleSpread,
}: SummaryPanelProps) {
  const [pathSearch, setPathSearch]   = useState('');
  const [pathResults, setPathResults] = useState<ReturnType<typeof searchFields>>([]);

  const types        = useMemo(() => schemaInfo?.types ?? [], [schemaInfo]);
  const rootTypeName = schemaInfo ? getRootTypeName(state.operationType, schemaInfo) : null;

  const estimatedComplexity = useMemo(() => {
    if (!schemaInfo || selectedCount === 0) return 0;
    const selectedPaths = Object.keys(state.selectedFields).filter((k) => state.selectedFields[k]);
    let cost = 0;
    for (const path of selectedPaths) {
      cost += 1;
      const segments = path.split('.');
      let currentTypeName = rootTypeName ?? 'Query';
      for (const seg of segments) {
        const parentType = findType(currentTypeName, types);
        if (!parentType?.fields) break;
        const field = parentType.fields.find((f) => f.name === seg);
        if (!field) break;
        if (field.type.includes('[')) cost += 2;
        currentTypeName = stripTypeModifiers(field.type);
      }
    }
    return cost;
  }, [schemaInfo, selectedCount, state.selectedFields, types, rootTypeName]);

  const complexityCls = estimatedComplexity > 150 ? 'gql-qb-summary-stat-value--danger'
    : estimatedComplexity > 80  ? 'gql-qb-summary-stat-value--warn'
    : '';

  const handlePathSearch = useCallback((q: string) => {
    setPathSearch(q);
    if (!q.trim() || !rootTypeName) {
      setPathResults([]);
      return;
    }
    const results = searchFields(q, rootTypeName, types, 6).slice(0, 10);
    setPathResults(results);
  }, [rootTypeName, types]);

  const handlePathClick = useCallback(
    (result: ReturnType<typeof searchFields>[0]) => {
      setPathSearch('');
      setPathResults([]);
      const ancestors = getAncestorPaths(result.path);
      onSearchExpand(ancestors);
      onSetSearch(result.fieldName);
    },
    [onSearchExpand, onSetSearch],
  );

  return (
    <div className="gql-qb-summary" data-testid="gql-qb-summary">
      <div className="gql-qb-summary-section">
        <h3 className="gql-qb-summary-title">Selection summary</h3>
        {selectedCount === 0 ? (
          <p className="gql-qb-summary-empty">
            Check fields in the schema tree to build your operation. Metrics update as you select.
          </p>
        ) : (
          <div className="gql-qb-summary-grid">
            <div className="gql-qb-summary-stat gql-qb-summary-stat--primary">
              <span className="gql-qb-summary-stat-value">{selectedCount}</span>
              <span className="gql-qb-summary-stat-label">Fields</span>
            </div>
            <div className="gql-qb-summary-stat">
              <span className="gql-qb-summary-stat-value">{maxDepth}</span>
              <span className="gql-qb-summary-stat-label">Depth</span>
            </div>
            <div className="gql-qb-summary-stat">
              <span className="gql-qb-summary-stat-value">{argsCount}</span>
              <span className="gql-qb-summary-stat-label">Args</span>
            </div>
            <div className="gql-qb-summary-stat">
              <span className="gql-qb-summary-stat-value">{variablesCount}</span>
              <span className="gql-qb-summary-stat-label">Variables</span>
            </div>
            {estimatedComplexity > 0 && (
              <div className={`gql-qb-summary-stat gql-qb-summary-stat--wide${complexityCls ? ` ${complexityCls}` : ''}`}>
                <span className={`gql-qb-summary-stat-value${complexityCls ? ` ${complexityCls}` : ''}`} title="Estimated query complexity score">
                  {estimatedComplexity}
                </span>
                <span className="gql-qb-summary-stat-label">Est. complexity</span>
              </div>
            )}
            {aliasCount > 0 && (
              <div className="gql-qb-summary-stat">
                <span className="gql-qb-summary-stat-value">{aliasCount}</span>
                <span className="gql-qb-summary-stat-label">Aliases</span>
              </div>
            )}
            {directiveCount > 0 && (
              <div className="gql-qb-summary-stat">
                <span className="gql-qb-summary-stat-value">{directiveCount}</span>
                <span className="gql-qb-summary-stat-label">Directives</span>
              </div>
            )}
            {fragmentCount > 0 && (
              <div className="gql-qb-summary-stat">
                <span className="gql-qb-summary-stat-value">{fragmentCount}</span>
                <span className="gql-qb-summary-stat-label">Fragments</span>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCount > 0 && (
        <FieldOptionsSection
          state={state}
          onSetAlias={onSetAlias}
          onSetDirective={onSetDirective}
        />
      )}

      <FragmentSection
        state={state}
        schemaInfo={schemaInfo}
        selectedPaths={Object.keys(state.selectedFields).filter((p) => state.selectedFields[p])}
        onAddFragment={onAddFragment}
        onUpdateFragment={onUpdateFragment}
        onRemoveFragment={onRemoveFragment}
        onToggleSpread={onToggleSpread}
      />

      <div className="gql-qb-summary-section">
        <h3 className="gql-qb-summary-title">Find field path</h3>
        <p className="gql-qb-summary-hint">Jump to any field from the root type</p>
        <input
          type="text"
          className="gql-qb-summary-search"
          placeholder="Field name…"
          value={pathSearch}
          onChange={(e) => handlePathSearch(e.target.value)}
          aria-label="Find field path"
          data-testid="gql-qb-path-search"
        />
        {pathResults.length > 0 && (
          <div className="gql-qb-path-results">
            {pathResults.map((r) => (
              <button
                key={r.path}
                type="button"
                className="gql-qb-path-result"
                onClick={() => handlePathClick(r)}
                title={`Navigate to: ${r.path}`}
              >
                <span className="gql-qb-pr-path">
                  {r.path.split('.').map((seg, i, arr) => (
                    <React.Fragment key={i}>
                      <span className={i === arr.length - 1 ? 'gql-qb-pr-leaf' : 'gql-qb-pr-seg'}>
                        {seg}
                      </span>
                      {i < arr.length - 1 && <span className="gql-qb-pr-sep"> › </span>}
                    </React.Fragment>
                  ))}
                </span>
                <span className="gql-qb-pr-type">{r.fieldType}</span>
              </button>
            ))}
          </div>
        )}
        {pathSearch.trim() && pathResults.length === 0 && (
          <div className="gql-qb-path-empty">No paths found for "{pathSearch}"</div>
        )}
      </div>

      <details className="gql-qb-summary-section gql-qb-kbd-section">
        <summary className="gql-qb-summary-title gql-qb-kbd-summary">Keyboard shortcuts</summary>
        <div className="gql-qb-kbd-list">
          {[
            { key: '⌘K',    desc: 'Focus search' },
            { key: 'Space', desc: 'Toggle field' },
            { key: '→',     desc: 'Expand type' },
            { key: '←',     desc: 'Collapse type' },
            { key: '⌘↵',   desc: 'Execute query' },
            { key: 'Esc',   desc: 'Clear search' },
          ].map(({ key, desc }) => (
            <div key={key} className="gql-qb-kbd-row">
              <kbd className="gql-qb-kbd">{key}</kbd>
              <span className="gql-qb-kbd-desc">{desc}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// ─── Field Options Section ────────────────────────────────────────────────────

interface FieldOptionsSectionProps {
  state:          BuilderState;
  onSetAlias:     (path: FieldPath, alias: string) => void;
  onSetDirective: (path: FieldPath, which: 'include' | 'skip', enabled: boolean, ifVar: string) => void;
}

const MAX_FIELD_OPTIONS_ROWS = 12;

function FieldOptionsSection({ state, onSetAlias, onSetDirective }: FieldOptionsSectionProps) {
  const selectedPaths = Object.keys(state.selectedFields).filter((p) => state.selectedFields[p]);
  const displayPaths  = selectedPaths.slice(0, MAX_FIELD_OPTIONS_ROWS);
  const overflow      = selectedPaths.length - displayPaths.length;

  return (
    <div className="gql-qb-summary-section" data-testid="gql-qb-field-options">
      <h3 className="gql-qb-summary-title">Field options</h3>
      <p className="gql-qb-summary-hint">Alias and directives per selected field</p>
      <div className="gql-qb-fo-list">
        {displayPaths.map((path) => (
          <FieldOptionRow
            key={path}
            path={path}
            alias={(state.fieldAliases ?? {})[path] ?? ''}
            directives={(state.fieldDirectives ?? {})[path]}
            onSetAlias={onSetAlias}
            onSetDirective={onSetDirective}
          />
        ))}
        {overflow > 0 && (
          <div className="gql-qb-fo-overflow">+{overflow} more field{overflow !== 1 ? 's' : ''}</div>
        )}
      </div>
    </div>
  );
}

interface FieldOptionRowProps {
  path:        string;
  alias:       string;
  directives:  BuilderFieldDirectives | undefined;
  onSetAlias:     (path: FieldPath, alias: string) => void;
  onSetDirective: (path: FieldPath, which: 'include' | 'skip', enabled: boolean, ifVar: string) => void;
}

function formatFieldOptionPath(path: string): React.ReactNode {
  const segments = path.split('.');
  if (segments.length === 1) {
    return <span className="gql-qb-fo-leaf">{segments[0]}</span>;
  }
  return (
    <>
      {segments.map((seg, i) => (
        <React.Fragment key={`${path}-${i}`}>
          {i > 0 && <span className="gql-qb-fo-sep" aria-hidden="true"> › </span>}
          <span className={i === segments.length - 1 ? 'gql-qb-fo-leaf' : 'gql-qb-fo-seg'}>
            {seg}
          </span>
        </React.Fragment>
      ))}
    </>
  );
}

function FieldOptionRow({ path, alias, directives, onSetAlias, onSetDirective }: FieldOptionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const leafName = path.split('.').pop() ?? path;
  const hasOptions = alias.trim() || directives?.include?.enabled || directives?.skip?.enabled;

  const handleIncludeToggle = () => {
    const cur = directives?.include;
    if (cur?.enabled) {
      onSetDirective(path, 'include', false, cur.ifVar);
    } else if (cur) {
      onSetDirective(path, 'include', true, cur.ifVar);
    } else {
      onSetDirective(path, 'include', true, 'true');
    }
  };

  const handleSkipToggle = () => {
    const cur = directives?.skip;
    if (cur?.enabled) {
      onSetDirective(path, 'skip', false, cur.ifVar);
    } else if (cur) {
      onSetDirective(path, 'skip', true, cur.ifVar);
    } else {
      onSetDirective(path, 'skip', true, 'false');
    }
  };

  return (
    <div className={`gql-qb-fo-row${hasOptions ? ' gql-qb-fo-row--has-options' : ''}`}>
      <div className="gql-qb-fo-header">
        <button
          type="button"
          className={`gql-qb-fo-expand${expanded ? ' gql-qb-fo-expand--open' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? `Collapse options for ${path}` : `Expand options for ${path}`}
          title={path}
          data-testid={`gql-fo-expand-${path}`}
        >
          {formatFieldOptionPath(path)}
          <span className="gql-qb-fo-chevron">{expanded ? '▲' : '▼'}</span>
        </button>
      </div>

      {expanded && (
        <div className="gql-qb-fo-body">
          {/* Alias */}
          <div className="gql-qb-fo-option-row">
            <label className="gql-qb-fo-label" htmlFor={`gql-fo-alias-${path}`}>alias</label>
            <input
              id={`gql-fo-alias-${path}`}
              type="text"
              className="gql-qb-fo-input"
              placeholder="e.g. currentUser"
              value={alias}
              onChange={(e) => onSetAlias(path, e.target.value)}
              aria-label={`Alias for ${leafName}`}
              data-testid={`gql-fo-alias-${path}`}
            />
          </div>

          {/* @include */}
          <div className="gql-qb-fo-directive-row">
            <button
              type="button"
              role="switch"
              aria-checked={!!directives?.include?.enabled}
              className={`gql-qb-fo-toggle${directives?.include?.enabled ? ' gql-qb-fo-toggle--on' : ''}`}
              onClick={handleIncludeToggle}
              aria-label={`Toggle @include on ${leafName}`}
              data-testid={`gql-fo-include-${path}`}
            />
            <code className="gql-qb-fo-dir-name">@include</code>
            {directives?.include && (
              <input
                type="text"
                className="gql-qb-fo-input gql-qb-fo-input--if"
                placeholder="{{var}} or $var"
                value={directives.include.ifVar}
                onChange={(e) =>
                  onSetDirective(path, 'include', directives.include!.enabled, e.target.value)
                }
                aria-label={`@include condition for ${leafName}`}
                data-testid={`gql-fo-include-if-${path}`}
              />
            )}
          </div>

          {/* @skip */}
          <div className="gql-qb-fo-directive-row">
            <button
              type="button"
              role="switch"
              aria-checked={!!directives?.skip?.enabled}
              className={`gql-qb-fo-toggle${directives?.skip?.enabled ? ' gql-qb-fo-toggle--on' : ''}`}
              onClick={handleSkipToggle}
              aria-label={`Toggle @skip on ${leafName}`}
              data-testid={`gql-fo-skip-${path}`}
            />
            <code className="gql-qb-fo-dir-name">@skip</code>
            {directives?.skip && (
              <input
                type="text"
                className="gql-qb-fo-input gql-qb-fo-input--if"
                placeholder="{{var}} or $var"
                value={directives.skip.ifVar}
                onChange={(e) =>
                  onSetDirective(path, 'skip', directives.skip!.enabled, e.target.value)
                }
                aria-label={`@skip condition for ${leafName}`}
                data-testid={`gql-fo-skip-if-${path}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fragment Section ─────────────────────────────────────────────────────────

interface FragmentSectionProps {
  state:              BuilderState;
  schemaInfo:         GraphqlSchemaInfo | null;
  selectedPaths:      string[];
  onAddFragment:      (fragment: BuilderFragment) => void;
  onUpdateFragment:   (name: string, patch: Partial<Omit<BuilderFragment, 'name'>>) => void;
  onRemoveFragment:   (name: string) => void;
  onToggleSpread:     (name: string) => void;
}

/** Validates that a string is a valid GraphQL identifier. */
function isValidGqlIdentifier(name: string): boolean {
  return /^[_A-Za-z][_A-Za-z0-9]*$/.test(name);
}

/**
 * Converts root-relative selected paths to paths relative to `onType`.
 *
 * e.g. if root is "Query", onType is "User", and selected paths are
 * ["user.name", "user.age", "posts.title"], this returns ["name", "age"].
 *
 * Paths that don't route through a field that resolves to `onType` are dropped.
 * If schemaInfo is absent, falls back to returning the raw paths unchanged.
 */
function toFragmentRelativePaths(
  selectedPaths: string[],
  onType: string,
  rootTypeName: string,
  types: import('../../../../shared/types/graphql').GraphqlTypeNode[],
): string[] {
  if (!types.length) return selectedPaths; // no schema — can't resolve, keep as-is
  if (onType === rootTypeName) return selectedPaths; // already relative to root

  const result = new Set<string>();
  for (const path of selectedPaths) {
    const parts = path.split('.');
    // Try each prefix (shortest first) to find one whose resolved type is onType
    for (let len = 1; len < parts.length; len++) {
      const prefix = parts.slice(0, len).join('.');
      const resolved = resolvePathFieldType(prefix, rootTypeName, types);
      if (resolved === onType) {
        const relative = parts.slice(len).join('.');
        if (relative) result.add(relative);
        break;
      }
    }
  }
  return [...result];
}

function FragmentSection({
  state, schemaInfo, selectedPaths,
  onAddFragment, onUpdateFragment, onRemoveFragment, onToggleSpread,
}: FragmentSectionProps) {
  const [newName, setNewName]   = useState('');
  const [newType, setNewType]   = useState('');
  const [error,   setError]     = useState('');

  // Defensive defaults: older/partial state snapshots may omit these keys.
  const fragmentMap = useMemo(() => state.fragments ?? {}, [state.fragments]);
  const activeSpreads = state.activeFragmentSpreads ?? [];
  const fragments = Object.values(fragmentMap);
  const types = useMemo(() => schemaInfo?.types ?? [], [schemaInfo]);
  const rootTypeName = schemaInfo ? getRootTypeName(state.operationType, schemaInfo) : '';

  const objectTypeNames = useMemo(
    () => types.filter((t) => t.kind === 'OBJECT').map((t) => t.name).sort(),
    [types],
  );

  const handleCreate = useCallback(() => {
    const trimName = newName.trim();
    const trimType = newType.trim();
    if (selectedPaths.length === 0) { setError('Select fields first to create a fragment.'); return; }
    if (!trimName) { setError('Fragment name is required.'); return; }
    if (!isValidGqlIdentifier(trimName)) { setError('Name must be a valid GraphQL identifier.'); return; }
    if (fragmentMap[trimName]) { setError(`Fragment "${trimName}" already exists.`); return; }
    if (!trimType) { setError('Type is required.'); return; }
    const relPaths = toFragmentRelativePaths(selectedPaths, trimType, rootTypeName, types);
    onAddFragment({ name: trimName, onType: trimType, fieldPaths: relPaths });
    setNewName('');
    setNewType('');
    setError('');
  }, [newName, newType, selectedPaths, rootTypeName, types, fragmentMap, onAddFragment]);

  return (
    <div className="gql-qb-summary-section" data-testid="gql-qb-fragment-section">
      <h3 className="gql-qb-summary-title">Fragments</h3>
      <p className="gql-qb-summary-hint">Reusable field sets appended after the operation</p>

      {/* Existing fragments */}
      {fragments.length > 0 && (
        <div className="gql-qb-frag-list">
          {fragments.map((frag) => {
            const active = activeSpreads.includes(frag.name);
            return (
              <div key={frag.name} className={`gql-qb-frag-item${active ? ' gql-qb-frag-item--active' : ''}`} data-testid={`gql-qb-frag-${frag.name}`}>
                <span className="gql-qb-frag-name">{frag.name}</span>
                <span className="gql-qb-frag-on">on {frag.onType}</span>
                <span className="gql-qb-frag-count">{frag.fieldPaths.length} field{frag.fieldPaths.length !== 1 ? 's' : ''}</span>
                <button
                  type="button"
                  className={`gql-qb-frag-use${active ? ' gql-qb-frag-use--active' : ''}`}
                  onClick={() => onToggleSpread(frag.name)}
                  aria-label={active ? `Remove spread ...${frag.name}` : `Spread ...${frag.name} in operation`}
                  aria-pressed={active}
                  data-testid={`gql-qb-frag-use-${frag.name}`}
                >
                  {active ? '✓ Spread' : 'Use'}
                </button>
                <button
                  type="button"
                  className="gql-qb-frag-update"
                  onClick={() => {
                    const relPaths = toFragmentRelativePaths(selectedPaths, frag.onType, rootTypeName, types);
                    onUpdateFragment(frag.name, { fieldPaths: relPaths });
                  }}
                  title="Update fragment fields to current selection"
                  aria-label={`Update ${frag.name} fields from current selection`}
                  data-testid={`gql-qb-frag-update-${frag.name}`}
                >↺</button>
                <button
                  type="button"
                  className="gql-qb-frag-delete"
                  onClick={() => onRemoveFragment(frag.name)}
                  aria-label={`Delete fragment ${frag.name}`}
                  data-testid={`gql-qb-frag-delete-${frag.name}`}
                >×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* New fragment form */}
      <div className="gql-qb-frag-new">
        <div className="gql-qb-frag-new-row">
          <input
            type="text"
            className="gql-qb-frag-name-input"
            placeholder="Fragment name"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setError(''); }}
            aria-label="New fragment name"
            data-testid="gql-qb-frag-name-input"
          />
          {objectTypeNames.length > 0 ? (
            <CustomSelect
              className="gql-qb-frag-type-select"
              value={newType}
              onChange={(v) => { setNewType(v); setError(''); }}
              options={objectTypeNames.map((t) => ({ value: t, label: t }))}
              placeholder="On type…"
              aria-label="Fragment on type"
              data-testid="gql-qb-frag-type-select"
            />
          ) : (
            <input
              type="text"
              className="gql-qb-frag-type-input"
              placeholder="On type…"
              value={newType}
              onChange={(e) => { setNewType(e.target.value); setError(''); }}
              aria-label="Fragment on type"
              data-testid="gql-qb-frag-type-input"
            />
          )}
        </div>
        <button
          type="button"
          className="gql-qb-frag-create-btn"
          onClick={handleCreate}
          aria-label="Create new fragment from current selection"
          data-testid="gql-qb-frag-create-btn"
        >
          New from selection
        </button>
        {selectedPaths.length === 0 && (
          <p className="gql-qb-frag-hint">Select fields in the tree to enable fragment creation.</p>
        )}
        {error && <p className="gql-qb-frag-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
