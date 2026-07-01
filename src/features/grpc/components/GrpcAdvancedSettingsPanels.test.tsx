/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GrpcK8sPortForwardPanel } from './GrpcK8sPortForwardPanel';
import { GrpcTransportPanel } from './GrpcTransportPanel';

describe('GrpcK8sPortForwardPanel (Phase 4J-D)', () => {
  it('renders stub form with disabled start', () => {
    render(<GrpcK8sPortForwardPanel />);
    expect(screen.getByTestId('grpc-k8s-panel')).toBeTruthy();
    expect((screen.getByTestId('grpc-k8s-start-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('grpc-k8s-deferred').textContent).toMatch(/not wired/i);
  });
});

describe('GrpcTransportPanel (Phase 4J-D)', () => {
  it('shows express proxy as active mode on web', () => {
    render(<GrpcTransportPanel transportMode="express" />);
    expect(screen.getByTestId('grpc-transport-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-transport-mode-express').className).toMatch(/active/);
    expect(screen.getByTestId('grpc-transport-mode-tauri').className).toMatch(/disabled/);
  });
});
