/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { GrpcSchemaDiffChange } from '../../../../shared/grpc/grpcSchemaDiffContracts';
import { FIXTURE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';
import { buildAdvancedMock } from '../../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcSchemaDiffPanel } from '../GrpcSchemaDiffPanel';
import { diffChange, makeReport, RICH_DESCRIPTOR } from './grpcSchemaDiffPanelCoverageGaps.testHelpers';

describe('GrpcSchemaDiffPanel coverage gaps — proto preview', () => {
  it('opens proto preview modal from grouped changes and closes via button or Escape', () => {
    const changes: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoRequest.message',
        entityType: 'field',
        changeType: 'modified',
        description: 'type string number 1',
      }),
      diffChange({
        severity: 'non_breaking',
        entityPath: 'echo.EchoRequest.tags',
        entityType: 'field',
        changeType: 'added',
        description: 'type string number 2',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          activeDescriptor: RICH_DESCRIPTOR,
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: RICH_DESCRIPTOR,
            lastReport: makeReport(changes, { left: 'proto:baseline', right: 'proto:current' }),
          },
        })}
      />,
    );

  expect(screen.getByTestId('grpc-sdiff-group-proto-badge').textContent?.toLowerCase()).toContain('proto diff');
  fireEvent.click(screen.getByTestId('grpc-sdiff-group-proto-btn'));
    expect(screen.getByTestId('grpc-sdiff-proto-modal')).toBeTruthy();
    expect(screen.getByTestId('grpc-sdiff-proto-before').textContent).toMatch(/message EchoRequest/);
    expect(screen.getByTestId('grpc-sdiff-proto-after').textContent).toMatch(/message EchoRequest/);

    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));
    expect(screen.queryByTestId('grpc-sdiff-proto-modal')).toBeNull();

    fireEvent.click(screen.getByTestId('grpc-sdiff-group-proto-btn'));
    expect(screen.getByTestId('grpc-sdiff-proto-modal')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('grpc-sdiff-proto-modal')).toBeNull();
  });

  it('shows derived proto view when report changes contradict identical descriptor snapshots', () => {
    const contradictoryChanges: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoRequest.message',
        entityType: 'field',
        changeType: 'removed',
        description: 'type string number 1',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EchoRequest.text',
        entityType: 'field',
        changeType: 'added',
        description: 'type string number 2',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          activeDescriptor: RICH_DESCRIPTOR,
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: RICH_DESCRIPTOR,
            lastReport: makeReport(contradictoryChanges, { left: 'proto:baseline', right: 'proto:current' }),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-sdiff-group-proto-btn'));
    expect(screen.getByTestId('grpc-sdiff-proto-derived-warning').textContent).toMatch(/change-focused proto view/i);
    expect(screen.getByTestId('grpc-sdiff-proto-before').textContent).toMatch(/string message = 1;/);
    expect(screen.getByTestId('grpc-sdiff-proto-after').textContent).toMatch(/string text = 2;/);
    expect(screen.getByTestId('grpc-sdiff-proto-after').textContent).not.toMatch(/string message = 1;/);
  });

  it('renders proto preview for service, enum, fuzzy match, and missing entities', () => {
    const changes: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EchoService.Echo',
        entityType: 'method',
        changeType: 'modified',
        description: 'rpc modified',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.StatusCode.OK',
        entityType: 'enum_value',
        changeType: 'added',
        description: 'enum value number 1',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'EchoRequest.message',
        entityType: 'field',
        changeType: 'modified',
        description: 'type string number 1',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.MissingEntity.note',
        entityType: 'field',
        changeType: 'added',
        description: 'type string number 1',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          activeDescriptor: RICH_DESCRIPTOR,
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: undefined,
            lastReport: makeReport(changes),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText('echo.EchoService').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    expect(screen.getByTestId('grpc-sdiff-proto-before').textContent).toMatch(/Descriptor not available/);
    expect(screen.getByTestId('grpc-sdiff-proto-after').textContent).toMatch(/service EchoService/);
    expect(screen.getByTestId('grpc-sdiff-proto-after').textContent).toMatch(/stream EchoRequest/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));

    fireEvent.click(screen.getByText('echo.StatusCode').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    expect(screen.getByTestId('grpc-sdiff-proto-after').textContent).toMatch(/enum StatusCode/);
    expect(screen.getByTestId('grpc-sdiff-proto-after').textContent).toMatch(/OK = 0/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));

    fireEvent.click(screen.getByText('EchoRequest').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    expect(screen.getByTestId('grpc-sdiff-proto-after').textContent).toMatch(/message EchoRequest/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));

    fireEvent.click(screen.getByText('echo.MissingEntity').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    expect(screen.getByTestId('grpc-sdiff-proto-after').textContent).toMatch(/not found in this descriptor/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));
  });

  it('renders empty message and enum proto bodies plus protoset identity labels', () => {
    const emptyDescriptor: GrpcDescriptor = {
      ...RICH_DESCRIPTOR,
      messageTypes: [RICH_DESCRIPTOR.messageTypes!.find((m) => m.typeName === 'echo.EmptyMessage')!],
      enumTypes: [RICH_DESCRIPTOR.enumTypes!.find((e) => e.typeName === 'echo.EmptyEnum')!],
    };
    const changes: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EmptyMessage.placeholder',
        entityType: 'field',
        changeType: 'added',
        description: 'type string number 1',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EmptyEnum.PLACEHOLDER',
        entityType: 'enum_value',
        changeType: 'added',
        description: 'enum value number 1',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          activeDescriptor: emptyDescriptor,
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: emptyDescriptor,
            baselineCapturedAt: '2026-07-01T09:00:00.000Z',
            lastReport: makeReport(changes, {
              left: 'protoset:fixture.bin',
              right: 'workspace-default-key-with-more-than-forty-eight-characters-for-truncation',
            }),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText('echo.EmptyMessage').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    expect(screen.getByTestId('grpc-sdiff-proto-before').textContent).toMatch(/no fields/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));

    fireEvent.click(screen.getByText('echo.EmptyEnum').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    expect(screen.getByTestId('grpc-sdiff-proto-before').textContent).toMatch(/no values/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));

    expect(screen.getByTestId('grpc-schema-diff-baseline-key').textContent).toMatch(/Protoset file/);
    expect(screen.getByText(/workspace-default-key-with-more-than-forty-ei/)).toBeTruthy();
  });

  it('covers doc-comment actions, default impact text, and field snippets without numbers', () => {
    const changes: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EchoService.Echo',
        entityType: 'method',
        changeType: 'doc_comment_changed',
        description: 'rpc documentation updated',
      }),
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoRequest.renamedField',
        entityType: 'field',
        changeType: 'renamed',
        description: 'type string',
      }),
      diffChange({
        severity: 'non_breaking',
        entityPath: 'echo.StatusCode.NEW',
        entityType: 'enum_value',
        changeType: 'added',
        description: 'enum value NEW',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.Custom',
        entityType: 'enum',
        changeType: 'migrated' as GrpcSchemaDiffChange['changeType'],
        description: 'custom change',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiff: {
            severityFilter: 'all',
            lastReport: makeReport(changes),
          },
        })}
      />,
    );

    for (const change of changes) {
      const row = screen.getByText(change.entityPath).closest('[data-testid="grpc-schema-diff-change-row"]')!;
      fireEvent.click(within(row).getByRole('button', { name: 'Expand change details' }));
      if (change.changeType === 'doc_comment_changed') {
        expect(within(row).getByText(/Documentation updated/)).toBeTruthy();
        expect(within(row).getByText(/No wire impact/)).toBeTruthy();
        expect(within(row).getByText(/metadata or documentation change/)).toBeTruthy();
      } else if (change.entityType === 'field' && change.changeType === 'renamed') {
        expect(within(row).getByText(/Breaking change/)).toBeTruthy();
        expect(within(row).getByText(/not backward-compatible/)).toBeTruthy();
      } else if (change.entityType === 'enum_value') {
        expect(within(row).getByText(/Backward compatible/)).toBeTruthy();
        expect(within(row).getByText(/safely ignore it/)).toBeTruthy();
      } else {
        expect(within(row).getByText(/Enum changed/)).toBeTruthy();
      }
      fireEvent.click(within(row).getByRole('button', { name: 'Collapse change details' }));
    }
  });

  it('formats plain descriptor keys, omits grouped headers for root entities, and covers proto edge branches', () => {
    const streamingDescriptor: GrpcDescriptor = {
      ...RICH_DESCRIPTOR,
      services: [
        {
          fullName: 'stream.StreamService',
          methods: [
            {
              name: 'ClientOnly',
              callType: 'client_streaming',
              requestTypeName: 'stream.ClientRequest',
              responseTypeName: 'stream.ClientResponse',
            },
            {
              name: 'ServerOnly',
              callType: 'server_streaming',
              requestTypeName: 'stream.ServerRequest',
              responseTypeName: 'stream.ServerResponse',
            },
          ],
        },
      ],
      messageTypes: [
        {
          typeName: 'stream.ClientRequest',
          fields: [{ name: 'payload', number: 1, type: 'string', label: 'optional' }],
        },
      ],
    };
    const rootOnlyChanges: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'informational',
        entityPath: 'RootEntity',
        entityType: 'message',
        changeType: 'added',
        description: 'message added',
      }),
    ];
    const streamingChanges: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'informational',
        entityPath: 'stream.StreamService.ClientOnly',
        entityType: 'method',
        changeType: 'modified',
        description: 'rpc modified',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'stream.StreamService.ServerOnly',
        entityType: 'method',
        changeType: 'modified',
        description: 'rpc modified',
      }),
    ];

    const { rerender } = render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiff: {
            severityFilter: 'all',
            lastReport: makeReport(rootOnlyChanges, {
              left: 'reflection:localhost:50051:abc123',
              right: 'plain-long-descriptor-key-without-known-prefix-and-extra-characters',
            }),
          },
        })}
      />,
    );

    expect(screen.queryByTestId('grpc-sdiff-group-proto-btn')).toBeNull();
    expect(screen.getByText(/Reflection · localhost:50051/)).toBeTruthy();
    expect(screen.getByText(/plain-long-descriptor-key-without-known-prefi/)).toBeTruthy();

    const rootRow = screen.getByText('RootEntity').closest('[data-testid="grpc-schema-diff-change-row"]')!;
    fireEvent.click(within(rootRow).getByRole('button', { name: 'Expand change details' }));
    expect(within(rootRow).getByText('Baseline')).toBeTruthy();
    expect(within(rootRow).getByText(/no RootEntity/)).toBeTruthy();
    fireEvent.click(within(rootRow).getByRole('button', { name: 'Collapse change details' }));

    rerender(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          activeDescriptor: streamingDescriptor,
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: streamingDescriptor,
            lastReport: makeReport(streamingChanges),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText('stream.StreamService').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    const afterText = screen.getByTestId('grpc-sdiff-proto-after').textContent ?? '';
    expect(afterText).toMatch(/stream ClientRequest/);
    expect(afterText).toMatch(/stream ServerResponse/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));
  });

  it('renders full message proto with map, enum, message, and repeated field labels', () => {
    const changes: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EchoRequest.message',
        entityType: 'field',
        changeType: 'doc_comment_changed',
        description: 'documentation updated',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          activeDescriptor: RICH_DESCRIPTOR,
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: RICH_DESCRIPTOR,
            lastReport: makeReport(changes),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText('echo.EchoRequest').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    const protoText = screen.getByTestId('grpc-sdiff-proto-after').textContent ?? '';
    expect(protoText).toMatch(/repeated string tags/);
    expect(protoText).toMatch(/EchoResponse nested/);
    expect(protoText).toMatch(/StatusCode status/);
    expect(protoText).toMatch(/map<string, string> attrs/);
    expect(protoText).toMatch(/map<string, StatusCode> flags/);
    expect(protoText).toMatch(/map<string, EchoResponse> children/);
    expect(protoText).toMatch(/\/\/ Echo request/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));
  });

  it('fuzzy-matches service and enum entities when exact descriptor paths differ', () => {
    const changes: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'informational',
        entityPath: 'EchoService.Echo',
        entityType: 'method',
        changeType: 'doc_comment_changed',
        description: 'rpc documentation updated',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'StatusCode.OK',
        entityType: 'enum_value',
        changeType: 'doc_comment_changed',
        description: 'enum value documentation updated',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          activeDescriptor: RICH_DESCRIPTOR,
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: RICH_DESCRIPTOR,
            lastReport: makeReport(changes),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText('EchoService').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    const serviceProto = screen.getByTestId('grpc-sdiff-proto-after').textContent ?? '';
    expect(serviceProto).toMatch(/service EchoService/);
    expect(serviceProto).toMatch(/stream EchoRequest/);
    expect(serviceProto).toMatch(/\/\/ Unary echo RPC/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));

    fireEvent.click(screen.getByText('StatusCode').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    const enumProto = screen.getByTestId('grpc-sdiff-proto-after').textContent ?? '';
    expect(enumProto).toMatch(/enum StatusCode/);
    expect(enumProto).toMatch(/\/\/ Status codes/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));
  });

  it('prefers the shortest fuzzy descriptor match when suffix scores tie', () => {
    const collisionDescriptor: GrpcDescriptor = {
      ...RICH_DESCRIPTOR,
      messageTypes: [
        ...(RICH_DESCRIPTOR.messageTypes ?? []),
        {
          typeName: 'echo.EchoRequest',
          fields: [{ name: 'message', number: 1, type: 'string', label: 'optional' }],
        },
        {
          typeName: 'other.prefix.EchoRequest',
          fields: [{ name: 'payload', number: 1, type: 'string', label: 'optional' }],
        },
      ],
    };
    const changes: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'informational',
        entityPath: 'EchoRequest.note',
        entityType: 'field',
        changeType: 'doc_comment_changed',
        description: 'documentation updated',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          activeDescriptor: collisionDescriptor,
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: collisionDescriptor,
            lastReport: makeReport(changes),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText('EchoRequest').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    expect(screen.getByTestId('grpc-sdiff-proto-after').textContent).toMatch(/message EchoRequest/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));
  });

  it('shows bidi streaming rpc signatures in proto preview', () => {
    const bidiDescriptor: GrpcDescriptor = {
      ...RICH_DESCRIPTOR,
      services: [
        {
          fullName: 'echo.EchoService',
          methods: [
            {
              name: 'BidiChat',
              callType: 'bidi_streaming',
              requestTypeName: 'echo.EchoRequest',
              responseTypeName: 'echo.EchoResponse',
              docComment: 'Bidirectional chat',
            },
          ],
        },
      ],
    };
    const changes: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EchoService.BidiChat',
        entityType: 'method',
        changeType: 'modified',
        description: 'rpc modified',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          activeDescriptor: bidiDescriptor,
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: bidiDescriptor,
            lastReport: makeReport(changes),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText('echo.EchoService').closest('[data-testid="grpc-sdiff-group-proto-btn"]')!);
    const serviceProto = screen.getByTestId('grpc-sdiff-proto-after').textContent ?? '';
    expect(serviceProto).toMatch(/stream EchoRequest.*stream EchoResponse/);
    expect(serviceProto).toMatch(/\/\/ Bidirectional chat/);
    fireEvent.click(screen.getByTestId('grpc-sdiff-proto-modal-close'));
  });

  it('uses baseline identity without report and optional acknowledgment helpers', () => {
    const report = makeReport([
      diffChange({ severity: 'non_breaking', entityPath: 'echo.EchoRequest.note', changeType: 'added' }),
    ]);

    const { rerender } = render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiffAckChangeIds: undefined,
          isSchemaDiffChangeAcknowledged: undefined,
          schemaDiff: {
            severityFilter: 'non_breaking',
            hideAcknowledged: true,
            baselineDescriptor: { key: 'proto:workspace', descriptor: FIXTURE_DESCRIPTOR },
            baselineCapturedAt: '2026-07-01T09:00:00.000Z',
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-schema-diff-baseline-key').textContent).toMatch(/Proto files/);
    expect(screen.queryByTestId('grpc-schema-diff-results')).toBeNull();

    rerender(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiffAckChangeIds: undefined,
          isSchemaDiffChangeAcknowledged: undefined,
          schemaDiff: {
            severityFilter: 'non_breaking',
            hideAcknowledged: true,
            lastReport: report,
          },
        })}
      />,
    );

    expect(
      within(screen.getByTestId('grpc-schema-diff-summary')).getByText('Non-breaking').closest('button')!.className,
    ).toContain('grpc-sdiff-card--active');
    expect(screen.getByTestId('grpc-schema-diff-ack-btn').textContent).toMatch(/Acknowledge/);
  });

  it('covers snippet fallbacks for missing field metadata and enum values without numbers', () => {
    const changes: GrpcSchemaDiffChange[] = [
      diffChange({
        severity: 'breaking',
        entityPath: 'echo.EchoRequest.legacy',
        entityType: 'field',
        changeType: 'added',
        description: 'field added',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.StatusCode.OFF',
        entityType: 'enum_value',
        changeType: 'removed',
        description: 'enum value OFF',
      }),
      diffChange({
        severity: 'informational',
        entityPath: 'echo.EchoRequest.docOnly',
        entityType: 'field',
        changeType: 'doc_comment_changed',
        description: 'documentation updated',
      }),
    ];

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiff: {
            severityFilter: 'all',
            hideAcknowledged: true,
            lastReport: makeReport(changes),
          },
        })}
      />,
    );

    for (const change of changes) {
      const row = screen.getByText(change.entityPath).closest('[data-testid="grpc-schema-diff-change-row"]')!;
      fireEvent.click(within(row).getByRole('button', { name: 'Expand change details' }));
      if (change.entityType === 'field' && change.changeType === 'added') {
        expect(within(row).getByText(/TYPE legacy/)).toBeTruthy();
      } else if (change.entityType === 'enum_value') {
        expect(within(row).getByText(/OFF;/)).toBeTruthy();
      } else {
        expect(within(row).queryByText('Baseline')).toBeNull();
      }
      fireEvent.click(within(row).getByRole('button', { name: 'Collapse change details' }));
    }
  });
});
