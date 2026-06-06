import { describe, expect, it } from "vitest";

import { createApiServer } from "./index";

describe("createApiServer", () => {
  it("serves the API health check", async () => {
    const app = createApiServer();
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ service: "api", status: "ok" });

    await app.close();
  });

  it("serves readiness and mock auth context", async () => {
    const app = createApiServer();

    const ready = await app.inject({ method: "GET", url: "/readyz" });
    const me = await app.inject({ method: "GET", url: "/api/me" });

    expect(ready.statusCode).toBe(200);
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      auth: {
        email: "admin@example.com",
        roles: ["admin"]
      }
    });

    await app.close();
  });

  it("lists seed servers and creates grants", async () => {
    const app = createApiServer();

    const servers = await app.inject({ method: "GET", url: "/api/servers" });
    const serverItems = servers.json<{ items: Array<{ id: string; slug: string }> }>().items;
    const echoServer = serverItems.find((server) => server.slug === "echo");

    expect(echoServer).toBeDefined();

    const grant = await app.inject({
      method: "POST",
      url: "/api/grants",
      payload: {
        subjectType: "team",
        subjectId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId: echoServer?.id,
        allowedTools: ["echo"],
        environment: "dev",
        reason: "Integration test grant"
      }
    });

    expect(grant.statusCode).toBe(201);
    expect(grant.json()).toMatchObject({ enabled: true, reason: "Integration test grant" });

    await app.close();
  });

  it("approves approvals and paginates audit events", async () => {
    const app = createApiServer();
    const serverId = "00000000-0000-4000-8000-000000000100";

    const approval = await app.inject({
      method: "POST",
      url: "/api/approvals",
      payload: {
        projectId: "00000000-0000-4000-8000-000000000020",
        serverId,
        requestedAction: "grant_tool",
        reason: "Need echo access"
      }
    });
    const created = approval.json<{ id: string }>();

    const approved = await app.inject({
      method: "POST",
      url: `/api/approvals/${created.id}/approve`
    });
    const audit = await app.inject({ method: "GET", url: "/api/audit-events?limit=1" });

    expect(approval.statusCode).toBe(201);
    expect(approved.json()).toMatchObject({ status: "approved" });
    expect(audit.json()).toMatchObject({ pageInfo: { limit: 1 } });

    await app.close();
  });

  it("generates client config and applies emergency controls", async () => {
    const app = createApiServer();
    const serverId = "00000000-0000-4000-8000-000000000100";

    const config = await app.inject({
      method: "POST",
      url: "/api/client-config/generate",
      payload: { client: "opencode", serverId }
    });
    const emergency = await app.inject({
      method: "POST",
      url: "/api/admin/emergency-deny",
      payload: { reason: "Integration test emergency" }
    });
    const revoke = await app.inject({
      method: "POST",
      url: `/api/admin/revoke-server-grants/${serverId}`
    });

    expect(config.statusCode).toBe(200);
    expect(config.json()).toMatchObject({ client: "opencode" });
    expect(emergency.json()).toMatchObject({ enabled: true });
    expect(revoke.json()).toMatchObject({ serverId });

    await app.close();
  });
});
