/** GRPC-16 Schema Discovery — lesson steps */
import { GRPC } from '@shared/selectors';
import type { GrpcDemoLesson } from './grpc-lesson-contract';
import { resetGrpcManageSchemasDraftsViaBridge } from '../../adapters';
import {
  clearGrpcManageSchemasUrlBsrDraftsQuiet,
  clearGrpcSchemaDriftQuiet,
  closeGrpcSettingsDrawerQuiet,
  ensureEchoMethodSelected,
  ensureGrpcReflected,
  ensureGrpcStudioSubNavQuiet,
  ensureGrpcTarget,
  fillGrpcRequestJsonBody,
  GRPC_DEMO_TARGET,
  guardGrpcReflectedQuiet,
  guardGrpcTargetQuiet,
  openFreshGrpcTabQuietWithOptions,
  spotlightAndPause,
  spotlightAndPauseWithCallPanelHidden,
  spotlightRequestJsonContentTight,
  spotlightResponseJsonContentTight,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import {
  ECHO_SCHEMA_NODE_SEL,
  ELIZA_SERVICE_SEL,
  GRPC16_SPOTLIGHT,
  LOOKUP_REQUEST_JSON,
  LOOKUP_REQUEST_JSON_COMPACT,
  LOOKUP_SCHEMA_NODE_SEL,
  SAMPLE_BSR_MODULE,
  SAMPLE_BSR_VERSION,
  SAMPLE_PROTO_SERVICE,
  SAMPLE_PROTO_SHARED,
  SAMPLE_PROTOSET,
  SAMPLE_URL_PROTO,
  ensureManageModalClosed,
  ensureManageModalOpen,
  ensureManageModalOpenQuiet,
  ensureProtoFilesTabQuiet,
  injectProtoFilesIntoManageSchemas,
  injectProtosetIntoManageSchemas,
  isLookupCallPanelReady,
  isLookupResponseReady,
  performGrpc16DriftExplain,
  performGrpc16ProtoLoad,
  performGrpc16TabsOrientation,
  recoverGrpcReflectionQuiet,
  resetProtoRootsToDefault,
  selectSchemaBrowserMethodQuiet,
  waitForManageSchemasLoadSuccess,
} from './grpc-schema-discovery-helpers';

export const grpcSchemaDiscoverySteps: GrpcDemoLesson['steps'] = [
    {
      id: 'grpc16-intro',
      title: 'Descriptor Sources Overview',
      description:
        'gRPC Studio needs a **service descriptor** before it can show you method forms. ' +
        'It can load that descriptor from five sources — reflection, proto files, protoset bundles, URL, and BSR. ' +
        'This lesson covers all five and ends with you opening a callable method from Schema Browser.',
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
        await ensureGrpcStudioSubNavQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, GRPC16_SPOTLIGHT.beat);
        await spotlightAndPause(ctx, GRPC.MANAGE_SCHEMAS_BTN, GRPC16_SPOTLIGHT.beat);
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, GRPC16_SPOTLIGHT.outcome);
        await spotlightAndPause(ctx, GRPC.CALL_PANEL, GRPC16_SPOTLIGHT.beat);
      },
    },

    {
      id: 'grpc16-target',
      title: 'Set Target',
      description:
        `Set the gRPC target to \`${GRPC_DEMO_TARGET}\`. ` +
        'Watch the field fill, then pause on the green **Target OK** badge so the address is validated before reflection.',
      highlight: GRPC.TARGET_INPUT,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        await ensureGrpcTarget(ctx);
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, GRPC16_SPOTLIGHT.beat);
        await spotlightAndPause(ctx, GRPC.TARGET_STATUS_OK, GRPC16_SPOTLIGHT.outcome);
      },
      verify: GRPC.TARGET_STATUS_OK,
    },

    {
      id: 'grpc16-reflect',
      title: 'Reflect: Pull Live Descriptors',
      description:
        'Click **Reflect** to have Studio query the `grpc.reflection.v1alpha.ServerReflection` service. ' +
        'The Explorer tree populates with `echo.EchoService` and its four methods — no `.proto` files uploaded.',
      highlight: GRPC.REFLECT_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcTargetQuiet(ctx);
        await clearGrpcSchemaDriftQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.REFLECT_BTN, GRPC16_SPOTLIGHT.beat);
        await ensureGrpcReflected(ctx);
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, GRPC16_SPOTLIGHT.beat);
        await spotlightAndPause(ctx, GRPC.EXPLORER_TREE, GRPC16_SPOTLIGHT.outcome);
      },
      verify: GRPC.EXPLORER_TREE,
    },

    {
      id: 'grpc16-source',
      title: 'Confirm Source Badge and Search',
      description:
        'Check the Explorer footer — it shows **Reflection** as the active descriptor source. ' +
        'Type **Echo** in the search box to filter the tree. Then clear the filter to restore the full list. ' +
        'Explorer search is pure client-side filtering — it never re-triggers network reflection.',
      highlight: GRPC.EXPLORER_SOURCE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcReflectedQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(GRPC.EXPLORER_SOURCE, 10_000);
        await spotlightAndPause(ctx, GRPC.EXPLORER_FOOTER, GRPC16_SPOTLIGHT.brief);
        await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, GRPC16_SPOTLIGHT.outcome);
        await ctx.waitFor(GRPC.EXPLORER_SEARCH, 10_000);
        await spotlightAndPause(ctx, GRPC.EXPLORER_SEARCH, GRPC16_SPOTLIGHT.beat);
        await ctx.fill(GRPC.EXPLORER_SEARCH, 'Echo');
        await ctx.waitFor(GRPC.EXPLORER_TREE, 5_000);
        await spotlightAndPause(ctx, GRPC.EXPLORER_TREE, GRPC16_SPOTLIGHT.beat);
        await ctx.fill(GRPC.EXPLORER_SEARCH, '');
        await ctx.delay(GRPC16_SPOTLIGHT.afterFill);
        await spotlightAndPause(ctx, GRPC.EXPLORER_TREE, GRPC16_SPOTLIGHT.brief);
      },
      verify: GRPC.EXPLORER_SOURCE,
    },

    {
      id: 'grpc16-manage-open',
      title: 'Open Manage Schemas',
      description:
        'Click the **Manage Schemas** button to open the schema management modal. ' +
        'Here you control which descriptor source is active — five tabs: **Proto Files**, **Protoset**, **URL**, **BSR**, and **Schema Browser**. ' +
        'Reflection has no tab here; it is triggered from the main explorer. ' +
        'Draft inputs in this modal are persisted per tab, so a hard refresh restores your staged values.',
      highlight: GRPC.MANAGE_SCHEMAS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcReflectedQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.MANAGE_SCHEMAS_BTN, GRPC16_SPOTLIGHT.beat);
        await ensureManageModalOpen(ctx);
        await spotlightAndPause(ctx, GRPC.PROTO_MANAGE_MODAL, GRPC16_SPOTLIGHT.outcome);
        // One steady hold per tab — long enough to read the label before moving on.
        await spotlightAndPause(ctx, GRPC.PROTO_TAB_PROTO_FILES, GRPC16_SPOTLIGHT.beat);
        await spotlightAndPause(ctx, GRPC.PROTO_TAB_PROTOSET, GRPC16_SPOTLIGHT.beat);
        await spotlightAndPause(ctx, GRPC.PROTO_TAB_URL, GRPC16_SPOTLIGHT.beat);
        await spotlightAndPause(ctx, GRPC.PROTO_TAB_BSR, GRPC16_SPOTLIGHT.beat);
        await spotlightAndPause(ctx, GRPC.PROTO_TAB_SCHEMA_BROWSER, GRPC16_SPOTLIGHT.outcome);
      },
      verify: GRPC.PROTO_MANAGE_MODAL,
    },

    {
      id: 'grpc16-tabs',
      title: 'Quick Orientation: Source Tabs',
      description:
        'Use one concrete sample per tab:\n\n' +
        `- **Proto Files**: \`${SAMPLE_PROTO_SERVICE}\` + \`${SAMPLE_PROTO_SHARED}\`\n` +
        `- **Protoset**: \`${SAMPLE_PROTOSET}\`\n` +
        `- **URL**: \`${SAMPLE_URL_PROTO}\`\n` +
        `- **BSR**: \`${SAMPLE_BSR_MODULE}\` @ \`${SAMPLE_BSR_VERSION}\`\n\n` +
        'This is an orientation pass only. The next steps perform a full Proto Files workflow end-to-end.\n\n' +
        'Each tab targets a different deployment pattern.\n\n' +
        '_Note: the BSR example needs internet access._',
      pauseAfter: true,
      preAction: async (ctx) => {
        await clearGrpcSchemaDriftQuiet(ctx);
        // Prefer React-state wipe — no URL/BSR tab cycling flash during reading.
        if (!resetGrpcManageSchemasDraftsViaBridge()) {
          await ensureManageModalOpenQuiet(ctx);
          await clearGrpcManageSchemasUrlBsrDraftsQuiet(ctx);
          await resetProtoRootsToDefault(ctx);
        } else {
          await ensureManageModalOpenQuiet(ctx);
        }
      },
      action: async (ctx) => {
        await performGrpc16TabsOrientation(ctx);
      },
      verify: GRPC.PROTO_UPLOAD_ZONE,
    },

    {
      id: 'grpc16-proto-files',
      title: 'Proto Files: Upload to a Virtual Root',
      description:
        'On **Proto Files**, Studio uses a root-aware `protoRoots` model: each uploaded file belongs to a ' +
        'virtual root and is normalized to a canonical path (`<mount>/<file>`). Keep the **shared** virtual ' +
        'root selected, then drop the two sample files into the upload zone in sequence:\n\n' +
        `1. \`${SAMPLE_PROTO_SHARED}\`\n` +
        `2. \`${SAMPLE_PROTO_SERVICE}\`\n\n` +
        'After upload, both filenames appear in the selected root file list and the **Canonical paths** ' +
        'preview. If two roots produce ambiguous basenames or duplicate canonical paths, collision ' +
        'warnings appear immediately.',
      // No frozen step-level highlight: this step walks several panels (root list →
      // upload zone → file list → canonical preview). A persistent ring is `frozen`
      // on one element during the action phase and would keep showing while the
      // action spotlights the others. Instead every content beat is spotlighted
      // inside action() with its own pause.
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureProtoFilesTabQuiet(ctx);
        await ctx.waitFor(GRPC.PROTO_UPLOAD_ZONE, 5_000).catch(() => undefined);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.PROTO_TAB_PROTO_FILES);
        await ctx.waitFor(GRPC.PROTO_ROOT_MANAGER, 4_000);
        await ctx.delay(GRPC16_SPOTLIGHT.afterTab);
        // Beat 1 — root-aware model: uploads land in a virtual root; keep "shared" selected.
        await spotlightAndPause(ctx, GRPC.PROTO_ROOT_LIST, GRPC16_SPOTLIGHT.beat);
        // Beat 2 — drop the two sample files into the upload zone.
        await spotlightAndPause(ctx, GRPC.PROTO_UPLOAD_ZONE, GRPC16_SPOTLIGHT.beat);
        const uploaded = await injectProtoFilesIntoManageSchemas(ctx);
        if (!uploaded) {
          await ctx.waitFor(GRPC.PROTO_UPLOAD_ZONE, 3_000);
          await spotlightAndPause(ctx, GRPC.PROTO_UPLOAD_ZONE, GRPC16_SPOTLIGHT.beat);
          return;
        }
        await ctx.waitFor(GRPC.PROTO_FILE_LIST, 4_000);
        // Beat 3 — outcome: both files now sit in the selected root's file list.
        await spotlightAndPauseWithCallPanelHidden(ctx, GRPC.PROTO_FILE_LIST, GRPC16_SPOTLIGHT.outcome);
        // Beat 4 — outcome the step teaches: files normalize to canonical <mount>/<file> paths.
        await spotlightAndPause(ctx, GRPC.PROTO_CANONICAL_PREVIEW, GRPC16_SPOTLIGHT.outcome);
      },
      verify: GRPC.PROTO_FILE_LIST,
    },

    {
      id: 'grpc16-proto-load',
      title: 'Proto Files: Review Paths & Load Schema',
      description:
        'Click the **shared** virtual root in the left list to make it active — the right side switches ' +
        'context to that selected root. Review the **Canonical paths** panel to confirm the file paths are ' +
        'normalized as expected, then click **Load** to parse them into an active descriptor source.\n\n' +
        'Expected result:\n' +
        '- No parse error shown\n' +
        '- Schema Browser can now browse the uploaded service\n\n' +
        'If files are missing or imports are unresolved, fix the file set / import root and retry.',
      // No frozen step-level highlight: this step walks root selection → canonical
      // path review → Load → Schema Browser. Each beat is spotlighted inside
      // action() with its own pause so the ring follows the narration instead of a
      // single frozen box on the Load button.
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureProtoFilesTabQuiet(ctx);
        await ctx.waitFor(GRPC.PROTO_LOAD_BTN, 2_500).catch(() => undefined);
      },
      action: async (ctx) => {
        await performGrpc16ProtoLoad(ctx);
      },
      verify: GRPC.PROTO_LOAD_BTN,
    },

    {
      id: 'grpc16-schema-browser',
      title: 'Use Loaded Schema in Schema Browser',
      description:
        'Switch to the **Schema Browser** tab. The browser tree lists every service, message, and enum type from the active descriptor source. ' +
        'If you loaded the Proto Files sample successfully, you can browse the uploaded `api.ApiService` service here. ' +
        'For automation stability, the lesson keeps a reflected fallback path. ' +
        'Type **Lookup** in the search box to filter to the `api.ApiService / Lookup` method node. ' +
        'Select it and inspect the signature in the detail panel on the right.',
      highlight: GRPC.PROTO_TAB_SCHEMA_BROWSER,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureManageModalClosed(ctx);
        await guardGrpcReflectedQuiet(ctx);
        await ensureManageModalOpenQuiet(ctx);
      },
      action: async (ctx) => {
        // Cap waits so Lookup+Echo miss paths stay under DEMO_ACTION_TIMEOUT_MS (45s).
        await ctx.click(GRPC.PROTO_TAB_SCHEMA_BROWSER);
        await ctx.waitFor(GRPC.SCHEMA_BROWSER, 2_500);
        await ctx.delay(GRPC16_SPOTLIGHT.afterTab);
        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER, GRPC16_SPOTLIGHT.beat);
        await ctx.waitFor(GRPC.SCHEMA_BROWSER_TREE, 2_500);
        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER_SEARCH, GRPC16_SPOTLIGHT.beat);
        await ctx.fill(GRPC.SCHEMA_BROWSER_SEARCH, 'Lookup');
        await ctx.delay(GRPC16_SPOTLIGHT.afterFill);
        await ctx.waitFor(LOOKUP_SCHEMA_NODE_SEL, 2_000);
        if (document.querySelector(LOOKUP_SCHEMA_NODE_SEL)) {
          await spotlightAndPause(ctx, LOOKUP_SCHEMA_NODE_SEL, GRPC16_SPOTLIGHT.beat);
          await ctx.click(LOOKUP_SCHEMA_NODE_SEL);
          await ctx.delay(GRPC16_SPOTLIGHT.afterClick);
        } else {
          await ctx.fill(GRPC.SCHEMA_BROWSER_SEARCH, 'Echo');
          await ctx.delay(GRPC16_SPOTLIGHT.afterFill);
          await ctx.waitFor(ECHO_SCHEMA_NODE_SEL, 1_500);
          if (document.querySelector(ECHO_SCHEMA_NODE_SEL)) {
            await spotlightAndPause(ctx, ECHO_SCHEMA_NODE_SEL, GRPC16_SPOTLIGHT.beat);
            await ctx.click(ECHO_SCHEMA_NODE_SEL);
            await ctx.delay(GRPC16_SPOTLIGHT.afterClick);
          }
        }
        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER_DETAIL, GRPC16_SPOTLIGHT.beat);
        await spotlightAndPause(ctx, GRPC.SCHEMA_METHOD_SIGNATURE, GRPC16_SPOTLIGHT.outcome);
      },
      verify: GRPC.SCHEMA_BROWSER,
    },

    {
      id: 'grpc16-copy-grpcurl',
      title: 'Copy grpcurl Command',
      description:
        'With the **Lookup** method selected in Schema Browser, click **Copy as grpcurl** to copy a ready-to-run terminal command to your clipboard. ' +
        'If running it locally, make sure the `grpcurl` CLI is installed first.',
      highlight: GRPC.SCHEMA_COPY_GRPCURL_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await selectSchemaBrowserMethodQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER_DETAIL, GRPC16_SPOTLIGHT.brief);
        await spotlightAndPause(ctx, GRPC.SCHEMA_METHOD_SIGNATURE, GRPC16_SPOTLIGHT.beat);
        await spotlightAndPause(ctx, GRPC.SCHEMA_COPY_GRPCURL_BTN, GRPC16_SPOTLIGHT.outcome);
        const copyBtn = document.querySelector<HTMLElement>(GRPC.SCHEMA_COPY_GRPCURL_BTN);
        if (copyBtn) {
          copyBtn.click();
          await ctx.delay(GRPC16_SPOTLIGHT.afterClick);
        }
      },
      verify: GRPC.SCHEMA_COPY_GRPCURL_BTN,
    },

    {
      id: 'grpc16-open-method',
      title: 'Open in Tab and Execute Unary',
      description:
        'Click **Open in tab** to bind the method into the call panel. The modal closes and the **Form Input** composer appears. ' +
        `Fill the request with \`${LOOKUP_REQUEST_JSON_COMPACT}\` (or Echo fallback), send the unary call, then pause on **OK** status and the response body.`,
      highlight: GRPC.SCHEMA_OPEN_TAB_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Ensure the Manage Schemas modal is OPEN with the Lookup method selected
        // so the action can spotlight and click "Open in tab" visibly.
        // Do NOT click "Open in tab" here — that visible beat belongs to the action.
        const modalOpen = () => Boolean(document.querySelector(GRPC.PROTO_MANAGE_MODAL));
        const openTabVisible = () => Boolean(document.querySelector(GRPC.SCHEMA_OPEN_TAB_BTN));
        if (modalOpen() && openTabVisible()) return;
        // If we got here the modal is either closed or doesn't show Open in tab yet.
        // Re-open it and navigate to Schema Browser → Lookup.
        await ensureManageModalClosed(ctx);
        await selectSchemaBrowserMethodQuiet(ctx);
      },
      action: async (ctx) => {
        if (document.querySelector(GRPC.PROTO_MANAGE_MODAL) && document.querySelector(GRPC.SCHEMA_OPEN_TAB_BTN)) {
          await spotlightAndPause(ctx, GRPC.SCHEMA_OPEN_TAB_BTN, GRPC16_SPOTLIGHT.outcome);
          await ctx.click(GRPC.SCHEMA_OPEN_TAB_BTN);
          await ensureManageModalClosed(ctx);
          await ctx.waitFor(GRPC.CALL_PANEL, 3_000);
          await ctx.delay(GRPC16_SPOTLIGHT.afterClick);
        } else if (!isLookupCallPanelReady()) {
          await ensureEchoMethodSelected(ctx);
        }

        if (document.querySelector(GRPC.REQUEST_JSON)) {
          await spotlightRequestJsonContentTight(ctx, GRPC16_SPOTLIGHT.beat);
        } else {
          await spotlightAndPause(ctx, GRPC.PROTO_FIELD_INPUT_MESSAGE, GRPC16_SPOTLIGHT.beat);
        }

        if (!document.querySelector<HTMLTextAreaElement>(GRPC.REQUEST_JSON)?.value.includes('A-100')) {
          await fillGrpcRequestJsonBody(ctx, LOOKUP_REQUEST_JSON);
          await ctx.delay(GRPC16_SPOTLIGHT.afterFill);
        }

        await spotlightAndPause(ctx, GRPC.SEND_BTN, GRPC16_SPOTLIGHT.beat);
        if (!isLookupResponseReady()) {
          await ctx.click(GRPC.SEND_BTN);
          // Cap wait so failed calls cannot burn the full action timeout alone.
          await ctx.waitFor(GRPC.RESPONSE_BODY, 4_000);
          if (!document.querySelector(GRPC.RESPONSE_BODY)) {
            await ctx.waitFor(GRPC.RESPONSE_STATUS, 2_500);
          }
        }
        await ctx.delay(GRPC16_SPOTLIGHT.afterClick);
        await spotlightResponseJsonContentTight(ctx, GRPC16_SPOTLIGHT.outcome);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    {
      id: 'grpc16-protoset',
      title: 'Protoset: Upload Descriptor Bundle',
      description:
        'Return to **Manage Schemas** and switch to the **Protoset** tab. ' +
        `Use the sample bundle path \`${SAMPLE_PROTOSET}\` as the concrete artifact for this step. ` +
        'After selecting a `.protoset` file, click **Load** to activate that descriptor source. ' +
        'This step performs a real descriptor load and only proceeds after success.',
      highlight: GRPC.PROTO_TAB_PROTOSET,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureManageModalClosed(ctx);
        await openFreshGrpcTabQuietWithOptions(ctx, { forceFresh: true });
        await clearGrpcSchemaDriftQuiet(ctx);
        await ensureManageModalOpenQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.PROTO_TAB_PROTOSET);
        await ctx.waitFor(GRPC.PROTO_PROTOSET_ZONE, 10_000);
        await ctx.delay(GRPC16_SPOTLIGHT.afterTab);
        await spotlightAndPause(ctx, GRPC.PROTO_PROTOSET_ZONE, GRPC16_SPOTLIGHT.outcome);
        const uploaded = await injectProtosetIntoManageSchemas(ctx);
        if (!uploaded) {
          await spotlightAndPause(ctx, GRPC.PROTO_PROTOSET_ZONE, GRPC16_SPOTLIGHT.beat);
          return;
        }
        await spotlightAndPause(ctx, GRPC.PROTO_LOAD_BTN, GRPC16_SPOTLIGHT.beat);
        const loadBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_LOAD_BTN);
        if (!loadBtn || loadBtn.disabled) return;

        loadBtn.click();
        const loaded = await waitForManageSchemasLoadSuccess(ctx, 'protoset');
        if (loaded) {
          await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, GRPC16_SPOTLIGHT.outcome);
        }
      },
      verify: GRPC.PROTO_PROTOSET_ZONE,
    },

    {
      id: 'grpc16-url',
      title: 'URL: Load Descriptor from Remote Proto',
      description:
        'Switch to the **URL** tab and provide the sample descriptor URL. ' +
        `Use \`${SAMPLE_URL_PROTO}\` and click **Load** to run a real remote descriptor fetch flow. ` +
        'Depending on your fixture/network policy, this may either load successfully or return a guarded fetch error.',
      highlight: GRPC.PROTO_TAB_URL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureManageModalClosed(ctx);
        // Open a fresh tab so there is no previously bound method to orphan
        // when the URL load replaces the descriptor. Without this, a tab
        // still pointing at ElizaService/Converse (from a prior BSR run)
        // would produce a blocking drift banner visible through the
        // transparent modal overlay.
        await openFreshGrpcTabQuietWithOptions(ctx, { forceFresh: true });
        await clearGrpcSchemaDriftQuiet(ctx);
        await ensureManageModalOpenQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.PROTO_TAB_URL);
        await ctx.waitFor(GRPC.PROTO_URL_INPUT, 10_000);
        await ctx.delay(GRPC16_SPOTLIGHT.afterTab);
        await spotlightAndPause(ctx, GRPC.PROTO_URL_INPUT, GRPC16_SPOTLIGHT.beat);
        await ctx.fill(GRPC.PROTO_URL_INPUT, SAMPLE_URL_PROTO);
        await ctx.delay(GRPC16_SPOTLIGHT.afterFill);
        await spotlightAndPause(ctx, GRPC.PROTO_LOAD_BTN, GRPC16_SPOTLIGHT.beat);
        const loadBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_LOAD_BTN);
        if (loadBtn && !loadBtn.disabled) {
          loadBtn.click();
          await ctx.delay(GRPC16_SPOTLIGHT.outcome);
        }
      },
      verify: GRPC.PROTO_URL_INPUT,
    },

    {
      id: 'grpc16-bsr',
      title: 'BSR: Load Descriptor from Registry Module',
      description:
        'Switch to the **BSR** tab and fill the module + version fields. ' +
        `Use module \`${SAMPLE_BSR_MODULE}\` at version \`${SAMPLE_BSR_VERSION}\`, then click **Load**. ` +
        'The companion server fetches the descriptor from Buf Schema Registry — direct when you are online, ' +
        'or via your configured proxy when on a corporate network. If the proxy is unreachable, it retries ' +
        'direct automatically. After **Load**, the source badge should update to **bsr** and `ElizaService` ' +
        'appears in the Service Explorer.',
      highlight: GRPC.PROTO_TAB_BSR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureManageModalClosed(ctx);
        // Open a fresh tab so there is no previously bound method to orphan
        // when BSR loads Eliza (which has no EchoService). Without this,
        // a tab still pointing at echo.EchoService/Echo would produce a
        // blocking drift banner visible through the transparent modal overlay.
        await openFreshGrpcTabQuietWithOptions(ctx, { forceFresh: true });
        await clearGrpcSchemaDriftQuiet(ctx);
        await ensureManageModalOpenQuiet(ctx);
      },
      action: async (ctx) => {
        // Network BSR fetch can be slow — keep network wait capped; local spotlight
        // holds are guided so viewers can follow fills before Load.
        await ctx.click(GRPC.PROTO_TAB_BSR);
        await ctx.waitFor(GRPC.PROTO_BSR_MODULE_INPUT, 2_500);
        await ctx.delay(GRPC16_SPOTLIGHT.afterTab);
        await spotlightAndPause(ctx, GRPC.PROTO_BSR_MODULE_INPUT, GRPC16_SPOTLIGHT.beat);
        await ctx.fill(GRPC.PROTO_BSR_MODULE_INPUT, SAMPLE_BSR_MODULE);
        await ctx.delay(GRPC16_SPOTLIGHT.afterFill);
        await spotlightAndPause(ctx, GRPC.PROTO_BSR_VERSION_INPUT, GRPC16_SPOTLIGHT.beat);
        await ctx.fill(GRPC.PROTO_BSR_VERSION_INPUT, SAMPLE_BSR_VERSION);
        await ctx.delay(GRPC16_SPOTLIGHT.afterFill);
        await spotlightAndPause(ctx, GRPC.PROTO_LOAD_BTN, GRPC16_SPOTLIGHT.beat);

        const loadBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_LOAD_BTN);
        if (!loadBtn || loadBtn.disabled) return;

        loadBtn.click();
        const loaded = await waitForManageSchemasLoadSuccess(ctx, 'bsr', 6_000);
        if (!loaded) {
          if (document.querySelector(GRPC.PROTO_LOAD_ERROR)) {
            await spotlightAndPause(ctx, GRPC.PROTO_LOAD_ERROR, GRPC16_SPOTLIGHT.outcome);
          }
          return;
        }

        // Fresh tab has no previous method → no drift expected after BSR
        // loads Eliza. Close modal and show outcomes.
        await ensureManageModalClosed(ctx);
        await ctx.delay(GRPC16_SPOTLIGHT.afterClick);

        // Safety net: clear any unexpected drift that may still appear.
        if (document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)) {
          await clearGrpcSchemaDriftQuiet(ctx);
          await ctx.delay(200);
        }

        // Outcome: a clean bsr/ElizaService state with no drift banner.
        await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, GRPC16_SPOTLIGHT.outcome);
        if (document.querySelector(ELIZA_SERVICE_SEL)) {
          await spotlightAndPause(ctx, ELIZA_SERVICE_SEL, GRPC16_SPOTLIGHT.beat);
        }
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, GRPC16_SPOTLIGHT.beat);
      },
      verify: GRPC.EXPLORER_SOURCE,
    },

    {
      id: 'grpc16-drift',
      title: 'Understanding Schema Drift',
      description:
        '**Schema drift** happens when the running server changes its reflection output after Studio has already cached its descriptors. ' +
        'When present, Studio surfaces a drift banner directly under the connection row in the **main workspace pane** (above method details/call panel). ' +
        'If you do not currently see it, that means no drift is active in this fixture state. ' +
        'The banner offers two options:\n' +
        '- **Rebind** a specific service to pull the updated descriptor.\n' +
        '- **Dismiss** to acknowledge the drift without changing the active schema.\n\n' +
        '⚠️ _Live drift simulation is deferred here and is covered in Lesson 13 (`grpc-schema-diff`) with the modified-proto fixture._',
      highlight: GRPC.SERVICE_EXPLORER,
      pauseAfter: true,
      preAction: async (ctx) => {
        await recoverGrpcReflectionQuiet(ctx);
        await clearGrpcSchemaDriftQuiet(ctx);
      },
      action: async (ctx) => {
        await performGrpc16DriftExplain(ctx);
      },
      verify: GRPC.SERVICE_EXPLORER,
    },
  ];
