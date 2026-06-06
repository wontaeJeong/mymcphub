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
});
