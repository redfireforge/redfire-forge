import type { GrpcMethodInfo } from '../../../shared/grpc/contracts';

export type GrpcProtoHybridFieldLevel = 'error' | 'warning' | 'info' | 'none';

export interface GrpcProtoHybridFieldValidationState {
  level: GrpcProtoHybridFieldLevel;
  code: string;
  message: string;
}

export interface GrpcProtoHybridValidationSummary {
  errors: number;
  warnings: number;
  infos: number;
}

export interface GrpcProtoHybridModalOpenContext {
  selectedPath: string | null;
  navigatorScrollTop: number;
  focusPaneScrollTop: number;
}

export interface GrpcProtoHybridNavigatorState {
  selectedPath: string | null;
  expandedPaths: string[];
  scrollTop: number;
  mainViewMode: 'optionA' | 'optionB' | 'optionC';
}

export interface GrpcProtoHybridValidationState {
  byPath: Record<string, GrpcProtoHybridFieldValidationState>;
  summary: GrpcProtoHybridValidationSummary;
  computedAt: number;
}

export interface GrpcProtoHybridModalState {
  isOpen: boolean;
  activeView: 'optionA' | 'optionB' | 'optionC';
  workingDraft: unknown | null;
  jsonDraft: string;
  jsonError: string | null;
  openedAt: number | null;
  openContext: GrpcProtoHybridModalOpenContext | null;
  dirty: boolean;
}

export interface GrpcProtoHybridTabState {
  tabId: string;
  requestDraft: unknown;
  navigator: GrpcProtoHybridNavigatorState;
  validation: GrpcProtoHybridValidationState;
  modal: GrpcProtoHybridModalState;
}

export type GrpcProtoHybridEvent =
  | { type: 'NAVIGATOR_SELECT_PATH'; path: string }
  | { type: 'MAIN_VIEW_MODE_SWITCH'; mode: 'optionA' | 'optionB' | 'optionC' }
  | { type: 'FOCUS_EDIT_PATCH'; nextDraft: unknown }
  | { type: 'FULL_FORM_OPEN'; openedAt?: number; openContext: GrpcProtoHybridModalOpenContext }
  | { type: 'MODAL_VIEW_SWITCH'; view: 'optionA' | 'optionB' | 'optionC' }
  | { type: 'FULL_FORM_PATCH'; nextDraft: unknown }
  | { type: 'JSON_MODAL_PATCH'; jsonText: string }
  | { type: 'JSON_MODAL_PARSE_OK'; parsedDraft: unknown }
  | { type: 'JSON_MODAL_PARSE_ERROR'; message: string }
  | { type: 'FULL_FORM_APPLY' }
  | { type: 'FULL_FORM_DISCARD' }
  | { type: 'FULL_FORM_CLOSE' }
  | { type: 'VALIDATION_REFRESH'; nextByPath: Record<string, GrpcProtoHybridFieldValidationState>; computedAt?: number }
  | { type: 'REQUEST_SEND_ATTEMPT' };

const EMPTY_VALIDATION_SUMMARY: GrpcProtoHybridValidationSummary = {
  errors: 0,
  warnings: 0,
  infos: 0,
};

function summarizeValidation(
  byPath: Record<string, GrpcProtoHybridFieldValidationState>,
): GrpcProtoHybridValidationSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const state of Object.values(byPath)) {
    if (state.level === 'error') {
      errors += 1;
      continue;
    }
    if (state.level === 'warning') {
      warnings += 1;
      continue;
    }
    if (state.level === 'info') {
      infos += 1;
    }
  }

  return { errors, warnings, infos };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isObjectRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function formatJsonDraft(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function hasBlockingErrors(state: GrpcProtoHybridTabState): boolean {
  return state.validation.summary.errors > 0 || Boolean(state.modal.jsonError);
}

export function createGrpcProtoHybridInitialState(tabId: string, requestDraft: unknown): GrpcProtoHybridTabState {
  return {
    tabId,
    requestDraft,
    navigator: {
      selectedPath: null,
      expandedPaths: [],
      mainViewMode: 'optionB',
      scrollTop: 0,
    },
    validation: {
      byPath: {},
      summary: EMPTY_VALIDATION_SUMMARY,
      computedAt: Date.now(),
    },
    modal: {
      isOpen: false,
      activeView: 'optionB',
      workingDraft: null,
      jsonDraft: '',
      jsonError: null,
      openedAt: null,
      openContext: null,
      dirty: false,
    },
  };
}

export function isGrpcProtoHybridEnabledForMethod(method: GrpcMethodInfo | undefined): boolean {
  return Boolean(method);
}

export function reduceGrpcProtoHybridState(
  state: GrpcProtoHybridTabState,
  event: GrpcProtoHybridEvent,
): GrpcProtoHybridTabState {
  switch (event.type) {
    case 'NAVIGATOR_SELECT_PATH': {
      return {
        ...state,
        navigator: {
          ...state.navigator,
          selectedPath: event.path,
        },
      };
    }
    case 'MAIN_VIEW_MODE_SWITCH': {
      return {
        ...state,
        navigator: {
          ...state.navigator,
          mainViewMode: event.mode,
        },
      };
    }
    case 'FOCUS_EDIT_PATCH': {
      if (state.modal.isOpen) return state;
      return {
        ...state,
        requestDraft: event.nextDraft,
      };
    }
    case 'FULL_FORM_OPEN': {
      if (state.modal.isOpen) return state;
      const workingDraft = structuredClone(state.requestDraft);
      return {
        ...state,
        modal: {
          isOpen: true,
          activeView: state.navigator.mainViewMode,
          workingDraft,
          jsonDraft: formatJsonDraft(workingDraft),
          jsonError: null,
          openedAt: event.openedAt ?? Date.now(),
          openContext: event.openContext,
          dirty: false,
        },
      };
    }
    case 'MODAL_VIEW_SWITCH': {
      if (!state.modal.isOpen) return state;
      return {
        ...state,
        modal: {
          ...state.modal,
          activeView: event.view,
        },
      };
    }
    case 'FULL_FORM_PATCH': {
      if (!state.modal.isOpen) return state;
      const dirty = stableStringify(event.nextDraft) !== stableStringify(state.requestDraft);
      return {
        ...state,
        modal: {
          ...state.modal,
          workingDraft: event.nextDraft,
          jsonDraft: formatJsonDraft(event.nextDraft),
          jsonError: null,
          dirty,
        },
      };
    }
    case 'JSON_MODAL_PATCH': {
      if (!state.modal.isOpen) return state;
      return {
        ...state,
        modal: {
          ...state.modal,
          jsonDraft: event.jsonText,
        },
      };
    }
    case 'JSON_MODAL_PARSE_OK': {
      if (!state.modal.isOpen) return state;
      const dirty = stableStringify(event.parsedDraft) !== stableStringify(state.requestDraft);
      return {
        ...state,
        modal: {
          ...state.modal,
          workingDraft: event.parsedDraft,
          // Keep user's raw JSON text while still syncing workingDraft to avoid cursor jumps while typing.
          jsonDraft: state.modal.jsonDraft,
          jsonError: null,
          dirty,
        },
      };
    }
    case 'JSON_MODAL_PARSE_ERROR': {
      if (!state.modal.isOpen) return state;
      return {
        ...state,
        modal: {
          ...state.modal,
          jsonError: event.message,
        },
      };
    }
    case 'FULL_FORM_APPLY': {
      if (!state.modal.isOpen || state.modal.workingDraft === null || hasBlockingErrors(state)) {
        return state;
      }
      return {
        ...state,
        requestDraft: state.modal.workingDraft,
        modal: {
          isOpen: false,
          activeView: 'optionA',
          workingDraft: null,
          jsonDraft: '',
          jsonError: null,
          openedAt: null,
          openContext: null,
          dirty: false,
        },
      };
    }
    case 'FULL_FORM_DISCARD': {
      if (!state.modal.isOpen) return state;
      return {
        ...state,
        modal: {
          isOpen: false,
          activeView: 'optionA',
          workingDraft: null,
          jsonDraft: '',
          jsonError: null,
          openedAt: null,
          openContext: null,
          dirty: false,
        },
      };
    }
    case 'FULL_FORM_CLOSE': {
      if (!state.modal.isOpen) return state;
      return {
        ...state,
        modal: {
          isOpen: false,
          activeView: 'optionA',
          workingDraft: null,
          jsonDraft: '',
          jsonError: null,
          openedAt: null,
          openContext: null,
          dirty: false,
        },
      };
    }
    case 'VALIDATION_REFRESH': {
      const summary = summarizeValidation(event.nextByPath);
      return {
        ...state,
        validation: {
          byPath: event.nextByPath,
          summary,
          computedAt: event.computedAt ?? Date.now(),
        },
      };
    }
    case 'REQUEST_SEND_ATTEMPT': {
      return state;
    }
    default:
      return state;
  }
}
