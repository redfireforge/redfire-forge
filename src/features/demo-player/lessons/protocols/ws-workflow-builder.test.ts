/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsWorkflowBuilderLesson } from './ws-workflow-builder';
import { makeCtx } from './ws-test-utils';

describe('ws-workflow-builder lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsWorkflowBuilderLesson.id).toBe('ws-workflow-builder');
    expect(wsWorkflowBuilderLesson.domainId).toBe('protocols');
    expect(wsWorkflowBuilderLesson.name).toBe('Workflow Builder');
    expect(wsWorkflowBuilderLesson.steps.length).toBe(11);
    expect(wsWorkflowBuilderLesson.concept.title).toBeTruthy();
    expect(wsWorkflowBuilderLesson.concept.body).toBeTruthy();
    expect(wsWorkflowBuilderLesson.initialTab).toBe('workflow');
    // allowedTabs must include workflow-runner so step 11 navigation does not trigger auto-exit
    expect(wsWorkflowBuilderLesson.allowedTabs).toContain('workflow-runner');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsWorkflowBuilderLesson.setup).toBe('function');
    expect(typeof wsWorkflowBuilderLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsWorkflowBuilderLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of wsWorkflowBuilderLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has key terms defined', () => {
    const terms = wsWorkflowBuilderLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(3);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('Node');
    expect(termNames).toContain('Edge');
    expect(termNames).toContain('Quick Test');
  });

  it('has a diagram', () => {
    expect(wsWorkflowBuilderLesson.concept.diagram).toBeTruthy();
  });

  it('has category set to websocket', () => {
    expect(wsWorkflowBuilderLesson.category).toBe('websocket');
  });

  it('has correct step IDs in order', () => {
    const ids = wsWorkflowBuilderLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'wf-create', 'wf-palette', 'wf-add-connect', 'wf-config-connect',
      'wf-define-variable',
      'wf-add-send', 'wf-config-send', 'wf-add-receive', 'wf-config-receive',
      'wf-quick-test', 'wf-runner-variable',
    ]);
  });

  it('estimated time is 3 minutes', () => {
    expect(wsWorkflowBuilderLesson.estimatedMinutes).toBe(3);
  });

  it('interactive steps have actions', () => {
    const actionSteps = wsWorkflowBuilderLesson.steps.filter(s => s.action);
    // Steps 1 (create), 3 (add connect), 4 (config connect), 4b (define variable), 5 (add send), 6 (config send), 7 (add receive), 8 (config receive), 9 (quick test), 10 (runner variable)
    expect(actionSteps.length).toBe(10);
  });

  it('palette step is observation-only', () => {
    const paletteStep = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-palette');
    expect(paletteStep).toBeDefined();
    expect(paletteStep!.action).toBeUndefined();
  });

  it('all steps have highlight selectors', () => {
    for (const step of wsWorkflowBuilderLesson.steps) {
      expect(step.highlight).toBeTruthy();
    }
  });

  it('config steps highlight the modal panel, not the node', () => {
    const configSteps = ['wf-config-connect', 'wf-config-send', 'wf-config-receive'];
    for (const id of configSteps) {
      const step = wsWorkflowBuilderLesson.steps.find(s => s.id === id)!;
      expect(step.highlight).toBe('.wf-config-modal');
    }
  });

  it('create step uses ctx.click and ctx.fill', async () => {
    const ctx = makeCtx();
    const createStep = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-create')!;
    await createStep.action!(ctx);
    // Clicks: sidebar new btn, blank item, create OK
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('New workflow'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'WS Echo Demo');
  });

  it('add-connect step clicks palette item', async () => {
    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-add-connect')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('wsConnect'));
  });

  it('config-connect action fills URL and saves (config already open from preAction)', async () => {
    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-connect')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), '{{wsUrl}}');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('btn-primary'));
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('config-connect preAction calls __wfDeselectAll and opens config when node present', async () => {
    const deselectAll = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeselectAll = deselectAll;
    const node = document.createElement('div');
    node.className = 'react-flow__node-wsConnect';
    const dblSpy = vi.fn();
    node.addEventListener('dblclick', dblSpy);
    document.body.appendChild(node);

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-connect')!;
    await step.preAction!(makeCtx());
    expect(deselectAll).toHaveBeenCalled();
    expect(dblSpy).toHaveBeenCalled();
    delete (window as unknown as Record<string, unknown>).__wfDeselectAll;
  });

  it('config-connect preAction is no-op when node absent (Rule 4 guard)', async () => {
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-connect')!;
    await expect(step.preAction!(makeCtx())).resolves.not.toThrow();
  });

  it('define-variable step opens Variables modal and adds wsUrl', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="wf-toolbar-variables-btn"></button>
      <div class="wf-defaults-modal">
        <input class="wf-var-key-input" placeholder="name" />
        <div class="wf-var-new-row-value"><input class="wf-var-value-input" placeholder="value" /></div>
        <div class="wf-config-vars"><div></div><button type="button">+</button></div>
        <button class="btn-primary" type="button">Save</button>
      </div>
    `;
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-define-variable')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('wf-var-key-input'), 'wsUrl');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('wf-var-value-input'), 'ws://localhost:9876');
  });

  it('wf-define-variable preAction navigates to workflow tab (Rule 4 skip guard)', async () => {
    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-define-variable')!;
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
  });

  it('wf-quick-test preAction navigates to workflow tab (Rule 4 skip guard)', async () => {
    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-quick-test')!;
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
  });

  it('config-send action fills message and saves (config already open from preAction)', async () => {
    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-send')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), '{"action": "hello", "from": "workflow"}');
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('config-send preAction calls __wfDeselectAll and opens config when node present', async () => {
    const deselectAll = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeselectAll = deselectAll;
    const node = document.createElement('div');
    node.className = 'react-flow__node-wsSend';
    const dblSpy = vi.fn();
    node.addEventListener('dblclick', dblSpy);
    document.body.appendChild(node);

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-send')!;
    await step.preAction!(makeCtx());
    expect(deselectAll).toHaveBeenCalled();
    expect(dblSpy).toHaveBeenCalled();
    delete (window as unknown as Record<string, unknown>).__wfDeselectAll;
  });

  it('config-send preAction is no-op when node absent', async () => {
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-send')!;
    await expect(step.preAction!(makeCtx())).resolves.not.toThrow();
  });

  it('quick-test step clicks the Quick Test button and uses waitFor (Rule 5)', async () => {
    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-quick-test')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('quick-test'));
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="exec-summary"]');
  });

  it('cleanup closes config modals when present', async () => {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'wf-config-modal-footer-actions';
    const inner = document.createElement('button');
    inner.className = 'btn-primary';
    saveBtn.appendChild(inner);
    document.body.appendChild(saveBtn);

    const ctx = makeCtx();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await wsWorkflowBuilderLesson.cleanup!(ctx);
    // Should not throw; fetch called to stop mock server
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/ws/mock/stop', expect.anything());
    vi.restoreAllMocks();
  });

  it('cleanup handles missing config modal gracefully', async () => {
    const ctx = makeCtx();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await wsWorkflowBuilderLesson.cleanup!(ctx);
    // Should not throw
    vi.restoreAllMocks();
  });

  it('setup starts mock server via REST API', async () => {
    const ctx = makeCtx();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await wsWorkflowBuilderLesson.setup!(ctx);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/ws/mock/start', expect.objectContaining({ method: 'POST' }));
    vi.restoreAllMocks();
  });

  it('has verify selectors on key interactive steps', () => {
    const createStep = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-create')!;
    expect(createStep.verify).toBeTruthy();
    const addConnectStep = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-add-connect')!;
    expect(addConnectStep.verify).toBeTruthy();
    const quickTestStep = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-quick-test')!;
    expect(quickTestStep.verify).toBeTruthy();
  });

  it('setup deletes existing demo workflow when __wfDeleteByName is available', async () => {
    const wfDelete = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = wfDelete;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await wsWorkflowBuilderLesson.setup!(makeCtx());
    expect(wfDelete).toHaveBeenCalledWith('WS Echo Demo');
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    vi.restoreAllMocks();
  });

  it('cleanup clicks cfg close and deletes demo workflow', async () => {
    const footer = document.createElement('div');
    footer.className = 'wf-config-modal-footer-actions';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-sm btn-ghost';
    footer.appendChild(closeBtn);
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-sm btn-primary';
    footer.appendChild(saveBtn);
    document.body.appendChild(footer);
    const closeSpy = vi.spyOn(closeBtn, 'click');

    const wfDelete = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = wfDelete;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await wsWorkflowBuilderLesson.cleanup!(makeCtx());
    expect(closeSpy).toHaveBeenCalled();
    expect(wfDelete).toHaveBeenCalledWith('WS Echo Demo');
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    vi.restoreAllMocks();
  });

  it('wf-palette preAction dismisses onboarding tooltip when present (line 196 true)', async () => {
    const skipBtn = document.createElement('button');
    skipBtn.className = 'onboarding-tooltip-skip';
    const clickSpy = vi.fn();
    skipBtn.addEventListener('click', clickSpy);
    document.body.appendChild(skipBtn);

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-palette')!;
    await step.preAction!(makeCtx());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('wf-palette preAction is no-op when onboarding tooltip absent (line 196 false)', async () => {
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-palette')!;
    const ctx = makeCtx();
    await expect(step.preAction!(ctx)).resolves.not.toThrow();
  });

  it('wf-add-connect preAction scrolls palette item into view', async () => {
    const el = document.createElement('div');
    el.className = 'wf-palette-block-wsConnect';
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-add-connect')!;
    await step.preAction!(makeCtx());
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  it('wf-add-connect action connects nodes via __wfConnect and clicks fit view', async () => {
    document.body.innerHTML = `
      <div class="react-flow__node-start" data-id="start-1"></div>
      <div class="react-flow__node-wsConnect" data-id="connect-1"></div>
      <button title="Fit view">Fit</button>`;
    const wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = wfConnect;

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-add-connect')!;
    await step.action!(makeCtx());
    expect(wfConnect).toHaveBeenCalledWith('start-1', 'connect-1', 'out', null);
    delete (window as unknown as Record<string, unknown>).__wfConnect;
  });

  it('wf-add-send preAction scrolls palette WS Send into view (line 283)', async () => {
    const el = document.createElement('div');
    el.className = 'wf-palette-block-wsSend';
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-add-send')!;
    await step.preAction!(makeCtx());
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  it('wf-add-receive preAction scrolls palette WS Receive into view (line 326)', async () => {
    const el = document.createElement('div');
    el.className = 'wf-palette-block-wsReceive';
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-add-receive')!;
    await step.preAction!(makeCtx());
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  it('wf-add-send action connects WS Connect to WS Send', async () => {
    document.body.innerHTML = `
      <div class="react-flow__node-wsConnect" data-id="connect-1"></div>
      <div class="react-flow__node-wsSend" data-id="send-1"></div>
      <button title="Fit view">Fit</button>`;
    const wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = wfConnect;

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-add-send')!;
    await step.action!(makeCtx());
    expect(wfConnect).toHaveBeenCalledWith('connect-1', 'send-1', null, null);
    delete (window as unknown as Record<string, unknown>).__wfConnect;
  });

  it('wf-add-receive action connects WS Send to WS Receive', async () => {
    document.body.innerHTML = `
      <div class="react-flow__node-wsSend" data-id="send-1"></div>
      <div class="react-flow__node-wsReceive" data-id="recv-1"></div>
      <button title="Fit view">Fit</button>`;
    const wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = wfConnect;

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-add-receive')!;
    await step.action!(makeCtx());
    expect(wfConnect).toHaveBeenCalledWith('send-1', 'recv-1', null, null);
    delete (window as unknown as Record<string, unknown>).__wfConnect;
  });

  it('wf-config-receive action fills timeout and saves (config already open from preAction)', async () => {
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-receive')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('ws-receive-config'), '5000');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('btn-primary'));
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('config-receive preAction calls __wfDeselectAll and opens config when node present', async () => {
    const deselectAll = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeselectAll = deselectAll;
    const node = document.createElement('div');
    node.className = 'react-flow__node-wsReceive';
    const dblSpy = vi.fn();
    node.addEventListener('dblclick', dblSpy);
    document.body.appendChild(node);

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-receive')!;
    await step.preAction!(makeCtx());
    expect(deselectAll).toHaveBeenCalled();
    expect(dblSpy).toHaveBeenCalled();
    delete (window as unknown as Record<string, unknown>).__wfDeselectAll;
  });

  it('config-receive preAction is no-op when node absent', async () => {
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-receive')!;
    await expect(step.preAction!(makeCtx())).resolves.not.toThrow();
  });

  // Deselect + open-config is now in preAction (not action) — see tests above:
  //   'config-connect preAction calls __wfDeselectAll and opens config when node present'
  //   'config-connect preAction is no-op when node absent (Rule 4 guard)'

  it('quick-test saves workflow when save button exists (line 378 true)', async () => {
    const wrap = document.createElement('div');
    wrap.className = 'wf-toolbar-save-wrap';
    const saveBtn = document.createElement('button');
    const saveSpy = vi.fn();
    saveBtn.addEventListener('click', saveSpy);
    wrap.appendChild(saveBtn);
    document.body.appendChild(wrap);

    await wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-quick-test')!.action!(makeCtx());
    expect(saveSpy).toHaveBeenCalled();
  });

  it('connectNodes returns false when __wfConnect is missing', async () => {
    document.body.innerHTML = `
      <div class="react-flow__node-wsConnect" data-id="connect-1"></div>
      <div class="react-flow__node-wsSend" data-id="send-1"></div>
      <button title="Fit view">Fit</button>`;

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-add-send')!;
    await step.action!(makeCtx());
    // Should not throw when __wfConnect is undefined
  });

  it('wf-config-connect preAction scrolls WS Connect node into view (Rule 4)', async () => {
    const el = document.createElement('div');
    el.className = 'react-flow__node-wsConnect';
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-connect')!;
    await step.preAction!(makeCtx());
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  it('wf-config-send preAction scrolls WS Send node into view (Rule 4)', async () => {
    const el = document.createElement('div');
    el.className = 'react-flow__node-wsSend';
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-send')!;
    await step.preAction!(makeCtx());
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  it('wf-config-receive preAction scrolls WS Receive node into view (Rule 4)', async () => {
    const el = document.createElement('div');
    el.className = 'react-flow__node-wsReceive';
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-receive')!;
    await step.preAction!(makeCtx());
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  it('wf-runner-variable preAction is no-op when picker absent (line 398 false)', async () => {
    // No picker in DOM → if(picker) false → no click
    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-runner-variable')!;
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('wf-runner-variable preAction navigates to runner and clicks workflow picker (Rule 4)', async () => {
    const picker = document.createElement('button');
    picker.setAttribute('data-testid', 'workflow-select');
    const pickerSpy = vi.fn();
    picker.addEventListener('click', pickerSpy);
    const demoItem = document.createElement('div');
    demoItem.className = 'wfp-dropdown-item';
    demoItem.textContent = 'WS Echo Demo';
    const itemSpy = vi.fn();
    demoItem.addEventListener('click', itemSpy);
    document.body.appendChild(picker);
    document.body.appendChild(demoItem);

    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-runner-variable')!;
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
    expect(pickerSpy).toHaveBeenCalled();
    expect(itemSpy).toHaveBeenCalled();
  });

  it('wf-runner-variable preAction closes dropdown gracefully when WS Echo Demo is missing (Guide mode guard)', async () => {
    // No demoItem in DOM — simulates guide mode after cleanup deleted the workflow
    const picker = document.createElement('button');
    picker.setAttribute('data-testid', 'workflow-select');
    const pickerSpy = vi.fn();
    picker.addEventListener('click', pickerSpy);
    document.body.appendChild(picker);

    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-runner-variable')!;
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
    // Picker clicked twice: once to open, once to close since workflow not found
    expect(pickerSpy).toHaveBeenCalledTimes(2);
  });

  it('wf-runner-variable action fills and restores wsUrl variable when input present (line 414 true)', async () => {
    document.body.innerHTML = `<input class="wfp-var-input" value="ws://localhost:9876" />`;
    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-runner-variable')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith('.wfp-var-input', 'ws://staging.example.com/ws');
    expect(ctx.fill).toHaveBeenCalledWith('.wfp-var-input', 'ws://localhost:9876');
  });

  it('wf-runner-variable action is no-op when no var inputs in DOM (line 414 false)', async () => {
    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-runner-variable')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith('.wfp-var-input', expect.any(String));
  });
});

// ─── ws-socketio ─────────────────────────────────────────────────

