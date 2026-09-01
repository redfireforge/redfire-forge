import { useState, useEffect } from 'react';
import { readKey, writeKey } from '../../shared/utils/storage';

const TALLY_URL = 'https://tally.so/r/1AaNzQ';
const STORAGE_KEY = 'cloud-waitlist-dismissed';

export function AppCloudWaitlistBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    readKey(STORAGE_KEY).then((val) => setDismissed(val === 'true'));
  }, []);

  const dismiss = () => {
    setDismissed(true);
    writeKey(STORAGE_KEY, 'true');
  };

  if (dismissed !== false) return null;

  return (
    <div className="waitlist-banner" role="status" aria-label="RedfireForge Cloud waitlist">
      <span className="waitlist-banner__icon" aria-hidden>☁️</span>
      <span className="waitlist-banner__text">
        <strong>RedfireForge Cloud</strong> is coming — hosted testing, team workspaces &amp; CI integration.
      </span>
      <a
        className="waitlist-banner__cta"
        href={`${TALLY_URL}?source=in-app`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Join the waitlist →
      </a>
      <button
        className="waitlist-banner__dismiss"
        onClick={dismiss}
        aria-label="Dismiss waitlist banner"
      >
        ✕
      </button>
    </div>
  );
}
