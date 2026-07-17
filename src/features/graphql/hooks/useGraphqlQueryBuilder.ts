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

import { useCallback, useEffect, useReducer } from 'react';
import { getAncestorPaths } from '../utils/queryBuilderGenerator';

// ─── State types ──────────────────────────────────────────────────────────────

/** Dot-separated path to a field. Root fields are single segments. */
export type FieldPath = string;

/**
 * Nested arg value map: fieldPath → { argName → raw value string }.
 * Raw values may be literal strings, numbers, booleans, enum names, or
 * {{varRef}} / $varRef patterns that get promoted to GraphQL variables.
 */
export type BuilderArgValues = Record<FieldPath, Record<string, string>>;

/**
 * Directive configuration for a single directive on a single field.
 * `ifVar` holds the condition expression — a {{varRef}} / $varRef pattern
 * or a bare `true`/`false` literal.
 */
export interface BuilderDirective {
  enabled: boolean;
  /** Condition expression: "{{showOrders}}", "$showOrders", "true", or "false". */
  ifVar: string;
}

/** Per-field directive config — supports @include and @skip. */
export interface BuilderFieldDirectives {
  include?: BuilderDirective;
  skip?: BuilderDirective;
}

/** A named GraphQL fragment defined in the builder. */
export interface BuilderFragment {
  /** Fragment name — must be a valid GraphQL identifier. */
  name: string;
  /** The GraphQL type this fragment spreads on, e.g. "User". */
  onType: string;
  /**
   * Dot-paths (relative to the root type) that form the fragment body.
   * The generator will render them as a selection set.
   */
  fieldPaths: FieldPath[];
}

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
  /**
   * Per-field alias names.  Key = dot-path, value = alias string.
   * Generated SDL: `alias: fieldName { ... }`.
   */
  fieldAliases: Record<FieldPath, string>;
  /**
   * Per-field directive config.  Key = dot-path, value = directive map.
   * Applied after the field name + arg clause in the generated SDL.
   */
  fieldDirectives: Record<FieldPath, BuilderFieldDirectives>;
  /**
   * Named fragment definitions.  Key = fragment name (must be a valid GQL identifier).
   * Emitted at the end of the generated document after the main operation.
   */
  fragments: Record<string, BuilderFragment>;
  /**
   * Fragment spreads: top-level fragment names that are spread at the root of the
   * main operation selection set.  Each entry emits `...FragmentName` in the
   * operation body.
   */
  activeFragmentSpreads: string[];
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
  | { type: 'SET_ALIAS';         path: FieldPath; alias: string }
  | { type: 'SET_DIRECTIVE';     path: FieldPath; which: 'include' | 'skip'; enabled: boolean; ifVar: string }
  | { type: 'REMOVE_DIRECTIVE';  path: FieldPath; which: 'include' | 'skip' }
  | { type: 'ADD_FRAGMENT';      fragment: BuilderFragment }
  | { type: 'UPDATE_FRAGMENT';   name: string; patch: Partial<Omit<BuilderFragment, 'name'>> }
  | { type: 'REMOVE_FRAGMENT';   name: string }
  | { type: 'TOGGLE_SPREAD';     name: string }
  | { type: 'RESET' };

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: BuilderState = {
  operationType:  'query',
  operationName:  'MyQuery',
  selectedFields: {},
  argValues:      {},
  expandedPaths:  new Set<string>(),
  searchQuery:    '',
  fieldAliases:   {},
  fieldDirectives: {},
  fragments:       {},
  activeFragmentSpreads: [],
};

/** Deep-enough clone for per-tab builder persistence (Set + nested maps). */
export function cloneBuilderState(state: BuilderState): BuilderState {
  const argValues: BuilderState['argValues'] = {};
  for (const [path, args] of Object.entries(state.argValues)) {
    argValues[path] = { ...args };
  }
  const fieldDirectives: BuilderState['fieldDirectives'] = {};
  for (const [path, dirs] of Object.entries(state.fieldDirectives)) {
    fieldDirectives[path] = {
      ...(dirs.include ? { include: { ...dirs.include } } : {}),
      ...(dirs.skip ? { skip: { ...dirs.skip } } : {}),
    };
  }
  return {
    ...state,
    selectedFields: { ...state.selectedFields },
    argValues,
    expandedPaths: new Set(state.expandedPaths),
    fieldAliases: { ...state.fieldAliases },
    fieldDirectives,
    fragments: { ...state.fragments },
    activeFragmentSpreads: [...state.activeFragmentSpreads],
  };
}

export function createInitialBuilderState(): BuilderState {
  return cloneBuilderState(INITIAL_STATE);
}

/** Expand object rows so nested selections (e.g. user.id) are visible in the tree. */
function ensureExpandedForSelections(state: BuilderState): BuilderState {
  const nextExpanded = new Set(state.expandedPaths);
  for (const [path, selected] of Object.entries(state.selectedFields)) {
    if (!selected) continue;
    for (const ancestor of getAncestorPaths(path)) {
      nextExpanded.add(ancestor);
    }
  }
  if (nextExpanded.size === state.expandedPaths.size) {
    let same = true;
    for (const p of nextExpanded) {
      if (!state.expandedPaths.has(p)) {
        same = false;
        break;
      }
    }
    if (same) return state;
  }
  return { ...state, expandedPaths: nextExpanded };
}

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
      return ensureExpandedForSelections({ ...state, selectedFields: next });
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

    case 'SET_ALIAS': {
      const nextAliases = { ...state.fieldAliases };
      if (action.alias.trim() === '') {
        delete nextAliases[action.path];
      } else {
        nextAliases[action.path] = action.alias.trim();
      }
      return { ...state, fieldAliases: nextAliases };
    }

    case 'SET_DIRECTIVE': {
      const existing = state.fieldDirectives[action.path] ?? {};
      const updated: BuilderFieldDirectives = {
        ...existing,
        [action.which]: { enabled: action.enabled, ifVar: action.ifVar },
      };
      return {
        ...state,
        fieldDirectives: { ...state.fieldDirectives, [action.path]: updated },
      };
    }

    case 'REMOVE_DIRECTIVE': {
      const existing = state.fieldDirectives[action.path];
      if (!existing) return state;
      const updated = { ...existing };
      delete updated[action.which];
      const nextDirectives = { ...state.fieldDirectives };
      if (Object.keys(updated).length === 0) {
        delete nextDirectives[action.path];
      } else {
        nextDirectives[action.path] = updated;
      }
      return { ...state, fieldDirectives: nextDirectives };
    }

    case 'ADD_FRAGMENT': {
      // Overwrite if same name already exists
      return { ...state, fragments: { ...state.fragments, [action.fragment.name]: action.fragment } };
    }

    case 'UPDATE_FRAGMENT': {
      const existing = state.fragments[action.name];
      if (!existing) return state;
      return {
        ...state,
        fragments: {
          ...state.fragments,
          [action.name]: { ...existing, ...action.patch },
        },
      };
    }

    case 'REMOVE_FRAGMENT': {
      const next = { ...state.fragments };
      delete next[action.name];
      // Also remove from spreads if present
      return {
        ...state,
        fragments: next,
        activeFragmentSpreads: state.activeFragmentSpreads.filter((n) => n !== action.name),
      };
    }

    case 'TOGGLE_SPREAD': {
      const active = state.activeFragmentSpreads.includes(action.name);
      return {
        ...state,
        activeFragmentSpreads: active
          ? state.activeFragmentSpreads.filter((n) => n !== action.name)
          : [...state.activeFragmentSpreads, action.name],
      };
    }

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

export interface UseGraphqlQueryBuilderOptions {
  /** Restored builder snapshot (e.g. when re-opening Builder for a tab). */
  initialState?: BuilderState;
  /** Called after every state change — use for per-tab persistence. */
  onStateChange?: (state: BuilderState) => void;
}

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
  setFieldAlias:     (path: FieldPath, alias: string) => void;
  setFieldDirective: (path: FieldPath, which: 'include' | 'skip', enabled: boolean, ifVar: string) => void;
  removeFieldDirective: (path: FieldPath, which: 'include' | 'skip') => void;
  addFragment:       (fragment: BuilderFragment) => void;
  updateFragment:    (name: string, patch: Partial<Omit<BuilderFragment, 'name'>>) => void;
  removeFragment:    (name: string) => void;
  toggleSpread:      (name: string) => void;
  reset:             () => void;

  // Derived: number of selected leaf fields
  selectedCount:     number;
  // Derived: max nesting depth of selected paths
  maxDepth:          number;
  // Derived: number of fields that have at least one arg value set
  argsCount:         number;
  // Derived: number of auto-generated variables
  variablesCount:    number;
  // Derived: number of fields with a non-empty alias
  aliasCount:        number;
  // Derived: number of fields with at least one enabled directive
  directiveCount:    number;
  // Derived: number of defined fragments
  fragmentCount:     number;
}

export function useGraphqlQueryBuilder(
  options: UseGraphqlQueryBuilderOptions = {},
): UseGraphqlQueryBuilderResult {
  const { initialState, onStateChange } = options;
  const [state, dispatch] = useReducer(
    reducer,
    initialState,
    (init) => ensureExpandedForSelections(cloneBuilderState(init ?? INITIAL_STATE)),
  );

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

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

  const setFieldAlias = useCallback(
    (path: FieldPath, alias: string) => dispatch({ type: 'SET_ALIAS', path, alias }),
    [],
  );

  const setFieldDirective = useCallback(
    (path: FieldPath, which: 'include' | 'skip', enabled: boolean, ifVar: string) =>
      dispatch({ type: 'SET_DIRECTIVE', path, which, enabled, ifVar }),
    [],
  );

  const removeFieldDirective = useCallback(
    (path: FieldPath, which: 'include' | 'skip') =>
      dispatch({ type: 'REMOVE_DIRECTIVE', path, which }),
    [],
  );

  const addFragment = useCallback(
    (fragment: BuilderFragment) => dispatch({ type: 'ADD_FRAGMENT', fragment }),
    [],
  );

  const updateFragment = useCallback(
    (name: string, patch: Partial<Omit<BuilderFragment, 'name'>>) =>
      dispatch({ type: 'UPDATE_FRAGMENT', name, patch }),
    [],
  );

  const removeFragment = useCallback(
    (name: string) => dispatch({ type: 'REMOVE_FRAGMENT', name }),
    [],
  );

  const toggleSpread = useCallback(
    (name: string) => dispatch({ type: 'TOGGLE_SPREAD', name }),
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

  const aliasCount = Object.values(state.fieldAliases).filter((a) => a.trim() !== '').length;

  const directiveCount = Object.values(state.fieldDirectives).filter(
    (d) => d.include?.enabled || d.skip?.enabled,
  ).length;

  const fragmentCount = Object.keys(state.fragments).length;

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
    setFieldAlias,
    setFieldDirective,
    removeFieldDirective,
    addFragment,
    updateFragment,
    removeFragment,
    toggleSpread,
    reset,
    selectedCount,
    maxDepth,
    argsCount,
    variablesCount,
    aliasCount,
    directiveCount,
    fragmentCount,
  };
}
