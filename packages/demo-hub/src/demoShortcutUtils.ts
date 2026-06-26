/**
 * Returns true when demo hub global shortcuts must not steal keyboard input.
 * Monaco keeps focus on a hidden textarea or EditContext host; keydown `target` is
 * often a div, so we also detect Monaco `.focused`, :focus-within, and :focus.
 */
export function shouldIgnoreDemoShortcuts(target: EventTarget | null): boolean {
  if (isEditableShortcutTarget(target)) return true;
  if (document.activeElement && isEditableShortcutTarget(document.activeElement)) return true;
  if (hasTypingFocusWithin()) return true;
  if (isMonacoEditorFocused()) return true;
  if (isFocusedMonacoInput()) return true;
  return false;
}

/** Studio / mapper / workflow surfaces where users type during live demos. */
export const TYPING_FOCUS_WITHIN_SELECTOR_LIST = [
  '.gql-editor-wrapper',
  '[data-testid="gql-editor-pane"]',
  '[data-testid="gql-editor"]',
  '[data-testid="gql-variables-panel"]',
  '.gql-vars-panel',
  '[data-testid="gql-qb-code"]',
  '[data-testid="gql-col-vars-editor"]',
  '[data-testid="gql-mock-sdl-editor"]',
  '.gql-qb-field-tree',
  '.monaco-editor',
  '.dm-validation-editor',
  '.wf-script-code-editor',
  '[data-testid="ws-message-input"]',
  '.ws-compose-textarea',
] as const;

const TYPING_FOCUS_WITHIN_SELECTORS = TYPING_FOCUS_WITHIN_SELECTOR_LIST.join(', ');

export function hasTypingFocusWithin(): boolean {
  for (const sel of TYPING_FOCUS_WITHIN_SELECTOR_LIST) {
    if (document.querySelector(`${sel}:focus-within`)) return true;
  }
  const containers = document.querySelectorAll(TYPING_FOCUS_WITHIN_SELECTORS);
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    for (const el of containers) {
      if (el.contains(active)) return true;
    }
  }
  return false;
}

/** Monaco 0.52+ may use EditContext — `.focused` and :focus-within are reliable signals. */
export function isMonacoEditorFocused(): boolean {
  return !!(
    document.querySelector('.monaco-editor.focused')
    || document.querySelector('.monaco-editor:focus-within')
    || document.querySelector('.monaco-editor :focus')
  );
}

export function isFocusedMonacoInput(): boolean {
  return !!document.querySelector(
    'textarea.ime-text-area:focus, textarea.inputarea:focus, .native-edit-context:focus',
  );
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true;
  if (target.classList.contains('native-edit-context')) return true;
  if (target.closest('.native-edit-context')) return true;
  if (target.closest('.monaco-editor')) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  if (target.closest('[role="textbox"]')) return true;
  if (target.closest('.gql-editor-wrapper')) return true;
  if (target.closest('[data-testid="gql-editor-pane"]')) return true;
  if (target.closest('[data-testid="gql-variables-panel"]')) return true;
  if (target.closest('.gql-vars-panel')) return true;
  return false;
}

/** Demo play/pause (Space) only when focus is on demo hub UI — never on the app behind it. */
export function shouldAllowDemoPlayPauseShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('.demo-live-panel, .demo-overview-modal, .demo-hub, .demo-lesson-player');
}
