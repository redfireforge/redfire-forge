/**
 * Shared helpers for the API Catalog demo lessons (CAT / P4-E).
 *
 * Seeding goes through the `catalogConvertAdapter` bridge (mounted by the App
 * shell hook `useDemoCatalogBridge`) rather than driving the multi-step Import
 * modal — so the lesson focuses on the Convert / Upgrade flow itself.
 */
import type { DemoActionContext } from '../../types';
import { CAT } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  seedSwagger2CatalogEntry,
  deleteCatalogEntryByName,
  selectCatalogEntryByName,
} from '../../adapters';

/** Display name of the seeded demo API entry. */
export const DEMO_CATALOG_NAME = 'Swagger Petstore (demo)';

/**
 * A compact, valid **Swagger 2.0** spec — the source the lesson converts to
 * OpenAPI 3.x. Kept small but realistic (paths, path params, a definition, and a
 * security scheme) so the converted output shows meaningful structure.
 */
export const DEMO_SWAGGER2_SPEC = `swagger: "2.0"
info:
  title: Swagger Petstore
  version: 1.0.0
  description: A minimal Swagger 2.0 pet store used by the Catalog convert demo.
host: petstore.swagger.io
basePath: /v2
schemes:
  - https
securityDefinitions:
  api_key:
    type: apiKey
    name: api_key
    in: header
paths:
  /pets:
    get:
      summary: List all pets
      operationId: listPets
      produces:
        - application/json
      responses:
        "200":
          description: A list of pets.
          schema:
            type: array
            items:
              $ref: "#/definitions/Pet"
    post:
      summary: Create a pet
      operationId: createPet
      consumes:
        - application/json
      parameters:
        - in: body
          name: body
          required: true
          schema:
            $ref: "#/definitions/Pet"
      responses:
        "201":
          description: Created
  /pets/{petId}:
    get:
      summary: Get a pet by ID
      operationId: getPetById
      parameters:
        - in: path
          name: petId
          required: true
          type: integer
          format: int64
      responses:
        "200":
          description: A pet.
          schema:
            $ref: "#/definitions/Pet"
definitions:
  Pet:
    type: object
    required:
      - id
      - name
    properties:
      id:
        type: integer
        format: int64
      name:
        type: string
      tag:
        type: string
`;

// ─── Spotlight helpers ───────────────────────────────────────────
let activeSpotlightCleanup: (() => void) | null = null;

export async function spotlight(ctx: DemoActionContext, selector: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  await spotlightEl(ctx, el, holdMs);
}

export async function spotlightEl(ctx: DemoActionContext, el: HTMLElement, holdMs: number): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
    if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null;
  }
}

// ─── Catalog seed / navigation ───────────────────────────────────

export function ensureCatalogTab(ctx: DemoActionContext): void {
  ctx.navigateToTab('catalog');
}

/**
 * Force the Catalog main panel onto the **Overview** sub-tab. The Overview /
 * Endpoints / Export panes are all mounted (hidden panes use `display:none`), so
 * the Convert button and format badge exist in the DOM even on the Endpoints tab —
 * but they have no layout box, so spotlight/click land on nothing. A prior run (or
 * the user) may have left the panel on Endpoints, so guard every overview step.
 */
export async function ensureCatalogOverviewView(ctx: DemoActionContext): Promise<void> {
  const overviewTab = document.querySelector<HTMLElement>(CAT.VIEW_OVERVIEW);
  if (!overviewTab) return;
  if (!overviewTab.classList.contains('active')) {
    overviewTab.click();
    await ctx.delay(300);
  }
}

/** Close the Convert modal if it is open (quiet — no ripple). */
export async function closeConvertModalIfOpen(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector(CAT.CONVERT_MODAL);
  if (!modal) return;
  const cancel = Array.from(document.querySelectorAll<HTMLButtonElement>('.cat-convert-modal .cat-btn'))
    .find(b => b.textContent?.trim() === 'Cancel');
  if (cancel) {
    cancel.click();
    await ctx.delay(200);
  }
}

/**
 * Ensure a fresh Swagger 2.0 demo entry exists and is selected. Deletes any
 * prior entry first (a previous run may have saved a converted OpenAPI 3 version,
 * which would flip the modal into upgrade mode) so every run starts from 2.0.
 */
export async function resetDemoCatalog(ctx: DemoActionContext): Promise<void> {
  ensureCatalogTab(ctx);
  await closeConvertModalIfOpen(ctx);
  deleteCatalogEntryByName(DEMO_CATALOG_NAME);
  // Let React flush the removal before seeding, so the idempotent seed doesn't
  // re-select the entry that is about to be torn down (delete → seed race).
  await ctx.delay(350);
  await seedSwagger2CatalogEntry(DEMO_CATALOG_NAME, DEMO_SWAGGER2_SPEC);
  await ctx.waitFor(CAT.entryByName(DEMO_CATALOG_NAME), 3000);
  selectCatalogEntryByName(DEMO_CATALOG_NAME);
  await ctx.delay(120);
}

/** Ensure the demo entry exists in the sidebar (without forcing selection). */
export async function ensureSeededEntryExists(ctx: DemoActionContext): Promise<void> {
  ensureCatalogTab(ctx);
  if (!document.querySelector(CAT.entryByName(DEMO_CATALOG_NAME))) {
    await seedSwagger2CatalogEntry(DEMO_CATALOG_NAME, DEMO_SWAGGER2_SPEC);
    await ctx.waitFor(CAT.entryByName(DEMO_CATALOG_NAME), 3000);
    await ctx.delay(120);
  }
}

/** Ensure the demo entry exists + is selected (seeds it if missing) on the Overview sub-tab. */
export async function ensureSeededAndSelected(ctx: DemoActionContext): Promise<void> {
  await ensureSeededEntryExists(ctx);
  selectCatalogEntryByName(DEMO_CATALOG_NAME);
  await ctx.delay(100);
  await ensureCatalogOverviewView(ctx);
}

/** Ensure the Convert / Upgrade modal is open (opens it via the overview button). */
export async function ensureConvertModalOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(CAT.CONVERT_MODAL)) return;
  await ensureSeededAndSelected(ctx);
  await ctx.waitFor(CAT.CONVERT_BTN, 2000);
  const btn = document.querySelector<HTMLElement>(CAT.CONVERT_BTN);
  if (btn) btn.click();
  await ctx.waitFor(CAT.CONVERT_MODAL, 3000);
  await ctx.delay(150);
}

/** Ensure Scalar engine is selected in the convert modal (quiet guard for step preAction). */
export async function ensureConvertEngineScalar(ctx: DemoActionContext): Promise<void> {
  await ensureConvertModalOpen(ctx);
  const scalarBtn = document.querySelector<HTMLElement>(CAT.CONVERT_ENGINE_SCALAR);
  if (!scalarBtn) return;
  const checked = scalarBtn.getAttribute('aria-checked') === 'true';
  if (!checked) {
    scalarBtn.click();
    await ctx.delay(350);
  }
}

/**
 * Ensure a specific target OpenAPI version is selected in the convert modal.
 * Quiet guard for step preActions so rapid-Next lands on the right preview.
 */
export async function ensureConvertTarget(ctx: DemoActionContext, target: string): Promise<void> {
  await ensureConvertModalOpen(ctx);
  const btn = document.querySelector<HTMLElement>(CAT.convertTarget(target));
  if (!btn) return;
  const checked = btn.getAttribute('aria-checked') === 'true';
  if (!checked) {
    btn.click();
    await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
    await ctx.delay(250);
  }
}

/**
 * Ensure the convert modal's **Prettify** toggle matches `on`. Quiet guard so a
 * rapid-Next viewer always starts the prettify step from the default (on) state.
 */
export async function ensureConvertPrettyToggle(ctx: DemoActionContext, on: boolean): Promise<void> {
  await ensureConvertModalOpen(ctx);
  const box = document.querySelector<HTMLInputElement>(CAT.CONVERT_PRETTY_TOGGLE);
  if (!box) return;
  if (box.checked !== on) {
    box.click();
    await ctx.delay(300);
  }
}

/** Remove the seeded entry + close any open modal (cleanup). */
export async function cleanupDemoCatalog(ctx: DemoActionContext): Promise<void> {
  await closeConvertModalIfOpen(ctx);
  deleteCatalogEntryByName(DEMO_CATALOG_NAME);
  await ctx.delay(80);
}
