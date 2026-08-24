/**
 * WebSocket test gallery preset factories.
 *
 * Two samples showing how to configure WebSocket action scenarios in the test harness:
 *  1. TG-WS-01 — WebSocket Echo Smoke Test (easy)      — connect + send "ping" + receive + assert body
 *  2. TG-WS-02 — WebSocket JSON Subscribe & Assert (medium) — connect + receive JSON event + assert fields
 *
 * TG-WS-01 uses echo.websocket.org (public echo server).
 * TG-WS-02 uses the Binance BTC/USDT trade stream for a real-world JSON subscription example.
 */

import { ts, s } from './presets-helpers';
import type { FeatureGroup } from './presets-helpers';

// ─── TG-WS-01: WebSocket Echo Smoke Test ─────────────────────────────────────

export function createWsEchoTest(): FeatureGroup {
  return {
    id: 'test-ws-echo',
    name: 'WebSocket: Echo Smoke Test',
    scenarios: [
      ts({
        id: 'sc-ws-echo-connect',
        name: 'Connect to echo server',
        tests: [
          s({
            id: 'sc-ws-echo-connect-step',
            name: 'wsConnect → echo.websocket.org',
            url: 'wss://echo.websocket.org',
            method: 'WEBSOCKET',
            actionType: 'wsConnect',
            wsConnectAction: {
              url: 'wss://echo.websocket.org',
              connectionId: 'ws-echo',
              timeoutMs: 10000,
            },
          }),
        ],
      }),
      ts({
        id: 'sc-ws-echo-send',
        name: 'Send "ping"',
        tests: [
          s({
            id: 'sc-ws-echo-send-step',
            name: 'wsSend → "ping"',
            url: 'wss://echo.websocket.org',
            method: 'WEBSOCKET',
            actionType: 'wsSend',
            wsSendAction: {
              connectionRef: 'ws-echo',
              message: 'ping',
              messageType: 'text',
              waitForResponse: false,
            },
          }),
        ],
      }),
      ts({
        id: 'sc-ws-echo-receive',
        name: 'Receive echo and assert',
        tests: [
          s({
            id: 'sc-ws-echo-receive-step',
            name: 'wsReceive → assert ws.body equals "ping"',
            url: 'wss://echo.websocket.org',
            method: 'WEBSOCKET',
            actionType: 'wsReceive',
            wsReceiveAction: {
              connectionRef: 'ws-echo',
              timeoutMs: 8000,
            },
            assertions: [
              { type: 'wsField', target: 'ws.body', operator: 'equals', value: 'ping' },
            ],
          }),
        ],
      }),
    ],
  };
}

// ─── TG-WS-02: WebSocket JSON Subscribe & Assert ─────────────────────────────

export function createWsSubscribeTest(): FeatureGroup {
  return {
    id: 'test-ws-subscribe',
    name: 'WebSocket: JSON Subscribe & Assert',
    scenarios: [
      ts({
        id: 'sc-ws-subscribe-connect',
        name: 'Connect to Binance BTC/USDT trade stream',
        tests: [
          s({
            id: 'sc-ws-subscribe-connect-step',
            name: 'wsConnect → stream.binance.com BTC/USDT',
            url: 'wss://stream.binance.com:9443/ws/btcusdt@trade',
            method: 'WEBSOCKET',
            actionType: 'wsConnect',
            wsConnectAction: {
              url: 'wss://stream.binance.com:9443/ws/btcusdt@trade',
              connectionId: 'ws-binance-trade',
              timeoutMs: 10000,
            },
          }),
        ],
      }),
      ts({
        id: 'sc-ws-subscribe-receive',
        name: 'Receive first trade event and assert shape',
        tests: [
          s({
            id: 'sc-ws-subscribe-receive-step',
            name: 'wsReceive → assert $.e exists and $.s equals "BTCUSDT"',
            url: 'wss://stream.binance.com:9443/ws/btcusdt@trade',
            method: 'WEBSOCKET',
            actionType: 'wsReceive',
            wsReceiveAction: {
              connectionRef: 'ws-binance-trade',
              timeoutMs: 10000,
            },
            assertions: [
              { type: 'wsField', target: 'ws.$.e', operator: 'exists' },
              { type: 'wsField', target: 'ws.$.s', operator: 'equals', value: 'BTCUSDT' },
            ],
            extractions: [
              { name: 'tradePrice', source: 'body', expression: '$.p' },
              { name: 'tradeEventType', source: 'body', expression: '$.e' },
            ],
          }),
        ],
      }),
    ],
  };
}
