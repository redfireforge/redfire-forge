/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reqMultiEnvLesson } from './req-multi-env';
import { makeCtx, makeVisible } from '../protocols/ws-test-utils';
import { REQ } from '@shared/selectors';

function visibleDiv(selector: string, attrs: Record<string, string> = {}): HTMLDivElement {
  const el = document.createElement('div');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (selector.startsWith('[data-testid="') && selector.endsWith('"]')) {
    const testId = selector.slice(13, -2);
    el.setAttribute('data-testid', testId);
  }
  makeVisible(el);
  el.scrollIntoView = vi.fn();
  return el;
}

describe('req-multi-env lesson request selection stability', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function seedSidebarAndEditor(): { requestEl: HTMLDivElement } {
    const group = document.createElement('div');
    group.className = 'req-col-group';
    makeVisible(group);

    const col = document.createElement('div');
    col.setAttribute('data-col-name', 'DummyJSON');
    col.setAttribute('data-testid', 'req-col-item');
    makeVisible(col);
    col.scrollIntoView = vi.fn();

    const list = document.createElement('div');
    list.className = 'req-req-list';
    makeVisible(list);

    const req = document.createElement('div');
    req.setAttribute('data-req-name', 'Search Laptops');
    req.setAttribute('data-testid', 'req-req-item');
    makeVisible(req);
    req.scrollIntoView = vi.fn();
    req.click = vi.fn();

    list.appendChild(req);
    group.appendChild(col);
    group.appendChild(list);
    document.body.appendChild(group);

    const urlInput = document.createElement('input');
    urlInput.setAttribute('data-testid', 'req-url-input');
    urlInput.value = '/products/search?q=laptop&limit=3';
    makeVisible(urlInput);
    urlInput.scrollIntoView = vi.fn();
    document.body.appendChild(urlInput);

    const resolved = visibleDiv(REQ.RESOLVED_URL);
    resolved.textContent = 'https://dummyjson.com/products/search?q=laptop&limit=3';
    document.body.appendChild(resolved);

    const envBar = visibleDiv(REQ.ENV_BAR);
    document.body.appendChild(envBar);

    const prodPill = visibleDiv(REQ.envPillByName('production'), {
      'data-testid': 'req-env-pill',
      'data-env-name': 'production',
    });
    document.body.appendChild(prodPill);

    const stagingPill = visibleDiv(REQ.envPillByName('staging'), {
      'data-testid': 'req-env-pill',
      'data-env-name': 'staging',
    });
    document.body.appendChild(stagingPill);

    return { requestEl: req };
  }

  it('step req3-request explicitly selects Search Laptops at step end', async () => {
    const ctx = makeCtx();
    const { requestEl } = seedSidebarAndEditor();

    const step = reqMultiEnvLesson.steps.find((s) => s.id === 'req3-request');
    expect(step?.action).toBeTypeOf('function');

    await step!.action!(ctx);

    // Regression guard: the step must re-select the created request before finishing.
    expect(requestEl.click).toHaveBeenCalled();
  });

  it('step req3-switch preAction selects Search Laptops before running', async () => {
    const ctx = makeCtx();
    const { requestEl } = seedSidebarAndEditor();

    const step = reqMultiEnvLesson.steps.find((s) => s.id === 'req3-switch');
    expect(step?.preAction).toBeTypeOf('function');

    await step!.preAction!(ctx);

    expect(requestEl.click).toHaveBeenCalled();
  });

});
