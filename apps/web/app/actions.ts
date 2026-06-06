"use server";

import { revalidatePath } from "next/cache";

import type { FormActionState } from "./action-state";
import {
  approveApproval,
  createApproval,
  createGrant,
  createServer,
  disableServer,
  disableTool,
  enableEmergencyDeny,
  enableServer,
  enableTool,
  formatApiError,
  generateClientConfig,
  rejectApproval,
  revokeGrant,
  revokeServerGrants,
  type ClientConfigKind,
  type Environment,
  type RiskLevel,
  type ServerTransport
} from "../lib/api";

export async function approveApprovalAction(formData: FormData) {
  const approvalId = readRequired(formData, "approvalId");
  const reviewComment = readOptional(formData, "reviewComment");
  try {
    await approveApproval(approvalId, {
      allowedTools: readCsvOptional(formData, "allowedTools"),
      expiresAt: readOptional(formData, "expiresAt"),
      reviewComment,
      reason: reviewComment
    });
    revalidatePath("/approvals");
    revalidatePath("/");
  } catch {
    revalidatePath("/approvals");
  }
}

export async function rejectApprovalAction(formData: FormData) {
  const approvalId = readRequired(formData, "approvalId");
  try {
    await rejectApproval(approvalId, {
      reviewComment: readOptional(formData, "reviewComment")
    });
    revalidatePath("/approvals");
    revalidatePath("/");
  } catch {
    revalidatePath("/approvals");
  }
}

export async function createApprovalAction(formData: FormData) {
  try {
    await createApproval({
      subjectType: readSubjectType(formData),
      subjectId: readRequired(formData, "subjectId"),
      projectId: readRequired(formData, "projectId"),
      serverId: readRequired(formData, "serverId"),
      requestedTools: readCsv(formData, "requestedTools"),
      environment: readEnvironment(formData),
      reason: readRequired(formData, "reason"),
      ticketUrl: readOptional(formData, "ticketUrl"),
      requestedExpiresAt: readOptional(formData, "requestedExpiresAt"),
      requestedAction: readRequired(formData, "requestedAction")
    });
    revalidatePath("/access");
    revalidatePath("/approvals");
    revalidatePath("/");
  } catch {
    revalidatePath("/access");
  }
}

export async function createServerAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const server = await createServer({
      slug: readRequired(formData, "slug"),
      displayName: readRequired(formData, "displayName"),
      description: readOptional(formData, "description"),
      ownerTeamId: readRequired(formData, "ownerTeamId"),
      environment: readEnvironment(formData),
      transport: readTransport(formData),
      upstreamUrl: readOptional(formData, "upstreamUrl"),
      enabled: readBoolean(formData, "enabled"),
      riskLevel: readRiskLevel(formData, "riskLevel"),
      tools: [
        {
          name: readRequired(formData, "toolName"),
          description: readOptional(formData, "toolDescription"),
          enabled: readBoolean(formData, "toolEnabled"),
          riskLevel: readRiskLevel(formData, "toolRiskLevel"),
          inputSchema: readJsonRecord(formData, "toolInputSchema")
        }
      ]
    });
    revalidatePath("/catalog");
    revalidatePath("/");
    return {
      status: "success",
      message: `Registered ${server.displayName} through /api/servers.`
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error)
    };
  }
}

export async function createGrantAction(formData: FormData) {
  try {
    await createGrant({
      subjectType: readSubjectType(formData),
      subjectId: readRequired(formData, "subjectId"),
      projectId: readRequired(formData, "projectId"),
      serverId: readRequired(formData, "serverId"),
      allowedTools: readCsv(formData, "allowedTools"),
      environment: readEnvironment(formData),
      expiresAt: readOptional(formData, "expiresAt"),
      reason: readRequired(formData, "reason"),
      ticketUrl: readOptional(formData, "ticketUrl"),
      enabled: true
    });
    revalidatePath("/access");
    revalidatePath("/");
  } catch {
    revalidatePath("/access");
  }
}

export async function revokeGrantAction(formData: FormData) {
  const grantId = readRequired(formData, "grantId");
  try {
    await revokeGrant(grantId);
    revalidatePath("/access");
    revalidatePath("/admin");
    revalidatePath("/");
  } catch {
    revalidatePath("/access");
  }
}

export async function enableServerAction(formData: FormData) {
  const serverId = readRequired(formData, "serverId");
  try {
    await enableServer(serverId);
    revalidateServerSurfaces(serverId);
  } catch {
    revalidateServerSurfaces(serverId);
  }
}

export async function disableServerAction(formData: FormData) {
  const serverId = readRequired(formData, "serverId");
  try {
    await disableServer(serverId);
    revalidateServerSurfaces(serverId);
  } catch {
    revalidateServerSurfaces(serverId);
  }
}

export async function enableToolAction(formData: FormData) {
  const serverId = readRequired(formData, "serverId");
  const toolId = readRequired(formData, "toolId");
  try {
    await enableTool(serverId, toolId);
    revalidateToolSurfaces(serverId);
  } catch {
    revalidateToolSurfaces(serverId);
  }
}

export async function disableToolAction(formData: FormData) {
  const serverId = readRequired(formData, "serverId");
  const toolId = readRequired(formData, "toolId");
  try {
    await disableTool(serverId, toolId);
    revalidateToolSurfaces(serverId);
  } catch {
    revalidateToolSurfaces(serverId);
  }
}

export async function adminDisableServerAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    requireConfirmation(formData, "confirmServerDisable");
    const serverId = readRequired(formData, "serverId");
    await disableServer(serverId);
    revalidateServerSurfaces(serverId);
    return {
      status: "success",
      message: `Server ${serverId} disabled through the Control Plane API.`
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error)
    };
  }
}

export async function adminDisableToolAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    requireConfirmation(formData, "confirmToolDisable");
    const [serverId, toolId] = readToolRef(formData);
    await disableTool(serverId, toolId);
    revalidateToolSurfaces(serverId);
    return {
      status: "success",
      message: `Tool ${toolId} disabled on server ${serverId}.`
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error)
    };
  }
}

export async function generateClientConfigAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  const serverId = readRequired(formData, "serverId");
  const client = readClientConfigKind(formData);
  try {
    const result = await generateClientConfig(serverId, client);
    const gatewayUrl = result.gatewayUrl ?? extractGatewayUrl(result.config);
    return {
      status: "success",
      message: result.placeholder ? "Generated placeholder client config from the Control Plane API." : "Generated client config from the Control Plane API.",
      payload: JSON.stringify(result.config, null, 2),
      selectedServerId: serverId,
      selectedClient: client,
      gatewayUrl
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error),
      selectedServerId: serverId,
      selectedClient: client
    };
  }
}

export async function emergencyDenyAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    requireConfirmation(formData, "confirmEmergencyDeny");
    const result = await enableEmergencyDeny(readRequired(formData, "reason"));
    revalidatePath("/admin");
    revalidatePath("/audit");
    return {
      status: "success",
      message: `Emergency deny enabled at ${result.createdAt}: ${result.reason}`
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error)
    };
  }
}

export async function revokeServerGrantsAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    requireConfirmation(formData, "confirmRevokeServerGrants");
    const result = await revokeServerGrants(readRequired(formData, "serverId"));
    revalidatePath("/admin");
    revalidatePath("/access");
    return {
      status: "success",
      message: `Revoked ${result.revoked} grant(s) for server ${result.serverId}.`
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error)
    };
  }
}

function readBoolean(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function readRequired(formData: FormData, name: string) {
  const value = readOptional(formData, name);
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function readOptional(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readCsv(formData: FormData, name: string) {
  return readRequired(formData, name)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readCsvOptional(formData: FormData, name: string) {
  const value = readOptional(formData, name);
  if (!value) {
    return undefined;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : undefined;
}

function readEnvironment(formData: FormData): Environment {
  const value = readRequired(formData, "environment");
  if (value === "dev" || value === "stg" || value === "prod" || value === "shared") {
    return value;
  }

  throw new Error("environment is invalid");
}


function readTransport(formData: FormData): ServerTransport {
  const value = readRequired(formData, "transport");
  if (value === "streamable_http" || value === "sse_legacy" || value === "stdio_adapter" || value === "external") {
    return value;
  }

  throw new Error("transport is invalid");
}

function readRiskLevel(formData: FormData, name: string): RiskLevel {
  const value = readRequired(formData, name);
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }

  throw new Error(`${name} is invalid`);
}

function readJsonRecord(formData: FormData, name: string): Record<string, unknown> {
  const raw = readRequired(formData, name);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`${name} must be valid JSON: ${detail}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

function readSubjectType(formData: FormData) {
  const value = readRequired(formData, "subjectType");
  if (value === "user" || value === "team" || value === "service_account") {
    return value;
  }

  throw new Error("subjectType is invalid");
}

function readClientConfigKind(formData: FormData): ClientConfigKind {
  const value = readRequired(formData, "client");
  if (value === "generic" || value === "opencode" || value === "claude-code" || value === "codex" || value === "vscode") {
    return value;
  }

  throw new Error("client is invalid");
}

function requireConfirmation(formData: FormData, name: string) {
  if (formData.get(name) !== "on") {
    throw new Error("Confirmation is required before running this dangerous action.");
  }
}

function readToolRef(formData: FormData): [string, string] {
  const value = readRequired(formData, "toolRef");
  const [serverId, toolId] = value.split("::");
  if (!serverId || !toolId) {
    throw new Error("toolRef is invalid");
  }

  return [serverId, toolId];
}

function extractGatewayUrl(config: Record<string, unknown>) {
  const direct = readStringProperty(config, "gatewayUrl") ?? readStringProperty(config, "gatewayURL") ?? readStringProperty(config, "url");
  if (direct) {
    return direct;
  }

  const match = JSON.stringify(config).match(/https?:\/\/[^"\\\s]+/u);
  return match ? match[0] : undefined;
}

function readStringProperty(value: Record<string, unknown>, property: string) {
  const candidate = value[property];
  return typeof candidate === "string" ? candidate : undefined;
}

function revalidateServerSurfaces(serverId: string) {
  revalidatePath(`/servers/${serverId}`);
  revalidatePath("/catalog");
  revalidatePath("/operations");
  revalidatePath("/client-config");
  revalidatePath("/admin");
  revalidatePath("/");
}

function revalidateToolSurfaces(serverId: string) {
  revalidatePath(`/servers/${serverId}`);
  revalidatePath("/tools");
  revalidatePath("/admin");
  revalidatePath("/");
}
