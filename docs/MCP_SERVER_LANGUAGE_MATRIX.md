# MCP Server Language Matrix

| Server | Owner | Transport | Tools | Secrets | Risk | Dependencies | Runtime |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `k8s-readonly` | Platform Team | streamable_http | `list_namespaces`, `list_pods`, `get_pod` | kube credentials in future real mode | medium | Go local mock now | Go |

First-party MCP servers are Go by default. Web UI TypeScript does not extend to server runtimes or operator scripts.
