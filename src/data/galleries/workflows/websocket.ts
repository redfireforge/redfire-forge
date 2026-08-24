import type { Workflow } from '@workflow/types/workflow';
import {
  makeStartNode,
  makeEndNode,
  makeConditionNode,
  makeLogDebugNode,
  makeSetVariableNode,
  makeGetNode,
  makeEdge,
} from './nodeFactories';

/**
 * WebSocket gallery workflow samples.
 *
 * Five samples spanning easy → advanced:
 *  1. WebSocket Echo Ping (easy)            — Connect + Send + Receive + condition assert
 *  2. WebSocket JSON Message Exchange (easy)— Subscribe, receive trade event, extract price, assert > 0
 *  3. WebSocket Chat Flow (medium)          — Auth handshake + chat send/receive + condition
 *  4. WebSocket Inbound Trigger (medium)    — wsTrigger entry → HTTP GET → condition → logDebug
 *  5. WebSocket + HTTP Hybrid (advanced)    — Connect + subscribe + receive price_drop → HTTP enrichment → ack
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. Easy: WebSocket Echo Ping
//    Start → wsConnect → wsSend ("ping") → wsReceive → condition → End
// ────────────────────────────────────────────────────────────────────────────
export function createWsEchoPingWorkflow(): Workflow {
  return {
    id: 'sample-ws-echo',
    name: 'Sample: WebSocket Echo Ping',
    description:
      'Connect to a public echo WebSocket server, send "ping", receive the echo back, and assert the response matches.',
    variables: {
      receivedMessage: '',
    },
    nodes: [
      makeStartNode('wep-start', {}, { x: 240, y: 30 }),
      {
        id: 'wep-connect',
        type: 'wsConnect',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Connect to Echo Server',
          url: 'wss://echo.websocket.org',
          connectionId: 'ws-echo',
          headers: [],
          queryParams: [],
          subprotocols: [],
          timeoutMs: 5000,
          outputBindings: [],
        },
      },
      {
        id: 'wep-send',
        type: 'wsSend',
        position: { x: 240, y: 290 },
        data: {
          label: '2. Send ping',
          connectionId: 'ws-echo',
          message: 'ping',
          messageType: 'text',
          waitForResponse: false,
          responseTimeoutMs: 3000,
          outputBindings: [],
        },
      },
      {
        id: 'wep-receive',
        type: 'wsReceive',
        position: { x: 240, y: 430 },
        data: {
          label: '3. Receive Echo',
          connectionId: 'ws-echo',
          timeoutMs: 5000,
          matchCriteria: { messageType: 'text' },
          extractionRules: [],
          outputBindings: [
            { field: 'messageBody', variableName: 'receivedMessage', enabled: true },
          ],
        },
      },
      makeConditionNode('wep-check', '4. Echo Matches?', '{{receivedMessage}}', 'ping', {
        operator: '==',
        x: 240,
        y: 570,
      }),
      makeLogDebugNode(
        'wep-mismatch',
        '5. Echo Mismatch',
        "Echo mismatch: received '{{receivedMessage}}'",
        'warn',
        { x: 480, y: 710 },
      ),
      makeEndNode('wep-end', 'Done', { x: 240, y: 710 }),
    ],
    edges: [
      makeEdge('wep-e1', 'wep-start', 'wep-connect'),
      makeEdge('wep-e2', 'wep-connect', 'wep-send'),
      makeEdge('wep-e3', 'wep-send', 'wep-receive'),
      makeEdge('wep-e4', 'wep-receive', 'wep-check'),
      makeEdge('wep-e5', 'wep-check', 'wep-end', 'true'),
      makeEdge('wep-e6', 'wep-check', 'wep-mismatch', 'false'),
      makeEdge('wep-e7', 'wep-mismatch', 'wep-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Easy: WebSocket JSON Message Exchange
//    Start → wsConnect → wsSend (subscribe) → wsReceive (extract price) → condition → End
// ────────────────────────────────────────────────────────────────────────────
export function createWsJsonExchangeWorkflow(): Workflow {
  return {
    id: 'sample-ws-json-exchange',
    name: 'Sample: WebSocket JSON Message Exchange',
    description:
      'Connect to the Binance WebSocket stream, subscribe to BTC/USDT trade events, receive a trade message, extract the price, and assert it is greater than zero.',
    variables: {
      latestPrice: '',
    },
    nodes: [
      makeStartNode('wje-start', {}, { x: 240, y: 30 }),
      {
        id: 'wje-connect',
        type: 'wsConnect',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Connect to Binance Stream',
          url: 'wss://stream.binance.com:9443/stream',
          connectionId: 'ws-prices',
          headers: [],
          queryParams: [],
          subprotocols: [],
          timeoutMs: 8000,
          outputBindings: [],
        },
      },
      {
        id: 'wje-subscribe',
        type: 'wsSend',
        position: { x: 240, y: 290 },
        data: {
          label: '2. Subscribe to BTC Trades',
          connectionId: 'ws-prices',
          message: '{"method":"SUBSCRIBE","params":["btcusdt@trade"],"id":1}',
          messageType: 'text',
          waitForResponse: false,
          responseTimeoutMs: 3000,
          outputBindings: [],
        },
      },
      {
        id: 'wje-receive',
        type: 'wsReceive',
        position: { x: 240, y: 430 },
        data: {
          label: '3. Receive Trade Event',
          connectionId: 'ws-prices',
          timeoutMs: 10000,
          matchCriteria: { jsonPathMatch: '$.data.e', jsonPathValue: 'trade' },
          extractionRules: [{ variableName: 'latestPrice', jsonPath: '$.data.p' }],
          outputBindings: [],
        },
      },
      makeConditionNode('wje-check', '4. Price > 0?', '{{latestPrice}}', '0', {
        operator: '>',
        x: 240,
        y: 570,
      }),
      makeLogDebugNode(
        'wje-log',
        '5. Price OK',
        'BTC price OK: ${{latestPrice}}',
        'info',
        { x: 480, y: 710 },
      ),
      makeEndNode('wje-end', 'Done', { x: 240, y: 710 }),
    ],
    edges: [
      makeEdge('wje-e1', 'wje-start', 'wje-connect'),
      makeEdge('wje-e2', 'wje-connect', 'wje-subscribe'),
      makeEdge('wje-e3', 'wje-subscribe', 'wje-receive'),
      makeEdge('wje-e4', 'wje-receive', 'wje-check'),
      makeEdge('wje-e5', 'wje-check', 'wje-end', 'false'),
      makeEdge('wje-e6', 'wje-check', 'wje-log', 'true'),
      makeEdge('wje-e7', 'wje-log', 'wje-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Medium: WebSocket Chat Flow
//    Start → wsConnect → wsSend(auth) → wsReceive(auth_ok) → wsSend(msg) → wsReceive(echo) → condition → End
// ────────────────────────────────────────────────────────────────────────────
export function createWsChatFlowWorkflow(): Workflow {
  return {
    id: 'sample-ws-chat-flow',
    name: 'Sample: WebSocket Chat Flow',
    description:
      'Connect to a WebSocket chat endpoint, authenticate, send a chat message, receive the broadcast echo, and assert the content matches.',
    variables: {
      authToken: 'demo-token-123',
      wsHost: 'demo.example.com',
      receivedText: '',
    },
    nodes: [
      makeStartNode(
        'wcf-start',
        { wsHost: 'demo.example.com', authToken: 'demo-token-123' },
        { x: 240, y: 30 },
      ),
      {
        id: 'wcf-connect',
        type: 'wsConnect',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Connect to Chat Server',
          url: 'wss://{{wsHost}}/chat',
          connectionId: 'ws-chat',
          headers: [],
          queryParams: [],
          subprotocols: [],
          timeoutMs: 5000,
          outputBindings: [],
        },
      },
      {
        id: 'wcf-auth',
        type: 'wsSend',
        position: { x: 240, y: 290 },
        data: {
          label: '2. Send Auth',
          connectionId: 'ws-chat',
          message: '{"type":"auth","token":"{{authToken}}"}',
          messageType: 'text',
          waitForResponse: false,
          responseTimeoutMs: 3000,
          outputBindings: [],
        },
      },
      {
        id: 'wcf-wait-auth',
        type: 'wsReceive',
        position: { x: 240, y: 430 },
        data: {
          label: '3. Wait for Auth OK',
          connectionId: 'ws-chat',
          timeoutMs: 3000,
          matchCriteria: { jsonPathMatch: '$.type', jsonPathValue: 'auth_ok', messageType: 'text' },
          extractionRules: [],
          outputBindings: [],
        },
      },
      {
        id: 'wcf-send-msg',
        type: 'wsSend',
        position: { x: 240, y: 570 },
        data: {
          label: '4. Send Chat Message',
          connectionId: 'ws-chat',
          message: '{"type":"message","room":"general","text":"Hello from workflow"}',
          messageType: 'text',
          waitForResponse: false,
          responseTimeoutMs: 3000,
          outputBindings: [],
        },
      },
      {
        id: 'wcf-receive-echo',
        type: 'wsReceive',
        position: { x: 240, y: 710 },
        data: {
          label: '5. Receive Echo',
          connectionId: 'ws-chat',
          timeoutMs: 5000,
          matchCriteria: { jsonPathMatch: '$.type', jsonPathValue: 'message' },
          extractionRules: [{ variableName: 'receivedText', jsonPath: '$.text' }],
          outputBindings: [],
        },
      },
      makeConditionNode(
        'wcf-check',
        '6. Echo Matches?',
        '{{receivedText}}',
        'Hello from workflow',
        { operator: '==', x: 240, y: 850 },
      ),
      makeLogDebugNode(
        'wcf-mismatch',
        '7. Echo Mismatch',
        "Chat echo mismatch: '{{receivedText}}'",
        'warn',
        { x: 480, y: 990 },
      ),
      makeEndNode('wcf-end', 'Done', { x: 240, y: 990 }),
    ],
    edges: [
      makeEdge('wcf-e1', 'wcf-start', 'wcf-connect'),
      makeEdge('wcf-e2', 'wcf-connect', 'wcf-auth'),
      makeEdge('wcf-e3', 'wcf-auth', 'wcf-wait-auth'),
      makeEdge('wcf-e4', 'wcf-wait-auth', 'wcf-send-msg'),
      makeEdge('wcf-e5', 'wcf-send-msg', 'wcf-receive-echo'),
      makeEdge('wcf-e6', 'wcf-receive-echo', 'wcf-check'),
      makeEdge('wcf-e7', 'wcf-check', 'wcf-end', 'true'),
      makeEdge('wcf-e8', 'wcf-check', 'wcf-mismatch', 'false'),
      makeEdge('wcf-e9', 'wcf-mismatch', 'wcf-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Medium: WebSocket Inbound Trigger
//    wsTrigger (entry) → http GET → condition → logDebug → End
// ────────────────────────────────────────────────────────────────────────────
export function createWsTriggerWorkflow(): Workflow {
  return {
    id: 'sample-ws-trigger',
    name: 'Sample: WebSocket Inbound Trigger',
    description:
      'Workflow starts when a WebSocket message with event "order.created" arrives. Extracts the orderId and makes a downstream HTTP GET, then branches on status.',
    variables: {
      wsHost: 'demo.example.com',
      orderId: '',
      customerId: '',
    },
    nodes: [
      {
        id: 'wt-trigger',
        type: 'wsTrigger',
        position: { x: 240, y: 30 },
        data: {
          label: 'Order Created Event',
          url: 'wss://{{wsHost}}/events',
          connectionId: 'ws-trigger',
          matchCriteria: {
            jsonPathMatch: '$.event',
            jsonPathValue: 'order.created',
            messageType: 'text',
          },
          extractionRules: [
            { variableName: 'orderId', jsonPath: '$.data.orderId' },
            { variableName: 'customerId', jsonPath: '$.data.customerId' },
          ],
          samplePayload:
            '{"event":"order.created","data":{"orderId":"42","customerId":"cust-7"}}',
        },
      },
      makeGetNode(
        'wt-get-order',
        '1. Fetch Order Details',
        'https://jsonplaceholder.typicode.com/todos/{{orderId}}',
        {
          extractions: [{ name: 'status', source: 'body', expression: '$.status' }],
          x: 240,
          y: 150,
        },
      ),
      makeConditionNode('wt-check', '2. Order Confirmed?', '{{status}}', 'confirmed', {
        operator: '==',
        x: 240,
        y: 290,
      }),
      makeLogDebugNode(
        'wt-confirmed',
        '3a. Order Confirmed',
        'Order {{orderId}} confirmed for customer {{customerId}}',
        'info',
        { x: 80, y: 430 },
      ),
      makeLogDebugNode(
        'wt-not-confirmed',
        '3b. Order Not Confirmed',
        'Order {{orderId}} not confirmed — status: {{status}}',
        'warn',
        { x: 400, y: 430 },
      ),
      makeEndNode('wt-end', 'Done', { x: 240, y: 570 }),
    ],
    edges: [
      makeEdge('wt-e1', 'wt-trigger', 'wt-get-order'),
      makeEdge('wt-e2', 'wt-get-order', 'wt-check'),
      makeEdge('wt-e3', 'wt-check', 'wt-confirmed', 'true'),
      makeEdge('wt-e4', 'wt-check', 'wt-not-confirmed', 'false'),
      makeEdge('wt-e5', 'wt-confirmed', 'wt-end'),
      makeEdge('wt-e6', 'wt-not-confirmed', 'wt-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Advanced: WebSocket + HTTP Hybrid — Live Pricing Pipeline
//    Start → wsConnect → wsSend(subscribe) → wsReceive(price_drop) → http GET → setVariable → wsSend(ack) → End
// ────────────────────────────────────────────────────────────────────────────
export function createWsHttpHybridWorkflow(): Workflow {
  return {
    id: 'sample-ws-http-hybrid',
    name: 'Sample: WebSocket Live Price → HTTP Enrichment',
    description:
      'Connect to a live price feed, subscribe to alerts, wait for a price_drop event, extract productId and price, call the FakeStore API for details, build an alert message, and send an acknowledgement back over the same WebSocket connection.',
    variables: {
      priceWsUrl: 'demo-price-feed.example.com/ws',
      productId: '',
      newPrice: '',
      alertMessage: '',
    },
    nodes: [
      makeStartNode(
        'whh-start',
        { priceWsUrl: 'demo-price-feed.example.com/ws' },
        { x: 240, y: 30 },
      ),
      {
        id: 'whh-connect',
        type: 'wsConnect',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Connect to Price Feed',
          url: 'wss://{{priceWsUrl}}',
          connectionId: 'ws-prices',
          headers: [],
          queryParams: [],
          subprotocols: [],
          timeoutMs: 8000,
          outputBindings: [],
        },
      },
      {
        id: 'whh-subscribe',
        type: 'wsSend',
        position: { x: 240, y: 290 },
        data: {
          label: '2. Subscribe to Price Alerts',
          connectionId: 'ws-prices',
          message: '{"type":"subscribe","channel":"price_alerts"}',
          messageType: 'text',
          waitForResponse: false,
          responseTimeoutMs: 3000,
          outputBindings: [],
        },
      },
      {
        id: 'whh-receive',
        type: 'wsReceive',
        position: { x: 240, y: 430 },
        data: {
          label: '3. Wait for Price Drop',
          connectionId: 'ws-prices',
          timeoutMs: 30000,
          matchCriteria: { jsonPathMatch: '$.type', jsonPathValue: 'price_drop' },
          extractionRules: [
            { variableName: 'productId', jsonPath: '$.data.productId' },
            { variableName: 'newPrice', jsonPath: '$.data.price' },
          ],
          outputBindings: [],
        },
      },
      makeGetNode(
        'whh-enrich',
        '4. Fetch Product Details',
        'https://fakestoreapi.com/products/{{productId}}',
        { x: 240, y: 570 },
      ),
      makeSetVariableNode(
        'whh-set-alert',
        '5. Build Alert Message',
        [{ id: 'whh-a1', name: 'alertMessage', expression: 'Price drop: {{productId}} now ${{newPrice}}' }],
        { x: 240, y: 710 },
      ),
      {
        id: 'whh-ack',
        type: 'wsSend',
        position: { x: 240, y: 850 },
        data: {
          label: '6. Send Acknowledgement',
          connectionId: 'ws-prices',
          message: '{"type":"ack","productId":"{{productId}}","alert":"{{alertMessage}}"}',
          messageType: 'text',
          waitForResponse: false,
          responseTimeoutMs: 3000,
          outputBindings: [],
        },
      },
      makeEndNode('whh-end', 'Done', { x: 240, y: 990 }),
    ],
    edges: [
      makeEdge('whh-e1', 'whh-start', 'whh-connect'),
      makeEdge('whh-e2', 'whh-connect', 'whh-subscribe'),
      makeEdge('whh-e3', 'whh-subscribe', 'whh-receive'),
      makeEdge('whh-e4', 'whh-receive', 'whh-enrich'),
      makeEdge('whh-e5', 'whh-enrich', 'whh-set-alert'),
      makeEdge('whh-e6', 'whh-set-alert', 'whh-ack'),
      makeEdge('whh-e7', 'whh-ack', 'whh-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
