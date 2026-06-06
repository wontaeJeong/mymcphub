import { notFound, validationError } from "./errors";
import type { ApiMcpServer } from "./types";

export type ClientConfigKind = "generic" | "opencode" | "claude-code" | "codex" | "vscode";

export type ClientConfigResult = {
  client: ClientConfigKind;
  placeholder: boolean;
  config: Record<string, unknown>;
};

export interface ClientConfigFormatter {
  kind: ClientConfigKind;
  format(server: ApiMcpServer): ClientConfigResult;
}

const formatters: ClientConfigFormatter[] = [
  {
    kind: "generic",
    format: (server) => ({
      client: "generic",
      placeholder: false,
      config: {
        transport: "streamable_http",
        url: server.upstreamUrl ?? `/mcp/${server.slug}`
      }
    })
  },
  {
    kind: "opencode",
    format: (server) => ({
      client: "opencode",
      placeholder: false,
      config: {
        mcp: {
          [server.slug]: {
            type: "remote",
            url: server.upstreamUrl ?? `/mcp/${server.slug}`
          }
        }
      }
    })
  },
  {
    kind: "claude-code",
    format: (server) => ({
      client: "claude-code",
      placeholder: true,
      config: {
        mcpServers: {
          [server.slug]: {
            url: server.upstreamUrl ?? `/mcp/${server.slug}`,
            note: "Placeholder format until Claude Code remote MCP config is finalized."
          }
        }
      }
    })
  },
  {
    kind: "codex",
    format: (server) => ({
      client: "codex",
      placeholder: true,
      config: {
        mcpServers: {
          [server.slug]: {
            url: server.upstreamUrl ?? `/mcp/${server.slug}`,
            note: "Codex MCP remote config placeholder."
          }
        }
      }
    })
  },
  {
    kind: "vscode",
    format: (server) => ({
      client: "vscode",
      placeholder: true,
      config: {
        servers: {
          [server.slug]: {
            url: server.upstreamUrl ?? `/mcp/${server.slug}`,
            note: "VS Code MCP config placeholder."
          }
        }
      }
    })
  }
];

export function generateClientConfig(client: string, server: ApiMcpServer): ClientConfigResult {
  const formatter = formatters.find((candidate) => candidate.kind === client);

  if (!formatter) {
    throw validationError("Unsupported client config kind", { supportedClients: formatters.map((item) => item.kind) });
  }

  if (!server.enabled) {
    throw notFound("MCP_SERVER_DISABLED", "MCP server is disabled");
  }

  return formatter.format(server);
}
