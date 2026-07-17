/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('main entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('boots app root without wiring tauri transports in browser mode', async () => {
    const renderMock = vi.fn();
    const createRootMock = vi.fn(() => ({ render: renderMock }));
    const setKafkaClientTransportMock = vi.fn();
    const setWsClientTransportMock = vi.fn();

    vi.doMock('react-dom/client', () => ({ createRoot: createRootMock }));
    vi.doMock('./App', () => ({ default: () => null }));
    vi.doMock('../features/workflow/components/WorkflowToastProvider', () => ({
      default: ({ children }: { children: unknown }) => children,
    }));
    vi.doMock('../shared/utils/platform', () => ({ isTauri: () => false }));
    vi.doMock('../shared/kafka/kafkaClient', () => ({ setKafkaClientTransport: setKafkaClientTransportMock }));
    vi.doMock('../shared/websocket/websocketClient', () => ({ setWsClientTransport: setWsClientTransportMock }));
    vi.doMock('../shared/kafka/kafkaNativeTauriTransport', () => ({ kafkaNativeTauriTransport: {} }));
    vi.doMock('../shared/websocket/websocketNativeTauriTransport', () => ({ wsNativeTauriTransport: {} }));

    await import('./main');

    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(setKafkaClientTransportMock).not.toHaveBeenCalled();
    expect(setWsClientTransportMock).not.toHaveBeenCalled();
  });

  it('wires tauri transports before render in tauri mode', async () => {
    const renderMock = vi.fn();
    const createRootMock = vi.fn(() => ({ render: renderMock }));
    const setKafkaClientTransportMock = vi.fn();
    const setWsClientTransportMock = vi.fn();
    const kafkaNativeTauriTransport = { kind: 'kafka' };
    const wsNativeTauriTransport = { kind: 'ws' };

    vi.doMock('react-dom/client', () => ({ createRoot: createRootMock }));
    vi.doMock('./App', () => ({ default: () => null }));
    vi.doMock('../features/workflow/components/WorkflowToastProvider', () => ({
      default: ({ children }: { children: unknown }) => children,
    }));
    vi.doMock('../shared/utils/platform', () => ({ isTauri: () => true }));
    vi.doMock('../shared/kafka/kafkaClient', () => ({ setKafkaClientTransport: setKafkaClientTransportMock }));
    vi.doMock('../shared/websocket/websocketClient', () => ({ setWsClientTransport: setWsClientTransportMock }));
    vi.doMock('../shared/kafka/kafkaNativeTauriTransport', () => ({ kafkaNativeTauriTransport }));
    vi.doMock('../shared/websocket/websocketNativeTauriTransport', () => ({ wsNativeTauriTransport }));

    await import('./main');

    expect(setKafkaClientTransportMock).toHaveBeenCalledWith(kafkaNativeTauriTransport);
    expect(setWsClientTransportMock).toHaveBeenCalledWith(wsNativeTauriTransport);
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
