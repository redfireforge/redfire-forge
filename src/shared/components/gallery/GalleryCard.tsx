import type { GalleryEntry } from '../../../data/galleries/types';
import type { GallerySampleStatus } from '../../../features/gallery/types';
import { DifficultyDots } from './DifficultyDots';
import { LiveApiBadge } from './LiveApiBadge';
import { DomainBadge } from './DomainBadge';

interface GalleryCardProps<T = unknown> {
  entry: GalleryEntry<T>;
  selected?: boolean;
  /** When true, shows the domain badge on the card (useful in "All" view). */
  showDomain?: boolean;
  onClick?: (entry: GalleryEntry<T>) => void;
  /** Import status for this sample. */
  sampleStatus?: GallerySampleStatus;
}

/**
 * Base gallery card — works for any domain.
 *
 * Renders: icon, name, description, tags, difficulty dots, live-API badge(s).
 * Domain-specific details are handled by the detail panel, not the card.
 */
export function GalleryCard<T = unknown>({
  entry,
  selected = false,
  showDomain = false,
  onClick,
  sampleStatus,
}: GalleryCardProps<T>) {
  return (
    <button
      className={`gallery-card${selected ? ' gallery-card-selected' : ''}${sampleStatus ? ` gallery-card-${sampleStatus}` : ''}`}
      data-domain={entry.domain}
      onClick={() => onClick?.(entry)}
      type="button"
    >
      <div className="gallery-card-top">
        <div className="gallery-card-icon">{entry.icon}</div>
        <div className="gallery-card-body">
          <div className="gallery-card-name">
            {entry.name}
            {sampleStatus && (
              <span className={`gallery-card-status-badge gallery-status-${sampleStatus}`}>
                {sampleStatus === 'imported' ? '✓ Loaded' : '↻ Updated'}
              </span>
            )}
          </div>
          <div className="gallery-card-desc">{entry.description}</div>
        </div>
      </div>

      <div className="gallery-card-tags">
        {entry.tags.includes('versioning-tutorial') && (
          <span className="gallery-tag gallery-tag-tutorial">📖 versioning-tutorial</span>
        )}
        {entry.tags.filter(t => t !== 'versioning-tutorial').slice(0, entry.tags.includes('versioning-tutorial') ? 3 : 4).map(tag => (
          <span key={tag} className="gallery-tag">#{tag}</span>
        ))}
      </div>

      <div className="gallery-card-meta">
        {showDomain && <DomainBadge domain={entry.domain} />}
        {entry.liveApis.length > 0 && (
          <LiveApiBadge api={entry.liveApis[0]} />
        )}
        <span className="gallery-meta-spacer" />
        <DifficultyDots level={entry.difficulty} />
      </div>
    </button>
  );
}
