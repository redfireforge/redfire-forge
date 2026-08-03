/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { stubWorkflowSeedBridge } from '../../test-utils/workflowBridgeStubs';
import { kafkaTestRunnerLesson } from './kafka-test-runner';

vi.mock('../setup-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../setup-helpers')>();
  return {
    ...actual,
    ensureKafkaConnected: vi.fn().mockResolvedValue(undefined),
  };
});

describe('kafka-test-runner lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => {
    // Clean up any window globals added by tests
    const win = window as Record<string, unknown>;
    delete win.__wfDeleteByName;
    delete win.__wfInsertWorkflow;
  });

  // ─── Metadata ───────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(kafkaTestRunnerLesson.id).toBe('kafka-test-runner');
    expect(kafkaTestRunnerLesson.domainId).toBe('protocols');
    expect(kafkaTestRunnerLesson.category).toBe('kafka');
    expect(kafkaTestRunnerLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaTestRunnerLesson.initialTab).toBeUndefined();
    expect(kafkaTestRunnerLesson.allowedTabs).toContain('results');
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaTestRunnerLesson.concept.title).toBeTruthy();
    expect(kafkaTestRunnerLesson.concept.body).toBeTruthy();
    expect(kafkaTestRunnerLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaTestRunnerLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 8 steps with unique IDs', () => {
    expect(kafkaTestRunnerLesson.steps.length).toBe(8);
    const ids = kafkaTestRunnerLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaTestRunnerLesson.steps.map((s) => s.id);
    expect(ids).toEqual(['kr-intro', 'kr-pick', 'kr-vars', 'kr-iterations', 'kr-run', 'kr-results', 'kr-dashboard', 'kr-badges']);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaTestRunnerLesson.setup).toBe('function');
    expect(typeof kafkaTestRunnerLesson.cleanup).toBe('function');
  });

  it('has dockerEndpoint configured', () => {
    expect(kafkaTestRunnerLesson.dockerEndpoint).toBeTruthy();
  });

  // ─── Setup ──────────────────────────────────────────────────────

  it('setup connects via API and seeds workflow', async () => {
    const ctx = makeCtx();
    await kafkaTestRunnerLesson.setup!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('setup calls ensureKafkaConnected before seeding workflow', async () => {
    const { ensureKafkaConnected } = await import('../setup-helpers');
    const ctx = makeCtx();
    await kafkaTestRunnerLesson.setup!(ctx);
    expect(ensureKafkaConnected).toHaveBeenCalled();
  });

  it('setup calls __wfDeleteByName and __wfInsertWorkflow when available', async () => {
    const { deleteByName: deleteSpy, insertWorkflow: insertSpy } = stubWorkflowSeedBridge('Kafka Produce Demo');

    const ctx = makeCtx();
    await kafkaTestRunnerLesson.setup!(ctx);

    expect(deleteSpy).toHaveBeenCalledWith('Kafka Produce Demo');
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const inserted = insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.name).toBe('Kafka Produce Demo');
    expect((inserted.nodes as unknown[]).length).toBeGreaterThan(0);
  });

  // ─── Cleanup ─────────────────────────────────────────────────────

  it('cleanup runs without __wfDeleteByName (no-op)', async () => {
    const ctx = makeCtx();
    await kafkaTestRunnerLesson.cleanup!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('cleanup calls __wfDeleteByName when available (line 97)', async () => {
    const deleteSpy = vi.fn();
    (window as Record<string, unknown>).__wfDeleteByName = deleteSpy;

    const ctx = makeCtx();
    await kafkaTestRunnerLesson.cleanup!(ctx);

    expect(deleteSpy).toHaveBeenCalledWith('Kafka Produce Demo');
  });

  // ─── selectKafkaProduceDemo helper ───────────────────────────────

  it('step kr-pick action runs without dropdown in DOM (false branch of if target)', async () => {
    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-pick')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="workflow-select"]');
  });

  it('step kr-pick action clicks matching dropdown item when present (line 111-113)', async () => {
    // Set up a dropdown with a matching Kafka Produce Demo item
    const item = document.createElement('div');
    item.className = 'wfp-dropdown-item';
    item.textContent = 'Kafka Produce Demo';
    document.body.appendChild(item);

    const clickSpy = vi.fn();
    item.addEventListener('click', clickSpy);

    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-pick')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(clickSpy).toHaveBeenCalled();
  });

  // ─── runKafkaWorkflow helper ─────────────────────────────────────

  it('step kr-run action runs without completion section (loops and exits, line 120-124)', async () => {
    // No .completion-section in DOM → the polling loop runs its fixed iterations
    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-run')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('btn-primary'));
  });

  it('step kr-run action breaks loop early when completion section appears (line 122 break)', async () => {
    // Add .completion-section immediately so the first delay → querySelector breaks loop
    const comp = document.createElement('div');
    comp.className = 'completion-section';
    // jsdom does not implement scrollIntoView — add a no-op stub
    comp.scrollIntoView = vi.fn();
    document.body.appendChild(comp);

    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-run')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('btn-primary'));
  });

  // ─── kr-iterations step ──────────────────────────────────────────

  it('step kr-iterations preAction uses DOM traversal to fill labeled inputs', async () => {
    // Create .resilience-field elements with Iterations and Concurrency labels
    const makeField = (labelText: string, value = '1') => {
      const field = document.createElement('div');
      field.className = 'resilience-field';
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'number';
      input.value = value;
      field.appendChild(label);
      field.appendChild(input);
      return { field, input };
    };
    const { field: iterField, input: iterInput } = makeField('Iterations');
    const { field: concField, input: concInput } = makeField('Concurrency');
    document.body.appendChild(iterField);
    document.body.appendChild(concField);

    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-iterations')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(iterInput.value).toBe('3');
    expect(concInput.value).toBe('1');

    document.body.removeChild(iterField);
    document.body.removeChild(concField);
  });

  // ─── kr-dashboard step ───────────────────────────────────────────

  it('step kr-dashboard action navigates to results when link is absent (line 343)', async () => {
    // No .wfp-view-results-btn in DOM → fallback to ctx.navigateToTab('results')
    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-dashboard')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('results');
  });

  it('step kr-dashboard action clicks link when view-results button is present (line 340)', async () => {
    const link = document.createElement('button');
    link.className = 'wfp-view-results-btn';
    const clickSpy = vi.fn();
    link.addEventListener('click', clickSpy);
    document.body.appendChild(link);

    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-dashboard')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('step kr-badges preAction sets flat groupBy view silently (tab click moved to action)', async () => {
    const groupBySelect = document.createElement('select');
    const opt = document.createElement('option');
    opt.value = 'test';
    groupBySelect.appendChild(opt);
    const changeSpy = vi.fn();
    groupBySelect.addEventListener('change', changeSpy);
    const groupWrap = document.createElement('div');
    groupWrap.className = 'group-by-controls';
    groupWrap.appendChild(groupBySelect);
    document.body.appendChild(groupWrap);

    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-badges')!;
    await step.preAction!(makeCtx());

    expect(changeSpy).toHaveBeenCalled();
    expect(groupBySelect.value).toBe('test');
  });

  it('step kr-badges action spotlights Request Details tab then clicks it', async () => {
    const requestTab = document.createElement('button');
    requestTab.id = 'results-tab-requests';
    const tabClickSpy = vi.fn();
    requestTab.addEventListener('click', tabClickSpy);
    document.body.appendChild(requestTab);

    const row = document.createElement('tr');
    row.className = 'clickable-row';
    document.body.appendChild(row);

    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-badges')!;
    await step.action!(makeCtx());

    expect(tabClickSpy).toHaveBeenCalled();
  });

  it('selectKafkaProduceDemo skips click when dropdown item is absent', async () => {
    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-pick')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="workflow-select"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('.wfp-dropdown-panel');
  });

  // ─── All remaining step actions ────────────────────────────────

  it('all steps preActions run without throwing on empty DOM', async () => {
    const ctx = makeCtx();
    for (const step of kafkaTestRunnerLesson.steps) {
      if (step.preAction) {
        await expect(step.preAction(ctx)).resolves.not.toThrow();
      }
    }
  });

  it('all steps actions run without throwing on empty DOM', async () => {
    const ctx = makeCtx();
    for (const step of kafkaTestRunnerLesson.steps) {
      if (step.action) {
        await expect(step.action(ctx)).resolves.not.toThrow();
      }
    }
  });
  it('has Docker badge tag', () => {
    expect(kafkaTestRunnerLesson.tag).toBe('🐳 Docker');
  });

});

