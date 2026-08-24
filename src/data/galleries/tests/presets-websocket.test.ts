import { describe, it, expect } from 'vitest';
import {
  createWsEchoTest,
  createWsSubscribeTest,
} from './presets-websocket';

describe('presets-websocket factories', () => {
  describe('createWsEchoTest (TG-WS-01)', () => {
    it('returns a valid FeatureGroup with id test-ws-echo', () => {
      const fg = createWsEchoTest();
      expect(fg.id).toBe('test-ws-echo');
      expect(fg.name).toBe('WebSocket: Echo Smoke Test');
      expect(fg.scenarios).toHaveLength(3);
    });

    it('connect scenario uses WEBSOCKET method and wsConnect actionType', () => {
      const fg = createWsEchoTest();
      const test = fg.scenarios[0].tests[0];
      expect(test.method).toBe('WEBSOCKET');
      expect(test.actionType).toBe('wsConnect');
    });

    it('connect action targets echo.websocket.org with connectionId ws-echo', () => {
      const fg = createWsEchoTest();
      const action = fg.scenarios[0].tests[0].wsConnectAction!;
      expect(action.url).toBe('wss://echo.websocket.org');
      expect(action.connectionId).toBe('ws-echo');
    });

    it('send scenario uses WEBSOCKET method and wsSend actionType', () => {
      const fg = createWsEchoTest();
      const test = fg.scenarios[1].tests[0];
      expect(test.method).toBe('WEBSOCKET');
      expect(test.actionType).toBe('wsSend');
    });

    it('send action sends "ping" over ws-echo connection', () => {
      const fg = createWsEchoTest();
      const action = fg.scenarios[1].tests[0].wsSendAction!;
      expect(action.message).toBe('ping');
      expect(action.connectionRef).toBe('ws-echo');
    });

    it('receive scenario uses WEBSOCKET method and wsReceive actionType', () => {
      const fg = createWsEchoTest();
      const test = fg.scenarios[2].tests[0];
      expect(test.method).toBe('WEBSOCKET');
      expect(test.actionType).toBe('wsReceive');
    });

    it('receive action references ws-echo connection', () => {
      const fg = createWsEchoTest();
      const action = fg.scenarios[2].tests[0].wsReceiveAction!;
      expect(action.connectionRef).toBe('ws-echo');
    });

    it('receive scenario asserts ws.body equals "ping"', () => {
      const fg = createWsEchoTest();
      const assertions = fg.scenarios[2].tests[0].validation.assertions ?? [];
      const bodyAssertion = assertions.find(
        a => a.type === 'wsField' && (a as { target?: string }).target === 'ws.body',
      ) as { operator?: string; value?: string } | undefined;
      expect(bodyAssertion?.operator).toBe('equals');
      expect(bodyAssertion?.value).toBe('ping');
    });

    it('all scenario URLs use wss:// scheme', () => {
      const fg = createWsEchoTest();
      for (const scenario of fg.scenarios) {
        for (const test of scenario.tests) {
          expect(test.url).toMatch(/^wss:\/\//);
        }
      }
    });
  });

  describe('createWsSubscribeTest (TG-WS-02)', () => {
    it('returns a valid FeatureGroup with id test-ws-subscribe', () => {
      const fg = createWsSubscribeTest();
      expect(fg.id).toBe('test-ws-subscribe');
      expect(fg.name).toBe('WebSocket: JSON Subscribe & Assert');
      expect(fg.scenarios).toHaveLength(2);
    });

    it('connect scenario targets Binance BTC/USDT trade stream', () => {
      const fg = createWsSubscribeTest();
      const action = fg.scenarios[0].tests[0].wsConnectAction!;
      expect(action.url).toBe('wss://stream.binance.com:9443/ws/btcusdt@trade');
      expect(action.connectionId).toBe('ws-binance-trade');
    });

    it('receive scenario uses wsReceive actionType', () => {
      const fg = createWsSubscribeTest();
      const test = fg.scenarios[1].tests[0];
      expect(test.actionType).toBe('wsReceive');
    });

    it('receive scenario asserts ws.$.e exists and ws.$.s equals BTCUSDT', () => {
      const fg = createWsSubscribeTest();
      const assertions = fg.scenarios[1].tests[0].validation.assertions ?? [];
      const types = assertions.map(a => a.type);
      expect(types.every(t => t === 'wsField')).toBe(true);

      const symbolAssertion = assertions.find(
        a => (a as { target?: string }).target === 'ws.$.s',
      ) as { operator?: string; value?: string } | undefined;
      expect(symbolAssertion?.operator).toBe('equals');
      expect(symbolAssertion?.value).toBe('BTCUSDT');
    });

    it('receive scenario extracts tradePrice and tradeEventType', () => {
      const fg = createWsSubscribeTest();
      const test = fg.scenarios[1].tests[0];
      expect(test.extractions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'tradePrice' }),
          expect.objectContaining({ name: 'tradeEventType' }),
        ]),
      );
    });
  });
});
