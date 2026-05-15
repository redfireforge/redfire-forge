import { useState, useMemo, useCallback } from 'react';

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
  defaultOpen: boolean;
  entries: RefEntry[];
}

const REF_SECTIONS: RefSection[] = [
  {
    id: 'equality',
    name: 'Equality',
    icon: '=',
    color: 'var(--success, #a6e3a1)',
    defaultOpen: true,
    entries: [
      { operator: 'equals', description: 'Exact value match', syntax: 'path  equals  "value"', example: 'status  equals  "active"' },
      { operator: 'not_equals', description: 'Value does not match', syntax: 'path  not_equals  "value"', example: 'role  not_equals  "guest"' },
    ],
  },
  {
    id: 'comparison',
    name: 'Comparison',
    icon: '\u2276',
    color: 'var(--warning, #f9e2af)',
    defaultOpen: true,
    entries: [
      { operator: '>', description: 'Greater than', syntax: 'path  >  number', example: 'price  >  0' },
      { operator: '>=', description: 'Greater than or equal', syntax: 'path  >=  number', example: 'count  >=  1' },
      { operator: '<', description: 'Less than', syntax: 'path  <  number', example: 'age  <  100' },
      { operator: '<=', description: 'Less than or equal', syntax: 'path  <=  number', example: 'retries  <=  3' },
      { operator: 'between', description: 'Value within range (inclusive)', syntax: 'path  between  min, max', example: 'score  between  0, 100' },
      { operator: 'close_to', description: 'Approximate equality', syntax: 'path  close_to  value, tolerance', example: 'lat  close_to  40.71, 0.01' },
    ],
  },
  {
    id: 'string',
    name: 'String',
    icon: 'Aa',
    color: 'var(--purple, #cba6f7)',
    defaultOpen: true,
    entries: [
      { operator: 'contains', description: 'Substring match', syntax: 'path  contains  "text"', example: 'name  contains  "Star"' },
      { operator: 'not_contains', description: 'Substring absent', syntax: 'path  not_contains  "text"', example: 'msg  not_contains  "error"' },
      { operator: 'starts_with', description: 'Prefix match', syntax: 'path  starts_with  "prefix"', example: 'id  starts_with  "usr_"' },
      { operator: 'ends_with', description: 'Suffix match', syntax: 'path  ends_with  "suffix"', example: 'email  ends_with  ".com"' },
      { operator: 'regex', description: 'Regular expression match', syntax: 'path  regex  "pattern"', example: 'zip  regex  "^\\d{5}$"' },
    ],
  },
  {
    id: 'boolean',
    name: 'Boolean & Null',
    icon: '?!',
    color: 'var(--error, #f38ba8)',
    defaultOpen: false,
    entries: [
      { operator: 'is_true', description: 'Value is truthy', syntax: 'path  is_true', example: 'isActive  is_true' },
      { operator: 'is_false', description: 'Value is falsy', syntax: 'path  is_false', example: 'isDeleted  is_false' },
      { operator: 'is_null', description: 'Value is null', syntax: 'path  is_null', example: 'deletedAt  is_null' },
      { operator: 'is_not_null', description: 'Value is not null', syntax: 'path  is_not_null', example: 'createdAt  is_not_null' },
      { operator: 'is_empty', description: 'String/array is empty', syntax: 'path  is_empty', example: 'tags  is_empty' },
      { operator: 'is_not_empty', description: 'String/array is not empty', syntax: 'path  is_not_empty', example: 'items  is_not_empty' },
    ],
  },
  {
    id: 'type',
    name: 'Type & Existence',
    icon: 'T',
    color: 'var(--cyan, #89dceb)',
    defaultOpen: false,
    entries: [
      { operator: 'is_type', description: 'Check value type', syntax: 'path  is_type  string|number|boolean|array|object|null', example: 'name  is_type  string' },
      { operator: 'exists', description: 'Path exists in response', syntax: 'path  exists', example: 'data.id  exists' },
      { operator: 'not_exists', description: 'Path does not exist', syntax: 'path  not_exists', example: 'error  not_exists' },
    ],
  },
  {
    id: 'set',
    name: 'Set Membership',
    icon: '\u2208',
    color: 'var(--blue, #89b4fa)',
    defaultOpen: false,
    entries: [
      { operator: 'in', description: 'Value is one of listed values', syntax: 'path  in  "a", "b", "c"', example: 'status  in  "active", "pending"' },
      { operator: 'not_in', description: 'Value is not in listed values', syntax: 'path  not_in  "a", "b"', example: 'role  not_in  "banned", "suspended"' },
    ],
  },
  {
    id: 'collection',
    name: 'Collection',
    icon: '[]',
    color: 'var(--teal, #94e2d5)',
    defaultOpen: false,
    entries: [
      { operator: 'length =', description: 'Array/string length check', syntax: 'path  length >=  N', example: 'items  length >=  1' },
      { operator: 'each', description: 'Assert on every element', syntax: 'path[*].field  each >=  0', example: 'scores[*]  each >=  0' },
      { operator: 'contains_any', description: 'Array contains at least one', syntax: 'path  contains_any  "a", "b"', example: 'tags  contains_any  "vip"' },
      { operator: 'contains_all', description: 'All values present', syntax: 'path  contains_all  "a", "b"', example: 'roles  contains_all  "admin", "user"' },
      { operator: 'contains_only', description: 'Only listed values', syntax: 'path  contains_only  "a", "b"', example: 'colors  contains_only  "red", "blue"' },
      { operator: 'contains_none', description: 'None of the values', syntax: 'path  contains_none  "x"', example: 'errors  contains_none  "fatal"' },
      { operator: 'subset', description: 'Object subset match', syntax: 'path  subset  {"key": val}', example: 'config  subset  {"debug": true}' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Predicates',
    icon: '\u03BB',
    color: 'var(--mauve, #cba6f7)',
    defaultOpen: false,
    entries: [
      { operator: 'ASSERT', description: 'Custom expression assertion', syntax: 'ASSERT  $fn($.body.path, val)', example: 'ASSERT $gt($.body.offers.length, 0)' },
      { operator: 'ASSERT + comment', description: 'With inline description', syntax: 'ASSERT expr  // description', example: 'ASSERT $eq($.body.status, "ok")  // API healthy' },
    ],
  },
  {
    id: 'modifier',
    name: 'Modifiers',
    icon: '\u00AC',
    color: 'var(--red, #f87171)',
    defaultOpen: false,
    entries: [
      { operator: 'NOT', description: 'Negate any assertion', syntax: 'path  NOT operator  value', example: 'status  NOT equals  "error"' },
      { operator: 'NOT ASSERT', description: 'Negate custom predicate', syntax: 'NOT ASSERT  expression', example: 'NOT ASSERT $contains($.body.msg, "fail")' },
    ],
  },
  {
    id: 'syntax',
    name: 'Syntax Guide',
    icon: '#',
    color: 'var(--text-dim, #6c7086)',
    defaultOpen: false,
    entries: [
      { operator: '# comment', description: 'Line comment (ignored)', syntax: '# This is a comment', example: '# Field assertions' },
      { operator: 'Paths', description: 'JSONPath-style navigation', syntax: 'obj.field  arr[0].sub  arr[*].field', example: 'data.users[0].name  exists' },
      { operator: 'Strings', description: 'Double-quoted values', syntax: '"double quoted values"', example: 'name  equals  "Alice"' },
      { operator: 'Numbers', description: 'Integer or decimal values', syntax: '42  3.14  -1', example: 'count  >=  10' },
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
    () => new Set(REF_SECTIONS.filter(s => s.defaultOpen).map(s => s.id)),
  );

  const toggleSection = useCallback((id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setOpenSections(new Set(REF_SECTIONS.map(s => s.id)));
  }, []);

  const collapseAll = useCallback(() => {
    setOpenSections(new Set());
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
          <span className="vr-ref-header-title">DSL Reference</span>
          <span className="vr-ref-header-count">{totalCount}</span>
          <div className="vr-ref-header-btns">
            <button type="button" className="vr-ref-toggle-btn" onClick={expandAll} title="Expand all" aria-label="Expand all sections">&#x25BC;</button>
            <button type="button" className="vr-ref-toggle-btn" onClick={collapseAll} title="Collapse all" aria-label="Collapse all sections">&#x25B2;</button>
          </div>
        </div>
        <div className="vr-ref-search-wrap">
          <span className="vr-ref-search-icon">&#x1F50D;</span>
          <input
            className="vr-ref-search"
            type="text"
            placeholder="Filter operators\u2026"
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
                  {section.entries.map(entry => (
                    <div className="vr-ref-card" key={entry.operator}>
                      <div className="vr-ref-card-top">
                        <span className="vr-ref-op" style={{ color: section.color }}>{entry.operator}</span>
                        <span className="vr-ref-desc">{entry.description}</span>
                      </div>
                      <div className="vr-ref-code-block">
                        <code>{entry.syntax}</code>
                      </div>
                      <div className="vr-ref-card-actions">
                        <button
                          className="vr-ref-insert-btn"
                          type="button"
                          onClick={() => onInsert(entry.example)}
                          title={`Insert: ${entry.example}`}
                          aria-label={`Insert ${entry.operator} example`}
                        >
                          <span className="vr-ref-insert-icon">&#x2B9E;</span> Insert
                        </button>
                        <button
                          className="vr-ref-copy-btn"
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(entry.syntax); }}
                          title="Copy syntax"
                          aria-label={`Copy ${entry.operator} syntax`}
                        >
                          &#x2398;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filteredSections.length === 0 && (
          <div className="vr-ref-empty">
            <span className="vr-ref-empty-icon">&#x1F50D;</span>
            <span>No matching operators for &ldquo;{searchQuery}&rdquo;</span>
          </div>
        )}
      </div>
    </div>
  );
}
