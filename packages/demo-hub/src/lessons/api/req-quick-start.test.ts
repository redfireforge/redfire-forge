/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { reqQuickStartLesson } from './req-quick-start';
import { makeCtx } from '../protocols/ws-test-utils';

describe('req-quick-start lesson (v2)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has expected quick-start identity', () => {
    expect(reqQuickStartLesson.id).toBe('req-quick-start');
    expect(reqQuickStartLesson.domainId).toBe('api');
    expect(reqQuickStartLesson.name).toBe('Quick Start');
    expect(reqQuickStartLesson.estimatedMinutes).toBe(3);
    expect(reqQuickStartLesson.steps).toHaveLength(4);
    expect(reqQuickStartLesson.allowedTabs).toEqual(['requests']);
  });

  it('has the 4 consolidated v2 steps (from scratch) in order', () => {
    const ids = reqQuickStartLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'req1-create-collection',
      'req1-add-request',
      'req1-send',
      'req1-explore',
    ]);
  });

  it('step 1 preAction navigates to requests tab', async () => {
    const ctx = makeCtx();
    const step = reqQuickStartLesson.steps[0];
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('requests');
  });

  it('step 2 preAction navigates to requests tab', async () => {
    const ctx = makeCtx();
    const step = reqQuickStartLesson.steps[1];
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('requests');
  });

  it('concept has 3 key terms', () => {
    expect(reqQuickStartLesson.concept.keyTerms).toHaveLength(3);
    const terms = reqQuickStartLesson.concept.keyTerms!.map((kt) => kt.term);
    expect(terms).toContain('Collection');
    expect(terms).toContain('Request');
    expect(terms).toContain('Response History');
  });

  it('step 2 action creates Get Users when only a leftover editor is open', async () => {
    // Simulate an unrelated ENV request already open (has URL input) but no My API request yet.
    document.body.innerHTML = `
      <div data-testid="req-sidebar">
        <div class="req-col-group">
          <div data-testid="req-col-item" data-col-name="My API"></div>
          <div class="req-req-list" style="display:block;height:40px"></div>
        </div>
      </div>
      <div data-testid="req-tab-bar">
        <div role="tab" aria-selected="true">
          <span data-testid="req-tab-label">Rest RuleFact API</span>
        </div>
      </div>
      <div data-testid="req-editor">
        <div data-testid="req-method-select"><button>GET</button></div>
        <input data-testid="req-url-input" value="/users" />
      </div>
      <div data-testid="req-context-menu" style="display:block;width:10px;height:10px">
        <button>Add Request</button>
      </div>
      <div data-testid="req-new-request-prompt" style="display:block;width:10px;height:10px">
        <input data-testid="req-new-request-name" />
        <button class="btn-primary">Create</button>
      </div>
    `;

    Element.prototype.scrollIntoView = () => {};

    const ctx = makeCtx();
    const makeVisible = (el: Element | null) => {
      if (!el) return;
      Object.defineProperty(el, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100, x: 0, y: 0, toJSON: () => ({}) }),
      });
    };
    makeVisible(document.querySelector('[data-col-name="My API"]'));
    makeVisible(document.querySelector('[data-testid="req-context-menu"]'));
    makeVisible(document.querySelector('[data-testid="req-new-request-prompt"]'));
    makeVisible(document.querySelector('[data-testid="req-url-input"]'));
    makeVisible(document.querySelector('[data-testid="req-method-select"]'));

    // After Create, simulate the lesson request appearing under My API
    const urlInput = document.querySelector('[data-testid="req-url-input"]') as HTMLInputElement;
    const createBtn = document.querySelector('.btn-primary') as HTMLButtonElement;
    createBtn.addEventListener('click', () => {
      const list = document.querySelector('.req-req-list');
      const item = document.createElement('div');
      item.setAttribute('data-testid', 'req-req-item');
      item.setAttribute('data-req-name', 'Get Users');
      makeVisible(item);
      list?.appendChild(item);
      urlInput.value = '';
      const tabLabel = document.querySelector('[data-testid="req-tab-label"]');
      if (tabLabel) tabLabel.textContent = 'Get Users';
    });

    const step = reqQuickStartLesson.steps[1];
    await step.action!(ctx);

    expect(urlInput.value).toBe('https://jsonplaceholder.typicode.com/users');
    expect(document.querySelector('[data-req-name="Get Users"]')).toBeTruthy();
  });
});
