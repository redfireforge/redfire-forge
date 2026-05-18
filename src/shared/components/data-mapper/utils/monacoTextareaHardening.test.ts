/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import {
  resolveMonacoTextarea,
  applyHardeningAttributes,
  installTextareaHardening,
} from './monacoTextareaHardening';

function makeDomTree(textareaClass = 'ime-text-area'): { root: HTMLElement; textarea: HTMLTextAreaElement } {
  const root = document.createElement('div');
  const textarea = document.createElement('textarea');
  if (textareaClass) textarea.className = textareaClass;
  root.appendChild(textarea);
  return { root, textarea };
}

describe('resolveMonacoTextarea', () => {
  it('returns null when domNode is null and no document-level fallback exists', () => {
    expect(resolveMonacoTextarea(null, document)).toBeNull();
  });

  it('prefers textarea.ime-text-area inside the editor DOM', () => {
    const { root: outer } = makeDomTree('ime-text-area');
    // Add an unrelated <textarea> later in the tree to verify the first match wins.
    const second = document.createElement('textarea');
    outer.appendChild(second);
    expect(resolveMonacoTextarea(outer, document)).toBe(outer.querySelector('textarea.ime-text-area'));
  });

  it('falls back to textarea.inputarea when no ime-text-area exists', () => {
    const { root, textarea } = makeDomTree('inputarea');
    expect(resolveMonacoTextarea(root, document)).toBe(textarea);
  });

  it('falls back to any <textarea> inside the editor DOM', () => {
    const { root, textarea } = makeDomTree('');
    expect(resolveMonacoTextarea(root, document)).toBe(textarea);
  });

  it('falls back to the document-level .dm-validation-editor selector', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'dm-validation-editor';
    const textarea = document.createElement('textarea');
    textarea.className = 'ime-text-area';
    wrapper.appendChild(textarea);
    document.body.appendChild(wrapper);
    try {
      expect(resolveMonacoTextarea(null, document)).toBe(textarea);
    } finally {
      wrapper.remove();
    }
  });

  it('returns null when the document-level fallback does not point at a textarea', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'dm-validation-editor';
    document.body.appendChild(wrapper);
    try {
      expect(resolveMonacoTextarea(null, document)).toBeNull();
    } finally {
      wrapper.remove();
    }
  });

  it('uses the supplied custom document', () => {
    const customDoc = document.implementation.createHTMLDocument();
    const wrapper = customDoc.createElement('div');
    wrapper.className = 'dm-validation-editor';
    const textarea = customDoc.createElement('textarea');
    wrapper.appendChild(textarea);
    customDoc.body.appendChild(wrapper);
    expect(resolveMonacoTextarea(null, customDoc)).toBe(textarea);
  });
});

describe('applyHardeningAttributes', () => {
  it('sets all five autocorrect-disabling attributes', () => {
    const textarea = document.createElement('textarea');
    applyHardeningAttributes(textarea);
    expect(textarea.getAttribute('autocorrect')).toBe('off');
    expect(textarea.getAttribute('autocomplete')).toBe('off');
    expect(textarea.getAttribute('autocapitalize')).toBe('off');
    expect(textarea.getAttribute('spellcheck')).toBe('false');
    expect(textarea.getAttribute('data-gramm')).toBe('false');
  });
});

describe('installTextareaHardening', () => {
  it('installs synchronously when the textarea is already available', () => {
    const { root, textarea } = makeDomTree('ime-text-area');
    const setIntervalSpy = vi.fn();
    const { cancel } = installTextareaHardening({
      getDomNode: () => root,
      setInterval: setIntervalSpy as unknown as typeof setInterval,
      clearInterval: vi.fn() as unknown as typeof clearInterval,
    });
    expect(textarea.getAttribute('autocorrect')).toBe('off');
    expect(setIntervalSpy).not.toHaveBeenCalled();
    cancel();
  });

  it('schedules polling when no textarea is available synchronously', () => {
    const setIntervalSpy = vi.fn().mockReturnValue(7);
    const clearIntervalSpy = vi.fn();
    const { cancel } = installTextareaHardening({
      getDomNode: () => null,
      doc: document.implementation.createHTMLDocument(),
      setInterval: setIntervalSpy as unknown as typeof setInterval,
      clearInterval: clearIntervalSpy as unknown as typeof clearInterval,
    });
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    cancel();
    expect(clearIntervalSpy).toHaveBeenCalledWith(7);
  });

  it('cancel after a successful sync install is a no-op', () => {
    const { root } = makeDomTree('ime-text-area');
    const clearIntervalSpy = vi.fn();
    const { cancel } = installTextareaHardening({
      getDomNode: () => root,
      clearInterval: clearIntervalSpy as unknown as typeof clearInterval,
    });
    cancel();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it('polling tick installs the textarea when it appears', () => {
    let intervalCb: () => void = () => undefined;
    const setIntervalSpy = vi.fn().mockImplementation((cb: () => void) => {
      intervalCb = cb;
      return 11;
    });
    const clearIntervalSpy = vi.fn();
    const customDoc = document.implementation.createHTMLDocument();
    const root = customDoc.createElement('div');
    let domReady = false;

    installTextareaHardening({
      getDomNode: () => (domReady ? root : null),
      doc: customDoc,
      setInterval: setIntervalSpy as unknown as typeof setInterval,
      clearInterval: clearIntervalSpy as unknown as typeof clearInterval,
    });

    // Tick once with no textarea — should NOT clear the interval yet.
    intervalCb();
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    // Now provide the textarea.
    const textarea = customDoc.createElement('textarea');
    textarea.className = 'ime-text-area';
    root.appendChild(textarea);
    domReady = true;

    intervalCb();
    expect(textarea.getAttribute('autocorrect')).toBe('off');
    expect(clearIntervalSpy).toHaveBeenCalledWith(11);
  });

  it('stops polling after the max-attempts threshold', () => {
    let intervalCb: () => void = () => undefined;
    const setIntervalSpy = vi.fn().mockImplementation((cb: () => void) => {
      intervalCb = cb;
      return 22;
    });
    const clearIntervalSpy = vi.fn();
    installTextareaHardening({
      getDomNode: () => null,
      doc: document.implementation.createHTMLDocument(),
      setInterval: setIntervalSpy as unknown as typeof setInterval,
      clearInterval: clearIntervalSpy as unknown as typeof clearInterval,
      maxAttempts: 2,
    });
    intervalCb(); // attempt 1
    intervalCb(); // attempt 2
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    intervalCb(); // attempt 3 — over threshold
    expect(clearIntervalSpy).toHaveBeenCalledWith(22);
  });

  it('cancel() during polling clears the interval', () => {
    const setIntervalSpy = vi.fn().mockReturnValue(33);
    const clearIntervalSpy = vi.fn();
    const { cancel } = installTextareaHardening({
      getDomNode: () => null,
      doc: document.implementation.createHTMLDocument(),
      setInterval: setIntervalSpy as unknown as typeof setInterval,
      clearInterval: clearIntervalSpy as unknown as typeof clearInterval,
    });
    cancel();
    expect(clearIntervalSpy).toHaveBeenCalledWith(33);
    cancel();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('does not re-apply attributes when already installed', () => {
    let intervalCb: () => void = () => undefined;
    const setIntervalSpy = vi.fn().mockImplementation((cb: () => void) => {
      intervalCb = cb;
      return 44;
    });
    const customDoc = document.implementation.createHTMLDocument();
    const root = customDoc.createElement('div');
    const textarea = customDoc.createElement('textarea');
    textarea.className = 'ime-text-area';
    root.appendChild(textarea);

    let domReady = false;
    installTextareaHardening({
      getDomNode: () => (domReady ? root : null),
      doc: customDoc,
      setInterval: setIntervalSpy as unknown as typeof setInterval,
      clearInterval: vi.fn() as unknown as typeof clearInterval,
    });
    domReady = true;
    intervalCb();
    // After install, set a sentinel attribute and confirm a subsequent tick does not overwrite.
    textarea.setAttribute('autocorrect', 'SENTINEL');
    intervalCb();
    expect(textarea.getAttribute('autocorrect')).toBe('SENTINEL');
  });
});
