import type { ReactNode } from 'react';

export interface GqlWfSubTab {
  id: string;
  label: string;
  errorDot?: boolean;
  count?: number;
}

export function GqlWfConfigBody({
  testId,
  children,
}: {
  testId: string;
  children: ReactNode;
}) {
  return (
    <div className="wf-config-body gql-wf-config" data-testid={testId}>
      {children}
    </div>
  );
}

export function GqlWfSubTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: GqlWfSubTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div className="gql-wf-subtabs" aria-label="GraphQL node settings">
      {tabs.map(({ id, label, errorDot, count }) => (
        <button
          key={id}
          type="button"
          className={`gql-wf-subtab${activeTab === id ? ' active' : ''}`}
          onClick={() => onTabChange(id)}
        >
          <span>{label}</span>
          {errorDot && (
            <span
              className="gql-wf-subtab-dot"
              title="Validation error"
              data-testid="gql-wf-tab-error-dot"
            />
          )}
          {!errorDot && count != null && <span className="gql-wf-subtab-badge">{count}</span>}
        </button>
      ))}
    </div>
  );
}

export function GqlWfFormCard({ children }: { children: ReactNode }) {
  return <div className="gql-wf-form-card">{children}</div>;
}

export function GqlWfSectionToolbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="gql-wf-section-toolbar">
      <div className="gql-wf-section-toolbar-text">
        <h4 className="gql-wf-section-title">{title}</h4>
        {subtitle && <p className="gql-wf-section-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="gql-wf-section-toolbar-actions">{actions}</div>}
    </div>
  );
}


export function GqlWfFormRow({
  label,
  htmlFor,
  children,
  stack,
  last,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  stack?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`gql-wf-form-row${stack ? ' gql-wf-form-row--stack' : ''}${last ? ' gql-wf-form-row--last' : ''}`}>
      <label className={`gql-wf-form-label${stack ? ' gql-wf-form-label--top' : ''}`} htmlFor={htmlFor}>
        {label}
      </label>
      <div className={`gql-wf-form-ctrl${stack ? ' gql-wf-form-ctrl--stack' : ''}`}>
        {children}
      </div>
    </div>
  );
}

export function GqlWfFieldError({ children }: { children: ReactNode }) {
  return <span className="gql-wf-field-error" role="alert">{children}</span>;
}

export function GqlWfCheckboxRow({
  checked,
  onChange,
  label,
  hint,
  testId,
  last,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  testId?: string;
  last?: boolean;
}) {
  return (
    <div className={`gql-wf-checkbox-field${last ? ' gql-wf-checkbox-field--last' : ''}`}>
      <label className="gql-wf-checkbox-row">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          data-testid={testId}
        />
        <span className="gql-wf-checkbox-label">{label}</span>
      </label>
      {hint && <span className="gql-wf-checkbox-hint">{hint}</span>}
    </div>
  );
}

export function GqlWfCodeField({
  label,
  value,
  onChange,
  placeholder,
  rows = 8,
  testId,
  toolbarHint,
  toolbarAction,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  testId?: string;
  toolbarHint?: string;
  toolbarAction?: ReactNode;
  error?: ReactNode;
}) {
  return (
    <>
      <GqlWfFormRow label={label} stack>
        <div className="gql-wf-code-block">
          {(toolbarHint || toolbarAction) && (
            <div className="gql-wf-code-toolbar">
              {toolbarHint && <span className="gql-wf-code-toolbar-hint">{toolbarHint}</span>}
              {toolbarAction}
            </div>
          )}
          <textarea
            className="gql-wf-code-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            spellCheck={false}
            data-testid={testId}
          />
        </div>
      </GqlWfFormRow>
      {error && (
        <div className="gql-wf-form-row gql-wf-form-row--compact">
          <span className="gql-wf-form-label" aria-hidden="true" />
          <div className="gql-wf-form-ctrl">{error}</div>
        </div>
      )}
    </>
  );
}
