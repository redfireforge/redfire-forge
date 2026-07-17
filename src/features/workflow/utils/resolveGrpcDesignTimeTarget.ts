/**
 * Resolve `{{var}}` placeholders in a gRPC Target using workflow-level defaults
 * so design-time reflection can load Service/Method dropdowns without forcing
 * the user to temporarily replace templates with a concrete host:port.
 */

const TEMPLATE_RE = /\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g;

export type GrpcDesignTimeTargetResolution = {
  /** Target after substituting known workflow variable defaults. */
  resolved: string;
  /** True when at least one `{{name}}` was replaced from workflowVariables. */
  usedWorkflowDefaults: boolean;
  /** Token names that remain as `{{name}}` after substitution. */
  unresolvedTokens: string[];
};

export function resolveGrpcDesignTimeTarget(
  target: string,
  workflowVariables: Record<string, string> = {},
): GrpcDesignTimeTargetResolution {
  const unresolvedTokens: string[] = [];
  let usedWorkflowDefaults = false;

  const resolved = target.replace(TEMPLATE_RE, (_match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(workflowVariables, name)) {
      usedWorkflowDefaults = true;
      return workflowVariables[name] ?? '';
    }
    unresolvedTokens.push(name);
    return `{{${name}}}`;
  });

  return { resolved, usedWorkflowDefaults, unresolvedTokens };
}
