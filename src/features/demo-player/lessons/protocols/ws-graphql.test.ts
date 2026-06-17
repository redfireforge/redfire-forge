/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { wsGraphqlLesson } from './ws-graphql';
import { makeCtx } from './ws-test-utils';

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

  it('step gql-protocol has a preAction that navigates to connect tab', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-protocol')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step gql-protocol action calls ctx.delay (observation pause)', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-protocol')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(300);
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

  it('step gql-connect action clicks connect button when not connected and switches to events tab', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-connect')!;
    const ctx = makeCtx();
    // No STATUS_CONNECTED element → should click CONNECT_BTN
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-status-dot'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step gql-connect action skips connect when already connected', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-connect')!;
    const ctx = makeCtx();
    // Simulate already-connected state
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    document.body.appendChild(dot);
    await step.action!(ctx);
    // Should NOT click connect button again
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // Should still waitFor STATUS_CONNECTED and switch to Events
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-status-dot'));
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
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('step gql-compose action calls ctx.delay (observation pause)', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-compose')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(500);
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

  it('step gql-subscribe has a preAction that navigates to compose and fills the query when connected', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-subscribe')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    // Simulate already-connected state so the connection guard is a no-op
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    document.body.appendChild(dot);
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('countdown'),
    );
  });

  it('step gql-subscribe preAction connects when not connected before filling compose', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-subscribe')!;
    const ctx = makeCtx();
    // No STATUS_CONNECTED element → should navigate to connect tab and click connect
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-status-dot'));
    // Then should navigate to compose and fill the query
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('countdown'));
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

  it('step gql-frames action calls ctx.delay (observation pause)', async () => {
    const step = wsGraphqlLesson.steps.find(s => s.id === 'gql-frames')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(600);
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

