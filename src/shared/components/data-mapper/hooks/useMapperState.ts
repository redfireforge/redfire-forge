import { useReducer, useCallback, useRef } from 'react';
import type { Mapping, MapperState, MapperAction } from '../types';

const MAX_UNDO = 50;

function mapperReducer(state: MapperState, action: MapperAction): MapperState {
  switch (action.type) {
    case 'ADD_MAPPING':
      return { ...state, mappings: [...state.mappings, action.mapping] };
    case 'REMOVE_MAPPING':
      return {
        ...state,
        mappings: state.mappings.filter((m) => m.id !== action.id),
        selectedMappingId: state.selectedMappingId === action.id ? null : state.selectedMappingId,
      };
    case 'UPDATE_MAPPING':
      return {
        ...state,
        mappings: state.mappings.map((m) =>
          m.id === action.id ? { ...m, ...action.changes } : m,
        ),
      };
    case 'SET_MAPPINGS':
      return { ...state, mappings: action.mappings, selectedMappingId: null };
    case 'CLEAR_ALL':
      return { ...state, mappings: [], selectedMappingId: null };
    case 'SELECT_MAPPING':
      return { ...state, selectedMappingId: action.id };
    case 'SET_ACTIVE_SOURCE':
      return { ...state, activeSourceId: action.sourceId };
    case 'SET_SOURCE_SAMPLE':
      return {
        ...state,
        sourceSampleOverrides: { ...state.sourceSampleOverrides, [action.sourceId]: action.data },
      };
    case 'ACCEPT_PENDING':
      return {
        ...state,
        mappings: state.mappings.map((m) =>
          m.id === action.id ? { ...m, isPending: false } : m,
        ),
      };
    case 'REJECT_PENDING':
      return {
        ...state,
        mappings: state.mappings.filter((m) => m.id !== action.id),
        selectedMappingId: state.selectedMappingId === action.id ? null : state.selectedMappingId,
      };
    case 'ACCEPT_ALL_PENDING':
      return {
        ...state,
        mappings: state.mappings.map((m) => (m.isPending ? { ...m, isPending: false } : m)),
      };
    case 'REJECT_ALL_PENDING':
      return {
        ...state,
        mappings: state.mappings.filter((m) => !m.isPending),
        selectedMappingId: state.mappings.find((m) => m.isPending && m.id === state.selectedMappingId)
          ? null
          : state.selectedMappingId,
      };
  }
}

export interface UseMapperStateOptions {
  initialMappings?: Mapping[];
  initialSourceId?: string;
}

export interface UseMapperStateReturn {
  state: MapperState;
  addMapping: (mapping: Mapping) => void;
  removeMapping: (id: string) => void;
  updateMapping: (id: string, changes: Partial<Omit<Mapping, 'id'>>) => void;
  setMappings: (mappings: Mapping[]) => void;
  clearAll: () => void;
  selectMapping: (id: string | null) => void;
  setActiveSource: (sourceId: string) => void;
  setSourceSample: (sourceId: string, data: unknown) => void;
  acceptPending: (id: string) => void;
  rejectPending: (id: string) => void;
  acceptAllPending: () => void;
  rejectAllPending: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasPending: boolean;
}

/**
 * Manages the mapping state with undo/redo support.
 *
 * Only actions that mutate mappings are tracked in undo history
 * (ADD, REMOVE, UPDATE, SET, CLEAR). Selection and active source
 * changes are not tracked.
 */
export function useMapperState(opts?: UseMapperStateOptions): UseMapperStateReturn {
  const initialState: MapperState = {
    mappings: opts?.initialMappings ?? [],
    selectedMappingId: null,
    activeSourceId: opts?.initialSourceId ?? '',
    sourceSampleOverrides: {},
  };

  const [state, rawDispatch] = useReducer(mapperReducer, initialState);

  const undoStack = useRef<Mapping[][]>([]);
  const redoStack = useRef<Mapping[][]>([]);

  const isMutatingAction = (action: MapperAction): boolean =>
    action.type === 'ADD_MAPPING' ||
    action.type === 'REMOVE_MAPPING' ||
    action.type === 'UPDATE_MAPPING' ||
    action.type === 'SET_MAPPINGS' ||
    action.type === 'CLEAR_ALL' ||
    action.type === 'ACCEPT_PENDING' ||
    action.type === 'REJECT_PENDING' ||
    action.type === 'ACCEPT_ALL_PENDING' ||
    action.type === 'REJECT_ALL_PENDING';

  const dispatch = useCallback(
    (action: MapperAction) => {
      if (isMutatingAction(action)) {
        undoStack.current = [...undoStack.current.slice(-MAX_UNDO + 1), state.mappings];
        redoStack.current = [];
      }
      rawDispatch(action);
    },
    [state.mappings],
  );

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    redoStack.current = [...redoStack.current, state.mappings];
    rawDispatch({ type: 'SET_MAPPINGS', mappings: prev });
  }, [state.mappings]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current[redoStack.current.length - 1];
    redoStack.current = redoStack.current.slice(0, -1);
    undoStack.current = [...undoStack.current, state.mappings];
    rawDispatch({ type: 'SET_MAPPINGS', mappings: next });
  }, [state.mappings]);

  return {
    state,
    addMapping: useCallback((m: Mapping) => dispatch({ type: 'ADD_MAPPING', mapping: m }), [dispatch]),
    removeMapping: useCallback((id: string) => dispatch({ type: 'REMOVE_MAPPING', id }), [dispatch]),
    updateMapping: useCallback(
      (id: string, changes: Partial<Omit<Mapping, 'id'>>) =>
        dispatch({ type: 'UPDATE_MAPPING', id, changes }),
      [dispatch],
    ),
    setMappings: useCallback((mappings: Mapping[]) => dispatch({ type: 'SET_MAPPINGS', mappings }), [dispatch]),
    clearAll: useCallback(() => dispatch({ type: 'CLEAR_ALL' }), [dispatch]),
    selectMapping: useCallback((id: string | null) => dispatch({ type: 'SELECT_MAPPING', id }), [dispatch]),
    setActiveSource: useCallback((sourceId: string) => dispatch({ type: 'SET_ACTIVE_SOURCE', sourceId }), [dispatch]),
    // Bypasses undo stack — sample overrides are ephemeral input data, not mapping decisions
    setSourceSample: useCallback(
      (sourceId: string, data: unknown) => rawDispatch({ type: 'SET_SOURCE_SAMPLE', sourceId, data }),
      [],
    ),
    acceptPending: useCallback((id: string) => dispatch({ type: 'ACCEPT_PENDING', id }), [dispatch]),
    rejectPending: useCallback((id: string) => dispatch({ type: 'REJECT_PENDING', id }), [dispatch]),
    acceptAllPending: useCallback(() => dispatch({ type: 'ACCEPT_ALL_PENDING' }), [dispatch]),
    rejectAllPending: useCallback(() => dispatch({ type: 'REJECT_ALL_PENDING' }), [dispatch]),
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    hasPending: state.mappings.some((m) => m.isPending),
  };
}
