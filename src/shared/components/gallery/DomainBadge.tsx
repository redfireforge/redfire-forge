import type { GalleryDomain } from '../../../data/galleries/types';
import { galleryDomainMap } from '../../../data/galleries/registry';

interface DomainBadgeProps {
  domain: GalleryDomain;
  className?: string;
}

const DOMAIN_COLORS: Record<GalleryDomain, string> = {
  requests: '#60a5fa',
  catalog: '#a78bfa',
  harness: '#34d399',
  workflows: '#fb923c',
  'api-mock': '#fbbf24',
  kafka: '#f97316',
  websocket: '#2dd4bf',
  sse: '#6ee7b7',
  graphql: '#e879f9',
  grpc: '#818cf8',
};

/**
 * Colored pill badge for a gallery domain (e.g. "📡 Requests").
 */
export function DomainBadge({ domain, className = '' }: DomainBadgeProps) {
  const config = galleryDomainMap.get(domain);
  const label = config?.label ?? domain;
  const icon = config?.icon ?? '📦';
  const color = DOMAIN_COLORS[domain] ?? '#888';

  return (
    <span
      className={`gallery-domain-badge ${className}`.trim()}
      style={{ '--domain-color': color } as React.CSSProperties}
      data-domain={domain}
    >
      <span className="gallery-domain-badge-icon">{icon}</span>
      {label}
    </span>
  );
}
