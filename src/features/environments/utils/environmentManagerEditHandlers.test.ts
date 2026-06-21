import { describe, it, expect, vi } from 'vitest';
import {
  mergeEditValue,
  runSaveEdit,
  shouldClearEditingOnProtocolChange,
  type ActiveEdit,
} from './environmentManagerEditHandlers';

const httpEdit: ActiveEdit = { svcId: 'svc-1', kind: 'http', envId: 'e1', value: 'https://a' };
const wsEdit: ActiveEdit = { svcId: 'svc-1', kind: 'protocol', protocol: 'websocket', envId: 'e1', value: 'wss://ws' };

describe('mergeEditValue', () => {
  it('updates value when svcId matches', () => {
    expect(mergeEditValue(httpEdit, 'svc-1', 'https://b')).toEqual({ ...httpEdit, value: 'https://b' });
  });

  it('returns previous edit when svcId does not match', () => {
    expect(mergeEditValue(httpEdit, 'svc-2', 'https://b')).toBe(httpEdit);
  });

  it('returns null when no active edit', () => {
    expect(mergeEditValue(null, 'svc-1', 'x')).toBeNull();
  });
});

describe('runSaveEdit', () => {
  it('invokes saveHttp for http edits', () => {
    const saveHttp = vi.fn();
    const saveProtocol = vi.fn();
    runSaveEdit(httpEdit, 'svc-1', { saveHttp, saveProtocol });
    expect(saveHttp).toHaveBeenCalledWith('e1', 'https://a');
    expect(saveProtocol).not.toHaveBeenCalled();
  });

  it('invokes saveProtocol for protocol edits', () => {
    const saveHttp = vi.fn();
    const saveProtocol = vi.fn();
    runSaveEdit(wsEdit, 'svc-1', { saveHttp, saveProtocol });
    expect(saveProtocol).toHaveBeenCalledWith('websocket', 'e1', 'wss://ws');
    expect(saveHttp).not.toHaveBeenCalled();
  });

  it('returns early when svcId does not match', () => {
    const saveHttp = vi.fn();
    const saveProtocol = vi.fn();
    runSaveEdit(httpEdit, 'svc-2', { saveHttp, saveProtocol });
    expect(saveHttp).not.toHaveBeenCalled();
    expect(saveProtocol).not.toHaveBeenCalled();
  });

  it('returns early when editing is null', () => {
    const saveHttp = vi.fn();
    runSaveEdit(null, 'svc-1', { saveHttp, saveProtocol: vi.fn() });
    expect(saveHttp).not.toHaveBeenCalled();
  });
});

describe('shouldClearEditingOnProtocolChange', () => {
  it('clears when editing belongs to the same service', () => {
    expect(shouldClearEditingOnProtocolChange(httpEdit, 'svc-1')).toBe(true);
  });

  it('does not clear when editing belongs to another service', () => {
    expect(shouldClearEditingOnProtocolChange(httpEdit, 'svc-2')).toBe(false);
  });

  it('does not clear when nothing is being edited', () => {
    expect(shouldClearEditingOnProtocolChange(null, 'svc-1')).toBe(false);
  });
});
