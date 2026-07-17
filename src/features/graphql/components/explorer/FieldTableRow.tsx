/**
 * FieldTableRow.tsx — single row in the schema explorer's fields table.
 *
 * Re-evaluation round 2: Added "Try →" button (mockup requirement) so users
 * can insert a field into the active query editor directly from the schema.
 */

import type { GraphqlFieldNode } from '../../../../shared/types/graphql';
import { extractTypeName } from '../../utils/schemaExplorerUtils';

interface FieldTableRowProps {
  field: GraphqlFieldNode;
  navigableTypes: Set<string>;
  onSelectType: (name: string) => void;
  /** Called when the user clicks "Try →" to insert the field into the active editor. */
  onInsertField?: (fieldName: string, fieldType: string, hasArgs: boolean) => void;
}

export function FieldTableRow({ field, navigableTypes, onSelectType, onInsertField }: FieldTableRowProps) {
  const bareTypeName = extractTypeName(field.type);
  const isNavigable = navigableTypes.has(bareTypeName);
  const hasArgs = !!(field.args && field.args.length > 0);

  return (
    <tr className={`gql-se-ftr${field.isDeprecated ? ' gql-se-ftr--deprecated' : ''}`} data-testid={`gql-field-row-${field.name}`}>
      <td className="gql-se-ftd gql-se-ftd--name">
        <span className={field.isDeprecated ? 'gql-se-fname--deprecated' : 'gql-se-fname'}>
          {field.name}
        </span>
        {field.isDeprecated && (
          <span
            className="gql-se-deprecated-tag"
            title={field.deprecationReason ?? 'Deprecated'}
            aria-label={`Deprecated${field.deprecationReason ? `: ${field.deprecationReason}` : ''}`}
          >
            @deprecated
          </span>
        )}
      </td>
      <td className="gql-se-ftd gql-se-ftd--type">
        {isNavigable ? (
          <button
            type="button"
            className="gql-se-ftype gql-se-ftype--link"
            onClick={() => onSelectType(bareTypeName)}
            title={`Navigate to ${bareTypeName}`}
            aria-label={`Navigate to type ${bareTypeName}`}
          >
            {field.type}
          </button>
        ) : (
          <span className="gql-se-ftype">{field.type}</span>
        )}
      </td>
      <td className="gql-se-ftd gql-se-ftd--args">
        {field.args && field.args.length > 0 ? (
          <div className="gql-se-args-list">
            {field.args.map((arg) => (
              <div key={arg.name} className="gql-se-arg-row">
                <span className="gql-se-arg-name">{arg.name}</span>
                <span className="gql-se-arg-colon">:</span>
                <span className="gql-se-arg-type">{arg.type}</span>
                {arg.defaultValue !== undefined && (
                  <span className="gql-se-arg-default">= {arg.defaultValue}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span className="gql-se-ftd--dash">—</span>
        )}
      </td>
      <td className="gql-se-ftd gql-se-ftd--desc">
        {field.description && <span className="gql-se-fdesc">{field.description}</span>}
      </td>
      {onInsertField && (
        <td className="gql-se-ftd gql-se-ftd--try">
          <button
            type="button"
            className="gql-se-try-btn"
            onClick={() => onInsertField(field.name, field.type, hasArgs)}
            title={`Insert "${field.name}" into query editor`}
            aria-label={`Try field ${field.name} — insert into query editor`}
            data-testid={`gql-try-field-${field.name}`}
          >
            Try →
          </button>
        </td>
      )}
    </tr>
  );
}
