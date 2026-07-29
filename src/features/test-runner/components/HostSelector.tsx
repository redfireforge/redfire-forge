interface Props {
  hostMode: 'hardcoded' | 'settings' | 'custom';
  onHostModeChange: (mode: 'hardcoded' | 'settings' | 'custom') => void;
  customBaseUrl: string;
  onCustomBaseUrlChange: (url: string) => void;
  resolvedBaseUrl?: string;
  disabled?: boolean;
  /** If true, show gallery hint instead of host selector */
  isGalleryEnv?: boolean;
  /**
   * Unique radio `name` prefix — required because Test Runner and Parameterized
   * Runner stay mounted together; shared `name="hostMode"` merges them into one
   * browser radio group and breaks selection.
   */
  namePrefix?: string;
}

export default function HostSelector({
  hostMode,
  onHostModeChange,
  customBaseUrl,
  onCustomBaseUrlChange,
  resolvedBaseUrl,
  disabled = false,
  isGalleryEnv = false,
  namePrefix = 'runner',
}: Props) {
  const radioName = `${namePrefix}-hostMode`;

  if (isGalleryEnv) {
    return (
      <div className="runner-host-selector" data-testid="har-host-selector">
        <span className="runner-host-label">Host:</span>
        <span className="runner-host-gallery-hint">🏪 Gallery samples use their own hardcoded URLs — no host override needed</span>
      </div>
    );
  }

  return (
    <div className="runner-host-selector" data-testid="har-host-selector">
      <span className="runner-host-label">Host:</span>
      <label className="radio-label">
        <input
          type="radio"
          name={radioName}
          checked={hostMode === 'hardcoded'}
          onChange={() => onHostModeChange('hardcoded')}
          disabled={disabled}
        />
        Original
      </label>
      <label className={`radio-label ${!resolvedBaseUrl ? 'disabled' : ''}`}>
        <input
          type="radio"
          name={radioName}
          checked={hostMode === 'settings'}
          onChange={() => onHostModeChange('settings')}
          disabled={disabled || !resolvedBaseUrl}
        />
        Settings
        {resolvedBaseUrl
          ? <code className="runner-host-url">{resolvedBaseUrl}</code>
          : <span className="option-hint"> — configure base URL in Settings first</span>
        }
      </label>
      <label className="radio-label">
        <input
          type="radio"
          name={radioName}
          checked={hostMode === 'custom'}
          onChange={() => onHostModeChange('custom')}
          disabled={disabled}
        />
        Custom
      </label>
      <input
        className="runner-custom-url-input"
        type="text"
        value={customBaseUrl}
        onChange={(e) => onCustomBaseUrlChange(e.target.value)}
        placeholder="https://my-host.example.com:8080"
        disabled={disabled || hostMode !== 'custom'}
      />
    </div>
  );
}
