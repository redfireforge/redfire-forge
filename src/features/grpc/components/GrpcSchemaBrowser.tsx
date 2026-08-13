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
import { SchemaBrowserTree, findSchemaNodeByTypeName } from './grpcSchemaBrowserTree';
import {
  GRPCURL_COPY_HINT_SEEN_KEY,
  GRPCURL_INSTALL_OPTIONS,
  buildGrpcurlBodyTemplate,
  grpcurlInstallHintForPlatform,
  schemaTypeTestId,
  fieldTypeLabel,
  fieldLabelText,
  type GrpcurlBodyMode,
} from './GrpcSchemaBrowser.helpers';

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
          <SchemaBrowserTree
            nodes={filteredTree}
            selectedNodeId={selectedNodeId}
            onSelect={handleSelectNode}
          />
        </div>
        <div className="grpc-schema-browser-detail" data-testid="grpc-schema-browser-detail">
          {renderDetail()}
        </div>
      </div>
    </div>
  );
}
