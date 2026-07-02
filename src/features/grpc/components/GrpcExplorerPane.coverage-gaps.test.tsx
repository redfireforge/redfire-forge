/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { createEmptyTabDescriptorState, createGrpcStudioTab } from '../grpcStudioTypes';
import { GrpcExplorerPane } from './GrpcExplorerPane';

describe('GrpcExplorerPane coverage gaps', () => {
  const tab = {
    ...createGrpcStudioTab(),
    service: 'echo.EchoService',
    method: 'Echo',
  };

  it('wires drift banner actions and blocking composer fallback', () => {
    const onPruneSchemaDriftBody = vi.fn();
    const onRebindSchemaDriftMethod = vi.fn();
    const onSendUnary = vi.fn();

    render(
      <GrpcExplorerPane
        tab={tab}
        tabPanelId="grpc-tab-pane-test"
        descriptorState={{
          ...createEmptyTabDescriptorState(),
          descriptor: FIXTURE_DESCRIPTOR,
          driftState: 'blocking',
          driftMessage: 'Method removed',
          driftIssues: [{ kind: 'field_removed', message: 'message field removed', fieldName: 'message' }],
          suggestedRebinds: [{ service: 'echo.EchoService', method: 'Echo', reason: 'Compatible request shape' }],
          driftStaleMethod: FIXTURE_DESCRIPTOR.services[0]!.methods[0],
        }}
        canReflect
        targetValid
        targetAddress="localhost:50051"
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
        onTabPatch={vi.fn()}
        onSendUnary={onSendUnary}
        onPruneSchemaDriftBody={onPruneSchemaDriftBody}
        onRebindSchemaDriftMethod={onRebindSchemaDriftMethod}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-drift-prune-btn'));
    fireEvent.click(screen.getByTestId('grpc-schema-drift-rebind-echo-EchoService-Echo'));

    expect(onPruneSchemaDriftBody).toHaveBeenCalled();
    expect(onRebindSchemaDriftMethod).toHaveBeenCalledWith('echo.EchoService', 'Echo');
    expect(screen.getByTestId('grpc-call-panel')).toBeTruthy();
  });

  it('keeps the call panel enabled while a stream is active', () => {
    render(
      <GrpcExplorerPane
        tab={{
          ...tab,
          method: 'ClientStream',
          streamLifecycle: 'streaming',
          activeStreamId: 'stream-active',
        }}
        tabPanelId="grpc-tab-pane-test"
        descriptorState={{
          ...createEmptyTabDescriptorState(),
          descriptor: FIXTURE_DESCRIPTOR,
        }}
        canReflect
        targetValid
        targetAddress="localhost:50051"
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
        onTabPatch={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-proto-field-input-message') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByTestId('grpc-stream-send-now-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders connectionChrome at top of main column', () => {
    render(
      <GrpcExplorerPane
        tab={tab}
        tabPanelId="grpc-tab-pane-test"
        descriptorState={createEmptyTabDescriptorState()}
        canReflect={false}
        targetValid={false}
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
        onTabPatch={vi.fn()}
        connectionChrome={<div data-testid="chrome-fixture">chrome</div>}
      />,
    );
    const chrome = screen.getByTestId('grpc-connection-chrome');
    expect(chrome.querySelector('[data-testid="chrome-fixture"]')).toBeTruthy();
    expect(chrome.closest('.grpc-studio-main')).toBeTruthy();
  });

  it('dismisses drift banner and toggles explorer collapse', () => {
    const onDismissSchemaDrift = vi.fn();
    const onTabPatch = vi.fn();

    render(
      <GrpcExplorerPane
        tab={{ ...tab, servicesCollapsed: false }}
        tabPanelId="grpc-tab-pane-test"
        descriptorState={{
          ...createEmptyTabDescriptorState(),
          descriptor: FIXTURE_DESCRIPTOR,
          driftState: 'warning',
          driftMessage: 'Field type changed',
        }}
        canReflect
        targetValid
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
        onTabPatch={onTabPatch}
        onDismissSchemaDrift={onDismissSchemaDrift}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-drift-dismiss-btn'));
    expect(onDismissSchemaDrift).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('grpc-explorer-collapse-btn'));
    expect(onTabPatch).toHaveBeenCalledWith({ servicesCollapsed: true });
  });

  it('blocks send when drift is blocking and forwards tlsValid to call panel', () => {
    render(
      <GrpcExplorerPane
        tab={tab}
        tabPanelId="grpc-tab-pane-test"
        descriptorState={{
          ...createEmptyTabDescriptorState(),
          descriptor: FIXTURE_DESCRIPTOR,
          driftState: 'blocking',
          driftMessage: 'Method removed',
          driftStaleMethod: FIXTURE_DESCRIPTOR.services[0]!.methods[0],
        }}
        canReflect
        targetValid
        tlsValid={false}
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
        onTabPatch={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('grpc-call-send-block-hint').textContent).toMatch(/TLS configuration/i);
  });

  it('defaults servicesCollapsed when tab omits the flag', () => {
    const onTabPatch = vi.fn();
    const tabWithoutCollapse = { ...createGrpcStudioTab(), service: 'echo.EchoService', method: 'Echo' };
    delete (tabWithoutCollapse as { servicesCollapsed?: boolean }).servicesCollapsed;

    render(
      <GrpcExplorerPane
        tab={tabWithoutCollapse}
        tabPanelId="grpc-tab-pane-test"
        descriptorState={{
          ...createEmptyTabDescriptorState(),
          descriptor: FIXTURE_DESCRIPTOR,
        }}
        canReflect
        targetValid
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
        onTabPatch={onTabPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-explorer-collapse-btn'));
    expect(onTabPatch).toHaveBeenCalledWith({ servicesCollapsed: true });
  });

  it('honors servicesCollapsed=true and toggles back to expanded', () => {
    const onTabPatch = vi.fn();

    render(
      <GrpcExplorerPane
        tab={{ ...tab, servicesCollapsed: true }}
        tabPanelId="grpc-tab-pane-test"
        descriptorState={{
          ...createEmptyTabDescriptorState(),
          descriptor: FIXTURE_DESCRIPTOR,
        }}
        canReflect
        targetValid
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
        onTabPatch={onTabPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-explorer-collapse-btn'));
    expect(onTabPatch).toHaveBeenCalledWith({ servicesCollapsed: false });
  });

  it('uses selected method when descriptor matches tab selection', () => {
    render(
      <GrpcExplorerPane
        tab={tab}
        tabPanelId="grpc-tab-pane-test"
        descriptorState={{
          ...createEmptyTabDescriptorState(),
          descriptor: FIXTURE_DESCRIPTOR,
        }}
        canReflect
        targetValid
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
        onTabPatch={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-proto-form')).toBeTruthy();
    expect(screen.queryByTestId('grpc-call-panel-empty')).toBeNull();
  });
});
