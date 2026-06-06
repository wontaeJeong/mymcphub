import { describe, expect, it } from "vitest";

import { createAuditArgumentSnapshot, hashAuditArguments, redactAuditArguments } from "./audit";

describe("audit helpers", () => {
  it("redacts nested sensitive keys case-insensitively across objects and arrays", () => {
    const redacted = redactAuditArguments({
      username: "admin",
      password: "pw",
      nested: {
        Token: "token-value",
        values: [{ apiKey: "api-key-value" }, { privateKey: "private-key-value" }]
      },
      headers: {
        authorization: "Bearer secret",
        cookie: "session=secret"
      },
      kubeconfig: "cluster-secret"
    });

    expect(redacted).toEqual({
      username: "admin",
      password: "[REDACTED]",
      nested: {
        Token: "[REDACTED]",
        values: [{ apiKey: "[REDACTED]" }, { privateKey: "[REDACTED]" }]
      },
      headers: {
        authorization: "[REDACTED]",
        cookie: "[REDACTED]"
      },
      kubeconfig: "[REDACTED]"
    });
    expect(JSON.stringify(redacted)).not.toContain("token-value");
    expect(JSON.stringify(redacted)).not.toContain("private-key-value");
  });

  it("computes stable hashes from canonical redacted JSON", () => {
    const first = createAuditArgumentSnapshot({ b: 2, password: "one", a: { token: "two", visible: true } });
    const second = createAuditArgumentSnapshot({ a: { visible: true, token: "different" }, password: "changed", b: 2 });

    expect(first.argumentRedactedJson).toEqual(second.argumentRedactedJson);
    expect(first.argumentHash).toBe(second.argumentHash);
    expect(first.argumentHash).toBe(hashAuditArguments(second.argumentRedactedJson));
  });
});
