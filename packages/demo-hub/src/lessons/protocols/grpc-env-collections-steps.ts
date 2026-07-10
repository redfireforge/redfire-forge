/** GRPC-21 Environments & Collections — lesson steps */
import { GRPC } from '@shared/selectors';
import { EM, emWsDefaultRowSel, emWsDefaultRowValueSel } from '@shared/selectors/em';
import {
  GRPC_DEMO_TARGET,
  ensureEchoMethodSelected,
  ensureGrpcReflected,
  ensureEchoMessageFilled,
  openGrpcHistoryPanelQuiet,
  setGrpcTargetQuiet,
  spotlightAndPause,
} from './grpc-lesson-helpers';
import { navigateToEnvironmentManager } from '../env-manager-lesson-helpers';
import { upsertWorkspaceDefaults } from '../../adapters';
import type { GrpcDemoLesson } from './grpc-lesson-contract';
import {
  DEMO_COLLECTION_NAME,
  DEMO_MESSAGE,
  DEMO_REQUEST_ID,
  DEMO_REQUEST_NAME,
  DEMO_USER_ID,
  LOCAL_GRPC_HOST,
  STAGING_GRPC_HOST,
  UNKNOWN_VAR_TARGET,
  ensureExecutedInStudioQuiet,
  ensureMetadataRowQuiet,
  ensureStudioNavQuiet,
  ensureTemplateTargetQuiet,
  seedWorkspaceDefaults,
} from './grpc-env-collections-helpers';

export const grpcEnvCollectionsSteps: GrpcDemoLesson['steps'] = 
[

    // =========================================================================
    // Step 1 — Workspace Defaults: the interpolation variable store
    // =========================================================================
    {
      id: 'grpc21-intro-env',
      title: 'Environment Variables for gRPC',
      description:
        'RedfireForge supports **template variables** in the target address, metadata, and request body. ' +
        'Variables like `{{grpcHost}}`, `{{requestId}}`, and `{{userId}}` are defined in the **Workspace Defaults ' +
        '(Interpolation)** section of the Environment Manager. In this step, we will populate three variables ' +
        'live in the UI: `grpcHost` (the gRPC server address), `requestId` (for request tracing), and `userId` ' +
        '(a body field). Open **Environments** and scroll to Workspace Defaults to watch each value being added.',
      highlight: EM.MANAGER,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToEnvironmentManager(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(EM.MANAGER, 5_000);
        // Spotlight the entire environment manager panel.
        await spotlightAndPause(ctx, EM.MANAGER, 800);
        // Scroll to the Workspace Defaults section and spotlight the grpcHost row.
        await ctx.delay(400);
        const wsSection = document.querySelector<HTMLElement>('.env-section--ws-defaults');
        if (wsSection) {
          wsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await ctx.delay(600);
          await spotlightAndPause(ctx, '.env-section--ws-defaults', 1_000);
        }

        const setWorkspaceDefaultVisible = async (key: string, value: string): Promise<void> => {
          const existingRow = document.querySelector<HTMLElement>(emWsDefaultRowSel(key));
          if (existingRow) {
            existingRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await ctx.delay(250);
            await spotlightAndPause(ctx, emWsDefaultRowSel(key), 700);
            const valueInputSel = emWsDefaultRowValueSel(key);
            const valueInput = document.querySelector<HTMLInputElement>(valueInputSel);
            if (valueInput) {
              await spotlightAndPause(ctx, valueInputSel, 450);
              await ctx.fill(valueInputSel, value);
              valueInput.dispatchEvent(new Event('change', { bubbles: true }));
              valueInput.blur();
              await ctx.delay(250);
            }
            return;
          }

          await spotlightAndPause(ctx, EM.WS_DEFAULT_KEY_INPUT, 450);
          await ctx.fill(EM.WS_DEFAULT_KEY_INPUT, key);
          await spotlightAndPause(ctx, EM.WS_DEFAULT_VALUE_INPUT, 450);
          await ctx.fill(EM.WS_DEFAULT_VALUE_INPUT, value);
          await spotlightAndPause(ctx, EM.WS_DEFAULT_SAVE_BTN, 350);
          await ctx.click(EM.WS_DEFAULT_SAVE_BTN);
          await ctx.delay(300);
        };

        await setWorkspaceDefaultVisible('grpcHost', LOCAL_GRPC_HOST);
        await setWorkspaceDefaultVisible('requestId', DEMO_REQUEST_ID);
        await setWorkspaceDefaultVisible('userId', DEMO_USER_ID);

        // Spotlight each variable row so the viewer can identify them.
        await spotlightAndPause(ctx, emWsDefaultRowSel('grpcHost'), 900);
        await ctx.delay(300);
        await spotlightAndPause(ctx, emWsDefaultRowSel('requestId'), 800);
        await ctx.delay(300);
        const userIdRow = document.querySelector<HTMLElement>(emWsDefaultRowSel('userId'));
        if (userIdRow) {
          userIdRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await ctx.delay(400);
        }
        await spotlightAndPause(ctx, emWsDefaultRowSel('userId'), 800);
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
        'resolves the template at runtime against your Workspace Defaults. The **Interpolation Preview Strip** ' +
        'immediately below the target input shows: the raw **Template** on the left and the fully **Resolved** ' +
        'address on the right. Switch between the two views to confirm `{{grpcHost}}` → `localhost:50051`.',
      highlight: GRPC.INTERPOLATION_PREVIEW_STRIP,
      pauseAfter: true,
      preAction: async (ctx) => {
        seedWorkspaceDefaults();
        await ensureStudioNavQuiet(ctx);
        // Restore direct address first so the fill in action() is visible.
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
        await ensureGrpcReflected(ctx);
        await ensureEchoMethodSelected(ctx);
      },
      action: async (ctx) => {
        // Spotlight the target input before we type.
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
        // Replace literal address with the {{grpcHost}} template.
        await ctx.fill(GRPC.TARGET_INPUT, '{{grpcHost}}');
        await ctx.delay(500);
        // Wait for preview strip to appear.
        try {
          await ctx.waitFor(GRPC.INTERPOLATION_PREVIEW_STRIP, 3_000);
        } catch {
          await ctx.delay(400);
        }
        // Spotlight the preview strip — viewer reads the template value.
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_STRIP, 1_200);
        // Click "Template" toggle to show raw {{grpcHost}}.
        const templateBtn = document.querySelector<HTMLButtonElement>(GRPC.INTERPOLATION_PREVIEW_TEMPLATE);
        if (templateBtn) {
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_TEMPLATE, 600);
          templateBtn.click();
          await ctx.delay(400);
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_VALUE, 800);
        }
        // Click "Resolved" toggle to show the live address.
        const resolvedBtn = document.querySelector<HTMLButtonElement>(GRPC.INTERPOLATION_PREVIEW_RESOLVED);
        if (resolvedBtn) {
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_RESOLVED, 600);
          resolvedBtn.click();
          await ctx.delay(400);
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_VALUE, 1_000);
        }
      },
      verify: GRPC.INTERPOLATION_PREVIEW_STRIP,
    },

    // =========================================================================
    // Step 3 — Switch environments: preview updates instantly
    // =========================================================================
    {
      id: 'grpc21-env-switch',
      title: 'Switch Environments — Preview Updates Instantly',
      description:
        'When you change the `grpcHost` value in Workspace Defaults (or switch to a different environment ' +
        'that provides a different `grpcHost`), the **Interpolation Preview Strip** updates without any page ' +
        'reload. Watch the resolved address change from `localhost:50051` (local Docker fixture) to ' +
        '`localhost:59999` (a staging placeholder). The staging server is intentionally unreachable — this ' +
        'demonstrates that template resolution is **separate from connectivity**.',
      highlight: GRPC.INTERPOLATION_PREVIEW_STRIP,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureTemplateTargetQuiet(ctx);
      },
      action: async (ctx) => {
        // Show current resolved value (local).
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_STRIP, 900);
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_VALUE, 700);
        await ctx.delay(400);

        // Simulate "switching to staging" by updating grpcHost in workspace defaults.
        upsertWorkspaceDefaults({ grpcHost: STAGING_GRPC_HOST });
        await ctx.delay(500);

        // Strip should now show localhost:59999.
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_STRIP, 900);
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_VALUE, 1_000);
        await ctx.delay(500);

        // Restore to local address for the remaining steps.
        upsertWorkspaceDefaults({ grpcHost: LOCAL_GRPC_HOST });
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_VALUE, 800);
      },
      verify: GRPC.INTERPOLATION_PREVIEW_STRIP,
    },

    // =========================================================================
    // Step 4 — Custom variable in Metadata
    // =========================================================================
    {
      id: 'grpc21-metadata-var',
      title: 'Template Variable in Metadata',
      description:
        'Variables work in **all four fields**: target, metadata, body, and auth. Open the **Metadata** tab ' +
        'and add a header `x-request-id` with value `{{requestId}}`. The template is stored as-is in the ' +
        'call configuration — it is resolved to `' + DEMO_REQUEST_ID + '` at the moment you click Send. This ' +
        'makes it easy to vary trace IDs, tenant keys, or API versions across environments without editing ' +
        'each saved request.',
      highlight: GRPC.METADATA_EDITOR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureTemplateTargetQuiet(ctx);
      },
      action: async (ctx) => {
        // Navigate to Metadata tab.
        await spotlightAndPause(ctx, GRPC.REQUEST_TAB_METADATA, 600);
        await ctx.click(GRPC.REQUEST_TAB_METADATA);
        try {
          await ctx.waitFor(GRPC.METADATA_EDITOR, 3_000);
        } catch {
          await ctx.delay(300);
        }
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.METADATA_EDITOR, 1_000);

        // Add a new metadata row.
        const addBtn = document.querySelector<HTMLButtonElement>(GRPC.METADATA_ADD_BTN);
        if (addBtn) {
          await spotlightAndPause(ctx, GRPC.METADATA_ADD_BTN, 600);
          await ctx.click(GRPC.METADATA_ADD_BTN);
          await ctx.delay(400);
        }
        // Fill key and value.
        const keyInput = document.querySelector<HTMLInputElement>('[aria-label="Metadata key 1"]');
        const valInput = document.querySelector<HTMLInputElement>('[aria-label="Metadata value 1"]');
        if (keyInput) {
          await spotlightAndPause(ctx, '[aria-label="Metadata key 1"]', 500);
          await ctx.fill('[aria-label="Metadata key 1"]', 'x-request-id');
          await ctx.delay(400);
        }
        if (valInput) {
          await spotlightAndPause(ctx, '[aria-label="Metadata value 1"]', 500);
          await ctx.fill('[aria-label="Metadata value 1"]', '{{requestId}}');
          await ctx.delay(400);
        }
        // Highlight the completed metadata row.
        await spotlightAndPause(ctx, GRPC.METADATA_EDITOR, 1_000);
      },
      verify: GRPC.METADATA_EDITOR,
    },

    // =========================================================================
    // Step 5 — Template variable in JSON body; resolved payload preview
    // =========================================================================
    {
      id: 'grpc21-body-var',
      title: 'Template Variable in the Request Body',
      description:
        'In the **Form Input** tab, add `"userId": "{{userId}}"` alongside your `message`. The ' +
        'placeholder `{{userId}}` will be resolved to `' + DEMO_USER_ID + '` when the call is sent. ' +
        'Click the **Resolved** toggle on the Interpolation Preview Strip to see the fully substituted ' +
        'body, metadata, and target in one preview — exactly what the server will receive.',
      highlight: GRPC.REQUEST_JSON,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureMetadataRowQuiet(ctx);
        // Ensure Form Input tab is active (JSON is now inline inside Form Input).
        const formTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
        if (formTab && formTab.getAttribute('aria-pressed') !== 'true') {
          formTab.click();
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        // Spotlight the Form Input tab so the viewer knows where to look.
        await spotlightAndPause(ctx, GRPC.REQUEST_TAB_FORM, 600);
        await ctx.click(GRPC.REQUEST_TAB_FORM);
        try {
          await ctx.waitFor(GRPC.REQUEST_JSON, 3_000);
        } catch {
          await ctx.delay(300);
        }
        await ctx.delay(300);
        await spotlightAndPause(ctx, GRPC.REQUEST_JSON, 800);

        // Build and fill the body with both message and userId template.
        const body = JSON.stringify({ message: DEMO_MESSAGE, userId: '{{userId}}' }, null, 2);
        await ctx.fill(GRPC.REQUEST_JSON, body);
        await ctx.delay(500);
        await spotlightAndPause(ctx, GRPC.REQUEST_JSON, 1_000);

        // Show the resolved payload preview by clicking the Resolved toggle.
        const resolvedBtn = document.querySelector<HTMLButtonElement>(GRPC.INTERPOLATION_PREVIEW_RESOLVED);
        if (resolvedBtn) {
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_STRIP, 700);
          await ctx.click(GRPC.INTERPOLATION_PREVIEW_RESOLVED);
          await ctx.delay(500);
          // Spotlight the payload preview (body + metadata resolved values).
          const payloadPreview = document.querySelector<HTMLElement>(
            '[data-testid="grpc-interpolation-payload-preview-value"]',
          );
          if (payloadPreview) {
            await spotlightAndPause(ctx, '[data-testid="grpc-interpolation-payload-preview-value"]', 1_200);
          } else {
            await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_STRIP, 1_000);
          }
        }
      },
      verify: GRPC.REQUEST_JSON,
    },

    // =========================================================================
    // Step 6 — Interpolation error banner
    // =========================================================================
    {
      id: 'grpc21-interp-error',
      title: 'Interpolation Error: Unresolved Token',
      description:
        'If a variable in the **target** field cannot be resolved (the key is missing from all environment ' +
        'layers), gRPC Studio shows an orange **Interpolation Error** banner beneath the target input. It ' +
        'names the exact unresolved token and blocks the call until the variable is defined or removed. ' +
        'This prevents silent runtime failures where calls reach the wrong host.',
      highlight: GRPC.INTERPOLATION_ERROR_BANNER,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureStudioNavQuiet(ctx);
        seedWorkspaceDefaults();
        // Force an unresolvable token to trigger the banner.
        await setGrpcTargetQuiet(ctx, UNKNOWN_VAR_TARGET);
        try {
          await ctx.waitFor(GRPC.INTERPOLATION_ERROR_BANNER, 3_000);
        } catch {
          // Banner may render async — action will confirm.
        }
      },
      action: async (ctx) => {
        // Spotlight the target input showing the broken template.
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 800);
        await ctx.delay(300);
        // Wait for the error banner.
        try {
          await ctx.waitFor(GRPC.INTERPOLATION_ERROR_BANNER, 3_000);
        } catch {
          await ctx.delay(500);
        }
        // Spotlight the orange error banner — hold long enough to read.
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_ERROR_BANNER, 1_400);
        // Spotlight the token path (e.g. "_undefined_grpc_host_") within the banner.
        const tokenPath = document.querySelector<HTMLElement>(GRPC.INTERPOLATION_ERROR_TOKEN_PATH);
        if (tokenPath) {
          await spotlightAndPause(ctx, GRPC.INTERPOLATION_ERROR_TOKEN_PATH, 900);
        }
        await ctx.delay(500);
        // Restore working target so remaining steps can execute.
        await setGrpcTargetQuiet(ctx, '{{grpcHost}}');
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.INTERPOLATION_PREVIEW_STRIP, 800);
      },
      verify: GRPC.INTERPOLATION_ERROR_BANNER,
    },

    // =========================================================================
    // Step 7 — Execute and save request to a collection
    // =========================================================================
    {
      id: 'grpc21-save-request',
      title: 'Save a Call to a Collection',
      description:
        'Switch back to the Form tab. With `{{grpcHost}}` resolving to the local fixture, click **Send** ' +
        'to execute an Echo call. Once you have a successful response, click **Save request** on the ' +
        'connection bar. Give the request a name — `Echo — Hello World` — and create a new collection ' +
        'folder called `Echo Demos`. The entire call snapshot (target template, method, metadata, body, ' +
        'auth) is persisted in IndexedDB for instant recall.',
      highlight: GRPC.SAVE_REQUEST_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Restore direct target so the send button is enabled.
        await ensureStudioNavQuiet(ctx);
        seedWorkspaceDefaults();
        await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
        await ensureEchoMessageFilled(ctx, DEMO_MESSAGE);
        // Switch to Form tab silently.
        const formTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
        if (formTab && formTab.getAttribute('aria-pressed') !== 'true') {
          formTab.click();
          await ctx.delay(200);
        }
      },
      action: async (ctx) => {
        // Execute the Echo call.
        await spotlightAndPause(ctx, GRPC.CALL_SEND_BAR, 700);
        const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
        if (sendBtn && !sendBtn.disabled) {
          await ctx.click(GRPC.SEND_BTN);
          await ctx.delay(400);
        }
        try {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 10_000);
        } catch {
          await ctx.delay(1_000);
        }
        await spotlightAndPause(ctx, GRPC.RESPONSE_PANEL, 900);
        await ctx.delay(300);

        // Click Save request button.
        await spotlightAndPause(ctx, GRPC.SAVE_REQUEST_BTN, 800);
        await ctx.click(GRPC.SAVE_REQUEST_BTN);
        try {
          await ctx.waitFor(GRPC.SAVE_REQUEST_MODAL, 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(300);
        await spotlightAndPause(ctx, GRPC.SAVE_REQUEST_MODAL, 900);

        // Fill request name.
        await spotlightAndPause(ctx, GRPC.SAVE_REQUEST_NAME, 600);
        await ctx.fill(GRPC.SAVE_REQUEST_NAME, DEMO_REQUEST_NAME);
        await ctx.delay(400);

        // Fill the new collection name.
        const newCollInput = document.querySelector<HTMLInputElement>(GRPC.SAVE_REQUEST_NEW_COLLECTION);
        if (newCollInput) {
          await spotlightAndPause(ctx, GRPC.SAVE_REQUEST_NEW_COLLECTION, 600);
          await ctx.fill(GRPC.SAVE_REQUEST_NEW_COLLECTION, DEMO_COLLECTION_NAME);
          await ctx.delay(400);
        }
        await spotlightAndPause(ctx, GRPC.SAVE_REQUEST_MODAL, 700);

        // Submit the save.
        await ctx.click(GRPC.SAVE_REQUEST_SUBMIT);
        try {
          // Modal closes after save; wait for it to disappear.
          const startedAt = Date.now();
          while (Date.now() - startedAt < 3_000) {
            if (!document.querySelector(GRPC.SAVE_REQUEST_MODAL)) break;
            await ctx.delay(100);
          }
        } catch {
          await ctx.delay(500);
        }

        // Navigate to Collections sub-nav to confirm the entry was saved.
        await ctx.click(GRPC.SUB_NAV_COLLECTIONS);
        try {
          await ctx.waitFor(GRPC.COLLECTIONS_TREE, 3_000);
        } catch {
          await ctx.delay(500);
        }
        await ctx.delay(300);
        await spotlightAndPause(ctx, GRPC.COLLECTIONS_TREE, 1_000);
      },
      verify: GRPC.COLLECTIONS_TREE,
    },

    // =========================================================================
    // Step 8 — Collections tree: browse saved request; rename button
    // =========================================================================
    {
      id: 'grpc21-collections-tree',
      title: 'Collections Tree: Browse, Search & Rename',
      description:
        'The **Collections** sub-nav shows your saved call tree. Click the **`Echo Demos`** folder header ' +
        'to expand it — your saved request appears underneath. The **✎** icon next to the folder name lets ' +
        'you rename the collection at any time without losing saved entries. Use the search bar at the top ' +
        'to filter across all collections when the list grows. Collections are stored locally in IndexedDB ' +
        'and survive browser restarts.',
      highlight: GRPC.COLLECTIONS_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Ensure collections panel is open.
        await ensureStudioNavQuiet(ctx);
        const collBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_COLLECTIONS);
        if (collBtn && collBtn.getAttribute('aria-selected') !== 'true') {
          collBtn.click();
          await ctx.delay(300);
        }
        try {
          await ctx.waitFor(GRPC.COLLECTIONS_TREE, 2_500);
        } catch {
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.COLLECTIONS_PANEL, 800);

        // Spotlight the collections search bar.
        if (document.querySelector(GRPC.COLLECTIONS_SEARCH)) {
          await spotlightAndPause(ctx, GRPC.COLLECTIONS_SEARCH, 700);
        }
        await ctx.delay(300);

        // Find and expand the Echo Demos collection group header.
        const collGroupHeader = document.querySelector<HTMLElement>(
          '[data-testid^="grpc-collection-group-"]',
        );
        if (collGroupHeader) {
          await spotlightAndPause(ctx, '[data-testid^="grpc-collection-group-"]', 900);
          // Expand the group if not already expanded.
          const toggleBtn = collGroupHeader.querySelector<HTMLButtonElement>('.grpc-collection-group__header');
          if (toggleBtn && toggleBtn.getAttribute('aria-expanded') !== 'true') {
            toggleBtn.click();
            await ctx.delay(400);
          }
        }

        // Spotlight the saved request item.
        const savedItem = document.querySelector<HTMLElement>(
          '[data-testid^="grpc-collection-saved-"]',
        );
        if (savedItem) {
          await ctx.delay(200);
          await spotlightAndPause(ctx, '[data-testid^="grpc-collection-saved-"]', 1_000);
        }

        // Spotlight the Rename (✎) button — just show it exists, do not click.
        const renameBtn = document.querySelector<HTMLElement>(
          '[data-testid^="grpc-collection-group-rename-"]',
        );
        if (renameBtn) {
          await ctx.delay(300);
          await spotlightAndPause(ctx, '[data-testid^="grpc-collection-group-rename-"]', 1_000);
        }
      },
      verify: GRPC.COLLECTIONS_TREE,
    },

    // =========================================================================
    // Step 9 — Open saved request in a Studio tab
    // =========================================================================
    {
      id: 'grpc21-open-in-studio',
      title: 'Open a Saved Request in Studio',
      description:
        'Click a saved request in the Collections tree to open its detail pane. Then click **Open in Studio** — ' +
        'gRPC Studio loads all saved settings into the active tab: the target template, selected method, metadata ' +
        'headers, and body. You can immediately execute or tweak the call. The original saved request remains ' +
        'in the collection unchanged — edits in the Studio tab do not affect the saved copy.',
      highlight: GRPC.SAVED_REQUEST_DETAIL,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Ensure collections sub-nav is open and the saved item is visible.
        await ensureStudioNavQuiet(ctx);
        const collBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_COLLECTIONS);
        if (collBtn && collBtn.getAttribute('aria-selected') !== 'true') {
          collBtn.click();
          await ctx.delay(300);
        }
        try {
          await ctx.waitFor(GRPC.COLLECTIONS_TREE, 2_500);
        } catch {
          await ctx.delay(300);
        }
        // Expand group and click the saved request to pre-populate the detail pane.
        const collGroupToggle = document.querySelector<HTMLButtonElement>('.grpc-collection-group__header');
        if (collGroupToggle && collGroupToggle.getAttribute('aria-expanded') !== 'true') {
          collGroupToggle.click();
          await ctx.delay(300);
        }
        const savedItem = document.querySelector<HTMLElement>('[data-testid^="grpc-collection-saved-"]');
        if (savedItem) {
          savedItem.click();
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        // Click the saved request row to ensure the detail pane is open.
        const savedItem = document.querySelector<HTMLElement>('[data-testid^="grpc-collection-saved-"]');
        if (savedItem) {
          await spotlightAndPause(ctx, '[data-testid^="grpc-collection-saved-"]', 700);
          await ctx.click('[data-testid^="grpc-collection-saved-"]');
          await ctx.delay(400);
        }
        // Wait for and spotlight the saved request detail pane.
        try {
          await ctx.waitFor(GRPC.SAVED_REQUEST_DETAIL, 3_000);
        } catch {
          await ctx.delay(400);
        }
        await spotlightAndPause(ctx, GRPC.SAVED_REQUEST_DETAIL, 1_000);
        await ctx.delay(300);

        // Spotlight the Open in Studio button.
        await spotlightAndPause(ctx, GRPC.SAVED_REQUEST_OPEN_STUDIO, 800);
        await ctx.click(GRPC.SAVED_REQUEST_OPEN_STUDIO);
        // Studio sub-nav becomes active after replay.
        try {
          await ctx.waitFor(GRPC.SEND_BTN, 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(500);
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 900);
        await spotlightAndPause(ctx, GRPC.CALL_PANEL, 800);
      },
      verify: GRPC.SEND_BTN,
    },

    // =========================================================================
    // Step 10 — History replay
    // =========================================================================
    {
      id: 'grpc21-history-replay',
      title: 'Replay a Call from History',
      description:
        'Every gRPC call you execute is automatically logged in **History** — including the method, target, ' +
        'metadata, body, response, and duration. Click the **History** sub-nav to browse the log. Select any ' +
        'entry to see its full snapshot, then click **Replay** to load it into the active Studio tab. Note: ' +
        'secret values (auth tokens) are **not** persisted in history — a replayed call will need auth ' +
        're-entered before it can reach a secured endpoint.',
      highlight: GRPC.HISTORY_REPLAY_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Ensure at least one executed call is in history.
        await ensureExecutedInStudioQuiet(ctx);
        // Open history panel quietly.
        await openGrpcHistoryPanelQuiet(ctx);
        try {
          await ctx.waitFor(GRPC.HISTORY_ENTRY_ROW, 3_000);
        } catch {
          // Proceed — history entry may take a moment to appear.
        }
      },
      action: async (ctx) => {
        // Navigate to history sub-nav visibly.
        await spotlightAndPause(ctx, GRPC.SUB_NAV_HISTORY, 700);
        await ctx.click(GRPC.SUB_NAV_HISTORY);
        try {
          await ctx.waitFor(GRPC.HISTORY_PANEL, 3_000);
        } catch {
          await ctx.delay(300);
        }
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.HISTORY_PANEL, 900);

        // Select first history entry.
        try {
          await ctx.waitFor(GRPC.HISTORY_ENTRY_ROW, 5_000);
        } catch {
          await ctx.delay(500);
        }
        await spotlightAndPause(ctx, GRPC.HISTORY_ENTRY_ROW, 800);
        await ctx.click(GRPC.HISTORY_ENTRY_ROW);
        try {
          await ctx.waitFor(GRPC.HISTORY_DETAIL, 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(300);
        await spotlightAndPause(ctx, GRPC.HISTORY_DETAIL, 1_000);
        await ctx.delay(300);

        // Spotlight the Replay button.
        await spotlightAndPause(ctx, GRPC.HISTORY_REPLAY_BTN, 900);
        await ctx.click(GRPC.HISTORY_REPLAY_BTN);
        // After replay, studio sub-nav becomes active.
        try {
          await ctx.waitFor(GRPC.SEND_BTN, 3_000);
        } catch {
          await ctx.delay(500);
        }
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 800);
        await spotlightAndPause(ctx, GRPC.CALL_PANEL, 700);
      },
      verify: GRPC.HISTORY_DETAIL,
    },

    // =========================================================================
    // Step 11 — Export collection; show Import button
    // =========================================================================
    {
      id: 'grpc21-export-import',
      title: 'Export & Import Collections',
      description:
        'Collections can be exported as a single JSON file containing all folders and saved requests. ' +
        'Click **Export** on the Collections panel header to download `redfire-grpc-collections-*.json`. ' +
        'Share this file with a teammate or import it on another machine using the **Import** button — ' +
        'the entire tree reappears with all field values intact. Exports are safe to commit to version ' +
        'control: auth token **values** are never included in the serialised snapshot.',
      highlight: GRPC.COLLECTIONS_PANEL,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Navigate to collections sub-nav.
        await ensureStudioNavQuiet(ctx);
        const collBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_COLLECTIONS);
        if (collBtn && collBtn.getAttribute('aria-selected') !== 'true') {
          collBtn.click();
          await ctx.delay(300);
        }
        try {
          await ctx.waitFor(GRPC.COLLECTIONS_PANEL, 2_500);
        } catch {
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.COLLECTIONS_PANEL, 800);
        await ctx.delay(300);

        // Spotlight the Export button.
        await spotlightAndPause(ctx, GRPC.COLLECTIONS_EXPORT_BTN, 1_000);
        // Click Export — triggers a file download in the browser.
        await ctx.click(GRPC.COLLECTIONS_EXPORT_BTN);
        await ctx.delay(600);
        await spotlightAndPause(ctx, GRPC.COLLECTIONS_EXPORT_BTN, 700);
        await ctx.delay(400);

        // Spotlight the Import button and explain its purpose.
        await spotlightAndPause(ctx, GRPC.COLLECTIONS_IMPORT_BTN, 1_000);
        await ctx.delay(300);

        // Return to the collections tree for a final overview.
        await spotlightAndPause(ctx, GRPC.COLLECTIONS_TREE, 900);
      },
      verify: GRPC.COLLECTIONS_PANEL,
    },
];
