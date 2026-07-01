/**
 * Shared UI selectors — single source of truth for data-testid attributes
 * and CSS selectors used across E2E tests, demo lessons, and test scenarios.
 *
 * RULE: Never hardcode selector strings in demo lessons or E2E tests.
 *       Import from this file instead. When a UI element changes its
 *       testid or class name, update it HERE and TypeScript will flag
 *       every consumer that needs attention.
 */

export { APP } from './selectors/app';
export { EM, emAddProtocolItemSel, emRemoveProtocolSel } from './selectors/em';
export { WS } from './selectors/ws';
export { SSE } from './selectors/sse';
export { WF } from './selectors/wf';
export { WFR } from './selectors/wfr';
export { DEMO } from './selectors/demo';
export { KAFKA } from './selectors/kafka';
export { GQL } from './selectors/gql';
export { GRPC } from './selectors/grpc';
