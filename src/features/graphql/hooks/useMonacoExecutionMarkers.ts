/**
 * useMonacoExecutionMarkers — sets Monaco editor error markers based on
 * GraphQL execution errors returned from the server.
 *
 * Extracted from GraphqlStudioPage.tsx to reduce its line count.
 */
import { useEffect } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { GraphqlResponse } from '@shared/types/graphql';

const EXEC_MARKER_OWNER = 'gql-execution';

export function useMonacoExecutionMarkers(
  response: GraphqlResponse | null | undefined,
  monacoInstance: Monaco | null | undefined,
  responseModelUriRef: React.MutableRefObject<string>,
): void {
  useEffect(() => {
    if (!monacoInstance) return;
    const ownerUri = responseModelUriRef.current;
    if (!ownerUri) return;
    let model: ReturnType<typeof monacoInstance.editor.getModel>;
    try {
      model = monacoInstance.editor.getModel(monacoInstance.Uri.parse(ownerUri));
    } catch { return; }
    if (!model) return;

    if (response?.errors && response.errors.length > 0) {
      const lineCount = model.getLineCount();
      const markers = response.errors
        .filter((e) => e.locations && e.locations.length > 0)
        .flatMap((e) =>
          (e.locations ?? [])
            .filter((loc) => loc.line >= 1 && loc.line <= lineCount)
            .map((loc) => {
              const lineLen = model.getLineLength(loc.line) ?? 0;
              return {
                severity: monacoInstance.MarkerSeverity.Error,
                startLineNumber: loc.line,
                startColumn: loc.column,
                endLineNumber: loc.line,
                endColumn: Math.max(loc.column + 1, lineLen + 1),
                message: e.message,
                source: 'GraphQL Server',
              };
            }),
        );
      monacoInstance.editor.setModelMarkers(model, EXEC_MARKER_OWNER, markers);
    } else {
      monacoInstance.editor.setModelMarkers(model, EXEC_MARKER_OWNER, []);
    }
  }, [response, monacoInstance, responseModelUriRef]);
}
