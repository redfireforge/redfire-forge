import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GrpcDescriptor, GrpcFieldSchema, GrpcMethodInfo } from '../../../shared/grpc/contracts';
import {
  formatGrpcCallTypeLabel,
  formatGrpcCallTypeBadge,
  grpcCallTypeBadgeModifier,
} from '../utils/grpcExplorerUtils';
import { buildGrpcurlInvokeCommand, formatGrpcMethodSignature } from '../utils/grpcGrpcurl';
import type { GrpcGrpcurlExportContext } from '../utils/grpcGrpcurlTypes';
import {
  augmentFilteredTreeWithSelection,
  buildSchemaBrowserTree,
  countSchemaBrowserStats,
  filterSchemaBrowserTree,
  findSchemaBrowserNode,
  lookupMessageSchema,
  lookupEnumSchema,
  resolveInitialSchemaBrowserSelection,
  type SchemaBrowserNode,
} from '../utils/grpcSchemaBrowserModel';

const GRPCURL_COPY_HINT_SEEN_KEY = 'grpc-schema-copy-grpcurl-hint-seen';
const GRPCURL_INSTALL_GO_CMD = 'go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest';
type GrpcurlBodyMode = 'minimal' | 'full';

const GRPCURL_INSTALL_OPTIONS = [
  { label: 'macOS (Homebrew)', command: 'brew install grpcurl' },
  { label: 'Linux (apt)', command: 'sudo apt install grpcurl' },
  { label: 'Linux (Snap)', command: 'sudo snap install grpcurl' },
  { label: 'Windows (winget)', command: 'winget install FullStory.grpcurl' },
  { label: 'Windows (Chocolatey)', command: 'choco install grpcurl' },
  { label: 'Any OS with Go', command: GRPCURL_INSTALL_GO_CMD },
] as const;

function grpcurlInstallHintForPlatform(): string {
  const platform = (typeof navigator !== 'undefined' ? navigator.platform : '').toLowerCase();
  if (platform.includes('mac')) {
    return `Install grpcurl (macOS): brew install grpcurl | Any OS with Go: ${GRPCURL_INSTALL_GO_CMD}`;
  }
  if (platform.includes('win')) {
    return `Install grpcurl (Windows): use the official release package | Any OS with Go: ${GRPCURL_INSTALL_GO_CMD}`;
  }
  return `Install grpcurl: use your distro package or official release | Any OS with Go: ${GRPCURL_INSTALL_GO_CMD}`;
}

export interface GrpcSchemaBrowserProps {
  descriptor: GrpcDescriptor;
  targetAddress?: string;
  tlsMode?: 'disabled' | 'tls' | 'mtls';
  selectedService?: string;
  selectedMethod?: string;
  grpcurlExportContext?: GrpcGrpcurlExportContext;
  onSelectMethod?: (serviceFullName: string, methodName: string) => void;
  onOpenInTab?: (
    serviceFullName: string,
    methodName: string,
    requestBody: Record<string, unknown>,
    mode: GrpcurlBodyMode,
  ) => void;
  onExportProtoset?: () => void | Promise<void>;
  exportProtosetBusy?: boolean;
}

function fieldTypeLabel(field: GrpcFieldSchema): string {
  if (field.isMap) {
    const keyType = field.mapKeyType ?? 'string';
    if (field.type === 'message' && field.messageTypeName) {
      return `map<${keyType}, ${field.messageTypeName}>`;
    }
    return `map<${keyType}, ${field.type}>`;
  }
  if (field.type === 'message' && field.messageTypeName) {
    return field.messageTypeName;
  }
  if (field.type === 'enum' && field.enumTypeName) {
    return field.enumTypeName;
  }
  return field.type;
}

function fieldLabelText(field: GrpcFieldSchema): string {
  if (field.isOneofMember && field.oneofName) {
    return `oneof ${field.oneofName}`;
  }
  return field.label;
}

function exampleScalarValue(field: GrpcFieldSchema): unknown {
  if (field.isMap) return {};
  if (field.label === 'repeated') return [];

  if (field.type === 'string' || field.type === 'bytes') {
    const name = field.name.toLowerCase();
    if (name === 'id' || name.endsWith('_id') || name.endsWith('id')) return 'A-100';
    if (name.includes('message')) return 'hello';
    if (name.includes('name')) return 'demo';
    return 'string';
  }

  if (field.type === 'bool') return true;

  if (
    field.type === 'int32'
    || field.type === 'uint32'
    || field.type === 'sint32'
    || field.type === 'fixed32'
    || field.type === 'sfixed32'
    || field.type === 'float'
    || field.type === 'double'
  ) {
    return 1;
  }

  if (
    field.type === 'int64'
    || field.type === 'uint64'
    || field.type === 'sint64'
    || field.type === 'fixed64'
    || field.type === 'sfixed64'
  ) {
    return '1';
  }

  if (field.type === 'enum') return field.enumValues?.[0]?.number ?? 0;

  return null;
}

function buildExampleBodyFromType(
  descriptor: GrpcDescriptor,
  typeName: string,
  visited: Set<string>,
): Record<string, unknown> {
  const schema = lookupMessageSchema(descriptor, typeName);
  if (!schema || visited.has(typeName)) {
    return {};
  }

  const nextVisited = new Set(visited);
  nextVisited.add(typeName);

  const body: Record<string, unknown> = {};
  const oneofRendered = new Set<string>();
  for (const field of schema.fields) {
    if (field.isOneofMember && field.oneofName) {
      if (oneofRendered.has(field.oneofName)) {
        continue;
      }
      oneofRendered.add(field.oneofName);
    }

    if (field.type === 'message' && field.messageTypeName) {
      body[field.name] = buildExampleBodyFromType(descriptor, field.messageTypeName, nextVisited);
      continue;
    }

    body[field.name] = exampleScalarValue(field);
  }

  return body;
}

function preferredFieldForMinimalPayload(fields: GrpcFieldSchema[]): GrpcFieldSchema | undefined {
  const preferred = fields.find((field) => {
    const name = field.name.toLowerCase();
    return name === 'id' || name.endsWith('_id') || name.includes('message') || name.includes('name');
  });
  return preferred ?? fields[0];
}

function buildMinimalBodyFromType(
  descriptor: GrpcDescriptor,
  typeName: string,
  visited: Set<string>,
): Record<string, unknown> {
  const schema = lookupMessageSchema(descriptor, typeName);
  if (!schema || visited.has(typeName)) {
    return {};
  }

  const nextVisited = new Set(visited);
  nextVisited.add(typeName);

  const field = preferredFieldForMinimalPayload(schema.fields);
  if (!field) {
    return {};
  }

  if (field.type === 'message' && field.messageTypeName) {
    return {
      [field.name]: buildMinimalBodyFromType(descriptor, field.messageTypeName, nextVisited),
    };
  }

  return {
    [field.name]: exampleScalarValue(field),
  };
}

function buildGrpcurlBodyTemplate(
  descriptor: GrpcDescriptor,
  method: GrpcMethodInfo,
  mode: GrpcurlBodyMode,
): Record<string, unknown> {
  if (mode === 'minimal') {
    return buildMinimalBodyFromType(descriptor, method.requestTypeName, new Set<string>());
  }
  return buildExampleBodyFromType(descriptor, method.requestTypeName, new Set<string>());
}

function schemaTypeTestId(typeName: string): string {
  return typeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function FieldTypeCell({
  field,
  onNavigateType,
}: {
  field: GrpcFieldSchema;
  onNavigateType?: (typeName: string) => void;
}) {
  const messageType = field.type === 'message' ? field.messageTypeName : undefined;
  const enumType = field.type === 'enum' ? field.enumTypeName : undefined;
  const navigableTypeName = messageType ?? enumType;
  const label = fieldTypeLabel(field);

  if (!navigableTypeName || !onNavigateType) {
    return <span>{label}</span>;
  }

  return (
    <button
      type="button"
      className="grpc-schema-field-type-link"
      data-testid={`grpc-schema-field-type-link-${schemaTypeTestId(navigableTypeName)}`}
      onClick={() => onNavigateType(navigableTypeName)}
    >
      {label}
    </button>
  );
}

function findSchemaNodeByTypeName(
  nodes: SchemaBrowserNode[],
  typeName: string,
): SchemaBrowserNode | undefined {
  for (const node of nodes) {
    if (node.kind === 'message' && node.messageSchema?.typeName === typeName) {
      return node;
    }
    if (node.kind === 'enum' && node.enumSchema?.typeName === typeName) {
      return node;
    }
    if (node.children?.length) {
      const found = findSchemaNodeByTypeName(node.children, typeName);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function FieldDocTable({
  fields,
  title,
  onNavigateType,
}: {
  fields: GrpcFieldSchema[];
  title: string;
  onNavigateType?: (typeName: string) => void;
}) {
  if (!fields.length) {
    return null;
  }
  return (
    <div className="grpc-schema-detail-section">
      <h3 className="grpc-schema-detail-section-title">{title}</h3>
      <table className="grpc-schema-field-table" data-testid="grpc-schema-field-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Field</th>
            <th>Type</th>
            <th>Label</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={`${field.number}-${field.name}`}>
              <td className="grpc-schema-field-num">{field.number}</td>
              <td className="grpc-schema-field-name">{field.name}</td>
              <td className="grpc-schema-field-type">
                <FieldTypeCell field={field} onNavigateType={onNavigateType} />
              </td>
              <td>
                <span className={`grpc-schema-field-label grpc-schema-field-label--${field.label}`}>
                  {fieldLabelText(field)}
                </span>
              </td>
              <td className="grpc-schema-field-doc">
                {field.docComment
                  ?? (field.enumValues?.length
                    ? field.enumValues.map((value) => value.name).join(' | ')
                    : '—')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MethodDetail({
  descriptor,
  serviceFullName,
  method,
  targetAddress,
  copyStatus,
  copyBodyMode,
  showInstallHint,
  onCopyBodyModeChange,
  onCopyGrpcurl,
  onNavigateType,
  onOpenInTab,
}: {
  descriptor: GrpcDescriptor;
  serviceFullName: string;
  method: GrpcMethodInfo;
  targetAddress?: string;
  copyStatus: 'idle' | 'copied' | 'failed';
  copyBodyMode: GrpcurlBodyMode;
  showInstallHint: boolean;
  onCopyBodyModeChange: (mode: GrpcurlBodyMode) => void;
  onCopyGrpcurl: (mode: GrpcurlBodyMode) => void;
  onNavigateType: (typeName: string) => void;
  onOpenInTab?: (mode: GrpcurlBodyMode) => void;
}) {
  const requestSchema = lookupMessageSchema(descriptor, method.requestTypeName) ?? method.requestSchema;
  const responseSchema = lookupMessageSchema(descriptor, method.responseTypeName) ?? method.responseSchema;
  const copyModeSummary = copyBodyMode === 'minimal'
    ? 'Minimal mode: key starter fields only.'
    : 'Full mode: includes a richer sample payload.';

  return (
    <div className="grpc-schema-method-doc" data-testid="grpc-schema-method-detail">
      <div className="grpc-schema-detail-header">
        <div>
          <h2 className="grpc-schema-detail-title">{serviceFullName}/{method.name}</h2>
          <span className={`grpc-method-badge ${grpcCallTypeBadgeModifier(method.callType)}`}>
            {formatGrpcCallTypeBadge(method.callType)}
          </span>
          <span className="grpc-schema-detail-call-type">{formatGrpcCallTypeLabel(method.callType)}</span>
        </div>
        <div className="grpc-schema-detail-actions">
          <div className="grpc-schema-detail-actions-row">
            <div className="grpc-schema-copy-mode-toggle" data-testid="grpc-schema-copy-mode-toggle">
              <button
                type="button"
                className={`grpc-schema-copy-mode-btn${copyBodyMode === 'minimal' ? ' grpc-schema-copy-mode-btn--active' : ''}`}
                data-testid="grpc-schema-copy-mode-minimal"
                onClick={() => onCopyBodyModeChange('minimal')}
                aria-pressed={copyBodyMode === 'minimal'}
              >
                Minimal
              </button>
              <button
                type="button"
                className={`grpc-schema-copy-mode-btn${copyBodyMode === 'full' ? ' grpc-schema-copy-mode-btn--active' : ''}`}
                data-testid="grpc-schema-copy-mode-full"
                onClick={() => onCopyBodyModeChange('full')}
                aria-pressed={copyBodyMode === 'full'}
              >
                Full
              </button>
            </div>
            <button
              type="button"
              className="grpc-schema-action-btn"
              data-testid="grpc-schema-copy-grpcurl-btn"
              onClick={() => onCopyGrpcurl(copyBodyMode)}
              disabled={!targetAddress?.trim()}
            >
              {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy as grpcurl'}
            </button>
            {onOpenInTab && (
              <button
                type="button"
                className="grpc-schema-action-btn"
                data-testid="grpc-schema-open-tab-btn"
                onClick={() => onOpenInTab(copyBodyMode)}
              >
                Open in tab
              </button>
            )}
          </div>
          <p
            className="grpc-schema-copy-mode-summary"
            data-testid="grpc-schema-copy-mode-summary"
          >
            {copyModeSummary}
          </p>
        </div>
      </div>
      {(copyStatus === 'copied' || copyStatus === 'failed') && (
        <div
          className={`grpc-schema-copy-feedback grpc-schema-copy-feedback--${copyStatus}`}
          data-testid="grpc-schema-copy-feedback"
        >
          {copyStatus === 'copied'
            ? 'Copied to clipboard.'
            : 'Copy failed. Check clipboard permissions and try again.'}
          {copyStatus === 'copied' && showInstallHint && (
            <details className="grpc-schema-copy-install-options" data-testid="grpc-schema-copy-install-options">
              <summary>{grpcurlInstallHintForPlatform()}</summary>
              <ul className="grpc-schema-copy-install-list">
                {GRPCURL_INSTALL_OPTIONS.map((option) => (
                  <li key={option.label}>
                    <strong>{option.label}:</strong> <code>{option.command}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {method.docComment && (
        <p className="grpc-schema-detail-description">{method.docComment}</p>
      )}
      <pre className="grpc-schema-method-signature" data-testid="grpc-schema-method-signature">
        {formatGrpcMethodSignature(serviceFullName, method)}
      </pre>
      <FieldDocTable
        fields={requestSchema.fields}
        title={`${method.name} — request fields`}
        onNavigateType={onNavigateType}
      />
      <FieldDocTable
        fields={responseSchema.fields}
        title={`${method.name} — response fields`}
        onNavigateType={onNavigateType}
      />
    </div>
  );
}

function ServiceDetail({
  serviceFullName,
  methods,
  onNavigateType,
}: {
  serviceFullName: string;
  methods: GrpcMethodInfo[];
  onNavigateType: (typeName: string) => void;
}) {
  return (
    <div className="grpc-schema-service-doc" data-testid="grpc-schema-service-detail">
      <h2 className="grpc-schema-detail-title">{serviceFullName}</h2>
      <table className="grpc-schema-field-table" data-testid="grpc-schema-service-methods-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Type</th>
            <th>Request</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => (
            <tr key={method.name}>
              <td className="grpc-schema-field-name">{method.name}</td>
              <td>{formatGrpcCallTypeLabel(method.callType)}</td>
              <td className="grpc-schema-field-type">
                <button
                  type="button"
                  className="grpc-schema-field-type-link"
                  data-testid={`grpc-schema-service-type-link-${schemaTypeTestId(method.requestTypeName)}`}
                  onClick={() => onNavigateType(method.requestTypeName)}
                >
                  {method.requestTypeName}
                </button>
              </td>
              <td className="grpc-schema-field-type">
                {method.callType === 'server_streaming' || method.callType === 'bidi_streaming' ? 'stream ' : ''}
                <button
                  type="button"
                  className="grpc-schema-field-type-link"
                  data-testid={`grpc-schema-service-type-link-${schemaTypeTestId(method.responseTypeName)}`}
                  onClick={() => onNavigateType(method.responseTypeName)}
                >
                  {method.responseTypeName}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TreeNodeButton({
  node,
  depth,
  selectedNodeId,
  onSelect,
}: {
  node: SchemaBrowserNode;
  depth: number;
  selectedNodeId?: string;
  onSelect: (node: SchemaBrowserNode) => void;
}) {
  const isPackage = node.kind === 'package';
  if (isPackage) {
    return (
      <div
        className="grpc-schema-tree-package"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {node.label}
      </div>
    );
  }

  const icon = node.kind === 'service'
    ? '⚡'
    : node.kind === 'method'
      ? 'ƒ'
      : node.kind === 'enum'
        ? 'E'
        : '⬡';

  return (
    <button
      type="button"
      className={`grpc-schema-tree-node grpc-schema-tree-node--${node.kind}${selectedNodeId === node.id ? ' grpc-schema-tree-node--active' : ''}`}
      style={{ paddingLeft: `${12 + depth * 12}px` }}
      data-testid={`grpc-schema-tree-node-${node.id}`}
      onClick={() => onSelect(node)}
    >
      <span className="grpc-schema-tree-node-icon" aria-hidden>{icon}</span>
      <span className="grpc-schema-tree-node-label">{node.label}</span>
    </button>
  );
}

function TreeNodes({
  nodes,
  depth,
  selectedNodeId,
  onSelect,
}: {
  nodes: SchemaBrowserNode[];
  depth: number;
  selectedNodeId?: string;
  onSelect: (node: SchemaBrowserNode) => void;
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <TreeNodeButton
            node={node}
            depth={depth}
            selectedNodeId={selectedNodeId}
            onSelect={onSelect}
          />
          {node.children?.length ? (
            <TreeNodes
              nodes={node.children}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
            />
          ) : null}
        </div>
      ))}
    </>
  );
}

export function GrpcSchemaBrowser({
  descriptor,
  targetAddress,
  tlsMode = 'disabled',
  selectedService,
  selectedMethod,
  grpcurlExportContext,
  onSelectMethod,
  onOpenInTab,
  onExportProtoset,
  exportProtosetBusy = false,
}: GrpcSchemaBrowserProps) {
  const fullTree = useMemo(() => buildSchemaBrowserTree(descriptor), [descriptor]);
  const stats = useMemo(() => countSchemaBrowserStats(descriptor), [descriptor]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [copyBodyMode, setCopyBodyMode] = useState<GrpcurlBodyMode>('minimal');
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(() =>
    resolveInitialSchemaBrowserSelection(descriptor, selectedService, selectedMethod)?.nodeId,
  );
  const pinnedSelectionRef = useRef(false);
  const copyStatusTimeoutRef = useRef<number | null>(null);
  const descriptorIdentity = `${descriptor.key}:${descriptor.contentSha256}`;

  useEffect(() => () => {
    if (copyStatusTimeoutRef.current !== null) {
      window.clearTimeout(copyStatusTimeoutRef.current);
      copyStatusTimeoutRef.current = null;
    }
  }, []);

  const filteredTree = useMemo(() => {
    const filtered = filterSchemaBrowserTree(fullTree, searchQuery);
    return augmentFilteredTreeWithSelection(fullTree, filtered, selectedNodeId);
  }, [fullTree, searchQuery, selectedNodeId]);

  useEffect(() => {
    pinnedSelectionRef.current = false;
  }, [selectedService, selectedMethod]);

  useEffect(() => {
    setSearchQuery('');
  }, [descriptorIdentity]);

  useEffect(() => {
    const initial = resolveInitialSchemaBrowserSelection(descriptor, selectedService, selectedMethod);
    if (initial) {
      if (!pinnedSelectionRef.current) {
        setSelectedNodeId(initial.nodeId);
        return;
      }
      setSelectedNodeId((current) => {
        if (current && findSchemaBrowserNode(fullTree, current)) {
          return current;
        }
        pinnedSelectionRef.current = false;
        return initial.nodeId;
      });
      return;
    }
    pinnedSelectionRef.current = false;
    setSelectedNodeId((current) => {
      if (!current) {
        return undefined;
      }
      return findSchemaBrowserNode(fullTree, current) ? current : undefined;
    });
  }, [descriptor, selectedService, selectedMethod, fullTree]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? findSchemaBrowserNode(fullTree, selectedNodeId) : undefined),
    [fullTree, selectedNodeId],
  );

  const handleSelectNode = useCallback((node: SchemaBrowserNode) => {
    if (node.kind === 'package') {
      return;
    }
    setSelectedNodeId(node.id);
    if (node.kind === 'method' && node.serviceFullName && node.method) {
      const matchesExplorer = node.serviceFullName === selectedService && node.method.name === selectedMethod;
      pinnedSelectionRef.current = !matchesExplorer;
      onSelectMethod?.(node.serviceFullName, node.method.name);
      return;
    }
    pinnedSelectionRef.current = true;
  }, [onSelectMethod, selectedService, selectedMethod]);

  const handleCopyGrpcurl = useCallback(async (mode: GrpcurlBodyMode) => {
    if (!selectedNode || selectedNode.kind !== 'method' || !selectedNode.serviceFullName || !selectedNode.method) {
      return;
    }
    if (!targetAddress?.trim()) {
      return;
    }
    const command = buildGrpcurlInvokeCommand({
      targetAddress,
      serviceFullName: selectedNode.serviceFullName,
      methodName: selectedNode.method.name,
      body: buildGrpcurlBodyTemplate(descriptor, selectedNode.method, mode),
      tlsMode,
      tlsFilePaths: grpcurlExportContext?.tlsFilePaths,
      descriptorFlags: grpcurlExportContext?.descriptorFlags,
    });
    try {
      await navigator.clipboard.writeText(command);
      let shouldShowInstallHint = false;
      try {
        shouldShowInstallHint = sessionStorage.getItem(GRPCURL_COPY_HINT_SEEN_KEY) !== '1';
        if (shouldShowInstallHint) {
          sessionStorage.setItem(GRPCURL_COPY_HINT_SEEN_KEY, '1');
        }
      } catch {
        // Ignore storage failures and keep copy feedback working.
      }
      setShowInstallHint(shouldShowInstallHint);
      setCopyStatus('copied');
    } catch {
      setShowInstallHint(false);
      setCopyStatus('failed');
    }

    if (copyStatusTimeoutRef.current !== null) {
      window.clearTimeout(copyStatusTimeoutRef.current);
    }
    copyStatusTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus('idle');
      setShowInstallHint(false);
      copyStatusTimeoutRef.current = null;
    }, 2_600);
  }, [selectedNode, targetAddress, tlsMode, grpcurlExportContext, descriptor]);

  const handleNavigateType = useCallback((typeName: string) => {
    const typeNode = findSchemaNodeByTypeName(fullTree, typeName);
    if (!typeNode) {
      return;
    }
    setSelectedNodeId(typeNode.id);
    pinnedSelectionRef.current = true;
  }, [fullTree]);

  const renderDetail = () => {
    if (!selectedNode) {
      return (
        <div className="grpc-schema-detail-empty" data-testid="grpc-schema-detail-empty">
          Select a service, method, message, or enum to inspect schema details.
        </div>
      );
    }

    if (selectedNode.kind === 'method' && selectedNode.serviceFullName && selectedNode.method) {
      return (
        <MethodDetail
          descriptor={descriptor}
          serviceFullName={selectedNode.serviceFullName}
          method={selectedNode.method}
          targetAddress={targetAddress}
          copyStatus={copyStatus}
          copyBodyMode={copyBodyMode}
          showInstallHint={showInstallHint}
          onCopyBodyModeChange={setCopyBodyMode}
          onCopyGrpcurl={(mode) => { void handleCopyGrpcurl(mode); }}
          onNavigateType={handleNavigateType}
          onOpenInTab={onOpenInTab
            ? (mode) => onOpenInTab(
              selectedNode.serviceFullName!,
              selectedNode.method!.name,
              buildGrpcurlBodyTemplate(descriptor, selectedNode.method!, mode),
              mode,
            )
            : undefined}
        />
      );
    }

    if (selectedNode.kind === 'service' && selectedNode.serviceFullName) {
      const service = descriptor.services.find((entry) => entry.fullName === selectedNode.serviceFullName);
      return service
        ? (
          <ServiceDetail
            serviceFullName={service.fullName}
            methods={service.methods}
            onNavigateType={handleNavigateType}
          />
        )
        : (
          <div className="grpc-schema-detail-empty" data-testid="grpc-schema-detail-empty">
            Selected service is no longer in the loaded descriptor.
          </div>
        );
    }

    if (selectedNode.kind === 'message' && selectedNode.messageSchema) {
      const messageSchema = lookupMessageSchema(descriptor, selectedNode.messageSchema.typeName)
        ?? selectedNode.messageSchema;
      return (
        <div data-testid="grpc-schema-message-detail">
          <h2 className="grpc-schema-detail-title">{messageSchema.typeName}</h2>
          {messageSchema.docComment && (
            <p className="grpc-schema-detail-description">{messageSchema.docComment}</p>
          )}
          <FieldDocTable
            fields={messageSchema.fields}
            title="Fields"
            onNavigateType={handleNavigateType}
          />
        </div>
      );
    }

    if (selectedNode.kind === 'enum' && selectedNode.enumSchema) {
      const enumSchema = lookupEnumSchema(descriptor, selectedNode.enumSchema.typeName)
        ?? selectedNode.enumSchema;
      return (
        <div data-testid="grpc-schema-enum-detail">
          <h2 className="grpc-schema-detail-title">{enumSchema.typeName}</h2>
          {enumSchema.docComment && (
            <p className="grpc-schema-detail-description">{enumSchema.docComment}</p>
          )}
          <table className="grpc-schema-field-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Number</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {enumSchema.values.map((value: { name: string; number: number; docComment?: string }) => (
                <tr key={`${value.name}-${value.number}`}>
                  <td className="grpc-schema-field-name">{value.name}</td>
                  <td className="grpc-schema-field-num">{value.number}</td>
                  <td className="grpc-schema-field-doc">{value.docComment ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="grpc-schema-detail-empty" data-testid="grpc-schema-detail-empty">
        Selected schema node is not available in the loaded descriptor.
      </div>
    );
  };

  return (
    <div className="grpc-schema-browser" data-testid="grpc-schema-browser">
      <div className="grpc-schema-browser-toolbar">
        <input
          type="search"
          className="grpc-schema-browser-search"
          data-testid="grpc-schema-browser-search"
          placeholder="Search packages, services, methods, types…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label="Search schema"
        />
        <div className="grpc-schema-browser-stats" data-testid="grpc-schema-browser-stats">
          <span>{stats.services} services</span>
          <span>{stats.methods} methods</span>
          <span>{stats.messages} messages</span>
          <span>{stats.enums} enums</span>
        </div>
        {onExportProtoset && (
          <button
            type="button"
            className="grpc-schema-action-btn"
            data-testid="grpc-schema-export-protoset-btn"
            onClick={() => { void onExportProtoset(); }}
            disabled={exportProtosetBusy}
            aria-label="Export loaded schema as protoset"
          >
            {exportProtosetBusy ? 'Exporting…' : 'Export protoset'}
          </button>
        )}
      </div>
      <div className="grpc-schema-browser-split">
        <div className="grpc-schema-browser-tree" data-testid="grpc-schema-browser-tree">
          {filteredTree.length > 0 ? (
            <TreeNodes
              nodes={filteredTree}
              depth={0}
              selectedNodeId={selectedNodeId}
              onSelect={handleSelectNode}
            />
          ) : (
            <p className="grpc-schema-tree-empty" data-testid="grpc-schema-tree-empty">
              No schema nodes match your search.
            </p>
          )}
        </div>
        <div className="grpc-schema-browser-detail" data-testid="grpc-schema-browser-detail">
          {renderDetail()}
        </div>
      </div>
    </div>
  );
}
