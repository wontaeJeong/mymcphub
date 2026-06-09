import type {
  ApiApproval,
  MarketCategory,
  MarketTrustLevel,
  MarketVisibility,
  PolicyEffect,
  RiskLevel,
  ServerVersionStatus,
} from "../lib/api";
import type { StatusTone } from "@mcp-hub/ui";

export const koreanGlossary = {
  provider: "로그인 방식",
  route: "화면 경로",
  snippet: "설정 조각",
  dryRun: "사전 점검",
  stepUp: "추가 인증",
  api: "API",
  controlPlane: "제어 플레인",
  gateway: "게이트웨이",
  uuid: "UUID",
  iso: "ISO 시간",
  json: "JSON",
  hash: "해시",
  trace: "추적 ID"
} as const;

export function formatDate(value: string | undefined) {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatRiskLevel(riskLevel: RiskLevel) {
  if (riskLevel === "critical") {
    return "심각";
  }

  if (riskLevel === "high") {
    return "높음";
  }

  if (riskLevel === "medium") {
    return "중간";
  }

  return "낮음";
}

export function formatHealthStatus(status: string) {
  if (status === "healthy") {
    return "정상";
  }

  if (status === "degraded") {
    return "저하";
  }

  if (status === "unhealthy") {
    return "비정상";
  }

  return "확인 불가";
}

export function formatPolicyEffect(effect: PolicyEffect) {
  if (effect === "allow") {
    return "허용";
  }

  if (effect === "needs_approval") {
    return "승인 필요";
  }

  return "거부";
}

export function formatEnabled(enabled: boolean) {
  return enabled ? "활성" : "비활성";
}

export function formatGrantStatus(enabled: boolean) {
  return enabled ? "활성" : "회수됨";
}

export function formatApprovalStatus(status: ApiApproval["status"]) {
  if (status === "pending") {
    return "대기";
  }

  if (status === "approved") {
    return "승인";
  }

  if (status === "cancelled") {
    return "취소";
  }

  if (status === "expired") {
    return "만료";
  }

  return "거절";
}

export function formatSubjectType(subjectType: string) {
  if (subjectType === "team") {
    return "팀";
  }

  if (subjectType === "user") {
    return "사용자";
  }

  if (subjectType === "service_account") {
    return "서비스 계정";
  }

  return subjectType;
}

export function formatEnvironment(environment: string) {
  if (environment === "dev") {
    return "개발";
  }

  if (environment === "stg") {
    return "스테이징";
  }

  if (environment === "prod") {
    return "운영";
  }

  if (environment === "shared") {
    return "공용";
  }

  return environment;
}

export function formatTransport(transport: string) {
  if (transport === "streamable_http") {
    return "스트리밍 HTTP";
  }

  if (transport === "sse_legacy") {
    return "레거시 SSE";
  }

  if (transport === "stdio_adapter") {
    return "stdio 어댑터";
  }

  if (transport === "external") {
    return "외부";
  }

  return transport;
}

export function formatMarketCategory(category: MarketCategory) {
  if (category === "developer_tools") {
    return "개발 도구";
  }

  if (category === "api_development") {
    return "API 개발";
  }

  if (category === "data_database") {
    return "데이터·DB";
  }

  if (category === "cloud_infra") {
    return "클라우드·인프라";
  }

  if (category === "observability") {
    return "관측성";
  }

  if (category === "security_testing") {
    return "보안·테스트";
  }

  if (category === "knowledge_docs") {
    return "지식·문서";
  }

  if (category === "productivity_workflow") {
    return "생산성·워크플로";
  }

  if (category === "browser_automation") {
    return "브라우저 자동화";
  }

  if (category === "design_tools") {
    return "디자인 도구";
  }

  return "기타";
}

export function formatMarketTrustLevel(trustLevel: MarketTrustLevel) {
  if (trustLevel === "platform_supported") {
    return "플랫폼 지원";
  }

  if (trustLevel === "official") {
    return "공식";
  }

  if (trustLevel === "verified") {
    return "검증됨";
  }

  return "커뮤니티";
}

export function formatMarketVisibility(visibility: MarketVisibility) {
  if (visibility === "published") {
    return "게시됨";
  }

  if (visibility === "internal") {
    return "내부 공개";
  }

  if (visibility === "draft") {
    return "초안";
  }

  if (visibility === "hidden") {
    return "숨김";
  }

  return "격리됨";
}

export function formatToolCallStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "ok" || normalized === "success" || normalized === "succeeded") {
    return "성공";
  }

  if (normalized === "fail" || normalized === "failed" || normalized === "error") {
    return "실패";
  }

  return status;
}

export function formatServerVersionStatus(status: ServerVersionStatus) {
  if (status === "active") {
    return "활성";
  }

  if (status === "pending") {
    return "대기";
  }

  if (status === "draft") {
    return "초안";
  }

  if (status === "deprecated") {
    return "사용 중단";
  }

  if (status === "rolled_back") {
    return "롤백됨";
  }

  return "실패";
}

export function riskTone(riskLevel: RiskLevel): StatusTone {
  if (riskLevel === "critical") {
    return "danger";
  }

  if (riskLevel === "high") {
    return "warning";
  }

  if (riskLevel === "medium") {
    return "info";
  }

  return "success";
}

export function healthTone(status: string): StatusTone {
  if (status === "healthy") {
    return "success";
  }

  if (status === "degraded") {
    return "warning";
  }

  if (status === "unhealthy") {
    return "danger";
  }

  return "neutral";
}

export function policyTone(effect: PolicyEffect): StatusTone {
  if (effect === "allow") {
    return "success";
  }

  if (effect === "needs_approval") {
    return "warning";
  }

  return "danger";
}

export function enabledTone(enabled: boolean): StatusTone {
  return enabled ? "success" : "danger";
}

export function approvalTone(status: ApiApproval["status"]): StatusTone {
  if (status === "pending") {
    return "warning";
  }

  if (status === "approved") {
    return "success";
  }

  if (status === "cancelled" || status === "expired") {
    return "neutral";
  }

  return "danger";
}

export function marketTrustTone(trustLevel: MarketTrustLevel): StatusTone {
  if (trustLevel === "platform_supported" || trustLevel === "official") {
    return "success";
  }

  if (trustLevel === "verified") {
    return "info";
  }

  return "neutral";
}

export function marketVisibilityTone(visibility: MarketVisibility): StatusTone {
  if (visibility === "published" || visibility === "internal") {
    return "success";
  }

  if (visibility === "draft" || visibility === "hidden") {
    return "warning";
  }

  return "danger";
}
