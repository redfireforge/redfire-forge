import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'migration-v4-notified';
const SPLIT_COUNT_KEY = 'migration-v4-split-count';

export default function MigrationBanner({ onNavigateToParamRunner }: { onNavigateToParamRunner: () => void }) {
  const [splitCount, setSplitCount] = useState<number | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const count = localStorage.getItem(SPLIT_COUNT_KEY);
    if (count && parseInt(count) > 0) {
      setSplitCount(parseInt(count));
    }
  }, []);

  if (splitCount === null) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setSplitCount(null);
  };

  return (
    <div className="migration-banner">
      <div className="migration-banner-content">
        <strong>Scenarios updated</strong> — {splitCount} mixed scenario{splitCount > 1 ? 's were' : ' was'} split
        into separate Standard and Parameterized scenarios to work with the new{' '}
        <button className="btn-link" onClick={onNavigateToParamRunner}>
          Parameterized Runner
        </button>.
      </div>
      <button className="btn btn-xs" onClick={dismiss}>Dismiss</button>
    </div>
  );
}
