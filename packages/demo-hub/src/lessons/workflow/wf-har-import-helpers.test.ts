/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WF } from '@shared/selectors';
import { makeCtx } from '../protocols/ws-test-utils';

const deleteWorkflowByName = vi.fn(() => true);
const fitWorkflowCanvasView = vi.fn(() => true);
const getWorkflowByName = vi.fn(() => null as unknown);
const triggerHarImportWithFixture = vi.fn(() => true);
const waitForWorkflowBridge = vi.fn(async () => true);

vi.mock('../../adapters', () => ({
  deleteWorkflowByName: (...a: unknown[]) => deleteWorkflowByName(...(a as [])),
  fitWorkflowCanvasView: (...a: unknown[]) => fitWorkflowCanvasView(...(a as [])),
  getWorkflowByName: (...a: unknown[]) => getWorkflowByName(...(a as [])),
  triggerHarImportWithFixture: (...a: unknown[]) => triggerHarImportWithFixture(...(a as [])),
  waitForWorkflowBridge: (...a: unknown[]) => waitForWorkflowBridge(...(a as [])),
}));

const showSpotlightRing = vi.fn(() => vi.fn());
vi.mock('../../demoRipple', () => ({
  showSpotlightRing: (...a: unknown[]) => showSpotlightRing(...(a as [])),
}));

import {
  HAR_IMPORT_WF_NAME,
  HAR_IMPORT_DEFAULT_NAME,
  HAR_FIXTURE,
  HAR_FIXTURE_FILENAME,
  deleteHarImportLessonWorkflows,
  fillHarWorkflowNameQuiet,
  ensureHarPreviewModal,
  ensureHarImportWorkflow,
  clickHarImportFitView,
  waitForHarImportQuickTest,
} from './wf-har-import-helpers';

describe('wf-har-import helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    deleteWorkflowByName.mockClear().mockReturnValue(true);
    fitWorkflowCanvasView.mockClear().mockReturnValue(true);
    getWorkflowByName.mockClear().mockReturnValue(null);
    triggerHarImportWithFixture.mockClear().mockReturnValue(true);
    waitForWorkflowBridge.mockClear().mockResolvedValue(true);
    showSpotlightRing.mockClear().mockReturnValue(vi.fn());
  });

  it('deleteHarImportLessonWorkflows removes authored, default, and leftover petstore names', () => {
    deleteHarImportLessonWorkflows();
    expect(deleteWorkflowByName).toHaveBeenCalledWith(HAR_IMPORT_WF_NAME);
    expect(deleteWorkflowByName).toHaveBeenCalledWith(HAR_IMPORT_DEFAULT_NAME);
    expect(deleteWorkflowByName).toHaveBeenCalledWith('Petstore Session');
    expect(deleteWorkflowByName).toHaveBeenCalledWith('api.petstore.example.com import');
  });

  it('HAR fixture targets JSONPlaceholder with an Authorization header', () => {
    const har = JSON.parse(HAR_FIXTURE) as {
      log: { entries: Array<{
        request: { method: string; url: string; headers: Array<{ name: string }> };
        response: { content: { text: string } };
      }> };
    };
    expect(har.log.entries).toHaveLength(3);
    expect(har.log.entries.every((e) => e.request.method === 'GET')).toBe(true);
    expect(har.log.entries[0].request.url).toBe('https://jsonplaceholder.typicode.com/posts/100');
    expect(har.log.entries[1].request.url).toContain('/comments/100');
    expect(har.log.entries[2].request.url).toContain('/posts/100/comments');
    expect(har.log.entries.some((e) => e.request.headers.some((h) => h.name === 'Authorization'))).toBe(true);
    expect(JSON.parse(har.log.entries[0].response.content.text).id).toBe(100);
  });

  it('fillHarWorkflowNameQuiet writes the authored name into the input', () => {
    document.body.innerHTML = `<input data-testid="har-import-wf-name" value="jsonplaceholder.typicode.com import" />`;
    fillHarWorkflowNameQuiet();
    const input = document.querySelector<HTMLInputElement>(WF.HAR_WORKFLOW_NAME);
    expect(input?.value).toBe(HAR_IMPORT_WF_NAME);
  });

  it('fillHarWorkflowNameQuiet is a no-op when the input is missing', () => {
    expect(() => fillHarWorkflowNameQuiet()).not.toThrow();
  });

  it('ensureHarPreviewModal skips when the modal is already open', async () => {
    document.body.innerHTML = `<div class="har-import-modal"></div>`;
    const ctx = makeCtx();
    await ensureHarPreviewModal(ctx);
    expect(triggerHarImportWithFixture).not.toHaveBeenCalled();
  });

  it('ensureHarPreviewModal injects the fixture when the modal is missing', async () => {
    const ctx = makeCtx();
    ctx.waitFor = vi.fn().mockImplementation(async () => {
      document.body.innerHTML = `<div class="har-import-modal"></div>`;
    });
    await ensureHarPreviewModal(ctx);
    expect(triggerHarImportWithFixture).toHaveBeenCalledWith(HAR_FIXTURE, HAR_FIXTURE_FILENAME);
    expect(ctx.waitFor).toHaveBeenCalledWith(WF.HAR_MODAL, 4000);
  });

  it('ensureHarPreviewModal waits for the bridge when the first inject fails', async () => {
    triggerHarImportWithFixture.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const ctx = makeCtx();
    ctx.waitFor = vi.fn().mockResolvedValue(undefined);
    await ensureHarPreviewModal(ctx);
    expect(waitForWorkflowBridge).toHaveBeenCalled();
    expect(triggerHarImportWithFixture).toHaveBeenCalledTimes(2);
  });

  it('ensureHarImportWorkflow skips when the named workflow already exists', async () => {
    getWorkflowByName.mockReturnValue({ name: HAR_IMPORT_WF_NAME });
    const ctx = makeCtx();
    await ensureHarImportWorkflow(ctx);
    expect(triggerHarImportWithFixture).not.toHaveBeenCalled();
  });

  it('ensureHarImportWorkflow confirms quietly when the workflow is missing', async () => {
    document.body.innerHTML = `
      <div class="har-import-modal">
        <input data-testid="har-import-wf-name" value="default" />
        <button data-testid="har-import-confirm">Import</button>
      </div>
    `;
    const confirm = document.querySelector<HTMLButtonElement>(WF.HAR_MODAL_CONFIRM)!;
    const click = vi.spyOn(confirm, 'click');
    const ctx = makeCtx();
    await ensureHarImportWorkflow(ctx);
    expect(document.querySelector<HTMLInputElement>(WF.HAR_WORKFLOW_NAME)?.value).toBe(HAR_IMPORT_WF_NAME);
    expect(click).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('clickHarImportFitView clicks the visible Fit View button', async () => {
    document.body.innerHTML = `<div class="wf-designer"><button title="Fit view">Fit</button></div>`;
    const btn = document.querySelector<HTMLButtonElement>(WF.FIT_VIEW_BTN)!;
    const click = vi.spyOn(btn, 'click');
    const ctx = makeCtx();
    await clickHarImportFitView(ctx);
    expect(showSpotlightRing).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(fitWorkflowCanvasView).not.toHaveBeenCalled();
  });

  it('clickHarImportFitView falls back to the bridge when Fit View is missing', async () => {
    const ctx = makeCtx();
    await clickHarImportFitView(ctx);
    expect(fitWorkflowCanvasView).toHaveBeenCalledWith({
      duration: 400,
      padding: 0.15,
      maxZoom: 1,
      minZoom: 0.4,
    });
  });

  it('waitForHarImportQuickTest returns once the console shows Workflow PASS', async () => {
    document.body.innerHTML = `<div class="wf-console-panel">Workflow PASS - 3 step(s)</div>`;
    const ctx = makeCtx();
    await waitForHarImportQuickTest(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('waitForHarImportQuickTest returns once the console shows Workflow FAIL', async () => {
    document.body.innerHTML = `<div class="wf-console-panel">Workflow FAIL - 3 step(s)</div>`;
    const ctx = makeCtx();
    await waitForHarImportQuickTest(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('waitForHarImportQuickTest times out when the run never finishes', async () => {
    document.body.innerHTML = `<div class="wf-console-panel">Workflow run started</div>`;
    const ctx = makeCtx();
    await waitForHarImportQuickTest(ctx);
    expect(ctx.delay).toHaveBeenCalledTimes(48);
  });
});
