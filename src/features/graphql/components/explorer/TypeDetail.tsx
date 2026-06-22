/**
 * TypeDetail.tsx — detail panel for a selected type in the Schema Explorer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphqlTypeNode } from '../../../../shared/types/graphql';
import { tokenizeSDL } from '../../utils/sdlTokenizer';
import { KIND_CSS, KIND_LABEL } from '../../utils/schemaExplorerUtils';
import { FieldTableRow } from './FieldTableRow';

export type DetailTab = 'fields' | 'sdl';

interface TypeDetailProps {
  type: GraphqlTypeNode;
  detailTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  navigableTypes: Set<string>;
  onSelectType: (name: string) => void;
  /** Optional: insert a field into the active query editor */
  onInsertField?: (fieldName: string, fieldType: string, hasArgs: boolean) => void;
}

function NavigableList({
  items,
  navigableTypes,
  onSelectType,
  label,
  entityLabel,
}: {
  items: string[];
  navigableTypes: Set<string>;
  onSelectType: (name: string) => void;
  label: string;
  entityLabel: string;
}) {
  return (
    <div className="gql-se-detail-implements">
      <span className="gql-se-impl-label">{label}</span>
      {items.map((item, idx) => (
        <span key={item}>
          {navigableTypes.has(item) ? (
            <button
              type="button"
              className="gql-se-impl-link gql-se-impl-link--btn"
              onClick={() => onSelectType(item)}
              title={`Navigate to ${item}`}
              aria-label={`Navigate to ${entityLabel} ${item}`}
            >
              {item}
            </button>
          ) : (
            <span className="gql-se-impl-link">{item}</span>
          )}
          {idx < items.length - 1 && <span className="gql-se-impl-sep">,</span>}
        </span>
      ))}
    </div>
  );
}

export function TypeDetail({
  type,
  detailTab,
  onTabChange,
  navigableTypes,
  onSelectType,
  onInsertField,
}: TypeDetailProps) {
  const fieldCount =
    type.fields?.length ?? type.enumValues?.length ?? type.possibleTypes?.length ?? 0;
  const fieldsLabel = type.kind === 'ENUM' ? 'Values' : type.kind === 'UNION' ? 'Types' : 'Fields';

  const sdlTokens = useMemo(
    () => (type.sdlFragment ? tokenizeSDL(type.sdlFragment) : null),
    [type.sdlFragment],
  );

  const [sdlCopied, setSdlCopied] = useState(false);
  const sdlCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (sdlCopyTimerRef.current) clearTimeout(sdlCopyTimerRef.current); }, []);

  const handleCopySDL = useCallback(() => {
    if (!type.sdlFragment) return;
    void navigator.clipboard.writeText(type.sdlFragment).then(() => {
      setSdlCopied(true);
      if (sdlCopyTimerRef.current) clearTimeout(sdlCopyTimerRef.current);
      sdlCopyTimerRef.current = setTimeout(() => setSdlCopied(false), 1500);
    }).catch(() => { /* clipboard permission denied or unavailable */ });
  }, [type.sdlFragment]);

  return (
    <div className="gql-se-detail" data-testid="gql-se-type-detail">
      <div className="gql-se-detail-header">
        <div className="gql-se-detail-title-row">
          <h2 className="gql-se-detail-name">{type.name}</h2>
          <span className={`gql-se-detail-badge ${KIND_CSS[type.kind]}`}>
            {KIND_LABEL[type.kind]} Type
          </span>
        </div>
        {type.description && (
          <p className="gql-se-detail-desc">{type.description}</p>
        )}
        {type.interfaces && type.interfaces.length > 0 && (
          <NavigableList
            items={type.interfaces}
            navigableTypes={navigableTypes}
            onSelectType={onSelectType}
            label="Implements:"
            entityLabel="interface"
          />
        )}
        {type.possibleTypes && type.possibleTypes.length > 0 && (
          <NavigableList
            items={type.possibleTypes}
            navigableTypes={navigableTypes}
            onSelectType={onSelectType}
            label={type.kind === 'UNION' ? 'Union of:' : 'Implemented by:'}
            entityLabel="type"
          />
        )}
      </div>

      <div className="gql-se-detail-tabs" role="tablist" aria-label={`${type.name} detail`}>
        <button
          id={`gql-se-dtab-${type.name}-fields`}
          type="button"
          role="tab"
          aria-selected={detailTab === 'fields'}
          aria-controls={`gql-se-dtabpanel-${type.name}-fields`}
          className={`gql-se-detail-tab${detailTab === 'fields' ? ' gql-se-detail-tab--active' : ''}`}
          onClick={() => onTabChange('fields')}
          data-testid="gql-se-dtab-fields"
        >
          {fieldsLabel} ({fieldCount})
        </button>
        <button
          id={`gql-se-dtab-${type.name}-sdl`}
          type="button"
          role="tab"
          aria-selected={detailTab === 'sdl'}
          aria-controls={`gql-se-dtabpanel-${type.name}-sdl`}
          className={`gql-se-detail-tab${detailTab === 'sdl' ? ' gql-se-detail-tab--active' : ''}`}
          onClick={() => onTabChange('sdl')}
          data-testid="gql-se-dtab-sdl"
        >
          SDL
        </button>
      </div>

      {detailTab === 'fields' && (
        <div
          id={`gql-se-dtabpanel-${type.name}-fields`}
          className="gql-se-detail-content"
          role="tabpanel"
          aria-labelledby={`gql-se-dtab-${type.name}-fields`}
        >
          {type.fields && type.fields.length > 0 && (
            <div className="gql-se-fields-scroll">
            <table className="gql-se-fields-table">
              <thead>
                <tr>
                  <th className="gql-se-fth" scope="col">Field</th>
                  <th className="gql-se-fth" scope="col">Type</th>
                  <th className="gql-se-fth" scope="col">Arguments</th>
                  <th className="gql-se-fth" scope="col">Description</th>
                  {onInsertField && <th className="gql-se-fth gql-se-fth--try" scope="col" />}
                </tr>
              </thead>
              <tbody>
                {type.fields.map((f) => (
                  <FieldTableRow
                    key={f.name}
                    field={f}
                    navigableTypes={navigableTypes}
                    onSelectType={onSelectType}
                    onInsertField={onInsertField}
                  />
                ))}
              </tbody>
            </table>
            </div>
          )}

          {type.enumValues && type.enumValues.length > 0 && (
            <div className="gql-se-enum-values">
              {type.enumValues.map((v) => (
                <div key={v} className="gql-se-enum-value">{v}</div>
              ))}
            </div>
          )}

          {type.kind === 'UNION' && type.possibleTypes && type.possibleTypes.length > 0 && (
            <div className="gql-se-enum-values">
              {type.possibleTypes.map((pt) => (
                navigableTypes.has(pt) ? (
                  <button
                    key={pt}
                    type="button"
                    className="gql-se-enum-value gql-se-enum-value--type gql-se-enum-value--type-btn"
                    onClick={() => onSelectType(pt)}
                    title={`Navigate to ${pt}`}
                    aria-label={`Navigate to type ${pt}`}
                  >
                    {pt}
                  </button>
                ) : (
                  <div key={pt} className="gql-se-enum-value gql-se-enum-value--type">{pt}</div>
                )
              ))}
            </div>
          )}

          {type.kind === 'SCALAR' && !type.fields && (
            <div className="gql-se-scalar-note">
              Custom scalar — see the <strong>SDL</strong> tab for its definition.
            </div>
          )}

          {type.kind !== 'SCALAR' &&
           (!type.fields || type.fields.length === 0) &&
           (!type.enumValues || type.enumValues.length === 0) &&
           (!type.possibleTypes || type.possibleTypes.length === 0) && (
            <div className="gql-se-scalar-note">
              This type has no fields defined — see the <strong>SDL</strong> tab for its full definition.
            </div>
          )}
        </div>
      )}

      {detailTab === 'sdl' && (
        <div
          id={`gql-se-dtabpanel-${type.name}-sdl`}
          className="gql-se-detail-content gql-se-detail-content--sdl"
          role="tabpanel"
          aria-labelledby={`gql-se-dtab-${type.name}-sdl`}
        >
          {sdlTokens ? (
            <>
              <div className="gql-se-sdl-toolbar">
                <span className="gql-se-sdl-toolbar-label">SDL Definition</span>
                <button
                  type="button"
                  className={`gql-se-sdl-copy-btn${sdlCopied ? ' gql-se-sdl-copy-btn--copied' : ''}`}
                  onClick={handleCopySDL}
                  aria-label={sdlCopied ? 'Copied to clipboard' : 'Copy SDL to clipboard'}
                  data-testid="gql-se-copy-sdl-btn"
                >
                  {sdlCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="gql-se-sdl-pre-wrap" tabIndex={0}>
                <pre className="gql-se-sdl-fragment" aria-label="SDL definition">
                  {sdlTokens.map((token, i) => (
                    <span key={i} className={token.cls}>{token.text}</span>
                  ))}
                </pre>
              </div>
            </>
          ) : (
            <div className="gql-se-scalar-note gql-se-sdl-unavailable">
              SDL definition not available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
