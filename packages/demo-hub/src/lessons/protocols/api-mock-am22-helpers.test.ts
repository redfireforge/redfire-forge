/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK, WF } from '@shared/selectors';
import { AM_DEMO_TIMING } from './api-mock-demo-helpers';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const deleteWorkflowByName = vi.fn(() => true);
const addWorkflowNodeWithPreset = vi.fn(() => true);
const patchWorkflowNodeDataById = vi.fn(() => true);
const connectWorkflowNodes = vi.fn(() => true);
const triggerWorkflowQuickTest = vi.fn();

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  deleteWorkflowByName: (...a: unknown[]) => deleteWorkflowByName(...(a as [])),
  addWorkflowNodeWithPreset: (...a: unknown[]) => addWorkflowNodeWithPreset(...(a as [])),
  patchWorkflowNodeDataById: (...a: unknown[]) => patchWorkflowNodeDataById(...(a as [])),
  connectWorkflowNodes: (...a: unknown[]) => connectWorkflowNodes(...(a as [])),
  triggerWorkflowQuickTest: (...a: unknown[]) => triggerWorkflowQuickTest(...(a as [])),
}));

const ensureLessonBlankWorkflow = vi.fn(async () => undefined);
const collapseWfDemoAppSidebar = vi.fn(async () => undefined);
const revealPaletteBlock = vi.fn(async (_ctx: unknown, sel: string) => document.querySelector<HTMLElement>(sel));
const openWfNodeConfigModal = vi.fn(async () => undefined);
const waitForWfConfigPanel = vi.fn(async () => undefined);
const fillWfConfigField = vi.fn(async () => undefined);
const selectWfConfigOption = vi.fn(async () => undefined);
const clickWfConfigControl = vi.fn(async () => undefined);
const pauseWfConfigSection = vi.fn(async () => undefined);
const saveAndCloseWfConfigModal = vi.fn(async () => true);
const closeWfConfigModalIfOpen = vi.fn(async () => undefined);
const closeWfConsoleIfOpen = vi.fn(async () => undefined);
const closeWfSamplePreviewIfOpen = vi.fn(async () => undefined);
const holdWfSpotlight = vi.fn(async () => undefined);
const fitWfCanvasQuiet = vi.fn(async () => undefined);
const cleanupWorkflowDemoRunUi = vi.fn(async () => undefined);

vi.mock('../wf-demo-helpers', () => ({
  ensureLessonBlankWorkflow: (...a: unknown[]) => ensureLessonBlankWorkflow(...(a as [])),
  collapseWfDemoAppSidebar: (...a: unknown[]) => collapseWfDemoAppSidebar(...(a as [])),
  revealPaletteBlock: (...a: unknown[]) => revealPaletteBlock(...(a as [])),
  openWfNodeConfigModal: (...a: unknown[]) => openWfNodeConfigModal(...(a as [])),
  waitForWfConfigPanel: (...a: unknown[]) => waitForWfConfigPanel(...(a as [])),
  fillWfConfigField: (...a: unknown[]) => fillWfConfigField(...(a as [])),
  selectWfConfigOption: (...a: unknown[]) => selectWfConfigOption(...(a as [])),
  clickWfConfigControl: (...a: unknown[]) => clickWfConfigControl(...(a as [])),
  pauseWfConfigSection: (...a: unknown[]) => pauseWfConfigSection(...(a as [])),
  saveAndCloseWfConfigModal: (...a: unknown[]) => saveAndCloseWfConfigModal(...(a as [])),
  closeWfConfigModalIfOpen: (...a: unknown[]) => closeWfConfigModalIfOpen(...(a as [])),
  closeWfConsoleIfOpen: (...a: unknown[]) => closeWfConsoleIfOpen(...(a as [])),
  closeWfSamplePreviewIfOpen: (...a: unknown[]) => closeWfSamplePreviewIfOpen(...(a as [])),
  holdWfSpotlight: (...a: unknown[]) => holdWfSpotlight(...(a as [])),
  fitWfCanvasQuiet: (...a: unknown[]) => fitWfCanvasQuiet(...(a as [])),
  cleanupWorkflowDemoRunUi: (...a: unknown[]) => cleanupWorkflowDemoRunUi(...(a as [])),
}));

import {
  AM22_ACTION_BLOCKS,
  AM22_ASSERT_BODY,
  AM22_ASSERT_MIN,
  AM22_ASSERT_RECENCY,
  AM22_ASSERT_STATUS,
  AM22_CORPUS_SAMPLE,
  AM22_HTTP_METHOD,
  AM22_HTTP_URL,
  AM22_ISOLATED_SERVER,
  AM22_NODE,
  AM22_SERVER_ID,
  AM22_TIMING,
  AM22_WF_NAME,
  am22CanvasNodeId,
  am22InputValue,
  am22PassSelector,
  am22TestHooks,
  cleanupAm22,
  ensureAm22Designer,
  ensureAm22ForApply,
  ensureAm22ForAssert,
  ensureAm22ForHttp,
  ensureAm22ForPalette,
  ensureAm22ForQuickTest,
  ensureAm22ForReset,
  ensureAm22ForStart,
  ensureAm22ForStop,
  ensureAm22ForWire,
  ensureAm22OnDesigner,
  hasAm22AllGreen,
  hasAm22Apply,
  hasAm22Assert,
  hasAm22Http,
  hasAm22PaletteGroup,
  hasAm22Pass,
  hasAm22Reset,
  hasAm22Start,
  hasAm22Stop,
  hasAm22Wired,
  isAm22ConfigOpen,
  isAm22DesignerActive,
  isAm22IsolateOn,
  prepareAm22Workspace,
  runAm22ApplyNode,
  runAm22AssertNode,
  runAm22DesignerPalette,
  runAm22HttpNode,
  runAm22QuickTest,
  runAm22ResetNode,
  runAm22StartNode,
  runAm22StopNode,
  runAm22Wire,
} from './api-mock-am22-helpers';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function input(testid: string, value = ''): HTMLInputElement {
  const node = document.createElement('input');
  node.setAttribute('data-testid', testid);
  node.value = value;
  makeVisible(node);
  return node;
}

function mountDesigner(): HTMLElement {
  const root = el('div', 'wf-designer');
  root.append(el('div', 'wf-canvas-area'));
  root.append(el('div', 'wf-palette'));
  document.body.append(root);
  return root;
}

function mountPalette(): void {
  for (const sel of AM22_ACTION_BLOCKS) {
    const cls = sel.replace('.', '');
    document.body.append(el('button', cls));
  }
  document.body.append(el('button', 'wf-palette-block-apiMockAssertCalls'));
  document.body.append(el('button', undefined, 'wf-palette-chip-apimock'));
  document.body.append(el('button', 'wf-palette-block-http'));
}

function mountCanvasNode(testid: string, id: string, extraClass = ''): HTMLElement {
  const wrap = el('div', `react-flow__node ${extraClass}`.trim());
  wrap.setAttribute('data-id', id);
  const inner = el('div', 'wf-node wf-node-apimock', testid);
  wrap.append(inner);
  document.body.append(wrap);
  return inner;
}

function mountHttpNode(id = AM22_NODE.http): HTMLElement {
  const wrap = el('div', 'react-flow__node react-flow__node-http');
  wrap.setAttribute('data-id', id);
  document.body.append(wrap);
  return wrap;
}

function mountTriggerStart(id = 'start-1'): HTMLElement {
  const wrap = el('div', 'react-flow__node react-flow__node-start');
  wrap.setAttribute('data-id', id);
  document.body.append(wrap);
  return wrap;
}

function mountPass(testid: string, id: string): HTMLElement {
  const wrap = el('div', 'react-flow__node');
  wrap.setAttribute('data-id', id);
  const inner = el('div', 'wf-node wf-node-apimock wf-node-pass', testid);
  wrap.append(inner);
  document.body.append(wrap);
  return inner;
}

function mountEdge(): HTMLElement {
  const edge = el('div', 'react-flow__edge');
  document.body.append(edge);
  return edge;
}

function mountIsolate(on: boolean): HTMLElement {
  const btn = el('button', `am-toggle${on ? ' on' : ''}`, 'api-mock-wf-isolate');
  btn.setAttribute('aria-checked', on ? 'true' : 'false');
  document.body.append(btn);
  return btn;
}

beforeEach(() => {
  document.body.innerHTML = '';
  wipeApiMockWorkspace.mockClear().mockResolvedValue(true);
  importApiMockGallerySample.mockClear().mockResolvedValue(true);
  prepareApiMockStudioChrome.mockClear();
  deleteWorkflowByName.mockClear().mockReturnValue(true);
  addWorkflowNodeWithPreset.mockClear().mockReturnValue(true);
  patchWorkflowNodeDataById.mockClear().mockReturnValue(true);
  connectWorkflowNodes.mockClear().mockReturnValue(true);
  triggerWorkflowQuickTest.mockClear();
  ensureLessonBlankWorkflow.mockClear();
  collapseWfDemoAppSidebar.mockClear();
  revealPaletteBlock.mockClear().mockImplementation(async (_ctx: unknown, sel: string) => (
    document.querySelector<HTMLElement>(sel)
  ));
  openWfNodeConfigModal.mockClear();
  waitForWfConfigPanel.mockClear();
  fillWfConfigField.mockClear();
  selectWfConfigOption.mockClear();
  clickWfConfigControl.mockClear();
  pauseWfConfigSection.mockClear();
  saveAndCloseWfConfigModal.mockClear().mockResolvedValue(true);
  closeWfConfigModalIfOpen.mockClear();
  closeWfConsoleIfOpen.mockClear();
  closeWfSamplePreviewIfOpen.mockClear();
  holdWfSpotlight.mockClear();
  fitWfCanvasQuiet.mockClear();
  cleanupWorkflowDemoRunUi.mockClear();
});

describe('AM-22 workflow helpers', () => {
  it('holds AM-22 spotlights longer than the shared pack', () => {
    expect(AM22_TIMING.look).toBeGreaterThan(AM_DEMO_TIMING.look);
    expect(AM22_TIMING.beforeOpen).toBe(1400);
    expect(AM22_TIMING.beforeRun).toBe(2000);
    expect(AM22_CORPUS_SAMPLE).toBe('am-gallery-checkout');
    expect(AM22_WF_NAME).toContain('Checkout');
    expect(AM22_HTTP_URL).toBe('{{mockBaseUrl}}/cart');
    expect(AM22_ACTION_BLOCKS).toHaveLength(4);
  });

  it('probes empty DOM as absent', () => {
    expect(isAm22DesignerActive()).toBe(false);
    expect(isAm22ConfigOpen()).toBe(false);
    expect(isAm22IsolateOn()).toBe(true);
    expect(hasAm22PaletteGroup()).toBe(false);
    expect(hasAm22Start()).toBe(false);
    expect(hasAm22Apply()).toBe(false);
    expect(hasAm22Http()).toBe(false);
    expect(hasAm22Reset()).toBe(false);
    expect(hasAm22Assert()).toBe(false);
    expect(hasAm22Stop()).toBe(false);
    expect(hasAm22Wired()).toBe(false);
    expect(hasAm22Pass()).toBe(false);
    expect(hasAm22AllGreen()).toBe(false);
    expect(am22InputValue(API_MOCK.WF_ASSERT_MIN)).toBe('');
    expect(am22CanvasNodeId(API_MOCK.CANVAS_START)).toBeNull();
    expect(am22PassSelector(API_MOCK.CANVAS_ASSERT)).toContain('wf-node-pass');
  });

  it('reads canvas probes from the fixture', () => {
    mountDesigner();
    mountPalette();
    document.body.append(el('div', 'wf-config-modal'));
    mountCanvasNode('api-mock-canvas-apiMockStart', AM22_NODE.start);
    mountCanvasNode('api-mock-canvas-apiMockApply', AM22_NODE.apply);
    mountHttpNode();
    mountCanvasNode('api-mock-canvas-apiMockResetState', AM22_NODE.reset);
    mountPass('api-mock-canvas-apiMockAssertCalls', AM22_NODE.assert);
    mountCanvasNode('api-mock-canvas-apiMockStop', AM22_NODE.stop);
    for (let i = 0; i < 5; i++) mountEdge();
    document.body.append(input('api-mock-wf-assert-min', AM22_ASSERT_MIN));
    mountIsolate(true);

    expect(isAm22DesignerActive()).toBe(true);
    expect(isAm22ConfigOpen()).toBe(true);
    expect(isAm22IsolateOn()).toBe(true);
    expect(hasAm22PaletteGroup()).toBe(true);
    expect(hasAm22Start()).toBe(true);
    expect(hasAm22Apply()).toBe(true);
    expect(hasAm22Http()).toBe(true);
    expect(hasAm22Reset()).toBe(true);
    expect(hasAm22Assert()).toBe(true);
    expect(hasAm22Stop()).toBe(true);
    expect(hasAm22Wired()).toBe(true);
    expect(hasAm22Pass()).toBe(true);
    expect(am22InputValue(API_MOCK.WF_ASSERT_MIN)).toBe(AM22_ASSERT_MIN);
    expect(am22CanvasNodeId(API_MOCK.CANVAS_START)).toBe(AM22_NODE.start);
  });

  it('treats isolate as off when aria-checked is false', () => {
    mountIsolate(false);
    expect(isAm22IsolateOn()).toBe(false);
  });

  it('wipes, chromes, and imports the checkout corpus', async () => {
    await prepareAm22Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM22_CORPUS_SAMPLE);
    await cleanupAm22();
    expect(deleteWorkflowByName).toHaveBeenCalledWith(AM22_WF_NAME);
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('throws when the checkout gallery import fails', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm22Workspace()).rejects.toThrow(/am-gallery-checkout/);
  });

  it('skips designer navigation when the canvas is already showing', async () => {
    mountDesigner();
    const ctx = makeCtx();
    await ensureAm22OnDesigner(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('navigates to workflow when the designer is missing', async () => {
    const ctx = makeCtx();
    await ensureAm22OnDesigner(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
  });

  it('seeds a blank workflow and collapses the sidebar', async () => {
    const ctx = makeCtx();
    await ensureAm22Designer(ctx);
    expect(ensureLessonBlankWorkflow).toHaveBeenCalled();
    expect(collapseWfDemoAppSidebar).toHaveBeenCalled();
    expect(revealPaletteBlock).toHaveBeenCalled();
  });

  it('skips quiet add when the start node already exists', async () => {
    mountDesigner();
    mountCanvasNode('api-mock-canvas-apiMockStart', AM22_NODE.start);
    const ctx = makeCtx();
    await ensureAm22ForHttp(ctx);
    expect(addWorkflowNodeWithPreset).not.toHaveBeenCalled();
  });

  it('quietly adds missing nodes along the ensure chain', async () => {
    mountDesigner();
    mountTriggerStart();
    addWorkflowNodeWithPreset.mockImplementation((type: string, id: string) => {
      const map: Record<string, string> = {
        apiMockStart: 'api-mock-canvas-apiMockStart',
        apiMockApply: 'api-mock-canvas-apiMockApply',
        apiMockResetState: 'api-mock-canvas-apiMockResetState',
        apiMockAssertCalls: 'api-mock-canvas-apiMockAssertCalls',
        apiMockStop: 'api-mock-canvas-apiMockStop',
      };
      if (type === 'http') mountHttpNode(id);
      else if (map[type]) mountCanvasNode(map[type], id);
      return true;
    });
    const ctx = makeCtx();
    await ensureAm22ForQuickTest(ctx);
    expect(addWorkflowNodeWithPreset).toHaveBeenCalled();
    expect(patchWorkflowNodeDataById).toHaveBeenCalled();
    expect(connectWorkflowNodes).toHaveBeenCalled();
    expect(cleanupWorkflowDemoRunUi).toHaveBeenCalled();
  });

  it('ensure palette / start / apply / reset / assert / stop / wire compose', async () => {
    mountDesigner();
    const ctx = makeCtx();
    await ensureAm22ForPalette(ctx);
    await ensureAm22ForStart(ctx);
    await ensureAm22ForApply(ctx);
    await ensureAm22ForReset(ctx);
    await ensureAm22ForAssert(ctx);
    await ensureAm22ForStop(ctx);
    await ensureAm22ForWire(ctx);
    expect(addWorkflowNodeWithPreset.mock.calls.map(c => String(c[0]))).toEqual(
      expect.arrayContaining(['apiMockStart', 'http', 'apiMockApply', 'apiMockResetState', 'apiMockAssertCalls']),
    );
  });

  it('holds the five mock palette blocks', async () => {
    mountDesigner();
    mountPalette();
    const ctx = makeCtx();
    await runAm22DesignerPalette(ctx);
    expect(revealPaletteBlock).toHaveBeenCalled();
    expect(collapseWfDemoAppSidebar).toHaveBeenCalled();
  });

  it('drops and configures Start, holding isolate when it is already on', async () => {
    mountDesigner();
    mountPalette();
    mountIsolate(true);
    document.body.append(el('div', undefined, 'api-mock-wf-port-vars'));
    document.body.append(input('api-mock-wf-save-port', 'mockPort'));
    document.body.append(input('api-mock-wf-save-base-url', 'mockBaseUrl'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async () => {
      mountCanvasNode('api-mock-canvas-apiMockStart', AM22_NODE.start);
    });
    await runAm22StartNode(ctx);
    expect(selectWfConfigOption).toHaveBeenCalledWith(ctx, API_MOCK.WF_SERVER, AM22_SERVER_ID);
    expect(clickWfConfigControl).not.toHaveBeenCalled();
    expect(holdWfSpotlight).toHaveBeenCalled();
    expect(saveAndCloseWfConfigModal).toHaveBeenCalled();
  });

  it('toggles isolate on when it is off', async () => {
    mountIsolate(false);
    const ctx = makeCtx();
    await am22TestHooks.holdOrEnableIsolate(ctx);
    expect(clickWfConfigControl).toHaveBeenCalledWith(ctx, API_MOCK.WF_ISOLATE);
  });

  it('skips dropping a palette block when the canvas node already exists', async () => {
    mountDesigner();
    mountPalette();
    mountCanvasNode('api-mock-canvas-apiMockStart', AM22_NODE.start);
    const ctx = makeCtx();
    await am22TestHooks.dropFromPalette(ctx, WF.PAL_API_MOCK_START, API_MOCK.CANVAS_START);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('configures HTTP POST {{mockBaseUrl}}/cart', async () => {
    mountDesigner();
    mountPalette();
    const ctx = makeCtx();
    ctx.click.mockImplementation(async () => {
      mountHttpNode();
    });
    await runAm22HttpNode(ctx);
    expect(selectWfConfigOption).toHaveBeenCalledWith(ctx, WF.CFG_HTTP_METHOD, AM22_HTTP_METHOD);
    expect(fillWfConfigField).toHaveBeenCalledWith(ctx, WF.CFG_HTTP_URL, AM22_HTTP_URL);
  });

  it('configures Apply and Reset against Cart API', async () => {
    mountDesigner();
    mountPalette();
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (String(sel).includes('apiMockApply')) {
        mountCanvasNode('api-mock-canvas-apiMockApply', AM22_NODE.apply);
      }
      if (String(sel).includes('apiMockResetState')) {
        mountCanvasNode('api-mock-canvas-apiMockResetState', AM22_NODE.reset);
      }
    });
    await runAm22ApplyNode(ctx);
    await runAm22ResetNode(ctx);
    expect(selectWfConfigOption).toHaveBeenCalledWith(ctx, API_MOCK.WF_SERVER, AM22_SERVER_ID);
    expect(patchWorkflowNodeDataById).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ serverId: AM22_ISOLATED_SERVER }),
    );
  });

  it('fills assert min/status/body/recency and holds header fields', async () => {
    mountDesigner();
    mountPalette();
    document.body.append(input('api-mock-wf-assert-min', ''));
    document.body.append(el('input', undefined, 'api-mock-wf-assert-header'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async () => {
      mountCanvasNode('api-mock-canvas-apiMockAssertCalls', AM22_NODE.assert);
    });
    await runAm22AssertNode(ctx);
    expect(fillWfConfigField).toHaveBeenCalledWith(ctx, API_MOCK.WF_ASSERT_MIN, AM22_ASSERT_MIN);
    expect(fillWfConfigField).toHaveBeenCalledWith(ctx, API_MOCK.WF_ASSERT_STATUS, AM22_ASSERT_STATUS);
    expect(fillWfConfigField).toHaveBeenCalledWith(ctx, API_MOCK.WF_ASSERT_BODY, AM22_ASSERT_BODY);
    expect(fillWfConfigField).toHaveBeenCalledWith(ctx, API_MOCK.WF_ASSERT_RECENCY, AM22_ASSERT_RECENCY);
    expect(holdWfSpotlight).toHaveBeenCalledWith(ctx, API_MOCK.WF_ASSERT_HEADER, AM22_TIMING.look);
  });

  it('holds min count when it is already 1', async () => {
    mountDesigner();
    mountPalette();
    document.body.append(input('api-mock-wf-assert-min', AM22_ASSERT_MIN));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async () => {
      mountCanvasNode('api-mock-canvas-apiMockAssertCalls', AM22_NODE.assert);
    });
    await runAm22AssertNode(ctx);
    expect(fillWfConfigField.mock.calls.map(c => String(c[1]))).not.toContain(API_MOCK.WF_ASSERT_MIN);
    expect(holdWfSpotlight).toHaveBeenCalledWith(ctx, API_MOCK.WF_ASSERT_MIN, AM22_TIMING.look);
  });

  it('drops Stop and saves the config', async () => {
    mountDesigner();
    mountPalette();
    const ctx = makeCtx();
    ctx.click.mockImplementation(async () => {
      mountCanvasNode('api-mock-canvas-apiMockStop', AM22_NODE.stop);
    });
    await runAm22StopNode(ctx);
    expect(saveAndCloseWfConfigModal).toHaveBeenCalled();
  });

  it('wires Start → Apply → HTTP → Assert → Reset → Stop', async () => {
    mountTriggerStart();
    mountCanvasNode('api-mock-canvas-apiMockStart', AM22_NODE.start);
    mountCanvasNode('api-mock-canvas-apiMockApply', AM22_NODE.apply);
    mountHttpNode();
    mountCanvasNode('api-mock-canvas-apiMockAssertCalls', AM22_NODE.assert);
    mountCanvasNode('api-mock-canvas-apiMockResetState', AM22_NODE.reset);
    mountCanvasNode('api-mock-canvas-apiMockStop', AM22_NODE.stop);
    const designer = el('div', 'wf-designer');
    const fit = el('button');
    fit.setAttribute('title', 'Fit view');
    designer.append(fit);
    document.body.append(designer);
    const ctx = makeCtx();
    await runAm22Wire(ctx);
    expect(connectWorkflowNodes).toHaveBeenCalledTimes(6);
  });

  it('wires without Fit View and falls back to a quiet fit', async () => {
    mountTriggerStart();
    mountCanvasNode('api-mock-canvas-apiMockStart', AM22_NODE.start);
    mountCanvasNode('api-mock-canvas-apiMockApply', AM22_NODE.apply);
    mountHttpNode();
    mountCanvasNode('api-mock-canvas-apiMockAssertCalls', AM22_NODE.assert);
    mountCanvasNode('api-mock-canvas-apiMockResetState', AM22_NODE.reset);
    mountCanvasNode('api-mock-canvas-apiMockStop', AM22_NODE.stop);
    const ctx = makeCtx();
    await runAm22Wire(ctx);
    expect(fitWfCanvasQuiet).toHaveBeenCalled();
  });

  it('pays off on Start when the API Mock chip is missing', async () => {
    mountDesigner();
    for (const sel of AM22_ACTION_BLOCKS) {
      document.body.append(el('button', sel.replace('.', '')));
    }
    document.body.append(el('button', 'wf-palette-block-apiMockAssertCalls'));
    const ctx = makeCtx();
    await runAm22DesignerPalette(ctx);
    expect(revealPaletteBlock).toHaveBeenCalled();
  });

  it('reads a bare canvas testid data-id and a non-input value as empty', () => {
    const bare = el('div', undefined, 'api-mock-canvas-apiMockStart');
    bare.setAttribute('data-id', 'bare-start');
    document.body.append(bare);
    expect(am22CanvasNodeId(API_MOCK.CANVAS_START)).toBe('bare-start');
    document.body.append(el('div', undefined, 'api-mock-wf-assert-min'));
    expect(am22InputValue(API_MOCK.WF_ASSERT_MIN)).toBe('');
  });

  it('treats a canvas-only designer as active', () => {
    document.body.append(el('div', 'wf-canvas-area'));
    expect(isAm22DesignerActive()).toBe(true);
  });

  it('skips reconnecting when the graph is already wired', async () => {
    mountDesigner();
    mountTriggerStart();
    mountCanvasNode('api-mock-canvas-apiMockStart', AM22_NODE.start);
    mountCanvasNode('api-mock-canvas-apiMockApply', AM22_NODE.apply);
    mountHttpNode();
    mountCanvasNode('api-mock-canvas-apiMockResetState', AM22_NODE.reset);
    mountCanvasNode('api-mock-canvas-apiMockAssertCalls', AM22_NODE.assert);
    mountCanvasNode('api-mock-canvas-apiMockStop', AM22_NODE.stop);
    for (let i = 0; i < 5; i++) mountEdge();
    const ctx = makeCtx();
    await ensureAm22ForQuickTest(ctx);
    expect(connectWorkflowNodes).not.toHaveBeenCalled();
  });

  it('connectPair no-ops when a node id is missing', async () => {
    const ctx = makeCtx();
    await am22TestHooks.connectPair(ctx, API_MOCK.CANVAS_START, API_MOCK.CANVAS_APPLY);
    expect(connectWorkflowNodes).not.toHaveBeenCalled();
  });

  it('clicks Quick Test when the button is visible', async () => {
    const btn = el('button', 'wf-quick-test-btn');
    document.body.append(btn);
    mountPass('api-mock-canvas-apiMockStart', AM22_NODE.start);
    mountPass('api-mock-canvas-apiMockApply', AM22_NODE.apply);
    const http = mountHttpNode();
    http.classList.add('wf-node-pass');
    mountPass('api-mock-canvas-apiMockAssertCalls', AM22_NODE.assert);
    mountPass('api-mock-canvas-apiMockResetState', AM22_NODE.reset);
    mountPass('api-mock-canvas-apiMockStop', AM22_NODE.stop);
    const ctx = makeCtx();
    await runAm22QuickTest(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST);
    expect(triggerWorkflowQuickTest).not.toHaveBeenCalled();
  });

  it('falls back to the Quick Test bridge when the button is missing', async () => {
    mountPass('api-mock-canvas-apiMockStart', AM22_NODE.start);
    mountPass('api-mock-canvas-apiMockApply', AM22_NODE.apply);
    const http = mountHttpNode();
    http.classList.add('wf-node-pass');
    mountPass('api-mock-canvas-apiMockAssertCalls', AM22_NODE.assert);
    mountPass('api-mock-canvas-apiMockResetState', AM22_NODE.reset);
    mountPass('api-mock-canvas-apiMockStop', AM22_NODE.stop);
    const ctx = makeCtx();
    await runAm22QuickTest(ctx);
    expect(triggerWorkflowQuickTest).toHaveBeenCalled();
  });

  it('bindIsolatedServer no-ops on a null id', () => {
    am22TestHooks.bindIsolatedServer(null);
    expect(patchWorkflowNodeDataById).not.toHaveBeenCalled();
    am22TestHooks.bindIsolatedServer('n1');
    expect(patchWorkflowNodeDataById).toHaveBeenCalledWith('n1', { serverId: AM22_ISOLATED_SERVER });
  });

  it('quietAdd skips when the canvas selector already exists', () => {
    mountCanvasNode('api-mock-canvas-apiMockStart', AM22_NODE.start);
    am22TestHooks.quietAdd('apiMockStart', AM22_NODE.start, 'Start Mock Server', { x: 1, y: 1 }, API_MOCK.CANVAS_START);
    expect(addWorkflowNodeWithPreset).not.toHaveBeenCalled();
  });

  it('dismisses an onboarding tooltip when present', async () => {
    const skip = el('button', 'onboarding-tooltip-skip');
    const click = vi.fn();
    skip.click = click;
    document.body.append(skip);
    const ctx = makeCtx();
    await am22TestHooks.dismissWfOnboarding(ctx);
    expect(click).toHaveBeenCalled();
    await am22TestHooks.dismissWfOnboarding(ctx);
  });

  it('aim / clickNow / fillNow drive the beat helpers', async () => {
    const btn = el('button', undefined, 'api-mock-wf-server');
    document.body.append(btn);
    document.body.append(input('api-mock-wf-assert-status', ''));
    const ctx = makeCtx();
    await am22TestHooks.am22Aim(ctx, API_MOCK.WF_SERVER);
    await am22TestHooks.am22ClickNow(ctx, API_MOCK.WF_SERVER);
    await am22TestHooks.am22FillNow(ctx, API_MOCK.WF_ASSERT_STATUS, AM22_ASSERT_STATUS);
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.WF_ASSERT_STATUS, AM22_ASSERT_STATUS);
  });

  it('hasAm22AllGreen when every lifecycle node passed', () => {
    mountPass('api-mock-canvas-apiMockStart', AM22_NODE.start);
    mountPass('api-mock-canvas-apiMockApply', AM22_NODE.apply);
    const http = mountHttpNode();
    http.classList.add('wf-node-pass');
    mountPass('api-mock-canvas-apiMockAssertCalls', AM22_NODE.assert);
    mountPass('api-mock-canvas-apiMockResetState', AM22_NODE.reset);
    mountPass('api-mock-canvas-apiMockStop', AM22_NODE.stop);
    expect(hasAm22AllGreen()).toBe(true);
  });
});
