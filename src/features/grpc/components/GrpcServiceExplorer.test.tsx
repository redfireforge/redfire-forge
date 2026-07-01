/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FIXTURE_DESCRIPTOR, FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { GrpcServiceExplorer } from './GrpcServiceExplorer';

describe('GrpcServiceExplorer (Phase 1E)', () => {
  it('renders idle state before reflection', () => {
    render(
      <GrpcServiceExplorer
        loadState="idle"
        expandedServiceIds={[]}
        canReflect
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-explorer-idle')).toBeTruthy();
    expect(screen.getByTestId('grpc-reflect-btn')).toBeTruthy();
  });

  it('renders multi-service tree and filters methods', () => {
    render(
      <GrpcServiceExplorer
        loadState="loaded"
        descriptor={FIXTURE_MULTI_SERVICE_DESCRIPTOR}
        expandedServiceIds={['echo.EchoService', 'health.v1.Health']}
        canReflect
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    expect(screen.getByTestId('grpc-service-echo-echoservice')).toBeTruthy();
    expect(screen.getByTestId('grpc-method-echo-echoservice-echo')).toBeTruthy();
    expect(screen.getByTestId('grpc-method-health-v1-health-watch')).toBeTruthy();
    expect(screen.getByTestId('grpc-method-echo-echoservice-echo').textContent).toMatch(/U/);
    expect(screen.getByTestId('grpc-method-health-v1-health-watch').textContent).toMatch(/SS/);
    expect(screen.getByTestId('grpc-explorer-footer')).toBeTruthy();
    expect(screen.getByTestId('grpc-explorer-source').textContent).toMatch(/Reflection/);
    expect(screen.getByTestId('grpc-explorer-service-total').textContent).toBe('2');
    expect(screen.getByTestId('grpc-explorer-method-total').textContent).toBe('6');

    fireEvent.change(screen.getByTestId('grpc-explorer-search'), {
      target: { value: 'Echo' },
    });

    expect(screen.getByTestId('grpc-explorer-method-total').textContent).toBe('4 / 6');
  });

  it('auto-expands collapsed services while filtering so matched methods stay visible', () => {
    render(
      <GrpcServiceExplorer
        loadState="loaded"
        descriptor={FIXTURE_MULTI_SERVICE_DESCRIPTOR}
        expandedServiceIds={[]}
        canReflect
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('grpc-method-health-v1-health-watch')).toBeNull();

    fireEvent.change(screen.getByTestId('grpc-explorer-search'), {
      target: { value: 'Watch' },
    });

    expect(screen.getByTestId('grpc-method-health-v1-health-watch')).toBeTruthy();
  });

  it('keeps tree visible while re-reflecting with existing descriptor', () => {
    render(
      <GrpcServiceExplorer
        loadState="loading"
        descriptor={FIXTURE_DESCRIPTOR}
        expandedServiceIds={['echo.EchoService']}
        canReflect
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    expect(screen.queryByTestId('grpc-explorer-loading')).toBeNull();
    expect((screen.getByTestId('grpc-reflect-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears search filter when descriptor key changes after re-reflect', () => {
    const onReflect = vi.fn();
    const { rerender } = render(
      <GrpcServiceExplorer
        loadState="loaded"
        descriptor={FIXTURE_DESCRIPTOR}
        expandedServiceIds={['echo.EchoService']}
        canReflect
        onReflect={onReflect}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-explorer-search'), {
      target: { value: 'Echo' },
    });
    expect(screen.getByTestId('grpc-explorer-method-total').textContent).toBe('4 / 4');

    rerender(
      <GrpcServiceExplorer
        loadState="loaded"
        descriptor={FIXTURE_MULTI_SERVICE_DESCRIPTOR}
        expandedServiceIds={['echo.EchoService', 'health.v1.Health']}
        canReflect
        onReflect={onReflect}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-explorer-search') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('grpc-explorer-method-total').textContent).toBe('6');
  });

  it('keeps service tree visible when refresh fails but descriptor was preserved', () => {
    render(
      <GrpcServiceExplorer
        loadState="error"
        descriptor={FIXTURE_DESCRIPTOR}
        errorMessage="reflection failed"
        expandedServiceIds={['echo.EchoService']}
        canReflect
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-explorer-error').textContent).toMatch(/reflection failed/i);
    expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    expect(screen.getByTestId('grpc-method-echo-echoservice-echo')).toBeTruthy();
  });

  it('hides service tree when refresh fails without a preserved descriptor', () => {
    render(
      <GrpcServiceExplorer
        loadState="error"
        errorMessage="reflection failed"
        expandedServiceIds={[]}
        canReflect
        onReflect={vi.fn()}
        onManageSchemas={vi.fn()}
        onSelectMethod={vi.fn()}
        onToggleServiceExpanded={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-explorer-error')).toBeTruthy();
    expect(screen.queryByTestId('grpc-explorer-tree')).toBeNull();
  });

  it('invokes onSelectMethod when method row clicked', () => {
    const onSelectMethod = vi.fn();
    render(
      <GrpcServiceExplorer
        loadState="loaded"
        descriptor={FIXTURE_DESCRIPTOR}
        expandedServiceIds={['echo.EchoService']}
        canReflect
        onReflect={vi.fn()}
        onSelectMethod={onSelectMethod}
        onToggleServiceExpanded={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    expect(onSelectMethod).toHaveBeenCalledWith('echo.EchoService', 'Echo');
  });
});
