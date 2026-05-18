import { useState, useEffect, useCallback } from 'react';
import { readKey, writeKey } from '../../../shared/utils/storage';
import type { WhatsNewItem } from '../hooks/useWhatsNew';

const DISMISSED_KEY = 'perf-test-whats-new-dismissed';

interface Props {
  items: WhatsNewItem[];
  displayedItems: WhatsNewItem[];
  counts: { newCount: number; updatedCount: number; total: number };
  isExpanded: boolean;
  showAll: boolean;
  hasMore: boolean;
  onToggleExpanded: () => void;
  onToggleShowAll: () => void;
  onItemClick?: (manualPath: string) => void;
}

export function WhatsNewBanner({
  items,
  displayedItems,
  counts,
  isExpanded,
  showAll,
  hasMore,
  onToggleExpanded,
  onToggleShowAll,
  onItemClick,
}: Props) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [, setDismissedTimestamp] = useState<number | null>(null);

  // Load dismissed state on mount
  useEffect(() => {
    let cancelled = false;
    readKey(DISMISSED_KEY).then(raw => {
      if (cancelled) return;
      if (raw) {
        try {
          const data = JSON.parse(raw) as { timestamp: number };
          setDismissedTimestamp(data.timestamp);
          // Check if any item is newer than the dismissed timestamp
          const hasNewerContent = items.some(item => item.timestamp > data.timestamp);
          setIsDismissed(!hasNewerContent);
        } catch {
          setIsDismissed(false);
        }
      }
    });
    return () => { cancelled = true; };
  }, [items]);

  // Dismiss the banner
  const handleDismiss = useCallback(() => {
    const now = Date.now();
    setIsDismissed(true);
    setDismissedTimestamp(now);
    writeKey(DISMISSED_KEY, JSON.stringify({ timestamp: now }));
  }, []);

  // Don't show if dismissed and no newer content
  if (isDismissed || counts.total === 0) {
    return null;
  }

  return (
    <section className="training-whats-new">
      <div className="training-whats-new-header">
        <div className="training-whats-new-title">
          <span className="training-whats-new-icon">🆕</span>
          <span>What's New</span>
          <span className="training-whats-new-badge">{counts.total} items</span>
        </div>
        <div className="training-whats-new-actions">
          <button
            className="training-whats-new-toggle"
            onClick={onToggleExpanded}
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Hide ▲' : 'Show ▼'}
          </button>
          <button
            className="training-whats-new-dismiss"
            onClick={handleDismiss}
            title="Dismiss until new content arrives"
            aria-label="Dismiss What's New banner"
          >
            ✕
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="training-whats-new-list">
          {displayedItems.map((item, idx) => (
            <a
              key={idx}
              className="training-whats-new-item"
              href={`/docs/training-manuals/${item.metadata.manualPath}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onItemClick?.(item.metadata.manualPath)}
            >
              <div className="training-whats-new-item-icon">{item.pathIcon}</div>
              <div className="training-whats-new-item-info">
                <div className="training-whats-new-item-title">{item.manual.title}</div>
                <div className="training-whats-new-item-meta">
                  <span className={`training-badge training-badge-${item.type}`}>
                    {item.type === 'new' ? 'NEW' : 'UPDATED'}
                  </span>
                  <span>{item.pathName} • {item.manual.difficulty}</span>
                </div>
              </div>
            </a>
          ))}
          {hasMore && (
            <button
              className="training-whats-new-show-all"
              onClick={onToggleShowAll}
            >
              {showAll ? 'Show less' : `Show all ${counts.total} items`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
