/**
 * Browser/OS substitution hardening for the hidden textarea Monaco uses for
 * IME composition. The textarea is rendered asynchronously after `onMount`
 * fires, so we install attribute overrides once it appears and (only if the
 * first attempt fails) poll briefly until it does.
 *
 * Extracted from `ValidationCodeEditor.tsx` so the resolve logic and the
 * polling lifecycle can be unit-tested without spinning up Monaco itself.
 */

/** CSS attribute pairs we set on Monaco's textarea to disable autocorrect. */
const HARDENING_ATTRS: ReadonlyArray<readonly [string, string]> = [
  ['autocorrect', 'off'],
  ['autocomplete', 'off'],
  ['autocapitalize', 'off'],
  ['spellcheck', 'false'],
  ['data-gramm', 'false'],
];

/**
 * Resolve the textarea Monaco uses for input.
 *
 * Tries (in order):
 *   1. `textarea.ime-text-area` inside the editor DOM (modern @monaco-editor)
 *   2. `textarea.inputarea` inside the editor DOM (older Monaco builds)
 *   3. The first `<textarea>` inside the editor DOM
 *   4. A `textarea` somewhere under `.dm-validation-editor` at the document
 *      level (final fallback used in tests where `getDomNode()` may return null)
 *
 * @returns the resolved textarea or `null` if nothing matched.
 */
export function resolveMonacoTextarea(
  domNode: HTMLElement | null,
  doc: Document = document,
): HTMLTextAreaElement | null {
  const fromEditor =
    (domNode?.querySelector('textarea.ime-text-area') as HTMLTextAreaElement | null) ??
    (domNode?.querySelector('textarea.inputarea') as HTMLTextAreaElement | null) ??
    (domNode?.querySelector('textarea') as HTMLTextAreaElement | null);

  if (fromEditor instanceof HTMLTextAreaElement) return fromEditor;

  const fromDoc = doc.querySelector(
    '.dm-validation-editor textarea.ime-text-area, .dm-validation-editor textarea.inputarea, .dm-validation-editor textarea',
  ) as HTMLTextAreaElement | null;
  return fromDoc instanceof HTMLTextAreaElement ? fromDoc : null;
}

/** Apply the autocorrect/autocomplete/spellcheck attributes once. */
export function applyHardeningAttributes(textarea: HTMLTextAreaElement): void {
  for (const [name, value] of HARDENING_ATTRS) {
    textarea.setAttribute(name, value);
  }
}

/**
 * Try to install hardening synchronously; if no textarea is available yet,
 * poll up to {@link maxAttempts} times at {@link intervalMs}, then give up.
 *
 * Returns a `cancel()` function the caller can invoke on unmount (or when the
 * install succeeds early) to stop the polling.
 */
export function installTextareaHardening(opts: {
  getDomNode: () => HTMLElement | null;
  doc?: Document;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
  intervalMs?: number;
  maxAttempts?: number;
}): { cancel: () => void } {
  const {
    getDomNode,
    doc = document,
    setInterval: setIntervalImpl = globalThis.setInterval,
    clearInterval: clearIntervalImpl = globalThis.clearInterval,
    intervalMs = 50,
    maxAttempts = 20,
  } = opts;

  let installed = false;
  const tryInstall = (): boolean => {
    if (installed) return true;
    const textarea = resolveMonacoTextarea(getDomNode(), doc);
    if (!textarea) return false;
    applyHardeningAttributes(textarea);
    installed = true;
    return true;
  };

  if (tryInstall()) {
    return { cancel: () => { /* nothing to cancel — install already done */ } };
  }

  let attempts = 0;
  let tid: ReturnType<typeof setInterval> | null = setIntervalImpl(() => {
    attempts += 1;
    if (tryInstall() || attempts > maxAttempts) {
      if (tid !== null) {
        clearIntervalImpl(tid as unknown as Parameters<typeof clearInterval>[0]);
        tid = null;
      }
    }
  }, intervalMs);

  return {
    cancel: () => {
      if (tid !== null) {
        clearIntervalImpl(tid as unknown as Parameters<typeof clearInterval>[0]);
        tid = null;
      }
    },
  };
}
