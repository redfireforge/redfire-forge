/**
 * GraphqlQueryBuilder.tsx — Phase 2.1 Sprint 6 (2F-3, 2F-4, 2F-5, 2F-9)
 *
 * Visual Query Builder — orchestration component.
 *
 * Sub-components live in ./query-builder/:
 *   BuilderToolbar       — op-type switcher, op-name input, copy/execute actions
 *   FieldTree            — left panel: field selector tree with search (2F-3, 2F-4, 2F-5)
 *   GeneratedQueryPreview — center panel: live SDL + variables preview
 *   SummaryPanel         — right panel: stats, path finder, keyboard shortcuts
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphqlSchemaInfo } from '../../../shared/types/graphql';
import {
  useGraphqlQueryBuilder,
} from '../hooks/useGraphqlQueryBuilder';
import { generateQuery } from '../utils/queryBuilderGenerator';
import {
  BuilderToolbar,
  FieldTree,
  GeneratedQueryPreview,
  SummaryPanel,
} from './query-builder';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GraphqlQueryBuilderProps {
  schemaInfo:     GraphqlSchemaInfo | null;
  onEditInEditor: (sdl: string, variables: string) => void;
  onExecute:      (sdl: string, variables: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const GraphqlQueryBuilder = memo(function GraphqlQueryBuilder({
  schemaInfo,
  onEditInEditor,
  onExecute,
}: GraphqlQueryBuilderProps) {
  const builder = useGraphqlQueryBuilder();
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const { sdl, variables, variableDeclarations } = useMemo(
    () => generateQuery(builder.state, schemaInfo),
    [builder.state, schemaInfo],
  );

  const variablesJson = useMemo(
    () =>
      Object.keys(variables).length > 0 ? JSON.stringify(variables, null, 2) : '{}',
    [variables],
  );

  const actualVariablesCount = variableDeclarations.length;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sdl);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable — silent fallback
    }
  }, [sdl]);

  const handleEditInEditor = useCallback(() => {
    onEditInEditor(sdl, variablesJson);
  }, [sdl, variablesJson, onEditInEditor]);

  const handleExecute = useCallback(() => {
    onExecute(sdl, variablesJson);
  }, [sdl, variablesJson, onExecute]);

  const handleSearchExpand = useCallback(
    (paths: string[]) => {
      for (const p of paths) builder.expandPath(p);
    },
    [builder],
  );

  // Keyboard: → expands, ← collapses focused field row; Space toggles checkbox
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (!active?.closest('.gql-qb-field-tree')) return;
      if (e.key === 'ArrowRight') {
        const expandBtn = active.closest('.gql-qb-field-row')
          ?.querySelector<HTMLButtonElement>('.gql-qb-expand-btn');
        if (expandBtn && !expandBtn.classList.contains('gql-qb-expand-btn--open')) {
          expandBtn.click();
        }
      }
      if (e.key === 'ArrowLeft') {
        const expandBtn = active.closest('.gql-qb-field-row')
          ?.querySelector<HTMLButtonElement>('.gql-qb-expand-btn');
        if (expandBtn?.classList.contains('gql-qb-expand-btn--open')) {
          expandBtn.click();
        }
      }
      if (e.key === ' ') {
        const checkBtn = active.closest('.gql-qb-field-row')
          ?.querySelector<HTMLButtonElement>('.gql-qb-check');
        if (checkBtn && active !== checkBtn) {
          e.preventDefault();
          checkBtn.click();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="gql-qb" data-testid="gql-query-builder">
      <BuilderToolbar
        state={builder.state}
        schemaInfo={schemaInfo}
        selectedCount={builder.selectedCount}
        onSetOpType={builder.setOperationType}
        onSetOpName={builder.setOperationName}
        onCopy={handleCopy}
        onEditInEditor={handleEditInEditor}
        onExecute={handleExecute}
        onReset={builder.reset}
        copied={copied}
      />

      <div className="gql-qb-body">
        <FieldTree
          schemaInfo={schemaInfo}
          state={builder.state}
          onToggle={builder.toggleField}
          onToggleExpand={builder.toggleExpand}
          onSelectAll={builder.selectPaths}
          onDeselectAll={builder.deselectPaths}
          onSetArg={builder.setArgValue}
          onSetSearch={builder.setSearchQuery}
          onSearchExpand={handleSearchExpand}
        />

        <GeneratedQueryPreview sdl={sdl} variables={variables} />

        <SummaryPanel
          selectedCount={builder.selectedCount}
          maxDepth={builder.maxDepth}
          argsCount={builder.argsCount}
          variablesCount={actualVariablesCount}
          schemaInfo={schemaInfo}
          state={builder.state}
          onSetSearch={builder.setSearchQuery}
          onSearchExpand={handleSearchExpand}
        />
      </div>
    </div>
  );
});
