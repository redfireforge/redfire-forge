import { useEffect, useMemo, useRef, useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import {
  TEMPLATE_HELPER_CATALOG,
  copyTemplateSnippet,
  filterTemplateHelpers,
  formatHelperCatalogCount,
  groupTemplateHelpers,
  nextHelperMatch,
  scopeTemplateHelpers,
  templateHelperNavItems,
  type TemplateHelperEntry,
  type TemplateHelperNavId,
} from '../../../shared/api-mock/templateHelperCatalog';
import { ChevronDownIcon, ChevronUpIcon } from './ApiMockIcons';

interface Props {
  onInsert: (snippet: string) => void;
  onClose: () => void;
}

/**
 * Searchable catalog of every `{{helper}}` the response template engine evaluates.
 * Category rail + card grid; Insert appends the snippet, Copy puts it on the clipboard.
 */
export function ApiMockTemplateHelperModal({ onInsert, onClose }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TemplateHelperNavId>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => filterTemplateHelpers(query), [query]);
  const scoped = useMemo(() => scopeTemplateHelpers(filtered, category), [filtered, category]);
  const groups = useMemo(() => groupTemplateHelpers(scoped), [scoped]);
  const navItems = useMemo(() => templateHelperNavItems(filtered), [filtered]);
  const count = formatHelperCatalogCount(filtered.length, TEMPLATE_HELPER_CATALOG.length);
  const active = scoped[activeIndex];

  useEffect(() => {
    setActiveIndex(0);
  }, [query, category]);

  useEffect(() => {
    if (category === 'all') return;
    if (!filtered.some(entry => entry.category === category)) setCategory('all');
  }, [filtered, category]);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, query, category]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'f') return;
      if (!searchRef.current) return;
      e.preventDefault();
      searchRef.current.focus();
      searchRef.current.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goMatch = (direction: 1 | -1) => {
    setActiveIndex(prev => nextHelperMatch(prev, scoped.length, direction));
  };

  const selectEntry = (entry: TemplateHelperEntry) => {
    setActiveIndex(Math.max(0, scoped.findIndex(item => item.id === entry.id)));
  };

  const copyEntry = async (entry: TemplateHelperEntry) => {
    const ok = await copyTemplateSnippet(entry.snippet);
    if (!ok) return;
    setCopiedId(entry.id);
    window.setTimeout(() => setCopiedId(current => (current === entry.id ? null : current)), 1500);
  };

  return (
    <AppModalFrame
      title={
        <div className="am-modal-title-block">
          <div className="am-modal-title">Template helpers</div>
          <div className="am-modal-subtitle">
            Every {'{{ }}'} helper the engine evaluates. Type {'{{'} in the body for autocomplete.
          </div>
        </div>
      }
      onClose={onClose}
      dialogClassName="modal am-studio-modal am-template-helpers-modal"
      overlayClassName="am-text-expand-overlay"
      bodyClassName="am-studio-modal-body am-template-helpers-body"
      footerClassName="am-studio-modal-footer"
      showExpandButton={false}
      closeOnOverlayClick={false}
      controlsClassName="am-text-expand-header-controls"
      dialogTestId="api-mock-template-helpers-modal"
      headerActions={
        <div className="api-mock-root am-in-modal am-text-expand-search-cluster" data-testid="api-mock-template-helpers-search-cluster">
          <input
            ref={searchRef}
            className="am-input am-text-expand-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              goMatch(e.shiftKey ? -1 : 1);
            }}
            placeholder="Search helpers…"
            aria-label="Search template helpers"
            data-testid="api-mock-template-helpers-search"
          />
          <span className="am-text-expand-count" data-testid="api-mock-template-helpers-count">{count}</span>
          <button
            type="button"
            className="am-icon-btn"
            onClick={() => goMatch(-1)}
            disabled={scoped.length === 0}
            data-testid="api-mock-template-helpers-prev"
            aria-label="Previous helper"
          >
            <ChevronUpIcon size={13} />
          </button>
          <button
            type="button"
            className="am-icon-btn"
            onClick={() => goMatch(1)}
            disabled={scoped.length === 0}
            data-testid="api-mock-template-helpers-next"
            aria-label="Next helper"
          >
            <ChevronDownIcon size={13} />
          </button>
        </div>
      }
      footer={
        <div className="api-mock-root am-in-modal am-modal-toolbar am-text-expand-footer">
          <span className="am-text-expand-hint">⌘F search · Enter next · Double-click insert · Esc close</span>
          <button type="button" className="am-btn" onClick={onClose} data-testid="api-mock-template-helpers-close">
            Close
          </button>
        </div>
      }
    >
      <div className="api-mock-root am-in-modal am-template-helpers-fill">
        <nav className="am-template-helpers-nav" aria-label="Helper categories" data-testid="api-mock-template-helpers-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              className="am-template-helpers-nav-btn"
              data-active={category === item.id ? 'true' : 'false'}
              aria-pressed={category === item.id}
              data-testid={`api-mock-template-helpers-cat-${item.id}`}
              onClick={() => setCategory(item.id)}
            >
              <span>{item.label}</span>
              <span className="am-template-helpers-nav-count">{item.count}</span>
            </button>
          ))}
        </nav>
        <div className="am-template-helpers-catalog" data-testid="api-mock-template-helpers-catalog">
          {scoped.length === 0 ? (
            <div className="am-empty-conditions" data-testid="api-mock-template-helpers-empty">
              No helpers match that search.
            </div>
          ) : (
            groups.map(group => (
              <section
                key={group.category}
                className="am-template-helpers-group"
                data-testid={`api-mock-template-helpers-group-${group.category}`}
              >
                <header className="am-template-helpers-heading">
                  <h4>{group.label}</h4>
                  <span className="am-template-helpers-heading-count">{group.items.length}</span>
                </header>
                <div className="am-template-helpers-grid">
                  {group.items.map(entry => {
                    const isActive = entry.id === active?.id;
                    return (
                      <div
                        key={entry.id}
                        ref={isActive ? activeRef : undefined}
                        className="am-template-helpers-card"
                        data-active={isActive ? 'true' : 'false'}
                        data-testid="api-mock-template-helpers-row"
                        data-helper-id={entry.id}
                        onClick={() => selectEntry(entry)}
                        onDoubleClick={() => onInsert(entry.snippet)}
                      >
                        <div className="am-template-helpers-name">{entry.name}</div>
                        <code className="am-template-helpers-snippet">{entry.snippet}</code>
                        <p className="am-template-helpers-detail">{entry.detail}</p>
                        <div className="am-template-helpers-actions">
                          <button
                            type="button"
                            className="am-btn small ghost"
                            data-testid="api-mock-template-helpers-copy"
                            onClick={e => { e.stopPropagation(); void copyEntry(entry); }}
                          >
                            {copiedId === entry.id ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            className="am-btn small"
                            data-testid="api-mock-template-helpers-insert"
                            onClick={e => { e.stopPropagation(); onInsert(entry.snippet); }}
                          >
                            Insert
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </AppModalFrame>
  );
}
