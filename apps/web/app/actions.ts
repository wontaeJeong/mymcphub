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
  testPolicyCall,
  type ClientConfigKind,
  type Environment,
  type RiskLevel,
  type ServerTransport
} from "../lib/api";
import { buildPolicyTestCallInput, buildPolicyTestDisplayPayload, parseToolTestRef } from "../lib/policy-test";

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
      message: `${server.displayName} 서버를 /api/servers로 등록했습니다.`
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
      message: `${serverId} 서버를 제어 플레인 API로 비활성화했습니다.`
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
      message: `${serverId} 서버의 ${toolId} 도구를 비활성화했습니다.`
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
  const profile = readOptional(formData, "profile") ?? "local";
  try {
    const result = await generateClientConfig(serverId, client, profile);
    const gatewayUrl = result.gatewayUrl ?? extractGatewayUrl(result.config);
    return {
      status: "success",
      message: result.placeholder ? "제어 플레인 API에서 플레이스홀더 클라이언트 설정을 생성했습니다." : "제어 플레인 API에서 클라이언트 설정을 생성했습니다.",
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
  try {
    requireConfirmation(formData, "confirmEmergencyDeny");
    const result = await enableEmergencyDeny(readRequired(formData, "reason"));
    revalidatePath("/admin");
    revalidatePath("/audit");
    return {
      status: "success",
      message: `긴급 거부가 ${result.createdAt}에 활성화되었습니다: ${result.reason}`
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
      message: `${result.serverId} 서버의 권한 ${result.revoked}개를 회수했습니다.`
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
    throw new Error(`${name}은(는) 필수입니다`);
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

  throw new Error("environment가 올바르지 않습니다");
}


function readTransport(formData: FormData): ServerTransport {
  const value = readRequired(formData, "transport");
  if (value === "streamable_http" || value === "sse_legacy" || value === "stdio_adapter" || value === "external") {
    return value;
  }

  throw new Error("transport가 올바르지 않습니다");
}

function readRiskLevel(formData: FormData, name: string): RiskLevel {
  const value = readRequired(formData, name);
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }

  throw new Error(`${name}이(가) 올바르지 않습니다`);
}

function readJsonRecord(formData: FormData, name: string): Record<string, unknown> {
  const raw = readRequired(formData, name);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "잘못된 JSON";
    throw new Error(`${name}은(는) 유효한 JSON이어야 합니다: ${detail}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${name}은(는) JSON 객체여야 합니다`);
  }

  return parsed as Record<string, unknown>;
}

function readSubjectType(formData: FormData) {
  const value = readRequired(formData, "subjectType");
  if (value === "user" || value === "team" || value === "service_account") {
    return value;
  }

  throw new Error("subjectType이 올바르지 않습니다");
}

function readClientConfigKind(formData: FormData): ClientConfigKind {
  const value = readRequired(formData, "client");
  if (value === "generic" || value === "opencode" || value === "claude-code" || value === "codex" || value === "vscode") {
    return value;
  }

  throw new Error("client가 올바르지 않습니다");
}

function requireConfirmation(formData: FormData, name: string) {
  if (formData.get(name) !== "on") {
    throw new Error("위험한 작업을 실행하기 전에 확인이 필요합니다.");
  }
}

function readToolRef(formData: FormData): [string, string] {
  const value = readRequired(formData, "toolRef");
  const [serverId, toolId] = value.split("::");
  if (!serverId || !toolId) {
    throw new Error("toolRef가 올바르지 않습니다");
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
