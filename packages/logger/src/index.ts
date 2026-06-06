export type LogLevel = "debug" | "info" | "warn" | "error";

export function createLogger(service: string) {
  const write = (level: LogLevel, message: string, attributes: Record<string, unknown> = {}) => {
    console.log(JSON.stringify({ attributes, level, message, service }));
  };

  return {
    debug: (message: string, attributes?: Record<string, unknown>) => write("debug", message, attributes),
    info: (message: string, attributes?: Record<string, unknown>) => write("info", message, attributes),
    warn: (message: string, attributes?: Record<string, unknown>) => write("warn", message, attributes),
    error: (message: string, attributes?: Record<string, unknown>) => write("error", message, attributes)
  };
}
