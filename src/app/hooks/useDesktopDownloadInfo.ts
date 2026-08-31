import { useEffect, useState } from 'react';
import { shouldShowWebDownloadCta } from '../utils/desktopFeatureGate';
import {
  detectOSTarget,
  fetchLatestRelease,
  getDownloadUrl,
  type OSTarget,
} from '@shared/utils/latestRelease';

const FALLBACK_RELEASES_URL = 'https://github.com/redfireforge/redfireforge-public/releases';

function osDisplayName(target: OSTarget): string | null {
  if (target === 'macos-arm' || target === 'macos-x64') return 'macOS';
  if (target === 'windows-x64') return 'Windows';
  return null;
}

export function buildDownloadButtonLabel(version: string | null, target: OSTarget): string {
  if (!version) return 'Download Desktop App';
  const os = osDisplayName(target);
  return os ? `Download v${version} for ${os}` : `Download v${version}`;
}

export interface DesktopDownloadInfo {
  label: string;
  href: string;
  version: string | null;
  loading: boolean;
}

export function useDesktopDownloadInfo(): DesktopDownloadInfo {
  const [version, setVersion] = useState<string | null>(null);
  const [href, setHref] = useState(FALLBACK_RELEASES_URL);
  const [loading, setLoading] = useState(true);
  const target = detectOSTarget();

  useEffect(() => {
    if (!shouldShowWebDownloadCta()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const release = await fetchLatestRelease();
      if (cancelled) return;
      if (release) {
        setVersion(release.version);
        const assetUrl = getDownloadUrl(release.assets, target);
        setHref(assetUrl ?? release.htmlUrl ?? FALLBACK_RELEASES_URL);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [target]);

  return {
    label: buildDownloadButtonLabel(version, target),
    href,
    version,
    loading,
  };
}
