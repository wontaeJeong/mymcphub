import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ServerTable } from "../components/tables";
import type { ApiMcpServer } from "../lib/api";
import {
  marketVisibilityForServer,
  parseDelimitedList,
  summarizeMarketCuration,
} from "../lib/market";

const createdAt = "2026-06-09T00:00:00.000Z";
const updatedAt = "2026-06-09T01:00:00.000Z";

function buildServer(overrides: Partial<ApiMcpServer> = {}): ApiMcpServer {
  return {
    id: "server-docs",
    slug: "docs-market",
    displayName: "Docs Market",
    description: "Search internal docs",
    ownerTeamId: "team-platform",
    environment: "prod",
    transport: "streamable_http",
    enabled: true,
    published: false,
    quarantined: false,
    riskLevel: "medium",
    category: "knowledge_docs",
    tags: ["docs", "runbook", "incident", "search"],
    summary: "Curated internal documentation search",
    useCases: ["incident response"],
    installMethods: ["gateway"],
    prerequisites: [],
    securityNotes: [],
    trustLevel: "verified",
    visibility: "internal",
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe("lane D admin market curation", () => {
  it("parses comma and newline metadata lists without duplicates", () => {
    expect(parseDelimitedList("docs, runbook\nincident\r\ndocs,  ")).toEqual([
      "docs",
      "runbook",
      "incident",
    ]);
  });

  it("summarizes publish, review, quarantine, and metadata gaps", () => {
    const published = buildServer({
      id: "server-published",
      published: true,
      visibility: "published",
      docsUrl: "https://docs.example.test/server",
      reviewedAt: updatedAt,
      reviewedBy: "admin@example.test",
    });
    const draft = buildServer({ id: "server-draft", visibility: "draft", installMethods: undefined });
    const quarantined = buildServer({ id: "server-quarantined", quarantined: true, visibility: "quarantined" });

    expect(marketVisibilityForServer(buildServer({ visibility: undefined, published: true }))).toBe("published");
    expect(summarizeMarketCuration([published, draft, quarantined])).toEqual({
      published: 1,
      draftInternal: 1,
      unreviewedMetadata: 2,
      quarantined: 1,
      missingDocsOrInstall: 2,
    });
  });

  it("renders admin curation table metadata and missing docs/install states", () => {
    const html = renderToStaticMarkup(
      <ServerTable
        serverBasePath="/admin/servers"
        servers={[buildServer({ docsUrl: undefined, installMethods: undefined })]}
        showMarketCuration
      />,
    );

    expect(html).toContain("카테고리/태그");
    expect(html).toContain("지식/문서");
    expect(html).toContain("docs, runbook, incident 외 1개");
    expect(html).toContain("검증됨");
    expect(html).toContain("문서 누락");
    expect(html).toContain("설치 누락");
    expect(html).toContain("/admin/servers/server-docs#market-metadata");
    expect(html).toContain("/admin/audit?server=server-docs");
  });
});
