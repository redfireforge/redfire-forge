/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql8'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  activateGqlDemoTabQuiet: vi.fn(async () => {}),
}));

import {
  setupGraphqlQueryBuilderBeforeEach,
  teardownGraphqlQueryBuilderAfterEach,
} from './graphql-query-builder.testHelpers';
import { gqlQueryBuilderLesson } from './graphql-query-builder';
import { GQL } from '@shared/selectors';
import {
  LESSON7_EDITOR_COMMENT,
  prepareEditInEditorReading,
  prepareEditorCommentReading,
  prepareOneWaySyncReading,
} from './graphql-lesson-helpers';
describe('gql-query-builder lesson', () => {
  beforeEach(() => {
    setupGraphqlQueryBuilderBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlQueryBuilderAfterEach();
  });

afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlQueryBuilderLesson.id).toBe('gql-query-builder');
    expect(gqlQueryBuilderLesson.category).toBe('graphql');
    expect(gqlQueryBuilderLesson.name).toBe('Query Builder — Visual Operations');
    expect(gqlQueryBuilderLesson.steps.length).toBe(11);
    expect(gqlQueryBuilderLesson.estimatedMinutes).toBe(6);
    expect(gqlQueryBuilderLesson.tabBudget).toBe(1);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlQueryBuilderLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlQueryBuilderLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlQueryBuilderLesson.steps.map((s) => s.id)).toEqual([
      'gql7-builder',
      'gql7-expand',
      'gql7-health',
      'gql7-select-all',
      'gql7-user-arg',
      'gql7-alias',
      'gql7-include',
      'gql7-copy',
      'gql7-edit',
      'gql7-editor-comment',
      'gql7-one-way',
    ]);
  });

  it('all 11 steps have pauseAfter: true', () => {
    gqlQueryBuilderLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 1–11 have preAction guards', () => {
    gqlQueryBuilderLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ─── Concept & diagram ───────────────────────────────────────────────────

  it('concept body explains WHY builder mode exists', () => {
    expect(gqlQueryBuilderLesson.concept.body).toContain('Builder');
    expect(gqlQueryBuilderLesson.concept.body).toContain('One-way sync');
  });

  it('concept body explains alias and directive WHY', () => {
    expect(gqlQueryBuilderLesson.concept.body).toContain('alias');
    expect(gqlQueryBuilderLesson.concept.body).toContain('@include');
  });

  it('concept diagram is 700×430 studio chrome SVG', () => {
    const diag = gqlQueryBuilderLesson.concept.diagram;
    expect(diag).toContain('viewBox="0 0 700 430"');
    expect(diag).toContain('GraphQL Studio — Query Builder');
    expect(diag).toContain('Builder');
    expect(diag).toContain('Field Tree');
    expect(diag).toContain('SDL Preview');
    expect(diag).toContain('Summary');
  });

  it('concept diagram shows one-way sync legend', () => {
    expect(gqlQueryBuilderLesson.concept.diagram).toContain('Edit in Editor');
    expect(gqlQueryBuilderLesson.concept.diagram).toContain('not synced back');
  });

  it('concept keyTerms cover Builder mode, field tree, SDL preview, summary, alias, one-way sync', () => {
    const terms = (gqlQueryBuilderLesson.concept.keyTerms ?? []).map((t) => t.term);
    expect(terms).toContain('Builder mode');
    expect(terms).toContain('Field tree');
    expect(terms).toContain('SDL preview');
    expect(terms).toContain('Summary panel');
    expect(terms).toContain('Field alias');
    expect(terms).toContain('One-way sync');
  });

  // ─── Spotlight / highlight correctness ───────────────────────────────────

  it('gql7-builder highlights MODE_BUILDER (Builder tab before switching)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-builder')!;
    expect(step.highlight).toBe(GQL.MODE_BUILDER);
    expect(step.verify).toBe(GQL.QB_FIELD_TREE);
  });

  it('gql7-expand highlights QB_FIELD_TREE (expand button is in field tree)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-expand')!;
    expect(step.highlight).toBe(GQL.QB_FIELD_TREE);
  });

  it('gql7-health highlights QB_FIELD_TREE (live SDL preview updates)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-health')!;
    expect(step.highlight).toBe(GQL.QB_FIELD_TREE);
  });

  it('gql7-select-all highlights QB_SELECT_ALL', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-select-all')!;
    expect(step.highlight).toBe(GQL.QB_SELECT_ALL);
  });

  it('gql7-user-arg highlights QB_ARG_USER_ID (argument input)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-user-arg')!;
    expect(step.highlight).toBe(GQL.QB_ARG_USER_ID);
  });

  it('gql7-alias highlights FO_ALIAS_USER_ID (alias input in Summary)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-alias')!;
    expect(step.highlight).toBe(GQL.FO_ALIAS_USER_ID);
  });

  it('gql7-include highlights FO_INCLUDE_USER_ID (@include toggle in Summary)', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-include')!;
    expect(step.highlight).toBe(GQL.FO_INCLUDE_USER_ID);
  });

  it('gql7-copy highlights QB_COPY button', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-copy')!;
    expect(step.highlight).toBe(GQL.QB_COPY);
  });

  it('gql7-edit uses prepareEditInEditorReading preAction and highlights QB_EDIT', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-edit')!;
    expect(step.highlight).toBe(GQL.QB_EDIT);
    expect(step.preAction).toBe(prepareEditInEditorReading);
  });

  it('gql7-editor-comment highlights EDITOR and uses prepareEditorCommentReading preAction', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-editor-comment')!;
    expect(step.highlight).toBe(GQL.EDITOR);
    expect(step.verify).toBe(GQL.EDITOR);
    expect(step.preAction).toBe(prepareEditorCommentReading);
  });

  it('gql7-one-way highlights Generated query preview (visible after Play) and verifies QB_CODE', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    expect(step.highlight).toBe(GQL.QB_CODE);
    expect(step.verify).toBe(GQL.QB_CODE);
    expect(step.preAction).toBe(prepareOneWaySyncReading);
  });

  // ─── Step description WHY content ────────────────────────────────────────

  it('gql7-builder description explains why builder exists', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-builder')!;
    expect(step.description).toContain('Builder');
    expect(step.description).toContain('health');
  });

  it('gql7-health description explains live preview feedback loop', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-health')!;
    expect(step.description).toContain('live');
    expect(step.description).toContain('health');
  });

  it('gql7-user-arg description explains required arg inline surfacing', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-user-arg')!;
    expect(step.description).toContain('required');
    expect(step.description).toContain('id');
  });

  it('gql7-alias description references user › id breadcrumb row', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-alias')!;
    expect(step.description).toContain('user › id');
    expect(step.description).toContain('userId');
  });

  it('gql7-include description explains @include directive runtime behavior', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-include')!;
    expect(step.description).toContain('@include');
    expect(step.description).toContain('@skip');
  });

  it('gql7-editor-comment description explains visible comment typing', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-editor-comment')!;
    expect(step.description).toContain(LESSON7_EDITOR_COMMENT);
    expect(step.description).toContain('Editor');
    expect(step.description).toContain('#');
  });

  it('gql7-one-way description explains Editor-first reading then Builder switch', () => {
    const step = gqlQueryBuilderLesson.steps.find((s) => s.id === 'gql7-one-way')!;
    expect(step.description).toContain('one-way');
    expect(step.description).toContain('selection model');
    expect(step.description).toContain('Generated query');
    expect(step.description).toContain('Editor');
    expect(step.description).toContain('Play');
  });
});
