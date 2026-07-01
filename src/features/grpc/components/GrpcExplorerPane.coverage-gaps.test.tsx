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
});
