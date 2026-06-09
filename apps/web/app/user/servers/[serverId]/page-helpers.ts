import type { StatusTone } from "@mcp-hub/ui";

import type {
  ApiGrant,
  ApiMcpServer,
  ApiMcpTool,
  InstallMethod,
  MarketCategory,
  MarketTrustLevel,
  MarketVisibility,
} from "../../../../lib/api";

export type UseCaseSummary = Readonly<{
  items: string[];
  source: "metadata" | "tools" | "empty";
}>;

type GrantLike = Pick<ApiGrant, "serverId" | "allowedTools" | "enabled">;

export function buildUserToolAccessStatus(
  server: Pick<ApiMcpServer, "enabled" | "quarantined">,
  tools: ApiMcpTool[],
  grants: GrantLike[] | undefined,
) {
  const statuses = new Map<string, string>();

  for (const tool of tools) {
    if (!server.enabled) {
      statuses.set(toolKey(tool), "사용 불가: 서버 비활성");
      continue;
    }

    if (server.quarantined) {
      statuses.set(toolKey(tool), "사용 불가: 서버 격리");
      continue;
    }

    if (!tool.enabled) {
      statuses.set(toolKey(tool), "사용 불가: 도구 비활성");
      continue;
    }

    if (!grants) {
      statuses.set(toolKey(tool), "권한 상태 확인 불가");
      continue;
    }

    statuses.set(
      toolKey(tool),
      grants.some((grant) => grantAllowsTool(grant, tool))
        ? "사용 가능"
        : "접근 요청 필요",
    );
  }

  return statuses;
}

export function hasActiveServerAccess(grants: GrantLike[]) {
  return grants.some((grant) => grant.enabled);
}

export function buildRequestedTools(tools: ApiMcpTool[]) {
  const enabledTools = tools
    .filter((tool) => tool.enabled)
    .map((tool) => tool.name);

  return enabledTools.length > 0 ? enabledTools : ["*"];
}

export function buildAccessRequestHref(
  server: Pick<ApiMcpServer, "id" | "environment">,
  requestedTools: string[],
) {
  const params = new URLSearchParams({
    serverId: server.id,
    requestedTools: requestedTools.join(","),
    environment: server.environment,
  });

  return `/user/access?${params.toString()}`;
}

export function deriveServerSummary(server: Pick<ApiMcpServer, "summary" | "description">) {
  return server.summary ?? server.description ?? "공개된 서버 설명이 없습니다.";
}

export function deriveUseCases(
  server: Pick<ApiMcpServer, "useCases">,
  tools: ApiMcpTool[],
): UseCaseSummary {
  const useCases = compactText(server.useCases);
  if (useCases.length > 0) {
    return { items: useCases, source: "metadata" };
  }

  const toolSummaries = tools
    .map((tool) => {
      const description = tool.description?.trim();
      return description ? `${tool.name}: ${description}` : "";
    })
    .filter((item) => item.length > 0)
    .slice(0, 4);

  return toolSummaries.length > 0
    ? { items: toolSummaries, source: "tools" }
    : { items: [], source: "empty" };
}

export function compactText(values: string[] | undefined) {
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function formatMarketCategory(category: MarketCategory | undefined) {
  switch (category) {
    case "developer_tools":
      return "개발 도구";
    case "api_development":
      return "API 개발";
    case "data_database":
      return "데이터/데이터베이스";
    case "cloud_infra":
      return "클라우드/인프라";
    case "observability":
      return "관측성";
    case "security_testing":
      return "보안/테스트";
    case "knowledge_docs":
      return "지식/문서";
    case "productivity_workflow":
      return "생산성/워크플로";
    case "browser_automation":
      return "브라우저 자동화";
    case "design_tools":
      return "디자인 도구";
    case "other":
      return "기타";
    default:
      return "카테고리 없음";
  }
}

export function formatInstallMethod(method: InstallMethod) {
  switch (method) {
    case "remote_http":
      return "원격 HTTP";
    case "stdio":
      return "stdio";
    case "docker":
      return "Docker";
    case "gateway":
      return "Gateway";
  }
}

export function formatTrustLevel(level: MarketTrustLevel | undefined) {
  switch (level) {
    case "community":
      return "커뮤니티";
    case "verified":
      return "검증됨";
    case "official":
      return "공식";
    case "platform_supported":
      return "플랫폼 지원";
    default:
      return "신뢰 등급 없음";
  }
}

export function trustTone(level: MarketTrustLevel | undefined): StatusTone {
  if (level === "official" || level === "platform_supported") {
    return "success";
  }

  if (level === "verified") {
    return "info";
  }

  return "neutral";
}

export function formatVisibility(visibility: MarketVisibility | undefined) {
  switch (visibility) {
    case "draft":
      return "초안";
    case "internal":
      return "내부";
    case "published":
      return "게시됨";
    case "hidden":
      return "숨김";
    case "quarantined":
      return "격리됨";
    default:
      return "가시성 없음";
  }
}

export function visibilityTone(visibility: MarketVisibility | undefined): StatusTone {
  if (visibility === "published" || visibility === "internal") {
    return "success";
  }

  if (visibility === "quarantined") {
    return "danger";
  }

  if (visibility === "draft" || visibility === "hidden") {
    return "warning";
  }

  return "neutral";
}

function grantAllowsTool(grant: GrantLike, tool: ApiMcpTool) {
  return (
    grant.enabled &&
    grant.serverId === tool.serverId &&
    (grant.allowedTools.includes(tool.name) || grant.allowedTools.includes("*"))
  );
}

function toolKey(tool: ApiMcpTool) {
  return `${tool.serverId}:${tool.name}`;
}
