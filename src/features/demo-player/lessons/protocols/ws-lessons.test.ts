/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsMockServerLesson } from './ws-mock-server';
import { wsBasicsLesson } from './ws-basics';
import { wsConsoleLesson } from './ws-console';
import { wsTabsLesson } from './ws-tabs';
import { wsAuthTransportLesson } from './ws-auth-transport';
import { wsFilteringLesson } from './ws-filtering';
import { wsLoadTestingLesson } from './ws-load-testing';
import { sseStudioLesson } from './sse-studio';
import { wsWorkflowBuilderLesson } from './ws-workflow-builder';
import { wsSocketIoLesson } from './ws-socketio';
import { wsStompLesson } from './ws-stomp';
import { wsGraphqlLesson } from './ws-graphql';
import { wsMockServerAdvancedLesson } from './ws-mock-server-advanced';
import { wsWorkspaceLesson } from './ws-workspace';
import { wsReliabilityLesson } from './ws-reliability';
import { wsSessionRecordingLesson } from './ws-session-recording';
import { wsPowerUserLesson } from './ws-power-user';
import { sseStudioAdvancedLesson } from './sse-studio-advanced';
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

  it('step auth-compose-send preAction clicks compose tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step auth-compose-send action fills message and clicks send', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalled();
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

  it('all steps have pauseAfter: true', () => {
    for (const step of wsAuthTransportLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('step auth-compose-send highlights compose tab', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    expect(step.highlight).toContain('compose');
  });
});

// ─── ws-mock-server ─────────────────────────────────────────────

describe('ws-mock-server lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsMockServerLesson.id).toBe('ws-mock-server');
    expect(wsMockServerLesson.domainId).toBe('protocols');
    expect(wsMockServerLesson.name).toBe('Mock Server');
    expect(wsMockServerLesson.steps.length).toBe(7);
    expect(wsMockServerLesson.concept.title).toBeTruthy();
    expect(wsMockServerLesson.concept.body).toBeTruthy();
    expect(wsMockServerLesson.initialTab).toBe('websocket-studio');
  });

  it('has cleanup but no setup (mock IS the setup)', () => {
    expect(wsMockServerLesson.setup).toBeUndefined();
    expect(typeof wsMockServerLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsMockServerLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('has key terms defined', () => {
    expect(wsMockServerLesson.concept.keyTerms).toBeDefined();
    expect(wsMockServerLesson.concept.keyTerms!.length).toBe(3);
    const termNames = wsMockServerLesson.concept.keyTerms!.map(t => t.term);
    expect(termNames).toContain('Echo');
    expect(termNames).toContain('Broadcast');
    expect(termNames).toContain('Mock Server');
  });

  it('has a diagram', () => {
    expect(wsMockServerLesson.concept.diagram).toBeTruthy();
  });

  it('has category set', () => {
    expect(wsMockServerLesson.category).toBe('websocket');
  });

  it('estimated time is 2 minutes', () => {
    expect(wsMockServerLesson.estimatedMinutes).toBe(2);
  });

  it('has correct step IDs in order', () => {
    const ids = wsMockServerLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'mock-intro', 'mock-start', 'mock-status',
      'mock-connect', 'mock-echo', 'mock-broadcast', 'mock-stop',
    ]);
  });

  // ─── Step: mock-intro ───────────────────────────────────────

  it('step mock-intro action clicks mock mode and waits', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.delay).toHaveBeenCalledWith(400);
  });

  it('step mock-intro highlights the mock mode toggle', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-intro')!;
    expect(step.highlight).toContain('mode-mock');
  });

  // ─── Step: mock-start ───────────────────────────────────────

  it('step mock-start clicks start button when available and enabled', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-start')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-start-btn'));
  });

  it('step mock-start does nothing when button is disabled', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-start')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    btn.disabled = true;
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step mock-start does nothing when button not found', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-start')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step mock-start has verify selector', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-start')!;
    expect(step.verify).toBeTruthy();
  });

  // ─── Step: mock-status ──────────────────────────────────────

  it('step mock-status has no action (informational)', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-status')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toBeTruthy();
  });

  // ─── Step: mock-connect ─────────────────────────────────────

  it('step mock-connect preAction switches to client mode and fills URL', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-connect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ws://localhost:9876');
  });

  it('step mock-connect action clicks connect button', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step mock-connect has verify selector', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-connect')!;
    expect(step.verify).toBeTruthy();
  });

  // ─── Step: mock-echo ────────────────────────────────────────

  it('step mock-echo preAction clicks compose tab and fills message', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-echo')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('step mock-echo action clicks send button', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-echo')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  it('step mock-echo has verify selector', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-echo')!;
    expect(step.verify).toBeTruthy();
  });

  // ─── Step: mock-broadcast ───────────────────────────────────

  it('step mock-broadcast preAction switches to mock mode', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
  });

  it('step mock-broadcast preAction switches to mock mode and fills', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.delay).toHaveBeenCalledWith(300);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('mock-broadcast-input'),
      'Server broadcast: welcome everyone!',
    );
  });

  it('step mock-broadcast highlights broadcast button', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast')!;
    expect(step.highlight).toContain('mock-broadcast-btn');
  });

  it('step mock-broadcast has no action (interactive)', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast')!;
    expect(step.action).toBeUndefined();
  });

  // ─── Step: mock-stop ────────────────────────────────────────

  it('step mock-stop clicks stop button when available and enabled', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-stop')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-stop-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-stop-btn'));
  });

  it('step mock-stop does nothing when button is disabled', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-stop')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-stop-btn');
    btn.disabled = true;
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step mock-stop does nothing when button not found', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-stop')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step mock-stop has verify selector for start button', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-stop')!;
    expect(step.verify).toContain('mock-start-btn');
  });

  // ─── Cleanup ────────────────────────────────────────────────

  it('cleanup function exists and is callable', async () => {
    const ctx = makeCtx();
    await wsMockServerLesson.cleanup!(ctx);
    // Should call disconnect, stop mock, switch to client
    expect(ctx.click).toHaveBeenCalled();
  });
});

// ─── ws-console ─────────────────────────────────────────────────

describe('ws-console lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsConsoleLesson.id).toBe('ws-console');
    expect(wsConsoleLesson.domainId).toBe('protocols');
    expect(wsConsoleLesson.category).toBe('websocket');
    expect(wsConsoleLesson.name).toBe('Console & Debugging');
    expect(wsConsoleLesson.steps.length).toBe(9);
    expect(wsConsoleLesson.concept.title).toBeTruthy();
    expect(wsConsoleLesson.concept.body).toBeTruthy();
    expect(wsConsoleLesson.initialTab).toBe('websocket-studio');
  });

  it('has both setup and cleanup', () => {
    expect(typeof wsConsoleLesson.setup).toBe('function');
    expect(typeof wsConsoleLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsConsoleLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('has key terms defined', () => {
    expect(wsConsoleLesson.concept.keyTerms).toBeDefined();
    expect(wsConsoleLesson.concept.keyTerms!.length).toBe(3);
    const termNames = wsConsoleLesson.concept.keyTerms!.map(t => t.term);
    expect(termNames).toContain('Lifecycle Event');
    expect(termNames).toContain('Slash Command');
    expect(termNames).toContain('Category Filter');
  });

  it('has a diagram', () => {
    expect(wsConsoleLesson.concept.diagram).toBeTruthy();
  });

  it('estimated time is 3 minutes', () => {
    expect(wsConsoleLesson.estimatedMinutes).toBe(3);
  });

  it('has correct step IDs in order', () => {
    const ids = wsConsoleLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'console-intro', 'console-connect', 'console-lifecycle', 'console-categories',
      'console-send', 'console-help', 'console-clear',
      'console-search', 'console-views',
    ]);
  });

  // ─── Step: console-intro ────────────────────────────────────

  it('step console-intro preAction switches to client mode', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.delay).toHaveBeenCalledWith(200);
  });

  it('step console-intro action clicks console tab', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
  });

  it('step console-intro highlights the console tab', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-intro')!;
    expect(step.highlight).toContain('right-tab-console');
  });

  // ─── Step: console-connect ──────────────────────────────────

  it('step console-connect fills /connect command and submits', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-connect')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/connect ws://localhost:9876',
    );
    expect(ctx.delay).toHaveBeenCalledWith(1500);
  });

  it('step console-connect dispatches Enter key on input', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-connect')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);
    const spy = vi.spyOn(input, 'dispatchEvent');

    const ctx = makeCtx();
    await step.action!(ctx);
    const enterCalls = spy.mock.calls.filter(
      c => c[0] instanceof KeyboardEvent && (c[0] as KeyboardEvent).key === 'Enter',
    );
    expect(enterCalls.length).toBe(1);
  });

  // ─── Step: console-lifecycle ────────────────────────────────

  it('step console-lifecycle is informational (no action)', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-lifecycle')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toBeTruthy();
  });

  // ─── Step: console-categories ───────────────────────────────

  it('step console-categories selects lifecycle category', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-categories')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-category'),
      'lifecycle',
    );
  });

  it('step console-categories highlights category dropdown', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-categories')!;
    expect(step.highlight).toContain('ws-console-category');
  });

  // ─── Step: console-send ─────────────────────────────────────

  it('step console-send preAction resets category filter', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-category'),
      'all',
    );
  });

  it('step console-send action fills command input', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/send {"demo": "console command"}',
    );
  });

  it('step console-send dispatches Enter key on input', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-send')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);
    const spy = vi.spyOn(input, 'dispatchEvent');

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(spy).toHaveBeenCalled();
    const event = spy.mock.calls[0][0] as KeyboardEvent;
    expect(event.key).toBe('Enter');
  });

  // ─── Step: console-help ─────────────────────────────────────

  it('step console-help action fills /help and submits', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-help')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/help',
    );
  });

  it('step console-help dispatches Enter key on input', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-help')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);
    const spy = vi.spyOn(input, 'dispatchEvent');

    const ctx = makeCtx();
    await step.action!(ctx);
    const enterCalls = spy.mock.calls.filter(
      c => c[0] instanceof KeyboardEvent && (c[0] as KeyboardEvent).key === 'Enter',
    );
    expect(enterCalls.length).toBe(1);
  });

  // ─── Step: console-clear ────────────────────────────────────

  it('step console-clear is informational (no action)', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-clear')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toContain('ws-console-clear');
  });

  // ─── Step: console-search ───────────────────────────────────

  it('step console-search fills search input', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-search')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-search'),
      'connect',
    );
  });

  it('step console-search highlights search input', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-search')!;
    expect(step.highlight).toContain('ws-console-search');
  });

  // ─── Step: console-views ────────────────────────────────────

  it('step console-views preAction clears search', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-views')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-search'),
      '',
    );
  });

  it('step console-views action clicks raw view', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-views')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-view-raw'),
    );
  });

  it('step console-views highlights raw view button', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-views')!;
    expect(step.highlight).toContain('ws-console-view-raw');
  });

  // ─── Setup & Cleanup ───────────────────────────────────────

  it('setup starts mock server and switches to client mode', async () => {
    const ctx = makeCtx();
    await wsConsoleLesson.setup!(ctx);
    // wsSetup: click mock mode → start mock → click client mode
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('cleanup is callable', async () => {
    const ctx = makeCtx();
    await wsConsoleLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });
});

// ─── ws-tabs ────────────────────────────────────────────────────

describe('ws-tabs lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ─── Structure ──────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(wsTabsLesson.id).toBe('ws-tabs');
    expect(wsTabsLesson.domainId).toBe('protocols');
    expect(wsTabsLesson.category).toBe('websocket');
    expect(wsTabsLesson.name).toBe('Tabs & Multi-Connection');
    expect(wsTabsLesson.initialTab).toBe('websocket-studio');
    expect(wsTabsLesson.estimatedMinutes).toBe(3);
  });

  it('has concept with title, body, keyTerms, and diagram', () => {
    expect(wsTabsLesson.concept).toBeDefined();
    expect(wsTabsLesson.concept!.title).toBe('Connection Tabs');
    expect(wsTabsLesson.concept!.body).toContain('multiple WebSocket connections');
    expect(wsTabsLesson.concept!.keyTerms!.length).toBe(3);
    expect(wsTabsLesson.concept!.diagram).toContain('<svg');
  });

  it('has 8 steps', () => {
    expect(wsTabsLesson.steps.length).toBe(8);
  });

  it('has expected step IDs in order', () => {
    const ids = wsTabsLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'tabs-intro',
      'tabs-add',
      'tabs-switch',
      'tabs-connect',
      'tabs-independent',
      'tabs-rename',
      'tabs-history',
      'tabs-close',
    ]);
  });

  it('all steps have title, description, and highlight', () => {
    for (const step of wsTabsLesson.steps) {
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.highlight).toBeTruthy();
    }
  });

  it('all steps have pauseAfter', () => {
    for (const step of wsTabsLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  // ─── Step actions ───────────────────────────────────────────

  it('step tabs-intro has no action (read-only)', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-intro')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toContain('conn-tab-bar');
  });

  it('step tabs-add clicks the add button', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-add')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step tabs-add has verify selector for last tab', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-add')!;
    expect(step.verify).toBeDefined();
    expect(step.verify).toContain('[role="tab"]');
  });

  it('step tabs-switch clicks the first tab', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-switch')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-bar'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining(':first-child'));
  });

  it('step tabs-connect fills /connect command and dispatches Enter', async () => {
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);
    const spy = vi.spyOn(input, 'dispatchEvent');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect')!;
    await step.action!(ctx);

    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/connect ws://localhost:9876',
    );
    const enterCalls = spy.mock.calls.filter(
      (c) => c[0] instanceof KeyboardEvent && (c[0] as KeyboardEvent).key === 'Enter',
    );
    expect(enterCalls.length).toBe(1);
  });

  it('step tabs-connect has preAction that clicks console tab', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
  });

  it('step tabs-connect has verify selector for connected status', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect')!;
    expect(step.verify).toBeDefined();
    expect(step.verify).toContain('connected');
  });

  it('step tabs-independent clicks the last tab', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>`;

    const lastTab = document.querySelector('[data-testid="conn-tab-2"]') as HTMLElement;
    const clickSpy = vi.spyOn(lastTab, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-independent')!;
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tabs-rename triggers double-click and fills rename input', async () => {
    // Create a tab bar with a tab that responds to dblclick
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
      </div>`;

    const tab = document.querySelector('[data-testid="conn-tab-bar"] [role="tab"]:first-child')!;
    const dblClickSpy = vi.fn();
    tab.addEventListener('dblclick', dblClickSpy);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-rename')!;
    await step.action!(ctx);

    // Verify double-click was dispatched
    expect(dblClickSpy).toHaveBeenCalledTimes(1);
  });

  it('step tabs-rename has preAction that switches to first tab', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-rename')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining(':first-child'));
  });

  it('step tabs-history clicks the history trigger', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-history')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-history-trigger'));
  });

  it('step tabs-close finds and clicks the close button on last tab', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>
      <button data-testid="conn-tab-close-2">×</button>`;

    const closeBtn = document.querySelector('[data-testid="conn-tab-close-2"]') as HTMLElement;
    const clickSpy = vi.spyOn(closeBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tabs-close has no verify (cleanup handles state)', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    expect(step.verify).toBeUndefined();
  });

  // ─── Highlights ─────────────────────────────────────────────

  it('tabs-intro highlights the tab bar', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-intro')!;
    expect(step.highlight).toContain('conn-tab-bar');
  });

  it('tabs-add highlights the add button', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-add')!;
    expect(step.highlight).toContain('conn-tab-add');
  });

  it('tabs-connect highlights the console input', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect')!;
    expect(step.highlight).toContain('ws-console-cmd-input');
  });

  it('tabs-history highlights the history trigger', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-history')!;
    expect(step.highlight).toContain('conn-tab-history-trigger');
  });

  // ─── Setup & Cleanup ───────────────────────────────────────

  it('setup cleans extra tabs, resets label, then starts mock server', async () => {
    // Provide a tab with a non-default label so rename reset branch triggers
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">
          <span class="ws-conn-tab-label">Echo Server</span>
        </div>
      </div>`;

    const tab = document.querySelector('[data-testid="conn-tab-1"]')!;
    const dblClickSpy = vi.fn();
    tab.addEventListener('dblclick', dblClickSpy);

    const ctx = makeCtx();
    await wsTabsLesson.setup!(ctx);
    // Should end with mock server start and client mode switch
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    // Should trigger double-click to rename when label is not "New Connection"
    expect(dblClickSpy).toHaveBeenCalled();
  });

  it('cleanup is callable', async () => {
    const ctx = makeCtx();
    await wsTabsLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });
});

// ─── ws-filtering ───────────────────────────────────────────────

describe('ws-filtering lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsFilteringLesson.id).toBe('ws-filtering');
    expect(wsFilteringLesson.domainId).toBe('protocols');
    expect(wsFilteringLesson.name).toBe('Filtering, Diff & Schema');
    expect(wsFilteringLesson.steps.length).toBe(9);
    expect(wsFilteringLesson.concept.title).toBeTruthy();
    expect(wsFilteringLesson.concept.body).toBeTruthy();
    expect(wsFilteringLesson.initialTab).toBe('websocket-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsFilteringLesson.setup).toBe('function');
    expect(typeof wsFilteringLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsFilteringLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of wsFilteringLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has key terms defined', () => {
    const terms = wsFilteringLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(5);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('Text Search');
    expect(termNames).toContain('Regex Search');
    expect(termNames).toContain('JSONPath');
    expect(termNames).toContain('Diff');
    expect(termNames).toContain('JSON Schema');
  });

  it('has a diagram', () => {
    expect(wsFilteringLesson.concept.diagram).toBeTruthy();
  });

  it('has category set', () => {
    expect(wsFilteringLesson.category).toBe('websocket');
  });

  it('has correct step IDs in order', () => {
    const ids = wsFilteringLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'filter-search', 'filter-direction', 'filter-bar', 'diff-compare',
      'diff-view', 'diff-close', 'schema-intro', 'schema-add', 'schema-validate',
    ]);
  });

  it('estimated time is 4 minutes', () => {
    expect(wsFilteringLesson.estimatedMinutes).toBe(4);
  });

  it('step filter-search preAction clicks events tab', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-search')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step filter-search action fills search input', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-search')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'greeting');
  });

  it('step filter-direction action selects sent direction', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-direction')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.any(String), 'sent');
  });

  it('step filter-bar preAction resets direction and search', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-bar')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.any(String), 'all');
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), '');
  });

  it('step filter-bar action clicks filter toggle', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-bar')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step filter-bar has verify selector', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-bar')!;
    expect(step.verify).toBeTruthy();
  });

  it('step diff-compare action clicks compare button', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-compare')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step diff-compare has verify selector for banner', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-compare')!;
    expect(step.verify).toBeTruthy();
  });

  it('step diff-view clicks message rows when available', async () => {
    // Add mock message rows (simulating: Connected, sent#1, echo#1, sent#2, echo#2, sent#3, echo#3)
    for (let i = 0; i < 7; i++) {
      const row = document.createElement('div');
      row.className = 'ws-message-row';
      document.body.appendChild(row);
    }
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    const ctx = makeCtx();
    const clickSpy = vi.fn();
    document.querySelectorAll('.ws-message-row').forEach(row => {
      (row as HTMLElement).addEventListener('click', clickSpy);
    });
    await step.action!(ctx);
    // Rows 1 and 5 should be clicked (two greeting messages)
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it('step diff-view does nothing when fewer than 6 rows', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should not throw
  });

  it('step diff-view has verify selector for diff modal', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    expect(step.verify).toBeTruthy();
  });

  it('step diff-close action clicks close button', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-close')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step schema-intro action clicks schema tab and enables toggle', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step schema-intro enables validate toggle when unchecked', async () => {
    // Add a mock unchecked validation toggle to DOM
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'ws-validation-toggle');
    toggle.checked = false;
    document.body.appendChild(toggle);
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should have clicked at least twice: schema tab + validation toggle
    expect(ctx.click).toHaveBeenCalledTimes(2);
  });

  it('step schema-intro skips toggle click when already checked', async () => {
    // Add a mock checked validation toggle to DOM
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'ws-validation-toggle');
    toggle.checked = true;
    document.body.appendChild(toggle);
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Only one click: schema tab (toggle already checked)
    expect(ctx.click).toHaveBeenCalledTimes(1);
  });

  it('step schema-add action demonstrates generate then saves', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-add')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should click: +Add, Generate, Save
    expect(ctx.click).toHaveBeenCalledTimes(3);
    // Should fill name and schema JSON
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'Greeting Schema');
    // Should set direction to 'both'
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.any(String), 'both');
  });

  it('step schema-add has verify selector for schema card', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-add')!;
    expect(step.verify).toBeTruthy();
  });

  it('step schema-validate action clicks events tab', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-validate')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('cleanup handles missing DOM elements gracefully', async () => {
    const ctx = makeCtx();
    await wsFilteringLesson.cleanup!(ctx);
    // No diff modal, compare banner, or filter bar — should not throw
    expect(ctx.click).toHaveBeenCalled();
  });

  it('cleanup clicks diff close when present', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'diff-close');
    document.body.appendChild(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await wsFilteringLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('cleanup clicks compare cancel when present', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'compare-cancel');
    document.body.appendChild(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await wsFilteringLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('cleanup closes filter bar when present', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'filter-bar');
    document.body.appendChild(bar);
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'filter-toggle-btn');
    document.body.appendChild(toggle);
    const clickSpy = vi.fn();
    toggle.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await wsFilteringLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('setup is callable', async () => {
    // Setup uses DOM operations and module imports — just verify it doesn't throw in JSDOM
    // (Some operations will be no-ops since there's no real WebSocket UI)
    const ctx = makeCtx();
    // Setup calls wsSetup which calls startMockServer > click — will use ctx.click
    await wsFilteringLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });
});

// ─── ws-load-testing ────────────────────────────────────────────

describe('ws-load-testing lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsLoadTestingLesson.id).toBe('ws-load-testing');
    expect(wsLoadTestingLesson.domainId).toBe('protocols');
    expect(wsLoadTestingLesson.name).toBe('Load Testing');
    expect(wsLoadTestingLesson.steps.length).toBe(7);
    expect(wsLoadTestingLesson.concept.title).toBeTruthy();
    expect(wsLoadTestingLesson.concept.body).toBeTruthy();
    expect(wsLoadTestingLesson.initialTab).toBe('websocket-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsLoadTestingLesson.setup).toBe('function');
    expect(typeof wsLoadTestingLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsLoadTestingLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of wsLoadTestingLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has key terms defined', () => {
    const terms = wsLoadTestingLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(4);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('Constant Profile');
    expect(termNames).toContain('Burst Profile');
    expect(termNames).toContain('Throughput');
  });

  it('has a diagram', () => {
    expect(wsLoadTestingLesson.concept.diagram).toBeTruthy();
  });

  it('has category set', () => {
    expect(wsLoadTestingLesson.category).toBe('websocket');
  });

  it('has correct step IDs in order', () => {
    const ids = wsLoadTestingLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'lt-intro', 'lt-template', 'lt-profile', 'lt-settings',
      'lt-run', 'lt-results', 'lt-export',
    ]);
  });

  it('estimated time is 4 minutes', () => {
    expect(wsLoadTestingLesson.estimatedMinutes).toBe(4);
  });

  it('step lt-intro preAction navigates to Events tab quietly first', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-intro')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('events'));
  });

  it('step lt-intro action clicks load test tab with ripple', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-loadtest'));
  });

  it('step lt-template has a preAction guard for LT panel', () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-template')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step lt-template action fills template with counter and timestamp', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-template')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('ping'));
    const fillArg: string = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(fillArg).toContain('{{counter}}');
    expect(fillArg).toContain('{{timestamp}}');
  });

  it('step lt-profile has a preAction guard for LT panel', () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-profile')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step lt-profile action tours all three profiles (ramp → burst → constant)', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-profile')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should click: ramp, burst, constant
    expect(ctx.click).toHaveBeenCalledTimes(3);
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map((c: [string]) => c[0]);
    expect(calls.some((s: string) => s.includes('ramp'))).toBe(true);
    expect(calls.some((s: string) => s.includes('burst'))).toBe(true);
    expect(calls.some((s: string) => s.includes('constant'))).toBe(true);
  });

  it('step lt-settings preAction ensures constant profile is selected', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-settings')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should click constant to ensure profile is set before fills
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('constant'));
  });

  it('step lt-settings action sets rate to 5 and duration to 5', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-settings')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const calls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const values = calls.map((c: [string, string]) => c[1]);
    expect(values).toContain('5'); // rate
    expect(values.filter((v: string) => v === '5').length).toBe(2); // both rate and duration are 5
  });

  it('step lt-run action uses ctx.click for ripple on enabled button', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-run')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'lt-start-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('lt-start-btn'));
  });

  it('step lt-run action skips ctx.click when button is disabled', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-run')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'lt-start-btn');
    btn.disabled = true;
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step lt-run preAction always sets rate=5 and duration=5 regardless of template state', async () => {
    // Template is already filled — but rate/duration should still be set
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    const ta = document.createElement('textarea');
    ta.setAttribute('data-testid', 'lt-message-template');
    ta.value = '{"action":"ping","seq":{{counter}}}'; // non-empty
    document.body.appendChild(ta);

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-run')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Rate and duration should ALWAYS be set
    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const fillValues = fillCalls.map((c: [string, string]) => c[1]);
    expect(fillValues).toContain('5'); // rate or duration
    // constant profile should be clicked
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('constant'));
  });

  it('step lt-run has a preAction guard that fills template when empty', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    const ta = document.createElement('textarea');
    ta.setAttribute('data-testid', 'lt-message-template');
    ta.value = '';
    document.body.appendChild(ta);

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-run')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('ping'));
  });

  it('step lt-results has no action (observation step) but has a preAction guard', () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-results')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toBeTruthy();
    expect(typeof step.preAction).toBe('function');
  });

  it('step lt-results preAction returns early when results already exist', async () => {
    // Add a mock results element
    const results = document.createElement('div');
    results.setAttribute('data-testid', 'lt-results');
    document.body.appendChild(results);
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-results')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should not try to navigate or fill anything — early return
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step lt-export has action that clicks Export JSON button', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-export')!;
    expect(typeof step.action).toBe('function');
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('lt-export-btn'));
  });

  it('step lt-export preAction returns early when results already exist', async () => {
    const results = document.createElement('div');
    results.setAttribute('data-testid', 'lt-results');
    document.body.appendChild(results);
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-export')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('cleanup handles missing DOM elements gracefully', async () => {
    const ctx = makeCtx();
    await wsLoadTestingLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('cleanup clicks stop button when present', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'lt-stop-btn');
    document.body.appendChild(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await wsLoadTestingLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('setup is callable', async () => {
    const ctx = makeCtx();
    await wsLoadTestingLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });
});

// ─── sse-studio ─────────────────────────────────────────────────

describe('sse-studio lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(sseStudioLesson.id).toBe('sse-studio');
    expect(sseStudioLesson.domainId).toBe('protocols');
    expect(sseStudioLesson.name).toBe('SSE Studio');
    expect(sseStudioLesson.steps.length).toBe(7);
    expect(sseStudioLesson.concept.title).toBeTruthy();
    expect(sseStudioLesson.concept.body).toBeTruthy();
    expect(sseStudioLesson.initialTab).toBe('sse-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof sseStudioLesson.setup).toBe('function');
    expect(typeof sseStudioLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of sseStudioLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of sseStudioLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has key terms defined', () => {
    const terms = sseStudioLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(3);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('SSE');
    expect(termNames).toContain('EventSource');
  });

  it('has a diagram', () => {
    expect(sseStudioLesson.concept.diagram).toBeTruthy();
  });

  it('has category set to sse', () => {
    expect(sseStudioLesson.category).toBe('sse');
  });

  it('has correct step IDs in order', () => {
    const ids = sseStudioLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'sse-nav', 'sse-connect', 'sse-events', 'sse-detail',
      'sse-filter', 'sse-console', 'sse-disconnect',
    ]);
  });

  it('estimated time is 2 minutes', () => {
    expect(sseStudioLesson.estimatedMinutes).toBe(2);
  });

  it('step sse-nav has no action', () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-nav')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toBeTruthy();
  });

  it('step sse-connect action fills URL and clicks connect', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'http://localhost:3001/api/sse-test');
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step sse-detail action clicks first event row when present', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-detail')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-event-row"]');
  });

  it('step sse-filter action fills search input', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-filter')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'greeting');
  });

  it('step sse-console action clicks console tab', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-console')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step sse-disconnect action clicks disconnect when available', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-disconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-connect-btn"]');
  });

  it('cleanup handles missing DOM elements gracefully', async () => {
    const ctx = makeCtx();
    await sseStudioLesson.cleanup!(ctx);
    // Should not throw with no DOM elements
  });

  it('cleanup disconnects when connected', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'sse-connect-btn');
    btn.textContent = 'Disconnect';
    document.body.appendChild(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await sseStudioLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('setup disconnects if already connected', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'sse-connect-btn');
    btn.textContent = 'Disconnect';
    document.body.appendChild(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await sseStudioLesson.setup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ─── ws-workflow-builder ────────────────────────────────────────

describe('ws-workflow-builder lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsWorkflowBuilderLesson.id).toBe('ws-workflow-builder');
    expect(wsWorkflowBuilderLesson.domainId).toBe('protocols');
    expect(wsWorkflowBuilderLesson.name).toBe('Workflow Builder');
    expect(wsWorkflowBuilderLesson.steps.length).toBe(9);
    expect(wsWorkflowBuilderLesson.concept.title).toBeTruthy();
    expect(wsWorkflowBuilderLesson.concept.body).toBeTruthy();
    expect(wsWorkflowBuilderLesson.initialTab).toBe('workflow');
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
      'wf-add-send', 'wf-config-send', 'wf-add-receive', 'wf-config-receive',
      'wf-quick-test',
    ]);
  });

  it('estimated time is 3 minutes', () => {
    expect(wsWorkflowBuilderLesson.estimatedMinutes).toBe(3);
  });

  it('interactive steps have actions', () => {
    const actionSteps = wsWorkflowBuilderLesson.steps.filter(s => s.action);
    // Steps 1 (create), 3 (add connect), 4 (config connect), 5 (add send), 6 (config send), 7 (add receive), 8 (config receive), 9 (quick test)
    expect(actionSteps.length).toBe(8);
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

  it('config-connect step fills URL and saves', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<div class="react-flow__node-wsConnect"></div>';
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-connect')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ws://localhost:9876');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('btn-primary'));
  });

  it('config-send step fills message and saves', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '<div class="react-flow__node-wsSend"></div>';
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-config-send')!;
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), '{"action": "hello", "from": "workflow"}');
  });

  it('quick-test step clicks the Quick Test button', async () => {
    const ctx = makeCtx();
    const step = wsWorkflowBuilderLesson.steps.find(s => s.id === 'wf-quick-test')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('quick-test'));
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
});

// ─── ws-socketio ─────────────────────────────────────────────────

describe('ws-socketio lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsSocketIoLesson.id).toBe('ws-socketio');
    expect(wsSocketIoLesson.domainId).toBe('protocols');
    expect(wsSocketIoLesson.category).toBe('websocket');
    expect(wsSocketIoLesson.name).toBe('Socket.IO Protocol');
    expect(wsSocketIoLesson.concept.title).toBeTruthy();
    expect(wsSocketIoLesson.concept.body).toBeTruthy();
    expect(wsSocketIoLesson.initialTab).toBe('websocket-studio');
    expect(wsSocketIoLesson.estimatedMinutes).toBe(4);
    expect(wsSocketIoLesson.steps.length).toBe(9);
  });

  it('has docker metadata', () => {
    expect(wsSocketIoLesson.tag).toBe('🐳 Docker');
    expect(wsSocketIoLesson.dockerEndpoint).toContain('localhost:3100');
    expect(wsSocketIoLesson.dockerCommand).toContain('socketio');
  });

  it('has both setup and cleanup', () => {
    expect(typeof wsSocketIoLesson.setup).toBe('function');
    expect(typeof wsSocketIoLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsSocketIoLesson.steps) {
      expect(step.id, `step.id missing`).toBeTruthy();
      expect(step.title, `step "${step.id}" missing title`).toBeTruthy();
      expect(step.description, `step "${step.id}" missing description`).toBeTruthy();
    }
  });

  it('has correct step IDs in order', () => {
    const ids = wsSocketIoLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'sio-intro',
      'sio-select-protocol',
      'sio-enter-url',
      'sio-connect',
      'sio-inspect-params',
      'sio-compose-event',
      'sio-send',
      'sio-namespace',
      'sio-disconnect',
    ]);
  });

  it('has key terms defined', () => {
    const terms = wsSocketIoLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(4);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('SID');
    expect(termNames).toContain('Namespace');
  });

  it('has a diagram', () => {
    expect(wsSocketIoLesson.concept.diagram).toBeTruthy();
    expect(wsSocketIoLesson.concept.diagram).toContain('Socket.IO');
  });

  // ─── Step: sio-intro ─────────────────────────────────────────

  it('step sio-intro clicks connect tab', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  // ─── Step: sio-select-protocol ───────────────────────────────
  // Protocol is pre-set in setup; this step only navigates to connect tab and explains

  it('step sio-select-protocol clicks connect tab to show the dropdown', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-select-protocol')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step sio-select-protocol highlights protocol dropdown', () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-select-protocol')!;
    expect(step.highlight).toContain('protocol-select');
  });

  // ─── Step: sio-enter-url ─────────────────────────────────────
  // URL is pre-filled in setup; this step only navigates to connect tab and explains

  it('step sio-enter-url navigates to connect tab to highlight the URL field', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-enter-url')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  // ─── Step: sio-connect ───────────────────────────────────────

  it('step sio-connect clicks connect button, events tab, then connect tab', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // After connecting, switches to Events to show handshake, then back to Connect for status badge
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  // ─── Step: sio-compose-event ─────────────────────────────────

  it('step sio-compose-event has a preAction that navigates to compose tab', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-compose-event')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
  });

  it('step sio-compose-event action fills event name and payload (no nav — preAction handles that)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-compose-event')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Action only fills fields; navigation is in preAction
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('sio-event-name'),
      'message',
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Hello Socket.IO'),
    );
  });

  // ─── Step: sio-send ──────────────────────────────────────────

  it('step sio-send clicks send and then events tab', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  // ─── Step: sio-namespace ─────────────────────────────────────

  it('step sio-namespace clicks compose tab and does NOT fill or focus the namespace field', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-namespace')!;
    const ctx = makeCtx();
    // Add namespace element — action scrolls it into view, must not focus() (would trap ArrowRight)
    const nsEl = document.createElement('input');
    nsEl.setAttribute('data-testid', 'sio-namespace');
    nsEl.scrollIntoView = vi.fn();
    document.body.appendChild(nsEl);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    // Must not fill /chat — server only handles root namespace
    expect(ctx.fill).not.toHaveBeenCalledWith(
      expect.stringContaining('sio-namespace'),
      expect.anything(),
    );
    // scrollIntoView called instead of focus() — keeps keyboard navigation working
    expect(nsEl.scrollIntoView).toHaveBeenCalled();
  });

  // ─── Step: sio-disconnect ────────────────────────────────────

  it('step sio-disconnect has a preAction that navigates to connect tab', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-disconnect')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step sio-disconnect action clicks disconnect button with ctx.click for visual ripple', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-disconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('disconnect-btn'));
  });

  // ─── Setup / Cleanup ─────────────────────────────────────────

  it('setup navigates to client mode, connect tab, clears subprotocols, and pre-fills URL + protocol', async () => {
    const ctx = makeCtx();
    await wsSocketIoLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('localhost:3100'),
    );
    // Must clear Subprotocols so stale values from other lessons don't pollute the config
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Subprotocols'),
      '',
    );
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'socket-io',
    );
  });

  it('cleanup calls reset protocol to raw', async () => {
    const ctx = makeCtx();
    await wsSocketIoLesson.cleanup!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'raw',
    );
  });
});

// ─── ws-stomp lesson ──────────────────────────────────────────

describe('ws-stomp lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsStompLesson.id).toBe('ws-stomp');
    expect(wsStompLesson.domainId).toBe('protocols');
    expect(wsStompLesson.category).toBe('websocket');
    expect(wsStompLesson.name).toBe('STOMP / RabbitMQ');
    expect(wsStompLesson.concept.title).toBeTruthy();
    expect(wsStompLesson.concept.body).toBeTruthy();
    expect(wsStompLesson.initialTab).toBe('websocket-studio');
    expect(wsStompLesson.estimatedMinutes).toBe(4);
    expect(wsStompLesson.steps.length).toBe(8);
  });

  it('has docker metadata', () => {
    expect(wsStompLesson.tag).toBe('🐳 Docker');
    expect(wsStompLesson.dockerEndpoint).toContain('localhost:15674');
    expect(wsStompLesson.dockerCommand).toContain('stomp');
  });

  it('has both setup and cleanup', () => {
    expect(typeof wsStompLesson.setup).toBe('function');
    expect(typeof wsStompLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsStompLesson.steps) {
      expect(step.id, `step.id missing`).toBeTruthy();
      expect(step.title, `step "${step.id}" missing title`).toBeTruthy();
      expect(step.description, `step "${step.id}" missing description`).toBeTruthy();
    }
  });

  it('has correct step IDs in order', () => {
    const ids = wsStompLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'stomp-intro',
      'stomp-protocol',
      'stomp-connect-ws',
      'stomp-handshake',
      'stomp-subscribe',
      'stomp-send',
      'stomp-frames',
      'stomp-disconnect',
    ]);
  });

  it('all steps have pauseAfter: true for comfortable reading time', () => {
    for (const step of wsStompLesson.steps) {
      expect(step.pauseAfter, `step "${step.id}" should have pauseAfter: true`).toBe(true);
    }
  });

  it('has key terms defined covering STOMP concepts', () => {
    const terms = wsStompLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(4);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('STOMP Frame');
    expect(termNames).toContain('Destination');
    expect(termNames).toContain('SUBSCRIBE');
  });

  it('has a diagram describing the two-step handshake', () => {
    expect(wsStompLesson.concept.diagram).toBeTruthy();
    expect(wsStompLesson.concept.diagram).toContain('CONNECT');
    expect(wsStompLesson.concept.diagram).toContain('CONNECTED');
  });

  // ─── Step: stomp-intro ───────────────────────────────────────

  it('step stomp-intro clicks connect tab and highlights it', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(step.highlight).toContain('left-tab-connect');
  });

  // ─── Step: stomp-protocol ────────────────────────────────────

  it('step stomp-protocol highlights protocol dropdown', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-protocol')!;
    expect(step.highlight).toContain('protocol-select');
  });

  it('step stomp-protocol navigates to connect tab', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-protocol')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  // ─── Step: stomp-connect-ws ──────────────────────────────────

  it('step stomp-connect-ws has a preAction that navigates to connect tab', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-connect-ws')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step stomp-connect-ws action does both WS connect and STOMP CONNECT in one action', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-connect-ws')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // WS transport: clicks Connect
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // Shows Events after WS connects
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
    // Navigates to Compose to send STOMP CONNECT frame
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    // Selects CONNECT command
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('stomp-command'),
      'CONNECT',
    );
    // Fills virtual host, login, passcode
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('stomp-destination'), '/');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('stomp-login'), 'guest');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('stomp-passcode'), 'guest');
    // Sends the CONNECT frame
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  // ─── Step: stomp-handshake ───────────────────────────────────

  it('step stomp-handshake has a preAction that navigates to events tab', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-handshake')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step stomp-handshake highlights events tab (observation)', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-handshake')!;
    expect(step.highlight).toContain('right-tab-events');
  });

  it('step stomp-handshake description references handshake frames', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-handshake')!;
    expect(step.description).toContain('CONNECT');
    expect(step.description).toContain('CONNECTED');
  });

  // ─── Step: stomp-subscribe ───────────────────────────────────

  it('step stomp-subscribe preAction navigates to compose, selects SUBSCRIBE, fills /queue/demo', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-subscribe')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('stomp-command'),
      'SUBSCRIBE',
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('stomp-destination'),
      '/queue/demo',
    );
  });

  it('step stomp-subscribe action clicks send (compose pre-populated by preAction)', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-subscribe')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    // selectOption and fill are NOT called in action — they moved to preAction
    expect(ctx.selectOption).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  // ─── Step: stomp-send ────────────────────────────────────────

  it('step stomp-send has a preAction that navigates to compose and selects SEND command', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-send')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('stomp-command'),
      'SEND',
    );
  });

  it('step stomp-send fills destination and body, clicks send, shows events', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('stomp-destination'),
      '/queue/demo',
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('hello'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step stomp-send highlights send button', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-send')!;
    expect(step.highlight).toContain('send-btn');
  });

  // ─── Step: stomp-frames ──────────────────────────────────────

  it('step stomp-frames has a preAction that navigates to events tab', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-frames')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step stomp-frames highlights events tab', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-frames')!;
    expect(step.highlight).toContain('right-tab-events');
  });

  it('step stomp-frames description mentions all key STOMP frame types', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-frames')!;
    expect(step.description).toContain('CONNECTED');
    expect(step.description).toContain('SUBSCRIBE');
    expect(step.description).toContain('SEND');
    expect(step.description).toContain('MESSAGE');
    expect(step.description).toContain('HEARTBEAT');
  });

  // ─── Step: stomp-disconnect ──────────────────────────────────

  it('step stomp-disconnect has a preAction that navigates to connect tab', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-disconnect')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step stomp-disconnect action clicks disconnect button with ctx.click for visual ripple', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-disconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('disconnect-btn'));
  });

  it('step stomp-disconnect highlights disconnect button', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-disconnect')!;
    expect(step.highlight).toContain('disconnect-btn');
  });

  // ─── Setup / Cleanup ─────────────────────────────────────────

  it('setup fills RabbitMQ URL, clears subprotocols, and selects stomp protocol', async () => {
    const ctx = makeCtx();
    await wsStompLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('localhost:15674'),
    );
    // Must clear Subprotocols to prevent stale "graphql-transport-ws" from breaking RabbitMQ handshake
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Subprotocols'),
      '',
    );
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'stomp',
    );
  });

  it('cleanup resets protocol to raw', async () => {
    const ctx = makeCtx();
    await wsStompLesson.cleanup!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'raw',
    );
  });
});

// ─── ws-graphql lesson ──────────────────────────────────────────

describe('ws-graphql lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ─── Structure & metadata ────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(wsGraphqlLesson.id).toBe('ws-graphql');
    expect(wsGraphqlLesson.domainId).toBe('protocols');
    expect(wsGraphqlLesson.name).toBe('GraphQL Subscriptions');
    expect(wsGraphqlLesson.steps.length).toBe(7);
    expect(wsGraphqlLesson.concept.title).toBeTruthy();
    expect(wsGraphqlLesson.concept.body).toBeTruthy();
    expect(wsGraphqlLesson.initialTab).toBe('websocket-studio');
  });

  it('has correct category, tag, and docker fields', () => {
    expect(wsGraphqlLesson.category).toBe('websocket');
    expect(wsGraphqlLesson.tag).toBe('🐳 Docker');
    expect(wsGraphqlLesson.dockerEndpoint).toContain('localhost:4100');
    expect(wsGraphqlLesson.dockerCommand).toContain('docker compose');
    expect(wsGraphqlLesson.dockerCommand).toContain('graphql');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsGraphqlLesson.setup).toBe('function');
    expect(typeof wsGraphqlLesson.cleanup).toBe('function');
  });

  it('has concept with keyTerms including graphql-transport-ws and connection_init', () => {
    const terms = wsGraphqlLesson.concept.keyTerms ?? [];
    const termNames = terms.map(t => t.term);
    expect(termNames).toContain('graphql-transport-ws');
    expect(termNames.some(t => t.includes('connection_init'))).toBe(true);
    expect(termNames.some(t => t.includes('subscribe'))).toBe(true);
    expect(termNames.some(t => t.includes('next'))).toBe(true);
    expect(termNames.some(t => t.includes('complete'))).toBe(true);
  });

  it('has a concept diagram', () => {
    expect(wsGraphqlLesson.concept.diagram).toBeTruthy();
    expect(wsGraphqlLesson.concept.diagram).toContain('connection_init');
    expect(wsGraphqlLesson.concept.diagram).toContain('connection_ack');
    expect(wsGraphqlLesson.concept.diagram).toContain('subscribe');
    expect(wsGraphqlLesson.concept.diagram).toContain('next');
    expect(wsGraphqlLesson.concept.diagram).toContain('complete');
  });

  it('all 7 steps have pauseAfter: true', () => {
    wsGraphqlLesson.steps.forEach(step => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('has correct step IDs in order', () => {
    const ids = wsGraphqlLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'gql-intro',
      'gql-protocol',
      'gql-connect',
      'gql-compose',
      'gql-subscribe',
      'gql-frames',
      'gql-disconnect',
    ]);
  });

  // ─── Step: gql-intro ────────────────────────────────────────

  it('step gql-intro highlights connect tab', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-intro')!;
    expect(step.highlight).toContain('left-tab-connect');
  });

  it('step gql-intro description mentions URL, subprotocol, and protocol', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-intro')!;
    expect(step.description).toContain('localhost:4100');
    expect(step.description).toContain('graphql-transport-ws');
    expect(step.description).toContain('GraphQL-WS');
  });

  it('step gql-intro action navigates to connect tab', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  // ─── Step: gql-protocol ─────────────────────────────────────

  it('step gql-protocol highlights protocol selector', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-protocol')!;
    expect(step.highlight).toContain('protocol-select');
  });

  it('step gql-protocol description mentions connection_init and automatic handshake', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-protocol')!;
    expect(step.description).toContain('connection_init');
    expect(step.description).toContain('GraphQL-WS');
  });

  // ─── Step: gql-connect ──────────────────────────────────────

  it('step gql-connect has a preAction that navigates to connect tab', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-connect')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step gql-connect action clicks connect button and switches to events tab', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step gql-connect highlights events tab', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-connect')!;
    expect(step.highlight).toContain('right-tab-events');
  });

  it('step gql-connect description mentions connection_init auto-sent and connection_ack', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-connect')!;
    expect(step.description).toContain('connection_init');
    expect(step.description).toContain('connection_ack');
  });

  // ─── Step: gql-compose ──────────────────────────────────────

  it('step gql-compose has a preAction that navigates to compose tab', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-compose')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
  });

  it('step gql-compose highlights gql-compose-fields', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-compose')!;
    expect(step.highlight).toContain('gql-compose-fields');
  });

  it('step gql-compose description mentions operation name, variables, and op ID', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-compose')!;
    expect(step.description).toContain('Operation Name');
    expect(step.description).toContain('Variables');
    expect(step.description).toContain('Op #');
  });

  // ─── Step: gql-subscribe ────────────────────────────────────

  it('step gql-subscribe has a preAction that navigates to compose and fills the query', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-subscribe')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('countdown'),
    );
  });

  it('step gql-subscribe action clicks send button and switches to events', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-subscribe')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step gql-subscribe highlights send button', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-subscribe')!;
    expect(step.highlight).toContain('send-btn');
  });

  it('step gql-subscribe description mentions countdown and next frames', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-subscribe')!;
    expect(step.description).toContain('countdown');
    expect(step.description).toContain('next');
    expect(step.description).toContain('complete');
  });

  // ─── Step: gql-frames ───────────────────────────────────────

  it('step gql-frames has a preAction that navigates to events tab', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-frames')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step gql-frames highlights events tab', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-frames')!;
    expect(step.highlight).toContain('right-tab-events');
  });

  it('step gql-frames description covers full lifecycle: handshake, subscribe, next, complete', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-frames')!;
    expect(step.description).toContain('connection_init');
    expect(step.description).toContain('connection_ack');
    expect(step.description).toContain('subscribe');
    expect(step.description).toContain('next');
    expect(step.description).toContain('complete');
  });

  // ─── Step: gql-disconnect ───────────────────────────────────

  it('step gql-disconnect has a preAction that navigates to connect tab', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-disconnect')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step gql-disconnect action clicks disconnect button with ctx.click for visual ripple', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-disconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('disconnect-btn'));
  });

  it('step gql-disconnect highlights disconnect button', () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-disconnect')!;
    expect(step.highlight).toContain('disconnect-btn');
  });

  // ─── Setup / Cleanup ─────────────────────────────────────────

  it('setup fills GraphQL URL, subprotocol, and selects graphql-ws protocol', async () => {
    const ctx = makeCtx();
    await wsGraphqlLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('localhost:4100'),
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Subprotocols'),
      'graphql-transport-ws',
    );
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'graphql-ws',
    );
  });

  it('cleanup resets protocol to raw and clears subprotocol', async () => {
    const ctx = makeCtx();
    await wsGraphqlLesson.cleanup!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'raw',
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Subprotocols'),
      '',
    );
  });
});

// ─── ws-mock-server-advanced ────────────────────────────────────

describe('ws-mock-server-advanced lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsMockServerAdvancedLesson.id).toBe('ws-mock-server-advanced');
    expect(wsMockServerAdvancedLesson.domainId).toBe('protocols');
    expect(wsMockServerAdvancedLesson.name).toBe('Advanced Mock Server');
    expect(wsMockServerAdvancedLesson.steps.length).toBe(8);
    expect(wsMockServerAdvancedLesson.concept.title).toBeTruthy();
    expect(wsMockServerAdvancedLesson.concept.body).toBeTruthy();
    expect(wsMockServerAdvancedLesson.initialTab).toBe('websocket-studio');
  });

  it('has both setup and cleanup', () => {
    expect(typeof wsMockServerAdvancedLesson.setup).toBe('function');
    expect(typeof wsMockServerAdvancedLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsMockServerAdvancedLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of wsMockServerAdvancedLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has 4 key terms defined', () => {
    expect(wsMockServerAdvancedLesson.concept.keyTerms).toBeDefined();
    expect(wsMockServerAdvancedLesson.concept.keyTerms!.length).toBe(4);
    const termNames = wsMockServerAdvancedLesson.concept.keyTerms!.map(t => t.term);
    expect(termNames).toContain('Match pattern');
    expect(termNames).toContain('Fallback mode');
    expect(termNames).toContain('Template variable');
    expect(termNames).toContain('Rule priority');
  });

  it('has a diagram', () => {
    expect(wsMockServerAdvancedLesson.concept.diagram).toBeTruthy();
  });

  it('has category websocket and estimatedMinutes 3', () => {
    expect(wsMockServerAdvancedLesson.category).toBe('websocket');
    expect(wsMockServerAdvancedLesson.estimatedMinutes).toBe(3);
  });

  it('has correct step IDs in order', () => {
    const ids = wsMockServerAdvancedLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'mock-adv-rules-tab',
      'mock-adv-add-rule',
      'mock-adv-response',
      'mock-adv-delay',
      'mock-adv-test-preview',
      'mock-adv-toggle',
      'mock-adv-fallback',
      'mock-adv-live',
    ]);
  });

  // ─── Step: mock-adv-rules-tab ───────────────────────────────

  it('step mock-adv-rules-tab action switches to mock mode and clicks rules tab', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-rules-tab')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
  });

  it('step mock-adv-rules-tab highlights the mode-mock button (visible in client mode)', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-rules-tab')!;
    expect(step.highlight).toContain('mode-mock');
  });

  // ─── Step: mock-adv-add-rule ────────────────────────────────

  it('step mock-adv-add-rule action clicks add rule button', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-add-rule')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-add-rule'));
  });

  it('step mock-adv-add-rule highlights add rule button', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-add-rule')!;
    expect(step.highlight).toContain('mock-add-rule');
  });

  it('step mock-adv-add-rule action changes match type to contains then fills pattern', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-add-rule')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('rule-match-type-'), 'contains');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('rule-match-pattern-'), 'ping');
  });

  // ─── Step: mock-adv-response ────────────────────────────────

  it('step mock-adv-response changes response type to template then fills response data', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-response')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('rule-response-type-'), 'template');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('rule-response-data-'), expect.stringContaining('pong'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('rule-response-data-'), expect.stringContaining('{{timestamp}}'));
  });

  it('step mock-adv-response highlights the response type selector (always visible when card is open)', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-response')!;
    expect(step.highlight).toContain('rule-response-type-');
  });

  it('step mock-adv-response description explains template variables', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-response')!;
    expect(step.description).toContain('{{timestamp}}');
    expect(step.description).toContain('{{uuid}}');
    expect(step.description).toContain('{{message}}');
  });

  // ─── Step: mock-adv-delay ───────────────────────────────────

  it('step mock-adv-delay action fills delay input with 200 via ctx.fill', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-delay')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('rule-delay-'), '200');
  });

  it('step mock-adv-delay highlights delay input', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-delay')!;
    expect(step.highlight).toContain('rule-delay-');
  });

  // ─── Step: mock-adv-test-preview ────────────────────────────

  it('step mock-adv-test-preview calls ctx.fill on test input with ping', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-test-preview')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('mock-test-input'), 'ping');
  });

  it('step mock-adv-test-preview highlights the test section', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-test-preview')!;
    expect(step.highlight).toContain('mock-test-section');
  });

  // ─── Step: mock-adv-toggle ──────────────────────────────────

  it('step mock-adv-toggle action calls ctx.click on toggle', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-toggle')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('rule-toggle-'));
  });

  it('step mock-adv-toggle highlights the rule toggle', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-toggle')!;
    expect(step.highlight).toContain('rule-toggle-');
  });

  // ─── Step: mock-adv-fallback ────────────────────────────────

  it('step mock-adv-fallback has no action (informational)', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-fallback')!;
    expect(step.action).toBeUndefined();
  });

  it('step mock-adv-fallback highlights fallback select', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-fallback')!;
    expect(step.highlight).toContain('mock-fallback-select');
  });

  it('step mock-adv-fallback description explains all three fallback modes', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-fallback')!;
    expect(step.description).toContain('echo');
    expect(step.description).toContain('ignore');
    expect(step.description).toContain('close');
  });

  // ─── Step: mock-adv-live ────────────────────────────────────

  it('step mock-adv-live action sends ping and a non-matching message', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-live')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ping');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'hello world');
  });

  it('step mock-adv-live preAction starts mock server and connects', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-live')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(btn);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ws://localhost:9876');
  });

  it('step mock-adv-live highlights the send button', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-live')!;
    expect(step.highlight).toContain('send-btn');
  });

  it('step mock-adv-live has verify for message row', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-live')!;
    expect(step.verify).toBeTruthy();
  });

  // ─── Setup / Cleanup ─────────────────────────────────────────

  it('setup starts mock server and switches to client mode', async () => {
    const ctx = makeCtx();
    await wsMockServerAdvancedLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('cleanup disconnects, stops mock server, returns to client mode', async () => {
    const ctx = makeCtx();
    await wsMockServerAdvancedLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });
});

// ─── ws-workspace ───────────────────────────────────────────────

describe('ws-workspace lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsWorkspaceLesson.id).toBe('ws-workspace');
    expect(wsWorkspaceLesson.domainId).toBe('protocols');
    expect(wsWorkspaceLesson.name).toBe('Profiles, Templates & Env Vars');
    expect(wsWorkspaceLesson.steps.length).toBe(8);
    expect(wsWorkspaceLesson.concept.title).toBeTruthy();
    expect(wsWorkspaceLesson.concept.body).toBeTruthy();
    expect(wsWorkspaceLesson.initialTab).toBe('websocket-studio');
  });

  it('has correct metadata', () => {
    expect(wsWorkspaceLesson.category).toBe('websocket');
    expect(wsWorkspaceLesson.estimatedMinutes).toBe(3);
    expect(wsWorkspaceLesson.tag).toBeUndefined();
    expect(wsWorkspaceLesson.dockerEndpoint).toBeUndefined();
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsWorkspaceLesson.setup).toBe('function');
    expect(typeof wsWorkspaceLesson.cleanup).toBe('function');
  });

  it('concept has key terms covering profiles, templates, and env vars', () => {
    const terms = wsWorkspaceLesson.concept.keyTerms ?? [];
    expect(terms.length).toBeGreaterThanOrEqual(3);
    const termNames = terms.map(t => t.term.toLowerCase());
    expect(termNames.some(t => t.includes('profile'))).toBe(true);
    expect(termNames.some(t => t.includes('template'))).toBe(true);
    expect(termNames.some(t => t.includes('variable') || t.includes('env'))).toBe(true);
  });

  it('concept has a diagram', () => {
    expect(wsWorkspaceLesson.concept.diagram).toBeTruthy();
    expect(wsWorkspaceLesson.concept.diagram).toContain('Profile');
    expect(wsWorkspaceLesson.concept.diagram).toContain('Template');
  });

  it('all steps have id, title, and description', () => {
    wsWorkspaceLesson.steps.forEach(step => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description.length).toBeGreaterThan(30);
    });
  });

  it('step IDs are in correct order', () => {
    const ids = wsWorkspaceLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'ws-profile-intro',
      'ws-profile-save',
      'ws-profile-load',
      'ws-template-intro',
      'ws-template-save',
      'ws-template-load',
      'ws-env-intro',
      'ws-env-warn',
    ]);
  });

  // ─── Step: ws-profile-intro ────────────────────────────────────

  it('step ws-profile-intro has preAction that clicks saved mode', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-intro')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-saved'));
  });

  it('step ws-profile-intro highlights saved mode tab', () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-intro')!;
    expect(step.highlight).toContain('mode-saved');
  });

  // ─── Step: ws-profile-save ────────────────────────────────────

  it('step ws-profile-save preAction navigates to client + connect + fills URL', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-save')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('localhost:9876'),
    );
  });

  it('step ws-profile-save action clicks save-as-profile, fills name, saves', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-save')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('save-as-profile-btn'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('profile-name-input'),
      'Demo Echo Server',
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('profile-save-btn'));
  });

  it('step ws-profile-save highlights save-as-profile button', () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-save')!;
    expect(step.highlight).toContain('save-as-profile-btn');
  });

  // ─── Step: ws-profile-load ────────────────────────────────────

  it('step ws-profile-load preAction switches to saved mode', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-load')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-saved'));
  });

  it('step ws-profile-load highlights saved connections panel', () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-load')!;
    expect(step.highlight).toContain('saved-connections');
  });

  it('step ws-profile-load description mentions Load & Connect', () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-load')!;
    expect(step.description).toContain('Load & Connect');
  });

  it('step ws-profile-load action is defined', () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-load')!;
    // Action uses ctx.click with dynamic profile-card / load-btn selectors.
    // DOM queries return null in jsdom so the action exits early — we only verify it is a function.
    expect(typeof step.action).toBe('function');
  });

  // ─── Step: ws-template-intro ──────────────────────────────────

  it('step ws-template-intro preAction navigates to compose tab', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-intro')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
  });

  it('step ws-template-intro highlights template trigger', () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-intro')!;
    expect(step.highlight).toContain('template-trigger');
  });

  it('step ws-template-intro action opens and closes template dropdown', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .map(c => c[0])
      .filter((s: string) => s.includes('template-trigger'));
    expect(clickCalls.length).toBe(2);
  });

  // ─── Step: ws-template-save ───────────────────────────────────

  it('step ws-template-save preAction fills message and opens dropdown', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-save')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      expect.stringContaining('greet'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('template-trigger'));
  });

  it('step ws-template-save action fills name and clicks save', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-save')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('template-save-name'),
      'greeting',
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('template-save-btn'));
  });

  // ─── Step: ws-template-load ───────────────────────────────────

  it('step ws-template-load preAction clears compose and opens compose tab', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-load')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      '',
    );
  });

  it('step ws-template-load action opens template dropdown and loads via ctx.click', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-load')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('template-trigger'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('ws-template-item-load'));
  });

  // ─── Step: ws-env-intro ───────────────────────────────────────

  it('step ws-env-intro preAction navigates to client + connect', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-intro')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step ws-env-intro action fills URL with {{wsBaseUrl}}', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('{{wsBaseUrl}}'),
    );
  });

  it('step ws-env-intro highlights URL input', () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-intro')!;
    expect(step.highlight).toContain('WebSocket URL');
  });

  // ─── Step: ws-env-warn ───────────────────────────────────────

  it('step ws-env-warn action fills URL with {{unknownHost}}', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-warn')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('{{unknownHost}}'),
    );
  });

  it('step ws-env-warn highlights URL input', () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-warn')!;
    expect(step.highlight).toContain('WebSocket URL');
  });

  // ─── Setup / Cleanup ─────────────────────────────────────────

  it('setup starts mock server and switches to client mode', async () => {
    const ctx = makeCtx();
    await wsWorkspaceLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('cleanup switches to client mode', async () => {
    const ctx = makeCtx();
    await wsWorkspaceLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });
});

// ─── ws-reliability ─────────────────────────────────────────────

describe('ws-reliability lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsReliabilityLesson.id).toBe('ws-reliability');
    expect(wsReliabilityLesson.domainId).toBe('protocols');
    expect(wsReliabilityLesson.name).toBe('Auto-Reconnect & Stats');
    expect(wsReliabilityLesson.steps.length).toBe(7);
    expect(wsReliabilityLesson.concept.title).toBeTruthy();
    expect(wsReliabilityLesson.concept.body).toBeTruthy();
    expect(wsReliabilityLesson.initialTab).toBe('websocket-studio');
  });

  it('has correct metadata', () => {
    expect(wsReliabilityLesson.category).toBe('websocket');
    expect(wsReliabilityLesson.estimatedMinutes).toBe(3);
    expect(wsReliabilityLesson.tag).toBeUndefined();
    expect(wsReliabilityLesson.dockerEndpoint).toBeUndefined();
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsReliabilityLesson.setup).toBe('function');
    expect(typeof wsReliabilityLesson.cleanup).toBe('function');
  });

  it('concept has key terms covering close code, reconnect, backoff, sparkline', () => {
    const terms = wsReliabilityLesson.concept.keyTerms ?? [];
    expect(terms.length).toBeGreaterThanOrEqual(3);
    const termNames = terms.map(t => t.term.toLowerCase());
    expect(termNames.some(t => t.includes('close code'))).toBe(true);
    expect(termNames.some(t => t.includes('reconnect'))).toBe(true);
    expect(termNames.some(t => t.includes('backoff'))).toBe(true);
  });

  it('concept has a diagram', () => {
    expect(wsReliabilityLesson.concept.diagram).toBeTruthy();
    expect(wsReliabilityLesson.concept.diagram).toContain('Stats');
    expect(wsReliabilityLesson.concept.diagram).toContain('Reconnect');
  });

  it('all steps have id, title, and description', () => {
    wsReliabilityLesson.steps.forEach(step => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description.length).toBeGreaterThan(30);
    });
  });

  it('step IDs are in correct order', () => {
    const ids = wsReliabilityLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'rel-connect',
      'rel-stats-tab',
      'rel-stats-live',
      'rel-reconnect-settings',
      'rel-close-code',
      'rel-stats-zero',
      'rel-history',
    ]);
  });

  // ─── Step: rel-connect ────────────────────────────────────

  it('step rel-connect preAction fills URL and navigates to connect tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-connect')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('localhost:9876'),
    );
  });

  it('step rel-connect action clicks connect and switches to events', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step rel-connect has verify for connected status', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-connect')!;
    expect(step.verify).toContain('connected');
  });

  // ─── Step: rel-stats-tab ──────────────────────────────────

  it('step rel-stats-tab preAction switches to stats tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-tab')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-stats'));
  });

  it('step rel-stats-tab highlights stats tab', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-tab')!;
    expect(step.highlight).toContain('right-tab-stats');
  });

  // ─── Step: rel-stats-live ─────────────────────────────────

  it('step rel-stats-live preAction navigates to compose and fills message', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-live')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      expect.stringContaining('ping'),
    );
  });

  it('step rel-stats-live action sends messages and switches to stats', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-live')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const sendCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('send-btn'));
    expect(sendCalls.length).toBe(5);
    // Each send is preceded by a fill to re-populate the cleared input
    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('Message input'));
    expect(fillCalls.length).toBe(5);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-stats'));
  });

  it('step rel-stats-live highlights msg rate card', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-live')!;
    expect(step.highlight).toContain('stats-msg-rate');
  });

  // ─── Step: rel-reconnect-settings ─────────────────────────

  it('step rel-reconnect-settings preAction navigates to connect tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-reconnect-settings')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step rel-reconnect-settings highlights reconnect settings', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-reconnect-settings')!;
    expect(step.highlight).toContain('reconnect-settings');
  });

  it('step rel-reconnect-settings description mentions max attempts and backoff', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-reconnect-settings')!;
    expect(step.description).toContain('Max Attempts');
    expect(step.description).toContain('Backoff Multiplier');
  });

  // ─── Step: rel-close-code ─────────────────────────────────

  it('step rel-close-code preAction navigates to connect tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-close-code')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step rel-close-code action opens caret, fills code/reason, closes', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-close-code')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('disconnect-caret'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('close-code-input'),
      '1001',
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('close-reason-input'),
      'Demo lesson complete',
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('close-with-code-btn'));
  });

  // ─── Step: rel-stats-zero ─────────────────────────────────

  it('step rel-stats-zero action switches to stats tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-zero')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-stats'));
  });

  it('step rel-stats-zero description mentions rates drop to zero', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-zero')!;
    expect(step.description).toContain('zero');
  });

  // ─── Step: rel-history ────────────────────────────────────

  it('step rel-history preAction navigates to connect tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-history')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step rel-history highlights URL history trigger', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-history')!;
    expect(step.highlight).toContain('url-history-trigger');
  });

  it('step rel-history action opens and closes URL history dropdown', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-history')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('url-history-trigger'));
    expect(clickCalls.length).toBe(2);
  });

  // ─── Setup / Cleanup ─────────────────────────────────────

  it('setup starts mock server, clears subprotocols and resets protocol', async () => {
    const ctx = makeCtx();
    await wsReliabilityLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('Subprotocols'), '');
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('protocol'), 'raw');
  });

  it('cleanup resets protocol and stops mock server', async () => {
    const ctx = makeCtx();
    await wsReliabilityLesson.cleanup!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('Subprotocols'), '');
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('protocol'), 'raw');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });
});

// ─── ws-session-recording ───────────────────────────────────────

describe('ws-session-recording lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsSessionRecordingLesson.id).toBe('ws-session-recording');
    expect(wsSessionRecordingLesson.domainId).toBe('protocols');
    expect(wsSessionRecordingLesson.name).toBe('Session Recording & Replay');
    expect(wsSessionRecordingLesson.steps.length).toBe(7);
    expect(wsSessionRecordingLesson.concept.title).toBeTruthy();
    expect(wsSessionRecordingLesson.concept.body).toBeTruthy();
    expect(wsSessionRecordingLesson.initialTab).toBe('websocket-studio');
  });

  it('has correct metadata', () => {
    expect(wsSessionRecordingLesson.category).toBe('websocket');
    expect(wsSessionRecordingLesson.estimatedMinutes).toBe(4);
    expect(wsSessionRecordingLesson.dockerEndpoint).toBeUndefined();
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsSessionRecordingLesson.setup).toBe('function');
    expect(typeof wsSessionRecordingLesson.cleanup).toBe('function');
  });

  it('concept has key terms for recording format and replay speed', () => {
    const terms = wsSessionRecordingLesson.concept.keyTerms ?? [];
    expect(terms.length).toBeGreaterThanOrEqual(2);
    const termNames = terms.map(t => t.term.toLowerCase());
    expect(termNames.some(t => t.includes('recording'))).toBe(true);
    expect(termNames.some(t => t.includes('speed'))).toBe(true);
  });

  it('concept has a diagram', () => {
    expect(wsSessionRecordingLesson.concept.diagram).toBeTruthy();
    expect(wsSessionRecordingLesson.concept.diagram).toContain('Rec');
    expect(wsSessionRecordingLesson.concept.diagram).toContain('Replay');
  });

  it('all steps have id, title, and description', () => {
    wsSessionRecordingLesson.steps.forEach(step => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description.length).toBeGreaterThan(30);
    });
  });

  it('step IDs are in correct order', () => {
    const ids = wsSessionRecordingLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'rec-intro',
      'rec-start',
      'rec-capture',
      'rec-stop',
      'rec-import',
      'rec-play',
      'rec-exit',
    ]);
  });

  // ─── Step: rec-intro ──────────────────────────────────────

  it('step rec-intro has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-intro preAction connects and switches to events when not connected', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    const ctx = makeCtx();
    // DOM has no disconnect-btn → ensureConnected will connect
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step rec-intro preAction skips connect when already connected', async () => {
    const disconnectBtn = document.createElement('button');
    disconnectBtn.setAttribute('data-testid', 'disconnect-btn');
    document.body.appendChild(disconnectBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step rec-intro preAction stops active recording if running', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'stop-recording-btn');
    document.body.appendChild(stopBtn);

    const clickSpy = vi.fn();
    stopBtn.addEventListener('click', clickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step rec-intro highlights rec start button', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    expect(step.highlight).toContain('start-recording-btn');
  });

  // ─── Step: rec-start ──────────────────────────────────────

  it('step rec-start has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-start')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-start preAction connects and navigates to events when not recording', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-start')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step rec-start preAction is a no-op when already recording', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'stop-recording-btn');
    document.body.appendChild(stopBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-start')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step rec-start action clicks rec button', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-start')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('start-recording-btn'));
  });

  it('step rec-start highlights start button (visible during reading before action fires)', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-start')!;
    expect(step.highlight).toContain('start-recording-btn');
    expect(step.highlight).not.toContain('stop-recording-btn');
  });

  // ─── Step: rec-capture ────────────────────────────────────

  it('step rec-capture preAction fills message and switches to compose when recording active', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'stop-recording-btn');
    document.body.appendChild(stopBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-capture')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      expect.stringContaining('demo'),
    );
  });

  it('step rec-capture preAction starts recording when not active', async () => {
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'start-recording-btn');
    document.body.appendChild(startBtn);

    const clickSpy = vi.fn();
    startBtn.addEventListener('click', clickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-capture')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
  });

  it('step rec-capture action sends 3 messages and switches to events', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-capture')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const sendCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('send-btn'));
    expect(sendCalls.length).toBe(3);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  // ─── Step: rec-stop ───────────────────────────────────────

  it('step rec-stop has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-stop preAction starts recording when not active', async () => {
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'start-recording-btn');
    document.body.appendChild(startBtn);

    const clickSpy = vi.fn();
    startBtn.addEventListener('click', clickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step rec-stop preAction is a no-op when already recording', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'stop-recording-btn');
    document.body.appendChild(stopBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step rec-stop action clicks stop button', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('stop-recording-btn'));
  });

  it('step rec-stop highlights stop button (not start button)', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    expect(step.highlight).toContain('stop-recording-btn');
    expect(step.highlight).not.toContain('start-recording-btn');
  });

  // ─── Step: rec-import ─────────────────────────────────────

  it('step rec-import has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-import preAction stops active recording', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'stop-recording-btn');
    document.body.appendChild(stopBtn);

    const clickSpy = vi.fn();
    stopBtn.addEventListener('click', clickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step rec-import preAction exits active replay', async () => {
    const exitBtn = document.createElement('button');
    exitBtn.setAttribute('data-testid', 'replay-exit-btn');
    document.body.appendChild(exitBtn);

    const clickSpy = vi.fn();
    exitBtn.addEventListener('click', clickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step rec-import action injects a recording file', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'recording-file-input');
    document.body.appendChild(input);

    const changeSpy = vi.fn();
    input.addEventListener('change', changeSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(changeSpy).toHaveBeenCalled();
    const files = input.files;
    expect(files).toBeTruthy();
    expect(files!.length).toBe(1);
    expect(files![0]?.name).toBe('demo-recording.json');
  });

  it('step rec-import injected recording has short timing (under 6 s total)', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'recording-file-input');
    document.body.appendChild(input);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    const files = input.files;
    const text = await files![0]!.text();
    const recording = JSON.parse(text);
    expect(recording.metadata.durationMs).toBeLessThan(6000);
    expect(recording.events.length).toBe(12);
  });

  it('step rec-import highlights import button (not play button)', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    expect(step.highlight).toContain('import-recording-btn');
    expect(step.highlight).not.toContain('start-replay-btn');
  });

  // ─── Step: rec-play ───────────────────────────────────────

  it('step rec-play has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-play')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-play preAction injects recording when no play button exists', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'recording-file-input');
    document.body.appendChild(input);

    const changeSpy = vi.fn();
    input.addEventListener('change', changeSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-play')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(changeSpy).toHaveBeenCalled();
  });

  it('step rec-play preAction skips injection when play button already exists', async () => {
    const playBtn = document.createElement('button');
    playBtn.setAttribute('data-testid', 'start-replay-btn');
    document.body.appendChild(playBtn);

    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'recording-file-input');
    document.body.appendChild(input);

    const changeSpy = vi.fn();
    input.addEventListener('change', changeSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-play')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it('step rec-play action clicks play button', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-play')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('start-replay-btn'));
  });

  it('step rec-play highlights start-replay button (visible during reading before action fires)', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-play')!;
    expect(step.highlight).toContain('start-replay-btn');
    expect(step.highlight).not.toContain('replay-bar');
  });

  // ─── Step: rec-exit ───────────────────────────────────────

  it('step rec-exit has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-exit preAction injects and pauses a replay when no exit button exists', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'recording-file-input');
    document.body.appendChild(input);

    const changeSpy = vi.fn();
    input.addEventListener('change', changeSpy);

    // Simulate play button appearing after file inject
    const playBtn = document.createElement('button');
    playBtn.setAttribute('data-testid', 'start-replay-btn');
    document.body.appendChild(playBtn);

    const playClickSpy = vi.fn(() => {
      // Simulate replay starting: replace play btn with exit btn + playpause btn
      playBtn.remove();
      const exitBtn = document.createElement('button');
      exitBtn.setAttribute('data-testid', 'replay-exit-btn');
      document.body.appendChild(exitBtn);
      const ppBtn = document.createElement('button');
      ppBtn.setAttribute('data-testid', 'replay-playpause-btn');
      ppBtn.textContent = '⏸';
      document.body.appendChild(ppBtn);
    });
    playBtn.addEventListener('click', playClickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // File should have been injected (no exit button at start)
    expect(changeSpy).toHaveBeenCalled();
  });

  it('step rec-exit preAction pauses an already-playing replay to keep exit button visible', async () => {
    // Simulate: replay already running (exit + playpause buttons in DOM)
    const exitBtn = document.createElement('button');
    exitBtn.setAttribute('data-testid', 'replay-exit-btn');
    document.body.appendChild(exitBtn);

    const ppBtn = document.createElement('button');
    ppBtn.setAttribute('data-testid', 'replay-playpause-btn');
    ppBtn.textContent = '⏸'; // Currently playing
    document.body.appendChild(ppBtn);

    const ppClickSpy = vi.fn();
    ppBtn.addEventListener('click', ppClickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ppClickSpy).toHaveBeenCalled(); // Should pause the replay
  });

  it('step rec-exit preAction skips pause when replay is already paused', async () => {
    const exitBtn = document.createElement('button');
    exitBtn.setAttribute('data-testid', 'replay-exit-btn');
    document.body.appendChild(exitBtn);

    const ppBtn = document.createElement('button');
    ppBtn.setAttribute('data-testid', 'replay-playpause-btn');
    ppBtn.textContent = '▶'; // Already paused
    document.body.appendChild(ppBtn);

    const ppClickSpy = vi.fn();
    ppBtn.addEventListener('click', ppClickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ppClickSpy).not.toHaveBeenCalled(); // Already paused — no-op
  });

  it('step rec-exit highlights replay exit button', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    expect(step.highlight).toContain('replay-exit-btn');
  });

  it('step rec-exit action clicks exit when button exists', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'replay-exit-btn');
    document.body.appendChild(btn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('replay-exit-btn'));
  });

  it('step rec-exit action is a no-op when replay already ended', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  // ─── Setup / Cleanup ─────────────────────────────────────

  it('setup starts mock server and clears protocol state', async () => {
    const ctx = makeCtx();
    await wsSessionRecordingLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('Subprotocols'), '');
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('protocol'), 'raw');
  });

  it('cleanup stops mock server', async () => {
    const ctx = makeCtx();
    await wsSessionRecordingLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });
});

// ─── ws-power-user ──────────────────────────────────────────────

describe('ws-power-user lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsPowerUserLesson.id).toBe('ws-power-user');
    expect(wsPowerUserLesson.domainId).toBe('protocols');
    expect(wsPowerUserLesson.name).toBe('Power User: Tabs & Keyboard');
    expect(wsPowerUserLesson.steps.length).toBe(7);
    expect(wsPowerUserLesson.concept.title).toBeTruthy();
    expect(wsPowerUserLesson.concept.body).toBeTruthy();
    expect(wsPowerUserLesson.initialTab).toBe('websocket-studio');
  });

  it('has correct metadata', () => {
    expect(wsPowerUserLesson.category).toBe('websocket');
    expect(wsPowerUserLesson.estimatedMinutes).toBe(4);
    expect(wsPowerUserLesson.dockerEndpoint).toBeUndefined();
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsPowerUserLesson.setup).toBe('function');
    expect(typeof wsPowerUserLesson.cleanup).toBe('function');
  });

  it('concept has key terms for roving tabindex and DnD', () => {
    const terms = wsPowerUserLesson.concept.keyTerms ?? [];
    expect(terms.length).toBeGreaterThanOrEqual(2);
    const termNames = terms.map(t => t.term.toLowerCase());
    expect(termNames.some(t => t.includes('roving') || t.includes('tabindex'))).toBe(true);
    expect(termNames.some(t => t.includes('dnd') || t.includes('drag'))).toBe(true);
  });

  it('concept has a diagram', () => {
    expect(wsPowerUserLesson.concept.diagram).toBeTruthy();
    expect(wsPowerUserLesson.concept.diagram).toContain('Tab Bar');
  });

  it('all steps have id, title, and description', () => {
    wsPowerUserLesson.steps.forEach(step => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description.length).toBeGreaterThan(30);
    });
  });

  it('step IDs are in correct order', () => {
    const ids = wsPowerUserLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'pu-setup-tabs',
      'pu-drag-reorder',
      'pu-kbd-arrow',
      'pu-kbd-rename',
      'pu-kbd-delete',
      'pu-auth-persist',
      'pu-pane-persist',
    ]);
  });

  // ─── Step: pu-setup-tabs ──────────────────────────────────

  it('step pu-setup-tabs preAction creates tabs and renames them', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-selected', 'true');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'New Connection';
    tab1.appendChild(label);
    bar.appendChild(tab1);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-setup-tabs')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should add new tabs
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-setup-tabs preAction closes extra tabs first (idempotent guard)', async () => {
    // Simulate 3 tabs already existing (step-back scenario)
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (let i = 1; i <= 3; i++) {
      const t = document.createElement('div');
      t.setAttribute('role', 'tab');
      t.setAttribute('data-testid', `conn-tab-${i}`);
      bar.appendChild(t);

      const close = document.createElement('button');
      close.setAttribute('data-testid', `conn-tab-close-${i}`);
      document.body.appendChild(close);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-setup-tabs')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // After closing extras, should have tried to add 2 new tabs
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-setup-tabs highlights tab bar', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-setup-tabs')!;
    expect(step.highlight).toContain('conn-tab-bar');
  });

  // ─── Step: pu-drag-reorder ────────────────────────────────

  it('step pu-drag-reorder has a preAction', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-drag-reorder preAction is a no-op when 3 tabs already exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (let i = 1; i <= 3; i++) {
      const t = document.createElement('div');
      t.setAttribute('role', 'tab');
      bar.appendChild(t);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should NOT have added tabs or navigated (3 tabs already present)
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-drag-reorder preAction creates tabs when fewer than 3 exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const t = document.createElement('div');
    t.setAttribute('role', 'tab');
    bar.appendChild(t);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-drag-reorder highlights tab bar', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    expect(step.highlight).toContain('conn-tab-bar');
  });

  it('step pu-drag-reorder has an action with delay', async () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  // ─── Step: pu-kbd-arrow ───────────────────────────────────

  it('step pu-kbd-arrow has a preAction', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-kbd-arrow preAction creates tabs when fewer than 2 exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const t = document.createElement('div');
    t.setAttribute('role', 'tab');
    bar.appendChild(t);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-kbd-arrow preAction is a no-op when 2+ tabs already exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (let i = 0; i < 2; i++) {
      const t = document.createElement('div');
      t.setAttribute('role', 'tab');
      bar.appendChild(t);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-kbd-arrow action dispatches arrow key events', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-selected', 'true');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    tab1.tabIndex = 0;
    bar.appendChild(tab1);
    document.body.appendChild(bar);

    const keydownSpy = vi.fn();
    tab1.addEventListener('keydown', keydownSpy);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const arrowCalls = keydownSpy.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'ArrowRight'
    );
    expect(arrowCalls.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Step: pu-kbd-rename ──────────────────────────────────

  it('step pu-kbd-rename has a preAction', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-rename')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-kbd-rename preAction does NOT rename (guard only — ensures tabs exist)', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-selected', 'true');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    bar.appendChild(tab1);
    document.body.appendChild(bar);

    const keydownSpy = vi.fn();
    tab1.addEventListener('keydown', keydownSpy);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-rename')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // preAction must NOT dispatch F2 — rename is now in action
    const f2Calls = keydownSpy.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'F2'
    );
    expect(f2Calls.length).toBe(0);
  });

  it('step pu-kbd-rename action renames last tab (dispatches F2 + Enter)', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-selected', 'true');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    tab1.tabIndex = 0;
    bar.appendChild(tab1);
    document.body.appendChild(bar);

    const keydownSpy = vi.fn();
    tab1.addEventListener('keydown', keydownSpy);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-rename')!;
    expect(typeof step.action).toBe('function');
    const ctx = makeCtx();
    await step.action!(ctx);
    const f2Calls = keydownSpy.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'F2'
    );
    expect(f2Calls.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Step: pu-kbd-delete ──────────────────────────────────

  it('step pu-kbd-delete has a preAction', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-delete')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-kbd-delete preAction is a no-op when "Server B" already exists', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', 'conn-tab-1');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'Server B';
    tab.appendChild(label);
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-delete')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should NOT add a new tab — Server B already exists
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-kbd-delete preAction adds and renames tab when "Server B" is missing', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', 'conn-tab-1');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'Server A'; // No Server B
    tab.appendChild(label);
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-delete')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should add a new tab to host "Server B"
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-kbd-delete action dispatches Delete key on "Server B" tab', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', 'conn-tab-1');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'Server B';
    tab.appendChild(label);
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const keydownSpy = vi.fn();
    tab.addEventListener('keydown', keydownSpy);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-delete')!;
    expect(typeof step.action).toBe('function');
    const ctx = makeCtx();
    await step.action!(ctx);
    const deleteCalls = keydownSpy.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'Delete'
    );
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('step pu-kbd-delete action is a no-op when "Server B" does not exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', 'conn-tab-1');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'Server A';
    tab.appendChild(label);
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const keydownSpy = vi.fn();
    tab.addEventListener('keydown', keydownSpy);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-delete')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(keydownSpy).not.toHaveBeenCalled();
  });

  // ─── Step: pu-auth-persist ────────────────────────────────

  it('step pu-auth-persist has a preAction', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-auth-persist preAction adds a tab when fewer than 2 exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const t = document.createElement('div');
    t.setAttribute('role', 'tab');
    bar.appendChild(t);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-auth-persist preAction is a no-op when 2+ tabs already exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (let i = 0; i < 2; i++) {
      const t = document.createElement('div');
      t.setAttribute('role', 'tab');
      bar.appendChild(t);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-auth-persist action switches to auth tab', async () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-auth'));
  });

  // ─── Step: pu-pane-persist ────────────────────────────────

  it('step pu-pane-persist preAction switches to console tab', async () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-pane-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
  });

  it('step pu-pane-persist action switches between events and console', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-selected', 'true');
    bar.appendChild(tab1);
    const tab2 = document.createElement('div');
    tab2.setAttribute('role', 'tab');
    tab2.setAttribute('aria-selected', 'false');
    bar.appendChild(tab2);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-pane-persist')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  // ─── Setup / Cleanup ─────────────────────────────────────

  it('setup starts mock server', async () => {
    const ctx = makeCtx();
    await wsPowerUserLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('cleanup stops mock server', async () => {
    const ctx = makeCtx();
    await wsPowerUserLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });
});

// ─── sse-studio-advanced ─────────────────────────────────────────

describe('sse-studio-advanced lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(sseStudioAdvancedLesson.id).toBe('sse-studio-advanced');
    expect(sseStudioAdvancedLesson.domainId).toBe('protocols');
    expect(sseStudioAdvancedLesson.name).toBe('SSE Advanced Features');
    expect(sseStudioAdvancedLesson.steps.length).toBe(7);
    expect(sseStudioAdvancedLesson.concept.title).toBeTruthy();
    expect(sseStudioAdvancedLesson.concept.body).toBeTruthy();
    expect(sseStudioAdvancedLesson.initialTab).toBe('sse-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof sseStudioAdvancedLesson.setup).toBe('function');
    expect(typeof sseStudioAdvancedLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of sseStudioAdvancedLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of sseStudioAdvancedLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has key terms defined', () => {
    const terms = sseStudioAdvancedLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBe(4);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('Bookmark');
    expect(termNames).toContain('Last-Event-ID');
    expect(termNames).toContain('Auto-Reconnect');
    expect(termNames).toContain('Stats Footer');
  });

  it('has a diagram', () => {
    expect(sseStudioAdvancedLesson.concept.diagram).toBeTruthy();
  });

  it('has category set to sse', () => {
    expect(sseStudioAdvancedLesson.category).toBe('sse');
  });

  it('has correct step IDs in order', () => {
    const ids = sseStudioAdvancedLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'sse-adv-intro', 'sse-adv-bookmark', 'sse-adv-bookmark-filter',
      'sse-adv-stats', 'sse-adv-reconnect', 'sse-adv-last-event-id',
      'sse-adv-clear',
    ]);
  });

  it('estimated time is 3 minutes', () => {
    expect(sseStudioAdvancedLesson.estimatedMinutes).toBe(3);
  });

  // ─── Step: sse-adv-intro ──────────────────────────────────

  it('step sse-adv-intro highlights SSE studio', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-intro')!;
    expect(step.highlight).toContain('sse-studio');
  });

  it('step sse-adv-intro preAction fills URL and connects', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('sse-url-input'),
      expect.stringContaining('sse-test'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-connect-btn'));
  });

  // ─── Step: sse-adv-bookmark ───────────────────────────────

  it('step sse-adv-bookmark highlights event row', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark')!;
    expect(step.highlight).toContain('sse-event-row');
  });

  it('step sse-adv-bookmark action clicks bookmark star', async () => {
    // Build mock DOM with event rows and bookmark buttons
    const row1 = document.createElement('div');
    row1.setAttribute('data-testid', 'sse-event-row');
    const star1 = document.createElement('button');
    star1.className = 'sse-bookmark-btn';
    star1.onclick = vi.fn();
    row1.appendChild(star1);
    document.body.appendChild(row1);

    const row2 = document.createElement('div');
    row2.setAttribute('data-testid', 'sse-event-row');
    document.body.appendChild(row2);

    const row3 = document.createElement('div');
    row3.setAttribute('data-testid', 'sse-event-row');
    const star3 = document.createElement('button');
    star3.className = 'sse-bookmark-btn';
    star3.onclick = vi.fn();
    row3.appendChild(star3);
    document.body.appendChild(row3);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(star1.onclick).toHaveBeenCalled();
    expect(star3.onclick).toHaveBeenCalled();
  });

  // ─── Step: sse-adv-bookmark-filter ────────────────────────

  it('step sse-adv-bookmark-filter highlights bookmark filter', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark-filter')!;
    expect(step.highlight).toContain('sse-bookmark-filter');
  });

  it('step sse-adv-bookmark-filter action toggles filter on and off', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark-filter')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-bookmark-filter'));
    expect(ctx.click).toHaveBeenCalledTimes(2);
  });

  // ─── Step: sse-adv-stats ──────────────────────────────────

  it('step sse-adv-stats highlights status bar', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-stats')!;
    expect(step.highlight).toContain('sse-status-bar');
  });

  it('step sse-adv-stats has no action', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-stats')!;
    expect(step.action).toBeUndefined();
  });

  // ─── Step: sse-adv-reconnect ──────────────────────────────

  it('step sse-adv-reconnect highlights Connect tab', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-reconnect')!;
    expect(step.highlight).toContain('sse-left-tab-connect');
  });

  it('step sse-adv-reconnect preAction switches to Connect tab', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-reconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-left-tab-connect'));
  });

  it('step sse-adv-reconnect action toggles the checkbox', async () => {
    // Build mock DOM with reconnect checkbox
    const card = document.createElement('div');
    card.className = 'sse-reconnect-card';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.onclick = vi.fn();
    card.appendChild(checkbox);
    document.body.appendChild(card);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-reconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // Checkbox was toggled (clicked twice: off then on)
    expect(checkbox.onclick).toHaveBeenCalledTimes(2);
  });

  // ─── Step: sse-adv-last-event-id ──────────────────────────

  it('step sse-adv-last-event-id highlights state label', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-last-event-id')!;
    expect(step.highlight).toContain('sse-state-label');
  });

  it('step sse-adv-last-event-id preAction switches to Events tab', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-last-event-id')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-right-tab-events'));
  });

  it('step sse-adv-last-event-id action clicks an event row', async () => {
    // Build mock event row
    const row = document.createElement('div');
    row.setAttribute('data-testid', 'sse-event-row');
    row.onclick = vi.fn();
    document.body.appendChild(row);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-last-event-id')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(row.onclick).toHaveBeenCalled();
  });

  // ─── Step: sse-adv-clear ──────────────────────────────────

  it('step sse-adv-clear highlights clear button', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-clear')!;
    expect(step.highlight).toContain('sse-clear-btn');
  });

  it('step sse-adv-clear action exports then clears', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-clear')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-export-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-clear-btn'));
    // Export should come before clear
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map((c: string[]) => c[0]);
    const exportIdx = calls.findIndex((c: string) => c.includes('sse-export-btn'));
    const clearIdx = calls.findIndex((c: string) => c.includes('sse-clear-btn'));
    expect(exportIdx).toBeLessThan(clearIdx);
  });

  // ─── Setup / Cleanup ─────────────────────────────────────

  it('setup disconnects if connected and clears events', async () => {
    // Build mock DOM with connected state
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    connectBtn.onclick = vi.fn();
    document.body.appendChild(connectBtn);

    const clearBtn = document.createElement('button');
    clearBtn.setAttribute('data-testid', 'sse-clear-btn');
    clearBtn.onclick = vi.fn();
    document.body.appendChild(clearBtn);

    const eventsTab = document.createElement('button');
    eventsTab.setAttribute('data-testid', 'sse-right-tab-events');
    eventsTab.onclick = vi.fn();
    document.body.appendChild(eventsTab);

    const connectTab = document.createElement('button');
    connectTab.setAttribute('data-testid', 'sse-left-tab-connect');
    connectTab.onclick = vi.fn();
    document.body.appendChild(connectTab);

    const ctx = makeCtx();
    await sseStudioAdvancedLesson.setup!(ctx);

    expect(connectBtn.onclick).toHaveBeenCalled();
    expect(clearBtn.onclick).toHaveBeenCalled();
    expect(eventsTab.onclick).toHaveBeenCalled();
    expect(connectTab.onclick).toHaveBeenCalled();
  });

  it('cleanup disconnects and clears', async () => {
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    connectBtn.onclick = vi.fn();
    document.body.appendChild(connectBtn);

    const clearBtn = document.createElement('button');
    clearBtn.setAttribute('data-testid', 'sse-clear-btn');
    clearBtn.onclick = vi.fn();
    document.body.appendChild(clearBtn);

    const ctx = makeCtx();
    await sseStudioAdvancedLesson.cleanup!(ctx);

    expect(connectBtn.onclick).toHaveBeenCalled();
    expect(clearBtn.onclick).toHaveBeenCalled();
  });
});
