/**
 * Shared helpers for the API Catalog demo lessons (CAT-*).
 *
 * Seeding goes through the `catalogConvertAdapter` bridge (mounted by the App
 * shell hook `useDemoCatalogBridge`) rather than driving the multi-step Import
 * modal — so lessons focus on their specific feature flow.
 */
import type { DemoActionContext } from '../../types';
import { CAT } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  seedSwagger2CatalogEntry,
  seedCatalogEntry,
  deleteCatalogEntryByName,
  selectCatalogEntryByName,
  getCatalogEntryByName,
  addVersionByName,
  deleteCollectionsByName,
} from '../../adapters';
import { JSONPLACEHOLDER_API_SPEC } from '../../../../../src/data/galleries/catalog-specs/specs';

export {
  seedCatalogEntry,
  seedSwagger2CatalogEntry,
  deleteCatalogEntryByName,
  selectCatalogEntryByName,
  getCatalogEntryByName,
  deleteCollectionsByName,
};

/** Gallery spec YAML for the JSONPlaceholder API (OpenAPI 3.0.3, 12 endpoints). */
export { JSONPLACEHOLDER_API_SPEC };

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

export async function spotlightEl(
  ctx: DemoActionContext,
  el: HTMLElement,
  holdMs: number,
  options?: { skipScroll?: boolean },
): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  // Portaled CustomSelect items (.cs-menu) must not scrollIntoView — that can
  // close the menu / detach the node so the ring sticks to the trigger behind it.
  if (!options?.skipScroll && !el.closest('.cs-menu')) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
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

/**
 * Bridge-only seed for `prepareBeforeNavigate`: Catalog has not mounted yet, so
 * this must never wait on DOM. Leaves the Swagger 2.0 entry selected so Start /
 * Restart paints the Overview of that entry instead of CatalogWelcome.
 */
export async function prepareDemoCatalogBeforeNavigate(ctx: DemoActionContext): Promise<void> {
  deleteCollectionsByName(DEMO_CATALOG_NAME);
  deleteCatalogEntryByName(DEMO_CATALOG_NAME);
  await seedSwagger2CatalogEntry(DEMO_CATALOG_NAME, DEMO_SWAGGER2_SPEC);
  selectCatalogEntryByName(DEMO_CATALOG_NAME);
  await ctx.delay(80);
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

// ─── JSONPlaceholder helpers ─────────────────────────────────────

/** Ensure JSONPlaceholder entry exists (seeds if missing). */
export async function ensureJsonPlaceholderEntry(ctx: DemoActionContext): Promise<void> {
  const entryName = 'JSONPlaceholder API';
  ensureCatalogTab(ctx);
  if (!document.querySelector(CAT.entryByName(entryName))) {
    await seedCatalogEntry(entryName, JSONPLACEHOLDER_API_SPEC);
    await ctx.waitFor(CAT.entryByName(entryName), 3000);
    await ctx.delay(120);
  }
}

/** Ensure JSONPlaceholder entry exists + is selected (seeds if missing). */
export async function ensureJsonPlaceholderSelected(ctx: DemoActionContext): Promise<void> {
  await ensureJsonPlaceholderEntry(ctx);
  selectCatalogEntryByName('JSONPlaceholder API');
  await ctx.delay(100);
}

/** Ensure the Endpoints sub-tab is active. */
export async function ensureEndpointsView(ctx: DemoActionContext): Promise<void> {
  const tab = document.querySelector<HTMLElement>(CAT.VIEW_ENDPOINTS);
  if (tab && !tab.classList.contains('active')) {
    tab.click();
    await ctx.delay(300);
  }
}

/** Collapse all currently expanded endpoint cards (quiet). */
export function collapseAllCards(): void {
  document.querySelectorAll<HTMLElement>('.sw-card .sw-body').forEach(body => {
    const header = body.closest('.sw-card')?.querySelector<HTMLElement>('.sw-header');
    if (header) simulateReactClick(header);
  });
}

/** Close the export modal overlay if open (quiet). */
export function closeExportModalIfOpen(): void {
  const overlay = document.querySelector<HTMLElement>(CAT.EXPORT_MODAL);
  if (!overlay) return;
  const cancel = overlay.querySelector<HTMLButtonElement>('.cat-btn:not(.cat-btn-primary)');
  if (cancel) cancel.click();
}

/** Close the Version History modal if open (quiet). */
export function closeVersionHistoryIfOpen(): void {
  const modal = document.querySelector<HTMLElement>(CAT.VERSION_HISTORY_MODAL);
  if (!modal) return;
  const close = modal.querySelector<HTMLButtonElement>('.cat-btn:not(.cat-btn-primary)');
  if (close) close.click();
}

/** Close the auth panel if open (quiet — toggles the Authorize button). */
export function closeAuthPanelIfOpen(): void {
  const panel = document.querySelector<HTMLElement>(CAT.AUTH_PANEL);
  if (!panel) return;
  const authorizeBtn = document.querySelector<HTMLButtonElement>(CAT.AUTHORIZE_BTN);
  if (authorizeBtn) authorizeBtn.click();
}

/** Close the Catalog Edit (link microservice) modal if open (quiet). */
export function closeEditModalIfOpen(): void {
  const modal = document.querySelector<HTMLElement>(CAT.EDIT_MODAL);
  if (!modal) return;
  const cancel = document.querySelector<HTMLButtonElement>(CAT.EDIT_CANCEL_BTN);
  if (cancel) {
    cancel.click();
    return;
  }
  // Fallback: try the overlay backdrop or dispatch Escape
  const overlay = document.querySelector<HTMLElement>('.cat-edit-overlay');
  if (overlay) overlay.click();
  modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

/** Reset host strategy to From Spec so later Execute steps hit the live API. */
export function resetHostStrategyToFromSpec(): void {
  closeEditModalIfOpen();
  const fromSpec = document.querySelector<HTMLElement>(CAT.HOST_FROM_SPEC);
  if (fromSpec && !fromSpec.classList.contains('active')) {
    fromSpec.click();
  }
}

/**
 * A slightly modified JSONPlaceholder spec to simulate a re-import with changes.
 * Adds `POST /posts/{id}/comments` + `GET /albums` (2 new operations) and bumps
 * the version to `2.0.0`. This is a self-contained YAML — NOT derived from V1
 * via string manipulation, which avoids duplicate-key YAML parse errors.
 */
export const JSONPLACEHOLDER_API_SPEC_V2 = `openapi: "3.0.3"
info:
  title: JSONPlaceholder API
  version: "2.0.0"
  description: >
    Free fake REST API for testing and prototyping. Provides users, posts,
    comments, albums, photos, and todos — all with full CRUD support.
  contact:
    url: https://jsonplaceholder.typicode.com

servers:
  - url: https://jsonplaceholder.typicode.com
    description: Production

tags:
  - name: posts
    description: Blog post operations
  - name: users
    description: User data
  - name: comments
    description: Post comments
  - name: todos
    description: Todo items
  - name: albums
    description: Photo albums

paths:
  /posts:
    get:
      operationId: listPosts
      summary: List all posts
      tags: [posts]
      parameters:
        - name: userId
          in: query
          schema:
            type: integer
          description: Filter by author
      responses:
        "200":
          description: Array of posts
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Post"
    post:
      operationId: createPost
      summary: Create a post
      tags: [posts]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PostInput"
      responses:
        "201":
          description: Created post
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Post"

  /posts/{id}:
    get:
      operationId: getPost
      summary: Get a post by ID
      tags: [posts]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Post detail
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Post"
    put:
      operationId: updatePost
      summary: Update a post
      tags: [posts]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PostInput"
      responses:
        "200":
          description: Updated post
    delete:
      operationId: deletePost
      summary: Delete a post
      tags: [posts]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Deleted

  /posts/{id}/comments:
    get:
      operationId: getPostComments
      summary: Get comments for a post
      tags: [comments]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Array of comments
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Comment"
    post:
      operationId: createPostComment
      summary: Add a comment to a post
      tags: [comments]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, email, body]
              properties:
                name: { type: string }
                email: { type: string }
                body: { type: string }
      responses:
        "201":
          description: Created comment

  /albums:
    get:
      operationId: listAlbums
      summary: List all albums
      tags: [albums]
      responses:
        "200":
          description: Array of albums
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Album"

  /users:
    get:
      operationId: listUsers
      summary: List all users
      tags: [users]
      responses:
        "200":
          description: Array of users
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/User"

  /users/{id}:
    get:
      operationId: getUser
      summary: Get a user by ID
      tags: [users]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: User detail
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"

  /users/{id}/posts:
    get:
      operationId: getUserPosts
      summary: Get posts by a user
      tags: [posts]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Array of posts
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Post"

  /users/{id}/todos:
    get:
      operationId: getUserTodos
      summary: Get todos for a user
      tags: [todos]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Array of todos
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Todo"

  /todos:
    get:
      operationId: listTodos
      summary: List all todos
      tags: [todos]
      responses:
        "200":
          description: Array of todos
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Todo"

  /comments:
    get:
      operationId: listComments
      summary: List all comments
      tags: [comments]
      parameters:
        - name: postId
          in: query
          schema:
            type: integer
      responses:
        "200":
          description: Array of comments
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Comment"

components:
  schemas:
    Post:
      type: object
      properties:
        userId: { type: integer }
        id: { type: integer }
        title: { type: string }
        body: { type: string }
    PostInput:
      type: object
      required: [title, body, userId]
      properties:
        title: { type: string }
        body: { type: string }
        userId: { type: integer }
    Comment:
      type: object
      properties:
        postId: { type: integer }
        id: { type: integer }
        name: { type: string }
        email: { type: string }
        body: { type: string }
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        username: { type: string }
        email: { type: string }
        phone: { type: string }
        website: { type: string }
    Todo:
      type: object
      properties:
        userId: { type: integer }
        id: { type: integer }
        title: { type: string }
        completed: { type: boolean }
    Album:
      type: object
      properties:
        userId: { type: integer }
        id: { type: integer }
        title: { type: string }
`;

/** Seed a second version of the JSONPlaceholder entry by adding a new version. */

/** Track whether v2 was seeded this session to avoid duplicates. */
let secondVersionSeeded = false;

export async function seedSecondVersion(ctx: DemoActionContext): Promise<void> {
  const entryName = 'JSONPlaceholder API';
  await ensureJsonPlaceholderSelected(ctx);
  if (secondVersionSeeded) return;
  const success = await addVersionByName(entryName, JSONPLACEHOLDER_API_SPEC_V2);
  if (success) {
    secondVersionSeeded = true;
    await ctx.delay(400);
  } else {
    // Retry once after giving React time to commit the entry state
    await ctx.delay(500);
    const retry = await addVersionByName(entryName, JSONPLACEHOLDER_API_SPEC_V2);
    if (retry) secondVersionSeeded = true;
    await ctx.delay(400);
  }
}

/**
 * Quietly ensures the JSONPlaceholder entry has at least 2 versions.
 * Used in preAction guards for steps that depend on version history.
 * Retries with delay if the first attempt fails (React state timing).
 */
export async function ensureSecondVersionSeeded(): Promise<void> {
  if (secondVersionSeeded) return;
  const entryName = 'JSONPlaceholder API';
  const success = await addVersionByName(entryName, JSONPLACEHOLDER_API_SPEC_V2);
  if (success) {
    secondVersionSeeded = true;
    return;
  }
  // First attempt failed — wait for React to commit the entry state and retry
  await new Promise(r => setTimeout(r, 600));
  const retry = await addVersionByName(entryName, JSONPLACEHOLDER_API_SPEC_V2);
  if (retry) secondVersionSeeded = true;
}

/** Reset the version-seeded flag (call from cleanup). */
export function resetSecondVersionFlag(): void {
  secondVersionSeeded = false;
}

/** Open the Version History modal from the Overview quick actions. */
export async function openVersionHistoryModal(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(CAT.VERSION_HISTORY_MODAL)) return;
  await ensureJsonPlaceholderSelected(ctx);
  await ensureCatalogOverviewView(ctx);
  const btn = document.querySelector<HTMLElement>(CAT.VERSION_HISTORY_BTN);
  if (btn) btn.click();
  await ctx.waitFor(CAT.VERSION_HISTORY_MODAL, 3000);
  await ctx.delay(200);
}

/** Simulate a user click that React 18 event delegation reliably captures. */
function simulateReactClick(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

/** Ensure a specific endpoint card is expanded with Try It Out open. */
export async function ensureCardTryItOpen(method: string, path: string): Promise<HTMLElement | null> {
  let card = document.querySelector<HTMLElement>(CAT.endpointCard(method, path));
  if (!card) return null;

  // Expand if collapsed — use dispatchEvent for reliable React 18 handling
  if (!card.querySelector('.sw-body')) {
    const header = card.querySelector<HTMLElement>('.sw-header');
    if (header) simulateReactClick(header);
    await new Promise(r => setTimeout(r, 500));
    card = document.querySelector<HTMLElement>(CAT.endpointCard(method, path));
    if (!card) return null;
  }

  // Open Try It Out if not active
  const tryitBtn = card.querySelector<HTMLButtonElement>(CAT.TRYIT_BTN);
  if (tryitBtn && !tryitBtn.classList.contains('cancel')) {
    simulateReactClick(tryitBtn);
    await new Promise(r => setTimeout(r, 400));
  }

  return card;
}

/** Simple selector wait (no demo ctx dependency). */
export function waitForSelector(sel: string, timeout: number): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) { resolve(el); return; }
    const t0 = Date.now();
    const check = setInterval(() => {
      const found = document.querySelector<HTMLElement>(sel);
      if (found) { clearInterval(check); resolve(found); }
      else if (Date.now() - t0 > timeout) { clearInterval(check); reject(new Error(`Timeout waiting for ${sel}`)); }
    }, 80);
  });
}

/** Remove the seeded entry + close any open modal + orphaned collections (cleanup). */
export async function cleanupDemoCatalog(ctx: DemoActionContext): Promise<void> {
  await closeConvertModalIfOpen(ctx);
  deleteCatalogEntryByName(DEMO_CATALOG_NAME);
  deleteCollectionsByName(DEMO_CATALOG_NAME);
  deleteCollectionsByName('JSONPlaceholder API');
  deleteCollectionsByName('JSONPlaceholder API (1.0.0)');
  await ctx.delay(80);
}
