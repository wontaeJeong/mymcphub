# MCP Server Language Matrix

| Server | Owner | Transport | Tools | Secrets | Risk | Dependencies | Runtime |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `k8s-readonly` | Platform Team | streamable_http | `list_namespaces`, `list_pods`, `get_pod` | none in mock mode | medium | Go namespace-scoped mock reader | Go |
| `runtime-adapter` | Platform Team | stdio_adapter | `stdio_adapter_bridge` | `adapter-command-config` ref | medium | Go stdio subprocess adapter | Go |
| `github-readonly` | Platform Team | streamable_http | `list_repositories`, `get_pull_request`, `search_issues` | `github-provider-token` ref | medium | Go mock provider surface | Go |
| `gitlab-readonly` | Platform Team | streamable_http | `list_projects`, `get_merge_request` | `gitlab-provider-token` ref | medium | Go mock provider surface | Go |
| `internal-docs-readonly` | Platform Team | streamable_http | `search_docs` plus resources/prompts | none | low | Go DLP-redacted docs surface | Go |

First-party MCP servers are Go by default. Web UI TypeScript does not extend to server runtimes or operator scripts.
