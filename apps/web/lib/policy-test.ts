import type { ApiPolicyDecision, PolicyTestCallInput } from "./api";

export type ToolTestRef = Readonly<{
  serverId: string;
  serverSlug: string;
  toolName: string;
}>;

export function parseToolTestRef(value: string): ToolTestRef {
  const [serverId, serverSlug, toolName] = value.split("::");
  if (!serverId || !serverSlug || !toolName) {
    throw new Error("toolTestRef is invalid");
  }

  return { serverId, serverSlug, toolName };
}

export function buildPolicyTestCallInput(ref: ToolTestRef, args: Record<string, unknown>, stepUp: boolean): PolicyTestCallInput {
  return {
    serverId: ref.serverId,
    serverSlug: ref.serverSlug,
    toolName: ref.toolName,
    dryRun: true,
    stepUp,
    arguments: args,
    mcpRequest: {
      jsonrpc: "2.0",
      id: "web-test-lab-dry-run",
      method: "tools/call",
      params: {
        name: ref.toolName,
        arguments: args
      }
    }
  };
}

export function redactPolicyTestPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactPolicyTestPayload(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? "[REDACTED]" : redactPolicyTestPayload(nestedValue)
    ])
  );
}

export function buildPolicyTestDisplayPayload(input: PolicyTestCallInput, decision: ApiPolicyDecision) {
  const redactedArguments = redactPolicyTestPayload(input.arguments);

  return {
    dryRun: true,
    upstreamCalled: false,
    request: {
      ...input.mcpRequest,
      params: {
        ...input.mcpRequest.params,
        arguments: redactedArguments
      }
    },
    policyDecision: decision,
    redactedResult: {
      toolName: input.toolName,
      arguments: redactedArguments
    }
  };
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("token")
    || normalized.includes("secret")
    || normalized.includes("password")
    || normalized.includes("authorization")
    || normalized.includes("credential")
    || normalized.endsWith("key");
}
