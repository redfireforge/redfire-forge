/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  mockWorkflows,
  wfWebhookStart,
  wfWebhookMid,
  wfWebhookBranchingStart,
  wfCorr,
  wfPoll,
  wfKafkaWaitForReal,
  wfKafkaAutoResume,
  wfKafkaNoLoadBehavior,
  wfKafkaSyntheticInject,
  wfKafkaMixed,
  allWorkflowVariants,
  wfIdToName,
  selectWorkflowById,
  makeSummary,
  MultiWebhookStub,
} from './workflowRunnerTestHelpers';

describe('workflowRunnerTestHelpers coverage gaps', () => {
  it('exports canonical workflow variants and id/name mapping', () => {
    expect(mockWorkflows).toHaveLength(2);
    expect(wfWebhookStart.id).toBe('wf-wh');
    expect(wfWebhookMid.id).toBe('wf-wh-mid');
    expect(wfWebhookBranchingStart.id).toBe('wf-wh-branch');
    expect(wfCorr.id).toBe('wf-corr');
    expect(wfPoll.id).toBe('wf-poll');
    expect(wfKafkaWaitForReal.id).toBe('wf-kafka-wfr');
    expect(wfKafkaAutoResume.id).toBe('wf-kafka-ar');
    expect(wfKafkaNoLoadBehavior.id).toBe('wf-kafka-nlb');
    expect(wfKafkaSyntheticInject.id).toBe('wf-kafka-si');
    expect(wfKafkaMixed.id).toBe('wf-kafka-mixed');
    expect((wfKafkaMixed.nodes[0] as any).data.topic).toBe('orders');
    expect((wfKafkaMixed.nodes[0] as any).data.loadTestBehavior.mode).toBe('wait-for-real');
    expect((wfKafkaMixed.nodes[1] as any).data.topic).toBe('signals');

    expect(allWorkflowVariants.length).toBeGreaterThan(5);
    expect(wfIdToName['wf1']).toBe('Test Workflow');
  });

  it('selectWorkflowById clicks valid workflow and throws on unknown id', () => {
    const onTrigger = vi.fn();
    const onItem = vi.fn();
    render(
      <div>
        <button type="button" data-testid="workflow-select" onClick={onTrigger}>select</button>
        <button type="button" onClick={onItem}>Test Workflow</button>
      </div>,
    );

    selectWorkflowById('wf1');
    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(onItem).toHaveBeenCalledTimes(1);

    expect(() => selectWorkflowById('missing-id')).toThrow('Unknown workflow id in test helper');
  });

  it('makeSummary applies overrides and MultiWebhookStub optional callbacks', async () => {
    const summary = makeSummary({ totalRequests: 9, failedRequests: 2 });
    expect(summary.totalRequests).toBe(9);
    expect(summary.failedRequests).toBe(2);
    expect(summary.tps).toBe(1);

    const onSaveScenario = vi.fn();
    const onDeleteScenario = vi.fn();
    const onFireWebhook = vi.fn().mockResolvedValue(undefined);

    const withHandlers = render(
      <MultiWebhookStub
        workflow={mockWorkflows[0]!}
        isRunning={false}
        onSaveScenario={onSaveScenario}
        onDeleteScenario={onDeleteScenario}
        onFireWebhook={onFireWebhook}
      />,
    );

    fireEvent.click(withHandlers.getByTestId('stub-save-webhook-scenario'));
    fireEvent.click(withHandlers.getByTestId('stub-delete-webhook-scenario'));
    fireEvent.click(withHandlers.getByTestId('stub-fire-webhook'));

    expect(onSaveScenario).toHaveBeenCalledTimes(1);
    expect(onDeleteScenario).toHaveBeenCalledWith('sc-1');
    expect(onFireWebhook).toHaveBeenCalledWith('cw-node', 'corr-1', { x: true });

    // Cover unknown-node catch branch on rejected promise.
    const rejectFire = vi.fn().mockRejectedValue(new Error('boom'));
    const rejectView = render(
      <MultiWebhookStub workflow={mockWorkflows[0]!} isRunning={false} onFireWebhook={rejectFire} />,
    );
    fireEvent.click(within(rejectView.container).getByTestId('stub-fire-webhook-unknown-node'));
    await Promise.resolve();
    expect(rejectFire).toHaveBeenCalledWith('definitely-unknown-node-id', 'c', {});

    // Cover optional-callback no-op branches.
    const noHandlers = render(<MultiWebhookStub workflow={mockWorkflows[0]!} isRunning={false} />);
    const noHandlerQueries = within(noHandlers.container);
    fireEvent.click(noHandlerQueries.getByTestId('stub-save-webhook-scenario'));
    fireEvent.click(noHandlerQueries.getByTestId('stub-delete-webhook-scenario'));
    fireEvent.click(noHandlerQueries.getByTestId('stub-fire-webhook'));
    fireEvent.click(noHandlerQueries.getByTestId('stub-fire-webhook-unknown-node'));
  });
});
