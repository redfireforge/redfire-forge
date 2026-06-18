/**
 * useGraphqlQueryBuilder.ts — Phase 2.1 Sprint 6 (2F-1)
 *
 * State management hook for the Visual Query Builder.
 * Manages field selection, argument values, expanded/collapsed tree state,
 * and operation metadata (type + name).
 *
 * The hook is deliberately schema-agnostic: it only knows about dot-path strings.
 * Schema resolution (type traversal, leaf detection) is handled by the generator.
 */

import { useCallback, useReducer } from 'react';

// ─── State types ──────────────────────────────────────────────────────────────

/** Dot-separated path to a field. Root fields are single segments. */
export type FieldPath = string;

/**
 * Nested arg value map: fieldPath → { argName → raw value string }.
 * Raw values may be literal strings, numbers, booleans, enum names, or
 * {{varRef}} / $varRef patterns that get promoted to GraphQL variables.
 */
export type BuilderArgValues = Record<FieldPath, Record<string, string>>;

export interface BuilderState {
  operationType:  'query' | 'mutation' | 'subscription';
  operationName:  string;
  /**
   * Leaf-field paths that the user has explicitly selected (value = true).
   * Object-field paths are implicitly selected when descendants are present.
   */
  selectedFields: Record<FieldPath, boolean>;
  /**
   * Per-field argument values. Key = dot-path of the field (same as
   * selectedFields), nested value = argName → raw value string.
   */
  argValues:      BuilderArgValues;
  /**
   * Object-field paths whose children are currently expanded in the tree UI.
   * Not persisted — starts fresh each session.
   */
  expandedPaths:  ReadonlySet<string>;
  /** Free-text search query for 2F-5 schema search. */
  searchQuery:    string;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type BuilderAction =
  | { type: 'SET_OP_TYPE';       opType: 'query' | 'mutation' | 'subscription' }
  | { type: 'SET_OP_NAME';       name: string }
  | { type: 'TOGGLE_FIELD';      path: FieldPath }
  | { type: 'SELECT_PATHS';      paths: FieldPath[] }
  | { type: 'DESELECT_PATHS';    paths: FieldPath[] }
  | { type: 'SET_ARG';           fieldPath: FieldPath; argName: string; value: string }
  | { type: 'TOGGLE_EXPAND';     path: FieldPath }
  | { type: 'EXPAND_PATH';       path: FieldPath }
  | { type: 'COLLAPSE_PATH';     path: FieldPath }
  | { type: 'SET_SEARCH';        query: string }
  | { type: 'RESET' };

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: BuilderState = {
  operationType:  'query',
  operationName:  'MyQuery',
  selectedFields: {},
  argValues:      {},
  expandedPaths:  new Set<string>(),
  searchQuery:    '',
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {

    case 'SET_OP_TYPE': {
      // Auto-update the operation name if it still matches the default for the
      // previous op type (i.e. the user hasn't customised it yet).
      const OP_DEFAULTS: Record<string, string> = {
        query: 'MyQuery', mutation: 'MyMutation', subscription: 'MySubscription',
      };
      const prevDefault = OP_DEFAULTS[state.operationType];
      const nextDefault = OP_DEFAULTS[action.opType];
      const newName = state.operationName === prevDefault ? nextDefault : state.operationName;
      return {
        ...INITIAL_STATE,
        operationType: action.opType,
        operationName: newName,
      };
    }

    case 'SET_OP_NAME':
      return { ...state, operationName: action.name };

    case 'TOGGLE_FIELD': {
      const current = state.selectedFields[action.path] === true;
      const next = { ...state.selectedFields };
      if (current) {
        delete next[action.path];
      } else {
        next[action.path] = true;
      }
      return { ...state, selectedFields: next };
    }

    case 'SELECT_PATHS': {
      const next = { ...state.selectedFields };
      for (const p of action.paths) next[p] = true;
      return { ...state, selectedFields: next };
    }

    case 'DESELECT_PATHS': {
      const next = { ...state.selectedFields };
      for (const p of action.paths) delete next[p];
      return { ...state, selectedFields: next };
    }

    case 'SET_ARG': {
      const fieldArgs = { ...(state.argValues[action.fieldPath] ?? {}) };
      if (action.value === '') {
        delete fieldArgs[action.argName];
      } else {
        fieldArgs[action.argName] = action.value;
      }
      const nextArgs = { ...state.argValues };
      if (Object.keys(fieldArgs).length === 0) {
        delete nextArgs[action.fieldPath];
      } else {
        nextArgs[action.fieldPath] = fieldArgs;
      }
      return { ...state, argValues: nextArgs };
    }

    case 'TOGGLE_EXPAND': {
      const next = new Set(state.expandedPaths);
      if (next.has(action.path)) {
        next.delete(action.path);
      } else {
        next.add(action.path);
      }
      return { ...state, expandedPaths: next };
    }

    case 'EXPAND_PATH': {
      const next = new Set(state.expandedPaths);
      next.add(action.path);
      return { ...state, expandedPaths: next };
    }

    case 'COLLAPSE_PATH': {
      const next = new Set(state.expandedPaths);
      next.delete(action.path);
      return { ...state, expandedPaths: next };
    }

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };

    case 'RESET':
      return {
        ...INITIAL_STATE,
        operationType: state.operationType,
        operationName: state.operationName,
      };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseGraphqlQueryBuilderResult {
  state:             BuilderState;
  setOperationType:  (opType: 'query' | 'mutation' | 'subscription') => void;
  setOperationName:  (name: string) => void;
  toggleField:       (path: FieldPath) => void;
  selectPaths:       (paths: FieldPath[]) => void;
  deselectPaths:     (paths: FieldPath[]) => void;
  setArgValue:       (fieldPath: FieldPath, argName: string, value: string) => void;
  toggleExpand:      (path: FieldPath) => void;
  expandPath:        (path: FieldPath) => void;
  collapsePath:      (path: FieldPath) => void;
  setSearchQuery:    (query: string) => void;
  reset:             () => void;

  // Derived: number of selected leaf fields
  selectedCount:     number;
  // Derived: max nesting depth of selected paths
  maxDepth:          number;
  // Derived: number of fields that have at least one arg value set
  argsCount:         number;
  // Derived: number of auto-generated variables
  variablesCount:    number;
}

export function useGraphqlQueryBuilder(): UseGraphqlQueryBuilderResult {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const setOperationType = useCallback(
    (opType: 'query' | 'mutation' | 'subscription') => dispatch({ type: 'SET_OP_TYPE', opType }),
    [],
  );

  const setOperationName = useCallback(
    (name: string) => dispatch({ type: 'SET_OP_NAME', name }),
    [],
  );

  const toggleField = useCallback(
    (path: FieldPath) => dispatch({ type: 'TOGGLE_FIELD', path }),
    [],
  );

  const selectPaths = useCallback(
    (paths: FieldPath[]) => dispatch({ type: 'SELECT_PATHS', paths }),
    [],
  );

  const deselectPaths = useCallback(
    (paths: FieldPath[]) => dispatch({ type: 'DESELECT_PATHS', paths }),
    [],
  );

  const setArgValue = useCallback(
    (fieldPath: FieldPath, argName: string, value: string) =>
      dispatch({ type: 'SET_ARG', fieldPath, argName, value }),
    [],
  );

  const toggleExpand = useCallback(
    (path: FieldPath) => dispatch({ type: 'TOGGLE_EXPAND', path }),
    [],
  );

  const expandPath = useCallback(
    (path: FieldPath) => dispatch({ type: 'EXPAND_PATH', path }),
    [],
  );

  const collapsePath = useCallback(
    (path: FieldPath) => dispatch({ type: 'COLLAPSE_PATH', path }),
    [],
  );

  const setSearchQuery = useCallback(
    (query: string) => dispatch({ type: 'SET_SEARCH', query }),
    [],
  );

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  // Derived statistics
  const selectedPaths = Object.keys(state.selectedFields).filter(
    (p) => state.selectedFields[p],
  );
  const selectedCount  = selectedPaths.length;
  const maxDepth       = selectedPaths.reduce((max, p) => Math.max(max, p.split('.').length), 0);
  const argsCount      = Object.keys(state.argValues).length;

  // Count unique variable names across all arg values
  const variableNames = new Set<string>();
  for (const pathArgs of Object.values(state.argValues)) {
    for (const rawVal of Object.values(pathArgs)) {
      const m = rawVal.match(/^\{\{(.+?)\}\}$/) ?? rawVal.match(/^\$(\w+)$/);
      if (m) variableNames.add(m[1]);
    }
  }
  const variablesCount = variableNames.size;

  return {
    state,
    setOperationType,
    setOperationName,
    toggleField,
    selectPaths,
    deselectPaths,
    setArgValue,
    toggleExpand,
    expandPath,
    collapsePath,
    setSearchQuery,
    reset,
    selectedCount,
    maxDepth,
    argsCount,
    variablesCount,
  };
}
