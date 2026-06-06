import { describe, expect, it } from "vitest";

import { readConfig, requiredEnvKeys, type ConfigKey } from "./index";

describe("config helpers", () => {
  it("reads every required environment key deterministically", () => {
    const env = Object.fromEntries(requiredEnvKeys.map((key) => [key, `value-for-${key}`])) as Record<ConfigKey, string>;

    expect(readConfig(env)).toEqual(env);
  });

  it("preserves missing values without inventing defaults", () => {
    const config = readConfig({ NODE_ENV: "test", LOG_LEVEL: "debug" });

    expect(config.NODE_ENV).toBe("test");
    expect(config.LOG_LEVEL).toBe("debug");
    expect(config.DATABASE_URL).toBeUndefined();
    expect(Object.keys(config)).toEqual([...requiredEnvKeys]);
  });
});
