import type { PolicyEffect, RiskLevel } from "../lib/api";
import type { StatusTone } from "@mcp-hub/ui";

export function formatDate(value: string | undefined) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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
