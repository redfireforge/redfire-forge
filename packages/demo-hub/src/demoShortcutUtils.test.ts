/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  shouldIgnoreDemoShortcuts,
  shouldAllowDemoPlayPauseShortcut,
  hasTypingFocusWithin,
  isFocusedMonacoInput,
  isMonacoEditorFocused,
} from './demoShortcutUtils';

describe('shouldIgnoreDemoShortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ignores INPUT, TEXTAREA, and SELECT', () => {
    expect(shouldIgnoreDemoShortcuts(document.createElement('input'))).toBe(true);
    expect(shouldIgnoreDemoShortcuts(document.createElement('textarea'))).toBe(true);
    expect(shouldIgnoreDemoShortcuts(document.createElement('select'))).toBe(true);
  });

  it('ignores contenteditable elements', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    document.body.appendChild(el);
    expect(shouldIgnoreDemoShortcuts(el)).toBe(true);
  });

  it('ignores events from inside Monaco editor chrome', () => {
    document.body.innerHTML = `
      <div class="monaco-editor">
        <div class="view-lines">query</div>
      </div>
    `;
    const line = document.querySelector('.view-lines')!;
    expect(shouldIgnoreDemoShortcuts(line)).toBe(true);
  });

  it('ignores when gql-editor-wrapper has focus-within (Monaco typing)', () => {
    document.body.innerHTML = `
      <div class="gql-editor-wrapper" data-testid="gql-editor">
        <div class="monaco-editor">
          <textarea class="ime-text-area"></textarea>
        </div>
      </div>
    `;
    const textarea = document.querySelector('textarea.ime-text-area') as HTMLTextAreaElement;
    textarea.focus();
    expect(hasTypingFocusWithin()).toBe(true);
    expect(isFocusedMonacoInput()).toBe(true);
    // Space keydown may target body while Monaco textarea stays focused.
    expect(shouldIgnoreDemoShortcuts(document.body)).toBe(true);
  });

  it('ignores when document.activeElement is Monaco textarea', () => {
    document.body.innerHTML = `
      <div class="monaco-editor">
        <textarea class="inputarea"></textarea>
      </div>
    `;
    const textarea = document.querySelector('textarea.inputarea') as HTMLTextAreaElement;
    textarea.focus();
    expect(shouldIgnoreDemoShortcuts(document.body)).toBe(true);
  });

  it('ignores when Monaco editor has focused class (EditContext / no textarea)', () => {
    document.body.innerHTML = `
      <div class="gql-editor-wrapper">
        <div class="monaco-editor focused" tabindex="0">
          <div class="view-lines">#comment</div>
        </div>
      </div>
    `;
    const lines = document.querySelector('.view-lines') as HTMLElement;
    lines.focus();
    expect(isMonacoEditorFocused()).toBe(true);
    expect(shouldIgnoreDemoShortcuts(lines)).toBe(true);
    expect(shouldIgnoreDemoShortcuts(document.body)).toBe(true);
  });

  it('ignores when gql-editor-pane has focus-within via querySelector', () => {
    document.body.innerHTML = `
      <div class="gql-editor-pane" data-testid="gql-editor-pane">
        <div class="gql-editor-wrapper">
          <div class="monaco-editor focused">
            <div class="view-line" tabindex="-1"></div>
          </div>
        </div>
      </div>
    `;
    const line = document.querySelector('.view-line') as HTMLElement;
    line.focus();
    expect(hasTypingFocusWithin()).toBe(true);
    expect(shouldIgnoreDemoShortcuts(document.body)).toBe(true);
  });

  it('does not ignore plain div clicks outside editors', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    div.focus();
    expect(shouldIgnoreDemoShortcuts(div)).toBe(false);
  });

  it('shouldAllowDemoPlayPauseShortcut is true only inside demo hub chrome', () => {
    document.body.innerHTML = `
      <div class="demo-live-panel"><button id="play">▶</button></div>
      <div class="monaco-editor"><div class="native-edit-context" id="ctx"></div></div>
    `;
    expect(shouldAllowDemoPlayPauseShortcut(document.querySelector('#play'))).toBe(true);
    expect(shouldAllowDemoPlayPauseShortcut(document.querySelector('#ctx'))).toBe(false);
    expect(shouldAllowDemoPlayPauseShortcut(document.body)).toBe(false);
  });

  it('ignores role=textbox and native-edit-context targets', () => {
    const textbox = document.createElement('div');
    textbox.setAttribute('role', 'textbox');
    document.body.appendChild(textbox);
    expect(shouldIgnoreDemoShortcuts(textbox)).toBe(true);

    const ctx = document.createElement('div');
    ctx.className = 'native-edit-context';
    document.body.appendChild(ctx);
    expect(shouldIgnoreDemoShortcuts(ctx)).toBe(true);
  });

  it('ignores gql variables panel and ws compose textarea via closest selectors', () => {
    document.body.innerHTML = `
      <div data-testid="gql-variables-panel"><span id="vars-inner">x</span></div>
      <textarea class="ws-compose-textarea" id="ws-compose"></textarea>
    `;
    expect(shouldIgnoreDemoShortcuts(document.querySelector('#vars-inner')!)).toBe(true);
    expect(shouldIgnoreDemoShortcuts(document.querySelector('#ws-compose')!)).toBe(true);
  });

  it('ignores contenteditable via isContentEditable property', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'isContentEditable', { value: true });
    document.body.appendChild(el);
    expect(shouldIgnoreDemoShortcuts(el)).toBe(true);
  });

  it('hasTypingFocusWithin matches activeElement contained in typing container', () => {
    document.body.innerHTML = `
      <div data-testid="gql-mock-sdl-editor">
        <textarea id="sdl"></textarea>
      </div>
    `;
    const textarea = document.querySelector('#sdl') as HTMLTextAreaElement;
    textarea.focus();
    expect(hasTypingFocusWithin()).toBe(true);
  });

  it('ignores gql-editor-pane and gql-vars-panel via closest selectors', () => {
    document.body.innerHTML = `
      <div data-testid="gql-editor-pane"><span id="pane-inner">x</span></div>
      <div class="gql-vars-panel"><span id="vars">y</span></div>
    `;
    expect(shouldIgnoreDemoShortcuts(document.querySelector('#pane-inner')!)).toBe(true);
    expect(shouldIgnoreDemoShortcuts(document.querySelector('#vars')!)).toBe(true);
  });

  it('shouldAllowDemoPlayPauseShortcut matches demo-hub and demo-lesson-player', () => {
    document.body.innerHTML = `
      <div class="demo-hub"><button id="hub-btn">Next</button></div>
      <div class="demo-lesson-player"><button id="player-btn">Pause</button></div>
    `;
    expect(shouldAllowDemoPlayPauseShortcut(document.querySelector('#hub-btn'))).toBe(true);
    expect(shouldAllowDemoPlayPauseShortcut(document.querySelector('#player-btn'))).toBe(true);
  });

  it('ignores workflow script and validation editor when typing focus is within', () => {
    document.body.innerHTML = `
      <div class="wf-script-code-editor"><span id="wf" tabindex="0">fn</span></div>
      <div class="dm-validation-editor"><span id="dm" tabindex="0">rule</span></div>
    `;
    (document.querySelector('#wf') as HTMLElement).focus();
    expect(shouldIgnoreDemoShortcuts(document.body)).toBe(true);
    (document.querySelector('#dm') as HTMLElement).focus();
    expect(shouldIgnoreDemoShortcuts(document.body)).toBe(true);
  });

  it('ignores when activeElement is editable even if event target is body', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(shouldIgnoreDemoShortcuts(document.body)).toBe(true);
  });

  it('shouldAllowDemoPlayPauseShortcut returns false for non-element targets', () => {
    expect(shouldAllowDemoPlayPauseShortcut(null)).toBe(false);
    expect(shouldAllowDemoPlayPauseShortcut(document.createTextNode('x'))).toBe(false);
  });

  it('ignores descendants inside native-edit-context and contenteditable containers', () => {
    document.body.innerHTML = `
      <div class="native-edit-context"><span id="ctx-child">edit</span></div>
      <div contenteditable="true"><span id="ce-child">typed</span></div>
    `;
    expect(shouldIgnoreDemoShortcuts(document.querySelector('#ctx-child')!)).toBe(true);
    expect(shouldIgnoreDemoShortcuts(document.querySelector('#ce-child')!)).toBe(true);
  });

  it('shouldIgnoreDemoShortcuts returns false for non-element event targets', () => {
    expect(shouldIgnoreDemoShortcuts(document.createTextNode('text'))).toBe(false);
  });
});
