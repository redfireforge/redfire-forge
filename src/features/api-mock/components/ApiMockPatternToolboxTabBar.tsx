import type { ToolTab } from './apiMockPatternToolboxConstants';

interface Props {
  visibleTabs: ReadonlyArray<readonly [ToolTab, string]>;
  tab: ToolTab;
  onSelect: (next: ToolTab) => void;
}

export function ApiMockPatternToolboxTabBar({ visibleTabs, tab, onSelect }: Props) {
  if (visibleTabs.length <= 1) return null;

  return (
    <div className="am-builder-tabs am-pattern-tabs" role="tablist" aria-label="Pattern toolbox sections">
      {visibleTabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          className={`am-builder-tab${tab === id ? ' active' : ''}`}
          data-testid={`api-mock-toolbox-tab-${id}`}
          onClick={() => onSelect(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
