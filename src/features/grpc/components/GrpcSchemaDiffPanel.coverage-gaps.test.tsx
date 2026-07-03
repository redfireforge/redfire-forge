/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { computeGrpcStudioSchemaDiffReport } from '../utils/grpcStudioAdvancedCommands';
import { grpcSchemaDiffChangeId } from '../utils/grpcSchemaDiffAck';
import { buildAdvancedMock, FIXTURE_DESCRIPTOR } from '../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcSchemaDiffPanel } from './GrpcSchemaDiffPanel';

describe('GrpcSchemaDiffPanel coverage gaps', () => {
  it('toggles hide-acknowledged filter and acknowledges changes', async () => {
    const setSchemaDiffHideAcknowledged = vi.fn();
    const acknowledgeSchemaDiffChange = vi.fn().mockResolvedValue(undefined);
    const unacknowledgeSchemaDiffChange = vi.fn().mockResolvedValue(undefined);

    const candidate = structuredClone(FIXTURE_DESCRIPTOR);
    candidate.services[0]!.methods[0]!.name = 'EchoRenamed';
    const report = computeGrpcStudioSchemaDiffReport({
      baseline: FIXTURE_DESCRIPTOR,
      candidate,
    });
    const change = report.changes[0]!;
    const changeId = grpcSchemaDiffChangeId(change);

    const { rerender } = render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          setSchemaDiffHideAcknowledged,
          acknowledgeSchemaDiffChange,
          unacknowledgeSchemaDiffChange,
          isSchemaDiffChangeAcknowledged: vi.fn(() => false),
          schemaDiff: {
            severityFilter: 'all',
            hideAcknowledged: false,
            lastReport: report,
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-diff-hide-acknowledged'));
    expect(setSchemaDiffHideAcknowledged).toHaveBeenCalledWith(true);

    const targetRow = screen.getByText(change.entityPath).closest('[data-testid="grpc-schema-diff-change-row"]')!;
    fireEvent.click(targetRow.querySelector('[data-testid="grpc-schema-diff-ack-btn"]')!);
    await Promise.resolve();
    expect(acknowledgeSchemaDiffChange).toHaveBeenCalledWith(change);

    rerender(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          unacknowledgeSchemaDiffChange,
          isSchemaDiffChangeAcknowledged: vi.fn((entry) => entry.entityPath === change.entityPath),
          schemaDiffAckChangeIds: new Set([changeId]),
          schemaDiff: {
            severityFilter: 'all',
            hideAcknowledged: false,
            lastReport: report,
          },
        })}
      />,
    );

    const ackRow = screen.getByText(change.entityPath).closest('[data-testid="grpc-schema-diff-change-row"]')!;
    expect(ackRow.textContent).toMatch(/Unacknowledge/);
    fireEvent.click(ackRow.querySelector('[data-testid="grpc-schema-diff-ack-btn"]')!);
    await Promise.resolve();
    expect(unacknowledgeSchemaDiffChange).toHaveBeenCalledWith(expect.objectContaining({
      entityPath: change.entityPath,
      changeType: change.changeType,
    }));
  });

  it('shows export error without baseline chips', () => {
    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          advancedExportError: 'Export buffer overflow',
          schemaDiff: {
            severityFilter: 'informational',
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-schema-diff-baseline-key').textContent).toMatch(/not captured/i);
    expect(screen.queryByTestId('grpc-schema-diff-clear-baseline')).toBeNull();
    expect(screen.getByTestId('grpc-schema-diff-export-error').textContent).toMatch(/overflow/i);
  });

  it('handles virtualized list scroll updates for large reports', () => {
    const candidate = structuredClone(FIXTURE_DESCRIPTOR);
    candidate.services[0]!.methods[0]!.name = 'EchoRenamedVirtualized';
    const report = computeGrpcStudioSchemaDiffReport({
      baseline: FIXTURE_DESCRIPTOR,
      candidate,
    });
    const baseChange = report.changes[0]!;
    const manyChanges = Array.from({ length: 130 }, (_, index) => ({
      ...baseChange,
      entityPath: `${baseChange.entityPath}.${index}`,
    }));

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiff: {
            severityFilter: 'all',
            hideAcknowledged: false,
            lastReport: {
              ...report,
              changes: manyChanges,
              summary: {
                ...report.summary,
                total: manyChanges.length,
              },
            },
          },
        })}
      />,
    );

    const list = screen.getByTestId('grpc-schema-diff-change-list');
    expect(list.className).toContain('grpc-advanced-diff-list--virtual');
    fireEvent.scroll(list, { target: { scrollTop: 180 } });
    expect(screen.getAllByTestId('grpc-schema-diff-change-row').length).toBeGreaterThan(0);
  });
});
