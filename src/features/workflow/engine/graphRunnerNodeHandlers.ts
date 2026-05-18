/**
 * Barrel file for workflow node handler context types and all node handlers.
 *
 * Handlers are split across focused modules:
 *   graphRunnerHttpHandler          — HTTP
 *   graphRunnerTriggerHandlers      — Start, WebhookTrigger, ScheduleTrigger
 *   graphRunnerControlFlowHandlers  — Condition, Delay, Fork, Join, Switch
 *   graphRunnerLoopHandlers         — Loop
 *   graphRunnerVariableScriptHandlers — SetVariable, Script, Aggregate
 *   graphRunnerLogWaitHandlers      — LogDebug, WaitForCondition
 *   graphRunnerCorrelationWaitHandler — CorrelationWait
 *   graphRunnerErrorHandler         — ErrorHandler
 *   graphRunnerSubWorkflowHandler   — SubWorkflow
 *
 * All imports from this file continue to work unchanged via re-exports.
 */

// ── Shared context types ──────────────────────────────────────────────────────
export type {
  NodeHandlerContext,
  CorrelationWaitRunnerConfig,
  PassedFlag,
} from './graphRunnerNodeHandlerContext';

// ── HTTP ──────────────────────────────────────────────────────────────────────
export { handleHttpNode } from './graphRunnerHttpHandler';

// ── Trigger nodes ─────────────────────────────────────────────────────────────
export {
  handleStartNode,
  handleWebhookNode,
  handleScheduleNode,
} from './graphRunnerTriggerHandlers';

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
