"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  testPolicyCall,
  type ClientConfigKind,
  type Environment,
  type RiskLevel,
  type ServerTransport
} from "../lib/api";
import { getCurrentSession } from "../lib/auth/session";
import { buildPolicyTestCallInput, buildPolicyTestDisplayPayload, parseToolTestRef } from "../lib/policy-test";

export async function approveApprovalAction(formData: FormData) {
  await requireAdminForAction();
  const approvalId = readRequired(formData, "approvalId");
  const reviewComment = readOptional(formData, "reviewComment");
  try {
    await approveApproval(approvalId, {
      allowedTools: readCsvOptional(formData, "allowedTools"),
      expiresAt: readOptional(formData, "expiresAt"),
      reviewComment,
      reason: reviewComment
    });
    revalidatePath("/admin/approvals");
    revalidatePath("/admin");
  } catch {
    revalidatePath("/admin/approvals");
  }
}

export async function rejectApprovalAction(formData: FormData) {
  await requireAdminForAction();
  const approvalId = readRequired(formData, "approvalId");
  try {
    await rejectApproval(approvalId, {
      reviewComment: readOptional(formData, "reviewComment")
    });
    revalidatePath("/admin/approvals");
    revalidatePath("/admin");
  } catch {
    revalidatePath("/admin/approvals");
  }
}

export async function createApprovalAction(formData: FormData) {
  await requireSessionForAction();
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
    revalidatePath("/user/access");
    revalidatePath("/admin/approvals");
    revalidatePath("/user");
  } catch {
    revalidatePath("/user/access");
  }
}

export async function createServerAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requireAdminForAction();
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
    revalidatePath("/admin/servers");
    revalidatePath("/admin");
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
  await requireAdminForAction();
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
    revalidatePath("/admin");
    revalidatePath("/user/access");
  } catch {
    revalidatePath("/admin");
  }
}

export async function revokeGrantAction(formData: FormData) {
  await requireAdminForAction();
  const grantId = readRequired(formData, "grantId");
  try {
    await revokeGrant(grantId);
    revalidatePath("/admin");
    revalidatePath("/user/access");
  } catch {
    revalidatePath("/admin");
  }
}

export async function enableServerAction(formData: FormData) {
  await requireAdminForAction();
  const serverId = readRequired(formData, "serverId");
  try {
    await enableServer(serverId);
    revalidateServerSurfaces(serverId);
  } catch {
    revalidateServerSurfaces(serverId);
  }
}

export async function disableServerAction(formData: FormData) {
  await requireAdminForAction();
  const serverId = readRequired(formData, "serverId");
  try {
    await disableServer(serverId);
    revalidateServerSurfaces(serverId);
  } catch {
    revalidateServerSurfaces(serverId);
  }
}

export async function enableToolAction(formData: FormData) {
  await requireAdminForAction();
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
  await requireAdminForAction();
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
  await requireAdminForAction();
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
  await requireAdminForAction();
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
  await requireSessionForAction();
  const serverId = readRequired(formData, "serverId");
  const client = readClientConfigKind(formData);
  const profile = readOptional(formData, "profile") ?? "local";
  try {
    const result = await generateClientConfig(serverId, client, profile);
    const gatewayUrl = result.gatewayUrl ?? extractGatewayUrl(result.config);
    return {
      status: "success",
      message: result.placeholder ? "Generated placeholder client config from the Control Plane API." : "Generated client config from the Control Plane API.",
      payload: JSON.stringify(result.config, null, 2),
      selectedServerId: serverId,
      selectedClient: client,
      selectedProfile: profile,
      gatewayUrl
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error),
      selectedServerId: serverId,
      selectedClient: client,
      selectedProfile: profile
    };
  }
}

export async function testPolicyCallAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requireSessionForAction();
  const toolTestRef = readRequired(formData, "toolTestRef");
  try {
    const ref = parseToolTestRef(toolTestRef);
    const args = readJsonRecord(formData, "argumentsJson");
    const input = buildPolicyTestCallInput(ref, args, readBoolean(formData, "stepUp"));
    const decision = await testPolicyCall(input);
    const payload = buildPolicyTestDisplayPayload(input, decision);

    return {
      status: "success",
      message: `${decision.reasonCode}: ${decision.reason}`,
      payload: JSON.stringify(payload, null, 2),
      selectedToolRef: toolTestRef,
      policyEffect: decision.effect
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error),
      selectedToolRef: toolTestRef
    };
  }
}

export async function emergencyDenyAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requireAdminForAction();
  try {
    requireConfirmation(formData, "confirmEmergencyDeny");
    const result = await enableEmergencyDeny(readRequired(formData, "reason"));
    revalidatePath("/admin/emergency");
    revalidatePath("/admin/audit");
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
  await requireAdminForAction();
  try {
    requireConfirmation(formData, "confirmRevokeServerGrants");
    const result = await revokeServerGrants(readRequired(formData, "serverId"));
    revalidatePath("/admin/emergency");
    revalidatePath("/user/access");
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

async function requireSessionForAction() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

async function requireAdminForAction() {
  const session = await requireSessionForAction();
  if (!session.principal.isPlatformAdmin) {
    redirect("/forbidden");
  }
  return session;
}

function revalidateServerSurfaces(serverId: string) {
  revalidatePath(`/admin/servers/${serverId}`);
  revalidatePath(`/user/servers/${serverId}`);
  revalidatePath("/admin/servers");
  revalidatePath("/user/catalog");
  revalidatePath("/admin/operations");
  revalidatePath("/user/client-config");
  revalidatePath("/admin");
  revalidatePath("/user");
}

function revalidateToolSurfaces(serverId: string) {
  revalidatePath(`/admin/servers/${serverId}`);
  revalidatePath(`/user/servers/${serverId}`);
  revalidatePath("/user/catalog");
  revalidatePath("/admin/servers");
  revalidatePath("/admin");
  revalidatePath("/user");
}
