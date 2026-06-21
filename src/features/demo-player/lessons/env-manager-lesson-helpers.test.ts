/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  navigateToEnvironmentManager,
  expandFirstMicroservice,
  ensureFirstEnvDeployed,
  ensureNamedEnvDeployedOnProtocol,
  ensureSseDemoHeaderContext,
  editNamedProtocolEndpoint,
  selectProtocolTab,
  editFirstProtocolEndpoint,
  configureProtocolEndpointInEnvManager,
  configureGraphqlEndpoint,
  navigateToWebSocketStudio,
  navigateToSseStudio,
  navigateToGraphqlStudio,
  ensureDemoEnvironment,
  ensureDemoMicroservice,
  expandNamedMicroservice,
  cleanupDemoMicroservice,
  cleanupDemoEnvironment,
} from './env-manager-lesson-helpers';
import { makeCtx } from './protocols/ws-test-utils';
import { EM } from '../../../shared/selectors';

describe('env-manager-lesson-helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('navigateToEnvironmentManager navigates via navigateToTab when manager absent', async () => {
    const ctx = makeCtx();
    await navigateToEnvironmentManager(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('environments');
    expect(ctx.waitFor).toHaveBeenCalledWith(EM.MANAGER); // waits for the element to appear
  });

  it('navigateToEnvironmentManager skips navigation when manager already visible', async () => {
    document.body.innerHTML = '<div class="env-manager"></div>';
    const ctx = makeCtx();
    await navigateToEnvironmentManager(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  it('expandFirstMicroservice clicks configure when panel collapsed', async () => {
    document.body.innerHTML = '<button data-testid="em-svc-configure-svc1">Configure</button>';
    const ctx = makeCtx();
    await expandFirstMicroservice(ctx);
    expect(ctx.click).toHaveBeenCalledWith(EM.SVC_CONFIGURE);
    expect(ctx.waitFor).toHaveBeenCalledWith(EM.PROTOCOL_PANEL);
  });

  it('expandFirstMicroservice is no-op when protocol panel already open', async () => {
    document.body.innerHTML = '<div data-testid="microservice-protocol-panel"></div>';
    const ctx = makeCtx();
    await expandFirstMicroservice(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('expandFirstMicroservice prefers first visible configure button', async () => {
    document.body.innerHTML = '<button data-testid="em-svc-configure-svc1">Configure</button>';
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
      ({
        width: 120,
        height: 32,
        top: 0,
        left: 0,
        right: 120,
        bottom: 32,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
    );
    const ctx = makeCtx();
    await expandFirstMicroservice(ctx);
    expect(ctx.click).toHaveBeenCalledWith(EM.SVC_CONFIGURE);
    rectSpy.mockRestore();
  });

  it('selectProtocolTab clicks websocket tab', async () => {
    document.body.innerHTML = `
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-websocket">WS</button>
      </div>`;
    const ctx = makeCtx();
    await selectProtocolTab(ctx, 'websocket');
    expect(ctx.click).toHaveBeenCalledWith(EM.PROTOCOL_TAB_WS);
  });

  it('editFirstProtocolEndpoint opens inline editor and saves', async () => {
    document.body.innerHTML = `
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-endpoint-edit-btn">Edit</button>
      </div>`;
    const ctx = makeCtx();
    await editFirstProtocolEndpoint(ctx, 'ws://localhost:9876');
    expect(ctx.click).toHaveBeenCalledWith(`${EM.PROTOCOL_PANEL} ${EM.ENDPOINT_EDIT}`);
    expect(ctx.fill).toHaveBeenCalledWith(EM.ENDPOINT_EDIT_INPUT, 'ws://localhost:9876');
    expect(ctx.click).toHaveBeenCalledWith(EM.ENDPOINT_SAVE);
  });

  it('configureProtocolEndpointInEnvManager runs full websocket flow', async () => {
    document.body.innerHTML = `
      <button data-testid="em-svc-configure-s1">Configure</button>
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-http">HTTP</button>
        <button data-testid="em-protocol-tab-websocket">WS</button>
        <button data-testid="em-endpoint-edit-btn">Edit</button>
        <input data-testid="em-endpoint-edit-input" />
        <button data-testid="em-endpoint-save-btn">Save</button>
      </div>`;
    const ctx = makeCtx();
    await configureProtocolEndpointInEnvManager(ctx, 'websocket', 'ws://localhost:9876', {
      httpFallbackBase: 'http://localhost:9876',
    });
    expect(ctx.navigateToTab).toHaveBeenCalledWith('environments');
    expect(ctx.click).toHaveBeenCalledWith(EM.PROTOCOL_TAB_HTTP);
    expect(ctx.click).toHaveBeenCalledWith(EM.PROTOCOL_TAB_WS);
  });

  it('ensureFirstEnvDeployed enables deploy checkbox when HTTP row is empty', async () => {
    document.body.innerHTML = `
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-http">HTTP</button>
        <div class="em-empty-deployed"></div>
        <table>
          <tr>
            <td><input type="checkbox" aria-label="Deploy local" /></td>
            <td><button data-testid="em-endpoint-edit-btn">Edit</button></td>
            <td><code class="em-url-text"></code></td>
          </tr>
        </table>
        <input data-testid="em-endpoint-edit-input" />
        <button data-testid="em-endpoint-save-btn">Save</button>
      </div>`;
    const deploy = document.querySelector('input[aria-label="Deploy local"]') as HTMLInputElement;
    const deployClick = vi.spyOn(deploy, 'click');
    const ctx = makeCtx();
    await ensureFirstEnvDeployed(ctx, 'http://localhost:9876');
    expect(deployClick).toHaveBeenCalled();
  });

  it('ensureFirstEnvDeployed does not re-click deploy checkbox when already checked', async () => {
    document.body.innerHTML = `
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-http">HTTP</button>
        <div class="em-empty-deployed"></div>
        <table>
          <tr>
            <td><input type="checkbox" aria-label="Deploy local" checked /></td>
            <td><button data-testid="em-endpoint-edit-btn">Edit</button></td>
            <td><code class="em-url-text">http://localhost:9876</code></td>
          </tr>
        </table>
      </div>`;
    const deploy = document.querySelector('input[aria-label="Deploy local"]') as HTMLInputElement;
    const deployClick = vi.spyOn(deploy, 'click');
    const ctx = makeCtx();
    await ensureFirstEnvDeployed(ctx, 'http://localhost:9876');
    expect(deployClick).not.toHaveBeenCalled();
  });

  it('ensureFirstEnvDeployed returns early when row already has URL text', async () => {
    document.body.innerHTML = `
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-http">HTTP</button>
        <table>
          <tr>
            <td><button data-testid="em-endpoint-edit-btn">Edit</button></td>
            <td><code class="em-url-text">https://api.example.com</code></td>
          </tr>
        </table>
      </div>`;
    const ctx = makeCtx();
    await ensureFirstEnvDeployed(ctx, 'http://localhost:9876');
    const editCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .map((c: string[]) => c[0])
      .filter((sel: string) => sel.includes('em-endpoint-edit-btn'));
    expect(editCalls.length).toBe(0);
  });

  it('ensureNamedEnvDeployedOnProtocol deploys a named environment on SSE tab', async () => {
    document.body.innerHTML = `
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-sse">SSE</button>
        <table>
          <tr>
            <td><input type="checkbox" aria-label="Deploy SSE Demo" /></td>
            <td><span class="em-env-chip">SSE Demo</span></td>
            <td><button data-testid="em-endpoint-edit-btn">Edit</button></td>
            <td><code class="em-url-text"></code></td>
          </tr>
        </table>
        <input data-testid="em-endpoint-edit-input" />
        <button data-testid="em-endpoint-save-btn">Save</button>
      </div>`;
    const deploy = document.querySelector('input[aria-label="Deploy SSE Demo"]') as HTMLInputElement;
    const deployClick = vi.spyOn(deploy, 'click');
    const ctx = makeCtx();
    await ensureNamedEnvDeployedOnProtocol(ctx, 'sse', 'SSE Demo');
    expect(deployClick).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="em-protocol-tab-sse"]');
  });

  it('ensureSseDemoHeaderContext selects header options when already present', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select">
        <option value="e1">SSE Demo</option>
      </select>
      <select data-testid="header-svc-select">
        <option value="s1">sse-demo</option>
      </select>`;
    const ctx = makeCtx();
    await ensureSseDemoHeaderContext(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith('[data-testid="header-env-select"]', 'e1');
    expect(ctx.selectOption).toHaveBeenCalledWith('[data-testid="header-svc-select"]', 's1');
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('environments');
  });

  it('ensureSseDemoHeaderContext recreates demo data when header options are missing', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select"><option value="">Environment…</option></select>
      <select data-testid="header-svc-select"><option value="">Service…</option></select>`;
    const ctx = makeCtx();
    await ensureSseDemoHeaderContext(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('environments');
  });

  it('editNamedProtocolEndpoint edits the row matching the environment name', async () => {
    document.body.innerHTML = `
      <div data-testid="microservice-protocol-panel">
        <table>
          <tr>
            <td><span class="em-env-chip">d01</span></td>
            <td><button data-testid="em-endpoint-edit-btn">Edit d01</button></td>
          </tr>
          <tr>
            <td><span class="em-env-chip">SSE Demo</span></td>
            <td><button data-testid="em-endpoint-edit-btn">Edit SSE Demo</button></td>
          </tr>
        </table>
        <input data-testid="em-endpoint-edit-input" />
        <button data-testid="em-endpoint-save-btn">Save</button>
      </div>`;
    const sseEditBtn = document.querySelectorAll('[data-testid="em-endpoint-edit-btn"]')[1] as HTMLButtonElement;
    const editClick = vi.spyOn(sseEditBtn, 'click');
    const ctx = makeCtx();
    await editNamedProtocolEndpoint(ctx, 'SSE Demo', 'http://localhost:3001');
    expect(editClick).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledWith('[data-testid="em-endpoint-edit-input"]', 'http://localhost:3001');
  });

  it('configureProtocolEndpointInEnvManager supports graphql custom path without http fallback option', async () => {
    document.body.innerHTML = `
      <button data-testid="em-svc-configure-s1">Configure</button>
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-graphql">GraphQL</button>
        <button data-testid="em-endpoint-edit-btn">Edit</button>
        <input data-testid="em-endpoint-edit-input" />
        <button data-testid="em-endpoint-save-btn">Save</button>
        <input data-testid="em-graphql-path-input" value="/graphql" />
      </div>`;
    const ctx = makeCtx();
    await configureProtocolEndpointInEnvManager(ctx, 'graphql', 'http://localhost:4010', {
      graphqlPath: '/v2/query',
    });
    expect(ctx.click).toHaveBeenCalledWith(EM.PROTOCOL_TAB_GQL);
    expect(ctx.fill).toHaveBeenCalledWith(
      `${EM.PROTOCOL_PANEL} ${EM.GRAPHQL_PATH_INPUT}`,
      '/v2/query',
    );
  });

  it('configureProtocolEndpointInEnvManager uses default graphql path when options are omitted', async () => {
    document.body.innerHTML = `
      <button data-testid="em-svc-configure-s1">Configure</button>
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-graphql">GraphQL</button>
        <button data-testid="em-endpoint-edit-btn">Edit</button>
        <input data-testid="em-endpoint-edit-input" />
        <button data-testid="em-endpoint-save-btn">Save</button>
        <input data-testid="em-graphql-path-input" value="/legacy" />
      </div>`;
    const ctx = makeCtx();
    await configureProtocolEndpointInEnvManager(ctx, 'graphql', 'http://localhost:4010');
    expect(ctx.fill).toHaveBeenCalledWith(
      `${EM.PROTOCOL_PANEL} ${EM.GRAPHQL_PATH_INPUT}`,
      '/graphql',
    );
  });

  it('configureGraphqlEndpoint fills default path when current path differs', async () => {
    document.body.innerHTML = `
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-graphql">GraphQL</button>
        <button data-testid="em-endpoint-edit-btn">Edit</button>
        <input data-testid="em-endpoint-edit-input" />
        <button data-testid="em-endpoint-save-btn">Save</button>
        <input data-testid="em-graphql-path-input" value="/old" />
      </div>`;
    const ctx = makeCtx();
    await configureGraphqlEndpoint(ctx, 'http://localhost:4010', '/graphql');
    expect(ctx.fill).toHaveBeenCalledWith(
      `${EM.PROTOCOL_PANEL} ${EM.GRAPHQL_PATH_INPUT}`,
      '/graphql',
    );
  });

  it('configureGraphqlEndpoint skips path fill when current path already matches', async () => {
    document.body.innerHTML = `
      <div data-testid="microservice-protocol-panel">
        <button data-testid="em-protocol-tab-graphql">GraphQL</button>
        <button data-testid="em-endpoint-edit-btn">Edit</button>
        <input data-testid="em-endpoint-edit-input" />
        <button data-testid="em-endpoint-save-btn">Save</button>
        <input data-testid="em-graphql-path-input" value="/graphql" />
      </div>`;
    const ctx = makeCtx();
    await configureGraphqlEndpoint(ctx, 'http://localhost:4010', '/graphql');
    const pathFillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: string[]) => c[0] === `${EM.PROTOCOL_PANEL} ${EM.GRAPHQL_PATH_INPUT}`,
    );
    expect(pathFillCalls.length).toBe(0);
  });

  it('navigateToWebSocketStudio navigates via navigateToTab when studio absent', async () => {
    const ctx = makeCtx();
    await navigateToWebSocketStudio(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('websocket-studio');
  });

  it('navigateToWebSocketStudio is no-op when studio already visible', async () => {
    document.body.innerHTML = '<div data-testid="ws-studio"></div>';
    const ctx = makeCtx();
    await navigateToWebSocketStudio(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('navigateToSseStudio navigates via navigateToTab when studio absent', async () => {
    const ctx = makeCtx();
    await navigateToSseStudio(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('sse-studio');
  });

  it('navigateToSseStudio is no-op when studio already visible', async () => {
    document.body.innerHTML = '<div data-testid="sse-studio"></div>';
    const ctx = makeCtx();
    await navigateToSseStudio(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('navigateToGraphqlStudio navigates via navigateToTab when studio absent', async () => {
    const ctx = makeCtx();
    await navigateToGraphqlStudio(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('graphql-studio');
  });

  it('navigateToGraphqlStudio is no-op when studio already visible', async () => {
    document.body.innerHTML = '<div data-testid="gql-studio-page"></div>';
    const ctx = makeCtx();
    await navigateToGraphqlStudio(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  // ── ensureDemoEnvironment ────────────────────────────────────────

  it('ensureDemoEnvironment creates env when name is absent', async () => {
    document.body.innerHTML = '<div class="env-manager"></div>';
    const ctx = makeCtx();
    await ensureDemoEnvironment(ctx, 'WebSocket Demo');
    expect(ctx.fill).toHaveBeenCalledWith(EM.ADD_ENV_INPUT, 'WebSocket Demo');
    expect(ctx.click).toHaveBeenCalledWith(EM.ADD_ENV_BTN);
  });

  it('ensureDemoEnvironment is no-op when env chip already in DOM', async () => {
    document.body.innerHTML =
      '<div class="env-manager"><div data-env-name="WebSocket Demo"></div></div>';
    const ctx = makeCtx();
    await ensureDemoEnvironment(ctx, 'WebSocket Demo');
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(EM.ADD_ENV_BTN);
  });

  // ── ensureDemoMicroservice ───────────────────────────────────────

  it('ensureDemoMicroservice creates svc when name is absent', async () => {
    document.body.innerHTML = '<div class="env-manager"></div>';
    const ctx = makeCtx();
    await ensureDemoMicroservice(ctx, 'ws-demo');
    expect(ctx.fill).toHaveBeenCalledWith(EM.ADD_SVC_INPUT, 'ws-demo');
    expect(ctx.click).toHaveBeenCalledWith(EM.ADD_SVC_BTN);
  });

  it('ensureDemoMicroservice is no-op when svc card already in DOM', async () => {
    document.body.innerHTML =
      '<div class="env-manager"><div data-svc-name="ws-demo"></div></div>';
    const ctx = makeCtx();
    await ensureDemoMicroservice(ctx, 'ws-demo');
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(EM.ADD_SVC_BTN);
  });

  // ── expandNamedMicroservice ──────────────────────────────────────

  it('expandNamedMicroservice clicks the Configure button inside the named card', async () => {
    document.body.innerHTML = `
      <div class="env-manager">
        <div data-svc-name="ws-demo">
          <button data-testid="em-svc-configure-abc">Configure</button>
        </div>
      </div>`;
    const ctx = makeCtx();
    await expandNamedMicroservice(ctx, 'ws-demo');
    expect(ctx.waitFor).toHaveBeenCalledWith(EM.PROTOCOL_PANEL);
  });

  it('expandNamedMicroservice is no-op when protocol panel is already open', async () => {
    document.body.innerHTML = `
      <div data-testid="microservice-protocol-panel"></div>
      <div data-svc-name="ws-demo">
        <button data-testid="em-svc-configure-abc">Configure</button>
      </div>`;
    const ctx = makeCtx();
    await expandNamedMicroservice(ctx, 'ws-demo');
    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  it('expandNamedMicroservice falls back to first svc when named card not found', async () => {
    document.body.innerHTML =
      '<button data-testid="em-svc-configure-xyz">Configure</button>';
    const ctx = makeCtx();
    await expandNamedMicroservice(ctx, 'nonexistent-svc');
    // Falls through to expandFirstMicroservice
    expect(ctx.click).toHaveBeenCalledWith(EM.SVC_CONFIGURE);
    expect(ctx.waitFor).toHaveBeenCalledWith(EM.PROTOCOL_PANEL);
  });

  // ── cleanupDemoMicroservice ──────────────────────────────────────

  it('cleanupDemoMicroservice is no-op when svc not in DOM', async () => {
    document.body.innerHTML = '<div class="env-manager"></div>';
    const ctx = makeCtx();
    await cleanupDemoMicroservice(ctx, 'sse-demo');
    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    const dangerClicks = clickCalls.filter((c: string[]) => c[0]?.includes('btn-danger'));
    expect(dangerClicks.length).toBe(0);
  });

  it('cleanupDemoMicroservice clicks Delete and confirms when svc card is present', async () => {
    document.body.innerHTML = `
      <div class="env-manager">
        <div data-svc-name="sse-demo">
          <button data-testid="em-svc-configure-svc1" class="btn btn-xs">Configure</button>
          <button class="btn btn-xs btn-danger">Delete</button>
        </div>
        <div class="confirm-dialog"><button class="btn-danger">Delete Permanently</button></div>
      </div>`;
    const deleteBtn = document.querySelector<HTMLElement>('[data-svc-name="sse-demo"] .btn-danger')!;
    const clickSpy = vi.spyOn(deleteBtn, 'click');
    const ctx = makeCtx();
    await cleanupDemoMicroservice(ctx, 'sse-demo');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('cleanupDemoMicroservice collapses expanded panel before deleting', async () => {
    document.body.innerHTML = `
      <div class="env-manager">
        <div data-svc-name="sse-demo">
          <button data-testid="em-svc-configure-svc1" class="btn btn-xs">Collapse</button>
          <button class="btn btn-xs btn-danger">Delete</button>
        </div>
      </div>`;
    const collapseBtn = document.querySelector<HTMLElement>('[data-testid="em-svc-configure-svc1"]')!;
    const collapseSpy = vi.spyOn(collapseBtn, 'click');
    const ctx = makeCtx();
    await cleanupDemoMicroservice(ctx, 'sse-demo');
    expect(collapseSpy).toHaveBeenCalled();
  });

  // ── cleanupDemoEnvironment ───────────────────────────────────────

  it('cleanupDemoEnvironment is no-op when env chip not in DOM', async () => {
    document.body.innerHTML = '<div class="env-manager"></div>';
    const ctx = makeCtx();
    await cleanupDemoEnvironment(ctx, 'SSE Demo');
    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    const chipDeleteClicks = clickCalls.filter((c: string[]) => c[0]?.includes('settings-chip-delete'));
    expect(chipDeleteClicks.length).toBe(0);
  });

  it('cleanupDemoEnvironment clicks × and confirms when chip is present', async () => {
    document.body.innerHTML = `
      <div class="env-manager">
        <div data-env-name="SSE Demo" class="settings-chip">
          <button class="settings-chip-delete">×</button>
        </div>
        <div class="confirm-dialog"><button class="btn-danger">Delete Permanently</button></div>
      </div>`;
    const chipDeleteBtn = document.querySelector<HTMLElement>('[data-env-name="SSE Demo"] .settings-chip-delete')!;
    const clickSpy = vi.spyOn(chipDeleteBtn, 'click');
    const ctx = makeCtx();
    await cleanupDemoEnvironment(ctx, 'SSE Demo');
    expect(clickSpy).toHaveBeenCalled();
  });
});
