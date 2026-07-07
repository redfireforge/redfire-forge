import { describe, expect, it } from 'vitest';
import {
  createGrpcProtoHybridInitialState,
  isGrpcProtoHybridEnabledForMethod,
  reduceGrpcProtoHybridState,
} from './grpcProtoHybridState';
import type { GrpcMethodInfo } from '../../../shared/grpc/contracts';

const FIXTURE_UNARY_METHOD = {
  name: 'Echo',
  callType: 'unary',
} as GrpcMethodInfo;

const FIXTURE_SERVER_STREAM_METHOD = {
  name: 'ServerStream',
  callType: 'server_streaming',
} as GrpcMethodInfo;

const FIXTURE_BIDI_STREAM_METHOD = {
  name: 'BidiStream',
  callType: 'bidi_streaming',
} as GrpcMethodInfo;

describe('grpcProtoHybridState (Phase 0 foundation)', () => {
  it('opens modal with cloned working draft and context', () => {
    const initial = createGrpcProtoHybridInitialState('tab-1', {
      user: { id: 1, profile: { name: 'alice' } },
    });

    const next = reduceGrpcProtoHybridState(initial, {
      type: 'FULL_FORM_OPEN',
      openContext: {
        selectedPath: 'user.profile',
        navigatorScrollTop: 20,
        focusPaneScrollTop: 40,
      },
      openedAt: 123,
    });

    expect(next.modal.isOpen).toBe(true);
    expect(next.modal.activeView).toBe('optionB');
    expect(next.modal.openedAt).toBe(123);
    expect(next.modal.workingDraft).toEqual(initial.requestDraft);
    expect(next.modal.workingDraft).not.toBe(initial.requestDraft);
    expect(next.modal.jsonDraft).toContain('"alice"');
    expect(next.modal.jsonError).toBeNull();
  });

  it('switches modal view between Option A and Option C while preserving working draft', () => {
    const opened = reduceGrpcProtoHybridState(
      createGrpcProtoHybridInitialState('tab-1', { user: { id: 7 } }),
      {
        type: 'FULL_FORM_OPEN',
        openContext: {
          selectedPath: 'user',
          navigatorScrollTop: 0,
          focusPaneScrollTop: 0,
        },
      },
    );
    const switched = reduceGrpcProtoHybridState(opened, {
      type: 'MODAL_VIEW_SWITCH',
      view: 'optionC',
    });

    expect(switched.modal.activeView).toBe('optionC');
    expect(switched.modal.workingDraft).toEqual({ user: { id: 7 } });
  });

  it('marks modal dirty only when working draft differs from canonical draft', () => {
    const opened = reduceGrpcProtoHybridState(
      createGrpcProtoHybridInitialState('tab-1', { user: { id: 1 } }),
      {
        type: 'FULL_FORM_OPEN',
        openContext: {
          selectedPath: 'user',
          navigatorScrollTop: 0,
          focusPaneScrollTop: 0,
        },
      },
    );

    const unchanged = reduceGrpcProtoHybridState(opened, {
      type: 'FULL_FORM_PATCH',
      nextDraft: { user: { id: 1 } },
    });
    expect(unchanged.modal.dirty).toBe(false);

    const changed = reduceGrpcProtoHybridState(opened, {
      type: 'FULL_FORM_PATCH',
      nextDraft: { user: { id: 2 } },
    });
    expect(changed.modal.dirty).toBe(true);
  });

  it('applies modal draft atomically when no blocking errors exist', () => {
    const opened = reduceGrpcProtoHybridState(
      createGrpcProtoHybridInitialState('tab-1', { payment: { amount: 10 } }),
      {
        type: 'FULL_FORM_OPEN',
        openContext: {
          selectedPath: 'payment',
          navigatorScrollTop: 0,
          focusPaneScrollTop: 0,
        },
      },
    );
    const patched = reduceGrpcProtoHybridState(opened, {
      type: 'FULL_FORM_PATCH',
      nextDraft: { payment: { amount: 25 } },
    });

    const applied = reduceGrpcProtoHybridState(patched, { type: 'FULL_FORM_APPLY' });
    expect(applied.requestDraft).toEqual({ payment: { amount: 25 } });
    expect(applied.modal.isOpen).toBe(false);
    expect(applied.modal.workingDraft).toBeNull();
  });

  it('prevents apply when validation contains blocking errors', () => {
    const withError = reduceGrpcProtoHybridState(
      createGrpcProtoHybridInitialState('tab-1', { payment: { amount: 10 } }),
      {
        type: 'VALIDATION_REFRESH',
        nextByPath: {
          'payment.amount': { level: 'error', code: 'required', message: 'amount is required' },
        },
      },
    );
    const opened = reduceGrpcProtoHybridState(withError, {
      type: 'FULL_FORM_OPEN',
      openContext: {
        selectedPath: 'payment',
        navigatorScrollTop: 0,
        focusPaneScrollTop: 0,
      },
    });
    const patched = reduceGrpcProtoHybridState(opened, {
      type: 'FULL_FORM_PATCH',
      nextDraft: { payment: { amount: null } },
    });

    const blocked = reduceGrpcProtoHybridState(patched, { type: 'FULL_FORM_APPLY' });
    expect(blocked.modal.isOpen).toBe(true);
    expect(blocked.requestDraft).toEqual({ payment: { amount: 10 } });
  });

  it('keeps prior working draft when JSON parse fails and blocks apply', () => {
    const opened = reduceGrpcProtoHybridState(
      createGrpcProtoHybridInitialState('tab-1', { payment: { amount: 10 } }),
      {
        type: 'FULL_FORM_OPEN',
        openContext: {
          selectedPath: 'payment',
          navigatorScrollTop: 0,
          focusPaneScrollTop: 0,
        },
      },
    );
    const editedJsonText = reduceGrpcProtoHybridState(opened, {
      type: 'JSON_MODAL_PATCH',
      jsonText: '{"payment":{"amount":',
    });
    const parseError = reduceGrpcProtoHybridState(editedJsonText, {
      type: 'JSON_MODAL_PARSE_ERROR',
      message: 'Unexpected end of JSON input',
    });
    const applyBlocked = reduceGrpcProtoHybridState(parseError, { type: 'FULL_FORM_APPLY' });

    expect(applyBlocked.modal.jsonError).toContain('Unexpected end');
    expect(applyBlocked.modal.workingDraft).toEqual({ payment: { amount: 10 } });
    expect(applyBlocked.modal.isOpen).toBe(true);
    expect(applyBlocked.requestDraft).toEqual({ payment: { amount: 10 } });
  });

  it('syncs Option C valid JSON back into Option A working draft', () => {
    const opened = reduceGrpcProtoHybridState(
      createGrpcProtoHybridInitialState('tab-1', { payment: { amount: 10 } }),
      {
        type: 'FULL_FORM_OPEN',
        openContext: {
          selectedPath: 'payment',
          navigatorScrollTop: 0,
          focusPaneScrollTop: 0,
        },
      },
    );
    const patchedJson = reduceGrpcProtoHybridState(opened, {
      type: 'JSON_MODAL_PATCH',
      jsonText: '{"payment":{"amount":25}}',
    });
    const parsed = reduceGrpcProtoHybridState(patchedJson, {
      type: 'JSON_MODAL_PARSE_OK',
      parsedDraft: { payment: { amount: 25 } },
    });

    expect(parsed.modal.workingDraft).toEqual({ payment: { amount: 25 } });
    expect(parsed.modal.jsonError).toBeNull();
    expect(parsed.modal.dirty).toBe(true);
    expect(parsed.modal.jsonDraft).toBe('{"payment":{"amount":25}}');
  });

  it('preserves user JSON text formatting after valid parse', () => {
    const opened = reduceGrpcProtoHybridState(
      createGrpcProtoHybridInitialState('tab-1', { payment: { amount: 10 } }),
      {
        type: 'FULL_FORM_OPEN',
        openContext: {
          selectedPath: 'payment',
          navigatorScrollTop: 0,
          focusPaneScrollTop: 0,
        },
      },
    );
    const userJson = '{\n    "payment": {"amount": 25}\n}';
    const patchedJson = reduceGrpcProtoHybridState(opened, {
      type: 'JSON_MODAL_PATCH',
      jsonText: userJson,
    });
    const parsed = reduceGrpcProtoHybridState(patchedJson, {
      type: 'JSON_MODAL_PARSE_OK',
      parsedDraft: { payment: { amount: 25 } },
    });

    expect(parsed.modal.workingDraft).toEqual({ payment: { amount: 25 } });
    expect(parsed.modal.jsonDraft).toBe(userJson);
    expect(parsed.modal.jsonError).toBeNull();
  });

  it('allows hybrid editor for all method call types', () => {
    expect(isGrpcProtoHybridEnabledForMethod(FIXTURE_UNARY_METHOD)).toBe(true);
    expect(isGrpcProtoHybridEnabledForMethod(FIXTURE_SERVER_STREAM_METHOD)).toBe(true);
    expect(isGrpcProtoHybridEnabledForMethod(FIXTURE_BIDI_STREAM_METHOD)).toBe(true);
    expect(isGrpcProtoHybridEnabledForMethod(undefined)).toBe(false);
  });

  it('updates navigator selection and main view mode', () => {
    const initial = createGrpcProtoHybridInitialState('tab-1', { value: 1 });
    const selected = reduceGrpcProtoHybridState(initial, {
      type: 'NAVIGATOR_SELECT_PATH',
      path: 'field:value',
    });
    const switched = reduceGrpcProtoHybridState(selected, {
      type: 'MAIN_VIEW_MODE_SWITCH',
      mode: 'optionC',
    });

    expect(selected.navigator.selectedPath).toBe('field:value');
    expect(switched.navigator.mainViewMode).toBe('optionC');
  });

  it('ignores focus edit patch while modal is open', () => {
    const opened = reduceGrpcProtoHybridState(
      createGrpcProtoHybridInitialState('tab-1', { value: 1 }),
      {
        type: 'FULL_FORM_OPEN',
        openContext: {
          selectedPath: 'field:value',
          navigatorScrollTop: 0,
          focusPaneScrollTop: 0,
        },
      },
    );

    const next = reduceGrpcProtoHybridState(opened, {
      type: 'FOCUS_EDIT_PATCH',
      nextDraft: { value: 2 },
    });

    expect(next.requestDraft).toEqual({ value: 1 });
  });

  it('ignores modal-only events when modal is closed', () => {
    const initial = createGrpcProtoHybridInitialState('tab-1', { value: 1 });

    expect(reduceGrpcProtoHybridState(initial, { type: 'MODAL_VIEW_SWITCH', view: 'optionA' })).toBe(initial);
    expect(reduceGrpcProtoHybridState(initial, { type: 'FULL_FORM_PATCH', nextDraft: { value: 2 } })).toBe(initial);
    expect(reduceGrpcProtoHybridState(initial, { type: 'JSON_MODAL_PATCH', jsonText: '{}' })).toBe(initial);
    expect(reduceGrpcProtoHybridState(initial, { type: 'JSON_MODAL_PARSE_OK', parsedDraft: {} })).toBe(initial);
    expect(reduceGrpcProtoHybridState(initial, { type: 'JSON_MODAL_PARSE_ERROR', message: 'bad' })).toBe(initial);
    expect(reduceGrpcProtoHybridState(initial, { type: 'FULL_FORM_CLOSE' })).toBe(initial);
  });

  it('blocks apply when working draft is null', () => {
    const opened = reduceGrpcProtoHybridState(
      createGrpcProtoHybridInitialState('tab-1', { value: 1 }),
      {
        type: 'FULL_FORM_OPEN',
        openContext: {
          selectedPath: null,
          navigatorScrollTop: 0,
          focusPaneScrollTop: 0,
        },
      },
    );
    const nulled = {
      ...opened,
      modal: {
        ...opened.modal,
        workingDraft: null,
      },
    };

    const next = reduceGrpcProtoHybridState(nulled, { type: 'FULL_FORM_APPLY' });
    expect(next).toBe(nulled);
  });

  it('closes modal on discard and close', () => {
    const opened = reduceGrpcProtoHybridState(
      createGrpcProtoHybridInitialState('tab-1', { value: 1 }),
      {
        type: 'FULL_FORM_OPEN',
        openContext: {
          selectedPath: null,
          navigatorScrollTop: 0,
          focusPaneScrollTop: 0,
        },
      },
    );

    const discarded = reduceGrpcProtoHybridState(opened, { type: 'FULL_FORM_DISCARD' });
    expect(discarded.modal.isOpen).toBe(false);

    const reopened = reduceGrpcProtoHybridState(discarded, {
      type: 'FULL_FORM_OPEN',
      openContext: {
        selectedPath: null,
        navigatorScrollTop: 1,
        focusPaneScrollTop: 2,
      },
    });
    const closed = reduceGrpcProtoHybridState(reopened, { type: 'FULL_FORM_CLOSE' });
    expect(closed.modal.isOpen).toBe(false);
  });

  it('summarizes warning and info validation levels and keeps state on send attempt', () => {
    const initial = createGrpcProtoHybridInitialState('tab-1', { value: 1 });
    const refreshed = reduceGrpcProtoHybridState(initial, {
      type: 'VALIDATION_REFRESH',
      nextByPath: {
        alpha: { level: 'warning', code: 'warn', message: 'warn' },
        beta: { level: 'info', code: 'info', message: 'info' },
      },
      computedAt: 777,
    });
    const sendAttempt = reduceGrpcProtoHybridState(refreshed, { type: 'REQUEST_SEND_ATTEMPT' });

    expect(refreshed.validation.summary).toEqual({ errors: 0, warnings: 1, infos: 1 });
    expect(refreshed.validation.computedAt).toBe(777);
    expect(sendAttempt).toBe(refreshed);
  });
});
