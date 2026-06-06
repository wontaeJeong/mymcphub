import { createHash } from "node:crypto";

export type ToolRisk = "low" | "medium" | "high" | "critical";

export type ToolSnapshot = {
  name: string;
  description: string;
  inputSchema: unknown;
  risk: ToolRisk;
};

export type ToolSchemaDiffType =
  | "tool_added"
  | "tool_removed"
  | "tool_description_changed"
  | "tool_input_schema_changed"
  | "tool_risk_changed";

export type ToolSchemaDiffMetadata = {
  approvalRequired: boolean;
  highRisk: boolean;
  reasons: string[];
};

export type ToolSchemaDiff = {
  type: ToolSchemaDiffType;
  toolName: string;
  metadata: ToolSchemaDiffMetadata;
  previousDescription?: string;
  currentDescription?: string;
  previousInputSchemaHash?: string;
  currentInputSchemaHash?: string;
  previousRisk?: ToolRisk;
  currentRisk?: ToolRisk;
};

const diffTypeOrder: Record<ToolSchemaDiffType, number> = {
  tool_added: 0,
  tool_removed: 1,
  tool_description_changed: 2,
  tool_input_schema_changed: 3,
  tool_risk_changed: 4
};

const riskRank: Record<ToolRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

export function hashCanonicalJson(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function diffToolSnapshots(previousSnapshot: ToolSnapshot[], currentSnapshot: ToolSnapshot[]) {
  const previousTools = indexTools(previousSnapshot, "previousSnapshot");
  const currentTools = indexTools(currentSnapshot, "currentSnapshot");
  const toolNames = [...new Set([...previousTools.keys(), ...currentTools.keys()])].sort((left, right) => left.localeCompare(right));
  const diffs: ToolSchemaDiff[] = [];

  for (const toolName of toolNames) {
    const previousTool = previousTools.get(toolName);
    const currentTool = currentTools.get(toolName);

    if (!previousTool && currentTool) {
      diffs.push({
        type: "tool_added",
        toolName,
        metadata: metadataForAddedTool(currentTool),
        currentDescription: currentTool.description,
        currentInputSchemaHash: hashCanonicalJson(currentTool.inputSchema),
        currentRisk: currentTool.risk
      });
      continue;
    }

    if (previousTool && !currentTool) {
      diffs.push({
        type: "tool_removed",
        toolName,
        metadata: highRiskMetadata("removed_tool"),
        previousDescription: previousTool.description,
        previousInputSchemaHash: hashCanonicalJson(previousTool.inputSchema),
        previousRisk: previousTool.risk
      });
      continue;
    }

    if (!previousTool || !currentTool) {
      continue;
    }

    if (previousTool.description !== currentTool.description) {
      diffs.push({
        type: "tool_description_changed",
        toolName,
        metadata: neutralMetadata(),
        previousDescription: previousTool.description,
        currentDescription: currentTool.description
      });
    }

    const previousInputSchemaHash = hashCanonicalJson(previousTool.inputSchema);
    const currentInputSchemaHash = hashCanonicalJson(currentTool.inputSchema);
    if (previousInputSchemaHash !== currentInputSchemaHash) {
      diffs.push({
        type: "tool_input_schema_changed",
        toolName,
        metadata: highRiskMetadata("input_schema_changed"),
        previousInputSchemaHash,
        currentInputSchemaHash
      });
    }

    if (previousTool.risk !== currentTool.risk) {
      diffs.push({
        type: "tool_risk_changed",
        toolName,
        metadata: metadataForRiskChange(previousTool.risk, currentTool.risk),
        previousRisk: previousTool.risk,
        currentRisk: currentTool.risk
      });
    }
  }

  return diffs.sort((left, right) => {
    const toolOrder = left.toolName.localeCompare(right.toolName);
    return toolOrder === 0 ? diffTypeOrder[left.type] - diffTypeOrder[right.type] : toolOrder;
  });
}

function indexTools(snapshot: ToolSnapshot[], snapshotName: string) {
  const tools = new Map<string, ToolSnapshot>();

  for (const tool of snapshot) {
    if (tools.has(tool.name)) {
      throw new Error(`${snapshotName} contains duplicate tool ${tool.name}.`);
    }

    tools.set(tool.name, tool);
  }

  return tools;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(",")}}`;
}

function neutralMetadata(): ToolSchemaDiffMetadata {
  return {
    approvalRequired: false,
    highRisk: false,
    reasons: []
  };
}

function highRiskMetadata(reason: string): ToolSchemaDiffMetadata {
  return {
    approvalRequired: true,
    highRisk: true,
    reasons: [reason]
  };
}

function metadataForAddedTool(tool: ToolSnapshot): ToolSchemaDiffMetadata {
  if (isHighOrCriticalRisk(tool.risk)) {
    return highRiskMetadata("added_high_or_critical_risk_tool");
  }

  return neutralMetadata();
}

function metadataForRiskChange(previousRisk: ToolRisk, currentRisk: ToolRisk): ToolSchemaDiffMetadata {
  const reasons = ["risk_changed"];
  const escalatedToHighOrCritical = riskRank[currentRisk] > riskRank[previousRisk] && isHighOrCriticalRisk(currentRisk);

  if (escalatedToHighOrCritical) {
    reasons.push("risk_escalated_to_high_or_critical");
  }

  return {
    approvalRequired: escalatedToHighOrCritical,
    highRisk: true,
    reasons
  };
}

function isHighOrCriticalRisk(risk: ToolRisk) {
  return risk === "high" || risk === "critical";
}
