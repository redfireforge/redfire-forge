import type { DemoActionContext } from '../../../types';
import { GQL, WF } from '@shared/selectors';
import {
  addWorkflowNodeWithPreset,
  getWorkflowByName,
} from '../../../adapters';
import {
  clickWfConfigAddRow,
  clickWfConfigTab,
  collapseWfDemoAppSidebar,
  dismissWorkflowExecSummary,
  expandWfDemoAppSidebar,
  fillWfConfigField,
  holdWfSpotlight,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  revealPaletteBlock,
  resetWfPaletteToBlocks,
  saveAndCloseWfConfigModal,
  selectWfConfigOption,
  selectWorkflowFromAppSidebar,
  closeWfConsoleIfOpen,
  waitForWfConfigPanel,
} from '../../wf-demo-helpers';
import { fillControlledInput } from '../../setup-helpers';
import {
  GQL_DEMO_HTTP,
  LESSON18_CREATED_USER_ID_VAR,
  LESSON18_CREATE_MUTATION,
  LESSON18_DELETE_MUTATION,
  LESSON18_DELETE_NODE_SELECTOR,
  LESSON18_DELETE_VARS,
  LESSON18_EXTRACTION_JSONPATH,
  LESSON18_FETCHED_USER_VAR,
  LESSON18_GET_USER_QUERY,
  LESSON18_MUTATION_VARS,
  LESSON18_NODE_ASSERT,
  LESSON18_NODE_CREATE,
  LESSON18_NODE_DELETE,
  LESSON18_NODE_FETCH,
  LESSON18_QUERY_VARS,
  LESSON18_TEST_NAME,
  LESSON18_TEST_NAME_VAR,
  LESSON18_WF_NAME,
} from './lesson18-workflow-mutation.constants';
import {
  connectLesson18Edge,
  connectWfNodesBySelector,
  isLesson18AssertNodeReady,
  isLesson18AssertSourceReady,
  isLesson18CreateMutationOpReady,
  isLesson18CreateNodeReady,
  isLesson18DeleteNodeReady,
  isLesson18DeleteOnCanvas,
  isLesson18FetchNodeReady,
  isLesson18FetchQueryOpReady,
  isLesson18NodeOnCanvas,
  isLesson18QuickTestPassVisible,
  isLesson18WorkflowActive,
  isLesson18WorkflowVariablesConfigured,
  lesson18EdgeExists,
  lesson18Session,
  patchLesson18WorkflowVariablesQuiet,
  resolveLesson18DeleteNodeId,
  resolveLesson18EndNodeId,
  resolveLesson18StartNodeId,
  wireLesson18DeleteNode,
} from './lesson18-workflow-mutation.graph';

async function dismissWorkflowOnboarding(ctx: DemoActionContext): Promise<void> {
  const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
  if (skipBtn) {
    skipBtn.click();
    await ctx.delay(300);
  }
}

async function clickWfFitView(ctx: DemoActionContext): Promise<void> {
  const btn = document.querySelector<HTMLElement>('button[title="Fit view"]');
  if (btn) {
    btn.click();
    await ctx.delay(500);
  }
}

/** Close console + exec strip without re-centering the canvas. */
async function prepareLesson18CanvasUiOnly(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(300);
  await dismissWorkflowExecSummary(ctx);
  await closeWfConsoleIfOpen(ctx);
}

/** Close console + exec strip so canvas/node palette steps are unobstructed. */
async function prepareLesson18CanvasForBuilding(ctx: DemoActionContext): Promise<void> {
  await prepareLesson18CanvasUiOnly(ctx);
  await clickWfFitView(ctx);
}

/** Reading phase before Quick Test — assert chain ready, canvas clear, console closed until run. */
export async function prepareLesson18BeforeQuickTest(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertRuleConfigured(ctx);
  await prepareLesson18CanvasForBuilding(ctx);
}

/** Reading phase before teardown Quick Test — delete node configured, canvas clear. */
export async function prepareLesson18BeforeFinalQuickTest(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18DeleteConfigured(ctx);
  await prepareLesson18CanvasUiOnly(ctx);
}

/** Reading phase before adding Delete User — no Quick Test re-run, console closed. */
export async function prepareLesson18BeforeDeleteNode(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertRuleConfigured(ctx);
  await prepareLesson18CanvasForBuilding(ctx);
}

/** Collapse the workflows list once after create — never toggle again mid-lesson. */
async function collapseLesson18SidebarOnce(ctx: DemoActionContext): Promise<void> {
  if (lesson18Session.sidebarCollapsed) return;
  await collapseWfDemoAppSidebar(ctx);
  lesson18Session.sidebarCollapsed = true;
}

/** Visible palette filter: type GraphQL, spotlight search, pause, then spotlight the block. */
async function prepareLesson18GraphQLPaletteClick(
  ctx: DemoActionContext,
  paletteSelector: string,
): Promise<void> {
  resetWfPaletteToBlocks();
  const search = document.querySelector<HTMLInputElement>(WF.PAL_SEARCH);
  if (search) {
    await holdWfSpotlight(ctx, WF.PAL_SEARCH, 500);
    if (search.value !== 'GraphQL') {
      fillControlledInput(search, 'GraphQL');
    }
    // Hold so the viewer can read the filtered list before the click.
    await holdWfSpotlight(ctx, WF.PAL_SEARCH, 800);
  } else {
    await revealPaletteBlock(ctx, paletteSelector);
  }

  try {
    await ctx.waitFor(paletteSelector, 5000);
  } catch {
    await revealPaletteBlock(ctx, paletteSelector);
  }
  await holdWfSpotlight(ctx, paletteSelector, 800);
}

async function clearLesson18PaletteSearch(ctx: DemoActionContext): Promise<void> {
  const search = document.querySelector<HTMLInputElement>(WF.PAL_SEARCH);
  if (!search?.value) return;
  fillControlledInput(search, '');
  await ctx.delay(200);
}

/**
 * Human-paced GraphQL palette add: search "GraphQL" → pause → click block.
 * Preset add is only a fallback when the click does not place the node.
 */
async function addLesson18PaletteNode(
  ctx: DemoActionContext,
  type: string,
  nodeId: string,
  label: string,
  position: { x: number; y: number },
  paletteSelector: string,
): Promise<void> {
  await prepareLesson18GraphQLPaletteClick(ctx, paletteSelector);
  await ctx.click(paletteSelector);
  await ctx.delay(600);

  if (!isLesson18NodeOnCanvas(nodeId, type)) {
    addWorkflowNodeWithPreset(type, nodeId, label, position);
    await ctx.delay(400);
  }
  await clearLesson18PaletteSearch(ctx);
}

async function ensureLesson18WorkflowSelected(ctx: DemoActionContext): Promise<void> {
  if (isLesson18WorkflowActive()) return;
  await selectGqlMutationDemoWorkflow(ctx);
  await ctx.waitFor(WF.CANVAS, 8000);
  await ctx.delay(400);
}

/** Select the demo workflow from the sidebar. */
export async function selectGqlMutationDemoWorkflow(ctx: DemoActionContext): Promise<void> {
  const ok = await selectWorkflowFromAppSidebar(ctx, LESSON18_WF_NAME);
  if (ok) lesson18Session.created = true;
}

/** Create a blank workflow named GraphQL User CRUD Demo. */
export async function ensureLesson18WorkflowCreated(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);

  if (lesson18Session.created && getWorkflowByName(LESSON18_WF_NAME)) {
    await ensureLesson18WorkflowSelected(ctx);
    return;
  }

  if (getWorkflowByName(LESSON18_WF_NAME)) {
    await ensureLesson18WorkflowSelected(ctx);
    lesson18Session.created = true;
    return;
  }

  await expandWfDemoAppSidebar(ctx);
  await ctx.click(WF.SIDEBAR_NEW_BTN);
  await ctx.delay(400);
  await ctx.click(WF.NEW_BLANK_ITEM);
  await ctx.delay(400);
  await ctx.fill(WF.CREATE_INPUT, LESSON18_WF_NAME);
  await ctx.delay(200);
  await ctx.click(WF.CREATE_OK);
  await ctx.waitFor(WF.CANVAS, 8000);
  await ctx.delay(800);
  await collapseLesson18SidebarOnce(ctx);
  await clickWfFitView(ctx);
  lesson18Session.created = true;
}

/** @deprecated Use ensureLesson18WorkflowCreated — kept for tests/guards. */
export async function ensureLesson18WorkflowLoaded(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(WF.CANVAS)) {
    lesson18Session.created = true;
    return;
  }
  await ensureLesson18WorkflowCreated(ctx);
}

async function closeWfDefaultsModalIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WF.DEFAULTS_MODAL)) return;
  const cancel = document.querySelector<HTMLElement>(`${WF.DEFAULTS_MODAL} .btn-ghost`);
  cancel?.click();
  await ctx.delay(300);
}

function lesson18DefaultsModalHasKey(key: string): boolean {
  const rows = document.querySelectorAll(`${WF.DEFAULTS_MODAL} .wf-config-kv-row-vars:not(:last-child)`);
  for (const row of rows) {
    const keyInput = row.querySelector<HTMLInputElement>('.wf-var-key-input');
    if (keyInput?.value.trim() === key) return true;
  }
  return false;
}

async function upsertLesson18DefaultsVar(
  ctx: DemoActionContext,
  key: string,
  value: string,
): Promise<void> {
  if (lesson18DefaultsModalHasKey(key)) {
    const rows = document.querySelectorAll<HTMLElement>(
      `${WF.DEFAULTS_MODAL} .wf-config-kv-row-vars:not(:last-child)`,
    );
    for (const row of rows) {
      const keyInput = row.querySelector<HTMLInputElement>('.wf-var-key-input');
      if (keyInput?.value.trim() !== key) continue;
      const valInput = row.querySelector<HTMLInputElement>('.wf-var-value-input');
      keyInput.scrollIntoView?.({ block: 'nearest' });
      await holdWfSpotlight(ctx, WF.DEFAULTS_MODAL, 400);
      if (valInput && valInput.value !== value) {
        fillControlledInput(valInput, value);
        await ctx.delay(450);
      } else {
        await ctx.delay(400);
      }
      return;
    }
  }

  await holdWfSpotlight(ctx, WF.DEFAULTS_NEW_KEY, 500);
  await ctx.fill(WF.DEFAULTS_NEW_KEY, key);
  await ctx.delay(400);
  await holdWfSpotlight(ctx, WF.DEFAULTS_NEW_VAL, 500);
  await ctx.fill(WF.DEFAULTS_NEW_VAL, value);
  await ctx.delay(400);
  await ctx.click(WF.DEFAULTS_ADD_BTN);
  await ctx.delay(500);
}

/**
 * Open Workflow Variables and define testName / createdUserId / fetchedUser.
 * Visible tour for humans — quiet patch only if the UI save does not stick.
 */
export async function ensureLesson18WorkflowVariablesConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18WorkflowCreated(ctx);
  if (lesson18Session.variablesConfigured && isLesson18WorkflowVariablesConfigured()) {
    await closeWfDefaultsModalIfOpen(ctx);
    return;
  }

  await holdWfSpotlight(ctx, WF.VARIABLES_BTN, 700);
  await ctx.click(WF.VARIABLES_BTN);
  await ctx.waitFor(WF.DEFAULTS_MODAL, 5000);
  await ctx.delay(500);

  // Seed value used by createUser; empty placeholders filled later by Extraction/Output.
  await upsertLesson18DefaultsVar(ctx, LESSON18_TEST_NAME_VAR, LESSON18_TEST_NAME);
  await upsertLesson18DefaultsVar(ctx, LESSON18_CREATED_USER_ID_VAR, '');
  await upsertLesson18DefaultsVar(ctx, LESSON18_FETCHED_USER_VAR, '');

  await holdWfSpotlight(ctx, WF.DEFAULTS_SAVE_BTN, 700);
  await ctx.click(WF.DEFAULTS_SAVE_BTN);
  await ctx.delay(500);
  await closeWfDefaultsModalIfOpen(ctx);

  if (!isLesson18WorkflowVariablesConfigured()) {
    patchLesson18WorkflowVariablesQuiet();
  }
  lesson18Session.variablesConfigured = true;
}

/** Click GraphQL Mutation in the palette and wire Start → Create User. */
export async function ensureLesson18MutationNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18WorkflowVariablesConfigured(ctx);
  const startId = resolveLesson18StartNodeId();
  const createPresent = isLesson18NodeOnCanvas(LESSON18_NODE_CREATE, 'graphqlMutation');
  const startWired = Boolean(startId && lesson18EdgeExists(startId, LESSON18_NODE_CREATE));
  if (lesson18Session.mutationAdded && createPresent && startWired) {
    return;
  }

  if (!createPresent) {
    await addLesson18PaletteNode(
      ctx,
      'graphqlMutation',
      LESSON18_NODE_CREATE,
      'Create User',
      { x: 280, y: 150 },
      WF.PAL_GQL_MUTATION,
    );
  }

  connectLesson18Edge(
    startId ?? resolveLesson18StartNodeId(),
    LESSON18_NODE_CREATE,
    WF.NODE_START,
    WF.NODE_GQL_MUTATION,
    'out',
  );
  await ctx.delay(400);
  await clickWfFitView(ctx);
  lesson18Session.mutationAdded = true;
}

/** Configure createUser operation + variables (Extraction tab is a separate step). */
export async function ensureLesson18MutationConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18MutationNodeAdded(ctx);
  if (lesson18Session.mutationConfigured && isLesson18CreateMutationOpReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_CREATE });
  await waitForWfConfigPanel(ctx, GQL.WF_MUTATION_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Operation');
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await fillWfConfigField(ctx, GQL.WF_QUERY_EDITOR, LESSON18_CREATE_MUTATION);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Variables');
  await fillWfConfigField(ctx, GQL.WF_VARIABLES_EDITOR, LESSON18_MUTATION_VARS);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  lesson18Session.mutationConfigured = true;
}

/** Bind createUser.id → createdUserId via the Extraction tab. */
export async function ensureLesson18MutationOutputBound(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18MutationConfigured(ctx);
  if (lesson18Session.outputBound && isLesson18CreateNodeReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_CREATE });
  await waitForWfConfigPanel(ctx, GQL.WF_MUTATION_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Extraction');
  if (!document.querySelector(GQL.WF_EXTRACTION_JSONPATH)) {
    await clickWfConfigAddRow(ctx, GQL.WF_EXTRACTION_ADD_BTN, GQL.WF_EXTRACTION_JSONPATH);
  }
  await fillWfConfigField(ctx, GQL.WF_EXTRACTION_JSONPATH, LESSON18_EXTRACTION_JSONPATH);
  await fillWfConfigField(ctx, GQL.WF_EXTRACTION_VARNAME, LESSON18_CREATED_USER_ID_VAR);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  lesson18Session.outputBound = true;
}

/** Add Fetch User query node and wire Create → Query. */
export async function ensureLesson18QueryNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18MutationOutputBound(ctx);
  const fetchPresent = isLesson18NodeOnCanvas(LESSON18_NODE_FETCH, 'graphqlQuery');
  const createToFetchWired = lesson18EdgeExists(LESSON18_NODE_CREATE, LESSON18_NODE_FETCH);
  if (lesson18Session.queryAdded && fetchPresent && createToFetchWired) {
    return;
  }

  if (!fetchPresent) {
    await addLesson18PaletteNode(
      ctx,
      'graphqlQuery',
      LESSON18_NODE_FETCH,
      'Fetch User',
      { x: 480, y: 150 },
      WF.PAL_GQL_QUERY,
    );
  }
  connectLesson18Edge(
    LESSON18_NODE_CREATE,
    LESSON18_NODE_FETCH,
    WF.NODE_GQL_MUTATION,
    WF.NODE_GQL_QUERY,
  );
  await ctx.delay(400);
  await clickWfFitView(ctx);
  lesson18Session.queryAdded = true;
}

/** Configure read-back query operation + variables. */
export async function ensureLesson18QueryOperationConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18QueryNodeAdded(ctx);
  if (lesson18Session.queryOpConfigured && isLesson18FetchQueryOpReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_FETCH });
  await waitForWfConfigPanel(ctx, GQL.WF_QUERY_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Operation');
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await fillWfConfigField(ctx, GQL.WF_QUERY_EDITOR, LESSON18_GET_USER_QUERY);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Variables');
  await fillWfConfigField(ctx, GQL.WF_VARIABLES_EDITOR, LESSON18_QUERY_VARS);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  lesson18Session.queryOpConfigured = true;
}

/** Bind query response data → fetchedUser on the Output tab. */
export async function ensureLesson18QueryOutputBound(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18QueryOperationConfigured(ctx);
  if (lesson18Session.queryOutputBound && isLesson18FetchNodeReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_FETCH });
  await waitForWfConfigPanel(ctx, GQL.WF_QUERY_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Output');
  if (!document.querySelector(GQL.WF_OUTPUT_FIELD_SELECT)) {
    await clickWfConfigAddRow(ctx, GQL.WF_OUTPUT_ADD_BTN, GQL.WF_OUTPUT_FIELD_SELECT);
  }
  await selectWfConfigOption(ctx, GQL.WF_OUTPUT_FIELD_SELECT, 'data');
  await fillWfConfigField(ctx, GQL.WF_OUTPUT_VARNAME, LESSON18_FETCHED_USER_VAR);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  lesson18Session.queryOutputBound = true;
}

/** Full query node configure (operation + output) — used by quick-test guards. */
export async function ensureLesson18QueryConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18QueryOutputBound(ctx);
}

/** Add Verify User assert node; wire Query → Assert → End. */
export async function ensureLesson18AssertNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18QueryOutputBound(ctx);
  const assertPresent = isLesson18NodeOnCanvas(LESSON18_NODE_ASSERT, 'graphqlAssert');
  const endId = resolveLesson18EndNodeId();
  const fetchToAssertWired = lesson18EdgeExists(LESSON18_NODE_FETCH, LESSON18_NODE_ASSERT);
  const assertToEndWired = Boolean(endId && lesson18EdgeExists(LESSON18_NODE_ASSERT, endId));
  if (lesson18Session.assertAdded && assertPresent && fetchToAssertWired && (!endId || assertToEndWired)) {
    return;
  }

  if (!assertPresent) {
    await addLesson18PaletteNode(
      ctx,
      'graphqlAssert',
      LESSON18_NODE_ASSERT,
      'Verify User',
      { x: 680, y: 150 },
      WF.PAL_GQL_ASSERT,
    );
  }
  connectLesson18Edge(
    LESSON18_NODE_FETCH,
    LESSON18_NODE_ASSERT,
    WF.NODE_GQL_QUERY,
    WF.NODE_GQL_ASSERT,
  );
  if (endId) {
    connectLesson18Edge(
      LESSON18_NODE_ASSERT,
      endId,
      WF.NODE_GQL_ASSERT,
      WF.NODE_END,
    );
  } else {
    connectWfNodesBySelector(WF.NODE_GQL_ASSERT, WF.NODE_END);
  }
  await ctx.delay(400);
  await clickWfFitView(ctx);
  lesson18Session.assertAdded = true;
}

/** Set assert source variable to fetchedUser. */
export async function ensureLesson18AssertSourceConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertNodeAdded(ctx);
  if (lesson18Session.assertSourceConfigured && isLesson18AssertSourceReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_ASSERT });
  await waitForWfConfigPanel(ctx, GQL.WF_ASSERT_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Source');
  await fillWfConfigField(ctx, WF.WF_GQL_ASSERT_SOURCE, LESSON18_FETCHED_USER_VAR);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  lesson18Session.assertSourceConfigured = true;
}

/** Add equals assertion on $.user.name. */
export async function ensureLesson18AssertRuleConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertSourceConfigured(ctx);
  if (lesson18Session.assertRuleConfigured && isLesson18AssertNodeReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_ASSERT });
  await waitForWfConfigPanel(ctx, GQL.WF_ASSERT_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Assertions');
  if (!document.querySelector(GQL.WF_ASSERT_ROW)) {
    await clickWfConfigAddRow(ctx, GQL.WF_ASSERT_ADD_BTN, GQL.WF_ASSERT_JSONPATH);
  }
  await fillWfConfigField(ctx, GQL.WF_ASSERT_JSONPATH, '$.user.name');
  await selectWfConfigOption(ctx, GQL.WF_ASSERT_OPERATOR, 'equals');
  await pauseWfConfigSection(ctx);
  await fillWfConfigField(ctx, GQL.WF_ASSERT_EXPECTED, `{{${LESSON18_TEST_NAME_VAR}}}`);
  await fillWfConfigField(ctx, GQL.WF_ASSERT_DESCRIPTION, 'Fetched user name matches testName');
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  lesson18Session.assertRuleConfigured = true;
}

/** Configure assert source + rule (quick-test guard). */
export async function ensureLesson18AssertConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertRuleConfigured(ctx);
}

async function runLesson18QuickTest(
  ctx: DemoActionContext,
  opts?: { requirePass?: boolean },
): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  patchLesson18WorkflowVariablesQuiet();
  await openWfConsoleIfClosed(ctx);
  await clickWfFitView(ctx);
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(300);
  await ctx.click(WF.QUICK_TEST_BTN);
  if (opts?.requirePass) {
    await ctx.waitFor('.wf-exec-strip-pass', 60000);
  } else {
    await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
  }
  await ctx.delay(800);
}

/** Run Quick Test on the create → fetch → assert chain. */
export async function ensureLesson18QuickTestRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertConfigured(ctx);
  if (
    lesson18Session.quickTestRun
    && isLesson18QuickTestPassVisible()
    && isLesson18FetchNodeReady()
    && isLesson18AssertNodeReady()
  ) {
    return;
  }

  await runLesson18QuickTest(ctx);
  lesson18Session.quickTestRun = true;
}

/** Add Delete User node from palette and rewire Assert → Delete → End (quiet guard). */
export async function ensureLesson18DeleteNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertRuleConfigured(ctx);

  if (lesson18Session.deleteAdded && isLesson18DeleteOnCanvas()) {
    return;
  }

  await prepareLesson18CanvasForBuilding(ctx);

  if (!isLesson18DeleteOnCanvas()) {
    if (!addWorkflowNodeWithPreset('graphqlMutation', LESSON18_NODE_DELETE, 'Delete User', { x: 780, y: 280 })) {
      await revealPaletteBlock(ctx, WF.PAL_GQL_MUTATION, { quiet: true });
      await ctx.click(WF.PAL_GQL_MUTATION);
      await ctx.delay(600);
    }
  }

  wireLesson18DeleteNode();
  await ctx.delay(400);
  await clickWfFitView(ctx);
  lesson18Session.deleteAdded = true;
}

/** Visible demo: click GraphQL Mutation palette to add Delete User and rewire the chain. */
export async function demonstrateLesson18DeleteNodeAdded(ctx: DemoActionContext): Promise<void> {
  await prepareLesson18CanvasForBuilding(ctx);

  if (lesson18Session.deleteAdded && isLesson18DeleteOnCanvas()) {
    await clickWfFitView(ctx);
    return;
  }

  await prepareLesson18GraphQLPaletteClick(ctx, WF.PAL_GQL_MUTATION);
  await ctx.click(WF.PAL_GQL_MUTATION);
  try {
    await ctx.waitFor(LESSON18_DELETE_NODE_SELECTOR, 5000);
  } catch {
    // Palette click may not create a selectable node in stubbed tests.
  }
  await ctx.delay(600);

  if (!isLesson18DeleteOnCanvas()) {
    addWorkflowNodeWithPreset('graphqlMutation', LESSON18_NODE_DELETE, 'Delete User', { x: 780, y: 280 });
    await ctx.delay(400);
  }

  await clearLesson18PaletteSearch(ctx);
  wireLesson18DeleteNode();
  await ctx.delay(400);
  await clickWfFitView(ctx);
  lesson18Session.deleteAdded = true;
}

/** Configure deleteUser teardown mutation (quiet guard). */
export async function ensureLesson18DeleteConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18DeleteNodeAdded(ctx);
  if (lesson18Session.deleteConfigured && isLesson18DeleteNodeReady()) return;

  await configureLesson18DeleteNode(ctx);
  lesson18Session.deleteConfigured = true;
}

/** Visible demo: open Delete User config and fill deleteUser operation + variables. */
export async function demonstrateLesson18DeleteConfigured(ctx: DemoActionContext): Promise<void> {
  if (lesson18Session.deleteConfigured && isLesson18DeleteNodeReady()) return;

  await configureLesson18DeleteNode(ctx);
  lesson18Session.deleteConfigured = true;
}

async function configureLesson18DeleteNode(ctx: DemoActionContext): Promise<void> {
  const deleteNodeId = resolveLesson18DeleteNodeId();
  await openWfNodeConfigModal(ctx, { nodeId: deleteNodeId });
  await waitForWfConfigPanel(ctx, GQL.WF_MUTATION_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Operation');
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await fillWfConfigField(ctx, GQL.WF_QUERY_EDITOR, LESSON18_DELETE_MUTATION);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Variables');
  await fillWfConfigField(ctx, GQL.WF_VARIABLES_EDITOR, LESSON18_DELETE_VARS);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  await clickWfFitView(ctx);
}

/** Re-run Quick Test with teardown node — all four action nodes should pass. */
export async function ensureLesson18FinalQuickTestRun(ctx: DemoActionContext): Promise<void> {
  if (!isLesson18DeleteNodeReady()) {
    await ensureLesson18DeleteConfigured(ctx);
  }
  if (lesson18Session.finalQuickTestRun && isLesson18QuickTestPassVisible() && isLesson18DeleteNodeReady()) {
    return;
  }

  await dismissWorkflowExecSummary(ctx);
  await runLesson18QuickTest(ctx, { requirePass: true });
  lesson18Session.finalQuickTestRun = true;
}

export { dismissWorkflowOnboarding };
