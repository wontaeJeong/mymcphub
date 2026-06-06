import type { GatewayServer } from "./types";

export function createDefaultRegistry(): GatewayServer[] {
  return [
    {
      id: "00000000-0000-4000-8000-000000000100",
      slug: "echo",
      environment: "dev",
      transport: "streamable_http",
      upstreamUrl: "local://echo",
      enabled: true,
      tools: [
        {
          name: "echo",
          description: "Echo an input payload through the gateway.",
          inputSchema: { type: "object" },
          enabled: true,
          riskLevel: "low"
        },
        {
          name: "admin_delete",
          description: "Disabled sample tool used to verify filtering.",
          inputSchema: { type: "object" },
          enabled: false,
          riskLevel: "critical"
        }
      ],
      grants: [
        {
          subjectType: "team",
          subjectId: "platform-team",
          projectId: "00000000-0000-4000-8000-000000000020",
          allowedTools: ["echo"]
        }
      ]
    }
  ];
}

export function findServerBySlug(registry: GatewayServer[], serverSlug: string) {
  return registry.find((server) => server.slug === serverSlug);
}
