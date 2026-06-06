import { SpanStatusCode, trace } from "@opentelemetry/api";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogAttributes = Record<string, unknown>;

export type SpanAttributes = Record<string, string | number | boolean>;

export function createLogger(service: string) {
  const write = (level: LogLevel, message: string, attributes: LogAttributes = {}) => {
    console.log(JSON.stringify({
      attributes,
      level,
      message,
      service,
      timestamp: new Date().toISOString()
    }));
  };

  return {
    debug: (message: string, attributes?: LogAttributes) => write("debug", message, attributes),
    info: (message: string, attributes?: LogAttributes) => write("info", message, attributes),
    warn: (message: string, attributes?: LogAttributes) => write("warn", message, attributes),
    error: (message: string, attributes?: LogAttributes) => write("error", message, attributes)
  };
}

export async function withSpan<T>(
  service: string,
  spanName: string,
  attributes: SpanAttributes | undefined,
  fn: () => T | Promise<T>
): Promise<T> {
  const tracer = trace.getTracer(service);
  const span = tracer.startSpan(spanName);

  if (attributes !== undefined) {
    span.setAttributes(attributes);
  }

  try {
    return await fn();
  } catch (error) {
    span.recordException(error instanceof Error ? error : String(error));
    span.setStatus({ code: SpanStatusCode.ERROR, message: "span failed" });
    throw error;
  } finally {
    span.end();
  }
}
