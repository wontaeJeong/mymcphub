import { afterEach, describe, expect, it, vi } from "vitest";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { createLogger, withSpan } from "./index.js";

vi.mock("@opentelemetry/api", () => ({
  SpanStatusCode: {
    ERROR: 2
  },
  trace: {
    getTracer: vi.fn()
  }
}));

type MockSpan = {
  end: ReturnType<typeof vi.fn>;
  recordException: ReturnType<typeof vi.fn>;
  setAttributes: ReturnType<typeof vi.fn>;
  setStatus: ReturnType<typeof vi.fn>;
};

const getTracerMock = vi.mocked(trace.getTracer);

function createMockSpan(): MockSpan {
  return {
    end: vi.fn(),
    recordException: vi.fn(),
    setAttributes: vi.fn(),
    setStatus: vi.fn()
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("createLogger", () => {
  it("writes timestamped JSON log entries", () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger("api");

    logger.info("started", { requestId: "req-1", traceId: "trace-1" });

    expect(consoleLog).toHaveBeenCalledTimes(1);
    const [rawEntry] = consoleLog.mock.calls[0] ?? [];
    expect(typeof rawEntry).toBe("string");

    const entry = JSON.parse(String(rawEntry)) as {
      attributes: Record<string, unknown>;
      level: string;
      message: string;
      service: string;
      timestamp: string;
    };

    expect(entry).toMatchObject({
      attributes: { requestId: "req-1", traceId: "trace-1" },
      level: "info",
      message: "started",
      service: "api"
    });
    expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
  });

  it("preserves debug, warn, and error logger methods", () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger("worker");

    logger.debug("debug message");
    logger.warn("warn message");
    logger.error("error message");

    const levels = consoleLog.mock.calls.map(([rawEntry]) => {
      const entry = JSON.parse(String(rawEntry)) as { level: string };
      return entry.level;
    });

    expect(levels).toEqual(["debug", "warn", "error"]);
  });
});

describe("withSpan", () => {
  it("runs the callback with a named span and ends it", async () => {
    const span = createMockSpan();
    const startSpan = vi.fn(() => span);
    getTracerMock.mockReturnValue({ startSpan } as unknown as ReturnType<typeof trace.getTracer>);

    const result = await withSpan("api", "load catalog", { cached: false, count: 3 }, () => "ok");

    expect(result).toBe("ok");
    expect(getTracerMock).toHaveBeenCalledWith("api");
    expect(startSpan).toHaveBeenCalledWith("load catalog");
    expect(span.setAttributes).toHaveBeenCalledWith({ cached: false, count: 3 });
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it("records exceptions, marks the span as error, ends it, and rethrows", async () => {
    const span = createMockSpan();
    const startSpan = vi.fn(() => span);
    const error = new Error("database password leaked here");
    getTracerMock.mockReturnValue({ startSpan } as unknown as ReturnType<typeof trace.getTracer>);

    await expect(withSpan("api", "save", undefined, () => {
      throw error;
    })).rejects.toThrow(error);

    expect(span.recordException).toHaveBeenCalledWith(error);
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR, message: "span failed" });
    expect(span.end).toHaveBeenCalledTimes(1);
  });
});
