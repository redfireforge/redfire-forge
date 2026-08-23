/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { selectOption } from '@test-utils/customSelectHelper';
import type { GrpcSchemaDiffChange } from '@shared/grpc/grpcSchemaDiffContracts';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import { computeGrpcStudioSchemaDiffReport } from '../../utils/grpcStudioAdvancedCommands';
import { grpcSchemaDiffChangeId } from '../../utils/grpcSchemaDiffAck';
import { buildAdvancedMock } from '../../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcSchemaDiffPanel } from '../GrpcSchemaDiffPanel';
import { diffChange, makeReport} from './grpcSchemaDiffPanelCoverageGaps.testHelpers';

describe('GrpcSchemaDiffPanel coverage gaps — filters and export', () => {
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

  it('wires header actions, baseline identity, and status error details', () => {
    const captureSchemaBaseline = vi.fn();
    const runSchemaDiff = vi.fn();
    const clearSchemaBaseline = vi.fn();

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          captureSchemaBaseline,
          runSchemaDiff,
          clearSchemaBaseline,
          runtime: {
            ...buildAdvancedMock().runtime,
            schemaDiff: {
              status: 'failed',
              cancellationRequested: true,
              error: { message: 'Descriptor mismatch' },
            },
          },
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: { key: 'protoset:fixture.bin', descriptor: FIXTURE_DESCRIPTOR },
            baselineCapturedAt: '2026-07-01T09:00:00.000Z',
            lastReport: makeReport([], {
              left: 'reflection:grpc.example.com:443:abc',
              right: 'proto:very-long-descriptor-key-that-should-be-truncated-for-display-purposes',
            }),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-diff-capture-baseline'));
    fireEvent.click(screen.getByTestId('grpc-schema-diff-compare-btn'));
    fireEvent.click(screen.getByTestId('grpc-schema-diff-clear-baseline'));
    expect(captureSchemaBaseline).toHaveBeenCalled();
    expect(runSchemaDiff).toHaveBeenCalled();
    expect(clearSchemaBaseline).toHaveBeenCalled();

    expect(screen.getByTestId('grpc-schema-diff-baseline-key').textContent).toMatch(/Reflection/);
    expect(screen.getByTestId('grpc-schema-diff-status').textContent).toMatch(/Descriptor mismatch/);
    expect(screen.getByText(/Proto files|very-long-descriptor-key/)).toBeTruthy();
  });

  it('copies schema diff exports to the clipboard when export text is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          exportSchemaDiffJson: vi.fn(() => '{"changes":[]}'),
          exportSchemaDiffMarkdown: vi.fn(() => '# Schema diff'),
          schemaDiff: {
            severityFilter: 'all',
            lastReport: makeReport([diffChange({ severity: 'breaking', entityPath: 'echo.EchoRequest.id' })]),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-diff-export-json'));
    fireEvent.click(screen.getByTestId('grpc-schema-diff-export-markdown'));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('{"changes":[]}');
    expect(writeText).toHaveBeenCalledWith('# Schema diff');
  });

  it('toggles severity filters from summary cards and the filter select', () => {
    const setSchemaDiffSeverityFilter = vi.fn();
    const report = makeReport([
      diffChange({ severity: 'breaking', entityPath: 'echo.EchoRequest.id', changeType: 'removed' }),
      diffChange({ severity: 'non_breaking', entityPath: 'echo.EchoRequest.note', changeType: 'added' }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EchoService.Echo',
        entityType: 'method',
        changeType: 'doc_comment_changed',
        description: 'rpc documentation updated',
      }),
    ]);

    const { rerender } = render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          setSchemaDiffSeverityFilter,
          schemaDiff: { severityFilter: 'all', lastReport: report },
        })}
      />,
    );

    fireEvent.click(within(screen.getByTestId('grpc-schema-diff-summary')).getByText('Breaking'));
    selectOption(screen.getByTestId('grpc-schema-diff-severity-filter'), 'Non-breaking only');
    expect(setSchemaDiffSeverityFilter).toHaveBeenCalledWith('breaking');

    rerender(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          setSchemaDiffSeverityFilter,
          schemaDiff: { severityFilter: 'breaking', lastReport: report },
        })}
      />,
    );
    fireEvent.click(within(screen.getByTestId('grpc-schema-diff-summary')).getByText('Breaking'));
    fireEvent.click(within(screen.getByTestId('grpc-schema-diff-summary')).getByText('Non-breaking'));
    fireEvent.click(within(screen.getByTestId('grpc-schema-diff-summary')).getByText('Informational'));
    expect(setSchemaDiffSeverityFilter).toHaveBeenCalledWith('all');
    expect(setSchemaDiffSeverityFilter).toHaveBeenCalledWith('non_breaking');
    expect(setSchemaDiffSeverityFilter).toHaveBeenCalledWith('informational');
  });

  it('expands grouped changes and renders snippets, impact notes, and collapse', () => {
    const changes: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoRequest.payload',
        entityType: 'field',
        changeType: 'removed',
        description: 'type message number 3',
        caveat: 'Dropped on the wire.',
      }),
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoService.Echo',
        entityType: 'method',
        changeType: 'renamed',
        description: 'rpc renamed',
      }),
      diffChange({
        severity: 'non_breaking',
        entityPath: 'echo.StatusCode.OK',
        entityType: 'enum_value',
        changeType: 'added',
        description: 'enum value number 1',
        caveat: 'Ignore unknown values.',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EchoResponse',
        entityType: 'message',
        changeType: 'added',
        description: 'message added',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EchoService',
        entityType: 'service',
        changeType: 'modified',
        description: 'service metadata changed',
      }),
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.Priority.HIGH',
        entityType: 'enum',
        changeType: 'removed',
        description: 'enum removed',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiff: {
            severityFilter: 'all',
            lastReport: makeReport(changes, { left: 'proto:files', right: 'protoset:bundle' }),
          },
        })}
      />,
    );

    const removedFieldRow = screen.getByText('echo.EchoRequest.payload').closest('[data-testid="grpc-schema-diff-change-row"]')!;
    fireEvent.click(within(removedFieldRow).getByRole('button', { name: 'Expand change details' }));
    expect(within(removedFieldRow).getByText('Client data loss risk')).toBeTruthy();
    expect(within(removedFieldRow).getByText('Dropped on the wire.')).toBeTruthy();
    fireEvent.click(within(removedFieldRow).getByRole('button', { name: 'Collapse change details' }));

    const renamedMethodRow = screen.getByText('echo.EchoService.Echo').closest('[data-testid="grpc-schema-diff-change-row"]')!;
    fireEvent.click(within(renamedMethodRow).getByRole('button', { name: 'Expand change details' }));
    expect(within(renamedMethodRow).getByText('Breaking change')).toBeTruthy();
    fireEvent.click(within(renamedMethodRow).getByRole('button', { name: 'Collapse change details' }));

    const enumValueRow = screen.getByText('echo.StatusCode.OK').closest('[data-testid="grpc-schema-diff-change-row"]')!;
    fireEvent.click(within(enumValueRow).getByRole('button', { name: 'Expand change details' }));
    expect(within(enumValueRow).getByText('Backward compatible')).toBeTruthy();
    fireEvent.click(within(enumValueRow).getByRole('button', { name: 'Collapse change details' }));
  });

  it('shows the empty-filter hint when no visible changes remain', () => {
    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiff: {
            severityFilter: 'informational',
            lastReport: makeReport([
              diffChange({ severity: 'breaking', entityPath: 'echo.EchoRequest.id', changeType: 'removed' }),
            ]),
          },
        })}
      />,
    );

    expect(screen.getByText(/No changes match the selected filter/i)).toBeTruthy();
  });

  it('renders snippet variants, default labels, and skips empty export copies', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const snippetChanges: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoRequest.noteAdded',
        changeType: 'added',
        description: 'type string',
      }),
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoRequest.noteModified',
        changeType: 'modified',
        description: 'type int32 number 2',
      }),
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoRequest.noteRenamed',
        changeType: 'renamed',
        description: 'type string number 4',
      }),
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoService.OldRpc',
        entityType: 'method',
        changeType: 'removed',
        description: 'rpc removed',
      }),
      diffChange({
        severity: 'non_breaking',
        entityPath: 'echo.EchoService.NewRpc',
        entityType: 'method',
        changeType: 'added',
        description: 'rpc added',
      }),
      diffChange({
        severity: 'non_breaking',
        entityPath: 'echo.EchoService.ModRpc',
        entityType: 'method',
        changeType: 'modified',
        description: 'rpc modified',
      }),
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoService.RenamedRpc',
        entityType: 'method',
        changeType: 'renamed',
        description: 'rpc renamed',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.Status.OFF',
        entityType: 'enum_value',
        changeType: 'removed',
        description: 'enum value OFF',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.OldMessage',
        entityType: 'message',
        changeType: 'removed',
        description: 'message removed',
      }),
      diffChange({
        severity: 'non_breaking',
        entityPath: 'echo.BrandNewMessage',
        entityType: 'message',
        changeType: 'added',
        description: 'message added',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.CustomEntity',
        entityType: 'enum',
        changeType: 'migrated' as GrpcSchemaDiffChange['changeType'],
        description: 'documentation only',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          exportSchemaDiffJson: vi.fn(() => ''),
          exportSchemaDiffMarkdown: vi.fn(() => ''),
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: { key: 'workspace-default-key', descriptor: FIXTURE_DESCRIPTOR },
            lastReport: makeReport(snippetChanges, { left: 'workspace-default-key', right: 'proto:files' }),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-diff-export-json'));
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();

    for (const change of snippetChanges) {
      const row = screen.getByText(change.entityPath).closest('[data-testid="grpc-schema-diff-change-row"]')!;
      fireEvent.click(within(row).getByRole('button', { name: 'Expand change details' }));
      const expectsSnippet = change.entityType === 'field'
        || change.entityType === 'method'
        || change.entityType === 'enum_value'
        || change.entityType === 'message';
      if (expectsSnippet) {
          expect(within(row).getByText('Baseline')).toBeTruthy();
          expect(within(row).getByText('Current')).toBeTruthy();
      } else {
        expect(row.querySelector('.grpc-sdiff-row__action')?.textContent).toContain('Enum changed');
        expect(row.querySelector('.grpc-sdiff-impact__title')?.textContent).toBe('No wire impact');
      }
      fireEvent.click(within(row).getByRole('button', { name: 'Collapse change details' }));
    }
  });

});
