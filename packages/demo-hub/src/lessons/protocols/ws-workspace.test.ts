/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsWorkspaceLesson } from './ws-workspace';
import { makeCtx, makeVisible } from './ws-test-utils';

/** Prevent wsSetup from polling up to 10s waiting for a mock-server stop button. */
function stubMockServerRunning(): void {
  if (document.querySelector('[data-testid="mock-stop-btn"]')) return;
  const stopBtn = document.createElement('button');
  stopBtn.setAttribute('data-testid', 'mock-stop-btn');
  makeVisible(stopBtn);
  document.body.appendChild(stopBtn);
  makeVisible(stopBtn);
}

describe('ws-workspace lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsWorkspaceLesson.id).toBe('ws-workspace');
    expect(wsWorkspaceLesson.domainId).toBe('protocols');
    expect(wsWorkspaceLesson.name).toBe('Profiles, Templates & Env Vars');
    expect(wsWorkspaceLesson.steps.length).toBe(10);
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

  it('does not have allowedTabs undefined', () => {
    expect(wsWorkspaceLesson.allowedTabs).toBeDefined();
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
      'ws-env-config',
      'ws-header-select',
      'ws-env-resolve',
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

  it('step ws-profile-intro preAction clears selected class from rail and card items', async () => {
    document.body.innerHTML = `
      <div class="ws-saved-rail-item selected"></div>
      <div class="ws-saved-card selected"></div>`;
    makeVisible(document.querySelector('.ws-saved-rail-item.selected')!);
    makeVisible(document.querySelector('.ws-saved-card.selected')!);
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-intro')!;
    await step.preAction!(makeCtx());
    expect(document.querySelector('.ws-saved-rail-item.selected')).toBeNull();
    expect(document.querySelector('.ws-saved-card.selected')).toBeNull();
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

  it('step ws-profile-save action clicks save-as-profile, waits for modal, fills name, saves', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-save')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('save-as-profile-btn'));
    // Rule 5: ProfileEditorModal is conditionally rendered — must wait for it
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('profile-name-input'));
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

  it('step ws-profile-load action returns early when no profile card exists', async () => {
    // No profile-card in DOM → early return branch
    document.body.innerHTML = '';
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-load')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // No ctx.click calls since action exits at the guard
    const profileClicks = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .map((c: string[]) => c[0])
      .filter((s: string) => s.includes('profile-card'));
    expect(profileClicks.length).toBe(0);
  });

  // ─── Step: ws-template-intro ──────────────────────────────────

  it('step ws-template-intro preAction navigates to compose tab', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-intro')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
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
    // Rule 5: waits for dropdown to appear before the 1200ms observation delay
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('template-dropdown'));
  });

  // ─── Step: ws-template-save ───────────────────────────────────

  it('step ws-template-save preAction navigates to send tab and closes modal if open', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-save')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('step ws-template-save preAction closes open template modal via trigger click', async () => {
    document.body.innerHTML = `
      <div data-testid="template-dropdown"></div>
      <button data-testid="template-trigger">Templates</button>`;
    makeVisible(document.querySelector('[data-testid="template-dropdown"]')!);
    const trigger = document.querySelector('[data-testid="template-trigger"]') as HTMLElement;
    makeVisible(trigger);
    const clickSpy = vi.spyOn(trigger, 'click');
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-save')!;
    await step.preAction!(makeCtx());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step ws-template-save preAction skips trigger when dropdown open but trigger absent', async () => {
    document.body.innerHTML = `<div data-testid="template-dropdown"></div>`;
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-save')!;
    await expect(step.preAction!(makeCtx())).resolves.not.toThrow();
  });

  it('step ws-template-save action fills message, opens modal, fills name and saves', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-save')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      expect.stringContaining('greet'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('template-trigger'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('template-save-name'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('template-save-name'),
      'greeting',
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('template-save-btn'));
  });

  // ─── Step: ws-template-load ───────────────────────────────────

  it('step ws-template-load preAction clears compose, navigates to send, and closes modal if open', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-load')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      '',
    );
  });

  it('step ws-env-config preAction navigates to ws studio when env manager and URL input are both absent', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-config')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('websocket-studio');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('step ws-env-config preAction skips navigation when env manager is already visible', async () => {
    document.body.innerHTML = '<div class="env-manager"></div>';
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-config')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const wsNavCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .map((c: string[]) => c[0])
      .filter((sel: string) => sel.includes('nav-tab-websocket-studio'));
    expect(wsNavCalls.length).toBe(0);
  });

  it('step ws-env-resolve preAction returns to connect tab in websocket studio', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-resolve')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('websocket-studio');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step ws-template-load preAction closes modal when it was left open from step 5', async () => {
    document.body.innerHTML = `
      <div data-testid="template-dropdown"></div>
      <button data-testid="template-trigger">Templates</button>`;
    makeVisible(document.querySelector('[data-testid="template-dropdown"]')!);
    const trigger = document.querySelector('[data-testid="template-trigger"]') as HTMLElement;
    makeVisible(trigger);
    const clickSpy = vi.spyOn(trigger, 'click');
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-load')!;
    await step.preAction!(makeCtx());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step ws-template-load preAction skips close-modal when modal already closed', async () => {
    document.body.innerHTML = `<button data-testid="template-trigger">Templates</button>`;
    const trigger = document.querySelector('[data-testid="template-trigger"]') as HTMLElement;
    const clickSpy = vi.spyOn(trigger, 'click');
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-load')!;
    await step.preAction!(makeCtx());
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('step ws-template-load preAction skips trigger click when trigger element is absent', async () => {
    document.body.innerHTML = `<div data-testid="template-dropdown"></div>`;
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-load')!;
    await expect(step.preAction!(makeCtx())).resolves.not.toThrow();
  });

  it('step ws-template-load action opens template modal and waits, then loads via ctx.click', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-template-load')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('template-trigger'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-template-item-load'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('ws-template-item-load'));
  });

  // ─── Step: ws-env-config ───────────────────────────────────────

  it('step ws-env-config action configures websocket endpoint without HTTP tab', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-config')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('environments');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="em-protocol-tab-websocket"]');
    expect(ctx.click).not.toHaveBeenCalledWith('[data-testid="em-protocol-tab-http"]');
  });

  it('step ws-header-select highlights header selectors and selects demo env/svc', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select">
        <option value="">Select env</option>
        <option value="e1">WebSocket Demo</option>
      </select>
      <select data-testid="header-svc-select">
        <option value="">Select svc</option>
        <option value="s1">ws-demo</option>
      </select>`;
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-header-select')!;
    expect(step.highlight).toContain('header-selectors');
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith('[data-testid="header-env-select"]', 'e1');
    expect(ctx.selectOption).toHaveBeenCalledWith('[data-testid="header-svc-select"]', 's1');
  });

  it('step ws-env-resolve preAction ensures header context before filling URL', async () => {
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
  });

  it('step ws-env-resolve action fills {{wsBaseUrl}}/ws template', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-resolve')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      '{{wsBaseUrl}}/ws',
    );
  });

  // ─── Step: ws-env-warn ───────────────────────────────────────

  it('step ws-env-warn preAction is a no-op when URL input already visible', async () => {
    // Coming from ws-template-load: URL input present → preAction skips all navigation.
    document.body.innerHTML = '<div aria-label="WebSocket URL"></div>';
    makeVisible(document.querySelector('[aria-label="WebSocket URL"]')!);
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-warn')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('step ws-env-warn preAction navigates to WS Studio when URL input missing', async () => {
    document.body.innerHTML = '';
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-env-warn')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('websocket-studio');
    // When navigating from scratch, also switches to Client mode and Connect tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

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
    stubMockServerRunning();
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

  it('setup deletes existing profile cards via clearSavedProfiles', async () => {
    document.body.innerHTML = `
      <div data-testid="profile-card-abc">Profile</div>
      <button data-testid="delete-btn-abc">Delete</button>
      <button data-testid="confirm-delete-abc">Confirm</button>`;
    stubMockServerRunning();
    const card = document.querySelector('[data-testid="profile-card-abc"]')!;
    const confirm = document.querySelector('[data-testid="confirm-delete-abc"]')!;
    makeVisible(card as HTMLElement);
    makeVisible(document.querySelector('[data-testid="delete-btn-abc"]') as HTMLElement);
    makeVisible(confirm as HTMLElement);
    confirm.addEventListener('click', () => card.remove());

    const ctx = makeCtx();
    await wsWorkspaceLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-saved'));
    expect(document.querySelector('[data-testid="profile-card-abc"]')).toBeNull();
  });

  it('setup clears templates when trigger and delete buttons exist', async () => {
    document.body.innerHTML = `
      <button data-testid="template-trigger">Templates</button>
      <button data-testid="template-delete-1">Del</button>`;
    stubMockServerRunning();
    const delBtn = document.querySelector('[data-testid="template-delete-1"]')!;
    makeVisible(document.querySelector('[data-testid="template-trigger"]') as HTMLElement);
    makeVisible(delBtn as HTMLElement);
    delBtn.addEventListener('click', () => delBtn.remove());

    const ctx = makeCtx();
    await wsWorkspaceLesson.setup!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('template-trigger'));
    expect(document.querySelector('[data-testid="template-delete-1"]')).toBeNull();
  });

  it('setup clearTemplates returns early when template trigger is missing', async () => {
    stubMockServerRunning();
    const ctx = makeCtx();
    await expect(wsWorkspaceLesson.setup!(ctx)).resolves.not.toThrow();
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('template-trigger'));
  });

  it('setup closes template dropdown when still open after deletes', async () => {
    document.body.innerHTML = `
      <button data-testid="template-trigger">Templates</button>
      <div data-testid="template-dropdown"></div>`;
    stubMockServerRunning();
    const trigger = document.querySelector('[data-testid="template-trigger"]') as HTMLElement;
    makeVisible(trigger);
    makeVisible(document.querySelector('[data-testid="template-dropdown"]') as HTMLElement);
    const clickSpy = vi.spyOn(trigger, 'click');

    await wsWorkspaceLesson.setup!(makeCtx());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step ws-profile-intro action delays for observation', async () => {
    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(400);
  });

  it('step ws-profile-load action selects card and clicks load button', async () => {
    document.body.innerHTML = `
      <div data-testid="profile-card-abc">Profile</div>
      <button data-testid="load-btn-abc">Load</button>`;
    makeVisible(document.querySelector('[data-testid="profile-card-abc"]') as HTMLElement);
    makeVisible(document.querySelector('[data-testid="load-btn-abc"]') as HTMLElement);

    const step = wsWorkspaceLesson.steps.find(s => s.id === 'ws-profile-load')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="profile-card-abc"]');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="load-btn-abc"]');
  });

  it('cleanup clears profiles and templates before wsCleanup', async () => {
    document.body.innerHTML = `<button data-testid="template-trigger">T</button>`;
    const ctx = makeCtx();
    await wsWorkspaceLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-saved'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('clearProfiles skips deleteBtn block when no deleteBtn found for card (false branch line 38)', async () => {
    // Profile card exists but has no matching delete button → if (deleteBtn) is false.
    // The card is removed on its own .click() to stop the loop.
    document.body.innerHTML = `
      <div data-testid="profile-card-no-btn">Profile</div>
      <button data-testid="template-trigger">T</button>`;

    const card = document.querySelector('[data-testid="profile-card-no-btn"]')!;
    makeVisible(card as HTMLElement);
    card.addEventListener('click', () => card.remove()); // remove on click so loop terminates

    const ctx = makeCtx();
    await wsWorkspaceLesson.cleanup!(ctx);

    expect(document.querySelector('[data-testid="profile-card-no-btn"]')).toBeNull();
  });

  it('clearProfiles handles deleteBtn present but no confirm button (confirm?.click fallback)', async () => {
    // confirm element is absent → confirm?.click() is a no-op; card must be removed by deleteBtn
    document.body.innerHTML = `
      <div data-testid="profile-card-y2">Profile</div>
      <button data-testid="delete-btn-y2">Delete</button>
      <button data-testid="template-trigger">T</button>`;
    const deleteBtn = document.querySelector('[data-testid="delete-btn-y2"]')!;
    makeVisible(document.querySelector('[data-testid="profile-card-y2"]') as HTMLElement);
    makeVisible(deleteBtn as HTMLElement);
    deleteBtn.addEventListener('click', () => {
      document.querySelector('[data-testid="profile-card-y2"]')?.remove();
    });

    const ctx = makeCtx();
    await wsWorkspaceLesson.cleanup!(ctx);

    expect(document.querySelector('[data-testid="profile-card-y2"]')).toBeNull();
  });

  it('cleanup clearProfiles clicks delete and confirm when profile cards exist', async () => {
    // Set up a profile card with delete and confirm buttons
    // clearProfiles loops until no more [data-testid^="profile-card-"] are found
    document.body.innerHTML = `
      <div data-testid="profile-card-x1">Profile</div>
      <button data-testid="delete-btn-x1">Delete</button>
      <button data-testid="confirm-delete-x1">Confirm</button>
      <button data-testid="template-trigger">T</button>`;

    const deleteSpy = vi.fn();
    const confirmSpy = vi.fn();
    const deleteBtn = document.querySelector('[data-testid="delete-btn-x1"]')!;
    const confirmBtn = document.querySelector('[data-testid="confirm-delete-x1"]')!;
    makeVisible(document.querySelector('[data-testid="profile-card-x1"]') as HTMLElement);
    makeVisible(deleteBtn as HTMLElement);
    makeVisible(confirmBtn as HTMLElement);
    deleteBtn.addEventListener('click', deleteSpy);
    confirmBtn.addEventListener('click', () => {
      // Remove the card so the loop terminates after one iteration
      document.querySelector('[data-testid="profile-card-x1"]')?.remove();
      confirmSpy();
    });

    const ctx = makeCtx();
    await wsWorkspaceLesson.cleanup!(ctx);

    expect(deleteSpy).toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenCalled();
  });
});

// ─── ws-reliability ─────────────────────────────────────────────

