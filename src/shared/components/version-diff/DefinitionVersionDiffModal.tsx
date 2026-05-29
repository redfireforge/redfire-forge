import type { ReactNode } from 'react';

export interface DefinitionVersionDiffModalProps {
  title: string;
  olderLabel: string;
  newerLabel: string;
  onClose: () => void;
  tabs: Array<{ id: string; label: string; count: number }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
  className?: string;
}

export function DefinitionVersionDiffModal({
  title,
  olderLabel,
  newerLabel,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  children,
  className = 'test-def-diff',
}: DefinitionVersionDiffModalProps) {
  return (
    <div className={`${className}-overlay modal-overlay`} onClick={onClose}>
      <div className={`${className}-modal`} onClick={(e) => e.stopPropagation()}>
        <div className={`${className}-header`}>
          <h3>{title}</h3>
          <span className={`${className}-range`}>
            {olderLabel} → {newerLabel}
          </span>
          <button className="btn btn-sm" onClick={onClose}>×</button>
        </div>

        <div className={`${className}-tabs`}>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`${className}-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
              {t.count > 0 && <span className={`${className}-tab-count`}>{t.count}</span>}
            </button>
          ))}
        </div>

        <div className={`${className}-body`}>
          {children}
        </div>
      </div>
    </div>
  );
}
