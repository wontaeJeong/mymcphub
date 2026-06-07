package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/mcp-hub/mcp-hub/internal/controlplane"
)

func main() {
	mode := "json"
	if len(os.Args) > 1 {
		mode = os.Args[1]
	}
	switch mode {
	case "json":
		writeJSON()
	case "ts":
		writeTypeScriptClient()
	default:
		fmt.Fprintf(os.Stderr, "unsupported openapi generation mode %s\n", mode)
		os.Exit(1)
	}
}

func writeJSON() {
	encoded, err := json.MarshalIndent(controlplane.OpenAPIDocument(), "", "  ")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(string(encoded))
}

func writeTypeScriptClient() {
	document := controlplane.OpenAPIDocument()
	rawPaths, ok := document["paths"].(map[string]interface{})
	if !ok {
		fmt.Fprintln(os.Stderr, "runtime OpenAPI document has no paths object")
		os.Exit(1)
	}
	paths := make([]string, 0, len(rawPaths))
	for path := range rawPaths {
		paths = append(paths, path)
	}
	sort.Strings(paths)

	var out strings.Builder
	out.WriteString("declare const process: { env: Record<string, string | undefined> };\n\n")
	out.WriteString("export class GeneratedApiClientError extends Error {\n")
	out.WriteString("  readonly status?: number;\n")
	out.WriteString("  readonly details?: unknown;\n\n")
	out.WriteString("  constructor(message: string, status?: number, details?: unknown) {\n")
	out.WriteString("    super(message);\n")
	out.WriteString("    this.name = \"GeneratedApiClientError\";\n")
	out.WriteString("    this.status = status;\n")
	out.WriteString("    this.details = details;\n")
	out.WriteString("  }\n")
	out.WriteString("}\n\n")
	out.WriteString("export function getGeneratedApiBaseUrl() {\n")
	out.WriteString("  return process.env.MCP_API_URL ?? process.env.NEXT_PUBLIC_MCP_API_URL ?? \"http://localhost:4000\";\n")
	out.WriteString("}\n\n")
	out.WriteString("export const MCP_HUB_OPENAPI_PATHS = [\n")
	for i, path := range paths {
		comma := ","
		if i == len(paths)-1 {
			comma = ""
		}
		out.WriteString("  ")
		out.WriteString(strconv.Quote(path))
		out.WriteString(comma)
		out.WriteString("\n")
	}
	out.WriteString("] as const;\n\n")
	out.WriteString("export type McpHubOpenApiPath = (typeof MCP_HUB_OPENAPI_PATHS)[number];\n\n")
	out.WriteString("export function isMcpHubOpenApiPath(path: string): path is McpHubOpenApiPath {\n")
	out.WriteString("  return (MCP_HUB_OPENAPI_PATHS as readonly string[]).includes(path);\n")
	out.WriteString("}\n\n")
	out.WriteString("export function formatGeneratedApiError(error: unknown) {\n")
	out.WriteString("  if (error instanceof GeneratedApiClientError) {\n")
	out.WriteString("    return error.status ? `${error.message} (${error.status})` : error.message;\n")
	out.WriteString("  }\n\n")
	out.WriteString("  if (error instanceof Error) {\n")
	out.WriteString("    return error.message;\n")
	out.WriteString("  }\n\n")
	out.WriteString("  return \"The Control Plane API is unavailable.\";\n")
	out.WriteString("}\n\n")
	out.WriteString("export async function generatedApiRequest<Result>(path: string, init: RequestInit = {}): Promise<Result> {\n")
	out.WriteString("  const headers = new Headers(init.headers);\n")
	out.WriteString("  if (init.body && !headers.has(\"content-type\")) {\n")
	out.WriteString("    headers.set(\"content-type\", \"application/json\");\n")
	out.WriteString("  }\n\n")
	out.WriteString("  let response: Response;\n")
	out.WriteString("  try {\n")
	out.WriteString("    response = await fetch(new URL(path, getGeneratedApiBaseUrl()), {\n")
	out.WriteString("      ...init,\n")
	out.WriteString("      headers,\n")
	out.WriteString("      cache: \"no-store\"\n")
	out.WriteString("    });\n")
	out.WriteString("  } catch (error) {\n")
	out.WriteString("    throw new GeneratedApiClientError(\"Unable to reach the Control Plane API.\", undefined, error);\n")
	out.WriteString("  }\n\n")
	out.WriteString("  if (!response.ok) {\n")
	out.WriteString("    throw new GeneratedApiClientError(await readGeneratedErrorMessage(response), response.status);\n")
	out.WriteString("  }\n\n")
	out.WriteString("  if (response.status === 204) {\n")
	out.WriteString("    return undefined as Result;\n")
	out.WriteString("  }\n\n")
	out.WriteString("  return (await response.json()) as Result;\n")
	out.WriteString("}\n\n")
	out.WriteString("async function readGeneratedErrorMessage(response: Response) {\n")
	out.WriteString("  try {\n")
	out.WriteString("    const body = (await response.json()) as unknown;\n")
	out.WriteString("    if (isGeneratedErrorResponse(body)) {\n")
	out.WriteString("      return body.error.message;\n")
	out.WriteString("    }\n")
	out.WriteString("  } catch {\n")
	out.WriteString("    return response.statusText || \"Control Plane API request failed.\";\n")
	out.WriteString("  }\n\n")
	out.WriteString("  return response.statusText || \"Control Plane API request failed.\";\n")
	out.WriteString("}\n\n")
	out.WriteString("function isGeneratedErrorResponse(value: unknown): value is { error: { message: string } } {\n")
	out.WriteString("  if (!value || typeof value !== \"object\") {\n")
	out.WriteString("    return false;\n")
	out.WriteString("  }\n\n")
	out.WriteString("  const candidate = value as Record<string, unknown>;\n")
	out.WriteString("  const error = candidate.error;\n")
	out.WriteString("  if (!error || typeof error !== \"object\") {\n")
	out.WriteString("    return false;\n")
	out.WriteString("  }\n\n")
	out.WriteString("  const errorRecord = error as Record<string, unknown>;\n")
	out.WriteString("  return typeof errorRecord.message === \"string\";\n")
	out.WriteString("}\n")

	fmt.Print(out.String())
}
