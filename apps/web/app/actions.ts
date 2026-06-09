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
  rejectApproval,
  revokeGrant,
  revokeServerGrants,
  testPolicyCall,
  updateServer,
  type Environment,
  type InstallMethod,
  type MarketCategory,
  type MarketTrustLevel,
  type MarketVisibility,
  type RiskLevel,
  type ServerTransport
} from "../lib/api";
import { getCurrentSession } from "../lib/auth/session";
import {
  isInstallMethod,
  isMarketCategory,
  isMarketTrustLevel,
  isMarketVisibility,
  parseDelimitedList,
} from "../lib/market";
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
      requestedExpiresAt: readDateEndOfDay(formData, "requestedExpiresOn") ?? readOptional(formData, "requestedExpiresAt"),
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
      category: readMarketCategory(formData, "category"),
      tags: readDelimitedList(formData, "tags"),
      summary: readOptional(formData, "summary"),
      useCases: readDelimitedList(formData, "useCases"),
      docsUrl: readOptional(formData, "docsUrl"),
      sourceUrl: readOptional(formData, "sourceUrl"),
      installMethods: readInstallMethods(formData),
      prerequisites: readDelimitedList(formData, "prerequisites"),
      securityNotes: readDelimitedList(formData, "securityNotes"),
      trustLevel: readMarketTrustLevel(formData, "trustLevel"),
      visibility: readMarketVisibility(formData, "visibility"),
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
      message: `${server.displayName} 서버를 등록했습니다.`
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error)
    };
  }
}

export async function updateServerMarketMetadataAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireAdminForAction();
  try {
    const serverId = readRequired(formData, "serverId");
    const server = await updateServer(serverId, {
      category: readMarketCategory(formData, "category"),
      tags: readDelimitedList(formData, "tags"),
      summary: readOptional(formData, "summary"),
      useCases: readDelimitedList(formData, "useCases"),
      docsUrl: readOptional(formData, "docsUrl"),
      sourceUrl: readOptional(formData, "sourceUrl"),
      installMethods: readInstallMethods(formData),
      prerequisites: readDelimitedList(formData, "prerequisites"),
      securityNotes: readDelimitedList(formData, "securityNotes"),
      trustLevel: readMarketTrustLevel(formData, "trustLevel"),
      reviewedBy: session.principal.email || session.principal.userId,
      reviewedAt: new Date().toISOString(),
      reason: readRequired(formData, "reason"),
    });
    revalidateServerSurfaces(serverId);
    revalidatePath("/admin/audit");
    return {
      status: "success",
      message: `${server.displayName} 마켓 메타데이터를 저장했습니다.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error),
    };
  }
}

export async function updateServerMarketLifecycleAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireAdminForAction();
  try {
    requireConfirmation(formData, "confirmMarketLifecycle");
    const serverId = readRequired(formData, "serverId");
    const marketAction = readMarketLifecycleAction(formData);
    const now = new Date().toISOString();
    const visibility = visibilityForLifecycleAction(marketAction);
    const server = await updateServer(serverId, {
      visibility,
      reviewedBy: session.principal.email || session.principal.userId,
      reviewedAt: now,
      publishedAt: visibility === "published" ? now : undefined,
      reason: readRequired(formData, "reason"),
    });
    revalidateServerSurfaces(serverId);
    revalidatePath("/admin/audit");
    return {
      status: "success",
      message: `${server.displayName} 서버를 ${marketLifecycleActionLabel(marketAction)} 상태로 변경했습니다.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error),
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
      message: `${serverId} 서버를 비활성화했습니다.`
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
      message: `${serverId} 서버의 ${toolId} 도구를 비활성화했습니다.`
    };
  } catch (error) {
    return {
      status: "error",
      message: formatApiError(error)
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
  await requireAdminForAction();
  try {
    requireConfirmation(formData, "confirmRevokeServerGrants");
    const result = await revokeServerGrants(readRequired(formData, "serverId"));
    revalidatePath("/admin/emergency");
    revalidatePath("/user/access");
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

function readDateEndOfDay(formData: FormData, name: string) {
  const value = readOptional(formData, name);
  if (!value) {
    return undefined;
  }

  return `${value}T23:59:59.000Z`;
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

function readDelimitedList(formData: FormData, name: string) {
  return parseDelimitedList(readOptional(formData, name));
}

function readMarketCategory(formData: FormData, name: string): MarketCategory {
  const value = readRequired(formData, name);
  if (isMarketCategory(value)) {
    return value;
  }

  throw new Error(`${name}이(가) 올바르지 않습니다`);
}

function readInstallMethods(formData: FormData): InstallMethod[] {
  const values = formData.getAll("installMethods");
  const methods = values.map((value) => {
    if (typeof value !== "string" || !isInstallMethod(value)) {
      throw new Error("installMethods가 올바르지 않습니다");
    }

    return value;
  });

  if (methods.length === 0) {
    throw new Error("installMethods는 하나 이상 선택해야 합니다");
  }

  return Array.from(new Set(methods));
}

function readMarketTrustLevel(formData: FormData, name: string): MarketTrustLevel {
  const value = readRequired(formData, name);
  if (isMarketTrustLevel(value)) {
    return value;
  }

  throw new Error(`${name}이(가) 올바르지 않습니다`);
}

function readMarketVisibility(formData: FormData, name: string): MarketVisibility {
  const value = readRequired(formData, name);
  if (isMarketVisibility(value)) {
    return value;
  }

  throw new Error(`${name}이(가) 올바르지 않습니다`);
}

type MarketLifecycleAction = "publish" | "unpublish" | "quarantine" | "unquarantine";

function readMarketLifecycleAction(formData: FormData): MarketLifecycleAction {
  const value = readRequired(formData, "marketAction");
  if (value === "publish" || value === "unpublish" || value === "quarantine" || value === "unquarantine") {
    return value;
  }

  throw new Error("marketAction이 올바르지 않습니다");
}

function visibilityForLifecycleAction(action: MarketLifecycleAction): MarketVisibility {
  if (action === "publish") {
    return "published";
  }

  if (action === "quarantine") {
    return "quarantined";
  }

  return "internal";
}

function marketLifecycleActionLabel(action: MarketLifecycleAction) {
  if (action === "publish") {
    return "게시됨";
  }

  if (action === "quarantine") {
    return "격리됨";
  }

  return "내부 공개";
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
