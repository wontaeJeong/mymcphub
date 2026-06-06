import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const riskLevels = new Set(["low", "medium", "high", "critical"]);
const dangerousKeywords = [
  "delete",
  "exec",
  "shell",
  "apply",
  "write",
  "push",
  "merge",
  "deploy",
  "secret",
  "credential",
  "token",
  "admin",
  "cluster"
];

type JsonRecord = Record<string, unknown>;

type Finding = {
  file: string;
  level: "error" | "warning";
  message: string;
};

const rootDir = process.cwd();
const explicitFiles = process.argv.slice(2).filter((argument) => argument !== "--");
const files = explicitFiles.length > 0 ? explicitFiles : defaultManifestFiles();
const findings: Finding[] = [];

if (files.length === 0) {
  console.log("SKIP: no MCP manifests found under servers/*/mcp-server.manifest.json");
  process.exit(0);
}

for (const file of files) {
  checkManifest(file);
}

for (const finding of findings) {
  const prefix = finding.level === "error" ? "ERROR" : "REVIEW";
  console.log(`${prefix}: ${finding.file}: ${finding.message}`);
}

const errorCount = findings.filter((finding) => finding.level === "error").length;
const warningCount = findings.filter((finding) => finding.level === "warning").length;

if (errorCount > 0) {
  console.log(`MCP manifest check failed with ${errorCount} error(s) and ${warningCount} review warning(s).`);
  process.exit(1);
}

console.log(`MCP manifest check passed for ${files.length} file(s) with ${warningCount} review warning(s).`);

function defaultManifestFiles() {
  const serversDir = join(rootDir, "servers");

  try {
    return readdirSync(serversDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(serversDir, entry.name, "mcp-server.manifest.json"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`SKIP: unable to read servers directory: ${message}`);
    return [];
  }
}

function checkManifest(file: string) {
  const label = relative(rootDir, file);
  const manifest = readJsonObject(file, label);
  if (!manifest) {
    return;
  }

  requireNonEmptyString(manifest.slug, label, "missing slug");
  requireNonEmptyString(manifest.ownerTeam, label, "missing ownerTeam");
  requireNonEmptyString(manifest.ownerTeamId, label, "missing ownerTeamId");
  requireRiskLevel(manifest.riskLevel, label, "missing manifest riskLevel", "invalid manifest riskLevel");

  const tools = manifest.tools;
  if (!Array.isArray(tools)) {
    addError(label, "tools must be an array");
    return;
  }

  for (const [index, rawTool] of tools.entries()) {
    const toolLabel = `${label} tools[${index}]`;
    if (!isRecord(rawTool)) {
      addError(toolLabel, "tool must be an object");
      continue;
    }

    const toolName = typeof rawTool.name === "string" && rawTool.name.length > 0 ? rawTool.name : `tools[${index}]`;
    const namedToolLabel = `${label} ${toolName}`;
    const toolRiskLevel = requireRiskLevel(rawTool.riskLevel, namedToolLabel, "missing tool riskLevel", "invalid tool riskLevel");

    if (!isRecord(rawTool.inputSchema)) {
      addError(namedToolLabel, "invalid tool inputSchema object");
    } else if (rawTool.inputSchema.type !== "object") {
      addError(namedToolLabel, "inputSchema.type must be object");
    } else if (rawTool.inputSchema.additionalProperties !== false) {
      addError(namedToolLabel, "missing additionalProperties false on inputSchema");
    }

    if ((toolRiskLevel === "high" || toolRiskLevel === "critical") && !hasDescription(rawTool.description)) {
      addError(namedToolLabel, "high/critical tools require descriptions");
    }

    if ((toolRiskLevel === "high" || toolRiskLevel === "critical") && rawTool.readOnly !== true) {
      addWarning(namedToolLabel, "high/critical tool is not explicitly readOnly true and needs security review");
    }

    const dangerousHits = dangerousKeywords.filter((keyword) => containsKeyword(rawTool, keyword));
    if (dangerousHits.length > 0) {
      addWarning(namedToolLabel, `dangerous keyword review needed: ${dangerousHits.join(", ")}`);
    }
  }
}

function readJsonObject(file: string, label: string) {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!isRecord(parsed)) {
      addError(label, "manifest must be a JSON object");
      return undefined;
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addError(label, `unable to read or parse manifest: ${message}`);
    return undefined;
  }
}

function requireNonEmptyString(value: unknown, file: string, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(file, message);
  }
}

function requireRiskLevel(value: unknown, file: string, missingMessage: string, invalidMessage: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(file, missingMessage);
    return undefined;
  }
  if (!riskLevels.has(value)) {
    addError(file, `${invalidMessage}: ${value}`);
    return undefined;
  }
  return value;
}

function hasDescription(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsKeyword(value: unknown, keyword: string): boolean {
  if (typeof value === "string") {
    return value.toLowerCase().includes(keyword);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsKeyword(item, keyword));
  }
  if (isRecord(value)) {
    return Object.entries(value).some(([entryKey, entryValue]) => entryKey.toLowerCase().includes(keyword) || containsKeyword(entryValue, keyword));
  }
  return false;
}

function addError(file: string, message: string) {
  findings.push({ file, level: "error", message });
}

function addWarning(file: string, message: string) {
  findings.push({ file, level: "warning", message });
}
