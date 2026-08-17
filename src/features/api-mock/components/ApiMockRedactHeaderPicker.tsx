import {
  defaultRedactHeaderList,
  groupRedactHeaders,
  isRedactHeaderSelected,
  toggleRedactHeader,
  type RedactHeaderCatalogEntry,
} from '../../../shared/api-mock/redactHeaderCatalog';

interface Props {
  value: string;
  onChange: (next: string) => void;
  testId?: string;
}

export function redactHeaderChipTestId(name: string): string {
  return `api-mock-redact-header-chip-${name}`;
}

/**
 * Clickable catalog of common secret headers for the comma-separated redact field.
 */
export function ApiMockRedactHeaderPicker({
  value,
  onChange,
  testId = 'api-mock-redact-header-picker',
}: Props) {
  const groups = groupRedactHeaders();

  const toggle = (entry: RedactHeaderCatalogEntry) => {
    onChange(toggleRedactHeader(value, entry.name));
  };

  return (
    <div className="am-redact-headers" data-testid={testId}>
      {groups.map(section => (
        <div key={section.group} className="am-redact-headers-group">
          <div className="am-redact-headers-group-label">{section.label}</div>
          <div className="am-redact-headers-chips" role="group" aria-label={section.label}>
            {section.entries.map(entry => {
              const selected = isRedactHeaderSelected(value, entry.name);
              return (
                <button
                  key={entry.name}
                  type="button"
                  className={`am-chip${selected ? ' active' : ''}`}
                  title={entry.detail}
                  aria-pressed={selected}
                  aria-label={`${selected ? 'Remove' : 'Add'} ${entry.label}`}
                  data-testid={redactHeaderChipTestId(entry.name)}
                  onClick={() => toggle(entry)}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="am-link-btn am-redact-headers-restore"
        data-testid="api-mock-redact-headers-restore"
        onClick={() => onChange(defaultRedactHeaderList())}
      >
        Restore defaults
      </button>
    </div>
  );
}
