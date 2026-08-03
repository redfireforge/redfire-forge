/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsWorkspaceLesson } from './ws-workspace';
import { makeCtx, makeVisible } from './ws-test-utils';

const clearProfilesSpy = vi.fn(async () => {});
const clearTemplatesSpy = vi.fn(async () => {});

vi.mock('../../adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../adapters')>();
  return {
    ...actual,
    clearWsProfilesQuiet: (...args: unknown[]) => clearProfilesSpy(...args),
    clearWsTemplatesQuiet: (...args: unknown[]) => clearTemplatesSpy(...args),
  };
});

/** Stub fetch for quiet REST mock start/stop used by workspace setup/cleanup. */
function stubMockFetch(): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/ws/mock/status')) {
      return new Response(JSON.stringify({ running: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }));
}

describe('ws-workspace lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearProfilesSpy.mockClear();
    clearTemplatesSpy.mockClear();
    stubMockFetch();
  });

  it('has valid lesson structure', () => {
    expect(wsWorkspaceLesson.id).toBe('ws-workspace');
    expect(wsWorkspaceLesson.domainId).toBe('protocols');
    expect(wsWorkspaceLesson.name).toBe('Profiles, Templates & Env Vars');
    expect(wsWorkspaceLesson.steps.length).toBe(9);
    expect(wsWorkspaceLesson.concept.title).toBeTruthy();
    expect(wsWorkspaceLesson.concept.body).toBeTruthy();
    expect(wsWorkspaceLesson.initialTab).toBe('websocket-studio');
  });

  it('has correct metadata', () => {
    expect(wsWorkspaceLesson.category).toBe('websocket');
    expect(wsWorkspaceLesson.estimatedMinutes).toBe(5);
    expect(wsWorkspaceLesson.tag).toBeUndefined();
    expect(wsWorkspaceLesson.dockerEndpoint).toBeUndefined();
  });

  it('declares allowedTabs for environments and websocket-studio', () => {
    expect(wsWorkspaceLesson.allowedTabs).toContain('environments');
    expect(wsWorkspaceLesson.allowedTabs).toContain('websocket-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsWorkspaceLesson.setup).toBe('function');
    expect(typeof wsWorkspaceLesson.cleanup).toBe('function');
  });

  it('concept teaches profiles → templates → env vars in that order', () => {
    const body = wsWorkspaceLesson.concept.body;
    expect(body.indexOf('Connection profiles')).toBeLessThan(body.indexOf('Message templates'));
    expect(body.indexOf('Message templates')).toBeLessThan(body.indexOf('Environment variables'));
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

  it('all steps have id, title, description, and pauseAfter', () => {
    wsWorkspaceLesson.steps.forEach(step => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description.length).toBeGreaterThan(30);
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('step IDs follow URL → profile → template → env story', () => {
    expect(wsWorkspaceLesson.steps.map(s => s.id)).toEqual([
      'ws-url-ready',
      'ws-profile-save',
      'ws-profile-browse',
      'ws-profile-load',
      'ws-template-save',
      'ws-template-load',
      'ws-env-config',
      'ws-env-resolve',
      'ws-env-warn',
    ]);
  });

  // ─── Act I: Profiles ─────────────────────────────────────────

  it('step ws-url-ready fills mock URL with spotlight', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-url-ready')!;
    expect(step.highlight).toContain('WebSocket URL');
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('localhost'),
    );
  });

  it('step ws-profile-save opens editor and saves Demo Echo Server', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-save')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('localhost'),
    );
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('save-as-profile-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('profile-name-input'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('profile-name-input'),
      'Demo Echo Server',
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('profile-save-btn'));
  });

  it('step ws-profile-browse opens Saved and selects a card', async () => {
    document.body.innerHTML = `
      <div class="ws-saved-rail-item selected"></div>
      <div data-testid="profile-card-abc">Profile</div>`;
    makeVisible(document.querySelector('.ws-saved-rail-item.selected')!);
    makeVisible(document.querySelector('[data-testid="profile-card-abc"]') as HTMLElement);
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-browse')!;
    expect(step.highlight).toContain('mode-saved');
    await step.preAction!(makeCtx());
    expect(document.querySelector('.ws-saved-rail-item.selected')).toBeNull();
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-saved'));
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="profile-card-abc"]');
  });

  it('step ws-profile-load clicks Load & Connect', async () => {
    document.body.innerHTML = `
      <div data-testid="profile-card-abc">Profile</div>
      <button data-testid="load-btn-abc">Load</button>`;
    makeVisible(document.querySelector('[data-testid="profile-card-abc"]') as HTMLElement);
    makeVisible(document.querySelector('[data-testid="load-btn-abc"]') as HTMLElement);
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-load')!;
    expect(step.description).toContain('Load & Connect');
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="profile-card-abc"]');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="load-btn-abc"]');
  });

  it('step ws-profile-load action is a no-op without a profile card', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-load')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect((ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .map((c: string[]) => c[0])
      .filter((s: string) => s.includes('profile-card')).length).toBe(0);
  });

  // ─── Act II: Templates ───────────────────────────────────────

  it('step ws-template-save fills body, opens modal, and saves greeting', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-save')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      expect.stringContaining('greet'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('template-trigger'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('template-save-name'),
      'greeting',
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('template-save-btn'));
  });

  it('step ws-template-save preAction closes open template modal', async () => {
    document.body.innerHTML = `
      <div data-testid="template-dropdown"></div>
      <button data-testid="template-trigger">Templates</button>`;
    makeVisible(document.querySelector('[data-testid="template-dropdown"]')!);
    const trigger = document.querySelector('[data-testid="template-trigger"]') as HTMLElement;
    makeVisible(trigger);
    const clickSpy = vi.spyOn(trigger, 'click');
    await wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-save')!.preAction!(makeCtx());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step ws-template-load clears compose then loads template', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-load')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('Message input'), '');
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('template-trigger'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('ws-template-item-load'));
  });

  // ─── Act III: Env vars ───────────────────────────────────────

  it('step ws-env-config configures websocket endpoint', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-config')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('environments');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="em-protocol-tab-websocket"]');
  });

  it('step ws-env-resolve selects header context then fills {{wsBaseUrl}}/ws', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select">
        <option value="">Select env</option>
        <option value="e1">WebSocket Demo</option>
      </select>
      <select data-testid="header-svc-select">
        <option value="">Select svc</option>
        <option value="s1">ws-demo</option>
      </select>`;
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-resolve')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('websocket-studio');
    expect(ctx.selectOption).toHaveBeenCalledTimes(2);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      '{{wsBaseUrl}}/ws',
    );
  });

  it('step ws-env-warn fills unresolved placeholder', async () => {
    document.body.innerHTML = '<div aria-label="WebSocket URL"></div>';
    makeVisible(document.querySelector('[aria-label="WebSocket URL"]')!);
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-warn')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('{{unknownHost}}'),
    );
  });

  it('step ws-env-warn preAction navigates when URL input missing', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-warn')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('websocket-studio');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  // ─── Setup / Cleanup ─────────────────────────────────────────

  it('setup uses quiet REST mock and clears profiles/templates without mode tours', async () => {
    const connectTab = document.createElement('button');
    connectTab.setAttribute('data-testid', 'left-tab-connect');
    document.body.appendChild(connectTab);
    makeVisible(connectTab);
    const connectClickSpy = vi.spyOn(connectTab, 'click');

    const ctx = makeCtx();
    await wsWorkspaceLesson.setup!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('mode-saved'));
    expect(clearProfilesSpy).toHaveBeenCalled();
    expect(clearTemplatesSpy).toHaveBeenCalled();
    expect(connectClickSpy).toHaveBeenCalled();
  });

  it('cleanup clears workspace state quietly without Saved/Send tours', async () => {
    const ctx = makeCtx();
    await wsWorkspaceLesson.cleanup!(ctx);
    expect(clearProfilesSpy).toHaveBeenCalled();
    expect(clearTemplatesSpy).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('mode-saved'));
  });
});
