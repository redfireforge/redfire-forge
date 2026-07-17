import { memo, useCallback } from 'react';
import type { GraphqlTypeNode } from '../../../../shared/types/graphql';
import type { FieldPath } from '../../hooks/useGraphqlQueryBuilder';
import { stripTypeModifiers } from '../../utils/queryBuilderGenerator';

export interface ArgInputProps {
  fieldPath: FieldPath;
  argName:   string;
  argType:   string;
  value:     string;
  types:     GraphqlTypeNode[];
  onChange:  (v: string) => void;
}

export const ArgInput = memo(function ArgInput({
  fieldPath, argName, argType, value, types, onChange,
}: ArgInputProps) {
  const baseType   = stripTypeModifiers(argType);
  const isRequired = argType.endsWith('!');
  const enumNode   = types.find((t) => t.name === baseType && t.kind === 'ENUM');
  const isBoolean  = baseType === 'Boolean';
  const isNumeric  = baseType === 'Int' || baseType === 'Float';

  const setVar = useCallback(() => {
    if (value.startsWith('{{') && value.endsWith('}}')) {
      onChange('');
    } else {
      const safe = argName.replace(/[^a-zA-Z0-9_]/g, '_');
      onChange(`{{${safe}}}`);
    }
  }, [value, argName, onChange]);

  const isVarRef = (value.startsWith('{{') && value.endsWith('}}')) ||
                   value.startsWith('$');

  return (
    <div className="gql-qb-arg-row" data-testid={`gql-qb-arg-${fieldPath}-${argName}`}>
      <span className="gql-qb-arg-name">{argName}:</span>

      {isVarRef ? (
        <input
          type="text"
          className="gql-qb-arg-input gql-qb-arg-input--var"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="{{variable}}"
          aria-label={`${argName} variable reference`}
          spellCheck={false}
        />
      ) : enumNode ? (
        <select
          className="gql-qb-arg-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${argName} value`}
        >
          <option value="">(any)</option>
          {enumNode.enumValues?.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ) : isBoolean ? (
        <select
          className="gql-qb-arg-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${argName} value`}
        >
          <option value="">(any)</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          type={isNumeric ? 'number' : 'text'}
          className="gql-qb-arg-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isRequired ? 'required' : 'optional'}
          aria-label={`${argName} value`}
          spellCheck={false}
        />
      )}

      <span className="gql-qb-arg-type" title={argType}>{argType}</span>

      <button
        type="button"
        className={`gql-qb-arg-var-btn${isVarRef ? ' gql-qb-arg-var-btn--active' : ''}`}
        onClick={setVar}
        title={isVarRef ? 'Remove variable reference' : 'Use environment variable'}
        aria-label={isVarRef ? 'Remove variable reference' : 'Use environment variable'}
      >
        {'{{}}'}
      </button>
    </div>
  );
});
