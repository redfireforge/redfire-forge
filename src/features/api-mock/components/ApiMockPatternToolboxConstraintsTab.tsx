import type { Dispatch, SetStateAction } from 'react';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import type { ApiMockPredicateV1 } from '../../../shared/api-mock/contracts';
import {
  CONSTRAINT_OPERATOR_OPTIONS,
  CONSTRAINT_SOURCE_OPTIONS,
  type ConstraintDraft,
} from './apiMockPatternToolboxConstants';

interface ApiMockPatternToolboxConstraintsTabProps {
  constraints: ConstraintDraft[];
  setConstraints: Dispatch<SetStateAction<ConstraintDraft[]>>;
}

export function ApiMockPatternToolboxConstraintsTab({
  constraints,
  setConstraints,
}: ApiMockPatternToolboxConstraintsTabProps) {
  return (
    <div className="am-tool-editor am-tool-editor--solo">
      <div className="am-notice">
        <span>Compose query, header, and cookie constraints without writing syntax. They are added as Match conditions on the rule.</span>
      </div>

      <div className="am-tool-block">
        <div className="am-tool-block-head">
          <h3 className="am-tool-block-title">
            Constraints
            <span className="am-count-badge">{constraints.length}</span>
          </h3>
          <button
            type="button"
            className="am-btn small ghost"
            data-testid="api-mock-toolbox-add-constraint"
            onClick={() => setConstraints(prev => [
              ...prev,
              { id: `c-${crypto.randomUUID().slice(0, 8)}`, source: 'header', selector: '', operator: 'exact', expected: '' },
            ])}
          >+ Constraint</button>
        </div>

        <div className="am-constraint-list">
          {constraints.map(c => (
            <div
              key={c.id}
              className="am-matcher-row am-constraint-row"
              data-testid={`api-mock-toolbox-constraint-${c.id}`}
            >
              <CustomSelect
                value={c.source}
                onChange={v => setConstraints(prev => prev.map(x => x.id === c.id ? { ...x, source: v as ConstraintDraft['source'] } : x))}
                options={CONSTRAINT_SOURCE_OPTIONS}
                size="sm"
                className="am-cs"
                aria-label="Constraint source"
                data-testid={`api-mock-toolbox-constraint-source-${c.id}`}
              />
              <input
                className="am-input mono"
                placeholder="X-Tenant"
                value={c.selector}
                aria-label="Constraint name"
                data-testid={`api-mock-toolbox-constraint-name-${c.id}`}
                onChange={e => setConstraints(prev => prev.map(x => x.id === c.id ? { ...x, selector: e.target.value } : x))}
              />
              <CustomSelect
                value={c.operator}
                onChange={v => setConstraints(prev => prev.map(x => x.id === c.id ? { ...x, operator: v as ApiMockPredicateV1['operator'] } : x))}
                options={CONSTRAINT_OPERATOR_OPTIONS}
                size="sm"
                className="am-cs"
                aria-label="Constraint operator"
                data-testid={`api-mock-toolbox-constraint-operator-${c.id}`}
              />
              <input
                className="am-input mono"
                placeholder="{{tenant}}"
                value={c.expected}
                disabled={c.operator === 'present' || c.operator === 'absent'}
                aria-label="Constraint value"
                data-testid={`api-mock-toolbox-constraint-value-${c.id}`}
                onChange={e => setConstraints(prev => prev.map(x => x.id === c.id ? { ...x, expected: e.target.value } : x))}
              />
              <button
                type="button"
                className="am-icon-btn"
                aria-label="Remove constraint"
                title="Remove constraint"
                data-testid={`api-mock-toolbox-constraint-remove-${c.id}`}
                onClick={() => setConstraints(prev => prev.filter(x => x.id !== c.id))}
              >×</button>
            </div>
          ))}
        </div>

        {constraints.every(c => !c.selector.trim()) && (
          <div className="am-hint am-hint--wrap">
            Name at least one header, query, or cookie key to apply these as match conditions.
          </div>
        )}
      </div>
    </div>
  );
}
