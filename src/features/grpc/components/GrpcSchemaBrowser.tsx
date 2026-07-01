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

export interface GrpcSchemaBrowserProps {
  descriptor: GrpcDescriptor;
  targetAddress?: string;
  tlsMode?: 'disabled' | 'tls' | 'mtls';
  selectedService?: string;
  selectedMethod?: string;
  grpcurlExportContext?: GrpcGrpcurlExportContext;
  onSelectMethod?: (serviceFullName: string, methodName: string) => void;
  onOpenInTab?: (serviceFullName: string, methodName: string) => void;
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

function FieldDocTable({ fields, title }: { fields: GrpcFieldSchema[]; title: string }) {
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
              <td className="grpc-schema-field-type">{fieldTypeLabel(field)}</td>
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
  onCopyGrpcurl,
  onOpenInTab,
}: {
  descriptor: GrpcDescriptor;
  serviceFullName: string;
  method: GrpcMethodInfo;
  targetAddress?: string;
  onCopyGrpcurl: () => void;
  onOpenInTab?: () => void;
}) {
  const requestSchema = lookupMessageSchema(descriptor, method.requestTypeName) ?? method.requestSchema;
  const responseSchema = lookupMessageSchema(descriptor, method.responseTypeName) ?? method.responseSchema;

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
          <button
            type="button"
            className="grpc-schema-action-btn"
            data-testid="grpc-schema-copy-grpcurl-btn"
            onClick={onCopyGrpcurl}
            disabled={!targetAddress?.trim()}
          >
            Copy as grpcurl
          </button>
          {onOpenInTab && (
            <button
              type="button"
              className="grpc-schema-action-btn"
              data-testid="grpc-schema-open-tab-btn"
              onClick={onOpenInTab}
            >
              Open in tab
            </button>
          )}
        </div>
      </div>
      {method.docComment && (
        <p className="grpc-schema-detail-description">{method.docComment}</p>
      )}
      <pre className="grpc-schema-method-signature" data-testid="grpc-schema-method-signature">
        {formatGrpcMethodSignature(serviceFullName, method)}
      </pre>
      <FieldDocTable fields={requestSchema.fields} title={`${method.name} — request fields`} />
      <FieldDocTable fields={responseSchema.fields} title={`${method.name} — response fields`} />
    </div>
  );
}

function ServiceDetail({ serviceFullName, methods }: { serviceFullName: string; methods: GrpcMethodInfo[] }) {
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
              <td className="grpc-schema-field-type">{method.requestTypeName}</td>
              <td className="grpc-schema-field-type">
                {method.callType === 'server_streaming' || method.callType === 'bidi_streaming'
                  ? `stream ${method.responseTypeName}`
                  : method.responseTypeName}
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(() =>
    resolveInitialSchemaBrowserSelection(descriptor, selectedService, selectedMethod)?.nodeId,
  );
  const pinnedSelectionRef = useRef(false);
  const descriptorIdentity = `${descriptor.key}:${descriptor.contentSha256}`;

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

  const handleCopyGrpcurl = useCallback(async () => {
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
      tlsMode,
      tlsFilePaths: grpcurlExportContext?.tlsFilePaths,
      descriptorFlags: grpcurlExportContext?.descriptorFlags,
    });
    await navigator.clipboard.writeText(command);
  }, [selectedNode, targetAddress, tlsMode, grpcurlExportContext]);

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
          onCopyGrpcurl={() => { void handleCopyGrpcurl(); }}
          onOpenInTab={onOpenInTab
            ? () => onOpenInTab(selectedNode.serviceFullName!, selectedNode.method!.name)
            : undefined}
        />
      );
    }

    if (selectedNode.kind === 'service' && selectedNode.serviceFullName) {
      const service = descriptor.services.find((entry) => entry.fullName === selectedNode.serviceFullName);
      return service
        ? <ServiceDetail serviceFullName={service.fullName} methods={service.methods} />
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
          <FieldDocTable fields={messageSchema.fields} title="Fields" />
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
