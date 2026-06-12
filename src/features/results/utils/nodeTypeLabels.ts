/**
 * Shared node-type label maps for the Results Explorer.
 *
 * Two styles:
 *  - "console" → Title Case, used in console log lines (e.g. "HTTP", "Sub-Workflow")
 *  - "explorer" → UPPERCASE, used in detail panel headers (e.g. "HTTP", "SUB-WORKFLOW")
 */

const CONSOLE_LABELS: Record<string, string> = {
  http: 'HTTP',
  condition: 'Condition',
  delay: 'Delay',
  fork: 'Fork',
  join: 'Join',
  loop: 'Loop',
  setVariable: 'Set Variable',
  script: 'Script',
  aggregate: 'Aggregate',
  correlationWait: 'Correlation Wait',
  waitForCondition: 'Wait For Condition',
  subWorkflow: 'Sub-Workflow',
  webhook: 'Webhook',
  schedule: 'Schedule',
  start: 'Start',
  end: 'End',
  switch: 'Switch',
  logDebug: 'Log / Debug',
  errorHandler: 'Error Handler',
  group: 'Group',
  parallel: 'Parallel',
  kafkaProduce: 'Kafka Produce',
  kafkaConsume: 'Kafka Consume',
  kafkaTrigger: 'Kafka Trigger',
  kafkaWait: 'Kafka Wait',
  wsConnect: 'WS Connect',
  wsSend: 'WS Send',
  wsReceive: 'WS Receive',
  wsTrigger: 'WS Trigger',
};

const EXPLORER_LABELS: Record<string, string> = {
  start: 'START',
  http: 'HTTP',
  script: 'SCRIPT',
  logDebug: 'LOG / DEBUG',
  delay: 'DELAY',
  condition: 'CONDITION',
  switch: 'SWITCH',
  fork: 'FORK',
  join: 'JOIN',
  loop: 'LOOP',
  setVariable: 'SET VARIABLE',
  aggregate: 'AGGREGATE',
  subWorkflow: 'SUB-WORKFLOW',
  webhook: 'WEBHOOK',
  schedule: 'SCHEDULE',
  correlationWait: 'CORRELATION WAIT',
  waitForCondition: 'WAIT FOR CONDITION',
  end: 'END',
  errorHandler: 'ERROR HANDLER',
  group: 'GROUP',
  parallel: 'PARALLEL',
  kafkaProduce: 'KAFKA PRODUCE',
  kafkaConsume: 'KAFKA CONSUME',
  kafkaTrigger: 'KAFKA TRIGGER',
  kafkaWait: 'KAFKA WAIT',
  wsConnect: 'WS CONNECT',
  wsSend: 'WS SEND',
  wsReceive: 'WS RECEIVE',
  wsTrigger: 'WS TRIGGER',
};

export function formatNodeTypeConsole(type: string): string {
  return CONSOLE_LABELS[type] ?? type;
}

export function formatNodeTypeExplorer(type: string): string {
  return EXPLORER_LABELS[type] ?? type.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
}
