import type {
  ApiMcpServer,
  InstallMethod,
  MarketCategory,
  MarketTrustLevel,
  MarketVisibility,
} from "./api";

export const marketCategoryOptions = [
  { value: "developer_tools", label: "개발 도구" },
  { value: "api_development", label: "API 개발" },
  { value: "data_database", label: "데이터/DB" },
  { value: "cloud_infra", label: "클라우드/인프라" },
  { value: "observability", label: "관측성" },
  { value: "security_testing", label: "보안/테스트" },
  { value: "knowledge_docs", label: "지식/문서" },
  { value: "productivity_workflow", label: "생산성/워크플로" },
  { value: "browser_automation", label: "브라우저 자동화" },
  { value: "design_tools", label: "디자인 도구" },
  { value: "other", label: "기타" },
] as const satisfies readonly { value: MarketCategory; label: string }[];

export const installMethodOptions = [
  { value: "gateway", label: "Gateway" },
  { value: "remote_http", label: "Remote HTTP" },
  { value: "stdio", label: "stdio" },
  { value: "docker", label: "Docker" },
] as const satisfies readonly { value: InstallMethod; label: string }[];

export const marketTrustLevelOptions = [
  { value: "community", label: "커뮤니티" },
  { value: "verified", label: "검증됨" },
  { value: "official", label: "공식" },
  { value: "platform_supported", label: "플랫폼 지원" },
] as const satisfies readonly { value: MarketTrustLevel; label: string }[];

export const marketVisibilityOptions = [
  { value: "draft", label: "초안" },
  { value: "internal", label: "내부 공개" },
  { value: "published", label: "게시됨" },
  { value: "hidden", label: "숨김" },
  { value: "quarantined", label: "격리됨" },
] as const satisfies readonly { value: MarketVisibility; label: string }[];

export function parseDelimitedList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[,\n\r]+/u)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

export function marketVisibilityForServer(server: ApiMcpServer): MarketVisibility {
  if (server.visibility) {
    return server.visibility;
  }

  if (server.quarantined) {
    return "quarantined";
  }

  if (server.published) {
    return "published";
  }

  return server.enabled ? "internal" : "hidden";
}

export function summarizeMarketCuration(servers: ApiMcpServer[]) {
  return servers.reduce(
    (summary, server) => {
      const visibility = marketVisibilityForServer(server);
      const quarantined = visibility === "quarantined" || server.quarantined === true;

      if (visibility === "published" || server.published === true) {
        summary.published += 1;
      }

      if (!quarantined && (visibility === "draft" || visibility === "internal" || visibility === "hidden")) {
        summary.draftInternal += 1;
      }

      if (!server.reviewedAt && !server.reviewedBy) {
        summary.unreviewedMetadata += 1;
      }

      if (quarantined) {
        summary.quarantined += 1;
      }

      if (isMissingDocsOrInstall(server)) {
        summary.missingDocsOrInstall += 1;
      }

      return summary;
    },
    {
      published: 0,
      draftInternal: 0,
      unreviewedMetadata: 0,
      quarantined: 0,
      missingDocsOrInstall: 0,
    },
  );
}

export function isMissingDocsOrInstall(server: ApiMcpServer) {
  return !server.docsUrl || !server.installMethods || server.installMethods.length === 0;
}

export function formatMarketCategory(value: MarketCategory | undefined) {
  return marketCategoryOptions.find((option) => option.value === value)?.label ?? "기타";
}

export function formatInstallMethod(value: InstallMethod) {
  return installMethodOptions.find((option) => option.value === value)?.label ?? value;
}

export function formatInstallMethods(values: InstallMethod[] | undefined) {
  return values && values.length > 0 ? values.map(formatInstallMethod).join(", ") : "설치 방법 없음";
}

export function formatMarketTrustLevel(value: MarketTrustLevel | undefined) {
  return marketTrustLevelOptions.find((option) => option.value === value)?.label ?? "커뮤니티";
}

export function formatMarketVisibility(value: MarketVisibility | undefined) {
  return marketVisibilityOptions.find((option) => option.value === value)?.label ?? "상태 없음";
}

export function isMarketCategory(value: string): value is MarketCategory {
  return marketCategoryOptions.some((option) => option.value === value);
}

export function isInstallMethod(value: string): value is InstallMethod {
  return installMethodOptions.some((option) => option.value === value);
}

export function isMarketTrustLevel(value: string): value is MarketTrustLevel {
  return marketTrustLevelOptions.some((option) => option.value === value);
}

export function isMarketVisibility(value: string): value is MarketVisibility {
  return marketVisibilityOptions.some((option) => option.value === value);
}
