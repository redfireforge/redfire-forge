import { describe, it, expect, vi } from 'vitest';
import {
  formatStorageError,
  applyLoadedTemplates,
  applyLoadError,
  clearErrorIfMounted,
  applyPersistError,
} from './wsTemplateMountGuards';

describe('formatStorageError', () => {
  it('uses Error message', () => {
    expect(formatStorageError(new Error('boom'))).toBe('boom');
  });

  it('stringifies non-Error values', () => {
    expect(formatStorageError('plain')).toBe('plain');
  });
});

describe('applyLoadedTemplates', () => {
  it('updates state when mounted', () => {
    const setTemplates = vi.fn();
    const setLoading = vi.fn();
    applyLoadedTemplates(true, [{ id: '1' } as never], setTemplates, setLoading);
    expect(setTemplates).toHaveBeenCalledWith([{ id: '1' }]);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it('skips when unmounted', () => {
    const setTemplates = vi.fn();
    const setLoading = vi.fn();
    applyLoadedTemplates(false, [{ id: '1' } as never], setTemplates, setLoading);
    expect(setTemplates).not.toHaveBeenCalled();
    expect(setLoading).not.toHaveBeenCalled();
  });
});

describe('applyLoadError', () => {
  it('sets error when mounted', () => {
    const setError = vi.fn();
    const setLoading = vi.fn();
    applyLoadError(true, 'fail', setError, setLoading);
    expect(setError).toHaveBeenCalledWith('fail');
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it('skips when unmounted', () => {
    const setError = vi.fn();
    const setLoading = vi.fn();
    applyLoadError(false, new Error('fail'), setError, setLoading);
    expect(setError).not.toHaveBeenCalled();
    expect(setLoading).not.toHaveBeenCalled();
  });
});

describe('clearErrorIfMounted', () => {
  it('clears error when mounted', () => {
    const setError = vi.fn();
    clearErrorIfMounted(true, setError);
    expect(setError).toHaveBeenCalledWith(null);
  });

  it('skips when unmounted', () => {
    const setError = vi.fn();
    clearErrorIfMounted(false, setError);
    expect(setError).not.toHaveBeenCalled();
  });
});

describe('applyPersistError', () => {
  it('sets error when mounted', () => {
    const setError = vi.fn();
    applyPersistError(true, new Error('write fail'), setError);
    expect(setError).toHaveBeenCalledWith('write fail');
  });

  it('skips when unmounted', () => {
    const setError = vi.fn();
    applyPersistError(false, 'write fail', setError);
    expect(setError).not.toHaveBeenCalled();
  });
});
