/**
 * Barrel file for workflow node handler context types and all node handlers.
 *
 * Handlers are split across focused modules:
 *   graphRunnerHttpHandler          — HTTP
 *   graphRunnerTriggerHandlers      — Start, WebhookTrigger, ScheduleTrigger, KafkaTrigger
 *   graphRunnerControlFlowHandlers  — Condition, Delay, Fork, Join, Switch
 *   graphRunnerLoopHandlers         — Loop
 *   graphRunnerVariableScriptHandlers — SetVariable, Script, Aggregate
 *   graphRunnerLogWaitHandlers      — LogDebug, WaitForCondition
 *   graphRunnerCorrelationWaitHandler — CorrelationWait
 *   graphRunnerErrorHandler         — ErrorHandler
 *   graphRunnerSubWorkflowHandler   — SubWorkflow
 *   graphRunnerKafkaNodeHandlers    — KafkaProduce, KafkaConsume
 *   graphRunnerWsNodeHandlers       — WsConnect, WsSend, WsReceive, WsTrigger
 *
 * All imports from this file continue to work unchanged via re-exports.
 */

// ── Shared context types ──────────────────────────────────────────────────────
export type {
  NodeHandlerContext,
  CorrelationWaitRunnerConfig,
  PassedFlag,
  KafkaNodeOperations,
  KafkaProduceResult,
  KafkaConsumedMessage,
  WsNodeOperations,
  WsConnectResult,
  WsSendResult,
  WsReceivedMessage,
  WsMessageMatchCriteria,
  GrpcNodeOperations,
} from './graphRunnerNodeHandlerContext';

// ── HTTP ──────────────────────────────────────────────────────────────────────
export { handleHttpNode } from './graphRunnerHttpHandler';

// ── Trigger nodes ─────────────────────────────────────────────────────────────
export {
  handleStartNode,
  handleWebhookNode,
  handleScheduleNode,
  handleKafkaTriggerNode,
  matchesKafkaMessageFilters,
} from './graphRunnerTriggerHandlers';

// ── Kafka Wait node ───────────────────────────────────────────────────────────
export { handleKafkaWaitNode } from './graphRunnerKafkaWaitHandler';

// ── Control-flow nodes ────────────────────────────────────────────────────────
export {
  handleConditionNode,
  handleDelayNode,
  handleForkNode,
  handleJoinNode,
  handleSwitchNode,
} from './graphRunnerControlFlowHandlers';

// ── Loop ──────────────────────────────────────────────────────────────────────
export { handleLoopNode } from './graphRunnerLoopHandlers';

// ── Variable / Script / Aggregate ─────────────────────────────────────────────
export {
  handleSetVariableNode,
  handleScriptNode,
  handleAggregateNode,
} from './graphRunnerVariableScriptHandlers';

// ── Log / WaitForCondition ────────────────────────────────────────────────────
export {
  handleLogDebugNode,
  handleWaitForConditionNode,
} from './graphRunnerLogWaitHandlers';

// ── CorrelationWait ───────────────────────────────────────────────────────────
export { handleCorrelationWaitNode } from './graphRunnerCorrelationWaitHandler';

// ── Error handler / SubWorkflow ───────────────────────────────────────────────
export { handleErrorHandlerNode } from './graphRunnerErrorHandler';
export { handleSubWorkflowNode } from './graphRunnerSubWorkflowHandler';

// ── Kafka nodes ───────────────────────────────────────────────────────────────
export { handleKafkaProduceNode, handleKafkaConsumeNode, classifyKafkaFailure, getKafkaSourceValue } from './graphRunnerKafkaNodeHandlers';

// ── WebSocket nodes ───────────────────────────────────────────────────────────
export { handleWsConnectNode, handleWsSendNode, handleWsReceiveNode, handleWsTriggerNode, classifyWsFailure } from './graphRunnerWsNodeHandlers';

// ── GraphQL nodes ─────────────────────────────────────────────────────────────
export { handleGraphqlQueryNode, handleGraphqlSubscriptionNode, handleGraphqlIntrospectNode, handleGraphqlAssertNode } from './graphRunnerGraphqlNodeHandlers';

// ── gRPC nodes ────────────────────────────────────────────────────────────────
export { handleGrpcUnaryNode, handleGrpcServerStreamNode, handleGrpcAssertNode } from './graphRunnerGrpcNodeHandlers';
