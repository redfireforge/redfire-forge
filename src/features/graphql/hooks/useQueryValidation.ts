/**
 * useQueryValidation — Phase 1C addition.
 *
 * Debounce-validates the active query against the loaded GraphQL schema using
 * `graphql.validate()` and pushes Monaco editor markers (red squiggles) for
 * any semantic errors found.
 *
 * Returns the count of validation errors so the Execute button can show a
 * "⚠ N errors" badge without blocking execution (warnings only, not errors
 * from a UX perspective — the user can still run the query to see server errors).
 *
 * Design notes:
 * - Uses `useMonaco()` from @monaco-editor/react to access the Monaco instance
 *   without coupling to a specific editor mount point.
 * - Uses a 500 ms debounce to avoid validating on every keystroke.
 * - Clears markers when the schema is unloaded or the query changes to empty.
 * - Uses the 'gql-schema-validate' owner string so monaco-graphql worker markers
 *   (owner 'graphql') are not overwritten.
 */

import { useEffect, useState } from 'react';
import { useMonaco } from '@monaco-editor/react';
import { buildClientSchema, parse, validate } from 'graphql';
import type { IntrospectionQuery } from 'graphql';

const MARKER_OWNER = 'gql-schema-validate';
const DEBOUNCE_MS = 500;

export function useQueryValidation(
  query: string,
  modelUri: string,
  rawIntrospection: Record<string, unknown> | null,
  schemaLoaded: boolean,
): number {
  const monaco = useMonaco();
  const [errorCount, setErrorCount] = useState(0);

  // BUG-R1-2 fix: immediately reset the error count when the active tab changes
  // (modelUri is unique per tab). Without this, the previous tab's badge count lingers
  // for up to DEBOUNCE_MS before the new debounced validation runs.
  useEffect(() => {
    setErrorCount(0);
  }, [modelUri]);

  useEffect(() => {
    if (!monaco) return;

    // Clear stale markers immediately when schema is gone or query is empty
    if (!schemaLoaded || !rawIntrospection || !query.trim()) {
      const uri = monaco.Uri.parse(modelUri);
      const model = monaco.editor.getModel(uri);
      if (model) monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      setErrorCount(0);
      return;
    }

    const timer = setTimeout(() => {
      const uri = monaco.Uri.parse(modelUri);
      const model = monaco.editor.getModel(uri);
      if (!model) return;

      try {
        const schema = buildClientSchema(rawIntrospection as unknown as IntrospectionQuery);
        let doc;
        try {
          doc = parse(query);
        } catch {
          // Syntax errors are handled by the monaco-graphql worker — clear semantic markers
          monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
          setErrorCount(0);
          return;
        }

        const errors = validate(schema, doc);
        const markers = errors.map((err) => {
          const loc = err.locations?.[0];
          const line = loc?.line ?? 1;
          const col = loc?.column ?? 1;
          return {
            severity: monaco.MarkerSeverity.Error,
            message: err.message,
            startLineNumber: line,
            startColumn: col,
            endLineNumber: line,
            endColumn: col + 1,
            source: 'GraphQL Schema',
          };
        });

        monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
        setErrorCount(errors.length);
      } catch {
        // buildClientSchema may throw on malformed introspection — clear and ignore
        const model2 = monaco.editor.getModel(monaco.Uri.parse(modelUri));
        if (model2) monaco.editor.setModelMarkers(model2, MARKER_OWNER, []);
        setErrorCount(0);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, modelUri, rawIntrospection, schemaLoaded, monaco]);

  return errorCount;
}
