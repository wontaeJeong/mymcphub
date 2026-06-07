# Operations

Operate MCP Hub through `mcphubctl`, the Web UI, or the Control Plane API.

Daily checks:

```sh
mcphubctl health
mcphubctl server list
mcphubctl audit search --server <server>
```

High-risk changes require platform-admin context and emit audit events. Gateway policy denies must be investigated before retrying upstream calls. Secrets must be referenced by secret stores or Kubernetes Secret refs, never pasted into logs, values, or scripts.
