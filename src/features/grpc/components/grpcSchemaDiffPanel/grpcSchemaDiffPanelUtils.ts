import type {
  GrpcSchemaDiffChange,
  GrpcSchemaDiffEntityType,
  GrpcSchemaDiffSeverity,
} from '@shared/grpc/grpcSchemaDiffContracts';
import type {
  GrpcDescriptor,
  GrpcMessageSchema,
  GrpcFieldSchema,
  GrpcEnumSchema,
  GrpcServiceInfo,
} from '@shared/grpc/contracts';

const ENTITY_TYPE_LABELS: Record<GrpcSchemaDiffEntityType, string> = {
  service: 'Service',
  method: 'RPC method',
  message: 'Message',
  field: 'Field',
  enum: 'Enum',
  enum_value: 'Enum value',
};

export const SEVERITY_ORDER: Record<GrpcSchemaDiffSeverity, number> = {
  breaking: 0,
  non_breaking: 1,
  informational: 2,
};

export function parseFieldInfo(description: string): { fieldType: string; fieldNumber: number | undefined } {
  const typeMatch = description.match(/\btype\s+(\w+)/i);
  const numMatch = description.match(/\bnumber\s+(\d+)/i);
  return {
    fieldType: typeMatch?.[1] ?? 'TYPE',
    fieldNumber: numMatch ? parseInt(numMatch[1]!, 10) : undefined,
  };
}

export function buildChangeSnippet(
  change: GrpcSchemaDiffChange,
): { before: string; after: string } | null {
  const parts = change.entityPath.split('.');
  const leafName = parts[parts.length - 1] ?? change.entityPath;
  const parentShort = parts.length > 1 ? parts[parts.length - 2]! : parts[0]!;

  if (change.entityType === 'field') {
    const { fieldType, fieldNumber } = parseFieldInfo(change.description);
    const fieldDecl = `  ${fieldType} ${leafName}${fieldNumber !== undefined ? ` = ${fieldNumber}` : ''};`;
    if (change.changeType === 'removed') {
      return {
        before: `message ${parentShort} {\n  // ...\n${fieldDecl}\n}`,
        after: `message ${parentShort} {\n  // ...\n  // ← ${leafName} removed\n}`,
      };
    }
    if (change.changeType === 'added') {
      return {
        before: `message ${parentShort} {\n  // ...\n}`,
        after: `message ${parentShort} {\n  // ...\n${fieldDecl}  // ← added\n}`,
      };
    }
    if (change.changeType === 'modified' || change.changeType === 'renamed') {
      return {
        before: `message ${parentShort} {\n  // ... ${leafName}\n}`,
        after: `message ${parentShort} {\n  // ... ${leafName} (${change.changeType})\n}`,
      };
    }
  }

  if (change.entityType === 'method') {
    if (change.changeType === 'removed') {
      return {
        before: `service ${parentShort} {\n  rpc ${leafName}(\u2026) returns (\u2026);\n}`,
        after: `service ${parentShort} {\n  // \u2190 ${leafName} removed\n}`,
      };
    }
    if (change.changeType === 'added') {
      return {
        before: `service ${parentShort} {\n  // ...\n}`,
        after: `service ${parentShort} {\n  rpc ${leafName}(\u2026) returns (\u2026); // \u2190 added\n}`,
      };
    }
    if (change.changeType === 'modified') {
      return {
        before: `service ${parentShort} {\n  rpc ${leafName}(\u2026) returns (\u2026);\n}`,
        after: `service ${parentShort} {\n  rpc ${leafName}(\u2026) returns (\u2026); // modified\n}`,
      };
    }
    if (change.changeType === 'renamed') {
      return {
        before: `service ${parentShort} {\n  rpc ${leafName}(\u2026) returns (\u2026);\n}`,
        after: `service ${parentShort} {\n  // \u2190 ${leafName} was renamed\n}`,
      };
    }
  }

  if (change.entityType === 'enum_value') {
    const { fieldNumber } = parseFieldInfo(change.description);
    const valueDecl = `  ${leafName.toUpperCase()}${fieldNumber !== undefined ? ` = ${fieldNumber}` : ''};`;
    if (change.changeType === 'removed') {
      return {
        before: `enum ${parentShort} {\n  // ...\n${valueDecl}\n}`,
        after: `enum ${parentShort} {\n  // ...\n  // \u2190 ${leafName} removed\n}`,
      };
    }
    if (change.changeType === 'added') {
      return {
        before: `enum ${parentShort} {\n  // ...\n}`,
        after: `enum ${parentShort} {\n  // ...\n${valueDecl}  // \u2190 added\n}`,
      };
    }
  }

  if (change.entityType === 'message') {
    if (change.changeType === 'removed') {
      return {
        before: `message ${leafName} {\n  // \u2026\n}`,
        after: `// \u2190 message ${leafName} removed`,
      };
    }
    if (change.changeType === 'added') {
      return {
        before: `// (no ${leafName})`,
        after: `message ${leafName} {\n  // \u2026\n} // \u2190 added`,
      };
    }
  }

  return null;
}

export function formatChangeAction(change: GrpcSchemaDiffChange): string {
  const leafName = change.entityPath.split('.').pop() ?? change.entityPath;
  const entityLabel = ENTITY_TYPE_LABELS[change.entityType] ?? change.entityType;
  switch (change.changeType) {
    case 'added': return `${entityLabel} added \u2014 ${leafName}`;
    case 'removed': return `${entityLabel} removed \u2014 ${leafName}`;
    case 'modified': return `${entityLabel} modified \u2014 ${leafName}`;
    case 'renamed': return `${entityLabel} renamed \u2014 ${leafName}`;
    case 'doc_comment_changed': return `Documentation updated \u2014 ${leafName}`;
    default: return `${entityLabel} changed \u2014 ${leafName}`;
  }
}

export interface ImpactInfo { icon: string; title: string; body: string }

export function getChangeImpact(change: GrpcSchemaDiffChange): ImpactInfo {
  const { severity, changeType, caveat } = change;
  if (severity === 'breaking') {
    if (changeType === 'removed') {
      return {
        icon: '\u26A0',
        title: 'Client data loss risk',
        body: caveat ?? 'Existing clients that send or depend on this field will have data silently dropped on the wire. All consumers must be updated before deploying.',
      };
    }
    return {
      icon: '\u26A0',
      title: 'Breaking change',
      body: caveat ?? 'This change is not backward-compatible. Existing clients may fail. Review all consumers before deploying.',
    };
  }
  if (severity === 'non_breaking') {
    return {
      icon: '\u2713',
      title: 'Backward compatible',
      body: caveat ?? 'Existing clients will continue to work. Older clients that do not know about this change will safely ignore it.',
    };
  }
  return {
    icon: '\u2139',
    title: 'No wire impact',
    body: caveat ?? 'This is a metadata or documentation change. It does not affect serialization or client compatibility.',
  };
}

function protoFieldTypeLabel(field: GrpcFieldSchema): string {
  if (field.isMap && field.mapKeyType) {
    const valType = field.type === 'message' && field.messageTypeName
      ? (field.messageTypeName.split('.').pop() ?? field.messageTypeName)
      : field.type === 'enum' && field.enumTypeName
        ? (field.enumTypeName.split('.').pop() ?? field.enumTypeName)
        : field.type;
    return `map<${field.mapKeyType}, ${valType}>`;
  }
  if (field.type === 'message' && field.messageTypeName) {
    return field.messageTypeName.split('.').pop() ?? field.messageTypeName;
  }
  if (field.type === 'enum' && field.enumTypeName) {
    return field.enumTypeName.split('.').pop() ?? field.enumTypeName;
  }
  return field.type;
}

function protoFieldLine(field: GrpcFieldSchema): string {
  const typeLabel = protoFieldTypeLabel(field);
  const prefix = !field.isMap && field.label === 'repeated' ? 'repeated ' : '';
  const comment = field.docComment ? `  // ${field.docComment.trim().replace(/\n/g, ' ')}
` : '';
  return `${comment}  ${prefix}${typeLabel} ${field.name} = ${field.number};`;
}

function buildMessageProtoText(schema: GrpcMessageSchema): string {
  const shortName = schema.typeName.split('.').pop() ?? schema.typeName;
  const header = schema.docComment ? `// ${schema.docComment.trim().replace(/\n/g, '\n// ')}\n` : '';
  const body = schema.fields.length > 0
    ? schema.fields.map(protoFieldLine).join('\n')
    : '  // (no fields)';
  return `${header}message ${shortName} {\n${body}\n}`;
}

function buildServiceProtoText(service: GrpcServiceInfo): string {
  const shortName = service.fullName.split('.').pop() ?? service.fullName;
  const methods = service.methods.map((m) => {
    const req = m.requestTypeName.split('.').pop() ?? m.requestTypeName;
    const res = m.responseTypeName.split('.').pop() ?? m.responseTypeName;
    const cs = m.callType === 'client_streaming' || m.callType === 'bidi_streaming' ? 'stream ' : '';
    const ss = m.callType === 'server_streaming' || m.callType === 'bidi_streaming' ? 'stream ' : '';
    const comment = m.docComment ? `  // ${m.docComment.trim().replace(/\n/g, ' ')}\n` : '';
    return `${comment}  rpc ${m.name}(${cs}${req}) returns (${ss}${res});`;
  });
  return `service ${shortName} {\n${methods.join('\n') || '  // (no methods)'}\n}`;
}

function buildEnumProtoText(schema: GrpcEnumSchema): string {
  const shortName = schema.typeName.split('.').pop() ?? schema.typeName;
  const header = schema.docComment ? `// ${schema.docComment.trim().replace(/\n/g, '\n// ')}\n` : '';
  const values = schema.values.length > 0
    ? schema.values.map((v) => `  ${v.name} = ${v.number};`).join('\n')
    : '  // (no values)';
  return `${header}enum ${shortName} {\n${values}\n}`;
}

export function buildProtoForEntity(
  descriptor: GrpcDescriptor | null | undefined,
  entityPath: string,
): string {
  if (!descriptor) return '// Descriptor not available';

  const msg = descriptor.messageTypes?.find((m) => m.typeName === entityPath);
  if (msg) return buildMessageProtoText(msg);

  const svc = descriptor.services.find((s) => s.fullName === entityPath);
  if (svc) return buildServiceProtoText(svc);

  const enm = descriptor.enumTypes?.find((e) => e.typeName === entityPath);
  if (enm) return buildEnumProtoText(enm);

  const targetSegments = entityPath.split('.').filter(Boolean);
  const suffixScore = (candidatePath: string): number => {
    const candidateSegments = candidatePath.split('.').filter(Boolean);
    let matched = 0;
    while (
      matched < targetSegments.length
      && matched < candidateSegments.length
      && targetSegments[targetSegments.length - 1 - matched] === candidateSegments[candidateSegments.length - 1 - matched]
    ) {
      matched += 1;
    }
    return matched;
  };
  const pickBestFuzzy = <T,>(
    entries: T[],
    getPath: (entry: T) => string,
  ): T | undefined => {
    let best: T | undefined;
    let bestScore = 0;
    let bestLength = Number.MAX_SAFE_INTEGER;
    for (const entry of entries) {
      const path = getPath(entry);
      const score = suffixScore(path);
      if (score === 0) continue;
      if (score > bestScore || (score === bestScore && path.length < bestLength)) {
        best = entry;
        bestScore = score;
        bestLength = path.length;
      }
    }
    return best;
  };

  const msgF = pickBestFuzzy(descriptor.messageTypes ?? [], (m) => m.typeName);
  if (msgF) return buildMessageProtoText(msgF);

  const svcF = pickBestFuzzy(descriptor.services, (s) => s.fullName);
  if (svcF) return buildServiceProtoText(svcF);

  const enmF = pickBestFuzzy(descriptor.enumTypes ?? [], (e) => e.typeName);
  if (enmF) return buildEnumProtoText(enmF);

  return `// "${entityPath}" not found in this descriptor`;
}

export function isRelatedSchemaDiffPath(entityPath: string, changePath: string): boolean {
  return changePath === entityPath
    || changePath.startsWith(`${entityPath}.`)
    || entityPath.startsWith(`${changePath}.`);
}

export function buildChangeDrivenProtoText(
  entityPath: string,
  changes: GrpcSchemaDiffChange[],
  side: 'before' | 'after',
): string | null {
  const entityShort = entityPath.split('.').pop() ?? entityPath;
  const relatedFields = changes
    .filter((change) => change.entityType === 'field' && isRelatedSchemaDiffPath(entityPath, change.entityPath))
    .sort((left, right) => left.entityPath.localeCompare(right.entityPath));

  if (relatedFields.length === 0) return null;

  const lines: string[] = [];
  for (const change of relatedFields) {
    const leafName = change.entityPath.split('.').pop() ?? change.entityPath;
    const { fieldType, fieldNumber } = parseFieldInfo(change.description);
    const fieldLine = `  ${fieldType} ${leafName}${fieldNumber !== undefined ? ` = ${fieldNumber}` : ''};`;

    if (side === 'before') {
      if (change.changeType === 'added') continue;
      if (change.changeType === 'removed') {
        lines.push(`${fieldLine}  // removed`);
        continue;
      }
      lines.push(fieldLine);
      continue;
    }

    if (change.changeType === 'removed') continue;
    if (change.changeType === 'added') {
      lines.push(`${fieldLine}  // added`);
      continue;
    }
    lines.push(fieldLine);
  }

  if (lines.length === 0) {
    return `message ${entityShort} {\n  // no fields on this side\n}`;
  }
  return `message ${entityShort} {\n${lines.join('\n')}\n}`;
}

/** Group changes by their parent entity path (all but last segment). */
export function groupChangesByParent(
  changes: GrpcSchemaDiffChange[],
): Array<{ key: string; label: string; changes: GrpcSchemaDiffChange[] }> {
  const map = new Map<string, GrpcSchemaDiffChange[]>();
  for (const change of changes) {
    const parts = change.entityPath.split('.');
    const parentKey = parts.length > 1 ? parts.slice(0, -1).join('.') : change.entityPath;
    const group = map.get(parentKey) ?? [];
    group.push(change);
    map.set(parentKey, group);
  }
  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    label: key,
    changes: items,
  }));
}

export function formatDescriptorKey(key: string): string {
  if (key.startsWith('reflection:')) {
    const parts = key.split(':');
    const hostPart = parts.slice(1, -1).join(':');
    return `Reflection \u00B7 ${hostPart}`;
  }
  if (key.startsWith('protoset:')) return 'Protoset file';
  if (key.startsWith('proto:')) return 'Proto files';
  return key.length > 48 ? `${key.slice(0, 45)}\u2026` : key;
}
