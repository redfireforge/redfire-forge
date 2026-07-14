/** GRPC-21 Environments & Collections — lesson steps */
import { GRPC, emAddProtocolItemSel } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { EM } from '@shared/selectors/em';
import {
  GRPC_DEMO_TARGET,
  ensureEchoMethodSelected,
  ensureGrpcReflected,
  ensureEchoMessageFilled,
  setGrpcTargetQuiet,
  spotlightAndPause,
} from './grpc-lesson-helpers';
import {
  ensureGrpcDemoEndpointConfigured,
  navigateToGrpcStudio,
  navigateToEnvironmentManager,
  expandNamedMicroservice,
  ensureGrpcDemoHeaderContext,
  ensureProtocolDisabled,
  selectEnvInHeader,
  selectSvcInHeader,
  GRPC_DEMO_ENV_NAME,
  GRPC_DEMO_SVC_NAME,
} from '../env-manager-lesson-helpers';
import type { GrpcDemoLesson } from './grpc-lesson-contract';
import {
  purgeEmptyGrpcDemoCollectionsByName,
  purgeGrpcDemoSavedRequests,
} from '../../adapters';
import {
  DEMO_COLLECTION_NAME,
  DEMO_MESSAGE,
  DEMO_REQUEST_ID,
  DEMO_REQUEST_NAME,
  DEMO_USER_ID,
  UNKNOWN_VAR_TARGET,
  ensureMetadataRowNoEnvNav,
  ensureStudioNavQuiet,
  ensureTemplateTargetNoEnvNav,
  markCustomVarsSeeded,
} from './grpc-env-collections-helpers';

export const grpcEnvCollectionsSteps: GrpcDemoLesson['steps'] =
[

  // =========================================================================
  // Step 1 — Configure endpoint, protocol vars & see env switching in action
  // (merges old steps 1 + 3 — both are about "env config drives {{grpcHost}}")
  // =========================================================================
  {
    id: 'grpc21-intro-env',
    title: 'Add gRPC Protocol, Configure Endpoint & Protocol Vars',
    description:
      'In **Settings → Environments**, expand **grpc-demo** — it starts with **no protocol tabs**. ' +
      'Click **+ Add protocol** and choose **gRPC**. Set the gRPC address for each environment — this becomes ' +
      '`{{grpcHost}}`. Click **Protocol vars** to add global variables like `requestId` and `userId` that ' +
      'apply to every environment for this microservice.',
    pauseAfter: true,
    preAction: async (ctx) => {
      // Fast path for lesson start: setup already lands on EM with grpc-demo expanded
      // and gRPC disabled, so skip extra movement if that state is already true.
      const managerVisible = !!document.querySelector(EM.MANAGER);
      const grpcSvcCard = document.querySelector<HTMLElement>(`[data-svc-name="${GRPC_DEMO_SVC_NAME}"]`);
      const panel = document.querySelector<HTMLElement>(EM.PROTOCOL_PANEL);
      const grpcTabPresent = !!document.querySelector(EM.PROTOCOL_TAB_GRPC);
      if (managerVisible && grpcSvcCard && panel && grpcSvcCard.contains(panel) && !grpcTabPresent) {
        return;
      }
      // Recovery path for restart/rapid-next/direct-step entry.
      await navigateToEnvironmentManager(ctx);
      await expandNamedMicroservice(ctx, GRPC_DEMO_SVC_NAME);
      await ensureProtocolDisabled(ctx, 'grpc');
    },
    action: async (ctx) => {
      // 1. Add gRPC protocol via the + Add protocol button.
      await spotlightAndPause(ctx, EM.ADD_PROTOCOL_BTN, 800);
      await ctx.click(EM.ADD_PROTOCOL_BTN);
      await ctx.delay(500);
      await spotlightAndPause(ctx, emAddProtocolItemSel('grpc'), 800);
      await ctx.click(emAddProtocolItemSel('grpc'));
      try { await ctx.waitFor(EM.PROTOCOL_TAB_GRPC, 2_000); } catch { /* ok */ }
      await ctx.delay(600);

      // 2. Show endpoint row for gRPC Demo environment.
      await ensureGrpcDemoEndpointConfigured(ctx);
      await ctx.delay(400);
      await selectEnvInHeader(ctx, GRPC_DEMO_ENV_NAME);
      await selectSvcInHeader(ctx, GRPC_DEMO_SVC_NAME);
      await spotlightAndPause(ctx, EM.PROTOCOL_TAB_GRPC, 800);
      const derivedPanel = document.querySelector<HTMLElement>(EM.DERIVED_VARS_GRPC);
      if (derivedPanel) {
        derivedPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        await ctx.delay(400);
        await spotlightAndPause(ctx, EM.DERIVED_VARS_GRPC, 1_000);
      }

      // 3. Open Protocol vars modal, add requestId + userId, save.
      await spotlightAndPause(ctx, '[data-testid="protocol-vars-badge"]', 800);
      await ctx.click('[data-testid="protocol-vars-badge"]');
      try { await ctx.waitFor('[data-testid="protocol-vars-modal"]', 1_500); } catch { /* ok */ }
      await spotlightAndPause(ctx, '[data-testid="protocol-vars-modal"]', 600);
      const ensureVarInModal = async (key: string, value: string) => {
        const rowSel = `[data-testid="protocol-var-row-${key}"]`;
        if (document.querySelector(rowSel)) {
          const valueSel = `[data-testid="protocol-var-value-${key}"]`;
          const valueInput = document.querySelector<HTMLInputElement>(valueSel);
          if (valueInput && valueInput.value !== value) {
            await ctx.fill(valueSel, value);
            await ctx.delay(300);
          } else {
            await ctx.delay(200);
          }
          return;
        }
        await ctx.fill('[data-testid="protocol-vars-key-input"]', key);
        await ctx.delay(300);
        await ctx.fill('[data-testid="protocol-vars-val-input"]', value);
        await ctx.delay(400);
        await ctx.click('[data-testid="protocol-vars-add-btn"]');
        await ctx.delay(500);
      };
      await ensureVarInModal('requestId', DEMO_REQUEST_ID);
      await ensureVarInModal('userId', DEMO_USER_ID);
      if (document.querySelector('[data-testid="protocol-var-row-userId"]')) {
        await spotlightAndPause(ctx, '[data-testid="protocol-vars-modal"]', 800);
      }
      await ctx.click('[data-testid="protocol-vars-save-btn"]');
      await ctx.delay(400);
      markCustomVarsSeeded();
    },
  },

  // =========================================================================
  // Step 2 — {{grpcHost}} in the target field
  // =========================================================================
  {
    id: 'grpc21-grpchost-target',
    title: '{{grpcHost}} in the Target Field',
    description:
      'Instead of hardcoding `localhost:50051`, type `{{grpcHost}}` in the target field. RedfireForge ' +
      'resolves the template at runtime from your **microservice gRPC endpoint** for the selected environment. ' +
      'The **Interpolation Preview Strip** immediately below the target input lets you toggle between ' +
      'the raw **Template** and the fully **Resolved** address for the selected environment.',

    pauseAfter: true,
    preAction: async (ctx) => {
      // Endpoint was configured in step 1 — only re-configure if the header
      // context is missing (i.e. lesson started directly at step 2).
      await ensureGrpcDemoHeaderContext(ctx);
      await ensureStudioNavQuiet(ctx);
      // Restore direct address so the typing demo is visible.
      await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
      await ensureGrpcReflected(ctx);
      await ensureEchoMethodSelected(ctx);
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 400);
      await ctx.fill(GRPC.TARGET_INPUT, '{{grpcHost}}');
      await ctx.delay(300);
      try { await ctx.waitFor(GRPC.INTERPOLATION_PREVIEW_STRIP, 1_500); } catch { /* ok */ }
      await ctx.delay(300);
      // Click Template toggle, then Resolved.
      const templateBtn = document.querySelector<HTMLButtonElement>(GRPC.INTERPOLATION_PREVIEW_TEMPLATE);
      if (templateBtn) {
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_TEMPLATE, 300);
        templateBtn.click();
        await ctx.delay(300);
      }
      const resolvedBtn = document.querySelector<HTMLButtonElement>(GRPC.INTERPOLATION_PREVIEW_RESOLVED);
      if (resolvedBtn) {
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_RESOLVED, 300);
        resolvedBtn.click();
        await ctx.delay(300);
      }
      await ctx.delay(400);
    },
    verify: GRPC.INTERPOLATION_PREVIEW_STRIP,
  },

  // =========================================================================
  // Step 3 — Template variable in Metadata
  // =========================================================================
  {
    id: 'grpc21-metadata-var',
    title: 'Template Variable in Metadata',
    description:
      'Variables work in **all fields**: target, metadata, body, and auth. Open the **Metadata** tab ' +
      'and add `x-request-id: {{requestId}}`. The template is stored as-is and resolved to `' + DEMO_REQUEST_ID + '` ' +
      'at send time — making it easy to vary trace IDs or tenant keys across environments without editing each saved request.',
    highlight: GRPC.REQUEST_TAB_METADATA,
    pauseAfter: true,
    preAction: async (ctx) => {
      await ensureTemplateTargetNoEnvNav(ctx);
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, GRPC.REQUEST_TAB_METADATA, 400);
      await ctx.click(GRPC.REQUEST_TAB_METADATA);
      try { await ctx.waitFor(GRPC.METADATA_EDITOR, 1_500); } catch { /* ok */ }
      await spotlightAndPause(ctx, GRPC.METADATA_EDITOR, 500);

      const addBtn = document.querySelector<HTMLButtonElement>(GRPC.METADATA_ADD_BTN);
      if (addBtn) {
        await ctx.click(GRPC.METADATA_ADD_BTN);
        await ctx.delay(300);
      }
      const keyInput = document.querySelector<HTMLInputElement>('[aria-label="Metadata key 1"]');
      const valInput = document.querySelector<HTMLInputElement>('[aria-label="Metadata value 1"]');
      if (keyInput) await ctx.fill('[aria-label="Metadata key 1"]', 'x-request-id');
      if (valInput) await ctx.fill('[aria-label="Metadata value 1"]', '{{requestId}}');
      await ctx.delay(300);
      await spotlightAndPause(ctx, GRPC.METADATA_EDITOR, 500);
    },
    verify: GRPC.METADATA_EDITOR,
  },

  // =========================================================================
  // Step 4 — Template variable in the request body
  // =========================================================================
  {
    id: 'grpc21-body-var',
    title: 'Template Variable in the Request Body',
    description:
      'In the **Form Input** tab, add `"userId": "{{userId}}"` alongside your `message`. ' +
      'The placeholder resolves to `' + DEMO_USER_ID + '` when the call is sent.',
    highlight: GRPC.REQUEST_TAB_FORM,
    pauseAfter: true,
    preAction: async (ctx) => {
      await ensureMetadataRowNoEnvNav(ctx);
      const formTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
      if (formTab && formTab.getAttribute('aria-pressed') !== 'true') {
        formTab.click();
        await ctx.delay(200);
      }
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, GRPC.REQUEST_TAB_FORM, 400);
      await ctx.click(GRPC.REQUEST_TAB_FORM);
      try { await ctx.waitFor(GRPC.REQUEST_JSON, 1_500); } catch { /* ok */ }
      await spotlightAndPause(ctx, GRPC.REQUEST_JSON, 400);
      const body = JSON.stringify({ message: DEMO_MESSAGE, userId: '{{userId}}' }, null, 2);
      await ctx.fill(GRPC.REQUEST_JSON, body);
      await ctx.delay(300);
      await spotlightAndPause(ctx, GRPC.REQUEST_JSON, 600);
    },
    verify: GRPC.REQUEST_JSON,
  },

  // =========================================================================
  // Step 5 — Interpolation error banner
  // =========================================================================
  {
    id: 'grpc21-interp-error',
    title: 'Interpolation Error: Unresolved Token',
    description:
      'If a variable in the **target** field cannot be resolved, gRPC Studio shows an orange ' +
      '**Interpolation Error** banner naming the exact unresolved token and blocking the call. ' +
      'This prevents silent failures where calls reach the wrong host.',
    pauseAfter: true,
    preAction: async (ctx) => {
      // Start from a clean working target so the action can visibly type the bad variable.
      await ensureStudioNavQuiet(ctx);
      await ensureGrpcDemoHeaderContext(ctx);
      await setGrpcTargetQuiet(ctx, '{{grpcHost}}');
      try { await ctx.waitFor(GRPC.INTERPOLATION_PREVIEW_STRIP, 1_000); } catch { /* ok */ }
    },
    action: async (ctx) => {
      // 1. Spotlight the target input and keep the ring ON while typing the bad token.
      const inputEl = document.querySelector<HTMLElement>(GRPC.TARGET_INPUT);
      if (inputEl) {
        const removeRing = showSpotlightRing(inputEl);
        await ctx.delay(600); // viewer sees the ring before typing starts
        await ctx.fill(GRPC.TARGET_INPUT, UNKNOWN_VAR_TARGET);
        await ctx.delay(600); // viewer sees what was typed with ring still on
        removeRing();
      }
      // 2. Wait for and spotlight the error banner.
      try { await ctx.waitFor(GRPC.INTERPOLATION_ERROR_BANNER, 2_000); } catch { await ctx.delay(400); }
      await spotlightAndPause(ctx, GRPC.INTERPOLATION_ERROR_BANNER, 1_500);
      if (document.querySelector(GRPC.INTERPOLATION_ERROR_TOKEN_PATH)) {
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_ERROR_TOKEN_PATH, 800);
      }
      // 3. Fix — spotlight the target input and keep the ring ON while typing the fix.
      const inputEl2 = document.querySelector<HTMLElement>(GRPC.TARGET_INPUT);
      if (inputEl2) {
        const removeRing2 = showSpotlightRing(inputEl2);
        await ctx.delay(600); // viewer sees the ring before typing starts
        await ctx.fill(GRPC.TARGET_INPUT, '{{grpcHost}}');
        await ctx.delay(600); // viewer sees the corrected value with ring still on
        removeRing2();
      }
      try { await ctx.waitFor(GRPC.INTERPOLATION_PREVIEW_STRIP, 2_000); } catch { /* ok */ }
      const templateBtn = document.querySelector<HTMLButtonElement>(GRPC.INTERPOLATION_PREVIEW_TEMPLATE);
      if (templateBtn) {
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_TEMPLATE, 500);
        templateBtn.click();
        await ctx.delay(300);
      }
      const resolvedBtn = document.querySelector<HTMLButtonElement>(GRPC.INTERPOLATION_PREVIEW_RESOLVED);
      if (resolvedBtn) {
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_RESOLVED, 500);
        resolvedBtn.click();
        await ctx.delay(400);
      }
    },
    verify: GRPC.INTERPOLATION_PREVIEW_STRIP,
  },

  // =========================================================================
  // Step 6 — Execute and save request to a collection
  // =========================================================================
  {
    id: 'grpc21-save-request',
    title: 'Save a Call to a Collection',
    description:
      'With the local Docker fixture on `localhost:50051`, click **Send** to execute an Echo call. ' +
      'Once you have a response, click **Save request** and name it `' + DEMO_REQUEST_NAME + '` inside ' +
      'a new collection called `' + DEMO_COLLECTION_NAME + '`. The entire call snapshot is persisted in IndexedDB.',
    pauseAfter: true,
    preAction: async (ctx) => {
      await ensureStudioNavQuiet(ctx);
      await ensureGrpcDemoHeaderContext(ctx);
      // Ensure this lesson always demonstrates saving exactly one request
      // without visual panel hopping during preAction.
      await purgeGrpcDemoSavedRequests();
      await purgeEmptyGrpcDemoCollectionsByName([DEMO_COLLECTION_NAME, 'Saved Requests']);
      await ensureStudioNavQuiet(ctx);
      await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
      await ensureEchoMessageFilled(ctx, DEMO_MESSAGE);
      const formTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
      if (formTab && formTab.getAttribute('aria-pressed') !== 'true') {
        formTab.click();
        await ctx.delay(200);
      }
    },
    action: async (ctx) => {
      // Transition beat: show what will be executed and saved.
      await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 900);
      await spotlightAndPause(ctx, GRPC.REQUEST_JSON, 900);
      await spotlightAndPause(ctx, GRPC.REQUEST_TAB_METADATA, 900);

      // Send the call.
      await spotlightAndPause(ctx, GRPC.SEND_BTN, 1_250);
      const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
      if (sendBtn && !sendBtn.disabled) {
        await ctx.click(GRPC.SEND_BTN);
      }
      try { await ctx.waitFor(GRPC.RESPONSE_STATUS, 6_000); } catch { await ctx.delay(1_100); }
      await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 1_100);
      await spotlightAndPause(ctx, GRPC.RESPONSE_PANEL, 1_700);

      // Save the request.
      await spotlightAndPause(ctx, GRPC.SAVE_REQUEST_BTN, 1_150);
      await ctx.click(GRPC.SAVE_REQUEST_BTN);
      try { await ctx.waitFor(GRPC.SAVE_REQUEST_MODAL, 2_500); } catch { /* ok */ }
      await spotlightAndPause(ctx, GRPC.SAVE_REQUEST_MODAL, 1_350);
      await spotlightAndPause(ctx, GRPC.SAVE_REQUEST_NAME, 900);
      await ctx.fill(GRPC.SAVE_REQUEST_NAME, DEMO_REQUEST_NAME);
      await ctx.delay(900);
      const newCollInput = document.querySelector<HTMLInputElement>(GRPC.SAVE_REQUEST_NEW_COLLECTION);
      if (newCollInput) {
        await spotlightAndPause(ctx, GRPC.SAVE_REQUEST_NEW_COLLECTION, 900);
        await ctx.fill(GRPC.SAVE_REQUEST_NEW_COLLECTION, DEMO_COLLECTION_NAME);
        await ctx.delay(1_000);
      }
      await spotlightAndPause(ctx, GRPC.SAVE_REQUEST_SUBMIT, 1_150);
      await ctx.click(GRPC.SAVE_REQUEST_SUBMIT);
      const t0 = Date.now();
      while (Date.now() - t0 < 3_000) {
        if (!document.querySelector(GRPC.SAVE_REQUEST_MODAL)) break;
        await ctx.delay(100);
      }
      await ctx.delay(1_150);

      // Show result in Collections tree.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_COLLECTIONS, 900);
      await ctx.click(GRPC.SUB_NAV_COLLECTIONS);
      try { await ctx.waitFor(GRPC.COLLECTIONS_TREE, 2_500); } catch { /* ok */ }
      await spotlightAndPause(ctx, GRPC.COLLECTIONS_TREE, 1_200);
      try { await ctx.waitFor('[data-testid^="grpc-collection-group-"]', 2_000); } catch { /* ok */ }
      const savedRowSelector = '[data-testid^="grpc-collection-saved-"]';
      for (let i = 0; i < 8; i++) {
        const savedItem = document.querySelector<HTMLElement>(savedRowSelector);
        if (savedItem) {
          await spotlightAndPause(ctx, savedRowSelector, 1_000);
          break;
        }
        const groupToggle = document.querySelector<HTMLButtonElement>('.grpc-collection-group__header');
        if (groupToggle && groupToggle.getAttribute('aria-expanded') !== 'true') {
          await spotlightAndPause(ctx, '.grpc-collection-group__header', 800);
          groupToggle.click();
          await ctx.delay(500);
          continue;
        }
        await ctx.delay(250);
      }
    },
    verify: '[data-testid^="grpc-collection-saved-"]',
  },

  // =========================================================================
  // Step 7 — Collections tree: browse saved request
  // =========================================================================
  {
    id: 'grpc21-collections-tree',
    title: 'Collections Tree: Browse, Search & Rename',
    description:
      'The **Collections** sub-nav shows your saved call tree. Expand **`' + DEMO_COLLECTION_NAME + '`** to ' +
      'find your saved request. The **✎** icon lets you rename the collection. Use the search bar to filter ' +
      'across all collections. Collections are stored in IndexedDB and survive browser restarts.',
    highlight: GRPC.COLLECTIONS_PANEL,
    pauseAfter: true,
    preAction: async (ctx) => {
      // Avoid bouncing to Studio first; start Step 7 directly on Collections.
      await navigateToGrpcStudio(ctx);
      const collBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_COLLECTIONS);
      if (collBtn && collBtn.getAttribute('aria-selected') !== 'true') {
        collBtn.click();
        await ctx.delay(200);
      }
      try { await ctx.waitFor(GRPC.COLLECTIONS_TREE, 1_500); } catch { /* ok */ }
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, GRPC.COLLECTIONS_PANEL, 800);
      if (document.querySelector(GRPC.COLLECTIONS_SEARCH)) {
        await spotlightAndPause(ctx, GRPC.COLLECTIONS_SEARCH, 700);
      }

      // Expand collection group.
      const groupHeader = document.querySelector<HTMLButtonElement>(
        '[data-testid^="grpc-collection-group-"]',
      );
      if (groupHeader) {
        await spotlightAndPause(ctx, '[data-testid^="grpc-collection-group-"]', 800);
        const toggle = groupHeader.querySelector<HTMLButtonElement>('.grpc-collection-group__header');
        if (toggle && toggle.getAttribute('aria-expanded') !== 'true') {
          await spotlightAndPause(ctx, '.grpc-collection-group__header', 700);
          toggle.click();
          await ctx.delay(500);
        }
      }

      const savedItem = document.querySelector<HTMLElement>('[data-testid^="grpc-collection-saved-"]');
      if (savedItem) {
        await spotlightAndPause(ctx, '[data-testid^="grpc-collection-saved-"]', 1_000);
      }
      const renameBtn = document.querySelector<HTMLElement>(
        '[data-testid^="grpc-collection-group-rename-"]',
      );
      if (renameBtn) {
        await spotlightAndPause(ctx, '[data-testid^="grpc-collection-group-rename-"]', 1_200);
        await ctx.click('[data-testid^="grpc-collection-group-rename-"]');
        try { await ctx.waitFor(GRPC.COLLECTION_RENAME_MODAL, 1_500); } catch { /* ok */ }
        if (document.querySelector(GRPC.COLLECTION_RENAME_MODAL)) {
          await spotlightAndPause(ctx, GRPC.COLLECTION_RENAME_MODAL, 1_200);
          await spotlightAndPause(ctx, GRPC.COLLECTION_RENAME_CANCEL, 900);
          await ctx.click(GRPC.COLLECTION_RENAME_CANCEL);
          await ctx.delay(700);
        }
      }

      // Keep Saved Requests expanded at the end of the step so entries stay visible.
      const finalToggle = document.querySelector<HTMLButtonElement>('.grpc-collection-group__header');
      if (finalToggle && finalToggle.getAttribute('aria-expanded') !== 'true') {
        await spotlightAndPause(ctx, '.grpc-collection-group__header', 800);
        finalToggle.click();
        await ctx.delay(600);
      }
      const finalSavedItem = document.querySelector<HTMLElement>('[data-testid^="grpc-collection-saved-"]');
      if (finalSavedItem) {
        await spotlightAndPause(ctx, '[data-testid^="grpc-collection-saved-"]', 1_100);
      }
    },
    verify: '[data-testid^="grpc-collection-saved-"]',
  },

  // =========================================================================
  // Step 8 — Open saved request in Studio
  // =========================================================================
  {
    id: 'grpc21-open-in-studio',
    title: 'Open a Saved Request in Studio',
    description:
      'Click a saved request to open its detail pane, then click **Open in Studio** — gRPC Studio loads ' +
      'all saved settings into the active tab. The original saved copy is unchanged; edits in the Studio ' +
      'tab do not affect the collection.',
    highlight: GRPC.SAVED_REQUEST_OPEN_STUDIO,
    pauseAfter: true,
    preAction: async (ctx) => {
      // Avoid Studio-subnav bounce before switching to Collections for this step.
      await navigateToGrpcStudio(ctx);
      const collBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_COLLECTIONS);
      if (collBtn && collBtn.getAttribute('aria-selected') !== 'true') {
        collBtn.click();
        await ctx.delay(200);
      }
      try { await ctx.waitFor(GRPC.COLLECTIONS_TREE, 1_500); } catch { /* ok */ }
      const groupToggle = document.querySelector<HTMLButtonElement>('.grpc-collection-group__header');
      if (groupToggle && groupToggle.getAttribute('aria-expanded') !== 'true') {
        groupToggle.click();
        await ctx.delay(200);
      }
      const savedItem = document.querySelector<HTMLElement>('[data-testid^="grpc-collection-saved-"]');
      if (savedItem) { savedItem.click(); await ctx.delay(200); }
    },
    action: async (ctx) => {
      const savedItem = document.querySelector<HTMLElement>('[data-testid^="grpc-collection-saved-"]');
      if (savedItem) {
        await spotlightAndPause(ctx, '[data-testid^="grpc-collection-saved-"]', 400);
        await ctx.click('[data-testid^="grpc-collection-saved-"]');
      }
      try { await ctx.waitFor(GRPC.SAVED_REQUEST_DETAIL, 1_500); } catch { /* ok */ }
      await spotlightAndPause(ctx, GRPC.SAVED_REQUEST_DETAIL, 500);
      await spotlightAndPause(ctx, GRPC.SAVED_REQUEST_OPEN_STUDIO, 400);
      await ctx.click(GRPC.SAVED_REQUEST_OPEN_STUDIO);
      try { await ctx.waitFor(GRPC.SEND_BTN, 2_000); } catch { /* ok */ }
      await ctx.delay(500);
      await spotlightAndPause(ctx, GRPC.SEND_BTN, 1_200);
      await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 500);
    },
    verify: GRPC.SEND_BTN,
  },

  // =========================================================================
  // Step 9 — History replay
  // =========================================================================
  {
    id: 'grpc21-history-replay',
    title: 'Replay a Call from History',
    description:
      'Every gRPC call is automatically logged in **History** — method, target, metadata, body, response, ' +
      'and duration. Browse the log, select an entry, and click **Replay** to load it into the active Studio ' +
      'tab. Note: secret auth values are **not** persisted — re-enter auth before sending to a secured endpoint.',
    highlight: GRPC.SUB_NAV_HISTORY,
    pauseAfter: true,
    preAction: async (ctx) => {
      await ensureStudioNavQuiet(ctx);
      await ensureGrpcDemoHeaderContext(ctx);
      // Use direct address so the send button is not blocked by an unresolved token.
      await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
      await ensureEchoMessageFilled(ctx, DEMO_MESSAGE);
      // Only re-execute if the response body doesn't already show the expected message.
      const responseBody = document.querySelector<HTMLElement>(GRPC.RESPONSE_BODY);
      if (!responseBody?.textContent?.includes(DEMO_MESSAGE)) {
        const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
        if (sendBtn && !sendBtn.disabled) {
          await ctx.click(GRPC.SEND_BTN);
          try { await ctx.waitFor(GRPC.RESPONSE_BODY, 6_000); } catch { /* ok */ }
        }
      }
      // Keep preAction on Studio so the visible action can clearly demonstrate
      // opening Call History from the tab strip.
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, GRPC.SUB_NAV_HISTORY, 1_200);
      const historyTab = document.querySelector<HTMLButtonElement>(GRPC.SUB_NAV_HISTORY);
      if (historyTab?.getAttribute('aria-selected') !== 'true') {
        await ctx.click(GRPC.SUB_NAV_HISTORY);
        await ctx.delay(450);
      }
      try { await ctx.waitFor(GRPC.HISTORY_PANEL, 2_500); } catch { /* ok */ }
      await spotlightAndPause(ctx, GRPC.HISTORY_PANEL, 1_200);

      try { await ctx.waitFor(GRPC.HISTORY_ENTRY_ROW, 3_000); } catch { /* ok */ }
      await spotlightAndPause(ctx, GRPC.HISTORY_ENTRY_ROW, 1_150);
      await ctx.click(GRPC.HISTORY_ENTRY_ROW);
      await ctx.delay(450);
      try { await ctx.waitFor(GRPC.HISTORY_DETAIL, 2_000); } catch { /* ok */ }
      await spotlightAndPause(ctx, GRPC.HISTORY_DETAIL, 1_200);

      try { await ctx.waitFor(GRPC.HISTORY_REPLAY_BTN, 1_500); } catch { /* ok */ }
      if (!document.querySelector(GRPC.HISTORY_REPLAY_BTN)) {
        // Defensive retry: re-select the row in case detail actions did not mount.
        await ctx.click(GRPC.HISTORY_ENTRY_ROW);
        await ctx.delay(400);
        try { await ctx.waitFor(GRPC.HISTORY_REPLAY_BTN, 1_500); } catch { /* ok */ }
      }
      if (document.querySelector(GRPC.HISTORY_REPLAY_BTN)) {
        await spotlightAndPause(ctx, GRPC.HISTORY_REPLAY_BTN, 1_300);
        await ctx.click(GRPC.HISTORY_REPLAY_BTN);
      }
      try { await ctx.waitFor(GRPC.SEND_BTN, 2_500); } catch { /* ok */ }
      await ctx.delay(800);
      await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 1_000);
    },
    verify: GRPC.SEND_BTN,
  },

  // =========================================================================
  // Step 10 — Export & Import Collections
  // =========================================================================
  {
    id: 'grpc21-export-import',
    title: 'Export & Import Collections',
    description:
      'Export all collections as a single JSON file via the **Export** button on the Collections panel. ' +
      'Share or commit the file to version control — auth token **values** are never included. ' +
      'Use **Import** on another machine to restore the entire tree.',
    highlight: GRPC.COLLECTIONS_PANEL,
    pauseAfter: true,
    preAction: async (ctx) => {
      // Avoid Studio-subnav bounce before switching to Collections.
      await navigateToGrpcStudio(ctx);
      const collBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_COLLECTIONS);
      if (collBtn && collBtn.getAttribute('aria-selected') !== 'true') {
        collBtn.click();
        await ctx.delay(200);
      }
      try { await ctx.waitFor(GRPC.COLLECTIONS_PANEL, 1_500); } catch { /* ok */ }
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, GRPC.COLLECTIONS_PANEL, 800);
      await spotlightAndPause(ctx, GRPC.COLLECTIONS_EXPORT_BTN, 1_000);
      await ctx.click(GRPC.COLLECTIONS_EXPORT_BTN);
      await ctx.delay(800);
      await spotlightAndPause(ctx, GRPC.COLLECTIONS_IMPORT_BTN, 1_000);
    },
    verify: GRPC.COLLECTIONS_PANEL,
  },
];
