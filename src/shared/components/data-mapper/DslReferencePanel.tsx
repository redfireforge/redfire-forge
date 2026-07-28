import { useState, useMemo, useCallback, useRef } from 'react';

// ─── Reference Data ───────────────────────────────────────

interface RefEntry {
  operator: string;
  description: string;
  syntax: string;
  example: string;
}

interface RefSection {
  id: string;
  name: string;
  icon: string;
  color: string;
  entries: RefEntry[];
}

const REF_SECTIONS: RefSection[] = [
  {
    id: 'equality',
    name: 'Equality',
    icon: '=',
    color: 'var(--success, #a6e3a1)',
    entries: [
      { operator: 'equals', description: 'Exact match', syntax: 'path  equals  "value"', example: 'status  equals  "active"' },
      { operator: 'not_equals', description: 'Not equal', syntax: 'path  not_equals  "value"', example: 'role  not_equals  "guest"' },
    ],
  },
  {
    id: 'comparison',
    name: 'Comparison',
    icon: '\u2276',
    color: 'var(--warning, #f9e2af)',
    entries: [
      { operator: '>', description: 'Greater than', syntax: 'path > N', example: 'price  >  0' },
      { operator: '>=', description: 'Greater or equal', syntax: 'path >= N', example: 'count  >=  1' },
      { operator: '<', description: 'Less than', syntax: 'path < N', example: 'age  <  100' },
      { operator: '<=', description: 'Less or equal', syntax: 'path <= N', example: 'retries  <=  3' },
      { operator: 'between', description: 'Range (inclusive)', syntax: 'path between min, max', example: 'score  between  0, 100' },
      { operator: 'close_to', description: 'Approx equal', syntax: 'path close_to val, tol', example: 'lat  close_to  40.71, 0.01' },
    ],
  },
  {
    id: 'string',
    name: 'String',
    icon: 'Aa',
    color: 'var(--purple, #cba6f7)',
    entries: [
      { operator: 'contains', description: 'Substring match', syntax: 'path contains "text"', example: 'name  contains  "Star"' },
      { operator: 'not_contains', description: 'Substring absent', syntax: 'path not_contains "text"', example: 'msg  not_contains  "error"' },
      { operator: 'starts_with', description: 'Prefix match', syntax: 'path starts_with "pfx"', example: 'id  starts_with  "usr_"' },
      { operator: 'ends_with', description: 'Suffix match', syntax: 'path ends_with "sfx"', example: 'email  ends_with  ".com"' },
      { operator: 'regex', description: 'Regex match', syntax: 'path regex "pattern"', example: 'zip  regex  "^\\d{5}$"' },
    ],
  },
  {
    id: 'boolean',
    name: 'Boolean & Null',
    icon: '?!',
    color: 'var(--error, #f38ba8)',
    entries: [
      { operator: 'is_true', description: 'Truthy', syntax: 'path is_true', example: 'isActive  is_true' },
      { operator: 'is_false', description: 'Falsy', syntax: 'path is_false', example: 'isDeleted  is_false' },
      { operator: 'is_null', description: 'Null', syntax: 'path is_null', example: 'deletedAt  is_null' },
      { operator: 'is_not_null', description: 'Not null', syntax: 'path is_not_null', example: 'createdAt  is_not_null' },
      { operator: 'is_empty', description: 'Empty str/arr', syntax: 'path is_empty', example: 'tags  is_empty' },
      { operator: 'is_not_empty', description: 'Non-empty', syntax: 'path is_not_empty', example: 'items  is_not_empty' },
    ],
  },
  {
    id: 'type',
    name: 'Type & Existence',
    icon: 'T',
    color: 'var(--cyan, #89dceb)',
    entries: [
      { operator: 'is_type', description: 'Type check', syntax: 'path is_type string|number|...', example: 'name  is_type  string' },
      { operator: 'exists', description: 'Path exists', syntax: 'path exists', example: 'data.id  exists' },
      { operator: 'not_exists', description: 'Path absent', syntax: 'path not_exists', example: 'error  not_exists' },
    ],
  },
  {
    id: 'set',
    name: 'Set Membership',
    icon: '\u2208',
    color: 'var(--blue, #89b4fa)',
    entries: [
      { operator: 'in', description: 'One of values', syntax: 'path in "a", "b", "c"', example: 'status  in  "active", "pending"' },
      { operator: 'not_in', description: 'Not in values', syntax: 'path not_in "a", "b"', example: 'role  not_in  "banned", "suspended"' },
    ],
  },
  {
    id: 'collection',
    name: 'Collection',
    icon: '[]',
    color: 'var(--teal, #94e2d5)',
    entries: [
      { operator: 'length', description: 'Array/string length', syntax: 'path length >= N', example: 'items  length >=  1' },
      { operator: 'each', description: 'Assert every element', syntax: 'path[*].f each >= 0', example: 'scores[*]  each >=  0' },
      { operator: 'contains_any', description: 'Has at least one', syntax: 'path contains_any "a"', example: 'tags  contains_any  "vip"' },
      { operator: 'contains_all', description: 'Has all listed', syntax: 'path contains_all "a","b"', example: 'roles  contains_all  "admin", "user"' },
      { operator: 'contains_only', description: 'Only listed values', syntax: 'path contains_only "a","b"', example: 'colors  contains_only  "red", "blue"' },
      { operator: 'contains_none', description: 'None of values', syntax: 'path contains_none "x"', example: 'errors  contains_none  "fatal"' },
      { operator: 'subset', description: 'Deep partial match', syntax: 'path subset {"k": v}', example: 'config  subset  {"debug": true}' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom & Modifiers',
    icon: '\u03BB',
    color: 'var(--mauve, #cba6f7)',
    entries: [
      { operator: 'ASSERT', description: 'Custom expression', syntax: 'ASSERT $fn($.path, val)', example: 'ASSERT $gt($.body.offers.length, 0)' },
      { operator: 'NOT', description: 'Negate assertion', syntax: 'path NOT op value', example: 'status  NOT equals  "error"' },
      { operator: '# comment', description: 'Line comment', syntax: '# This is ignored', example: '# Field assertions' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────

interface DslReferencePanelProps {
  onInsert: (text: string) => void;
}

export default function DslReferencePanel({ onInsert }: DslReferencePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [copiedOp, setCopiedOp] = useState<string | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleSection = useCallback((id: string) => {
    setOpenSections(prev => {
      if (prev.has(id)) return new Set<string>();
      return new Set([id]);
    });
  }, []);

  const expandAll = useCallback(() => {
    setOpenSections(new Set(REF_SECTIONS.map(s => s.id)));
  }, []);

  const collapseAll = useCallback(() => {
    setOpenSections(new Set());
  }, []);

  const handleCopy = useCallback((text: string, opId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOp(opId);
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => setCopiedOp(null), 1500);
  }, []);

  const filteredSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return REF_SECTIONS;
    return REF_SECTIONS
      .map(section => ({
        ...section,
        entries: section.entries.filter(
          e => e.operator.toLowerCase().includes(q)
            || e.description.toLowerCase().includes(q)
            || e.syntax.toLowerCase().includes(q)
            || e.example.toLowerCase().includes(q),
        ),
      }))
      .filter(section => section.entries.length > 0);
  }, [searchQuery]);

  const totalCount = useMemo(
    () => filteredSections.reduce((acc, s) => acc + s.entries.length, 0),
    [filteredSections],
  );

  return (
    <div className="vr-reference-pane" role="complementary" aria-label="DSL Reference">
      <div className="vr-ref-header">
        <div className="vr-ref-header-row">
          <span className="vr-ref-header-title">Reference</span>
          <span className="vr-ref-header-count">{totalCount}</span>
          <div className="vr-ref-header-btns">
            <button type="button" className="vr-ref-toggle-btn" onClick={expandAll} title="Expand all" aria-label="Expand all sections">&#x25BC;</button>
            <button type="button" className="vr-ref-toggle-btn" onClick={collapseAll} title="Collapse all" aria-label="Collapse all sections">&#x25B2;</button>
          </div>
        </div>
        <div className="vr-ref-search-wrap">
          <span className="vr-ref-search-icon" aria-hidden="true">&#x1F50D;</span>
          <input
            className="vr-ref-search"
            type="text"
            placeholder="Filter operators..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Filter DSL reference"
          />
          {searchQuery && (
            <button
              type="button"
              className="vr-ref-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >&#x2715;</button>
          )}
        </div>
      </div>

      <div className="vr-ref-body">
        {filteredSections.map(section => {
          const isOpen = searchQuery ? true : openSections.has(section.id);
          return (
            <div className="vr-ref-section" key={section.id}>
              <div
                className="vr-ref-section-header"
                role="button"
                tabIndex={0}
                onClick={() => toggleSection(section.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(section.id); } }}
                aria-expanded={isOpen}
              >
                <span className={`vr-ref-chevron${isOpen ? ' vr-ref-chevron--open' : ''}`}>&#x25B8;</span>
                <span className="vr-ref-section-badge" style={{ background: section.color }}>
                  {section.icon}
                </span>
                <span className="vr-ref-section-name">{section.name}</span>
                <span className="vr-ref-count">{section.entries.length}</span>
              </div>
              {isOpen && (
                <div className="vr-ref-section-body">
                  {section.entries.map(entry => {
                    const entryId = `${section.id}-${entry.operator}`;
                    const isCopied = copiedOp === entryId;
                    return (
                      <div className="vr-ref-entry" key={entry.operator}>
                        <div className="vr-ref-entry-main">
                          <span className="vr-ref-op" style={{ color: section.color }}>{entry.operator}</span>
                          <span className="vr-ref-desc">{entry.description}</span>
                          <div className="vr-ref-entry-actions">
                            <button
                              className="vr-ref-action-btn vr-ref-action-btn--insert"
                              type="button"
                              onClick={() => onInsert(entry.example)}
                              title={`Insert: ${entry.example}`}
                              aria-label={`Insert ${entry.operator} example`}
                            >
                              +
                            </button>
                            <button
                              className={`vr-ref-action-btn vr-ref-action-btn--copy${isCopied ? ' vr-ref-action-btn--copied' : ''}`}
                              type="button"
                              onClick={() => handleCopy(entry.syntax, entryId)}
                              title={isCopied ? 'Copied!' : 'Copy syntax'}
                              aria-label={`Copy ${entry.operator} syntax`}
                            >
                              {isCopied ? '\u2713' : '\u2398'}
                            </button>
                          </div>
                        </div>
                        <code className="vr-ref-syntax">{entry.syntax}</code>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filteredSections.length === 0 && (
          <div className="vr-ref-empty">
            No matches for &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
