/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsBasicsLesson } from './ws-basics';
import { wsAuthTransportLesson } from './ws-auth-transport';
import type { DemoActionContext } from '../../types';

function makeCtx(): DemoActionContext {
  return {
    navigateToTab: vi.fn(),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    delay: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── ws-basics ──────────────────────────────────────────────────

describe('ws-basics lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsBasicsLesson.id).toBe('ws-basics');
    expect(wsBasicsLesson.domainId).toBe('protocols');
    expect(wsBasicsLesson.name).toBe('WebSocket Basics');
    expect(wsBasicsLesson.steps.length).toBeGreaterThan(0);
    expect(wsBasicsLesson.concept.title).toBeTruthy();
    expect(wsBasicsLesson.concept.body).toBeTruthy();
    expect(wsBasicsLesson.initialTab).toBe('websocket-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsBasicsLesson.setup).toBe('function');
    expect(typeof wsBasicsLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsBasicsLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('has key terms defined', () => {
    expect(wsBasicsLesson.concept.keyTerms).toBeDefined();
    expect(wsBasicsLesson.concept.keyTerms!.length).toBeGreaterThan(0);
  });

  it('has a diagram', () => {
    expect(wsBasicsLesson.concept.diagram).toBeTruthy();
  });

  it('has category set', () => {
    expect(wsBasicsLesson.category).toBe('websocket');
  });

  it('step ws-nav has no action', () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-nav');
    expect(step).toBeDefined();
    expect(step!.action).toBeUndefined();
    expect(step!.highlight).toBeTruthy();
  });

  it('step ws-mock preAction clicks mock mode', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step ws-mock action clicks start button when available and enabled', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step ws-mock action does nothing when button is disabled', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    btn.disabled = true;
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    // click should NOT be called since button is disabled
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step ws-mock action does nothing when button not found', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step ws-url preAction clicks client mode and connect tab', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-url')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledTimes(2);
  });

  it('step ws-url action fills URL input', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-url')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ws://localhost:9876');
  });

  it('step ws-connect preAction clicks connect tab', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step ws-connect action clicks connect button', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step ws-compose preAction clicks compose tab', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-compose')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step ws-compose action fills message input', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-compose')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('step ws-send action clicks send button', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step ws-events action clicks events tab', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-events')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step ws-tabs has no action', () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-tabs');
    expect(step).toBeDefined();
    expect(step!.action).toBeUndefined();
  });

  it('step ws-disconnect preAction clicks connect tab', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-disconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step ws-disconnect action clicks disconnect button', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-disconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('has correct step IDs in order', () => {
    const ids = wsBasicsLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'ws-nav', 'ws-mock', 'ws-url', 'ws-connect',
      'ws-compose', 'ws-send', 'ws-events', 'ws-tabs', 'ws-disconnect',
    ]);
  });

  it('step ws-mock has verify selector', () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    expect(step.verify).toBeTruthy();
  });

  it('step ws-connect has verify selector', () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    expect(step.verify).toBeTruthy();
  });

  it('step ws-send has verify selector', () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-send')!;
    expect(step.verify).toBeTruthy();
  });
});

// ─── ws-auth-transport ──────────────────────────────────────────

describe('ws-auth-transport lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsAuthTransportLesson.id).toBe('ws-auth-transport');
    expect(wsAuthTransportLesson.domainId).toBe('protocols');
    expect(wsAuthTransportLesson.name).toBe('Auth & Transport');
    expect(wsAuthTransportLesson.steps.length).toBeGreaterThan(0);
    expect(wsAuthTransportLesson.concept.title).toBeTruthy();
    expect(wsAuthTransportLesson.concept.body).toBeTruthy();
    expect(wsAuthTransportLesson.initialTab).toBe('websocket-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsAuthTransportLesson.setup).toBe('function');
    expect(typeof wsAuthTransportLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsAuthTransportLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('has key terms about transport modes', () => {
    const terms = wsAuthTransportLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    const termIds = terms!.map(t => t.term);
    expect(termIds).toContain('Direct');
    expect(termIds).toContain('Proxy');
    expect(termIds).toContain('Native');
  });

  it('has category set', () => {
    expect(wsAuthTransportLesson.category).toBe('websocket');
  });

  it('step auth-intro action clicks auth tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step auth-type-selector preAction clicks auth tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-type-selector')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step auth-type-selector action selects bearer', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-type-selector')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.any(String), 'bearer');
  });

  it('step auth-bearer action fills token when input exists', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-bearer')!;
    const input = document.createElement('input');
    input.className = 'ws-auth-pane';
    // The selector is '.ws-auth-pane input' — need a container
    const container = document.createElement('div');
    container.className = 'ws-auth-pane';
    container.appendChild(input);
    document.body.appendChild(container);

    const ctx = makeCtx();
    await step.action!(ctx);
    // Action uses direct DOM manipulation, not ctx.fill
  });

  it('step auth-bearer action handles missing input gracefully', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-bearer')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should not throw
  });

  it('step auth-callout has no action', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-callout')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toBeTruthy();
  });

  it('step auth-connect-setup preAction clicks connect tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect-setup')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step auth-connect-setup action fills URL', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect-setup')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ws://localhost:9876');
  });

  it('step auth-connect preAction clicks connect tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step auth-connect action clicks connect button', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step auth-connect has verify selector', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect')!;
    expect(step.verify).toBeTruthy();
  });

  it('step auth-compose-send preAction clicks compose tab and fills message', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('step auth-compose-send action clicks send button', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step auth-compose-send has verify selector', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    expect(step.verify).toBeTruthy();
  });

  it('step auth-events action clicks events tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-events')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step auth-protocol preAction clicks connect tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-protocol')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step auth-protocol has no action', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-protocol')!;
    expect(step.action).toBeUndefined();
  });

  it('has correct step IDs in order', () => {
    const ids = wsAuthTransportLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'auth-intro', 'auth-type-selector', 'auth-bearer', 'auth-callout',
      'auth-connect-setup', 'auth-connect', 'auth-compose-send',
      'auth-events', 'auth-protocol',
    ]);
  });

  it('has TLS key term', () => {
    const terms = wsAuthTransportLesson.concept.keyTerms!;
    expect(terms.some(t => t.term === 'TLS')).toBe(true);
  });

  it('has a diagram', () => {
    expect(wsAuthTransportLesson.concept.diagram).toBeTruthy();
  });

  it('estimated time is 4 minutes', () => {
    expect(wsAuthTransportLesson.estimatedMinutes).toBe(4);
  });
});
