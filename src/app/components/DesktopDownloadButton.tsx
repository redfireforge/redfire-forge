import { shouldShowWebDownloadCta } from '../utils/desktopFeatureGate';
import { useDesktopDownloadInfo } from '../hooks/useDesktopDownloadInfo';

/**
 * Persistent header CTA — hosted web only (never localhost / Tauri).
 */
export function DesktopDownloadButton() {
  const show = shouldShowWebDownloadCta();
  const { label, href, loading } = useDesktopDownloadInfo();

  if (!show) return null;

  return (
    <a
      className="desktop-download-btn"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="desktop-download-btn"
      title={label}
      aria-busy={loading || undefined}
    >
      <span className="desktop-download-btn__icon" aria-hidden>↓</span>
      <span className="desktop-download-btn__label">{label}</span>
    </a>
  );
}
