import { memo, useMemo } from 'react';
import { tokenizeSDL } from '../../utils/sdlTokenizer';

export interface GeneratedQueryPreviewProps {
  sdl:       string;
  variables: Record<string, unknown>;
}

export const GeneratedQueryPreview = memo(function GeneratedQueryPreview({
  sdl, variables,
}: GeneratedQueryPreviewProps) {
  const varJson    = useMemo(
    () => Object.keys(variables).length > 0 ? JSON.stringify(variables, null, 2) : '',
    [variables],
  );
  const hasVars    = Object.keys(variables).length > 0;

  const tokenizedLines = useMemo(
    () => sdl.split('\n').map((line) => tokenizeSDL(line)),
    [sdl],
  );

  return (
    <div className="gql-qb-preview" data-testid="gql-qb-preview">
      <div className="gql-qb-preview-header">
        <span className="gql-qb-preview-title">Generated Query</span>
        <span className="gql-qb-preview-hint">Updates live as you select fields</span>
      </div>

      <div className="gql-qb-code-area">
        <pre className="gql-qb-code" aria-label="Generated GraphQL query" data-testid="gql-qb-code">
          {tokenizedLines.map((lineTokens, i) => (
            <div key={i} className="gql-qb-code-line">
              <span className="gql-qb-ln" aria-hidden="true">{i + 1}</span>
              {lineTokens.map((tok, j) => (
                tok.cls
                  ? <span key={j} className={tok.cls}>{tok.text}</span>
                  : <span key={j}>{tok.text}</span>
              ))}
            </div>
          ))}
        </pre>
      </div>

      {hasVars && (
        <div className="gql-qb-vars-section">
          <div className="gql-qb-vars-header">
            <span className="gql-qb-vars-title">Variables</span>
            <span className="gql-qb-vars-hint">Auto-generated from arguments</span>
          </div>
          <pre className="gql-qb-vars-body" aria-label="Generated variables JSON">
            {varJson}
          </pre>
        </div>
      )}
    </div>
  );
});
