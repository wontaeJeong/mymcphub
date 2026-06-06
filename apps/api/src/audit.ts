import { createHash } from "node:crypto";

export type AuditJsonValue = string | number | boolean | null | AuditJsonValue[] | { [key: string]: AuditJsonValue };

const sensitiveKeys = new Set([
  "password",
  "passwd",
  "token",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "kubeconfig",
  "privatekey"
]);

const redactedValue = "[REDACTED]";

export function redactAuditArguments(value: unknown): AuditJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactAuditArguments(item));
  }

  if (typeof value === "object") {
    const result: { [key: string]: AuditJsonValue } = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveKey(key) ? redactedValue : redactAuditArguments(nestedValue);
    }
    return result;
  }

  return null;
}

export function hashAuditArguments(redactedValue: AuditJsonValue) {
  return createHash("sha256").update(canonicalJson(redactedValue)).digest("hex");
}

export function createAuditArgumentSnapshot(value: unknown) {
  const argumentRedactedJson = redactAuditArguments(value);
  return {
    argumentHash: hashAuditArguments(argumentRedactedJson),
    argumentRedactedJson
  };
}

export function canonicalJson(value: AuditJsonValue): string {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  return `{${Object.entries(value)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${canonicalJson(nestedValue ?? null)}`)
    .join(",")}}`;
}

function isSensitiveKey(key: string) {
  return sensitiveKeys.has(key.toLowerCase());
}
