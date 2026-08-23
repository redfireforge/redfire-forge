import { describe, expect, it } from 'vitest';
import type { GrpcDescriptor } from '@shared/grpc/contracts';
import type { GrpcSchemaDiffChange } from '@shared/grpc/grpcSchemaDiffContracts';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import {
  buildChangeDrivenProtoText,
  buildChangeSnippet,
  buildProtoForEntity,
  formatChangeAction,
  formatDescriptorKey,
  getChangeImpact,
  groupChangesByParent,
  isRelatedSchemaDiffPath,
  parseFieldInfo,
  SEVERITY_ORDER,
} from './grpcSchemaDiffPanelUtils';

const RICH_DESCRIPTOR: GrpcDescriptor = {
  ...FIXTURE_DESCRIPTOR,
  services: [
    {
      fullName: 'echo.EchoService',
      methods: [
        {
          name: 'Echo',
          fullName: 'echo.EchoService.Echo',
          callType: 'unary',
          requestTypeName: 'echo.EchoRequest',
          responseTypeName: 'echo.EchoResponse',
          docComment: 'Unary echo',
        },
        {
          name: 'ClientStream',
          fullName: 'echo.EchoService.ClientStream',
          callType: 'client_streaming',
          requestTypeName: 'echo.EchoRequest',
          responseTypeName: 'echo.EchoResponse',
        },
        {
          name: 'BidiStream',
          fullName: 'echo.EchoService.BidiStream',
          callType: 'bidi_streaming',
          requestTypeName: 'echo.EchoRequest',
          responseTypeName: 'echo.EchoResponse',
        },
      ],
    },
  ],
  messageTypes: [
    {
      typeName: 'echo.EchoRequest',
      docComment: 'Request payload',
      fields: [
        { name: 'message', number: 1, type: 'string', label: 'optional', docComment: 'text' },
        {
          name: 'attrs',
          number: 2,
          type: 'string',
          label: 'optional',
          isMap: true,
          mapKeyType: 'string',
        },
        {
          name: 'status',
          number: 3,
          type: 'enum',
          label: 'optional',
          enumTypeName: 'echo.StatusCode',
        },
        {
          name: 'nested',
          number: 4,
          type: 'message',
          label: 'optional',
          messageTypeName: 'echo.EchoResponse',
        },
      ],
    },
    {
      typeName: 'echo.EchoResponse',
      fields: [{ name: 'message', number: 1, type: 'string', label: 'optional' }],
    },
    {
      typeName: 'echo.EmptyMessage',
      fields: [],
    },
  ],
  enumTypes: [
    {
      typeName: 'echo.StatusCode',
      docComment: 'Status codes',
      values: [{ name: 'OK', number: 0 }],
    },
    {
      typeName: 'echo.EmptyEnum',
      values: [],
    },
  ],
};

function change(
  patch: Partial<GrpcSchemaDiffChange> & Pick<GrpcSchemaDiffChange, 'entityPath' | 'severity'>,
): GrpcSchemaDiffChange {
  return {
    entityType: 'field',
    changeType: 'modified',
    description: 'type string',
    ...patch,
  };
}

describe('grpcSchemaDiffPanelUtils coverage gaps', () => {
  it('parses field info and formats descriptor keys', () => {
    expect(parseFieldInfo('type bytes')).toEqual({ fieldType: 'bytes', fieldNumber: undefined });
    expect(parseFieldInfo('type int32 number 7')).toEqual({ fieldType: 'int32', fieldNumber: 7 });
    expect(formatDescriptorKey('reflection:localhost:50051:v1')).toContain('Reflection');
    expect(formatDescriptorKey('protoset:workspace')).toBe('Protoset file');
    expect(formatDescriptorKey('proto:workspace')).toBe('Proto files');
    expect(formatDescriptorKey('x'.repeat(60))).toMatch(/…$/);
    expect(SEVERITY_ORDER.breaking).toBeLessThan(SEVERITY_ORDER.non_breaking);
  });

  it('builds change snippets for fields, methods, enums, and messages', () => {
    expect(buildChangeSnippet(change({
      entityType: 'field',
      entityPath: 'echo.EchoRequest.message',
      changeType: 'modified',
      description: 'type string',
    }))?.before).toContain('message');

    expect(buildChangeSnippet(change({
      entityType: 'field',
      entityPath: 'echo.EchoRequest.removedField',
      changeType: 'removed',
      description: 'type string number 9',
    }))?.after).toContain('removed');

    expect(buildChangeSnippet(change({
      entityType: 'method',
      entityPath: 'echo.EchoService.Echo',
      changeType: 'renamed',
      description: 'renamed',
    }))?.after).toContain('renamed');

    expect(buildChangeSnippet(change({
      entityType: 'enum_value',
      entityPath: 'echo.StatusCode.ARCHIVED',
      changeType: 'added',
      description: 'type enum',
    }))?.after).toContain('ARCHIVED');

    expect(buildChangeSnippet(change({
      entityType: 'message',
      entityPath: 'echo.NewMessage',
      changeType: 'added',
      description: 'added',
    }))?.after).toContain('added');

    expect(buildChangeSnippet(change({
      entityType: 'service',
      entityPath: 'echo.OtherService',
      changeType: 'added',
      description: 'added',
    }))).toBeNull();
  });

  it('formats change actions and impact summaries', () => {
    expect(formatChangeAction(change({
      entityType: 'method',
      entityPath: 'echo.EchoService.Echo',
      changeType: 'doc_comment_changed',
      severity: 'informational',
    }))).toContain('Documentation updated');

    expect(formatChangeAction({
      ...change({
        entityPath: 'echo.EchoRequest.message',
        severity: 'breaking',
      }),
      changeType: 'migrated' as never,
      entityType: 'custom' as never,
    })).toContain('custom changed');

    expect(getChangeImpact(change({
      entityPath: 'echo.EchoRequest.message',
      severity: 'breaking',
      changeType: 'removed',
      caveat: 'custom caveat',
    }))).toMatchObject({ title: 'Client data loss risk', body: 'custom caveat' });

    expect(getChangeImpact(change({
      entityPath: 'echo.EchoRequest.message',
      severity: 'breaking',
      changeType: 'modified',
    }))).toMatchObject({ title: 'Breaking change' });

    expect(getChangeImpact(change({
      entityPath: 'echo.EchoRequest.message',
      severity: 'non_breaking',
      changeType: 'added',
      caveat: 'safe add',
    }))).toMatchObject({ body: 'safe add' });

    expect(getChangeImpact(change({
      entityPath: 'echo.EchoRequest.message',
      severity: 'informational',
      changeType: 'doc_comment_changed',
      caveat: 'docs only',
    }))).toMatchObject({ body: 'docs only' });
  });

  it('builds proto text for entities and fuzzy suffix matches', () => {
    expect(buildProtoForEntity(null, 'echo.EchoRequest')).toContain('not available');
    expect(buildProtoForEntity(RICH_DESCRIPTOR, 'echo.EchoRequest')).toContain('message EchoRequest');
    expect(buildProtoForEntity(RICH_DESCRIPTOR, 'echo.EchoService')).toContain('rpc Echo');
    expect(buildProtoForEntity(RICH_DESCRIPTOR, 'echo.StatusCode')).toContain('enum StatusCode');
    expect(buildProtoForEntity(RICH_DESCRIPTOR, 'EchoRequest')).toContain('message EchoRequest');
    expect(buildProtoForEntity(RICH_DESCRIPTOR, 'missing.Entity')).toContain('not found');
  });

  it('builds change-driven proto text for both sides', () => {
    const changes: GrpcSchemaDiffChange[] = [
      change({
        entityPath: 'echo.EchoRequest.addedField',
        changeType: 'added',
        description: 'type string number 8',
      }),
      change({
        entityPath: 'echo.EchoRequest.removedField',
        changeType: 'removed',
        description: 'type string number 9',
      }),
      change({
        entityPath: 'echo.EchoRequest.message',
        changeType: 'modified',
        description: 'type string number 1',
      }),
    ];

    expect(buildChangeDrivenProtoText('echo.Unrelated', changes, 'before')).toBeNull();
    expect(buildChangeDrivenProtoText('echo.EchoRequest', changes, 'before')).toContain('removedField');
    expect(buildChangeDrivenProtoText('echo.EchoRequest', changes, 'after')).toContain('addedField');
    expect(buildChangeDrivenProtoText('echo.EchoRequest', [{
      ...changes[0]!,
      changeType: 'added',
    }], 'before')).toContain('no fields on this side');
  });

  it('groups related paths and parent changes', () => {
    expect(isRelatedSchemaDiffPath('echo.EchoRequest', 'echo.EchoRequest.message')).toBe(true);
    expect(isRelatedSchemaDiffPath('echo.EchoRequest.message', 'echo.EchoRequest')).toBe(true);
    expect(isRelatedSchemaDiffPath('echo.A', 'echo.B')).toBe(false);

    const grouped = groupChangesByParent([
      change({ entityPath: 'echo.EchoRequest.message', severity: 'breaking' }),
      change({ entityPath: 'echo.EchoRequest.tags', severity: 'non_breaking' }),
      change({ entityPath: 'echo.EchoService', entityType: 'service', severity: 'informational' }),
    ]);
    expect(grouped.find((group) => group.key === 'echo.EchoRequest')?.changes).toHaveLength(2);
  });
});
