/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcTransportPanel } from './GrpcTransportPanel';
import { isGrpcTransportDispatchImplemented } from '../../../shared/grpc/grpcBrowserTransportRouter';
import { isGrpcTransportPlatformSupported } from '../../../shared/grpc/grpcWebTransportContracts';
import { isTauri } from '../../../shared/utils/platform';

const transportMocks = vi.hoisted(() => ({
  platformSupportedImpl: null as typeof isGrpcTransportPlatformSupported | null,
}));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock('../../../shared/grpc/grpcBrowserTransportRouter', () => ({
  isGrpcTransportDispatchImplemented: vi.fn(() => true),
}));

vi.mock('../../../shared/grpc/grpcWebTransportContracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/grpc/grpcWebTransportContracts')>();
  transportMocks.platformSupportedImpl = actual.isGrpcTransportPlatformSupported;
  return {
    ...actual,
    isGrpcTransportPlatformSupported: vi.fn(actual.isGrpcTransportPlatformSupported),
  };
});

describe('GrpcTransportPanel (Phase 7F)', () => {
  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(isGrpcTransportDispatchImplemented).mockReturnValue(true);
    if (transportMocks.platformSupportedImpl) {
      vi.mocked(isGrpcTransportPlatformSupported).mockImplementation(
        transportMocks.platformSupportedImpl,
      );
    }
  });

  it('enables tauri selection on desktop and calls onTransportModeChange', () => {
    const onTransportModeChange = vi.fn();
    render(
      <GrpcTransportPanel
        transportMode="express"
        onTransportModeChange={onTransportModeChange}
      />,
    );

    const tauriCard = screen.getByTestId('grpc-transport-mode-tauri');
    expect(tauriCard.className).not.toMatch(/disabled/);

    fireEvent.click(tauriCard);
    expect(onTransportModeChange).toHaveBeenCalledWith('tauri');
  });

  it('shows locked hint when transportChangeBlocked', () => {
    render(
      <GrpcTransportPanel
        transportMode="tauri"
        transportChangeBlocked
      />,
    );

    expect(screen.getByTestId('grpc-transport-locked-hint')).toBeTruthy();
    expect((screen.getByTestId('grpc-transport-mode-express') as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders browser-direct modes: grpc-web and spring-servlet enabled on web', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    render(
      <GrpcTransportPanel
        transportMode="express"
        onTransportModeChange={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-transport-mode-grpc-web') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('grpc-transport-mode-spring-servlet') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders browser-direct modes as enabled on desktop (Tauri)', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    render(
      <GrpcTransportPanel
        transportMode="express"
        onTransportModeChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-transport-mode-grpc-web')).toBeTruthy();
    expect(screen.getByTestId('grpc-transport-mode-spring-servlet')).toBeTruthy();
    expect((screen.getByTestId('grpc-transport-mode-grpc-web') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('grpc-transport-mode-spring-servlet') as HTMLButtonElement).disabled).toBe(false);
  });

  it('disabled prop blocks clicks on selectable modes', () => {
    const onTransportModeChange = vi.fn();
    render(
      <GrpcTransportPanel
        transportMode="express"
        disabled
        onTransportModeChange={onTransportModeChange}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-transport-mode-tauri'));
    expect(onTransportModeChange).not.toHaveBeenCalled();
    expect((screen.getByTestId('grpc-transport-mode-tauri') as HTMLButtonElement).disabled).toBe(true);
  });

  it('clicking grpc-web on web calls onTransportModeChange', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const onTransportModeChange = vi.fn();
    render(
      <GrpcTransportPanel
        transportMode="express"
        onTransportModeChange={onTransportModeChange}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-transport-mode-grpc-web'));
    expect(onTransportModeChange).toHaveBeenCalledWith('grpc-web');
  });

  it('express active mode exposes aria-pressed and remains clickable', () => {
    const onTransportModeChange = vi.fn();
    render(
      <GrpcTransportPanel
        transportMode="express"
        onTransportModeChange={onTransportModeChange}
      />,
    );

    const express = screen.getByTestId('grpc-transport-mode-express');
    expect(express.getAttribute('aria-pressed')).toBe('true');
    expect(express.getAttribute('aria-current')).toBe('true');
    expect((express as HTMLButtonElement).disabled).toBe(false);

    // Inactive modes get aria-pressed=false (not absent)
    const grpcWeb = screen.getByTestId('grpc-transport-mode-grpc-web');
    expect(grpcWeb.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(express);
    expect(onTransportModeChange).toHaveBeenCalledWith('express');
  });

  it('clicking a disabled mode does not call onTransportModeChange', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const onTransportModeChange = vi.fn();
    render(
      <GrpcTransportPanel
        transportMode="express"
        onTransportModeChange={onTransportModeChange}
      />,
    );

    const tauri = screen.getByTestId('grpc-transport-mode-tauri');
    expect((tauri as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(tauri);
    expect(onTransportModeChange).not.toHaveBeenCalled();
  });

  it('disables desktop-only card via panel desktopOnly flag when platform check passes', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(isGrpcTransportPlatformSupported).mockReturnValue(true);

    render(<GrpcTransportPanel transportMode="express" onTransportModeChange={vi.fn()} />);

    const tauri = screen.getByTestId('grpc-transport-mode-tauri');
    expect((tauri as HTMLButtonElement).disabled).toBe(true);
    expect(tauri.className).toMatch(/disabled/);
  });

  it('renders compact transport table rows', () => {
    render(<GrpcTransportPanel transportMode="express" />);

    expect(screen.getByTestId('grpc-transport-mode-express').textContent).toMatch(/Express Proxy/);
    expect(screen.getByTestId('grpc-transport-mode-express').textContent).toMatch(/Web \+ Desktop \(Phase 1\)/);
    expect(screen.getByTestId('grpc-transport-mode-tauri').textContent).toMatch(/Tauri Native \(tonic\)/);
    expect(screen.getByTestId('grpc-transport-mode-grpc-web').textContent).toMatch(/gRPC-Web/);
    expect(screen.getByTestId('grpc-transport-mode-spring-servlet').textContent).toMatch(/Spring Servlet/);
    expect(screen.getByTestId('grpc-transport-mode-express').textContent).toMatch(/All calls go through the local Node\.js server/i);
    expect(screen.getByTestId('grpc-transport-mode-tauri').textContent).toMatch(/Uses Rust tonic directly/i);
    expect(screen.getByTestId('grpc-transport-mode-grpc-web').textContent).toMatch(/Unary and server-streaming calls via browser fetch/i);
    expect(screen.getByTestId('grpc-transport-mode-spring-servlet').textContent).toMatch(/Client and bidi streaming require Express Proxy/i);
    expect(screen.queryByTestId('grpc-transport-help')).toBeNull();
  });

  it('shows server streaming support hint when call type is server_streaming', () => {
    render(
      <GrpcTransportPanel
        transportMode="grpc-web"
        callType="server_streaming"
        onTransportModeChange={vi.fn()}
      />,
    );

    const hint = screen.getByTestId('grpc-transport-stream-deferred-hint');
    expect(hint.textContent).toMatch(/Server streaming is supported/i);
    expect(hint.textContent).toMatch(/client or bidi streaming/i);
    expect(hint.textContent).toMatch(/Express Proxy/i);
  });

  it('hides server streaming deferred hint for unary call type', () => {
    render(
      <GrpcTransportPanel
        transportMode="grpc-web"
        callType="unary"
        onTransportModeChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('grpc-transport-stream-deferred-hint')).toBeNull();
  });

  it('disables mode when dispatch is not implemented for that mode', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(isGrpcTransportDispatchImplemented).mockImplementation(
      (mode) => mode !== 'spring-servlet',
    );

    const onTransportModeChange = vi.fn();
    render(
      <GrpcTransportPanel
        transportMode="express"
        onTransportModeChange={onTransportModeChange}
      />,
    );

    const springServlet = screen.getByTestId('grpc-transport-mode-spring-servlet');
    expect((springServlet as HTMLButtonElement).disabled).toBe(true);
    expect(springServlet.className).toMatch(/disabled/);
    expect(screen.getByTestId('grpc-transport-mode-reason-spring-servlet').textContent).toBe(
      'Not yet implemented',
    );

    fireEvent.click(springServlet);
    expect(onTransportModeChange).not.toHaveBeenCalled();
  });
});

// ── Phase 10G — call-type guardrail tests ─────────────────────────────────────

describe('GrpcTransportPanel (Phase 10G — call-type guardrails)', () => {
  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(isGrpcTransportDispatchImplemented).mockReturnValue(true);
    if (transportMocks.platformSupportedImpl) {
      vi.mocked(isGrpcTransportPlatformSupported).mockImplementation(
        transportMocks.platformSupportedImpl,
      );
    }
  });

  it('client_streaming disables grpc-web and spring-servlet', () => {
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType="client_streaming"
        onTransportModeChange={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-transport-mode-grpc-web') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-transport-mode-spring-servlet') as HTMLButtonElement).disabled).toBe(true);
    // express is enabled; tauri is disabled because of desktopOnly on web (not call type)
    expect((screen.getByTestId('grpc-transport-mode-express') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('grpc-transport-mode-tauri') as HTMLButtonElement).disabled).toBe(true);
  });

  it('bidi_streaming disables grpc-web and spring-servlet', () => {
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType="bidi_streaming"
        onTransportModeChange={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-transport-mode-grpc-web') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-transport-mode-spring-servlet') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('grpc-transport-mode-express') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('grpc-transport-mode-tauri') as HTMLButtonElement).disabled).toBe(true);
  });

  it('server_streaming leaves grpc-web and spring-servlet enabled', () => {
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType="server_streaming"
        onTransportModeChange={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-transport-mode-grpc-web') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('grpc-transport-mode-spring-servlet') as HTMLButtonElement).disabled).toBe(false);
  });

  it('unary leaves all platform-supported modes enabled', () => {
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType="unary"
        onTransportModeChange={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-transport-mode-express') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('grpc-transport-mode-grpc-web') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('grpc-transport-mode-spring-servlet') as HTMLButtonElement).disabled).toBe(false);
  });

  it('undefined callType leaves modes enabled (no call selected yet)', () => {
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType={undefined}
        onTransportModeChange={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-transport-mode-grpc-web') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('grpc-transport-mode-spring-servlet') as HTMLButtonElement).disabled).toBe(false);
  });

  it('client_streaming: disabled grpc-web shows reason label', () => {
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType="client_streaming"
        onTransportModeChange={vi.fn()}
      />,
    );

    const reason = screen.getByTestId('grpc-transport-mode-reason-grpc-web');
    expect(reason).toBeTruthy();
    expect(reason.textContent).toBe('Not supported for this call type');
  });

  it('client_streaming: disabled spring-servlet shows reason label', () => {
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType="client_streaming"
        onTransportModeChange={vi.fn()}
      />,
    );

    const reason = screen.getByTestId('grpc-transport-mode-reason-spring-servlet');
    expect(reason).toBeTruthy();
    expect(reason.textContent).toBe('Not supported for this call type');
  });

  it('no reason label shown for enabled modes', () => {
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType="unary"
        onTransportModeChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('grpc-transport-mode-reason-express')).toBeNull();
    expect(screen.queryByTestId('grpc-transport-mode-reason-grpc-web')).toBeNull();
    expect(screen.queryByTestId('grpc-transport-mode-reason-spring-servlet')).toBeNull();
  });

  it('desktop-only tauri shows "Desktop only" reason on web', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType="unary"
        onTransportModeChange={vi.fn()}
      />,
    );

    const reason = screen.getByTestId('grpc-transport-mode-reason-tauri');
    expect(reason.textContent).toBe('Desktop only');
  });

  it('browser-direct modes do not show platform reason on Tauri desktop', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType="unary"
        onTransportModeChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('grpc-transport-mode-reason-grpc-web')).toBeNull();
    expect(screen.queryByTestId('grpc-transport-mode-reason-spring-servlet')).toBeNull();
  });

  it('clicking call-type-disabled mode does not fire onTransportModeChange', () => {
    const onTransportModeChange = vi.fn();
    render(
      <GrpcTransportPanel
        transportMode="express"
        callType="client_streaming"
        onTransportModeChange={onTransportModeChange}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-transport-mode-grpc-web'));
    expect(onTransportModeChange).not.toHaveBeenCalled();
  });
});
