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
  /** Host → Mock Server is selected; the fixture panel is open. */
  fixtureOpen?: boolean;
  onFixtureOpenChange?: (open: boolean) => void;
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
  fixtureOpen = false,
  onFixtureOpenChange,
}: Props) {
  const radioName = `${namePrefix}-hostMode`;
  const pickHost = (mode: 'hardcoded' | 'settings' | 'custom') => {
    onFixtureOpenChange?.(false);
    onHostModeChange(mode);
  };

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
          checked={!fixtureOpen && hostMode === 'hardcoded'}
          onChange={() => pickHost('hardcoded')}
          disabled={disabled}
        />
        Original
      </label>
      <label className={`radio-label ${!resolvedBaseUrl ? 'disabled' : ''}`}>
        <input
          type="radio"
          name={radioName}
          checked={!fixtureOpen && hostMode === 'settings'}
          onChange={() => pickHost('settings')}
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
          checked={fixtureOpen}
          onChange={() => onFixtureOpenChange?.(true)}
          disabled={disabled}
          data-testid="har-host-mock"
        />
        Mock Server
      </label>
      <label className="radio-label">
        <input
          type="radio"
          name={radioName}
          checked={!fixtureOpen && hostMode === 'custom'}
          onChange={() => pickHost('custom')}
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
