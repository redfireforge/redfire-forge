/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gqlSchemaLesson } from './graphql-schema-exploration';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import { markTryInsertDone } from './graphql-lesson-helpers';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql3'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

describe('graphql-schema-exploration wrapper — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('preActions skip guards when schema and response UI already present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-schema-badge-ok"></div>
      <div data-testid="gql-response-body"></div>
      <div data-testid="gql-schema-sdl-view"></div>
    `;
    for (const step of gqlSchemaLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
    }
  });

  it('setup and cleanup run without error', async () => {
    const ctx = makeCtx();
    await gqlSchemaLesson.setup!(ctx);
    await gqlSchemaLesson.cleanup!(ctx);
  });

  it('runs step actions for schema exploration beats', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-schema-badge-ok"></div>
      <div data-testid="gql-response-body"></div>
      <div data-testid="gql-schema-sdl-view"></div>
      <button data-testid="gql-se-tab-types"></button>
      <div data-testid="gql-schema-type-query"></div>
      <div data-testid="gql-schema-field-try-health"></div>
      <div data-testid="gql-editor"></div>
      <button data-testid="gql-introspect-btn"></button>
      <div data-testid="gql-schema-type-list"></div>
    `;
    for (const step of gqlSchemaLesson.steps) {
      if (step.action) await step.action(ctx);
    }
  });

  it('gql4-sdl-view action opens SDL view when schema explorer ready', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-schema-badge-ok"></div>
      <div data-testid="gql-schema-explorer"></div>
      <div data-testid="gql-schema-type-query"></div>
      <button data-testid="gql-se-tab-sdl"></button>
      <div data-testid="gql-schema-sdl-view"></div>
    `;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-sdl-view')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('gql4-browse action opens types tab when schema explorer visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-schema-badge-ok"></div>
      <div data-testid="gql-schema-explorer"></div>
      <button data-testid="gql-se-tab-types"></button>
      <div data-testid="gql-schema-type-query"></div>
      <div data-testid="gql-schema-type-list"></div>
    `;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-browse')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('gql4-try-insert action clicks try-health when field row present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-schema-badge-ok"></div>
      <div data-testid="gql-schema-type-query"></div>
      <div data-testid="gql-schema-field-try-health"></div>
      <div data-testid="gql-editor"></div>
      <button data-testid="gql-introspect-btn"></button>
    `;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-try-insert')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql4-introspect action clicks Introspect when schema badge missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-introspect-btn"></button>
      <div data-testid="gql-schema-explorer"></div>
      <div data-testid="gql-se-type-list"></div>
    `;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-introspect')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gql4-introspect readingSync runs during reading phase', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="gql-schema-badge-ok"></div>`;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-introspect')!;
    const ac = new AbortController();
    await step.readingSync!(ctx, ac.signal);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql4-read-inserted preAction executes when response body missing', async () => {
    const ctx = makeCtx();
    markTryInsertDone();
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
    `;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-read-inserted')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql4-read-inserted preAction skips execute when response body present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="gql-response-body"></div>`;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-read-inserted')!;
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql4-export-sdl preAction opens SDL tab when view missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-se-type-Query"></div>
      <button data-testid="gql-se-tab-sdl"></button>
      <div data-testid="gql-schema-sdl-view"></div>
    `;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-export-sdl')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SCHEMA_SDL_TAB);
  });

  it('gql4-export-sdl preAction skips SDL click when view already open', async () => {
    const ctx = makeCtx();
    markTryInsertDone();
    document.body.innerHTML = `<div data-testid="gql-se-detail-panel"></div>`;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-export-sdl')!;
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SCHEMA_SDL_TAB);
  });

  it('gql4-endpoint preAction waits for endpoint input', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<input data-testid="gql-endpoint-input" />`;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-endpoint')!;
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('gql4-search action searches and selects User type', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-schema-badge-ok"></div>
      <button data-testid="gql-right-tab-schema" aria-selected="true"></button>
      <div data-testid="gql-se-type-list"></div>
      <input data-testid="gql-schema-search" />
      <button data-testid="gql-se-type-User"></button>
      <div data-testid="gql-schema-type-detail"></div>
    `;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-search')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('gql4-exec-inserted action executes and waits for response viewer', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
    `;
    const step = gqlSchemaLesson.steps.find((s) => s.id === 'gql4-exec-inserted')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });
});
